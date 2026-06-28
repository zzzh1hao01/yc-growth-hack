"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { chatCompletion } from "./lib/openai";
import { geocodeAddress } from "./lib/google";
import { searchBusinessContext } from "./lib/fiber";
import { resolveServiceAreas } from "./lib/sfRegions";

function resolveBusinessName(
  parsedName: string,
  businessDescription: string,
  placesName?: string,
): string {
  if (parsedName.trim()) return parsedName.trim();
  if (placesName?.trim()) return placesName.trim();
  const firstLine = businessDescription.split(/[.!?\n]/)[0]?.trim();
  return firstLine || "Your business";
}

function parseAgentProfile(
  profileRaw: string,
  businessDescription: string,
): {
  serviceProfile: {
    lines_of_business: string[];
    price_point: string;
    customer_preferences: string;
  };
  businessName: string;
} {
  try {
    const parsed = JSON.parse(profileRaw) as {
      lines_of_business?: string[];
      service_types?: string[];
      price_point?: string;
      customer_preferences?: string;
      business_name?: string;
    };
    const lines =
      parsed.lines_of_business ??
      parsed.service_types ??
      ["home"];
    return {
      serviceProfile: {
        lines_of_business: lines,
        price_point: parsed.price_point ?? "mid",
        customer_preferences:
          parsed.customer_preferences ?? businessDescription.slice(0, 200),
      },
      businessName: parsed.business_name?.trim() ?? "",
    };
  } catch {
    return {
      serviceProfile: {
        lines_of_business: ["home"],
        price_point: "mid",
        customer_preferences: businessDescription.slice(0, 200),
      },
      businessName: "",
    };
  }
}

export const enrichCompanyContextJob = internalAction({
  args: {
    sessionId: v.string(),
    userId: v.optional(v.string()),
    businessDescription: v.string(),
    businessAddress: v.string(),
    formattedAddress: v.string(),
    lat: v.number(),
    lng: v.number(),
    businessName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const companyContext = await searchBusinessContext({
        businessDescription: args.businessDescription,
        businessAddress: args.businessAddress,
        formattedAddress: args.formattedAddress,
        lat: args.lat,
        lng: args.lng,
        businessName: args.businessName,
      });

      await ctx.runMutation(internal.contractors.patchCompanyContext, {
        sessionId: args.sessionId,
        companyContext: companyContext ?? undefined,
        companyEnrichmentStatus: "done",
      });

      if (args.userId) {
        await ctx.runMutation(internal.agents.patchAgentCompanyContext, {
          userId: args.userId,
          companyContext: companyContext ?? undefined,
          companyEnrichmentStatus: "done",
        });
      }
    } catch {
      await ctx.runMutation(internal.contractors.patchCompanyContext, {
        sessionId: args.sessionId,
        companyEnrichmentStatus: "failed",
      });
    }
  },
});

export const completeOnboarding = action({
  args: {
    sessionId: v.string(),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    userId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const [geocoded, profileRaw] = await Promise.all([
      geocodeAddress(args.businessAddress),
      chatCompletion(
        [
          {
            role: "system",
            content:
              "Extract a structured insurance agent profile from the description. Return JSON only with keys: lines_of_business (string array, values like home, auto, life, umbrella), price_point (low|mid|high), customer_preferences (short string), business_name (agency name if mentioned, else empty string).",
          },
          {
            role: "user",
            content: args.businessDescription,
          },
        ],
        { json: true },
      ),
    ]);

    const { serviceProfile, businessName: parsedBusinessName } = parseAgentProfile(
      profileRaw,
      args.businessDescription,
    );
    const businessName = resolveBusinessName(
      parsedBusinessName,
      args.businessDescription,
    );
    const serviceAreas = resolveServiceAreas(geocoded.lat, geocoded.lng);

    await ctx.runMutation(internal.contractors.saveContractor, {
      sessionId: args.sessionId,
      name: args.name,
      businessDescription: args.businessDescription,
      businessAddress: geocoded.formattedAddress,
      businessName,
      lat: geocoded.lat,
      lng: geocoded.lng,
      serviceProfile,
      companyEnrichmentStatus: "pending",
      serviceRegionIds: serviceAreas.regionIds,
      serviceRegionLabel: serviceAreas.label,
    });

    if (args.userId && args.orgId) {
      await ctx.runMutation(internal.agents.saveAgent, {
        userId: args.userId,
        orgId: args.orgId,
        sessionId: args.sessionId,
        name: args.name,
        businessDescription: args.businessDescription,
        businessAddress: geocoded.formattedAddress,
        businessName,
        lat: geocoded.lat,
        lng: geocoded.lng,
        serviceProfile,
        companyEnrichmentStatus: "pending",
        serviceRegionIds: serviceAreas.regionIds,
        serviceRegionLabel: serviceAreas.label,
      });
    }

    await ctx.scheduler.runAfter(0, internal.onboarding.enrichCompanyContextJob, {
      sessionId: args.sessionId,
      userId: args.userId,
      businessDescription: args.businessDescription,
      businessAddress: args.businessAddress,
      formattedAddress: geocoded.formattedAddress,
      lat: geocoded.lat,
      lng: geocoded.lng,
      businessName: businessName || undefined,
    });

    return {
      serviceProfile,
      businessAddress: geocoded.formattedAddress,
      businessName,
      lat: geocoded.lat,
      lng: geocoded.lng,
      companyEnrichmentStatus: "pending" as const,
      serviceRegionLabel: serviceAreas.label,
      serviceRegionIds: serviceAreas.regionIds,
    };
  },
});

export const refreshCompanyContext = action({
  args: {
    sessionId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, userId }) => {
    const agent = await ctx.runQuery(api.agents.getAgent, { userId, sessionId });
    if (!agent?.lat || !agent?.lng) {
      throw new Error("Complete onboarding before refreshing business intelligence.");
    }

    if (sessionId) {
      await ctx.runMutation(internal.contractors.patchCompanyContext, {
        sessionId,
        companyEnrichmentStatus: "pending",
      });
    }
    if (userId) {
      await ctx.runMutation(internal.agents.patchAgentCompanyContext, {
        userId,
        companyEnrichmentStatus: "pending",
      });
    }

    let businessName = "";
    try {
      const profileRaw = await chatCompletion(
        [
          {
            role: "system",
            content:
              "Extract business_name from the description. Return JSON only: { business_name: string }.",
          },
          { role: "user", content: agent.businessDescription },
        ],
        { json: true },
      );
      businessName =
        (JSON.parse(profileRaw) as { business_name?: string }).business_name?.trim() ?? "";
    } catch {
      businessName = "";
    }

    const companyContext = await searchBusinessContext({
      businessDescription: agent.businessDescription,
      businessAddress: agent.businessAddress,
      formattedAddress: agent.businessAddress,
      lat: agent.lat,
      lng: agent.lng,
      businessName: (agent.businessName ?? businessName) || undefined,
    });

    if (sessionId) {
      await ctx.runMutation(internal.contractors.patchCompanyContext, {
        sessionId,
        companyContext: companyContext ?? undefined,
        companyEnrichmentStatus: "done",
      });
    }
    if (userId) {
      await ctx.runMutation(internal.agents.patchAgentCompanyContext, {
        userId,
        companyContext: companyContext ?? undefined,
        companyEnrichmentStatus: "done",
      });
    }

    return { companyContext };
  },
});

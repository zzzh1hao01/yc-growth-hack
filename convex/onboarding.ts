"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { chatCompletion } from "./lib/openai";
import { geocodeAddress } from "./lib/google";
import { searchBusinessContext } from "./lib/fiber";
import { resolveServiceAreas } from "./lib/sfRegions";

export const completeOnboarding = action({
  args: {
    sessionId: v.string(),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const geocoded = await geocodeAddress(args.businessAddress);

    const profileRaw = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Extract a structured contractor service profile from the description. Return JSON only with keys: service_types (string array, values like hvac, electrical, panel, ev), price_point (low|mid|high), customer_preferences (short string), business_name (company name if mentioned, else empty string).",
        },
        {
          role: "user",
          content: args.businessDescription,
        },
      ],
      { json: true },
    );

    let serviceProfile: {
      service_types: string[];
      price_point: string;
      customer_preferences: string;
    };
    let businessName = "";

    try {
      const parsed = JSON.parse(profileRaw) as {
        service_types?: string[];
        price_point?: string;
        customer_preferences?: string;
        business_name?: string;
      };
      serviceProfile = {
        service_types: parsed.service_types ?? ["hvac"],
        price_point: parsed.price_point ?? "mid",
        customer_preferences:
          parsed.customer_preferences ?? args.businessDescription.slice(0, 200),
      };
      businessName = parsed.business_name?.trim() ?? "";
    } catch {
      serviceProfile = {
        service_types: ["hvac"],
        price_point: "mid",
        customer_preferences: args.businessDescription.slice(0, 200),
      };
    }

    const companyContext = await searchBusinessContext({
      businessDescription: args.businessDescription,
      businessAddress: args.businessAddress,
      formattedAddress: geocoded.formattedAddress,
      lat: geocoded.lat,
      lng: geocoded.lng,
      businessName: businessName || undefined,
    });

    const serviceAreas = resolveServiceAreas(geocoded.lat, geocoded.lng);

    await ctx.runMutation(internal.contractors.saveContractor, {
      sessionId: args.sessionId,
      name: args.name,
      businessDescription: args.businessDescription,
      businessAddress: geocoded.formattedAddress,
      lat: geocoded.lat,
      lng: geocoded.lng,
      serviceProfile,
      companyContext: companyContext ?? undefined,
      serviceRegionIds: serviceAreas.regionIds,
      serviceRegionLabel: serviceAreas.label,
    });

    return {
      serviceProfile,
      businessAddress: geocoded.formattedAddress,
      lat: geocoded.lat,
      lng: geocoded.lng,
      companyContext,
      serviceRegionLabel: serviceAreas.label,
      serviceRegionIds: serviceAreas.regionIds,
    };
  },
});

export const refreshCompanyContext = action({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const contractor = await ctx.runQuery(api.contractors.getContractor, { sessionId });
    if (!contractor?.lat || !contractor?.lng) {
      throw new Error("Complete onboarding before refreshing business intelligence.");
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
          { role: "user", content: contractor.businessDescription },
        ],
        { json: true },
      );
      businessName =
        (JSON.parse(profileRaw) as { business_name?: string }).business_name?.trim() ?? "";
    } catch {
      businessName = "";
    }

    const companyContext = await searchBusinessContext({
      businessDescription: contractor.businessDescription,
      businessAddress: contractor.businessAddress,
      formattedAddress: contractor.businessAddress,
      lat: contractor.lat,
      lng: contractor.lng,
      businessName: businessName || undefined,
    });

    await ctx.runMutation(internal.contractors.saveContractor, {
      sessionId: contractor.sessionId,
      name: contractor.name,
      businessDescription: contractor.businessDescription,
      businessAddress: contractor.businessAddress,
      lat: contractor.lat,
      lng: contractor.lng,
      serviceProfile: contractor.serviceProfile,
      companyContext: companyContext ?? undefined,
      serviceRegionIds: contractor.serviceRegionIds,
      serviceRegionLabel: contractor.serviceRegionLabel,
    });

    return { companyContext };
  },
});

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!clientId || !clientSecret || !convexUrl) {
    return NextResponse.json({ error: "Slack or Convex not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${appUrl}/settings?slack=error`);
  }

  let userId: string;
  let orgId: Id<"organizations">;
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString()) as {
      userId: string;
      orgId: Id<"organizations">;
    };
    userId = parsed.userId;
    orgId = parsed.orgId;
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?slack=error`);
  }

  const redirectUri = `${appUrl}/api/slack/callback`;
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    ok?: boolean;
    access_token?: string;
    team?: { id?: string };
    incoming_webhook?: { channel_id?: string };
  };

  if (!tokenData.ok || !tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?slack=error`);
  }

  const convex = new ConvexHttpClient(convexUrl);
  await convex.mutation(api.organizations.updateOrgIntegrations, {
    userId,
    orgId,
    slackTeamId: tokenData.team?.id,
    slackAccessToken: tokenData.access_token,
    slackChannelId: tokenData.incoming_webhook?.channel_id,
  });

  return NextResponse.redirect(`${appUrl}/settings?slack=connected`);
}

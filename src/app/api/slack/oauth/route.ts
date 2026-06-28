import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const SLACK_SCOPES = ["channels:read", "chat:write", "groups:read"].join(",");

export async function GET(request: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!clientId) {
    return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", appUrl));
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const state = Buffer.from(JSON.stringify({ userId, orgId })).toString("base64url");
  const redirectUri = `${appUrl}/api/slack/callback`;

  const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackUrl.searchParams.set("client_id", clientId);
  slackUrl.searchParams.set("scope", SLACK_SCOPES);
  slackUrl.searchParams.set("redirect_uri", redirectUri);
  slackUrl.searchParams.set("state", state);

  return NextResponse.redirect(slackUrl.toString());
}

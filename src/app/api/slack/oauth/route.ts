import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** HouseholdIQ does not use its own Slack app — Orange Slice handles Slack. */
export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", appUrl));
  }

  return NextResponse.redirect(
    `${appUrl}/settings?slack=orangeslice`,
  );
}

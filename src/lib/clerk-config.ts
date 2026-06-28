/** Clerk is optional — unset NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to run without auth. */
export function isClerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

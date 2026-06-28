/**
 * UI-only demo mode — no Convex, no Clerk, no API keys required (Mapbox still needed for map tiles).
 * Enabled when NEXT_PUBLIC_CONVEX_URL is unset, or set NEXT_PUBLIC_UI_DEMO=true.
 */
export function isUiDemoMode() {
  const flag = process.env.NEXT_PUBLIC_UI_DEMO?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
}

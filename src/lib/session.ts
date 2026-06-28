"use client";

const SESSION_KEY = "householdiq_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** New session id — clears saved contractor and shows onboarding again. */
export function resetSession(): string {
  if (typeof window === "undefined") return "";
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

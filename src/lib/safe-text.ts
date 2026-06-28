/** Avoid React crash when API returns objects instead of strings. */
export function asDisplayText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(asDisplayText).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of [
      "text",
      "summary",
      "description",
      "content",
      "paragraph",
      "body",
    ]) {
      if (typeof obj[key] === "string" && obj[key].trim()) {
        return obj[key].trim();
      }
    }
    return "";
  }
  return "";
}

export type PersonaLike = {
  summary?: unknown;
  likely_response_to_cold_approach?: unknown;
  conversion_hooks?: unknown;
  common_objections?: unknown;
  preferred_contractor_channel?: unknown;
};

export function personaParagraphs(persona: PersonaLike | null | undefined): string[] {
  if (!persona) return [];
  return [asDisplayText(persona.summary), asDisplayText(persona.conversion_hooks)].filter(
    Boolean,
  );
}

export function personaColdApproach(persona: PersonaLike | null | undefined): string {
  return asDisplayText(persona?.likely_response_to_cold_approach);
}

export function personaObjections(persona: PersonaLike | null | undefined): string[] {
  if (!persona?.common_objections) return [];
  if (Array.isArray(persona.common_objections)) {
    return persona.common_objections.map(asDisplayText).filter(Boolean);
  }
  const text = asDisplayText(persona.common_objections);
  return text ? [text] : [];
}

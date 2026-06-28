export type SheetLeadPayload = {
  household_id: string;
  convex_lead_id: string;
  session_id: string;
  address: string;
  owner_name: string;
  owner_first_name: string;
  owner_last_name: string;
  match_score: number;
  need_score: number;
  timing_score: number;
  gap_dollars: number;
  gap_pct: number;
  coverage_hook: string;
  persona_hook: string;
  agent_name: string;
  agency_name: string;
  /** @deprecated Kept for sheet compatibility */
  contractor_name: string;
  /** @deprecated Kept for sheet compatibility */
  contractor_business: string;
  /** @deprecated Kept for sheet compatibility */
  vertical: string;
  /** @deprecated Kept for sheet compatibility */
  vertical_hook: string;
  emails: string[];
  phones: string[];
  linkedin_url?: string;
  playbook: string;
  channels: string[];
  status: string;
  campaign_slug: string;
  touch1_subject: string;
  touch1_body: string;
  touch2_subject: string;
  touch2_body: string;
  recorded_owner_source?: string;
  parcel_number?: string;
  city: string;
  state: string;
};

export type SheetPushResult = {
  synced: boolean;
  rowId?: string;
  error?: string;
};

/** Flat row shape for Orange Slice "Import from API" / webhook ingest. */
export type SheetImportRow = {
  household_id: string;
  convex_lead_id: string;
  session_id: string;
  address: string;
  owner_name: string;
  owner_first_name: string;
  owner_last_name: string;
  match_score: number;
  need_score: number;
  timing_score: number;
  gap_dollars: number;
  gap_pct: number;
  coverage_hook: string;
  persona_hook: string;
  agent_name: string;
  agency_name: string;
  contractor_name: string;
  contractor_business: string;
  vertical: string;
  vertical_hook: string;
  email: string;
  phone: string;
  email_2: string;
  phone_2: string;
  emails_json: string;
  phones_json: string;
  linkedin_url: string;
  playbook: string;
  channels: string;
  status: string;
  campaign_slug: string;
  touch1_subject: string;
  touch1_body: string;
  touch2_subject: string;
  touch2_body: string;
  recorded_owner_source: string;
  parcel_number: string;
  city: string;
  state: string;
};

export function flattenSheetPayload(payload: SheetLeadPayload): SheetImportRow {
  return {
    household_id: payload.household_id,
    convex_lead_id: payload.convex_lead_id,
    session_id: payload.session_id,
    address: payload.address,
    owner_name: payload.owner_name,
    owner_first_name: payload.owner_first_name,
    owner_last_name: payload.owner_last_name,
    match_score: payload.match_score,
    need_score: payload.need_score,
    timing_score: payload.timing_score,
    gap_dollars: payload.gap_dollars,
    gap_pct: payload.gap_pct,
    coverage_hook: payload.coverage_hook,
    persona_hook: payload.persona_hook,
    agent_name: payload.agent_name,
    agency_name: payload.agency_name,
    contractor_name: payload.contractor_name,
    contractor_business: payload.contractor_business,
    vertical: payload.vertical,
    vertical_hook: payload.vertical_hook,
    email: payload.emails[0] ?? "",
    phone: payload.phones[0] ?? "",
    email_2: payload.emails[1] ?? "",
    phone_2: payload.phones[1] ?? "",
    emails_json: JSON.stringify(payload.emails),
    phones_json: JSON.stringify(payload.phones),
    linkedin_url: payload.linkedin_url ?? "",
    playbook: payload.playbook,
    channels: payload.channels.join(", "),
    status: payload.status,
    campaign_slug: payload.campaign_slug,
    touch1_subject: payload.touch1_subject,
    touch1_body: payload.touch1_body,
    touch2_subject: payload.touch2_subject,
    touch2_body: payload.touch2_body,
    recorded_owner_source: payload.recorded_owner_source ?? "",
    parcel_number: payload.parcel_number ?? "",
    city: payload.city,
    state: payload.state,
  };
}

export async function pushLeadToOrangeSliceSheet(
  payload: SheetLeadPayload,
  webhookUrlOverride?: string | null,
): Promise<SheetPushResult> {
  const webhookUrl =
    webhookUrlOverride?.trim() ||
    process.env.ORANGE_SLICE_SHEET_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { synced: false, error: "ORANGE_SLICE_SHEET_WEBHOOK_URL not configured" };
  }

  const row = flattenSheetPayload(payload);
  const bodies = [row, { data: row }, { row }, { rows: [row] }];

  let lastError: string | undefined;

  for (const body of bodies) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : text || res.statusText;
        lastError = message;
        continue;
      }

      const rowId =
        data && typeof data === "object"
          ? String(
              (data as { rowId?: string; row_id?: string; id?: string }).rowId ??
                (data as { row_id?: string }).row_id ??
                (data as { id?: string }).id ??
                "",
            ) || undefined
          : undefined;

      return { synced: true, rowId };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    synced: false,
    error: lastError ?? "Webhook push failed",
  };
}

export function orangeSliceSheetUrl(
  sheetUrlOverride?: string | null,
): string | undefined {
  return (
    sheetUrlOverride?.trim() ||
    process.env.ORANGE_SLICE_SHEET_URL?.trim() ||
    undefined
  );
}

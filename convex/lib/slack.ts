const STATUS_LABELS: Record<string, string> = {
  queued: "Queued for import",
  sheet_synced: "Synced to Orange Slice sheet",
  touch1_ready: "Ready for Touch 1",
  touch1_sent: "Touch 1 sent",
  touch2_sent: "Touch 2 sent",
  replied: "Homeowner replied",
  meeting: "Meeting booked",
  won: "Policy won",
  lost: "Lost",
  d2d_planned: "Door knock planned",
};

export type SlackDelivery =
  | { mode: "bot"; token: string; channelId: string }
  | { mode: "webhook"; webhookUrl: string };

export function resolveSlackChannelId(orgChannelId: string | null | undefined): string | null {
  return orgChannelId?.trim() || process.env.SLACK_ORANGE_SLICE_CHANNEL_ID?.trim() || null;
}

/** Incoming webhook (easiest) or workspace bot — no HouseholdIQ Slack OAuth app. */
export function resolveSlackDelivery(
  orgChannelId: string | null | undefined,
  orgAccessToken: string | null | undefined,
  orgWebhookUrl?: string | null,
): SlackDelivery | null {
  const webhookUrl =
    orgWebhookUrl?.trim() || process.env.SLACK_WEBHOOK_URL?.trim() || null;
  if (webhookUrl) {
    return { mode: "webhook", webhookUrl };
  }

  const channelId = resolveSlackChannelId(orgChannelId);
  const token =
    orgAccessToken?.trim() || process.env.SLACK_BOT_TOKEN?.trim() || null;
  if (token && channelId) {
    return { mode: "bot", token, channelId };
  }

  return null;
}

export function isSlackConfigured(
  orgChannelId: string | null | undefined,
  orgAccessToken: string | null | undefined,
  orgWebhookUrl?: string | null,
): boolean {
  return resolveSlackDelivery(orgChannelId, orgAccessToken, orgWebhookUrl) != null;
}

export function slackViaOrangeSlice(): boolean {
  return process.env.SLACK_VIA_ORANGE_SLICE === "true";
}

export async function postSlackMessage(
  token: string,
  channelId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: channelId, text }),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      return { ok: false, error: data.error ?? "Slack API error" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Slack request failed",
    };
  }
}

export async function postSlackWebhook(
  webhookUrl: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return { ok: false, error: `Webhook HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Slack webhook failed",
    };
  }
}

export async function deliverSlackMessage(
  delivery: SlackDelivery,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (delivery.mode === "webhook") {
    return postSlackWebhook(delivery.webhookUrl, text);
  }
  return postSlackMessage(delivery.token, delivery.channelId, text);
}

export function outreachSlackMessage(params: {
  event: string;
  address: string;
  agentName?: string;
  status?: string;
  gapDollars?: number;
}): string {
  const gap =
    params.gapDollars != null
      ? ` · ~$${Math.round(params.gapDollars / 1000)}k gap`
      : "";
  const agent = params.agentName ? ` · ${params.agentName}` : "";
  const status = params.status
    ? ` → ${STATUS_LABELS[params.status] ?? params.status}`
    : "";
  return `[HouseholdIQ] ${params.event}: ${params.address}${gap}${agent}${status}`;
}

export function orangeSliceSlackMessage(params: {
  address: string;
  status?: string;
  event?: string;
  detail?: string;
  email?: string;
  phone?: string;
}): string {
  const statusLabel = params.status
    ? STATUS_LABELS[params.status] ?? params.status
    : undefined;
  const lines = ["🍊 *Orange Slice update*", `📍 ${params.address}`];
  if (statusLabel) lines.push(`Status: *${statusLabel}*`);
  if (params.event && params.event !== "sheet_webhook") {
    lines.push(`Event: ${params.event}`);
  }
  if (params.email) lines.push(`✉️ ${params.email}`);
  if (params.phone) lines.push(`📞 ${params.phone}`);
  if (params.detail) lines.push(params.detail);
  return lines.join("\n");
}

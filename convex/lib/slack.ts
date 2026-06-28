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
  const status = params.status ? ` → ${params.status}` : "";
  return `[HouseholdIQ] ${params.event}: ${params.address}${gap}${agent}${status}`;
}

const BASE_URL = "https://enrichly-production.up.railway.app";
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1500;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function orangeslicePost<T>(
  apiKey: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...payload, inlineWaitMs: 10000 }),
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (
    data &&
    typeof data === "object" &&
    "pending" in data &&
    (data as { pending?: boolean }).pending
  ) {
    const pending = data as {
      requestId?: string;
      pollUrl?: string;
      pollAfterMs?: number;
    };
    const pollUrl = pending.pollUrl
      ? new URL(pending.pollUrl, BASE_URL).toString()
      : `${BASE_URL}/function/result/${pending.requestId}`;

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(pending.pollAfterMs ?? POLL_INTERVAL_MS);
      const pollRes = await fetch(pollUrl, {
        headers: { "Content-Type": "application/json" },
      });
      const pollText = await pollRes.text();
      const pollData = pollText ? JSON.parse(pollText) : null;
      if (
        pollData &&
        typeof pollData === "object" &&
        "pending" in pollData &&
        (pollData as { pending?: boolean }).pending
      ) {
        continue;
      }
      if (!pollRes.ok) {
        throw new Error(`Orange Slice poll failed (${pollRes.status})`);
      }
      return pollData as T;
    }
    throw new Error("Orange Slice request timed out");
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : String(data);
    throw new Error(`Orange Slice error (${res.status}): ${message}`);
  }

  return data as T;
}

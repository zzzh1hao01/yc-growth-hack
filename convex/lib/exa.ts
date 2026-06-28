const EXA_SEARCH_URL = "https://api.exa.ai/search";

export type ExaSearchResult = {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
  publishedDate?: string;
};

type ExaSearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    text?: string;
    highlights?: string[];
    publishedDate?: string;
  }>;
};

export async function exaSearch(
  apiKey: string,
  query: string,
  options?: {
    numResults?: number;
    type?: "auto" | "fast" | "deep" | "neural";
    category?: string;
    includeDomains?: string[];
    highlightQuery?: string;
  },
): Promise<ExaSearchResult[]> {
  const res = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      type: options?.type ?? "auto",
      numResults: options?.numResults ?? 8,
      ...(options?.category ? { category: options.category } : {}),
      ...(options?.includeDomains?.length
        ? { includeDomains: options.includeDomains }
        : {}),
      contents: {
        highlights: {
          query:
            options?.highlightQuery ??
            "property owner homeowner resident name address",
          maxCharacters: 2500,
        },
        text: { maxCharacters: 1200 },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Exa search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ExaSearchResponse;
  return (data.results ?? []).map((row) => ({
    title: row.title,
    url: row.url,
    text: row.text,
    highlights: row.highlights,
    publishedDate: row.publishedDate,
  }));
}

export function formatExaResults(results: ExaSearchResult[]): string {
  const chunks: string[] = [];

  for (const row of results) {
    const parts = [
      row.title ? `Title: ${row.title}` : "",
      row.url ? `URL: ${row.url}` : "",
      ...(row.highlights ?? []).map((h) => `Highlight: ${h}`),
      row.text ? `Text: ${row.text.slice(0, 900)}` : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      chunks.push(parts.join("\n"));
    }
  }

  return [...new Set(chunks)].slice(0, 30).join("\n---\n");
}

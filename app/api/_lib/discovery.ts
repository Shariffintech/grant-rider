import { DiscoveredOpportunity } from "./files";

export const searchKeywords = [
  "education technology grants",
  "special education innovation grants",
  "AI for education grants",
  "early stage founder grants",
  "workforce development grants",
  "Philadelphia startup grants",
  "New Jersey innovation grants"
];

type FirecrawlSearchItem = {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
};

type FirecrawlSearchResponse = {
  data?: FirecrawlSearchItem[] | { web?: FirecrawlSearchItem[] };
  success?: boolean;
  error?: string;
};

export async function discoverWithFirecrawlApi(limit: number) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not set.");
  }

  const results = await Promise.all(
    searchKeywords.map((keyword) => searchKeywordWithFirecrawl(keyword, limit, apiKey))
  );
  const seenUrls = new Set<string>();
  const opportunities: DiscoveredOpportunity[] = [];

  for (const batch of results) {
    for (const opportunity of batch) {
      if (seenUrls.has(opportunity.url)) {
        continue;
      }
      seenUrls.add(opportunity.url);
      opportunities.push(opportunity);
    }
  }

  return opportunities;
}

async function searchKeywordWithFirecrawl(keyword: string, limit: number, apiKey: string) {
  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: keyword,
      limit,
      sources: ["web"]
    })
  });

  const payload = (await response.json().catch(() => ({}))) as FirecrawlSearchResponse;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Firecrawl search failed for "${keyword}".`);
  }

  const rawItems = Array.isArray(payload.data) ? payload.data : payload.data?.web ?? [];
  return rawItems.flatMap((item) => {
    if (!item.url) {
      return [];
    }

    return [
      {
        title: item.title || "Untitled opportunity",
        url: item.url,
        source: "automated_search",
        eligibility_summary: item.description || item.markdown || null,
        status: "discovered",
        search_keyword: keyword
      }
    ];
  });
}

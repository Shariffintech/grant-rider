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
  warning?: string;
};

type FirecrawlScrapeResponse = {
  data?: {
    markdown?: string;
    html?: string;
  };
  success?: boolean;
  error?: string;
};

export async function discoverWithFirecrawlApi(limit: number) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not set.");
  }

  const results = await Promise.allSettled(
    searchKeywords.map((keyword) => searchKeywordWithFirecrawl(keyword, limit, apiKey))
  );
  const seenUrls = new Set<string>();
  const opportunities: DiscoveredOpportunity[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      errors.push(result.reason instanceof Error ? result.reason.message : "A grant search failed.");
      continue;
    }

    for (const opportunity of result.value) {
      if (seenUrls.has(opportunity.url)) {
        continue;
      }
      seenUrls.add(opportunity.url);
      opportunities.push(opportunity);
    }
  }

  if (opportunities.length === 0) {
    throw new Error(
      errors.length > 0
        ? errors.join(" ")
        : "Firecrawl did not return any grant search results."
    );
  }

  return opportunities;
}

async function searchKeywordWithFirecrawl(keyword: string, limit: number, apiKey: string) {
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: keyword,
      limit,
      sources: ["web"],
      country: "US",
      timeout: 30000
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

export async function scrapeWithFirecrawlApi(url: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not set.");
  }

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000
    })
  });
  const payload = (await response.json().catch(() => ({}))) as FirecrawlScrapeResponse;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || "Firecrawl scrape failed.");
  }

  const text = payload.data?.markdown || payload.data?.html || "";
  if (!text.trim()) {
    throw new Error("Firecrawl did not return page content.");
  }

  return text;
}

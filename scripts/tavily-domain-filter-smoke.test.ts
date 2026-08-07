import assert from "node:assert/strict";
import { searchReliableSources } from "@/lib/tavilyClient";

const previousKey = process.env.TAVILY_API_KEY;
const previousFetch = globalThis.fetch;
let capturedBody: Record<string, unknown> | undefined;

async function main() {
  try {
    process.env.TAVILY_API_KEY = "tvly-test";
    globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ results: [
        { url: "https://www.billboard.com/pro/example", title: "Relevant Billboard research", content: "A sufficiently detailed source snippet for the filter." },
        { url: "https://vendor.example/blog", title: "Out-of-domain vendor result", content: "Tavily returned this even though include_domains was supplied." },
      ] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const sources = await searchReliableSources("YouTube creator audience research", {
      includeDomains: ["billboard.com", "pewresearch.org"],
      maxResults: 10,
    });

    assert.deepEqual(capturedBody?.include_domains, ["billboard.com", "pewresearch.org"]);
    assert.equal(capturedBody?.max_results, 10);
    // The Tavily API can leak out-of-domain results; the client must enforce
    // the domain boundary locally as well as sending include_domains.
    assert.deepEqual(sources.map((source) => new URL(source.url).hostname), ["www.billboard.com"]);
    console.log("Tavily native domain-filter smoke test passed.");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = previousKey;
  }
}

void main();

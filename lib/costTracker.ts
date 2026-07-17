// lib/costTracker.ts
// Cost tracking utility for API usage (Tavily, OpenAI)

// Pricing (as of 2025 - update as needed)
const PRICING = {
  tavily: {
    basic: 0.01, // $0.01 per search query (basic depth)
    advanced: 0.05, // $0.05 per search query (advanced depth)
    image: 0.02, // $0.02 per image search query
  },
  openai: {
    'gpt-5.5': {
      input: 5.00 / 1_000_000, // $5.00 per 1M input tokens
      output: 30.00 / 1_000_000, // $30.00 per 1M output tokens
    },
    'gpt-5.4-mini': {
      input: 0.75 / 1_000_000, // $0.75 per 1M input tokens
      output: 4.50 / 1_000_000, // $4.50 per 1M output tokens
    },
    'dall-e-3': {
      '1024x1024': 0.04,
      '1792x1024': 0.08,
      '1024x1792': 0.08,
    },
    'gpt-image-2': {
      // Plain size keys = high quality (backward compat).
      '1024x1024': 0.133,    // high quality
      '1536x864': 0.20,      // high quality 16:9 hero
      '1536x1024': 0.20,     // high quality landscape
      '1024x1536': 0.20,     // high quality portrait
      // Quality-suffixed keys. medium/low estimated from OpenAI image
      // quality-tier ratios (~4x / ~15x cheaper than high) — verify against
      // the OpenAI pricing page if exact accounting matters.
      '1536x864:high': 0.20,
      '1536x864:medium': 0.05,
      '1536x864:low': 0.013,
      '1024x1024:high': 0.133,
      '1024x1024:medium': 0.034,
      '1024x1024:low': 0.009,
    },
  },
  // Undetectable.AI Humanizer (formerly AIHumanize): ~$0.0005 per word
  aihumanize: {
    words: 0.0005,
  },
};

export interface CostEntry {
  service: 'tavily' | 'openai' | 'aihumanize';
  type: 'search' | 'image_search' | 'chat' | 'image_generation' | 'humanize';
  cost: number;
  details?: {
    queries?: number;
    tokens?: { input?: number; output?: number };
    images?: number;
    model?: string;
    size?: string;
    wordsUsed?: number;
  };
  timestamp: number;
}

class CostTracker {
  private costs: CostEntry[] = [];
  private sessionStartTime: number = Date.now();

  /**
   * Track Tavily API cost
   */
  trackTavilySearch(depth: 'basic' | 'advanced' = 'basic', queries: number = 1): void {
    const costPerQuery = depth === 'advanced' ? PRICING.tavily.advanced : PRICING.tavily.basic;
    const totalCost = costPerQuery * queries;

    this.costs.push({
      service: 'tavily',
      type: 'search',
      cost: totalCost,
      details: { queries },
      timestamp: Date.now(),
    });
  }

  /**
   * Track Tavily image search cost
   */
  trackTavilyImageSearch(queries: number = 1): void {
    const totalCost = PRICING.tavily.image * queries;

    this.costs.push({
      service: 'tavily',
      type: 'image_search',
      cost: totalCost,
      details: { queries },
      timestamp: Date.now(),
    });
  }

  /**
   * Track OpenAI chat completion cost
   */
  trackOpenAIChat(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const modelPricing = PRICING.openai[model as keyof typeof PRICING.openai];
    if (!modelPricing || typeof modelPricing === 'object' && 'input' in modelPricing) {
      const pricing = modelPricing as { input: number; output: number };
      const inputCost = (inputTokens / 1000) * pricing.input;
      const outputCost = (outputTokens / 1000) * pricing.output;
      const totalCost = inputCost + outputCost;

      this.costs.push({
        service: 'openai',
        type: 'chat',
        cost: totalCost,
        details: {
          tokens: { input: inputTokens, output: outputTokens },
          model,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Track OpenAI image generation cost
   */
  trackOpenAIImageGeneration(model: string, size: string, count: number = 1, quality?: string): void {
    const modelPricing = PRICING.openai[model as keyof typeof PRICING.openai];
    // Prefer the quality-specific rate; plain size key (= high) is the fallback.
    const qualityKey = quality ? `${size}:${quality}` : size;
    const key = modelPricing && typeof modelPricing === 'object' && qualityKey in modelPricing ? qualityKey : size;
    if (modelPricing && typeof modelPricing === 'object' && key in modelPricing) {
      const costPerImage = (modelPricing as Record<string, number>)[key];
      const totalCost = costPerImage * count;

      this.costs.push({
        service: 'openai',
        type: 'image_generation',
        cost: totalCost,
        details: { images: count, model, size: qualityKey },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Track AIHumanize API cost
   */
  trackHumanize(wordsUsed: number, cost?: number): void {
    const totalCost = cost !== undefined ? cost : wordsUsed * PRICING.aihumanize.words;

    this.costs.push({
      service: 'aihumanize',
      type: 'humanize',
      cost: totalCost,
      details: {
        wordsUsed,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Get total tokens for current session
   */
  getTotalTokens(): {
    tavily: { queries: number };
    openai: { input: number; output: number; total: number };
  } {
    let tavilyQueries = 0;
    let openaiInputTokens = 0;
    let openaiOutputTokens = 0;

    this.costs.forEach((entry) => {
      if (entry.service === 'tavily') {
        tavilyQueries += entry.details?.queries || 0;
      } else if (entry.service === 'openai' && entry.type === 'chat') {
        openaiInputTokens += entry.details?.tokens?.input || 0;
        openaiOutputTokens += entry.details?.tokens?.output || 0;
      }
    });

    return {
      tavily: { queries: tavilyQueries },
      openai: {
        input: openaiInputTokens,
        output: openaiOutputTokens,
        total: openaiInputTokens + openaiOutputTokens,
      },
    };
  }

  /**
   * Get total costs for current session
   */
  getTotalCosts(): {
    tavily: number;
    openai: number;
    aihumanize: number;
    total: number;
    breakdown: {
      tavily: { search: number; image_search: number };
      openai: { chat: number; image_generation: number };
      aihumanize: { humanize: number };
    };
  } {
    const breakdown = {
      tavily: { search: 0, image_search: 0 },
      openai: { chat: 0, image_generation: 0 },
      aihumanize: { humanize: 0 },
    };

    let tavilyTotal = 0;
    let openaiTotal = 0;
    let aihumanizeTotal = 0;

    this.costs.forEach((entry) => {
      if (entry.service === 'tavily') {
        tavilyTotal += entry.cost;
        if (entry.type === 'search') {
          breakdown.tavily.search += entry.cost;
        } else if (entry.type === 'image_search') {
          breakdown.tavily.image_search += entry.cost;
        }
      } else if (entry.service === 'openai') {
        openaiTotal += entry.cost;
        if (entry.type === 'chat') {
          breakdown.openai.chat += entry.cost;
        } else if (entry.type === 'image_generation') {
          breakdown.openai.image_generation += entry.cost;
        }
      } else if (entry.service === 'aihumanize') {
        aihumanizeTotal += entry.cost;
        if (entry.type === 'humanize') {
          breakdown.aihumanize.humanize += entry.cost;
        }
      }
    });

    return {
      tavily: tavilyTotal,
      openai: openaiTotal,
      aihumanize: aihumanizeTotal,
      total: tavilyTotal + openaiTotal + aihumanizeTotal,
      breakdown,
    };
  }

  /**
   * Get all cost entries
   */
  getAllCosts(): CostEntry[] {
    return [...this.costs];
  }

  /**
   * Reset costs (start new session)
   */
  reset(): void {
    this.costs = [];
    this.sessionStartTime = Date.now();
  }

  /**
   * Get session duration in seconds
   */
  getSessionDuration(): number {
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker();
  }
  return costTrackerInstance;
}

// Helper function to format cost as currency
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

// Helper function to format tokens
export function formatTokens(tokens: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(tokens);
}

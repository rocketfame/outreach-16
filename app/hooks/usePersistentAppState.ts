"use client";

import { useState, useEffect } from "react";

export type Brief = {
  niche: string;
  clientSite: string;
  language: string;
  wordCount: string;
  platform?: string;
  anchorText?: string;
  anchorUrl?: string;
  contentPurpose?: string;
};

export type Topic = {
  id: string;
  clusterName: string;
  forWho: string;
  problem: string;
  workingTitle: string;
  primaryKeyword: string;
  searchIntent: 'informational' | 'strategic' | 'how_to' | 'problem_solving' | 'comparison';
  shortAngle: string;
  whyNonGeneric: string;
  howAnchorFits: string;
  evergreenScore: number;
  evergreenNote: string;
  competitionLevel: 'low' | 'medium' | 'high';
  competitionNote: string;
};

export type TopicResponse = {
  overview: string;
  topics: Topic[];
};

export type GeneratedArticle = {
  topicTitle: string;
  titleTag: string;
  metaDescription: string;
  fullArticleText: string;
  articleBodyHtml?: string;
  editedText?: string;
  status: "ready" | "generating" | "error";
};

export type AppPersistedState = {
  projectBasics: Brief;
  topicOverview: string | null;
  topicClusters: TopicResponse | null;
  selectedTopicIds: string[];
  articles: GeneratedArticle[]; // Legacy - kept for backward compatibility, but should use mode-specific arrays
  // Mode-specific article storage
  discoveryArticles: GeneratedArticle[];
  directArticles: GeneratedArticle[];
  rewriteArticles: GeneratedArticle[];
  mode: "discovery" | "direct" | "rewrite";
  lightHumanEditEnabled: boolean;
  // New fields for Direct Article Creation
  clientBrief?: string;
  directArticleSettings?: {
    nicheOrIndustry?: string;
    brandName?: string;
    anchorKeyword?: string;
    targetWordCount?: number;
    writingStyle?: string;
  };
  // New fields for Rewrite mode
  originalArticle?: string;
  rewriteParams?: {
    additionalBrief?: string;
    niche?: string;
    brandName?: string;
    anchorKeyword?: string;
    targetWordCount?: number;
    style?: string;
  };
};

const STORAGE_KEY = "ucca_state_v1";

const defaultState: AppPersistedState = {
  projectBasics: {
    niche: "",
    clientSite: "",
    language: "",
    wordCount: "",
    platform: "",
    anchorText: "",
    anchorUrl: "",
    contentPurpose: "",
  },
  topicOverview: null,
  topicClusters: null,
  selectedTopicIds: [],
  articles: [], // Legacy - kept for backward compatibility
  discoveryArticles: [],
  directArticles: [],
  rewriteArticles: [],
  mode: "discovery",
  lightHumanEditEnabled: true, // Default to enabled (recommended)
  clientBrief: "",
  directArticleSettings: {},
  originalArticle: "",
  rewriteParams: {},
};

export function usePersistentAppState() {
  const [state, setState] = useState<AppPersistedState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsHydrated(true);
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppPersistedState;
        // Validate structure
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.selectedTopicIds) &&
          Array.isArray(parsed.articles) &&
          parsed.projectBasics
        ) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePersistentAppState.ts:115',message:'[Bug2-FIX] Loading persisted state from localStorage',data:{hasMode:!!parsed.mode,modeValue:parsed.mode,hasClientBrief:!!parsed.clientBrief,hasOriginalArticle:!!parsed.originalArticle,hasRewriteParams:!!parsed.rewriteParams},timestamp:Date.now(),sessionId:'debug-session',runId:'bug2-post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Merge parsed state with defaults to ensure all new fields have proper fallback values
          // Migrate legacy articles to mode-specific arrays if needed
          const legacyArticles = parsed.articles || [];
          const currentMode = parsed.mode || defaultState.mode;
          // If mode-specific arrays don't exist but legacy articles do, migrate them to current mode
          const discoveryArticles = parsed.discoveryArticles || (currentMode === "discovery" ? legacyArticles : []);
          const directArticles = parsed.directArticles || (currentMode === "direct" ? legacyArticles : []);
          const rewriteArticles = parsed.rewriteArticles || (currentMode === "rewrite" ? legacyArticles : []);
          
          const validatedState: AppPersistedState = {
            ...defaultState,
            ...parsed,
            // Ensure new fields have defaults if missing
            mode: currentMode,
            lightHumanEditEnabled: parsed.lightHumanEditEnabled !== undefined ? parsed.lightHumanEditEnabled : defaultState.lightHumanEditEnabled,
            clientBrief: parsed.clientBrief ?? defaultState.clientBrief,
            directArticleSettings: parsed.directArticleSettings || defaultState.directArticleSettings,
            originalArticle: parsed.originalArticle ?? defaultState.originalArticle,
            rewriteParams: parsed.rewriteParams || defaultState.rewriteParams,
            // Preserve existing fields
            projectBasics: parsed.projectBasics || defaultState.projectBasics,
            topicOverview: parsed.topicOverview ?? defaultState.topicOverview,
            topicClusters: parsed.topicClusters ?? defaultState.topicClusters,
            selectedTopicIds: parsed.selectedTopicIds || defaultState.selectedTopicIds,
            articles: parsed.articles || defaultState.articles, // Legacy - kept for backward compatibility
            // Mode-specific article arrays
            discoveryArticles: discoveryArticles,
            directArticles: directArticles,
            rewriteArticles: rewriteArticles,
          };
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePersistentAppState.ts:130',message:'[Bug2-FIX] Validated state after merge with defaults',data:{validatedMode:validatedState.mode,validatedClientBrief:validatedState.clientBrief,validatedOriginalArticle:validatedState.originalArticle,validatedRewriteParams:validatedState.rewriteParams},timestamp:Date.now(),sessionId:'debug-session',runId:'bug2-post-fix',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setState(validatedState);
        }
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [state, isHydrated]);

  const resetState = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState(defaultState);
  };

  return [state, setState, resetState, isHydrated] as const;
}



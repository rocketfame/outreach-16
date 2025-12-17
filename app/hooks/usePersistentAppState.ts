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
  articles: GeneratedArticle[];
  mode: "discovery" | "direct";
  lightHumanEditEnabled: boolean;
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
  articles: [],
  mode: "discovery",
  lightHumanEditEnabled: true, // Default to enabled (recommended)
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
          // Ensure lightHumanEditEnabled exists, default to true if missing
          const validatedState: AppPersistedState = {
            ...parsed,
            lightHumanEditEnabled: parsed.lightHumanEditEnabled !== undefined ? parsed.lightHumanEditEnabled : true,
          };
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



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

export type EditHistoryEntry = {
  timestamp: string;
  editRequest: string;
  summary: string; // Brief summary of what was changed
};

export type GeneratedArticle = {
  topicTitle: string;
  titleTag: string;
  metaDescription: string;
  fullArticleText: string;
  articleBodyHtml?: string;
  editedText?: string;
  editHistory?: EditHistoryEntry[]; // History of edits made to this article
  status: "ready" | "generating" | "error";
};

export type AppPersistedState = {
  projectBasics: Brief; // Legacy, kept for backward compatibility - maps to discoveryProjectBasics
  discoveryProjectBasics: Brief; // Project Basics for Topic Discovery Mode
  directProjectBasics: Brief; // Project Basics for Direct Article Creation Mode
  topicOverview: string | null;
  topicClusters: TopicResponse | null;
  selectedTopicIds: string[];
  articles: GeneratedArticle[]; // Articles for discovery mode (legacy, kept for backward compatibility)
  discoveryArticles: GeneratedArticle[]; // Articles generated in Topic Discovery Mode
  directArticles: GeneratedArticle[]; // Articles generated in DirectArticleCreation Mode
  directArticleTopic: string; // Topic for direct article creation
  // Note: articleImages removed from persisted state to avoid localStorage quota issues
  // Images are stored in component state only and can be regenerated if needed
  mode: "discovery" | "direct";
  lightHumanEditEnabled: boolean;
  theme: "light" | "dark"; // Theme preference
};

const STORAGE_KEY = "ucca_state_v1";

const defaultBrief: Brief = {
    niche: "",
    clientSite: "",
    language: "",
    wordCount: "",
    platform: "",
    anchorText: "",
    anchorUrl: "",
    contentPurpose: "",
};

const defaultState: AppPersistedState = {
  projectBasics: defaultBrief, // Legacy, kept for backward compatibility
  discoveryProjectBasics: defaultBrief, // Project Basics for Topic Discovery Mode
  directProjectBasics: defaultBrief, // Project Basics for Direct Article Creation Mode
  topicOverview: null,
  topicClusters: null,
  selectedTopicIds: [],
  articles: [], // Legacy, kept for backward compatibility
  discoveryArticles: [], // Articles for Topic Discovery Mode
  directArticles: [], // Articles for DirectArticleCreation Mode
  directArticleTopic: "", // Topic input for direct article creation
  mode: "discovery",
  lightHumanEditEnabled: true, // Default to enabled (recommended)
  theme: "light", // Default to light theme
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
          // Remove articleImages from old persisted state if present (to free up space)
          const { articleImages, ...stateWithoutImages } = parsed as any;
          
          // Migrate old projectBasics to discoveryProjectBasics and directProjectBasics
          const legacyProjectBasics = parsed.projectBasics || defaultBrief;
          const validatedState: AppPersistedState = {
            ...stateWithoutImages,
            projectBasics: legacyProjectBasics, // Keep for backward compatibility
            discoveryProjectBasics: parsed.discoveryProjectBasics || legacyProjectBasics,
            directProjectBasics: parsed.directProjectBasics || defaultBrief,
            lightHumanEditEnabled: parsed.lightHumanEditEnabled !== undefined ? parsed.lightHumanEditEnabled : true,
            theme: parsed.theme || "light", // Default to light if not set
          };
          setState(validatedState);
          
          // Clean up old articleImages from localStorage if it exists
          if (articleImages && typeof articleImages === "object") {
            try {
              const cleanedState = { ...validatedState };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedState));
            } catch (e) {
              // If cleanup fails, it's okay - we'll just not persist images
              console.debug("Cleaned up articleImages from localStorage");
            }
          }
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



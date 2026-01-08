"use client";

import { ChangeEvent, useState, useEffect, useRef, useMemo } from "react";
import LoadingOverlay from "./components/LoadingOverlay";
import Notification from "./components/Notification";
import { TagPill } from "./components/TagPill";
import { usePersistentAppState, type Brief, type Topic, type TopicResponse, type GeneratedArticle } from "./hooks/usePersistentAppState";
import { copyArticleAsPlainText, downloadArticleAsTxt, extractPlainTextFromElement } from "@/lib/articlePlainText";
import { cleanText } from "@/lib/textPostProcessing";

type LoadingStep = "topics" | "outline" | "draft" | null;

export default function Home() {
  const [persistedState, setPersistedState, resetPersistedState, isHydrated] = usePersistentAppState();
  
  // Extract state from persisted state
  const mode = persistedState.mode;
  const topicsData = persistedState.topicClusters;
  const selectedTopicIds = persistedState.selectedTopicIds;
  const lightHumanEditEnabled = persistedState.lightHumanEditEnabled;
  const directArticleTopic = persistedState.directArticleTopic || "";
  const directArticleBrief = persistedState.directArticleBrief || "";
  const theme = persistedState.theme || "light";
  
  // Get the correct brief based on current mode with proper fallback
  const defaultBrief: Brief = {
    niche: "",
    clientSite: "",
    language: "",
    wordCount: "",
    platform: "",
    anchorText: "",
    anchorUrl: "",
    contentPurpose: "",
    customStyle: "",
  };
  
  const brief = mode === "discovery" 
    ? (persistedState.discoveryProjectBasics || persistedState.projectBasics || defaultBrief) // Fallback to legacy projectBasics
    : (persistedState.directProjectBasics || persistedState.projectBasics || defaultBrief); // Fallback to legacy projectBasics
  
  
  // Ensure language has a default value if empty (for backward compatibility)
  // This is used for button disabled state and validation
  const briefWithDefaults = {
    ...brief,
    language: brief.language || "English",
  };
  
  
  // Get articles based on current mode - they are stored separately
  const generatedArticles = mode === "discovery" 
    ? (persistedState.discoveryArticles || persistedState.articles || []) // Fallback to legacy articles
    : (persistedState.directArticles || []);
  
  // Article images are stored in component state only (not persisted)
  // This avoids localStorage quota issues since base64 images are large
  // Images can be regenerated if needed
  const [articleImages, setArticleImages] = useState<Map<string, string>>(new Map());
  
  // Track used box indices for each article (for random selection without repeats)
  // Key: topicId, Value: Set of box indices already used for this article
  const [articleUsedBoxIndices, setArticleUsedBoxIndices] = useState<Map<string, Set<number>>>(new Map());

  // Local UI state (not persisted)
  const [expandedClusterNames, setExpandedClusterNames] = useState<Set<string>>(new Set());
  const [outline, setOutline] = useState("");
  const [draft, setDraft] = useState("");
  const [editingArticles, setEditingArticles] = useState<Set<string>>(new Set());
  const [viewingArticle, setViewingArticle] = useState<string | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<string>("");
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  const [editingArticleStatus, setEditingArticleStatus] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isGeneratingArticles, setIsGeneratingArticles] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [copyStatusByTopic, setCopyStatusByTopic] = useState<Map<string, "idle" | "copied">>(new Map());
  const [copyPlainTextStatus, setCopyPlainTextStatus] = useState<"idle" | "copied">("idle");
  const [copyPlainTextStatusByTopic, setCopyPlainTextStatusByTopic] = useState<Map<string, "idle" | "copied">>(new Map());
  // Humanize on write toggle (for live humanization during generation)
  const humanizeOnWriteEnabled = persistedState.humanizeOnWriteEnabled || false;
  
  // Humanize settings (stored in persisted state)
  const [humanizeSettings, setHumanizeSettings] = useState({
    model: 1, // 0: Quality, 1: Balance (default), 2: Enhanced
    style: "General", // General, Blog, Formal, Informal, Academic, Expand, Simplify
    mode: "Basic" as "Basic" | "Autopilot", // Basic or Autopilot
  });
  
  // Track expanded humanize settings for each topic
  const [expandedHumanizeTopicId, setExpandedHumanizeTopicId] = useState<string | null>(null);
  
  // Track humanization costs (words used for humanization)
  // AIHumanize pricing: 50,000 words = $25, so $0.0005 per word
  const [humanizeWordsUsed, setHumanizeWordsUsed] = useState(0);
  const humanizeWordsUsedRef = useRef(0); // Keep ref for access in intervals
  const HUMANIZE_COST_PER_WORD = 0.0005; // $0.0005 per word (50k words = $25)
  
  // Keep ref in sync with state
  useEffect(() => {
    humanizeWordsUsedRef.current = humanizeWordsUsed;
  }, [humanizeWordsUsed]);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    time: string;
    visible: boolean;
  } | null>(null);
  const generatedArticlesSectionRef = useRef<HTMLDivElement>(null);
  const prevThemeRef = useRef<string>(theme);
  const prevModeRef = useRef<string>(mode);
  
  // Article image generation state (initialized from persisted state above)
  const [isGeneratingImage, setIsGeneratingImage] = useState<Set<string>>(new Set()); // topicIds being generated
  const [viewingImage, setViewingImage] = useState<string | null>(null); // topicId of image being viewed in modal
  const [imageLoaderMessages, setImageLoaderMessages] = useState<Map<string, number>>(new Map()); // topicId -> message index
  
  // Reference image for style personalization - loaded from persisted state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false); // loading state for style analysis
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load reference image from persisted state on mount/hydration (only once)
  const referenceImageLoadedRef = useRef(false);
  useEffect(() => {
    if (isHydrated && persistedState.referenceImageBase64 && !referenceImageLoadedRef.current) {
      setReferenceImage(persistedState.referenceImageBase64);
      referenceImageLoadedRef.current = true;
    }
  }, [isHydrated, persistedState.referenceImageBase64]);
  
  // Sync reference image changes back to persisted state (but avoid initial load cycle)
  useEffect(() => {
    if (isHydrated && referenceImageLoadedRef.current) {
      setPersistedState(prev => {
        // Only update if it's different to avoid unnecessary re-renders
        if (prev.referenceImageBase64 !== (referenceImage || undefined)) {
          return {
            ...prev,
            referenceImageBase64: referenceImage || undefined,
          };
        }
        return prev;
      });
    }
  }, [referenceImage, isHydrated]);
  const [articleLoaderMessages, setArticleLoaderMessages] = useState<Map<string, number>>(new Map()); // topicId -> message index
  const [imageLoaderStartTimes, setImageLoaderStartTimes] = useState<Map<string, number>>(new Map()); // topicId -> start timestamp
  const [articleLoaderStartTimes, setArticleLoaderStartTimes] = useState<Map<string, number>>(new Map()); // topicId -> start timestamp
  const [imageLoaderElapsed, setImageLoaderElapsed] = useState<Map<string, number>>(new Map()); // topicId -> elapsed seconds
  const [articleLoaderElapsed, setArticleLoaderElapsed] = useState<Map<string, number>>(new Map()); // topicId -> elapsed seconds
  
  // Topic loader state (for Step 1 in Topic Discovery Mode)
  const [topicLoaderStartTime, setTopicLoaderStartTime] = useState<number | null>(null);
  const [topicLoaderElapsed, setTopicLoaderElapsed] = useState<number>(0);
  const [topicLoaderMessageIndex, setTopicLoaderMessageIndex] = useState<number>(0);
  
  // Cost tracking state
  const [costData, setCostData] = useState<{
    tavily: number;
    openai: number;
    humanize: number;
    total: number;
    formatted: { tavily: string; openai: string; humanize: string; total: string };
    tokens?: {
      tavily: number;
      openai: { input: number; output: number; total: number };
      formatted: { tavily: string; openai: string };
    };
    humanizeWords?: number;
  } | null>(null);

  // Helper functions to update persisted state
  const updateBrief = (updates: Partial<Brief>) => {
    setPersistedState(prev => {
      // Update the correct brief based on current mode
      if (prev.mode === "discovery") {
        return {
          ...prev,
          discoveryProjectBasics: { ...(prev.discoveryProjectBasics || prev.projectBasics || defaultBrief), ...updates },
          projectBasics: { ...(prev.discoveryProjectBasics || prev.projectBasics || defaultBrief), ...updates }, // Keep for backward compatibility
        };
      } else {
        return {
          ...prev,
          directProjectBasics: { ...(prev.directProjectBasics || prev.projectBasics || defaultBrief), ...updates },
        };
      }
    });
  };

  const updateTopicsData = (data: TopicResponse | null) => {
    setPersistedState(prev => ({
      ...prev,
      topicClusters: data,
      topicOverview: data?.overview || null,
    }));
  };

  const removeCluster = (clusterName: string) => {
    if (!topicsData) return;
    
    // Get all topic IDs in this cluster
    const clusterTopicIds = topicsData.topics
      .filter(t => t.clusterName === clusterName)
      .map(t => t.id);
    
    // Remove topics from this cluster
    const updatedTopics = topicsData.topics.filter(t => t.clusterName !== clusterName);
    
    // Remove selected topic IDs if they belong to this cluster
    const updatedSelectedIds = selectedTopicIds.filter(id => !clusterTopicIds.includes(id));
    
    // Update topics data
    if (updatedTopics.length === 0) {
      // If no topics left, clear everything
      updateTopicsData(null);
      updateSelectedTopicIds([]);
    } else {
      updateTopicsData({
        ...topicsData,
        topics: updatedTopics,
      });
      updateSelectedTopicIds(updatedSelectedIds);
    }
    
    // Close expanded state if this cluster was expanded
    if (expandedClusterNames.has(clusterName)) {
      setExpandedClusterNames(prev => {
        const next = new Set(prev);
        next.delete(clusterName);
        return next;
      });
    }
  };

  const updateSelectedTopicIds = (ids: string[]) => {
    setPersistedState(prev => ({
      ...prev,
      selectedTopicIds: ids,
    }));
  };

  const updateGeneratedArticles = (articles: GeneratedArticle[] | ((prev: GeneratedArticle[]) => GeneratedArticle[])) => {
    setPersistedState(prev => {
      // Get current articles based on mode
      const currentArticles = prev.mode === "discovery" 
        ? (prev.discoveryArticles || prev.articles || [])
        : (prev.directArticles || []);
      
      // Apply update (either direct array or function)
      const updatedArticles = typeof articles === 'function' 
        ? articles(currentArticles)
        : articles;
      
      // Use prev.mode to get the current mode at the time of update
      if (prev.mode === "discovery") {
        return {
          ...prev,
          discoveryArticles: updatedArticles,
          articles: updatedArticles, // Keep for backward compatibility
        };
      } else {
        return {
          ...prev,
          directArticles: updatedArticles,
        };
      }
    });
  };

  const updateDirectArticleTopic = (topic: string) => {
    setPersistedState(prev => ({
      ...prev,
      directArticleTopic: topic,
    }));
  };

  const updateDirectArticleBrief = (brief: string) => {
    setPersistedState(prev => ({
      ...prev,
      directArticleBrief: brief,
    }));
  };

  const removeArticle = (topicId: string) => {
    updateGeneratedArticles(prev => prev.filter(a => a.topicTitle !== topicId));
    // Also close view/edit if open
    if (viewingArticle === topicId) {
      setViewingArticle(null);
      setEditRequest("");
      setEditingArticleId(null);
    }
    if (editingArticles.has(topicId)) {
      setEditingArticles(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  const updateMode = (newMode: "discovery" | "direct") => {
    setPersistedState(prev => ({
      ...prev,
      mode: newMode,
    }));
  };

  const updateTheme = (newTheme: "light" | "dark") => {
    setPersistedState(prev => ({
      ...prev,
      theme: newTheme,
    }));
  };

  // Apply theme class to document
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const handleBriefChange =
    (field: keyof Brief) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      updateBrief({ [field]: event.target.value });
    };

  // Old parsing function removed - now using JSON API response

  const requestGeneration = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error ?? "Failed to generate content.");
    }

    const data = (await response.json()) as { text?: string };
    return data.text ?? "";
  };

  const generateTopics = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:266',message:'generateTopics called',data:{briefNiche:brief.niche,briefLanguage:brief.language,briefPlatform:brief.platform,briefAnchorText:brief.anchorText,briefAnchorUrl:brief.anchorUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'api-calls'})}).catch(()=>{});
    // #endregion
    // Validate Project Basis fields with detailed error messages
    const missingFields: string[] = [];
    if (!brief.niche.trim()) {
      missingFields.push("Main niche or theme");
    }
    if (!(brief.language || "English").trim()) {
      missingFields.push("Language");
    }

    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(", ");
      setNotification({
        message: `Please fill in the required fields in Project Basis: ${fieldsList}`,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
      return;
    }

    setLoadingStep("topics");
    setIsGeneratingTopics(true);
    setGenerationStartTime(Date.now());
    const startTime = Date.now();
    setTopicLoaderStartTime(startTime);
    setTopicLoaderElapsed(0);
    setTopicLoaderMessageIndex(0);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:277',message:'About to call /api/generate-topics',data:{endpoint:'/api/generate-topics',briefFields:Object.keys(brief)},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'api-calls'})}).catch(()=>{});
      // #endregion
      const response = await fetch("/api/generate-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:284',message:'Response received from /api/generate-topics',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'api-calls'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to generate topics.");
      }

      const data = (await response.json()) as { overview: string; topics: Topic[] };
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:293',message:'generateTopics success',data:{overviewLength:data.overview?.length || 0,topicsCount:data.topics?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'api-calls'})}).catch(()=>{});
      // #endregion
      
      // Store the structured response
      updateTopicsData(data);
      
      // Reset selections
      updateSelectedTopicIds([]);
      setExpandedClusterNames(new Set());
      
      // Show notification with elapsed time
      if (generationStartTime) {
        const elapsedMs = Date.now() - generationStartTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = minutes > 0 
          ? `${minutes} min ${seconds} sec`
          : `${seconds} sec`;
        
        setNotification({
          message: "We searched for article topics",
          time: timeString,
          visible: true,
        });
        setGenerationStartTime(null);
      }
      
      // Play success sound after topic generation
      playSuccessSound();
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:303',message:'generateTopics error',data:{error:(error as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'api-calls'})}).catch(()=>{});
      // #endregion
      console.error(error);
      const errorMessage = (error as Error).message || "Failed to generate topics. Please try again.";
      setNotification({
        message: errorMessage,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
    } finally {
      setLoadingStep(null);
      setIsGeneratingTopics(false);
      setTopicLoaderStartTime(null);
      setTopicLoaderElapsed(0);
      if (generationStartTime) {
        setGenerationStartTime(null);
      }
    }
  };

  // generateOutline and generateDraft removed - now using article generation flow

  const toggleTopicSelection = (topicId: string) => {
    updateSelectedTopicIds(
      selectedTopicIds.includes(topicId)
        ? selectedTopicIds.filter(id => id !== topicId)
        : [...selectedTopicIds, topicId]
    );
  };

  const toggleClusterExpansion = (clusterName: string) => {
    setExpandedClusterNames(prev => {
      const next = new Set(prev);
      if (next.has(clusterName)) {
        next.delete(clusterName);
      } else {
        next.add(clusterName);
      }
      return next;
    });
  };

  const clearSelections = () => {
    updateSelectedTopicIds([]);
  };

  // getEvergreenRating removed - now using evergreenScore directly from API

  const regenerateArticleForTopic = async (topicId: string) => {
    // Check if article was edited
    const existingArticle = generatedArticles.find(a => a.topicTitle === topicId);
    if (existingArticle?.editedText || existingArticle?.articleBodyHtml) {
      const confirmed = confirm("This article has been edited. Regenerating will replace your edits. Continue?");
      if (!confirmed) return;
    }

    // Handle Direct Article Creation mode
    if (mode === "direct") {
      // Check if this is a direct article (starts with "direct-")
      if (!topicId.startsWith("direct-")) {
        console.error("[regenerateArticleForTopic] Invalid topicId for direct mode:", topicId);
        return;
      }

      // Get the article topic from the existing article
      const article = generatedArticles.find(a => a.topicTitle === topicId);
      if (!article) {
        console.error("[regenerateArticleForTopic] Article not found:", topicId);
        return;
      }

      const articleTopic = article.titleTag || directArticleTopic || "";
      if (!articleTopic) {
        console.error("[regenerateArticleForTopic] No article topic found");
        return;
      }

      // Mark as generating
      setIsGeneratingArticles(true);
      updateGeneratedArticles(
        generatedArticles.map(a =>
          a.topicTitle === topicId
            ? { ...a, status: "generating" as const }
            : a
        )
      );

      try {
        // Step 1: Find trust sources via Tavily
        const queryParts = [
          articleTopic,
          brief.niche || "",
          brief.platform || "",
          "2024 2025",
        ].filter(Boolean);
        const searchQuery = queryParts.join(" ");

        const linksResponse = await fetch("/api/find-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!linksResponse.ok) {
          const errorData = await linksResponse.json().catch(() => ({}));
          throw new Error(`Tavily search failed: ${errorData.error || linksResponse.statusText}`);
        }

        const linksData = await linksResponse.json() as { trustSources: Array<{ title: string; url: string; snippet: string; source: string }> };
        const trustSourcesList = linksData.trustSources && linksData.trustSources.length > 0
          ? linksData.trustSources.map(source => `${source.title}|${source.url}`)
          : [];

        if (trustSourcesList.length === 0) {
          throw new Error("Cannot regenerate article: No trust sources found via browsing.");
        }

        // Step 2: Regenerate article
        // CRITICAL: For Direct Article Creation Mode, do NOT include shortAngle, whyNonGeneric, howAnchorFits
        // These fields are used by API to detect Topic Discovery Mode
        
        // CRITICAL: Use saved humanization settings from existing article if available
        // This ensures regeneration uses the same settings as the original generation
        const savedHumanizeSettings = article?.humanizeSettingsUsed;
        
        // Use saved settings if available, otherwise fall back to global settings
        const regenerateHumanizeOnWrite = savedHumanizeSettings?.humanizeOnWrite ?? humanizeOnWriteEnabled;
        const regenerateHumanizeSettings = savedHumanizeSettings 
          ? {
              model: savedHumanizeSettings.model,
              style: savedHumanizeSettings.style,
              mode: savedHumanizeSettings.mode,
            }
          : humanizeSettings;
        
        const response = await fetch("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief,
            selectedTopics: [{
              title: articleTopic,
              // For Direct Mode: if directArticleBrief is provided, use it; otherwise use topic title
              // API detects Direct Mode by absence of shortAngle/whyNonGeneric/howAnchorFits fields
              brief: directArticleBrief.trim() || articleTopic,
              // DO NOT include: shortAngle, whyNonGeneric, howAnchorFits - these indicate Topic Discovery Mode
              primaryKeyword: articleTopic.split(" ")[0] || articleTopic,
            }],
            keywordList: [articleTopic],
            trustSourcesList: trustSourcesList,
            lightHumanEdit: !regenerateHumanizeOnWrite, // Automatically enable lightHumanEdit if humanization is disabled
            humanizeOnWrite: regenerateHumanizeOnWrite,
            humanizeSettings: regenerateHumanizeOnWrite ? regenerateHumanizeSettings : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error ?? "Failed to regenerate article.");
        }

        const data = await response.json() as { articles: Array<{
          topicTitle: string;
          titleTag: string;
          metaDescription: string;
          fullArticleText: string;
          articleBodyHtml?: string;
        }> };

        if (data.articles.length > 0) {
          const newArticle = data.articles[0];
          
          // CRITICAL: Clean invisible Unicode characters before saving
          const cleanedArticle = {
            ...newArticle,
            titleTag: cleanText(articleTopic || newArticle.titleTag || ''),
            metaDescription: cleanText(newArticle.metaDescription || ''),
            fullArticleText: cleanText(newArticle.fullArticleText || ''),
            articleBodyHtml: cleanText(newArticle.articleBodyHtml || newArticle.fullArticleText || ''),
            humanizeSettingsUsed: savedHumanizeSettings ?? {
              humanizeOnWrite: regenerateHumanizeOnWrite,
              model: regenerateHumanizeSettings.model,
              style: regenerateHumanizeSettings.style,
              mode: regenerateHumanizeSettings.mode,
            },
          };
          
          updateGeneratedArticles(
            generatedArticles.map(a =>
              a.topicTitle === topicId
                ? {
                    ...cleanedArticle,
                    topicTitle: topicId,
                    titleTag: articleTopic, // Preserve original topic
                    status: "ready" as const,
                  }
                : a
            )
          );
          
          // CRITICAL: Auto-collapse humanize settings after successful regeneration
          // Close expanded humanize settings if it was for direct mode
          if (expandedHumanizeTopicId === "direct") {
            setExpandedHumanizeTopicId(null);
          }

          setNotification({
            message: "Article successfully regenerated",
            time: new Date().toLocaleTimeString(),
            visible: true,
          });
          playSuccessSound();
        }
      } catch (error) {
        console.error("[regenerateArticleForTopic] Error:", error);
        setNotification({
          message: error instanceof Error ? error.message : "Error regenerating article",
          time: new Date().toLocaleTimeString(),
          visible: true,
        });
        updateGeneratedArticles(
          generatedArticles.map(a =>
            a.topicTitle === topicId
              ? { ...a, status: "error" as const }
              : a
          )
        );
      } finally {
        setIsGeneratingArticles(false);
      }
      return;
    }

    // Handle Topic Discovery mode
    if (!topicsData) return;
    
    const topic = topicsData.topics.find(t => t.id === topicId);
    
    if (!topic) return;

    // Mark as generating
    setIsGeneratingArticles(true);
    updateGeneratedArticles(
      generatedArticles.map(a =>
        a.topicTitle === topicId
          ? { ...a, status: "generating" as const }
          : a
      )
    );

    try {
      const selectedTopicsData = [{
        title: topic.workingTitle,
        brief: [
          topic.shortAngle || "",
          topic.whyNonGeneric || "",
          topic.howAnchorFits || "",
          topic.evergreenNote || "",
          topic.competitionNote || "",
        ].filter(Boolean).join("\n\n"),
        shortAngle: topic.shortAngle || "",
        primaryKeyword: topic.primaryKeyword || "",
        // Include all deep brief fields for article generation
        whyNonGeneric: topic.whyNonGeneric || "",
        howAnchorFits: topic.howAnchorFits || "",
        evergreenNote: topic.evergreenNote || "",
        competitionNote: topic.competitionNote || "",
      }];

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:300',message:'[regenerate] Starting Tavily search for trust sources',data:{topicTitle:topic.workingTitle},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
      // #endregion

      // MANDATORY: Find trust sources via Tavily before generating article
      const allTrustSources = new Set<string>();
      
      try {
        // Build comprehensive search query from topic and brief for better Tavily results
        // Include year for recent data (2024-2025)
        const queryParts = [
          topic.workingTitle,
          brief.niche || "",
          brief.platform || "",
          topic.primaryKeyword || "",
          "2024 2025", // Ensure recent data
        ].filter(Boolean);
        const searchQuery = queryParts.join(" ");

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:320',message:'[regenerate] Calling /api/find-links',data:{topicTitle:topic.workingTitle,query:searchQuery},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
        // #endregion

        const linksResponse = await fetch("/api/find-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:330',message:'[regenerate] find-links response received',data:{topicTitle:topic.workingTitle,ok:linksResponse.ok,status:linksResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
        // #endregion

        if (linksResponse.ok) {
          const linksData = await linksResponse.json() as { trustSources: Array<{ title: string; url: string; snippet: string; source: string }> };
          if (linksData.trustSources && linksData.trustSources.length > 0) {
            // Convert TrustedSource[] to "Name|URL" format
            linksData.trustSources.forEach(source => {
              const formattedSource = `${source.title}|${source.url}`;
              allTrustSources.add(formattedSource);
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:340',message:'[regenerate] Links found via Tavily',data:{topicTitle:topic.workingTitle,linksCount:linksData.trustSources.length},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
            // #endregion
          } else {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:345',message:'[regenerate] Tavily returned empty results',data:{topicTitle:topic.workingTitle},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
            // #endregion
          }
        } else {
          const errorData = await linksResponse.json().catch(() => ({}));
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:350',message:'[regenerate] Tavily search failed',data:{topicTitle:topic.workingTitle,error:errorData.error || linksResponse.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
          // #endregion
          throw new Error(`Tavily search failed: ${errorData.error || linksResponse.statusText}`);
        }
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:355',message:'[regenerate] Tavily search error, cannot proceed',data:{topicTitle:topic.workingTitle,error:(error as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'tavily-search'})}).catch(()=>{});
        // #endregion
        throw new Error(`Cannot regenerate article: Tavily search failed. ${(error as Error).message}`);
      }

      // Use only Tavily-validated sources (empty array if none found, but still proceed)
      const trustSourcesList = Array.from(allTrustSources);

      // CRITICAL: Use saved humanization settings from existing article if available
      // This ensures regeneration uses the same settings as the original generation
      const existingArticle = generatedArticles.find(a => a.topicTitle === topicId);
      const savedHumanizeSettings = existingArticle?.humanizeSettingsUsed;
      
      // Use saved settings if available, otherwise fall back to global settings
      const regenerateHumanizeOnWrite = savedHumanizeSettings?.humanizeOnWrite ?? humanizeOnWriteEnabled;
      const regenerateHumanizeSettings = savedHumanizeSettings 
        ? {
            model: savedHumanizeSettings.model,
            style: savedHumanizeSettings.style,
            mode: savedHumanizeSettings.mode,
          }
        : humanizeSettings;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:365',message:'[regenerate] Calling /api/articles with Tavily sources',data:{topicTitle:topic.workingTitle,trustSourcesCount:trustSourcesList.length,humanizeOnWrite:regenerateHumanizeOnWrite,usingSavedSettings:!!savedHumanizeSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'articles-flow'})}).catch(()=>{});
      // #endregion

      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          selectedTopics: selectedTopicsData,
          keywordList: topic.primaryKeyword ? [topic.primaryKeyword] : [],
          trustSourcesList: trustSourcesList, // Only Tavily-validated sources
          lightHumanEdit: !regenerateHumanizeOnWrite, // Automatically enable lightHumanEdit if humanization is disabled
          humanizeOnWrite: regenerateHumanizeOnWrite,
          humanizeSettings: regenerateHumanizeOnWrite ? regenerateHumanizeSettings : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to regenerate article.");
      }

      const data = await response.json() as { articles: Array<{
        topicTitle: string;
        titleTag: string;
        metaDescription: string;
        fullArticleText: string;
        articleBodyHtml?: string;
      }> };

      if (data.articles.length > 0) {
        const newArticle = data.articles[0];
        
        // CRITICAL: Clean invisible Unicode characters before saving
        // This ensures all hidden characters are removed even if they come from API
        const cleanedArticle = {
          ...newArticle,
          // Clean all text fields that might contain hidden characters
          titleTag: cleanText(newArticle.titleTag || ''),
          metaDescription: cleanText(newArticle.metaDescription || ''),
          fullArticleText: cleanText(newArticle.fullArticleText || ''),
          articleBodyHtml: cleanText(newArticle.articleBodyHtml || newArticle.fullArticleText || ''),
          // CRITICAL: Preserve humanization settings used for regeneration
          // This allows future regenerations to use the same settings
          humanizeSettingsUsed: savedHumanizeSettings ?? {
            humanizeOnWrite: regenerateHumanizeOnWrite,
            model: regenerateHumanizeSettings.model,
            style: regenerateHumanizeSettings.style,
            mode: regenerateHumanizeSettings.mode,
          },
        };
        
        updateGeneratedArticles(
          generatedArticles.map(a =>
            a.topicTitle === topicId
              ? {
                  ...cleanedArticle,
                  topicTitle: topicId,
                  status: "ready" as const,
                }
              : a
          )
        );
        
        // CRITICAL: Auto-collapse topic block after successful regeneration
        // Remove topic from selectedTopicIds to automatically collapse the expanded topic card
        updateSelectedTopicIds(prev => prev.filter(id => id !== topicId));
        
        // Also close expanded humanize settings for this topic
        if (expandedHumanizeTopicId === topicId) {
          setExpandedHumanizeTopicId(null);
        }
        
        // Play success sound after article regeneration
        playSuccessSound();
      }
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message || "Failed to regenerate article. Please try again.";
      setNotification({
        message: errorMessage,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
      
      updateGeneratedArticles(
        generatedArticles.map(a =>
          a.topicTitle === topicId
            ? { ...a, status: "error" as const }
            : a
        )
      );
    } finally {
      setIsGeneratingArticles(false);
    }
  };

  const handleQuickGenerate = async (topic: Topic) => {
    if (!topicsData) {
      setNotification({
        message: "Please generate topics in Step 1 first",
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return;
    }

    // Check if article already exists and is generating
    const existingArticle = generatedArticles.find(a => a.topicTitle === topic.id);
    if (existingArticle && existingArticle.status === "generating") {
      return; // Already generating
    }

    // Use the same logic as generateArticlesForSelected but for a single topic
    await generateArticlesForTopics([topic], true);
  };

  const generateArticlesForTopics = async (topics: Topic[], autoOpenModal = false) => {
    // Only allow generation in discovery mode
    if (mode !== "discovery") {
      console.warn("generateArticlesForTopics called outside discovery mode, ignoring");
      return;
    }

    if (!topicsData) {
      setNotification({
        message: "Please generate topics in Step 1 first",
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return;
    }

    if (topics.length === 0) {
      setNotification({
        message: "Please select at least one topic for article generation",
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return;
    }

    setLoadingStep("draft");
    setIsGeneratingArticles(true);
    setGenerationStartTime(Date.now());
    
    // Mark all topics as generating
    const topicIds = topics.map(t => t.id);
    updateGeneratedArticles([
      ...generatedArticles.filter(a => !topicIds.includes(a.topicTitle)),
      ...topics.map(topic => ({
        topicTitle: topic.id,
        titleTag: "",
        metaDescription: "",
        fullArticleText: "",
        status: "generating" as const,
      }))
    ]);

    // Auto-scroll to the first generating article loader
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Find the first generating article card
        const articleCards = document.querySelectorAll(`[data-article-id]`) as NodeListOf<HTMLElement>;
        let targetElement: HTMLElement | null = null;
        
        // Find the first generating article card (from top to bottom)
        for (const card of articleCards) {
          const articleIdAttr = card.getAttribute('data-article-id');
          if (articleIdAttr && topicIds.includes(articleIdAttr)) {
            // Check if this article has a loader visible
            const loader = card.querySelector('.article-generating-local');
            if (loader) {
              targetElement = card;
              break;
            }
          }
        }
        
        // If we found a generating article card, scroll to it; otherwise fall back to section
        if (targetElement) {
          targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
        } else if (generatedArticlesSectionRef.current) {
          generatedArticlesSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 300); // Delay to ensure DOM is fully updated
    });

    try {
      // Get full topic data from topicsData with deep brief
      const selectedTopicsData = topics.map(topic => ({
        title: topic.workingTitle,
        brief: [
          topic.shortAngle || "",
          topic.whyNonGeneric || "",
          topic.howAnchorFits || "",
          topic.evergreenNote || "",
          topic.competitionNote || "",
        ].filter(Boolean).join("\n\n"),
        shortAngle: topic.shortAngle || "",
        primaryKeyword: topic.primaryKeyword || "",
        // Include all deep brief fields for article generation
        whyNonGeneric: topic.whyNonGeneric || "",
        howAnchorFits: topic.howAnchorFits || "",
        evergreenNote: topic.evergreenNote || "",
        competitionNote: topic.competitionNote || "",
      }));

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:470',message:'Starting article generation with dynamic link finding',data:{topicsCount:selectedTopicsData.length,briefFields:Object.keys(brief)},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'articles-flow'})}).catch(()=>{});
      // #endregion

      // Step 1: MANDATORY - Find trust sources via Tavily for each topic
      // We'll collect unique sources from all topics
      const allTrustSources = new Set<string>();
      
      // Find links for each topic (in parallel for better performance)
      const linkPromises = selectedTopicsData.map(async (topic) => {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:520',message:'[generate] Calling /api/find-links for topic',data:{topicTitle:topic.title},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'find-links-integration'})}).catch(()=>{});
          // #endregion

          // Build comprehensive search query from topic and brief for better Tavily results
          // Include year for recent data (2024-2025)
          const queryParts = [
            topic.title,
            brief.niche || "",
            brief.platform || "",
            topic.primaryKeyword || "",
            "2024 2025", // Ensure recent data
          ].filter(Boolean);
          const searchQuery = queryParts.join(" ");

          const linksResponse = await fetch("/api/find-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery }),
          });

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:535',message:'[generate] find-links response received',data:{topicTitle:topic.title,query:searchQuery,ok:linksResponse.ok,status:linksResponse.status,statusText:linksResponse.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'find-links-response'})}).catch(()=>{});
          // #endregion

          if (linksResponse.ok) {
            const linksData = await linksResponse.json() as { trustSources: Array<{ title: string; url: string; snippet: string; source: string }> };
            if (linksData.trustSources && linksData.trustSources.length > 0) {
              // Convert TrustedSource[] to "Name|URL" format for compatibility with article prompt
              linksData.trustSources.forEach(source => {
                const formattedSource = `${source.title}|${source.url}`;
                allTrustSources.add(formattedSource);
              });
              
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:540',message:'[generate] Links found for topic via Tavily',data:{topicTitle:topic.title,linksCount:linksData.trustSources.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'find-links-integration'})}).catch(()=>{});
              // #endregion
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:545',message:'[generate] Tavily returned empty results for topic',data:{topicTitle:topic.title},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'find-links-integration'})}).catch(()=>{});
              // #endregion
            }
          } else {
            // Handle error response - Tavily search failed
            const errorData = await linksResponse.json().catch(() => ({}));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:550',message:'[generate] Tavily search failed for topic',data:{topicTitle:topic.title,error:errorData.error || linksResponse.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'find-links-integration'})}).catch(()=>{});
            // #endregion
            throw new Error(`Tavily search failed for topic "${topic.title}": ${errorData.error || linksResponse.statusText}`);
          }
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:555',message:'[generate] Tavily search error for topic',data:{topicTitle:topic.title,error:(error as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'find-links-integration'})}).catch(()=>{});
          // #endregion
          throw error; // Re-throw to stop generation if Tavily fails
        }
      });

      // Wait for all link finding requests to complete
      await Promise.all(linkPromises);

      // Use ONLY Tavily-validated sources
      const trustSourcesList = Array.from(allTrustSources);
      
      // Validate that we have trust sources before proceeding
      if (trustSourcesList.length === 0) {
        throw new Error("Cannot generate articles: No trust sources found via browsing. Please ensure Tavily API key is configured or check your search query.");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:560',message:'Calling /api/articles with trust sources',data:{topicsCount:selectedTopicsData.length,trustSourcesCount:trustSourcesList.length,usingDynamic:allTrustSources.size > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'articles-flow'})}).catch(()=>{});
      // #endregion

      // Step 2: Generate articles with found trust sources
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          selectedTopics: selectedTopicsData,
          keywordList: selectedTopicsData.map(t => t.primaryKeyword).filter(Boolean),
          trustSourcesList: trustSourcesList,
          lightHumanEdit: !humanizeOnWriteEnabled, // Automatically enable lightHumanEdit if humanization is disabled
          humanizeOnWrite: humanizeOnWriteEnabled, // Pass humanize on write toggle to API
          humanizeSettings: humanizeOnWriteEnabled ? humanizeSettings : undefined, // Pass humanize settings only if enabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to generate articles.");
      }

      const data = await response.json() as { articles: Array<{
        topicTitle: string;
        titleTag: string;
        metaDescription: string;
        fullArticleText: string;
        articleBodyHtml?: string;
      }> };

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:495',message:'Articles received',data:{articlesCount:data.articles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'articles-flow'})}).catch(()=>{});
      // #endregion

      // Update generated articles with results
      // CRITICAL: Clean invisible Unicode characters before saving
      // This ensures all hidden characters are removed even if they come from API
      updateGeneratedArticles([
        ...generatedArticles.filter(a => !topicIds.includes(a.topicTitle)),
        ...data.articles.map((article, index) => ({
          ...article,
          // Clean all text fields that might contain hidden characters
          titleTag: cleanText(article.titleTag || ''),
          metaDescription: cleanText(article.metaDescription || ''),
          fullArticleText: cleanText(article.fullArticleText || ''),
          articleBodyHtml: cleanText(article.articleBodyHtml || article.fullArticleText || ''),
          topicTitle: topics[index]?.id || article.topicTitle,
          status: "ready" as const,
          // CRITICAL: Save humanization settings used for this article
          // This allows regeneration to use the same settings
          humanizeSettingsUsed: {
            humanizeOnWrite: humanizeOnWriteEnabled,
            model: humanizeSettings.model,
            style: humanizeSettings.style,
            mode: humanizeSettings.mode,
          },
        }))
      ]);
      
      // CRITICAL: Auto-collapse topic blocks after successful generation
      // Remove topics from selectedTopicIds to automatically collapse the expanded topic cards
      updateSelectedTopicIds(prev => prev.filter(id => !topicIds.includes(id)));
      
      // Also close expanded humanize settings for these topics
      setExpandedHumanizeTopicId(prev => {
        if (prev && topicIds.includes(prev)) {
          return null; // Close if it was one of the generated topics
        }
        return prev;
      });
      
      // Show notification with elapsed time
      if (generationStartTime) {
        const elapsedMs = Date.now() - generationStartTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = minutes > 0 
          ? `${minutes} min ${seconds} sec`
          : `${seconds} sec`;
        
        setNotification({
          message: "We generated and created the best article",
          time: timeString,
          visible: true,
        });
        setGenerationStartTime(null);
        // Play success sound after article generation
        playSuccessSound();
      }
      
      // Auto-scroll to the first article that is currently generating (from top to bottom)
      setTimeout(() => {
        // Find the first article card that is in "generating" status
        let targetElement: HTMLElement | null = null;
        
        // Get all article cards in the order they appear in the DOM (top to bottom)
        const allArticleCards = document.querySelectorAll(`[data-article-id]`) as NodeListOf<HTMLElement>;
        
        // Find the first one that is generating
        for (const card of allArticleCards) {
          const articleId = card.getAttribute('data-article-id');
          if (articleId) {
            // Check if this article is in generating status
            const article = generatedArticles.find(a => a.topicTitle === articleId);
            if (article && article.status === "generating") {
              targetElement = card;
              break; // Found the first generating article from top
            }
          }
        }
        
        // If we found a generating article card, scroll to it; otherwise fall back to section
        if (targetElement) {
          targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' // Center the article in view for better UX
          });
        } else if (generatedArticlesSectionRef.current) {
          // Fallback: scroll to section if article card not found yet
          generatedArticlesSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 500); // Increased delay to ensure DOM is fully updated
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message || "Failed to generate articles. Please try again.";
      setNotification({
        message: errorMessage,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
      
      // Mark failed articles
      updateGeneratedArticles(
        generatedArticles.map(a =>
          topicIds.includes(a.topicTitle) && a.status === "generating"
            ? { ...a, status: "error" as const }
            : a
        )
      );
    } finally {
      setLoadingStep(null);
      setIsGeneratingArticles(false);
      if (generationStartTime) {
        setGenerationStartTime(null);
      }
    }
  };

  // Generate article for DirectArticleCreation mode
  const generateDirectArticle = async () => {
    // Only allow generation in direct mode
    if (mode !== "direct") {
      return;
    }

    // Validate article topic
    if (!directArticleTopic || !directArticleTopic.trim()) {
      setNotification({
        message: "Please enter the article topic in the 'Article Topic' field",
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return;
    }

    // Validate Project Basis fields with detailed error messages
    // Use briefWithDefaults to match button validation logic
    const missingFields: string[] = [];
    if (!briefWithDefaults || !briefWithDefaults.niche || !briefWithDefaults.niche.trim()) {
      missingFields.push("Main niche or theme");
    }
    const languageValue = briefWithDefaults?.language || "English";
    if (!languageValue || !languageValue.trim()) {
      missingFields.push("Language");
    }

    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(", ");
      setNotification({
        message: `Please fill in the required fields in Project Basis: ${fieldsList}`,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
      return;
    }
    setLoadingStep("draft");
    setIsGeneratingArticles(true);
    setGenerationStartTime(Date.now());
    
    // Create a unique ID for this direct article
    const articleId = `direct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Mark as generating - use functional update to ensure we get the latest state
    // Set titleTag immediately from directArticleTopic for Direct Article Creation mode
    updateGeneratedArticles(prev => [
      ...prev,
      {
        topicTitle: articleId,
        titleTag: directArticleTopic, // Set title immediately from topic
        metaDescription: "",
        fullArticleText: "",
        status: "generating" as const,
      }
    ]);

    // Auto-scroll to the loader immediately after marking as generating
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Find the article card with this articleId
        const articleCard = document.querySelector(`[data-article-id="${articleId}"]`) as HTMLElement;
        
        if (articleCard) {
          // Check if article loader is visible
          const articleLoader = articleCard.querySelector('.article-generating-local');
          if (articleLoader) {
            // Scroll to the article card, positioning the loader in view
            articleCard.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          } else {
            // If loader not found yet, scroll to card anyway
            articleCard.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          }
        } else if (generatedArticlesSectionRef.current) {
          // Fallback to articles section
          generatedArticlesSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 300); // Delay to ensure DOM is fully updated
    });

    try {
      // Step 1: Find trust sources via Tavily for the topic
      // Use briefWithDefaults to ensure we have valid values
      const queryParts = [
        directArticleTopic,
        briefWithDefaults.niche || "",
        briefWithDefaults.platform || "",
        "2024 2025", // Ensure recent data
      ].filter(Boolean);
      const searchQuery = queryParts.join(" ");

      const linksResponse = await fetch("/api/find-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!linksResponse.ok) {
        const errorData = await linksResponse.json().catch(() => ({}));
        throw new Error(`Tavily search failed: ${errorData.error || linksResponse.statusText}`);
      }

      const linksData = await linksResponse.json() as { trustSources: Array<{ title: string; url: string; snippet: string; source: string }> };
      const trustSourcesList = linksData.trustSources && linksData.trustSources.length > 0
        ? linksData.trustSources.map(source => `${source.title}|${source.url}`)
        : [];

      if (trustSourcesList.length === 0) {
        throw new Error("Cannot generate article: No trust sources found via browsing. Please ensure Tavily API key is configured or try a different topic.");
      }

      // Step 2: Generate article with found trust sources
      // Use briefWithDefaults to ensure we have valid values
      // CRITICAL: For Direct Article Creation Mode, do NOT include shortAngle, whyNonGeneric, howAnchorFits
      // These fields are used by API to detect Topic Discovery Mode
      // IMPORTANT: Pass articleId in the topic title so we can match it on response
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: briefWithDefaults,
          selectedTopics: [{
            title: articleId, // Use articleId as title so we can match it in response
            // For Direct Mode: if directArticleBrief is provided, use it; otherwise use topic title
            // API detects Direct Mode by absence of shortAngle/whyNonGeneric/howAnchorFits fields
            brief: directArticleBrief.trim() || directArticleTopic,
            // DO NOT include: shortAngle, whyNonGeneric, howAnchorFits - these indicate Topic Discovery Mode
            primaryKeyword: directArticleTopic.split(" ")[0] || directArticleTopic,
          }],
          keywordList: [directArticleTopic],
          trustSourcesList: trustSourcesList,
          lightHumanEdit: !humanizeOnWriteEnabled, // Automatically enable lightHumanEdit if humanization is disabled
          humanizeOnWrite: humanizeOnWriteEnabled, // Pass UI toggle state to API
          humanizeSettings: humanizeOnWriteEnabled ? humanizeSettings : undefined, // Pass humanize settings only if enabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to generate article.");
      }

      const data = await response.json() as { articles: Array<{
        topicTitle: string;
        titleTag: string;
        metaDescription: string;
        fullArticleText: string;
        articleBodyHtml?: string;
      }> };

      console.log("[generateDirectArticle] Response received:", {
        articlesCount: data.articles?.length || 0,
        firstArticleTopicTitle: data.articles?.[0]?.topicTitle,
        articleId,
        hasTitleTag: !!data.articles?.[0]?.titleTag,
        hasMetaDescription: !!data.articles?.[0]?.metaDescription,
        hasFullArticleText: !!data.articles?.[0]?.fullArticleText,
      });

      // Validate response data
      if (!data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
        console.error("[generateDirectArticle] Invalid response:", data);
        throw new Error("Invalid response from server: articles array is empty or missing");
      }

      // Update generated article with result
      // Preserve titleTag from the generating state if API didn't return one
      const existingArticle = generatedArticles.find(a => a.topicTitle === articleId);
      const preservedTitleTag = existingArticle?.titleTag || data.articles[0]?.titleTag || directArticleTopic;
      
      console.log("[generateDirectArticle] Updating article:", {
        articleId,
        existingArticleFound: !!existingArticle,
        preservedTitleTag,
        responseTopicTitle: data.articles[0]?.topicTitle,
      });
      
      updateGeneratedArticles(prev => {
        const filtered = prev.filter(a => a.topicTitle !== articleId);
        
        // CRITICAL: Clean invisible Unicode characters before saving
        // This ensures all hidden characters are removed even if they come from API
        const cleanedArticle = {
          ...data.articles[0],
          // Clean all text fields that might contain hidden characters
          titleTag: cleanText(preservedTitleTag || ''),
          metaDescription: cleanText(data.articles[0]?.metaDescription || ''),
          fullArticleText: cleanText(data.articles[0]?.fullArticleText || ''),
          articleBodyHtml: cleanText(data.articles[0]?.articleBodyHtml || data.articles[0]?.fullArticleText || ''),
          // CRITICAL: Save humanization settings used for this article
          // This allows regeneration to use the same settings
          humanizeSettingsUsed: {
            humanizeOnWrite: humanizeOnWriteEnabled,
            model: humanizeSettings.model,
            style: humanizeSettings.style,
            mode: humanizeSettings.mode,
          },
        };
        
        const updated = [
          ...filtered,
          {
            ...cleanedArticle,
            topicTitle: articleId,
            status: "ready" as const,
          }
        ];
        console.log("[generateDirectArticle] Updated articles:", {
          beforeCount: prev.length,
          afterCount: updated.length,
          articleStatus: updated.find(a => a.topicTitle === articleId)?.status,
        });
        return updated;
      });
      
      // CRITICAL: Auto-collapse humanize settings after successful generation
      // Close expanded humanize settings if it was for direct mode
      if (expandedHumanizeTopicId === "direct") {
        setExpandedHumanizeTopicId(null);
      }
      
      // Clear topic input
      updateDirectArticleTopic("");
      
      // Show notification with elapsed time
      const startTime = generationStartTime;
      if (startTime) {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = minutes > 0 
          ? `${minutes} min ${seconds} sec`
          : `${seconds} sec`;
        
        setNotification({
          message: "Article generated successfully",
          time: timeString,
          visible: true,
        });
        setGenerationStartTime(null);
      } else {
        setNotification({
          message: "Article generated successfully",
          time: new Date().toLocaleTimeString(),
          visible: true,
        });
      }
      
      // Play success sound after article generation (always, regardless of timing)
      playSuccessSound();
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message || "Failed to generate article. Please try again.";
      setNotification({
        message: errorMessage,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
      
      // Mark as error
      updateGeneratedArticles(prev => prev.map(a =>
        a.topicTitle === articleId
          ? { ...a, status: "error" as const }
          : a
      ));
    } finally {
      setLoadingStep(null);
      setIsGeneratingArticles(false);
      if (generationStartTime) {
        setGenerationStartTime(null);
      }
    }
  };

  const generateArticlesForSelected = async () => {
    if (selectedTopicIds.length === 0) {
      setNotification({
        message: "Please select at least one topic for article generation",
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return;
    }

    if (!topicsData) {
      setNotification({
        message: "Please generate topics in Step 1 first",
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 5000);
      return;
    }

    const selectedTopics = topicsData.topics.filter(t => selectedTopicIds.includes(t.id));
    
    // Scroll to articles section after a short delay to allow UI to update
    setTimeout(() => {
      if (generatedArticlesSectionRef.current) {
        generatedArticlesSectionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100);
    
    await generateArticlesForTopics(selectedTopics, false);
  };

  const toggleArticleEdit = (topicId: string) => {
    setEditingArticles(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const downloadArticle = (topicId: string, content: string, format: "txt" | "html" | "pdf" = "txt") => {
    const article = generatedArticles.find(a => a.topicTitle === topicId);
    const topic = mode === "discovery" ? topicsData?.topics.find(t => t.id === topicId) : undefined;
    const title = article?.titleTag 
      ? stripHtmlTags(article.titleTag)
      : (mode === "direct" 
          ? topicId.replace(/^direct-\d+-/, "")
          : (topic?.workingTitle || topicId));
    
    let blob: Blob;
    let filename: string;
    let mimeType: string;

    if (format === "html") {
      // For HTML, preserve the HTML tags and wrap in a proper HTML document
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3 { margin: 1.5rem 0 0.75rem 0; font-weight: 600; }
    p { margin: 0.75rem 0; }
    a { color: #0066cc; text-decoration: underline; font-weight: 600; }
    b, strong { font-weight: 600; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
      blob = new Blob([htmlContent], { type: "text/html" });
      filename = `${title.replace(/[^a-z0-9]/gi, "_")}.html`;
      mimeType = "text/html";
    } else if (format === "pdf") {
      // For PDF, create HTML content and use browser's print to PDF
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @media print {
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
      h1, h2, h3 { margin: 1.5rem 0 0.75rem 0; font-weight: 600; page-break-after: avoid; }
      p { margin: 0.75rem 0; }
      a { color: #0066cc; text-decoration: underline; font-weight: 600; }
      b, strong { font-weight: 600; }
    }
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3 { margin: 1.5rem 0 0.75rem 0; font-weight: 600; }
    p { margin: 0.75rem 0; }
    a { color: #0066cc; text-decoration: underline; font-weight: 600; }
    b, strong { font-weight: 600; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
      
      // Open print dialog for PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      return; // Exit early for PDF
    } else {
      // For plain text, use structured extraction for better formatting
      const temp = document.createElement('div');
      temp.innerHTML = content;
      const plainText = extractPlainTextFromElement(temp);
      blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
      filename = `${title.replace(/[^a-z0-9]/gi, "_")}.txt`;
      mimeType = "text/plain";
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getArticleText = (article: GeneratedArticle): string => {
    return article.editedText || article.articleBodyHtml || article.fullArticleText;
  };

  // OLD POST-PROCESSING HUMANIZATION REMOVED
  // Humanization now happens during generation via the "Humanize on write" toggle.

  // Decode HTML entities (&#39; → ', &quot; → ", etc.)
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text;
    
    // Use DOM API for proper decoding (works in browser)
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    }
    
    // SSR fallback: decode common HTML entities using regex
    return text
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8217;/g, "'")  // Right single quotation mark
      .replace(/&#8216;/g, "'")  // Left single quotation mark
      .replace(/&#8220;/g, '"')  // Left double quotation mark
      .replace(/&#8221;/g, '"'); // Right double quotation mark
  };

  const stripHtmlTags = (html: string): string => {
    const withoutTags = html.replace(/<[^>]*>/g, '').replace(/H[1-3]:\s*/gi, '').trim();
    // Decode HTML entities after stripping tags
    return decodeHtmlEntities(withoutTags);
  };

  const getWordCount = (text: string): number => {
    const plainText = stripHtmlTags(text);
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  };

  const formatWordCount = (count: number): string => {
    return count.toLocaleString('en-US');
  };

  const getArticleTitle = (article: GeneratedArticle, topic?: Topic): string => {
    // Get title from article or topic, strip HTML tags
    // For DirectArticleCreation mode, use titleTag (which is set from directArticleTopic during generation)
    let title = article.titleTag || topic?.workingTitle || "";
    
    // For direct mode, if no titleTag, use directArticleTopic as fallback
    if (mode === "direct" && !title) {
      // Fallback to directArticleTopic if available
      title = directArticleTopic || "";
    }
    
    const cleaned = stripHtmlTags(title);
    // Ensure we always return a non-empty string for image generation
    const result = cleaned || "Article";
    return result;
  };

  const getArticleSummary = (article: GeneratedArticle, topic?: Topic): string => {
    // Prefer topic's shortAngle, otherwise use first 1-2 sentences from article
    if (topic?.shortAngle) {
      return topic.shortAngle;
    }
    const text = getArticleText(article);
    const plainText = stripHtmlTags(text);
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 2).join(". ").trim() + (sentences.length > 2 ? "." : "");
  };

  const getArticlePreview = (article: GeneratedArticle): string => {
    const text = getArticleText(article);
    // Strip HTML tags for preview - plain text only
    const plainText = stripHtmlTags(text);
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).join(". ") + (sentences.length > 3 ? "..." : "");
  };

  // Edit article with AI
  const editArticleWithAI = async (articleId: string) => {
    if (!editRequest.trim()) {
      setNotification({
        message: "Please enter an edit request",
        time: new Date().toLocaleTimeString(),
        visible: true,
      });
      return;
    }

    const article = generatedArticles.find(a => a.topicTitle === articleId);
    if (!article) {
      setNotification({
        message: "Article not found",
        time: new Date().toLocaleTimeString(),
        visible: true,
      });
      return;
    }

    setIsProcessingEdit(true);
    setEditingArticleId(articleId);
    setEditingArticleStatus("Analyzing your edit request and article content...");
    setNotification({
      message: "Processing edit request...",
      time: new Date().toLocaleTimeString(),
      visible: true,
    });

    try {
      const currentHtml = article.articleBodyHtml || article.fullArticleText || "";
      const articleTitle = article.titleTag || directArticleTopic || "Article";

      // Extract existing links from article HTML to preserve them
      // Also try to fetch new trust sources if the edit request asks for more links
      const trustSourcesList: string[] = [];
      
      // Extract existing URLs from the article to preserve them
      const urlRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
      const existingUrls = new Map<string, string>(); // URL -> anchor text
      let match;
      while ((match = urlRegex.exec(currentHtml)) !== null) {
        const url = match[1];
        const anchorText = match[2] || "";
        // Only include external URLs (not anchor links or promosoundgroup links)
        if ((url.startsWith('http://') || url.startsWith('https://')) && 
            !url.includes('promosoundgroup.net')) {
          existingUrls.set(url, anchorText);
          // Add to trust sources list in format "Title|URL"
          const title = anchorText.trim() || new URL(url).hostname;
          trustSourcesList.push(`${title}|${url}`);
        }
      }

      // Enhanced request understanding - detect various ways user might ask for images
      // CRITICAL: Only trigger image search for EXPLICIT image-related requests
      // Do NOT trigger for general text editing requests like "remove fragment", "fix text", etc.
      const editRequestLower = editRequest.toLowerCase().trim();
      
      // Explicit image-related keywords (must be clearly about images)
      const explicitImageKeywords = [
        'зображен', 'image', 'фото', 'photo', 'картинк', 'picture', 
        'visual', 'візуал', 'додай зображення', 'add image', 
        'find image', 'знайди зображення', 'search image', 'шукай зображення',
        'зображення не відображається', 'image not displaying',
        'broken image', 'бите зображення', 'замінити зображення', 'replace image',
        'виправити зображення', 'fix image', 'зображення не працює', 'image not working'
      ];
      
      // Check if request is EXPLICITLY about images (not just contains ambiguous words)
      const needsImages = explicitImageKeywords.some(keyword => {
        // Use word boundaries or exact phrases to avoid false positives
        if (keyword.includes(' ')) {
          // For phrases, check if the phrase appears as a whole
          return editRequestLower.includes(keyword);
        } else {
          // For single words, check if they appear in image-related context
          // Avoid matching words that are part of other words (e.g., "image" in "imagine")
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(editRequestLower);
        }
      });
      
      // Additional check: if request mentions "broken" or "fix" but NOT in image context,
      // it's likely a text editing request, not an image request
      const hasBrokenOrFix = editRequestLower.includes('broken') || 
                            editRequestLower.includes('fix') ||
                            editRequestLower.includes('виправити') ||
                            editRequestLower.includes('бит');
      const hasImageContext = editRequestLower.includes('image') || 
                             editRequestLower.includes('зображен') ||
                             editRequestLower.includes('photo') ||
                             editRequestLower.includes('фото') ||
                             editRequestLower.includes('picture') ||
                             editRequestLower.includes('картинк');
      
      // If request has "broken/fix" but NO image context, it's NOT an image request
      const isTextEditRequest = hasBrokenOrFix && !hasImageContext;
      
      // Final decision: only needs images if explicitly about images AND not a text edit request
      const finalNeedsImages = needsImages && !isTextEditRequest;
      
      // Detect if user wants to search social media or official sites
      const wantsSocialMedia = editRequestLower.includes('instagram') ||
                              editRequestLower.includes('facebook') ||
                              editRequestLower.includes('соціальн') ||
                              editRequestLower.includes('social') ||
                              editRequestLower.includes('соцмереж');
      
      const wantsOfficialSites = editRequestLower.includes('офіційн') ||
                                editRequestLower.includes('official') ||
                                editRequestLower.includes('офіційний сайт') ||
                                editRequestLower.includes('official site') ||
                                editRequestLower.includes('official website');

      // Variable for enhanced edit request (used across the function)
      let finalEditRequestForAPI: string | undefined = undefined;

      // If edit request mentions images, use intelligent image search algorithm
      // CRITICAL: Only trigger for EXPLICIT image requests, not general text edits
      if (finalNeedsImages) {
        setEditingArticleStatus("Analyzing article and generating intelligent image search queries...");
        try {
          // Import intelligent image search algorithm
          const { 
            extractEntitiesFromArticle, 
            analyzeUserRequest, 
            generateSearchQueries 
          } = await import('../lib/imageSearchAlgorithm');
          
          // CRITICAL: If user wants to replace broken images, first detect broken images in HTML
          // Only check for broken images if request explicitly mentions images
          const isBrokenImageRequest = (editRequestLower.includes('broken image') ||
                                      editRequestLower.includes('бите зображення') ||
                                      editRequestLower.includes('замінити зображення') ||
                                      editRequestLower.includes('replace image') ||
                                      editRequestLower.includes('виправити зображення') ||
                                      editRequestLower.includes('fix image') ||
                                      editRequestLower.includes('зображення не працює') ||
                                      editRequestLower.includes('image not working')) &&
                                      hasImageContext; // Must have image context
          
          let brokenImagesInfo: Array<{ url: string; context: string; alt?: string }> = [];
          let enhancedEditRequest = editRequest; // Will be enhanced if broken images found
          
          if (isBrokenImageRequest) {
            setEditingArticleStatus("Detecting broken images in article...");
            
            // Extract all image URLs from HTML
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            const images: Array<{ url: string; fullTag: string; context: string; alt?: string }> = [];
            let match;
            
            while ((match = imgRegex.exec(currentHtml)) !== null) {
              const imgUrl = match[1];
              const fullTag = match[0];
              
              // Extract alt text if present
              const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
              const alt = altMatch ? altMatch[1] : undefined;
              
              // Get context around the image (100 chars before and after)
              const imgIndex = match.index || 0;
              const contextStart = Math.max(0, imgIndex - 100);
              const contextEnd = Math.min(currentHtml.length, imgIndex + fullTag.length + 100);
              const context = currentHtml.substring(contextStart, contextEnd)
                .replace(/<[^>]+>/g, ' ') // Remove HTML tags for context
                .replace(/\s+/g, ' ')
                .trim();
              
              images.push({ url: imgUrl, fullTag, context, alt });
            }
            
            console.log(`[editArticleWithAI] Found ${images.length} images in article`);
            
            // Check which images are broken (quick check - verify URL is accessible)
            setEditingArticleStatus(`Checking ${images.length} images for accessibility...`);
            const brokenImages: typeof brokenImagesInfo = [];
            
            // Check images in parallel batches
            const batchSize = 5;
            for (let i = 0; i < images.length; i += batchSize) {
              const batch = images.slice(i, i + batchSize);
              setEditingArticleStatus(`Checking images ${i + 1}-${Math.min(i + batchSize, images.length)}/${images.length}...`);
              
              const checks = await Promise.allSettled(
                batch.map(async (img) => {
                  try {
                    // Quick HEAD request to check if image is accessible
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
                    
                    const response = await fetch(img.url, {
                      method: 'HEAD',
                      signal: controller.signal,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)',
                      },
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
                      return { url: img.url, context: img.context, alt: img.alt, isBroken: true };
                    }
                    return { url: img.url, context: img.context, alt: img.alt, isBroken: false };
                  } catch (error) {
                    // If fetch fails, assume image is broken
                    console.log(`[editArticleWithAI] Image check failed for ${img.url}:`, error);
                    return { url: img.url, context: img.context, alt: img.alt, isBroken: true };
                  }
                })
              );
              
              checks.forEach((result) => {
                if (result.status === 'fulfilled' && result.value.isBroken) {
                  brokenImages.push({
                    url: result.value.url,
                    context: result.value.context,
                    alt: result.value.alt,
                  });
                }
              });
              
              // Small delay between batches
              if (i + batchSize < images.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
            
            brokenImagesInfo = brokenImages;
            console.log(`[editArticleWithAI] Detected ${brokenImages.length} broken images out of ${images.length} total`);
            
            // Add broken images info to edit request context
            if (brokenImages.length > 0) {
              const brokenImagesList = brokenImages.map((img, idx) => 
                `${idx + 1}. URL: ${img.url}\n   Context: ${img.context.substring(0, 150)}...\n   Alt text: ${img.alt || 'none'}`
              ).join('\n\n');
              
              // Enhance edit request with broken images info
              enhancedEditRequest = `${editRequest}\n\n🚨 CRITICAL: The following ${brokenImages.length} image(s) are BROKEN and MUST be replaced:\n\n${brokenImagesList}\n\nYou MUST replace EACH broken image URL with a working image from the provided sources. Match images EXACTLY to the content context.`;
            }
          }
          
          // Build search context (use enhanced request if broken images were detected)
          const finalEditRequest = brokenImagesInfo.length > 0 ? enhancedEditRequest : editRequest;
          const searchContext = {
            userRequest: finalEditRequest,
            articleTitle: articleTitle,
            articleHtml: currentHtml,
            niche: brief.niche || '',
            language: brief.language || 'English',
          };
          
          // Analyze user request to understand intent
          const intent = analyzeUserRequest(finalEditRequest);
          
          // Store final edit request for later use in API call
          finalEditRequestForAPI = finalEditRequest;
          console.log(`[editArticleWithAI] Search intent:`, intent);
          
          // Extract entities from article (items, topics, concepts, etc.)
          // If we have broken images, also extract entities from broken image contexts
          let entities = extractEntitiesFromArticle(currentHtml, articleTitle);
          
          // If we have broken images, extract entities from their contexts too
          if (brokenImagesInfo.length > 0) {
            const brokenImageContexts = brokenImagesInfo.map(img => img.context).join(' ');
            const brokenImageEntities = extractEntitiesFromArticle(brokenImageContexts, articleTitle);
            // Merge entities, prioritizing those from broken image contexts
            entities = [...brokenImageEntities, ...entities];
            console.log(`[editArticleWithAI] Extracted ${brokenImageEntities.length} entities from broken image contexts`);
          }
          
          console.log(`[editArticleWithAI] Extracted ${entities.length} entities:`, entities.map(e => `${e.name} (${e.type}, priority: ${e.priority})`));
          
          // Generate intelligent search queries based on context and intent
          const searchQueriesWithPriority = generateSearchQueries(searchContext, intent, entities);
          console.log(`[editArticleWithAI] Generated ${searchQueriesWithPriority.length} intelligent search queries`);
          
          // Convert to simple array, prioritizing high-priority queries
          const searchQueries = searchQueriesWithPriority.map(sq => sq.query);
          
          // OPTIMIZED: Determine max queries to minimize Tavily API credits usage
          // Strategy: Use fewer, more targeted queries instead of many generic ones
          const baseMaxQueriesByDepth = {
            shallow: 5,   // Reduced from 10
            medium: 12,   // Reduced from 20
            deep: 20,     // Reduced from 30
          };
          
          // Adjust based on number of entities, but be conservative
          const entitiesCount = entities.length;
          let maxQueries = baseMaxQueriesByDepth[intent.searchDepth];
          
          // Scale up conservatively - prioritize quality over quantity
          if (entitiesCount > 10) {
            // For many entities: 1-1.5 queries per entity max
            maxQueries = Math.min(
              searchQueries.length,
              Math.max(maxQueries, Math.min(Math.ceil(entitiesCount * 1.2), 25)) // Max 25 queries
            );
          } else if (entitiesCount > 5) {
            // For medium entities: 1.5-2 queries per entity
            maxQueries = Math.min(searchQueries.length, Math.max(maxQueries, Math.ceil(entitiesCount * 1.5)));
          }
          
          // CRITICAL: Final cap - never exceed 25 queries to save Tavily credits
          // Each query costs credits, so we need to be efficient
          maxQueries = Math.min(searchQueries.length, Math.min(maxQueries, 25));
          
          console.log(`[editArticleWithAI] OPTIMIZED: Will search ${maxQueries} queries (search depth: ${intent.searchDepth}, entities: ${entitiesCount}, total queries available: ${searchQueries.length}) - Tavily credits optimized`);
          
          // Search for images with each query and collect unique results
          const allImages: Array<{ url: string; sourceUrl: string; title?: string }> = [];
          const seenUrls = new Set<string>(); // Track unique image URLs
          const seenSourceDomains = new Set<string>(); // Track unique source domains to ensure diversity
          
          // Helper function to extract domain from URL
          const getDomain = (url: string): string => {
            try {
              const urlObj = new URL(url);
              return urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix
            } catch {
              return '';
            }
          };
          
          // Track which entities have images found (for fallback search)
          const entitiesWithImages = new Map<string, boolean>();
          entities.forEach(entity => {
            entitiesWithImages.set(entity.name, false);
          });
          
          for (let i = 0; i < maxQueries; i++) {
            const queryInfo = searchQueriesWithPriority[i];
            setEditingArticleStatus(`Searching images (${i + 1}/${maxQueries}): ${queryInfo.query.substring(0, 50)}...`);
            
            try {
              console.log(`[editArticleWithAI] Searching images via Tavily API for query: "${searchQueries[i]}" (priority: ${queryInfo.priority}, type: ${queryInfo.searchType})`);
              const imagesResponse = await fetch("/api/search-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: searchQueries[i],
                }),
              });

              if (imagesResponse.ok) {
                const imagesData = await imagesResponse.json() as { images: Array<{ url: string; sourceUrl: string; title?: string }> };
                console.log(`[editArticleWithAI] Tavily API returned ${imagesData.images?.length || 0} images for query: "${searchQueries[i]}"`);
                if (imagesData.images && imagesData.images.length > 0) {
                  // Track which entity this query was for
                  if (queryInfo.entity) {
                    entitiesWithImages.set(queryInfo.entity.name, true);
                  }
                  // Add only unique images from unique sources with URL validation
                  imagesData.images.forEach(image => {
                    if (!image.url || !image.url.startsWith('http')) {
                      console.log(`[editArticleWithAI] Skipping invalid image URL: ${image.url}`);
                      return;
                    }
                    
                    // Validate URL format
                    try {
                      new URL(image.url);
                    } catch {
                      console.log(`[editArticleWithAI] Skipping invalid URL format: ${image.url}`);
                      return;
                    }
                    
                    // Normalize URL (remove query params that might cause duplicates)
                    const normalizedUrl = image.url.split('?')[0].split('#')[0];
                    
                    const imageUrl = image.url;
                    const sourceDomain = getDomain(image.sourceUrl || image.url);
                    
                    // Skip if we've already seen this exact image URL (check both original and normalized)
                    if (seenUrls.has(imageUrl) || seenUrls.has(normalizedUrl)) {
                      console.log(`[editArticleWithAI] Skipping duplicate image URL: ${imageUrl}`);
                      return;
                    }
                    
                    // Skip if we've already used an image from this source domain (ensure diversity)
                    if (sourceDomain && seenSourceDomains.has(sourceDomain)) {
                      console.log(`[editArticleWithAI] Skipping image from duplicate source domain: ${sourceDomain}`);
                      return;
                    }
                    
                    // Add the image
                    allImages.push(image);
                    seenUrls.add(imageUrl);
                    seenUrls.add(normalizedUrl); // Also track normalized URL
                    if (sourceDomain) {
                      seenSourceDomains.add(sourceDomain);
                    }
                  });
                }
              }
              
              // Small delay between requests to avoid rate limiting
              if (i < maxQueries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
              console.warn(`[editArticleWithAI] Failed to fetch images for query "${searchQueries[i]}":`, error);
              // Continue with next query
            }
          }
          
          // Fallback: If some entities don't have images, try more general queries
          // Prioritize high-priority entities first
          const entitiesWithoutImages = entities
            .filter(entity => !entitiesWithImages.get(entity.name))
            .sort((a, b) => b.priority - a.priority); // Sort by priority
            
          if (entitiesWithoutImages.length > 0 && intent.searchDepth !== 'shallow') {
            const maxFallback = intent.searchDepth === 'deep' ? 20 : 10;
            console.log(`[editArticleWithAI] ${entitiesWithoutImages.length} entities without images, trying fallback queries for top ${maxFallback}...`);
            
            for (const entity of entitiesWithoutImages.slice(0, maxFallback)) {
              setEditingArticleStatus(`Searching fallback images for ${entity.name}...`);
              
              // Generate fallback queries based on entity type and context
              const fallbackQueries: string[] = [
                entity.name, // Just the name
              ];
              
              // Add type-specific fallback queries
              if (entity.type === 'event') {
                fallbackQueries.push(
                  `${entity.name} event`,
                  `${entity.name} festival`,
                );
              } else if (entity.type === 'person') {
                fallbackQueries.push(
                  `${entity.name} artist`,
                  `${entity.name} musician`,
                );
              } else if (entity.type === 'place') {
                fallbackQueries.push(
                  `${entity.name} location`,
                  `${entity.name} venue`,
                );
              }
              
              // Add niche-specific query
              if (brief.niche) {
                fallbackQueries.push(`${entity.name} ${brief.niche}`);
              }
              
              // Add general photo/image queries
              fallbackQueries.push(
                `${entity.name} photo`,
                `${entity.name} image`,
              );
              
              for (const fallbackQuery of fallbackQueries) {
                try {
                  const fallbackResponse = await fetch("/api/search-images", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: fallbackQuery }),
                  });
                  
                  if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json() as { images: Array<{ url: string; sourceUrl: string; title?: string }> };
                    if (fallbackData.images && fallbackData.images.length > 0) {
                      // Add images from fallback search
                      let foundImage = false;
                      fallbackData.images.forEach(image => {
                        if (!image.url || !image.url.startsWith('http')) return;
                        
                        try {
                          new URL(image.url);
                        } catch {
                          return;
                        }
                        
                        const normalizedUrl = image.url.split('?')[0].split('#')[0];
                        const imageUrl = image.url;
                        const sourceDomain = getDomain(image.sourceUrl || image.url);
                        
                        if (!seenUrls.has(imageUrl) && !seenUrls.has(normalizedUrl)) {
                          if (!sourceDomain || !seenSourceDomains.has(sourceDomain)) {
                            allImages.push(image);
                            seenUrls.add(imageUrl);
                            seenUrls.add(normalizedUrl);
                            if (sourceDomain) {
                              seenSourceDomains.add(sourceDomain);
                            }
                            foundImage = true;
                          }
                        }
                      });
                      
                      if (foundImage) {
                        entitiesWithImages.set(entity.name, true);
                        console.log(`[editArticleWithAI] Found fallback image for ${entity.name}`);
                        break; // Found at least one image for this entity
                      }
                    }
                  }
                  
                  await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
                } catch (error) {
                  console.warn(`[editArticleWithAI] Fallback search failed for "${fallbackQuery}":`, error);
                }
              }
            }
            
            const entitiesWithImagesCount = Array.from(entitiesWithImages.values()).filter(v => v).length;
            console.log(`[editArticleWithAI] After fallback: ${entitiesWithImagesCount} entities have images out of ${entities.length} total`);
          }
          
          if (allImages.length > 0) {
            // Validate and filter images - remove invalid URLs
            let validImages = allImages.filter(image => {
              if (!image.url || !image.url.startsWith('http')) {
                console.log(`[editArticleWithAI] Filtering out invalid image URL: ${image.url}`);
                return false;
              }
              
              // Check if URL looks like a valid image URL
              try {
                const url = new URL(image.url);
                const pathname = url.pathname.toLowerCase();
                const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
                const hasImageExtension = validExtensions.some(ext => pathname.endsWith(ext));
                const isImageHost = url.hostname.includes('img') || 
                                   url.hostname.includes('image') || 
                                   url.hostname.includes('photo') ||
                                   url.hostname.includes('cdn') ||
                                   url.hostname.includes('media') ||
                                   url.hostname.includes('static') ||
                                   url.hostname.includes('wp-content') ||
                                   url.hostname.includes('cloudfront') ||
                                   url.hostname.includes('amazonaws');
                
                // Accept if it has image extension OR is from known image hosting domain
                if (!hasImageExtension && !isImageHost) {
                  console.log(`[editArticleWithAI] Filtering out non-image URL: ${image.url}`);
                  return false;
                }
                
                return true;
              } catch {
                console.log(`[editArticleWithAI] Filtering out invalid URL format: ${image.url}`);
                return false;
              }
            });
            
            // OPTIMIZED: Verify image accessibility - but be more efficient
            // Only verify top priority images to save time and resources
            setEditingArticleStatus(`Verifying image accessibility (checking top ${Math.min(validImages.length, 30)} images)...`);
            const accessibleImages: typeof validImages = [];
            
            // Limit verification to top 30 images to save time
            // If we have many images, verify only the most promising ones
            const imagesToVerify = validImages.slice(0, 30);
            
            // Check images in parallel batches to avoid overwhelming the server
            const batchSize = 5;
            for (let i = 0; i < imagesToVerify.length; i += batchSize) {
              const batch = imagesToVerify.slice(i, i + batchSize);
              setEditingArticleStatus(`Verifying images ${i + 1}-${Math.min(i + batchSize, imagesToVerify.length)}/${imagesToVerify.length}...`);
              
              const batchChecks = await Promise.allSettled(
                batch.map(async (image) => {
                  try {
                    // Use HEAD request to check if image is accessible without downloading
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced to 3 seconds
                    
                    const response = await fetch(image.url, {
                      method: 'HEAD',
                      signal: controller.signal,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)',
                      },
                    });
                    
                    clearTimeout(timeoutId);
                    
                    // Check if response is successful and content-type is an image
                    if (response.ok) {
                      const contentType = response.headers.get('content-type') || '';
                      const isImage = contentType.startsWith('image/') || 
                                     image.url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
                      
                      if (isImage) {
                        return { image, accessible: true };
                      } else {
                        console.log(`[editArticleWithAI] Image URL returned non-image content-type: ${contentType} for ${image.url}`);
                        return { image, accessible: false };
                      }
                    } else {
                      console.log(`[editArticleWithAI] Image URL returned status ${response.status} for ${image.url}`);
                      return { image, accessible: false };
                    }
                  } catch (error) {
                    console.log(`[editArticleWithAI] Failed to verify image accessibility for ${image.url}:`, error);
                    return { image, accessible: false };
                  }
                })
              );
              
              // Add only accessible images
              batchChecks.forEach((result) => {
                if (result.status === 'fulfilled' && result.value.accessible) {
                  accessibleImages.push(result.value.image);
                }
              });
              
              // Small delay between batches
              if (i + batchSize < imagesToVerify.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            // If we have more images than verified, add unverified ones (they might work)
            // But prioritize verified ones
            const unverifiedImages = validImages.slice(30);
            validImages = [...accessibleImages, ...unverifiedImages];
            
            console.log(`[editArticleWithAI] Image verification completed: ${accessibleImages.length} verified accessible images, ${unverifiedImages.length} unverified (added to end), total: ${validImages.length}`);
            
            // OPTIMIZED: Detect and remove duplicate images - but limit to top images to save time
            // Only check duplicates for top 20 images (most important ones)
            const imagesToCheckForDuplicates = validImages.slice(0, 20);
            const imagesNotChecked = validImages.slice(20);
            
            setEditingArticleStatus(`Detecting duplicate images (checking top ${imagesToCheckForDuplicates.length} images)...`);
            const uniqueImages: typeof validImages = [];
            const imageHashes = new Map<string, typeof validImages[0]>(); // hash -> first image with this hash
            const seenNormalizedUrls = new Set<string>(); // Track normalized URLs for quick duplicate check
            
            // Compute image hashes in batches (only for top images)
            const hashBatchSize = 3;
            for (let i = 0; i < imagesToCheckForDuplicates.length; i += hashBatchSize) {
              const batch = imagesToCheckForDuplicates.slice(i, i + hashBatchSize);
              setEditingArticleStatus(`Computing image hashes ${i + 1}-${Math.min(i + hashBatchSize, imagesToCheckForDuplicates.length)}/${imagesToCheckForDuplicates.length}...`);
              
              const hashResults = await Promise.allSettled(
                batch.map(async (image) => {
                  try {
                    // Quick URL-based duplicate check first (faster)
                    const normalizedUrl = image.url.split('?')[0].split('#')[0].toLowerCase();
                    if (seenNormalizedUrls.has(normalizedUrl)) {
                      return { image, hash: null, isDuplicate: true };
                    }
                    seenNormalizedUrls.add(normalizedUrl);
                    
                    // Fetch image as ArrayBuffer for hash computation
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5 seconds
                    
                    const response = await fetch(image.url, {
                      signal: controller.signal,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)',
                      },
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                      console.log(`[editArticleWithAI] Failed to fetch image for hash: ${image.url} (status: ${response.status})`);
                      return { image, hash: null, isDuplicate: false };
                    }
                    
                    // Get image data as ArrayBuffer
                    const arrayBuffer = await response.arrayBuffer();
                    
                    // Compute SHA-256 hash
                    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    
                    return { image, hash: hashHex, isDuplicate: false };
                  } catch (error) {
                    console.log(`[editArticleWithAI] Failed to compute hash for ${image.url}:`, error);
                    return { image, hash: null, isDuplicate: false };
                  }
                })
              );
              
              // Process hash results
              hashResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                  const { image, hash, isDuplicate } = result.value;
                  
                  // Skip if already identified as duplicate by URL
                  if (isDuplicate) {
                    console.log(`[editArticleWithAI] Duplicate image detected (by URL) and REMOVED: ${image.url}`);
                    return;
                  }
                  
                  if (hash) {
                    // Check if we've seen this hash before
                    if (imageHashes.has(hash)) {
                      const existingImage = imageHashes.get(hash);
                      console.log(`[editArticleWithAI] Duplicate image detected and REMOVED: ${image.url} (duplicate of ${existingImage?.url})`);
                      // Skip this duplicate
                    } else {
                      // First time seeing this hash - add to unique images
                      imageHashes.set(hash, image);
                      uniqueImages.push(image);
                      console.log(`[editArticleWithAI] Unique image added: ${image.url}`);
                    }
                  } else {
                    // Hash computation failed, but URL is unique - add it
                    uniqueImages.push(image);
                    console.log(`[editArticleWithAI] Image added (hash computation failed, but URL is unique): ${image.url}`);
                  }
                }
              });
              
              // Small delay between batches
              if (i + hashBatchSize < imagesToCheckForDuplicates.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            // Add images that weren't checked for duplicates (they're lower priority anyway)
            // But do a quick URL-based duplicate check
            imagesNotChecked.forEach(image => {
              const normalizedUrl = image.url.split('?')[0].split('#')[0].toLowerCase();
              if (!seenNormalizedUrls.has(normalizedUrl)) {
                seenNormalizedUrls.add(normalizedUrl);
                uniqueImages.push(image);
              } else {
                console.log(`[editArticleWithAI] Duplicate image detected (by URL) and REMOVED: ${image.url}`);
              }
            });
            
            validImages = uniqueImages;
            const duplicatesRemoved = validImages.length - uniqueImages.length;
            console.log(`[editArticleWithAI] Duplicate detection completed: ${uniqueImages.length} unique images (removed ${duplicatesRemoved} duplicates)`);
            
            // Add valid unique image URLs to trust sources list in format "Image Title|Image URL|Source URL"
            validImages.forEach(image => {
              const formatted = `${image.title || "Image"}|${image.url}|${image.sourceUrl}`;
              trustSourcesList.push(formatted);
            });
            console.log(`[editArticleWithAI] Tavily browsing completed: Found ${validImages.length} unique valid images (filtered ${allImages.length - validImages.length} invalid/duplicates) from ${searchQueries.length} queries via Tavily API`);
          } else {
            console.warn("[editArticleWithAI] Tavily API returned no images for any query");
          }
        } catch (error) {
          console.warn("[editArticleWithAI] Failed to fetch images:", error);
          // Continue without images - editor can work without them
        }
      }

      // If edit request mentions adding links, try to fetch new trust sources
      const needsMoreLinks = editRequest.toLowerCase().includes('посилан') || 
                            editRequest.toLowerCase().includes('link') ||
                            editRequest.toLowerCase().includes('джерел') ||
                            editRequest.toLowerCase().includes('source');
      
      if (needsMoreLinks) {
        setEditingArticleStatus("Fetching additional sources from web...");
        try {
          // Fetch trust sources for the article topic
          const linksResponse = await fetch("/api/find-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topicTitle: articleTitle,
              topicBrief: articleTitle,
              niche: brief.niche || "",
              platform: brief.platform || "multi-platform",
            }),
          });

          if (linksResponse.ok) {
            const linksData = await linksResponse.json() as { trustSources: Array<{ title: string; url: string; snippet: string; source: string }> };
            if (linksData.trustSources && linksData.trustSources.length > 0) {
              linksData.trustSources.forEach(source => {
                const formatted = `${source.title}|${source.url}`;
                trustSourcesList.push(formatted);
              });
            }
          }
        } catch (error) {
          console.warn("[editArticleWithAI] Failed to fetch trust sources:", error);
          // Continue without new sources - editor can work with existing links
        }
      }

      setEditingArticleStatus("AI editor is processing your request...");
      
      // Get edit history from article
      const editHistory = article.editHistory || [];
      
      // Use enhanced edit request if it was created (for broken image replacement)
      const finalEditRequestForAPICall = finalEditRequestForAPI || editRequest;
      
      console.log("[editArticleWithAI] Sending request to API:", {
        articleId,
        articleTitle,
        editRequest: finalEditRequestForAPICall.trim(),
        editHistoryLength: editHistory.length,
        trustSourcesListLength: trustSourcesList.length,
        currentHtmlLength: currentHtml.length,
      });
      
      const response = await fetch("/api/edit-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleHtml: currentHtml,
          articleTitle: articleTitle,
          editRequest: finalEditRequestForAPICall.trim(),
          niche: brief.niche || "",
          language: brief.language || "English",
          trustSourcesList: trustSourcesList,
          editHistory: editHistory, // Pass edit history to API
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          const text = await response.text().catch(() => "");
          if (text) {
            errorMessage = text.substring(0, 200); // Limit error message length
          }
        }
        console.error("[editArticleWithAI] API error response:", {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      const data = await response.json() as { 
        success: boolean; 
        editedArticleHtml?: string; 
        plan?: string[];
        images?: Array<{
          id: string;
          query: string;
          url: string;
          alt: string;
          source: string;
          relevanceScore: number;
        }>;
        error?: string;
      };

      console.log("[editArticleWithAI] Response received:", {
        success: data.success,
        hasEditedHtml: !!data.editedArticleHtml,
        editedHtmlLength: data.editedArticleHtml?.length || 0,
        hasPlan: !!data.plan,
        planSteps: data.plan?.length || 0,
        hasImages: !!data.images,
        imagesCount: data.images?.length || 0,
        error: data.error,
        responseStatus: response.status,
      });
      
      // Log plan if available
      if (data.plan && data.plan.length > 0) {
        console.log("[editArticleWithAI] AI execution plan:", data.plan);
      }
      
      // Log images if available
      if (data.images && data.images.length > 0) {
        console.log("[editArticleWithAI] AI found images:", data.images.map(img => ({
          id: img.id,
          url: img.url,
          source: img.source,
          relevanceScore: img.relevanceScore,
        })));
      }

      if (!data.success) {
        const errorMsg = data.error || "Failed to edit article";
        console.error("[editArticleWithAI] API returned error:", errorMsg);
        throw new Error(errorMsg);
      }

      if (!data.editedArticleHtml) {
        console.error("[editArticleWithAI] No edited HTML in response:", data);
        throw new Error("No edited content returned from API");
      }

      setEditingArticleStatus("Applying your edits to the article...");
      
      // Process the edited HTML
      let finalHtml = data.editedArticleHtml!;
      
      // Handle new format image placeholders [IMAGE:id=<image-id>] from JSON response
      if (data.images && data.images.length > 0) {
        setEditingArticleStatus("Processing image placeholders...");
        
        // Replace [IMAGE:id=<id>] placeholders with actual image HTML
        data.images.forEach((image) => {
          if (image.url && image.id) {
            const placeholder = `[IMAGE:id=${image.id}]`;
            const imageHtml = `<figure style="margin: 1.5rem 0;"><img src="${image.url}" alt="${image.alt || ''}" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" /><figcaption style="font-size: 0.85rem; color: #666; margin-top: 0.5rem; text-align: center;">Image source: <a href="${image.url}" target="_blank" rel="noopener noreferrer">${image.source || 'Source'}</a></figcaption></figure>`;
            finalHtml = finalHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imageHtml);
          }
        });
      }
      
      // Legacy placeholder handling (for backward compatibility)
      if (finalNeedsImages) {
        // Check if HTML contains legacy image placeholders
        const hasImagePlaceholders = /\[IMAGE_URL_PLACEHOLDER\]/gi.test(finalHtml);
        
        if (hasImagePlaceholders) {
          if (articleImages.has(articleId)) {
            // Replace placeholders with existing image
            setEditingArticleStatus("Embedding images into article content...");
            const imageData = articleImages.get(articleId);
            if (imageData) {
              const imageUrl = `data:image/png;base64,${imageData}`;
              finalHtml = finalHtml.replace(/\[IMAGE_URL_PLACEHOLDER\]/gi, imageUrl);
            }
          } else {
            // Image not generated yet - try to generate it automatically
            setEditingArticleStatus("Generating article image...");
            try {
              // Start image generation (non-blocking)
              generateArticleImage(articleId).catch(err => {
                console.error("[editArticleWithAI] Image generation error:", err);
              });
              
              // For now, remove placeholders to avoid broken images
              // The image will be generated in background and user can regenerate article later
              console.log("[editArticleWithAI] Image not available yet, removing placeholders. Image generation started in background.");
              finalHtml = finalHtml.replace(/<img[^>]*src=["']\[IMAGE_URL_PLACEHOLDER\][^>]*\/?>/gi, '');
              // Also remove any remaining placeholders in src attributes
              finalHtml = finalHtml.replace(/\[IMAGE_URL_PLACEHOLDER\]/gi, '');
              
              // Show notification that image generation was started
              setNotification({
                message: "Image is being generated in the background. After completion, you can reapply editing.",
                time: new Date().toLocaleTimeString(),
                visible: true,
              });
            } catch (imageError) {
              console.error("[editArticleWithAI] Failed to start image generation:", imageError);
              // Remove image placeholders if generation failed
              finalHtml = finalHtml.replace(/<img[^>]*src=["']\[IMAGE_URL_PLACEHOLDER\][^>]*\/?>/gi, '');
              finalHtml = finalHtml.replace(/\[IMAGE_URL_PLACEHOLDER\]/gi, '');
            }
          }
        }
      }

      // CRITICAL: Clean invisible Unicode characters before saving
      // This ensures all hidden characters (em-dash, smart quotes, zero-width spaces, etc.)
      // are removed even if they come from API or other sources
      setEditingArticleStatus("Cleaning text from hidden characters...");
      finalHtml = cleanText(finalHtml);

      console.log("[editArticleWithAI] Updating article:", {
        articleId,
        finalHtmlLength: finalHtml.length,
        currentArticleBodyHtml: article.articleBodyHtml?.length || 0,
      });

      // Update the article with edited content and add to edit history
      updateGeneratedArticles(prev => {
        const updated = prev.map(a => {
          if (a.topicTitle === articleId) {
            const previousHtml = a.articleBodyHtml || a.fullArticleText || "";
            const editHistory = a.editHistory || [];
            
            // Create summary of what was changed
            const summary = (() => {
              if (finalNeedsImages) return "Додано зображення";
              if (needsMoreLinks) return "Додано посилання";
              if (editRequest.toLowerCase().includes('анкор') || editRequest.toLowerCase().includes('anchor')) return "Додано анкори/посилання";
              return "Оновлено контент";
            })();

            return {
              ...a,
              articleBodyHtml: finalHtml,
              fullArticleText: finalHtml, // Also update fullArticleText for compatibility
              editedText: finalHtml, // Also update editedText for getArticleText compatibility
              editHistory: [
                ...editHistory,
                {
                  timestamp: new Date().toISOString(),
                  editRequest: editRequest.trim(),
                  summary: summary,
                }
              ],
            };
          }
          return a;
        });
        console.log("[editArticleWithAI] Article updated:", {
          found: updated.find(a => a.topicTitle === articleId),
          newBodyHtmlLength: updated.find(a => a.topicTitle === articleId)?.articleBodyHtml?.length || 0,
          editHistoryLength: updated.find(a => a.topicTitle === articleId)?.editHistory?.length || 0,
        });
        return updated;
      });

      // Force re-render by updating viewingArticle state
      const currentViewing = viewingArticle;
      if (currentViewing === articleId) {
        setViewingArticle(null);
        setTimeout(() => {
          setViewingArticle(articleId);
        }, 100);
      }

      setEditingArticleStatus(null);
        setNotification({
          message: "Article successfully edited",
          time: new Date().toLocaleTimeString(),
          visible: true,
        });

      // Play success sound after editing
      playSuccessSound();

      // Clear edit request but keep modal open to show updated article
      setEditRequest("");
      setEditingArticleId(null);
    } catch (error) {
      console.error("[editArticleWithAI] Error:", error);
      setEditingArticleStatus(null);
      setNotification({
          message: error instanceof Error ? error.message : "Error editing article",
        time: new Date().toLocaleTimeString(),
        visible: true,
      });
    } finally {
      setIsProcessingEdit(false);
      setEditingArticleId(null);
    }
  };

  // Handle reference image upload and style analysis
  const handleReferenceImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setNotification({
        message: "Please upload an image file",
        time: new Date().toLocaleTimeString(),
        visible: true,
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setNotification({
        message: "Image file is too large. Please use an image under 10MB",
        time: new Date().toLocaleTimeString(),
        visible: true,
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      if (!base64Data) return;

      // Store image for preview and persist it
      setReferenceImage(base64Data);
      // Also save to persisted state immediately
      setPersistedState(prev => ({
        ...prev,
        referenceImageBase64: base64Data,
      }));

      // Analyze style using Vision API
      setIsAnalyzingStyle(true);
      try {
        // Extract base64 without data URL prefix for API
        const base64Only = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        const response = await fetch("/api/analyze-image-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64Only }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to analyze image style");
        }

        const data = await response.json() as { success: boolean; styleDescription?: string; error?: string };

        if (data.success && data.styleDescription) {
          // Update customStyle field with analyzed style
          console.log("[handleReferenceImageUpload] Received style description, length:", data.styleDescription.length);
          updateBrief({ customStyle: data.styleDescription });
          
          // Verify the update after a brief delay
          setTimeout(() => {
            const currentMode = persistedState.mode;
            const currentBrief = currentMode === "discovery" 
              ? (persistedState.discoveryProjectBasics || persistedState.projectBasics || defaultBrief)
              : (persistedState.directProjectBasics || persistedState.projectBasics || defaultBrief);
            console.log("[handleReferenceImageUpload] After updateBrief, currentBrief.customStyle length:", currentBrief.customStyle?.length || 0);
          }, 200);
          
          setNotification({
            message: "Image style analyzed and applied successfully!",
            time: new Date().toLocaleTimeString(),
            visible: true,
          });
        } else {
          throw new Error(data.error || "Failed to analyze image style");
        }
      } catch (error) {
        console.error("Style analysis error:", error);
        const errorMessage = (error as Error).message || "Failed to analyze image style. Please try again.";
        setNotification({
          message: errorMessage,
          time: new Date().toLocaleTimeString(),
          visible: true,
        });
      } finally {
        setIsAnalyzingStyle(false);
      }
    };

    reader.onerror = () => {
      setNotification({
        message: "Failed to read image file",
        time: new Date().toLocaleTimeString(),
        visible: true,
      });
      setIsAnalyzingStyle(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear from persisted state
    setPersistedState(prev => ({
      ...prev,
      referenceImageBase64: undefined,
    }));
    // Optionally clear customStyle when removing image
    // updateBrief({ customStyle: "" });
  };

  // Play success sound function (reusable)
  const playSuccessSound = () => {
    try {
      // Create a pleasant, soft success sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Use lower octave for softer sound (C4, E4, G4 instead of C5, E5, G5)
      const frequencies = [261.63, 329.63, 392.00]; // C4, E4, G4 - more mellow
      const duration = 0.6; // Longer duration for smoother fade
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Use sine wave for the softest sound
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;

        // Very soft volume with smooth envelope
        const startTime = audioContext.currentTime + index * 0.08;
        const attackTime = 0.05; // Slow attack
        const sustainTime = 0.2;
        const releaseTime = 0.35; // Long, smooth release
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.08, startTime + attackTime); // Very quiet (0.08 instead of 0.15)
        gainNode.gain.setValueAtTime(0.08, startTime + attackTime + sustainTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + sustainTime + releaseTime);

        oscillator.start(startTime);
        oscillator.stop(startTime + attackTime + sustainTime + releaseTime);
      });
    } catch (error) {
      // Silently fail if audio is not supported or user hasn't interacted
      console.debug("Audio playback not available:", error);
    }
  };

  // Generate hero image for an article
  const generateArticleImage = async (topicId: string) => {
    const article = generatedArticles.find(a => a.topicTitle === topicId);
    
    if (!article) {
      console.error("[generateArticleImage] Article not found", { topicId, generatedArticles: generatedArticles.map(a => a.topicTitle) });
      return;
    }
    
    // For discovery mode, we need topicsData
    // For direct mode, we can work without it
    const topic = mode === "discovery" ? topicsData?.topics.find(t => t.id === topicId) : undefined;
    
    if (mode === "discovery" && !topic) {
      console.error("[generateArticleImage] Topic not found in discovery mode", { topicId, mode });
      return;
    }

    // Get used box indices for this article (empty Set for first generation)
    const usedBoxIndices = articleUsedBoxIndices.get(topicId) ?? new Set<number>();

    setIsGeneratingImage(prev => new Set(prev).add(topicId));
    setImageLoaderMessages(prev => {
      const next = new Map(prev);
      if (!next.has(topicId)) {
        next.set(topicId, 0);
      }
      return next;
    });

    // Auto-scroll to the image loader
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Find the article card with this topicId
        const articleCard = document.querySelector(`[data-article-id="${topicId}"]`) as HTMLElement;
        
        if (articleCard) {
          // Check if image loader is visible
          const imageLoader = articleCard.querySelector('.image-generating-local');
          if (imageLoader) {
            // Scroll to the article card, positioning the loader in view
            articleCard.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          } else {
            // If loader not found yet, scroll to card anyway
            articleCard.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          }
        } else if (generatedArticlesSectionRef.current) {
          // Fallback to articles section
          generatedArticlesSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 300); // Delay to ensure DOM is fully updated
    });

    try {
      // Collect data for image generation
      // CRITICAL: Use the correct brief based on current mode - NO fallback to projectBasics to avoid mixing modes
      const currentMode = persistedState.mode; // Get mode directly from persistedState to ensure accuracy
      const currentBrief = currentMode === "discovery" 
        ? (persistedState.discoveryProjectBasics || defaultBrief)
        : (persistedState.directProjectBasics || defaultBrief);
      
      const articleTitle = getArticleTitle(article, topic);
      const niche = currentBrief.niche || "";
      const mainPlatform = currentBrief.platform || "Multi-platform";
      const contentPurpose = currentBrief.contentPurpose || "Guest post / outreach";
      // Extract brand name from clientSite if available, otherwise use default
      const brandName = currentBrief.clientSite 
        ? currentBrief.clientSite.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "") || "PromosoundGroup"
        : "PromosoundGroup";

      console.log("[generateArticleImage] Data collected", { 
        mode: currentMode,
        articleTitle, 
        niche, 
        mainPlatform, 
        contentPurpose, 
        brandName,
        articleTitleTag: article.titleTag,
        articleTopicTitle: article.topicTitle,
        directArticleTopic,
        discoveryProjectBasics: persistedState.discoveryProjectBasics,
        directProjectBasics: persistedState.directProjectBasics,
        currentBrief: {
          niche: currentBrief.niche,
          platform: currentBrief.platform,
          contentPurpose: currentBrief.contentPurpose,
          clientSite: currentBrief.clientSite
        },
        article: {
          titleTag: article.titleTag,
          topicTitle: article.topicTitle,
          status: article.status
        }
      });

      // Validate all required fields before sending request
      if (!articleTitle || !niche || !mainPlatform || !contentPurpose || !brandName) {
        const errorMsg = `Missing required fields for image generation: articleTitle=${!!articleTitle}, niche=${!!niche}, mainPlatform=${!!mainPlatform}, contentPurpose=${!!contentPurpose}, brandName=${!!brandName}`;
        console.error("[generateArticleImage]", errorMsg, {
          articleTitle,
          niche,
          mainPlatform,
          contentPurpose,
          brandName,
          currentBrief,
          mode
        });
        throw new Error(errorMsg);
      }

      const response = await fetch("/api/article-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleTitle,
          niche,
          mainPlatform,
          contentPurpose,
          brandName,
          customStyle: currentBrief.customStyle || undefined,
          usedBoxIndices: Array.from(usedBoxIndices),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate image");
      }

      const data = await response.json() as { success: boolean; imageBase64?: string; selectedBoxIndex?: number; error?: string };

      if (data.success && data.imageBase64) {
        setArticleImages(prev => {
          const next = new Map(prev);
          next.set(topicId, data.imageBase64!);
          // Note: Not persisting to localStorage to avoid quota issues
          // Images are stored in component state only and can be regenerated
          return next;
        });
        
        // Update used box indices after successful generation
        if (data.selectedBoxIndex !== undefined) {
          setArticleUsedBoxIndices(prev => {
            const next = new Map(prev);
            const currentUsed = next.get(topicId) ?? new Set<number>();
            
            // Check if the returned index is already in the set
            // This means the backend reset the cycle (all boxes were used)
            // In this case, we should also reset on frontend
            if (currentUsed.has(data.selectedBoxIndex!)) {
              // Cycle reset - start fresh with just this index
              next.set(topicId, new Set([data.selectedBoxIndex!]));
            } else {
              // Normal case - add the new index
              const updatedUsed = new Set(currentUsed);
              updatedUsed.add(data.selectedBoxIndex!);
              next.set(topicId, updatedUsed);
            }
            
            return next;
          });
        }
        
        // Play success sound after image generation (including regeneration)
        playSuccessSound();
      } else {
        throw new Error(data.error || "Image generation failed");
      }
    } catch (error) {
      console.error("Image generation error:", error);
      const errorMessage = (error as Error).message || "Failed to generate image. Please try again.";
      setNotification({
        message: errorMessage,
        time: "",
        visible: true,
      });
      setTimeout(() => setNotification(prev => prev ? { ...prev, visible: false } : null), 6000);
    } finally {
      setIsGeneratingImage(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  // Helper to create slug from title
  const createSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);
  };

  const copyDraft = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:124',message:'copyDraft called',data:{hasDraft:!!draft,draftLength:draft.length},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'state-preserved'})}).catch(()=>{});
    // #endregion
    if (!draft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:131',message:'copyDraft success',data:{status:'copied'},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'state-preserved'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:134',message:'copyDraft error',data:{error:(error as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'state-preserved'})}).catch(()=>{});
      // #endregion
      console.error(error);
      alert("Copy failed. Please copy the draft manually.");
    }
  };

  const isLoading = (step: Exclude<LoadingStep, null>) =>
    loadingStep === step;

  // Close image preview modal on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewingImage) {
        setViewingImage(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [viewingImage]);

  // Track start times for image loaders
  useEffect(() => {
    setImageLoaderStartTimes(prev => {
      const next = new Map(prev);
      isGeneratingImage.forEach(topicId => {
        if (!next.has(topicId)) {
          next.set(topicId, Date.now());
        }
      });
      // Remove finished loaders
      prev.forEach((_, topicId) => {
        if (!isGeneratingImage.has(topicId)) {
          next.delete(topicId);
        }
      });
      return next;
    });
  }, [isGeneratingImage]);

  // Update elapsed time for image loaders every second
  useEffect(() => {
    if (imageLoaderStartTimes.size === 0) return;

    const timerInterval = setInterval(() => {
      setImageLoaderElapsed(prev => {
        const next = new Map(prev);
        imageLoaderStartTimes.forEach((startTime, topicId) => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          next.set(topicId, elapsed);
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [imageLoaderStartTimes]);

  // Rotate image loader messages asynchronously for each loader
  useEffect(() => {
    if (isGeneratingImage.size === 0) return;

    const intervals: Map<string, NodeJS.Timeout> = new Map();
    const timeouts: Map<string, NodeJS.Timeout> = new Map();

    // Create independent interval for each generating image
    isGeneratingImage.forEach(topicId => {
      // Random initial delay (0-2000ms) to desynchronize loaders
      const initialDelay = Math.random() * 2000;
      
      const timeout = setTimeout(() => {
        // First update after initial delay
        setImageLoaderMessages(prev => {
          const next = new Map(prev);
          const currentIndex = next.get(topicId) || 0;
          next.set(topicId, (currentIndex + 1) % 7);
          return next;
        });

        // Then set up regular interval for this specific loader
        const interval = setInterval(() => {
          setImageLoaderMessages(prev => {
            const next = new Map(prev);
            const currentIndex = next.get(topicId) || 0;
            next.set(topicId, (currentIndex + 1) % 7); // 7 messages in imageMessages array
            return next;
          });
        }, 3500); // Rotate every 3.5 seconds

        intervals.set(topicId, interval);
      }, initialDelay);

      timeouts.set(topicId, timeout);
    });

    return () => {
      // Clean up all intervals and timeouts
      intervals.forEach(interval => clearInterval(interval));
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isGeneratingImage]);

  // Track start times for article loaders
  useEffect(() => {
    const generatingArticles = generatedArticles.filter(a => a.status === "generating");
    const generatingTopicIds = new Set(generatingArticles.map(a => a.topicTitle));
    
    setArticleLoaderStartTimes(prev => {
      const next = new Map(prev);
      generatingTopicIds.forEach(topicId => {
        if (!next.has(topicId)) {
          next.set(topicId, Date.now());
        }
      });
      // Remove finished loaders
      prev.forEach((_, topicId) => {
        if (!generatingTopicIds.has(topicId)) {
          next.delete(topicId);
        }
      });
      return next;
    });
  }, [generatedArticles]);

  // Update elapsed time for article loaders every second
  useEffect(() => {
    if (articleLoaderStartTimes.size === 0) return;

    const timerInterval = setInterval(() => {
      setArticleLoaderElapsed(prev => {
        const next = new Map(prev);
        articleLoaderStartTimes.forEach((startTime, topicId) => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          next.set(topicId, elapsed);
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [articleLoaderStartTimes]);

  // Update elapsed time for topic loader every second
  useEffect(() => {
    if (!topicLoaderStartTime) {
      setTopicLoaderElapsed(0);
      return;
    }

    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - topicLoaderStartTime) / 1000);
      setTopicLoaderElapsed(elapsed);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [topicLoaderStartTime]);

  // Rotate topic loader messages
  useEffect(() => {
    if (!isGeneratingTopics) {
      setTopicLoaderMessageIndex(0);
      return;
    }

    // Random initial delay (0-2000ms)
    const initialDelay = Math.random() * 2000;
    
    let interval: NodeJS.Timeout | null = null;
    
    const timeout = setTimeout(() => {
      // First update after initial delay
      setTopicLoaderMessageIndex(prev => (prev + 1) % 8);

      // Then set up regular interval
      interval = setInterval(() => {
        setTopicLoaderMessageIndex(prev => (prev + 1) % 8); // 8 messages in topicsMessages array
      }, 3500); // Rotate every 3.5 seconds
    }, initialDelay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingTopics]);

  // Rotate article loader messages asynchronously for each loader
  useEffect(() => {
    const generatingArticles = generatedArticles.filter(a => a.status === "generating");
    if (generatingArticles.length === 0) return;

    const intervals: Map<string, NodeJS.Timeout> = new Map();
    const timeouts: Map<string, NodeJS.Timeout> = new Map();

    // Create independent interval for each generating article
    generatingArticles.forEach(article => {
      const topicId = article.topicTitle;
      
      // Random initial delay (0-2000ms) to desynchronize loaders
      const initialDelay = Math.random() * 2000;
      
      const timeout = setTimeout(() => {
        // First update after initial delay
        setArticleLoaderMessages(prev => {
          const next = new Map(prev);
          const currentIndex = next.get(topicId) || 0;
          next.set(topicId, (currentIndex + 1) % 8);
          return next;
        });

        // Then set up regular interval for this specific loader
        const interval = setInterval(() => {
          setArticleLoaderMessages(prev => {
            const next = new Map(prev);
            const currentIndex = next.get(topicId) || 0;
            next.set(topicId, (currentIndex + 1) % 8); // 8 messages in articleMessages array
            return next;
          });
        }, 3500); // Rotate every 3.5 seconds

        intervals.set(topicId, interval);
      }, initialDelay);

      timeouts.set(topicId, timeout);
    });

    return () => {
      // Clean up all intervals and timeouts
      intervals.forEach(interval => clearInterval(interval));
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [generatedArticles]);

  
  // Update theme ref when theme changes (separate effect to avoid triggering sound effect)
  useEffect(() => {
    prevThemeRef.current = theme;
  }, [theme]);
  
  // Update mode ref when mode changes (separate effect to avoid triggering sound effect)
  useEffect(() => {
    prevModeRef.current = mode;
  }, [mode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".download-dropdown-wrapper")) {
        document.querySelectorAll(".download-dropdown.show").forEach(dropdown => {
          dropdown.classList.remove("show");
        });
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    const handleModalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains("article-view-modal")) {
        setViewingArticle(null);
        setEditRequest("");
        setEditingArticleId(null);
      }
    };

    if (viewingArticle) {
      document.addEventListener("click", handleModalClick);
      return () => document.removeEventListener("click", handleModalClick);
    }
  }, [viewingArticle]);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:145',message:'Component mounted - state verification',data:{briefFields:Object.keys(brief),topicsCount:topicsData?.topics.length || 0,selectedTopicsCount:selectedTopicIds.length,mode},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'state-preserved'})}).catch(()=>{});
  }, [brief, topicsData, selectedTopicIds, mode]);
  // #endregion

  // Fetch cost data periodically
  useEffect(() => {
    const fetchCosts = async () => {
      try {
        const response = await fetch('/api/cost-tracker', {
          cache: 'no-store', // Ensure fresh data
        });
        if (response.ok) {
          const data = await response.json();
          console.log('[cost-tracker] Response data:', data);
          if (data.success && data.totals) {
            console.log('[cost-tracker] Setting cost data:', data.totals);
            console.log('[cost-tracker] Tokens:', data.tokens);
            console.log('[cost-tracker] Formatted values:', data.totals.formatted);
            setCostData(prev => {
              // Always use current humanizeWordsUsed from ref (always up-to-date)
              const currentHumanizeWords = humanizeWordsUsedRef.current;
              const currentHumanize = currentHumanizeWords * HUMANIZE_COST_PER_WORD;
              const currentHumanizeFormatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              }).format(currentHumanize);
              
              // Calculate new total with preserved humanize cost
              const baseCost = (data.totals.tavily || 0) + (data.totals.openai || 0);
              const newTotal = baseCost + currentHumanize;
              const totalFormatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              }).format(newTotal);
              
              return {
                ...data.totals,
                humanize: currentHumanize,
                total: newTotal,
                formatted: {
                  ...data.totals.formatted,
                  humanize: currentHumanizeFormatted,
                  total: totalFormatted,
                },
                tokens: data.tokens,
                humanizeWords: currentHumanizeWords,
              };
            });
          } else {
            console.warn('[cost-tracker] Invalid response structure:', data);
          }
        } else {
          const errorText = await response.text();
          console.error('[cost-tracker] Response not OK:', response.status, response.statusText, errorText);
        }
      } catch (error) {
        console.error('[cost-tracker] Failed to fetch costs:', error);
      }
    };

    // Fetch immediately
    fetchCosts();

    // Then fetch every 2 seconds
    const interval = setInterval(fetchCosts, 2000);

    return () => clearInterval(interval);
  }, []);

  // Update costData with humanization costs whenever humanizeWordsUsed changes
  useEffect(() => {
    // Always recalculate humanize costs when words change
    const humanizeCost = humanizeWordsUsed * HUMANIZE_COST_PER_WORD;
    const humanizeFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(humanizeCost);
    
    setCostData(prev => {
      // If costData is not initialized yet, initialize it with humanize costs
      if (!prev) {
        const baseCost = 0;
        const newTotal = baseCost + humanizeCost;
        const totalFormatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }).format(newTotal);
        
        return {
          tavily: 0,
          openai: 0,
          humanize: humanizeCost,
          total: newTotal,
          formatted: {
            tavily: '$0.0000',
            openai: '$0.0000',
            humanize: humanizeFormatted,
            total: totalFormatted,
          },
          humanizeWords: humanizeWordsUsed,
        };
      }
      
      // Only update if humanizeWords or cost actually changed
      if (prev.humanizeWords === humanizeWordsUsed && Math.abs((prev.humanize || 0) - humanizeCost) < 0.0001) {
        return prev;
      }
      
      // Get base costs from API (tavily + openai)
      const baseCost = (prev.tavily || 0) + (prev.openai || 0);
      const newTotal = baseCost + humanizeCost;
      const totalFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(newTotal);
      
      console.log('[cost-tracker] Updating humanize costs:', {
        humanizeWordsUsed,
        humanizeCost,
        humanizeFormatted,
        newTotal,
        totalFormatted
      });
      
      return {
        ...prev,
        humanize: humanizeCost,
        total: newTotal,
        formatted: {
          ...prev.formatted,
          humanize: humanizeFormatted,
          total: totalFormatted,
        },
        humanizeWords: humanizeWordsUsed,
      };
    });
  }, [humanizeWordsUsed, costData]);

  // Prevent hydration mismatch by not rendering until hydrated
  if (!isHydrated) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${isGeneratingTopics ? "loading-active" : ""}`}>
      {/* Loading Overlays - topics now uses local loader in Step 1 */}
      {/* {isGeneratingTopics && <LoadingOverlay isOpen={isGeneratingTopics} mode="topics" />} */}
      
      {/* Image Preview Modal */}
      {viewingImage && articleImages.has(viewingImage) && (
        <div className="image-preview-modal" onClick={() => setViewingImage(null)}>
          <div className="image-preview-backdrop"></div>
          <div className="image-preview-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="image-preview-close"
              onClick={() => setViewingImage(null)}
              aria-label="Close preview"
            >
              ×
            </button>
            <img
              src={`data:image/png;base64,${articleImages.get(viewingImage)}`}
              alt="Hero image preview"
              className="image-preview-full"
            />
          </div>
        </div>
      )}
      
      <header className="page-header">
        <div className="eyebrow">
          <a 
            href="https://www.typereach.app/" 
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
            style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}
          >
            typereach.app
          </a>
        </div>
        <h1>Universal Content Creator</h1>
        <p className="page-subtitle">Plan and draft outreach content in one place</p>
        
        {/* Header Controls: Cost Tracker + Theme Toggle */}
        <div className="header-controls">
          {/* Cost Tracker Component - Usage Statistics Display
              This component displays:
              - Tavily API usage (queries count)
              - OpenAI API usage (tokens count)
              - AIHumanize usage (words used)
              - Total cost calculation
          */}
          <div className="cost-display">
            <div className="cost-item">
              <span className="cost-label">Tavily:</span>
              <span className="cost-value">
                {costData?.tokens?.formatted?.tavily || '0 queries'}
              </span>
            </div>
            <div className="cost-divider"></div>
            <div className="cost-item">
              <span className="cost-label">OpenAI:</span>
              <span className="cost-value">
                {costData?.tokens?.formatted?.openai || '0 tokens'}
              </span>
            </div>
            <div className="cost-divider"></div>
            <div className="cost-item">
              <span className="cost-label">Humanize:</span>
              <span className="cost-value">
                {(humanizeWordsUsed || costData?.humanizeWords || 0).toLocaleString()} words ({costData?.formatted?.humanize || '$0.0000'})
              </span>
            </div>
            <div className="cost-divider"></div>
            <div className="cost-item">
              <span className="cost-label">Total:</span>
              <span className="cost-value cost-total">
                {costData?.formatted?.total || '$0.0000'}
              </span>
            </div>
          </div>
          <div className="theme-switch-container">
            <button
              type="button"
              className={`theme-toggle ${theme === "dark" ? "dark-active" : ""}`}
              onClick={() => updateTheme(theme === "light" ? "dark" : "light")}
              title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              <div className="theme-toggle-track">
                <div className="theme-toggle-thumb">
                  {theme === "light" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="M12 1v3M12 20v3M23 12h-3M4 12H1M19.07 4.93l-2.12 2.12M6.05 17.95l-2.12 2.12M19.07 19.07l-2.12-2.12M6.05 6.05l-2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="content">
          {/* Mode Switch */}
          <div className="mode-switch">
            <button
              type="button"
              className={`mode-tab ${mode === "discovery" ? "active" : ""}`}
              onClick={() => updateMode("discovery")}
            >
              <span className="mode-tab-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 14L11.1067 11.1067" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="mode-tab-text">Topic Discovery Mode</span>
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === "direct" ? "active" : ""}`}
              onClick={() => updateMode("direct")}
            >
              <span className="mode-tab-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.4713 14.1953C10.3463 14.3203 10.1768 14.3905 9.99998 14.3905C9.8232 14.3905 9.65367 14.3203 9.52865 14.1953L8.47131 13.138C8.34633 13.013 8.27612 12.8435 8.27612 12.6667C8.27612 12.4899 8.34633 12.3204 8.47131 12.1953L12.1953 8.47134C12.3203 8.34636 12.4899 8.27615 12.6666 8.27615C12.8434 8.27615 13.013 8.34636 13.138 8.47134L14.1953 9.52868C14.3203 9.6537 14.3905 9.82324 14.3905 10C14.3905 10.1768 14.3203 10.3463 14.1953 10.4713L10.4713 14.1953Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M11.9999 8.66668L11.0833 4.08401C11.0583 3.95933 10.9983 3.84438 10.9101 3.75272C10.822 3.66106 10.7095 3.59651 10.5859 3.56668L2.15659 1.35201C2.04554 1.32517 1.92946 1.32731 1.81947 1.35823C1.70949 1.38915 1.6093 1.44782 1.52851 1.52861C1.44773 1.60939 1.38906 1.70958 1.35814 1.81956C1.32721 1.92955 1.32507 2.04563 1.35192 2.15668L3.56659 10.586C3.59642 10.7096 3.66097 10.8221 3.75263 10.9102C3.84429 10.9983 3.95924 11.0584 4.08392 11.0833L8.66659 12" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1.5332 1.53333L6.39054 6.39066" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7.33333 8.66667C8.06971 8.66667 8.66667 8.06971 8.66667 7.33333C8.66667 6.59695 8.06971 6 7.33333 6C6.59695 6 6 6.59695 6 7.33333C6 8.06971 6.59695 8.66667 7.33333 8.66667Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="mode-tab-text">Direct Article Creation</span>
            </button>
          </div>

          {/* Main Card with Two Columns */}
          <div className="main-card">
          <div className="two-column-layout">
            {/* Left Column: Project Basics */}
            <div className="left-column">
              <h2 className="column-title">Project basics</h2>
              
              <div className="form-fields">
            <label>
              <span>Main niche or theme</span>
              <input
                type="text"
                value={brief.niche}
                onChange={handleBriefChange("niche")}
                placeholder="e.g. Music industry, IT, Med tech, Casino, VPN, HR, or your custom niche"
              />
              <small>Describe the main topic or industry focus</small>
              
              {/* Niche Preset Chips */}
              <div className="niche-presets">
                {[
                  "Music industry",
                  "IT",
                  "Med tech",
                  "Mil tech",
                  "Casino",
                  "Gambling",
                  "Astrology",
                  "VPN",
                  "HR"
                ].map((preset) => (
                  <TagPill
                    key={preset}
                    label={preset}
                    selected={brief.niche === preset}
                    onClick={() => updateBrief({ niche: preset })}
                  />
                ))}
              </div>
            </label>

            <label>
              <span>Client site URL</span>
              <input
                type="text"
                value={brief.clientSite}
                onChange={handleBriefChange("clientSite")}
                placeholder="https://client-site.com"
              />
            </label>

            <label>
              <span>Language</span>
              <select
                value={
                  brief.language && !["English", "German", "Spanish", "Portuguese", "French", "Italian", "Polish", "Ukrainian"].includes(brief.language)
                    ? "Other (custom)"
                    : (brief.language || "English")
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "Other (custom)") {
                    // Show custom input field, keep current language value if it's custom
                    const currentCustom = brief.language && !["English", "German", "Spanish", "Portuguese", "French", "Italian", "Polish", "Ukrainian"].includes(brief.language)
                      ? brief.language
                      : "";
                    updateBrief({ 
                      language: currentCustom
                    });
                  } else {
                    // Standard language selected - always save it
                    updateBrief({ 
                      language: value
                    });
                  }
                }}
              >
                <option value="English">English</option>
                <option value="German">German</option>
                <option value="Spanish">Spanish</option>
                <option value="Portuguese">Portuguese</option>
                <option value="French">French</option>
                <option value="Italian">Italian</option>
                <option value="Polish">Polish</option>
                <option value="Ukrainian">Ukrainian</option>
                <option value="Other (custom)">Other (custom)</option>
              </select>
              {brief.language && !["English", "German", "Spanish", "Portuguese", "French", "Italian", "Polish", "Ukrainian"].includes(brief.language) && (
                <input
                  type="text"
                  value={brief.language}
                  onChange={(e) => {
                    const customValue = e.target.value;
                    updateBrief({ 
                      language: customValue // Store custom value directly in language field
                    });
                  }}
                  placeholder="Enter custom language"
                  style={{ marginTop: "8px" }}
                />
              )}
              <small>Select the language for article generation</small>
            </label>

            <label>
              <span>Main platform focus</span>
              <input
                type="text"
                value={brief.platform || ""}
                onChange={handleBriefChange("platform")}
                placeholder="e.g. Multi-platform, Spotify, YouTube, TikTok, Instagram, SoundCloud, Beatport, or any custom query"
              />
              <small>Select a preset or enter a custom platform/query. This value will be used to search for relevant topics via Tavily browsing.</small>
              
              {/* Platform Preset Chips */}
              <div className="niche-presets">
                {[
                  "Multi-platform",
                  "Spotify",
                  "YouTube",
                  "TikTok",
                  "Instagram",
                  "SoundCloud",
                  "Beatport",
                  "Deezer",
                  "Tidal",
                  "Music industry"
                ].map((preset) => (
                  <TagPill
                    key={preset}
                    label={preset}
                    selected={brief.platform === preset}
                    onClick={() => updateBrief({ platform: preset })}
                  />
                ))}
              </div>
            </label>

            <label>
                  <span>Content purpose</span>
                  <select
                    value={brief.contentPurpose || ""}
                    onChange={handleBriefChange("contentPurpose")}
                  >
                    <option value="">Select a purpose</option>
                    <option value="Guest post / outreach">Guest post / outreach</option>
                    <option value="Blog">Blog</option>
                    <option value="Educational guide">Educational guide</option>
                    <option value="Partner blog">Partner blog</option>
                    <option value="News Hook">News Hook</option>
                    <option value="Other">Other</option>
                  </select>
                  <small>This helps the engine tune tone and depth.</small>
            </label>


            <label>
                  <span>Word count</span>
              <input
                type="number"
                min={0}
                value={brief.wordCount}
                onChange={handleBriefChange("wordCount")}
                placeholder="1200"
              />
            </label>

          </div>

              {/* Branded link details */}
              <div className="info-block">
                <h3>Branded link details</h3>
                <label>
                  <span>Anchor text</span>
                  <input
                    type="text"
                    value={brief.anchorText || ""}
                    onChange={handleBriefChange("anchorText")}
                    placeholder="Enter anchor text"
                  />
                </label>
                <label>
                  <span>URL</span>
                  <input
                    type="text"
                    value={brief.anchorUrl || ""}
                    onChange={handleBriefChange("anchorUrl")}
                    placeholder="https://example.com"
                  />
                </label>
              </div>
            </div>

            {/* Right Column: Steps */}
            <div className="right-column">
              {/* Step 1 - Topics (Discovery) or Article Topic (Direct) */}
              <div className="step-card">
                <div className="step-header">
                  <h3>
                    {mode === "discovery" 
                      ? "Step 1 – Generate and approve topics"
                      : "Step 1 – Enter article topic"}
                  </h3>
                  {mode === "discovery" && (
                    <p className="step-description">
                      Tell the engine about your niche and link. It will research the landscape and return clusters of deep, non-generic topics with mini-briefs, so you can approve the best ones for article generation.
                    </p>
                  )}
                  {mode === "direct" && (
                    <p className="step-description">
                      Enter the topic for your article. The engine will research sources and generate a complete article based on your Project Basis settings.
                    </p>
                  )}
                </div>
                
                {mode === "discovery" ? (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={generateTopics}
                      disabled={isLoading("topics")}
                    >
                      {isLoading("topics") ? "Generating…" : "Generate topic ideas"}
                    </button>

                    {/* Topic Generation Loader */}
                    {isGeneratingTopics && (
                      <div className="article-generating-local" style={{ marginTop: "1.5rem" }}>
                        <div className="article-loader-local-container">
                          <h4 className="article-loader-title">Researching outreach ideas…</h4>
                          
                          {/* Equalizer Bars */}
                          <div className="article-equalizer-container">
                            {[1, 2, 3, 4, 5, 6, 7].map((index) => (
                              <div
                                key={index}
                                className="article-equalizer-bar"
                                style={{
                                  animationDelay: `${index * 0.1}s`,
                                }}
                              />
                            ))}
                          </div>

                          {/* Status Messages */}
                          {(() => {
                            const topicsMessages = [
                              "Scanning the landscape for content opportunities…",
                              "Analyzing SERP results and competitor strategies…",
                              "Identifying gaps and non-generic angles…",
                              "Grouping ideas into meaningful clusters…",
                              "Crafting briefs that balance SEO and reader value…",
                              "Ensuring anchor integration feels natural…",
                              "Filtering out low-quality and generic topics…",
                              "Preparing deep, link-worthy topic proposals…",
                            ];
                            const currentMessage = topicsMessages[topicLoaderMessageIndex % topicsMessages.length];
                            
                            return (
                              <div className="article-loader-messages">
                                <p className="article-loader-message">{currentMessage}</p>
                              </div>
                            );
                          })()}

                          {/* Timer */}
                          {(() => {
                            const formatTime = (seconds: number): string => {
                              const mins = Math.floor(seconds / 60);
                              const secs = seconds % 60;
                              return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                            };
                            
                            return (
                              <div className="article-loader-timer">
                                <span className="article-loader-timer-icon">⏱</span>
                                <span className="article-loader-timer-text">Elapsed: {formatTime(topicLoaderElapsed)}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                  </>
                ) : (
                  <>
                    <div className="form-fields">
                      <label>
                        <span>Article Topic</span>
                        <input
                          type="text"
                          value={directArticleTopic}
                          onChange={(e) => updateDirectArticleTopic(e.target.value)}
                          placeholder="Enter the topic for your article"
                        />
                      </label>
                    </div>
                    
                    <div className="form-fields" style={{ marginTop: "1.25rem" }}>
                      <label>
                        <span>Article brief / instructions <span style={{ fontWeight: "normal", fontSize: "0.875rem", color: "#666" }}>(optional)</span></span>
                        <textarea
                          value={directArticleBrief}
                          onChange={(e) => updateDirectArticleBrief(e.target.value)}
                          placeholder="Describe what you want in this article: type (list/guide), regions, number of items, angle, required subheadings, keywords, what to avoid, etc."
                          rows={5}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            fontSize: "0.9375rem",
                            fontFamily: "inherit",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            resize: "vertical",
                          }}
                        />
                        <span style={{ display: "block", marginTop: "0.5rem", fontSize: "0.8125rem", color: "#666" }}>
                          If you fill this in, the AI will treat it as a high-priority brief and follow your structure and constraints where possible.
                        </span>
                      </label>
                    </div>
                    
                    {/* Humanize Settings */}
                    <div className="humanize-on-write-toggle" style={{ marginTop: "1.25rem" }}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={humanizeOnWriteEnabled}
                          onChange={(e) => {
                            setPersistedState(prev => ({
                              ...prev,
                              humanizeOnWriteEnabled: e.target.checked
                            }));
                          }}
                          disabled={isGeneratingArticles}
                        />
                        <span className="checkbox-text">
                          <strong>Humanize on write</strong> (recommended)
                          <span className="checkbox-hint">Passes article sections through AIHumanize during generation</span>
                        </span>
                      </label>
                    </div>
                    
                    {/* Expanded Humanize Settings */}
                    {humanizeOnWriteEnabled && (
                      <div className="humanize-settings-expanded" style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="humanize-settings-toggle-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedHumanizeTopicId(expandedHumanizeTopicId === "direct" ? null : "direct");
                          }}
                          style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", fontSize: "0.9rem" }}
                        >
                          {expandedHumanizeTopicId === "direct" ? "Hide settings" : "Show settings"}
                          <span className={`toggle-icon ${expandedHumanizeTopicId === "direct" ? "expanded" : ""}`} style={{ marginLeft: "0.5rem" }}>▼</span>
                        </button>
                        
                        {expandedHumanizeTopicId === "direct" && (
                          <div className="humanize-settings-panel" style={{ marginTop: "0.75rem", padding: "1rem", background: "var(--secondary)", borderRadius: "10px" }}>
                            {/* Model Selection */}
                            <div className="humanize-setting-group" style={{ marginBottom: "1rem" }}>
                              <label className="humanize-setting-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>Model Quality</label>
                              <div className="humanize-setting-options" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className={`humanize-option-btn ${humanizeSettings.model === 0 ? "active" : ""}`}
                                  onClick={() => setHumanizeSettings(prev => ({ ...prev, model: 0 }))}
                                  style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.model === 0 ? "var(--primary)" : "var(--card)", color: humanizeSettings.model === 0 ? "white" : "var(--foreground)", cursor: "pointer" }}
                                >
                                  Quality
                                </button>
                                <button
                                  type="button"
                                  className={`humanize-option-btn ${humanizeSettings.model === 1 ? "active" : ""}`}
                                  onClick={() => setHumanizeSettings(prev => ({ ...prev, model: 1 }))}
                                  style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.model === 1 ? "var(--primary)" : "var(--card)", color: humanizeSettings.model === 1 ? "white" : "var(--foreground)", cursor: "pointer" }}
                                >
                                  Balance
                                </button>
                                <button
                                  type="button"
                                  className={`humanize-option-btn ${humanizeSettings.model === 2 ? "active" : ""}`}
                                  onClick={() => setHumanizeSettings(prev => ({ ...prev, model: 2 }))}
                                  style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.model === 2 ? "var(--primary)" : "var(--card)", color: humanizeSettings.model === 2 ? "white" : "var(--foreground)", cursor: "pointer" }}
                                >
                                  Enhanced
                                </button>
                              </div>
                            </div>
                            
                            {/* Style Selection */}
                            <div className="humanize-setting-group" style={{ marginBottom: "1rem" }}>
                              <label className="humanize-setting-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>Writing Style</label>
                              <select
                                className="humanize-style-select"
                                value={humanizeSettings.style}
                                onChange={(e) => setHumanizeSettings(prev => ({ ...prev, style: e.target.value }))}
                                style={{ width: "100%", padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: "0.9rem" }}
                              >
                                <option value="General">General</option>
                                <option value="Blog">Blog</option>
                                <option value="Formal">Formal</option>
                                <option value="Informal">Informal</option>
                                <option value="Academic">Academic</option>
                                <option value="Expand">Expand</option>
                                <option value="Simplify">Simplify</option>
                              </select>
                            </div>
                            
                            {/* Mode Selection */}
                            <div className="humanize-setting-group">
                              <label className="humanize-setting-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>Mode</label>
                              <div className="humanize-setting-options" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className={`humanize-option-btn ${humanizeSettings.mode === "Basic" ? "active" : ""}`}
                                  onClick={() => setHumanizeSettings(prev => ({ ...prev, mode: "Basic" }))}
                                  style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.mode === "Basic" ? "var(--primary)" : "var(--card)", color: humanizeSettings.mode === "Basic" ? "white" : "var(--foreground)", cursor: "pointer" }}
                                >
                                  Basic
                                </button>
                                <button
                                  type="button"
                                  className={`humanize-option-btn ${humanizeSettings.mode === "Autopilot" ? "active" : ""}`}
                                  onClick={() => setHumanizeSettings(prev => ({ ...prev, mode: "Autopilot" }))}
                                  style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.mode === "Autopilot" ? "var(--primary)" : "var(--card)", color: humanizeSettings.mode === "Autopilot" ? "white" : "var(--foreground)", cursor: "pointer" }}
                                >
                                  Autopilot
                                </button>
                              </div>
                              <p className="humanize-setting-hint" style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                {humanizeSettings.mode === "Basic" 
                                  ? "Single rewrite per request (70% basic detection bypass)" 
                                  : "Rewrites multiple times until 0% AI (99% all detection bypass)"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: "1.25rem" }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          console.log("[generateDirectArticle] Button clicked", {
                            mode,
                            directArticleTopic,
                            brief: briefWithDefaults,
                            isGeneratingArticles,
                          });
                          generateDirectArticle();
                        }}
                        disabled={isGeneratingArticles || !directArticleTopic?.trim() || !briefWithDefaults?.niche?.trim() || !briefWithDefaults?.language?.trim()}
                        title={
                          isGeneratingArticles 
                            ? "Generating article..." 
                            : !directArticleTopic?.trim() 
                            ? "Please enter article topic"
                            : !briefWithDefaults?.niche?.trim()
                            ? "Please fill in Main niche or theme in Project Basis"
                            : !briefWithDefaults?.language?.trim()
                            ? "Please select Language in Project Basis"
                            : "Generate article"
                        }
                      >
                        {isGeneratingArticles ? "Generating Article…" : "Generate Article"}
                      </button>
                    </div>
                  </>
                )}

                {mode === "discovery" && topicsData && (
                  <div className="topics-results">
                    {/* Overview Card */}
                    {topicsData.overview && (
                      <div className="overview-card">
                        <h4 className="overview-title">Overview</h4>
                        <p className="overview-text">{topicsData.overview}</p>
                      </div>
                    )}

                    {/* Group topics by cluster */}
                    {(() => {
                      const clustersMap = new Map<string, Topic[]>();
                      topicsData.topics.forEach(topic => {
                        if (!clustersMap.has(topic.clusterName)) {
                          clustersMap.set(topic.clusterName, []);
                        }
                        clustersMap.get(topic.clusterName)!.push(topic);
                      });

                      return Array.from(clustersMap.entries()).map(([clusterName, topics], index) => {
                        const isExpanded = expandedClusterNames.has(clusterName);
                        const firstTopic = topics[0];
                        const clusterNumber = index + 1;
                        
                        // Check status for first topic (since we only show first topic in cluster)
                        const hasArticle = firstTopic ? generatedArticles.some(a => a.topicTitle === firstTopic.id && a.status === "ready") : false;
                        const isGenerating = firstTopic ? generatedArticles.some(a => a.topicTitle === firstTopic.id && a.status === "generating") : false;
                        const isCompleted = hasArticle || isGenerating;
                        
                        return (
                          <div key={clusterName} className="topic-collapsible-wrapper">
                            {/* Collapsed Header Card */}
                            <div className="topic-header-card-wrapper">
                              <button
                                type="button"
                                className={`topic-header-card ${isCompleted ? "topic-header-completed" : ""}`}
                                onClick={() => !isCompleted && toggleClusterExpansion(clusterName)}
                                disabled={isCompleted}
                              >
                                <div className="topic-header-content">
                                  <h4 className="topic-cluster-name">
                                    <span className="cluster-number-badge">{clusterNumber}</span>
                                    {clusterName}
                                    {hasArticle && (
                                      <span className="topic-completed-badge-header" title="Article created">
                                        ✓ Article created
                                      </span>
                                    )}
                                    {isGenerating && (
                                      <span className="topic-generating-badge-header" title="Generating article">
                                        ⏳ Generating...
                                      </span>
                                    )}
                                  </h4>
                                  <div className="topic-header-meta">
                                    {firstTopic && (
                                      <span className="topic-for-problem">
                                        For: {firstTopic.forWho} · Problem: {firstTopic.problem}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {!isCompleted && (
                                  <span className="topic-chevron">
                                    {isExpanded ? (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    ) : (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                className="topic-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCluster(clusterName);
                                }}
                                title="Remove cluster"
                                aria-label="Remove cluster"
                              >
                                ×
                              </button>
                            </div>

                            {/* Expanded Topics List - Show only first topic */}
                            {isExpanded && firstTopic && (
                              <div className="topics-in-cluster">
                                {(() => {
                                  const topic = firstTopic;
                                  const isSelected = selectedTopicIds.includes(topic.id);
                                  
                                  const getSearchIntentLabel = (intent: Topic['searchIntent']) => {
                                    switch (intent) {
                                      case 'informational':
                                      case 'strategic':
                                        return 'Informational / Strategic insight';
                                      case 'how_to':
                                        return 'How-to / Strategic guide';
                                      case 'problem_solving':
                                        return 'Problem-solving';
                                      case 'comparison':
                                        return 'Comparison / Decision help';
                                      default:
                                        return intent;
                                    }
                                  };

                                  const hasArticle = generatedArticles.some(a => a.topicTitle === topic.id && a.status === "ready");
                                  const isGenerating = generatedArticles.some(a => a.topicTitle === topic.id && a.status === "generating");
                                  const isCompleted = hasArticle || isGenerating;
                                  
                                  return (
                                    <div key={topic.id} className={`topic-preview-card ${isSelected ? "selected" : ""} ${isCompleted ? "topic-completed" : ""}`}>
                                      {/* Search Intent Pill - placed at the top for quick reference */}
                                      <div className="topic-preview-field" style={{ marginBottom: "0.75rem" }}>
                                        <span className="search-intent-pill-large">
                                          {getSearchIntentLabel(topic.searchIntent)}
                                        </span>
                                      </div>

                                      {/* Title and Actions */}
                                      <div className="topic-preview-header">
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                          <h5 className="topic-preview-title">{topic.workingTitle}</h5>
                                          {hasArticle && (
                                            <span className="topic-completed-badge" title="Article created">
                                              ✓ Article created
                                            </span>
                                          )}
                                          {isGenerating && !hasArticle && (
                                            <span className="topic-generating-badge" title="Generating article">
                                              ⏳ Generating...
                                            </span>
                                          )}
                                        </div>
                                        <div className="topic-preview-actions">
                                          <label className="topic-checkbox-label">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              disabled={isCompleted}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                if (!isCompleted) {
                                                  toggleTopicSelection(topic.id);
                                                }
                                              }}
                                            />
                                            <span>Add to queue</span>
                                          </label>
                                        </div>
                                      </div>

                                      {/* Humanize Settings - appears when topic is selected */}
                                      {isSelected && !isCompleted && (
                                        <div className="topic-humanize-settings" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                                          <div className="humanize-on-write-toggle">
                                            <label className="checkbox-label">
                                              <input
                                                type="checkbox"
                                                checked={humanizeOnWriteEnabled}
                                                onChange={(e) => {
                                                  setPersistedState(prev => ({
                                                    ...prev,
                                                    humanizeOnWriteEnabled: e.target.checked
                                                  }));
                                                }}
                                                disabled={isGeneratingArticles}
                                              />
                                              <span className="checkbox-text">
                                                <strong>Humanize on write</strong> (recommended)
                                                <span className="checkbox-hint">Passes article sections through AIHumanize during generation</span>
                                              </span>
                                            </label>
                                          </div>
                                          
                                          {/* Expanded Humanize Settings */}
                                          {humanizeOnWriteEnabled && (
                                            <div className="humanize-settings-expanded" style={{ marginTop: "0.75rem" }}>
                                              <button
                                                type="button"
                                                className="humanize-settings-toggle-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExpandedHumanizeTopicId(expandedHumanizeTopicId === topic.id ? null : topic.id);
                                                }}
                                              >
                                                {expandedHumanizeTopicId === topic.id ? "Hide settings" : "Show settings"}
                                                <span className={`toggle-icon ${expandedHumanizeTopicId === topic.id ? "expanded" : ""}`}>▼</span>
                                              </button>
                                              
                                              {expandedHumanizeTopicId === topic.id && (
                                                <div className="humanize-settings-panel" style={{ marginTop: "0.75rem", padding: "1rem", background: "var(--secondary)", borderRadius: "10px" }}>
                                                  {/* Model Selection */}
                                                  <div className="humanize-setting-group" style={{ marginBottom: "1rem" }}>
                                                    <label className="humanize-setting-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>Model Quality</label>
                                                    <div className="humanize-setting-options" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                      <button
                                                        type="button"
                                                        className={`humanize-option-btn ${humanizeSettings.model === 0 ? "active" : ""}`}
                                                        onClick={() => setHumanizeSettings(prev => ({ ...prev, model: 0 }))}
                                                        style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.model === 0 ? "var(--primary)" : "var(--card)", color: humanizeSettings.model === 0 ? "white" : "var(--foreground)", cursor: "pointer" }}
                                                      >
                                                        Quality
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className={`humanize-option-btn ${humanizeSettings.model === 1 ? "active" : ""}`}
                                                        onClick={() => setHumanizeSettings(prev => ({ ...prev, model: 1 }))}
                                                        style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.model === 1 ? "var(--primary)" : "var(--card)", color: humanizeSettings.model === 1 ? "white" : "var(--foreground)", cursor: "pointer" }}
                                                      >
                                                        Balance
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className={`humanize-option-btn ${humanizeSettings.model === 2 ? "active" : ""}`}
                                                        onClick={() => setHumanizeSettings(prev => ({ ...prev, model: 2 }))}
                                                        style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.model === 2 ? "var(--primary)" : "var(--card)", color: humanizeSettings.model === 2 ? "white" : "var(--foreground)", cursor: "pointer" }}
                                                      >
                                                        Enhanced
                                                      </button>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Style Selection */}
                                                  <div className="humanize-setting-group" style={{ marginBottom: "1rem" }}>
                                                    <label className="humanize-setting-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>Writing Style</label>
                                                    <select
                                                      className="humanize-style-select"
                                                      value={humanizeSettings.style}
                                                      onChange={(e) => setHumanizeSettings(prev => ({ ...prev, style: e.target.value }))}
                                                      style={{ width: "100%", padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: "0.9rem" }}
                                                    >
                                                      <option value="General">General</option>
                                                      <option value="Blog">Blog</option>
                                                      <option value="Formal">Formal</option>
                                                      <option value="Informal">Informal</option>
                                                      <option value="Academic">Academic</option>
                                                      <option value="Expand">Expand</option>
                                                      <option value="Simplify">Simplify</option>
                                                    </select>
                                                  </div>
                                                  
                                                  {/* Mode Selection */}
                                                  <div className="humanize-setting-group">
                                                    <label className="humanize-setting-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>Mode</label>
                                                    <div className="humanize-setting-options" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                      <button
                                                        type="button"
                                                        className={`humanize-option-btn ${humanizeSettings.mode === "Basic" ? "active" : ""}`}
                                                        onClick={() => setHumanizeSettings(prev => ({ ...prev, mode: "Basic" }))}
                                                        style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.mode === "Basic" ? "var(--primary)" : "var(--card)", color: humanizeSettings.mode === "Basic" ? "white" : "var(--foreground)", cursor: "pointer" }}
                                                      >
                                                        Basic
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className={`humanize-option-btn ${humanizeSettings.mode === "Autopilot" ? "active" : ""}`}
                                                        onClick={() => setHumanizeSettings(prev => ({ ...prev, mode: "Autopilot" }))}
                                                        style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: humanizeSettings.mode === "Autopilot" ? "var(--primary)" : "var(--card)", color: humanizeSettings.mode === "Autopilot" ? "white" : "var(--foreground)", cursor: "pointer" }}
                                                      >
                                                        Autopilot
                                                      </button>
                                                    </div>
                                                    <p className="humanize-setting-hint" style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                                      {humanizeSettings.mode === "Basic" 
                                                        ? "Single rewrite per request (70% basic detection bypass)" 
                                                        : "Rewrites multiple times until 0% AI (99% all detection bypass)"}
                                                    </p>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                          {/* Quick Generate Button */}
                                          {!isCompleted && (
                                            <div className="topic-quick-generate" style={{ marginTop: "1rem" }}>
                                              <button
                                                type="button"
                                                className="btn-quick-generate"
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  await handleQuickGenerate(topic);
                                                }}
                                                disabled={isGeneratingArticles || isCompleted || generatedArticles.some(a => a.topicTitle === topic.id && (a.status === "generating" || a.status === "ready"))}
                                              >
                                                {generatedArticles.some(a => a.topicTitle === topic.id && a.status === "generating")
                                                  ? "Generating…"
                                                  : "Generate article"}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Short Angle */}
                                      <div className="topic-preview-field">
                                        <strong className="preview-label">Short angle (2–3 sentences):</strong>
                                        <p className="preview-text">{topic.shortAngle}</p>
                                      </div>

                                      {/* Why Non-Generic */}
                                      <div className="topic-preview-field">
                                        <strong className="preview-label">Why it's non-generic and link-worthy:</strong>
                                        <p className="preview-text">{topic.whyNonGeneric}</p>
                                      </div>

                                      {/* How Anchor Fits */}
                                      <div className="topic-preview-field highlight-preview-field">
                                        <strong className="preview-label">How your anchor fits:</strong>
                                        <p className="preview-text">{topic.howAnchorFits}</p>
                                      </div>

                                      {/* Evergreen Potential */}
                                      <div className="topic-preview-field">
                                        <strong className="preview-label">Evergreen potential:</strong>
                                        <div className="evergreen-preview">
                                          <div className="evergreen-dots-row">
                                            {[1, 2, 3, 4, 5].map(i => (
                                              <span
                                                key={i}
                                                className={`evergreen-dot-preview ${i <= topic.evergreenScore ? "filled" : "empty"}`}
                                              >
                                                ●
                                              </span>
                                            ))}
                                          </div>
                                          <span className="evergreen-explanation">{topic.evergreenNote}</span>
                                        </div>
                                      </div>

                                      {/* Competition */}
                                      <div className="topic-preview-field">
                                        <strong className="preview-label">Competition:</strong>
                                        <div className="competition-preview">
                                          <span className={`competition-pill-preview ${topic.competitionLevel}`}>
                                            {topic.competitionLevel.charAt(0).toUpperCase() + topic.competitionLevel.slice(1)}
                                          </span>
                                          <span className="competition-explanation">{topic.competitionNote}</span>
        </div>
      </div>
      
      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          time={notification.time}
          isVisible={notification.visible}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
})()}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {/* Topics Selected Counter */}
                    {selectedTopicIds.length > 0 && (
                      <div className="topics-selected-summary">
                        <span className="selected-count">Topics selected: {selectedTopicIds.length}</span>
                        <button
                          type="button"
                          className="clear-selections-btn"
                          onClick={clearSelections}
                        >
                          Clear selections
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {!topicsData && !isLoading("topics") && (
                  <p className="empty-state">Topic ideas will appear here after generation.</p>
                )}
              </div>

              {/* Step 2 - Article Draft (Discovery Mode only) */}
              {mode === "discovery" && (
                <div className={`step-card ${selectedTopicIds.length === 0 ? "step-card-inactive" : "step-card-active"}`}>
                  <div className="step-header">
                    <h3>Step 2 – Generate articles from selected topics</h3>
                    <p className="step-description">
                      Choose any topics from Step 1 and turn them into fully written outreach or blog articles. The engine uses our internal templates and delivers clean, human-sounding content ready for editors.
                    </p>
                  </div>

                  <div className="step-content">
                    {selectedTopicIds.length === 0 ? (
                      <div className="step-inactive-message">
                        <p>Select topics from Step 1 to enable article generation.</p>
                      </div>
                    ) : (
                      <>
                        <div className="step-actions">
                          <button
                            type="button"
                            className="btn-primary btn-generate-articles"
                            onClick={generateArticlesForSelected}
                            disabled={isGeneratingArticles}
                          >
                            {isGeneratingArticles 
                              ? "Generating…" 
                              : selectedTopicIds.length === 1
                                ? "Generate article"
                                : `Generate articles (${selectedTopicIds.length} selected)`
                            }
                          </button>
                        </div>
                        
                        <div className="topics-selected-status">
                          <span className="topics-count-badge">{selectedTopicIds.length} topic{selectedTopicIds.length !== 1 ? 's' : ''} selected</span>
                          <span>Ready to generate articles</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Generated Articles Section */}
              {generatedArticles.length > 0 && (
                <div className="generated-articles-section" ref={generatedArticlesSectionRef}>
                  <h3 className="section-title">Generated Articles</h3>
                  <div className="articles-list">
                    {generatedArticles.map((article) => {
                      const topicId = article.topicTitle;
                      // For discovery mode, find topic in topicsData
                      // For direct mode, topicTitle is stored in topicTitle (which is the articleId, but we extract the actual topic)
                      const topic = mode === "discovery" ? topicsData?.topics.find(t => t.id === topicId) : undefined;
                      const isEditing = editingArticles.has(topicId);
                      const isViewing = viewingArticle === topicId;
                      const articleText = getArticleText(article);
                      
                      const articleTitle = getArticleTitle(article, topic);
                      const articleSummary = getArticleSummary(article, topic);
                      const wordCount = getWordCount(articleText);
                      const formattedWordCount = formatWordCount(wordCount);
                      // For direct mode, use articleTitle or extract from topicId; for discovery, use topic.workingTitle
                      const topicTitle = mode === "direct" 
                        ? (article.titleTag ? stripHtmlTags(article.titleTag) : topicId.replace(/^direct-\d+-/, ""))
                        : (topic?.workingTitle || topicId);
                      const titleTag = article.titleTag ? stripHtmlTags(article.titleTag) : null;
                      
                      return (
                        <div key={topicId} className="article-result-card" data-article-id={topicId}>
                          <div className="article-result-header">
                            <div>
                              {/* Topic Title - H-level, bold, plain text (main heading) */}
                              <h3 className="article-result-title">{topicTitle}</h3>
                              
                              {/* Title Tag - short phrase, regular text (subtitle) */}
                              {titleTag && titleTag !== topicTitle && (
                                <p className="article-title-tag">{titleTag}</p>
                              )}
                              
                              {/* Article Summary - plain text, not bold */}
                              {articleSummary && (
                                <p className="article-summary-text">
                                  <span className="article-summary-label">Summary: </span>
                                  {articleSummary}
                                </p>
                              )}
                              
                              {article && article.status === "ready" && (
                                <div className="article-meta">
                                  <span>Word count: {formattedWordCount} words</span>
                                  <span>·</span>
                                  <span>Anchor included</span>
                                </div>
                              )}
                            </div>
                            <div className="article-header-actions">
                              {article && (
                                <span className={`article-status ${article.status}`}>
                                  {article.status === "generating" ? "Generating…" : article.status === "error" ? "Error" : "Ready"}
                                </span>
                              )}
                              <button
                                type="button"
                                className="article-remove-btn"
                                onClick={() => removeArticle(topicId)}
                                title="Remove article"
                                aria-label="Remove article"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          
                          {article && article.status === "ready" ? (
                            <div className="article-result-content">
                              {/* Article Preview */}
                              {/* Article Preview - plain text only, no bold formatting */}
                              <div className="article-summary-box">
                                <p className="article-preview-text">{getArticlePreview(article)}</p>
                              </div>

                              {/* Action Buttons */}
                              <div className="article-actions">
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={() => setViewingArticle(isViewing ? null : topicId)}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>{isViewing ? "Close" : "View / Edit"}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={async () => {
                                    // Use the most up-to-date version (articleBodyHtml is updated after humanization)
                                    const html = article.articleBodyHtml || article.fullArticleText || article.editedText || "";
                                    if (!html) {
                                      setNotification({
                                        message: "No article content to copy",
                                        time: new Date().toLocaleTimeString(),
                                        visible: true,
                                      });
                                      setTimeout(() => {
                                        setNotification(prev => prev ? { ...prev, visible: false } : null);
                                      }, 2000);
                                      return;
                                    }
                                    // Create plain text fallback
                                    const temp = document.createElement('div');
                                    temp.innerHTML = html;
                                    const plain = temp.textContent ?? temp.innerText ?? '';

                                    try {
                                      if (navigator.clipboard && (window as any).ClipboardItem) {
                                        const blobHtml = new Blob([html], { type: 'text/html' });
                                        const blobText = new Blob([plain], { type: 'text/plain' });
                                        const item = new (window as any).ClipboardItem({
                                          'text/html': blobHtml,
                                          'text/plain': blobText,
                                        });
                                        await navigator.clipboard.write([item]);
                                      } else {
                                        await navigator.clipboard.writeText(plain);
                                      }
                                      setCopyStatus("copied");
                                      setCopyStatusByTopic(prev => {
                                        const next = new Map(prev);
                                        next.set(topicId, "copied");
                                        return next;
                                      });
                                      setTimeout(() => {
                                        setCopyStatus("idle");
                                        setCopyStatusByTopic(prev => {
                                          const next = new Map(prev);
                                          next.set(topicId, "idle");
                                          return next;
                                        });
                                      }, 2000);
                                    } catch (err) {
                                      console.error('Failed to copy:', err);
                                      // Fallback to plain text
                                      await navigator.clipboard.writeText(plain);
                                      setCopyStatus("copied");
                                      setCopyStatusByTopic(prev => {
                                        const next = new Map(prev);
                                        next.set(topicId, "copied");
                                        return next;
                                      });
                                      setTimeout(() => {
                                        setCopyStatus("idle");
                                        setCopyStatusByTopic(prev => {
                                          const next = new Map(prev);
                                          next.set(topicId, "idle");
                                          return next;
                                        });
                                      }, 2000);
                                    }
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>{copyStatusByTopic.get(topicId) === "copied" ? "Copied!" : "Copy text"}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline"
                                  title="Copy article text with clean paragraphs for AI checkers"
                                  onClick={async () => {
                                    try {
                                      // Get the most up-to-date article HTML content (articleBodyHtml is updated after humanization)
                                      const html = article.articleBodyHtml || article.fullArticleText || article.editedText || "";
                                      if (!html) {
                                        throw new Error("No article content available");
                                      }
                                      
                                      // Try to find the rendered article in the modal if it's open
                                      let articleElement: HTMLElement | null = null;
                                      if (isViewing && viewingArticle === topicId) {
                                        const modal = document.querySelector('.article-view-modal');
                                        if (modal) {
                                          articleElement = modal.querySelector('.article-view-text') as HTMLElement;
                                        }
                                      }
                                      
                                      // If not found in modal, create a temporary element from HTML
                                      if (!articleElement) {
                                        const temp = document.createElement('div');
                                        temp.innerHTML = html;
                                        articleElement = temp;
                                      }
                                      
                                      if (articleElement) {
                                        await copyArticleAsPlainText(articleElement);
                                        setCopyPlainTextStatusByTopic(prev => {
                                          const next = new Map(prev);
                                          next.set(topicId, "copied");
                                          return next;
                                        });
                                        setTimeout(() => {
                                          setCopyPlainTextStatusByTopic(prev => {
                                            const next = new Map(prev);
                                            next.set(topicId, "idle");
                                            return next;
                                          });
                                        }, 2000);
                                      } else {
                                        throw new Error("Could not find article element");
                                      }
                                    } catch (err) {
                                      console.error('Failed to copy plain text:', err);
                                      setNotification({
                                        message: "Could not copy text. Please try again.",
                                        time: new Date().toLocaleTimeString(),
                                        visible: true,
                                      });
                                      setTimeout(() => {
                                        setNotification(prev => prev ? { ...prev, visible: false } : null);
                                      }, 2000);
                                    }
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>{copyPlainTextStatusByTopic.get(topicId) === "copied" ? "Copied!" : "Copy plain text"}</span>
                                </button>
                                {/* Show badge if article was humanized on write */}
                                {article.humanizedOnWrite && (
                                  <span className="humanized-badge" title="This article was humanized during generation">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Humanized on write</span>
                                  </span>
                                )}
                                <div className="download-dropdown-wrapper">
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={(e) => {
                                      const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                                      dropdown?.classList.toggle("show");
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Download</span>
                                  </button>
                                  <div className="download-dropdown">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        downloadArticle(topicId, article.articleBodyHtml || article.fullArticleText || article.editedText || "", "txt");
                                        (document.querySelector(".download-dropdown.show") as HTMLElement)?.classList.remove("show");
                                      }}
                                    >
                                      Plain text (.txt)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        downloadArticle(topicId, article.articleBodyHtml || article.fullArticleText || article.editedText || "", "html");
                                        (document.querySelector(".download-dropdown.show") as HTMLElement)?.classList.remove("show");
                                      }}
                                    >
                                      HTML (.html)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        downloadArticle(topicId, article.articleBodyHtml || article.fullArticleText || article.editedText || "", "pdf");
                                        (document.querySelector(".download-dropdown.show") as HTMLElement)?.classList.remove("show");
                                      }}
                                    >
                                      PDF (.pdf)
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={() => regenerateArticleForTopic(topicId)}
                                  disabled={isGeneratingArticles}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.48L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>Regenerate</span>
                                </button>
                              </div>

                              {/* View Modal */}
                              {isViewing && (
                                <div className="article-view-modal">
                                  <div className="article-view-content">
                                    <div className="article-view-header">
                                      <div className="article-view-header-actions">
                                        <button
                                          type="button"
                                          className="btn-outline btn-sm"
                                          onClick={async () => {
                                            // Use the most up-to-date version (articleBodyHtml is updated after humanization)
                                            const html = article.articleBodyHtml || article.fullArticleText || article.editedText || "";
                                            if (!html) {
                                              setNotification({
                                                message: "No article content to copy",
                                                time: new Date().toLocaleTimeString(),
                                                visible: true,
                                              });
                                              setTimeout(() => {
                                                setNotification(prev => prev ? { ...prev, visible: false } : null);
                                              }, 2000);
                                              return;
                                            }
                                            // Create plain text fallback
                                            const temp = document.createElement('div');
                                            temp.innerHTML = html;
                                            const plain = temp.textContent ?? temp.innerText ?? '';

                                            try {
                                              if (navigator.clipboard && (window as any).ClipboardItem) {
                                                const blobHtml = new Blob([html], { type: 'text/html' });
                                                const blobText = new Blob([plain], { type: 'text/plain' });
                                                const item = new (window as any).ClipboardItem({
                                                  'text/html': blobHtml,
                                                  'text/plain': blobText,
                                                });
                                                await navigator.clipboard.write([item]);
                                              } else {
                                                await navigator.clipboard.writeText(plain);
                                              }
                                              setCopyStatus("copied");
                                              setTimeout(() => setCopyStatus("idle"), 2000);
                                            } catch (err) {
                                              console.error('Failed to copy:', err);
                                              // Fallback to plain text
                                              await navigator.clipboard.writeText(plain);
                                              setCopyStatus("copied");
                                              setTimeout(() => setCopyStatus("idle"), 2000);
                                            }
                                          }}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          <span>{copyStatus === "copied" && viewingArticle === topicId ? "Copied!" : "Copy text"}</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-outline btn-sm"
                                          title="Copy article text with clean paragraphs for AI checkers"
                                          onClick={async () => {
                                            try {
                                              // Find the rendered article element in the modal
                                              const articleElement = document.querySelector('.article-view-text') as HTMLElement;
                                              
                                              if (articleElement) {
                                                await copyArticleAsPlainText(articleElement);
                                                setCopyPlainTextStatus("copied");
                                                setTimeout(() => {
                                                  setCopyPlainTextStatus("idle");
                                                }, 2000);
                                              } else {
                                                throw new Error("Could not find article element");
                                              }
                                            } catch (err) {
                                              console.error('Failed to copy plain text:', err);
                                              setNotification({
                                                message: "Could not copy text. Please try again.",
                                                time: new Date().toLocaleTimeString(),
                                                visible: true,
                                              });
                                              setTimeout(() => {
                                                setNotification(prev => prev ? { ...prev, visible: false } : null);
                                              }, 2000);
                                            }
                                          }}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          <span>{copyPlainTextStatus === "copied" && viewingArticle === topicId ? "Copied!" : "Copy plain text"}</span>
                                        </button>
                                        {/* Show badge if article was humanized on write */}
                                        {article.humanizedOnWrite && (
                                          <span className="humanized-badge" title="This article was humanized during generation">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            <span>Humanized on write</span>
                                          </span>
                                        )}
                                        
                                        <button
                                          type="button"
                                          className="close-modal-btn"
                                          onClick={() => {
                                            setViewingArticle(null);
                                            setEditRequest("");
                                            setEditingArticleId(null);
                                            setEditingArticleStatus(null);
                                          }}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          <span>Close</span>
                                        </button>
                                      </div>
                                      <h1 className="article-view-title">{article.titleTag || topic?.workingTitle || topicId}</h1>
                                    </div>
                                    
                                    <div className="article-view-body">
                                      {/* Title Tag Section */}
                                      <section className="article-meta-section">
                                        <p className="article-meta-label">Title tag</p>
                                        <p className="article-meta-value">{article.titleTag}</p>
                                      </section>
                                      
                                      {/* Meta Description Section */}
                                      {article.metaDescription && (
                                        <section className="article-meta-section">
                                          <p className="article-meta-label">Meta description</p>
                                          <p className="article-meta-value">{article.metaDescription}</p>
                                        </section>
                                      )}
                                      
                                      {/* Article Body Section */}
                                      <section className="article-meta-section article-body-section">
                                        <p className="article-meta-label">Article body</p>
                                        <div 
                                          className="article-view-text" 
                                          dangerouslySetInnerHTML={{ 
                                            __html: (() => {
                                              const htmlContent = article.articleBodyHtml || article.fullArticleText || article.editedText || "";
                                              // Remove H1/H2/H3 prefixes
                                              let processed = htmlContent.replace(/H[1-3]:\s*/gi, '');
                                              // Add target="_blank" and rel="noopener noreferrer" to all links
                                              processed = processed.replace(
                                                /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi,
                                                (match, before, href, after) => {
                                                  const fullAttrs = before + after;
                                                  const hasTarget = /target\s*=/i.test(fullAttrs);
                                                  const hasRel = /rel\s*=/i.test(fullAttrs);
                                                  
                                                  if (!hasTarget && !hasRel) {
                                                    // Add both target and rel
                                                    return `<a ${before.trim()} href="${href}"${after.trim()} target="_blank" rel="noopener noreferrer">`;
                                                  } else if (!hasTarget) {
                                                    // Add target, preserve existing rel
                                                    return match.replace(/(<a\s+[^>]*?)>/i, '$1 target="_blank">');
                                                  } else if (!hasRel) {
                                                    // Add rel, preserve existing target
                                                    return match.replace(/(<a\s+[^>]*?)>/i, '$1 rel="noopener noreferrer">');
                                                  } else {
                                                    // Both exist, ensure target is _blank
                                                    return match.replace(/target\s*=\s*["'][^"']*["']/gi, 'target="_blank"');
                                                  }
                                                }
                                              );
                                              return processed;
                                            })()
                                          }} 
                                        />
                                      </section>

                                      {/* Edit Article Section - Only for Direct Article Creation mode */}
                                      {mode === "direct" && (
                                        <section className="article-meta-section article-edit-section">
                                          <p className="article-meta-label">Edit Article with AI</p>
                                          <div className="article-edit-request">
                                            <textarea
                                              className="article-edit-textarea"
                                              placeholder="Enter your edit request. For example: 'Add more links to sources', 'Add specific examples of festivals with dates', 'Find and add images for the article'..."
                                              value={editRequest}
                                              onChange={(e) => setEditRequest(e.target.value)}
                                              rows={4}
                                              disabled={isProcessingEdit}
                                            />
                                            
                                            {/* Status indicator when editing */}
                                            {isProcessingEdit && editingArticleId === topicId && editingArticleStatus && (
                                              <div className="article-edit-status">
                                                <div className="article-edit-status-indicator">
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="spinning">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                                                      <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                                                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                                                    </circle>
                                                  </svg>
                                                  <span className="article-edit-status-text">{editingArticleStatus}</span>
                                                </div>
                                              </div>
                                            )}

                                            <div className="article-edit-actions">
                                              <button
                                                type="button"
                                                className="btn-primary"
                                                onClick={() => editArticleWithAI(topicId)}
                                                disabled={isProcessingEdit || !editRequest.trim()}
                                              >
                                                {isProcessingEdit && editingArticleId === topicId ? (
                                                  <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="spinning">
                                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                                                        <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                                                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                                                      </circle>
                                                    </svg>
                                                    <span>Processing...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                    <span>Apply Edits</span>
                                                  </>
                                                )}
                                              </button>
                                              {editRequest && !isProcessingEdit && (
                                                <button
                                                  type="button"
                                                  className="btn-outline"
                                                  onClick={() => {
                                                    setEditRequest("");
                                                    setEditingArticleId(null);
                                                    setEditingArticleStatus(null);
                                                  }}
                                                  disabled={isProcessingEdit}
                                                >
                                                  <span>Cancel</span>
                                                </button>
                                              )}
                                            </div>
                                            <p className="article-edit-hint">
                                              AI editor will help you implement your changes professionally, preserving the structure and style of the article.
                                            </p>
                                          </div>
                                        </section>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Edit Mode */}
                              {isEditing && !isViewing && (
                                <div className="article-edit-section">
                                  <label>
                                    <span>Article text</span>
                                    <textarea
                                      className="article-textarea"
                                      value={article.articleBodyHtml || article.fullArticleText || article.editedText || ""}
                                      onChange={(e) => {
                                        updateGeneratedArticles(
                                          generatedArticles.map(a =>
                                            a.topicTitle === topicId
                                              ? { ...a, editedText: e.target.value }
                                              : a
                                          )
                                        );
                                      }}
                                      rows={15}
                                    />
                                  </label>
                                </div>
                              )}

                              <p className="anchor-note">Anchor is already integrated naturally in the body, not as an ad.</p>

                              {/* Hero Image Generation Section */}
                              <div className="article-image-section">
                                {!articleImages.has(topicId) && !isGeneratingImage.has(topicId) && (
                                  <button
                                    type="button"
                                    className="btn-outline btn-generate-image"
                                    onClick={() => generateArticleImage(topicId)}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Generate hero image for this article</span>
                                  </button>
                                )}
                                
                                {/* Image Style Personalization */}
                                <div className="image-style-personalization">
                                  <div className="image-style-personalization-container">
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      accept="image/*"
                                      onChange={handleReferenceImageUpload}
                                      style={{ display: "none" }}
                                      id="reference-image-upload"
                                    />
                                    <label
                                      htmlFor="reference-image-upload"
                                      className="image-style-upload-label"
                                      style={{
                                        cursor: isAnalyzingStyle ? "not-allowed" : "pointer",
                                        opacity: isAnalyzingStyle ? 0.6 : 1,
                                      }}
                                    >
                                      {isAnalyzingStyle ? (
                                        <>
                                          <span className="spinning" style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%" }}></span>
                                          Analyzing...
                                        </>
                                      ) : (
                                        <>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                          </svg>
                                          Upload style
                                        </>
                                      )}
                                    </label>
                                    
                                    {referenceImage && (
                                      <div className="image-style-reference-preview">
                                        <img
                                          src={referenceImage}
                                          alt="Reference"
                                        />
                                      </div>
                                    )}
                                    
                                    <textarea
                                      className="image-style-textarea"
                                      value={brief.customStyle || ""}
                                      onChange={handleBriefChange("customStyle")}
                                      placeholder="Style description..."
                                      rows={brief.customStyle ? Math.min(Math.ceil((brief.customStyle.length || 0) / 80), 10) : 1}
                                    />
                                    
                                    {referenceImage && (
                                      <button
                                        type="button"
                                        className="image-style-remove-btn"
                                        onClick={handleRemoveReferenceImage}
                                        title="Remove image"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {isGeneratingImage.has(topicId) && (
                                  <div className="image-generating-local">
                                    <div className="image-loader-local-container">
                                      <h4 className="image-loader-title">Creating your hero image…</h4>
                                      
                                      {/* Equalizer Bars */}
                                      <div className="image-equalizer-container">
                                        {[1, 2, 3, 4, 5, 6, 7].map((index) => (
                                          <div
                                            key={index}
                                            className="image-equalizer-bar"
                                            style={{
                                              animationDelay: `${index * 0.1}s`,
                                            }}
                                          />
                                        ))}
                                      </div>

                                      {/* Status Messages */}
                                      {(() => {
                                        const imageMessages = [
                                          "Composing the perfect visual concept…",
                                          "Selecting color palette and mood…",
                                          "Crafting cinematic lighting and depth…",
                                          "Refining details for professional quality…",
                                          "Ensuring art-direction-level polish…",
                                          "Adding subtle motion and atmosphere…",
                                          "Balancing composition and negative space…",
                                        ];
                                        const messageIndex = imageLoaderMessages.get(topicId) || 0;
                                        const currentMessage = imageMessages[messageIndex % imageMessages.length];
                                        
                                        return (
                                          <div className="image-loader-messages">
                                            <p className="image-loader-message">{currentMessage}</p>
                                          </div>
                                        );
                                      })()}

                                      {/* Timer */}
                                      {(() => {
                                        const formatTime = (seconds: number): string => {
                                          const mins = Math.floor(seconds / 60);
                                          const secs = seconds % 60;
                                          return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                                        };
                                        const elapsed = imageLoaderElapsed.get(topicId) || 0;
                                        
                                        return (
                                          <div className="image-loader-timer">
                                            <span className="image-loader-timer-icon">⏱</span>
                                            <span className="image-loader-timer-text">Elapsed: {formatTime(elapsed)}</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {articleImages.has(topicId) && (
                                  <div className="article-image-container">
                                    <div 
                                      className="article-image-preview-wrapper"
                                      onClick={() => setViewingImage(topicId)}
                                    >
                                      <img
                                        src={`data:image/png;base64,${articleImages.get(topicId)}`}
                                        alt={`Hero image for ${articleTitle}`}
                                        className="article-hero-image"
                                      />
                                      <div className="image-zoom-overlay">
                                        <span className="zoom-icon">🔍</span>
                                        <span className="zoom-text">Click to enlarge</span>
                                      </div>
                                    </div>
                                    <div className="article-image-actions">
                                      <button
                                        type="button"
                                        className="btn-outline"
                                        onClick={() => generateArticleImage(topicId)}
                                        disabled={isGeneratingImage.has(topicId)}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.48L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <span>{isGeneratingImage.has(topicId) ? "Regenerating…" : "Regenerate"}</span>
                                      </button>
                                      <a
                                        href={`data:image/png;base64,${articleImages.get(topicId)}`}
                                        download={`${createSlug(articleTitle)}-hero.png`}
                                        className="btn-outline"
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <span>Download</span>
                                      </a>
                                      <button
                                        type="button"
                                        className="btn-outline"
                                        onClick={() => {
                                          setArticleImages(prev => {
                                            const next = new Map(prev);
                                            next.delete(topicId);
                                            // Note: Not persisting to localStorage to avoid quota issues
                                            return next;
                                          });
                                        }}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : article && article.status === "generating" ? (
                            <div className="article-generating-local">
                              <div className="article-loader-local-container">
                                <h4 className="article-loader-title">Writing your outreach article…</h4>
                                
                                {/* Equalizer Bars */}
                                <div className="article-equalizer-container">
                                  {[1, 2, 3, 4, 5, 6, 7].map((index) => (
                                    <div
                                      key={index}
                                      className="article-equalizer-bar"
                                      style={{
                                        animationDelay: `${index * 0.1}s`,
                                      }}
                                    />
                                  ))}
                                </div>

                                {/* Status Messages */}
                                {(() => {
                                  const articleMessages = [
                                    "Drafting a human-sounding article, not robotic fluff…",
                                    "Weaving your anchor into the story…",
                                    "Balancing SEO structure with real reader value…",
                                    "Structuring an article a real editor wouldn't delete on sight…",
                                    "Making sure your anchor link feels natural, not spammy…",
                                    "Filling the gaps with data, not filler sentences…",
                                    "Cutting robotic phrasing so it sounds like a human strategist…",
                                    "Double-checking that this actually helps a musician, not just an algorithm…",
                                  ];
                                  const messageIndex = articleLoaderMessages.get(topicId) || 0;
                                  const currentMessage = articleMessages[messageIndex % articleMessages.length];
                                  
                                  return (
                                    <div className="article-loader-messages">
                                      <p className="article-loader-message">{currentMessage}</p>
                                    </div>
                                  );
                                })()}

                                {/* Timer */}
                                {(() => {
                                  const formatTime = (seconds: number): string => {
                                    const mins = Math.floor(seconds / 60);
                                    const secs = seconds % 60;
                                    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                                  };
                                  const elapsed = articleLoaderElapsed.get(topicId) || 0;
                                  
                                  return (
                                    <div className="article-loader-timer">
                                      <span className="article-loader-timer-icon">⏱</span>
                                      <span className="article-loader-timer-text">Elapsed: {formatTime(elapsed)}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : article && article.status === "error" ? (
                            <div className="article-error">
                              <p>Failed to generate article. Please try again.</p>
                            </div>
                          ) : (
                            <div className="topic-preview">
                              {topic && (
                                <>
                                  <p className="topic-preview-description">{topic.shortAngle}</p>
                                </>
                              )}
                              <span className="topic-status-pending">Pending</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reset Project Button */}
        <div style={{ textAlign: "center", marginTop: "2rem", paddingBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => {
              if (confirm("Are you sure you want to reset the entire project? This will clear all topics, articles, and form data.")) {
                resetPersistedState();
                setExpandedClusterNames(new Set());
                setViewingArticle(null);
                setEditingArticles(new Set());
              }
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--secondary)";
              e.currentTarget.style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            Reset project
          </button>
        </div>
      </main>
    </div>
  );
}

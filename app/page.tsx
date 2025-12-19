"use client";

import { ChangeEvent, useState, useEffect, useRef } from "react";
import LoadingOverlay from "./components/LoadingOverlay";
import Notification from "./components/Notification";
import { TagPill } from "./components/TagPill";
import { usePersistentAppState, type Brief, type Topic, type TopicResponse, type GeneratedArticle } from "./hooks/usePersistentAppState";

type LoadingStep = "topics" | "outline" | "draft" | null;

export default function Home() {
  const [persistedState, setPersistedState, resetPersistedState, isHydrated] = usePersistentAppState();
  
  // Extract state from persisted state
  const brief = persistedState.projectBasics;
  const topicsData = persistedState.topicClusters;
  const selectedTopicIds = persistedState.selectedTopicIds;
  const mode = persistedState.mode;
  // Get articles for current mode only
  const generatedArticles = mode === "discovery" 
    ? persistedState.discoveryArticles 
    : mode === "direct" 
    ? persistedState.directArticles 
    : persistedState.rewriteArticles;
  const lightHumanEditEnabled = persistedState.lightHumanEditEnabled;
  const clientBrief = persistedState.clientBrief || "";
  const directArticleSettings = persistedState.directArticleSettings || {};
  const originalArticle = persistedState.originalArticle || "";
  const rewriteParams = persistedState.rewriteParams || {};
  
  // #region agent log
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/9ac5a9d7-f4a2-449b-826b-f0ab7af8406a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:26',message:'[Bug2-HypA] Mode value check in component render',data:{modeValue:mode,modeType:typeof mode,modeIsUndefined:mode === undefined,modeIsDiscovery:mode === 'discovery',modeIsDirect:mode === 'direct',modeIsRewrite:mode === 'rewrite'},timestamp:Date.now(),sessionId:'debug-session',runId:'bug2-verification',hypothesisId:'A'})}).catch(()=>{});
    }
  }, [mode]);
  // #endregion

  // Local UI state (not persisted)
  const [expandedClusterNames, setExpandedClusterNames] = useState<Set<string>>(new Set());
  const [outline, setOutline] = useState("");
  const [draft, setDraft] = useState("");
  const [editingArticles, setEditingArticles] = useState<Set<string>>(new Set());
  const [viewingArticle, setViewingArticle] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isGeneratingArticles, setIsGeneratingArticles] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    time: string;
    visible: boolean;
  } | null>(null);
  const generatedArticlesSectionRef = useRef<HTMLDivElement>(null);

  // Helper functions to update persisted state
  const updateBrief = (updates: Partial<Brief>) => {
    setPersistedState(prev => ({
      ...prev,
      projectBasics: { ...prev.projectBasics, ...updates }
    }));
  };

  const updateTopicsData = (data: TopicResponse | null) => {
    setPersistedState(prev => ({
      ...prev,
      topicClusters: data,
      topicOverview: data?.overview || null,
    }));
  };

  const updateClientBrief = (brief: string) => {
    setPersistedState(prev => ({
      ...prev,
      clientBrief: brief,
    }));
  };

  const updateOriginalArticle = (article: string) => {
    setPersistedState(prev => ({
      ...prev,
      originalArticle: article,
    }));
  };

  const updateDirectArticleSettings = (updates: Partial<typeof directArticleSettings>) => {
    setPersistedState(prev => ({
      ...prev,
      directArticleSettings: { ...prev.directArticleSettings || {}, ...updates },
    }));
  };

  const updateRewriteParams = (params: Partial<typeof rewriteParams>) => {
    setPersistedState(prev => ({
      ...prev,
      rewriteParams: { ...prev.rewriteParams, ...params },
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

  const updateGeneratedArticles = (articlesOrUpdater: GeneratedArticle[] | ((prev: GeneratedArticle[]) => GeneratedArticle[])) => {
    setPersistedState(prev => {
      const currentMode = prev.mode;
      const currentArticles = currentMode === "discovery" 
        ? prev.discoveryArticles 
        : currentMode === "direct" 
        ? prev.directArticles 
        : prev.rewriteArticles;
      
      const updatedArticles = typeof articlesOrUpdater === 'function' 
        ? articlesOrUpdater(currentArticles) 
        : articlesOrUpdater;
      
      // Update the appropriate mode-specific array
      if (currentMode === "discovery") {
        return {
          ...prev,
          discoveryArticles: updatedArticles,
          articles: updatedArticles, // Legacy - keep for backward compatibility
        };
      } else if (currentMode === "direct") {
        return {
          ...prev,
          directArticles: updatedArticles,
          articles: updatedArticles, // Legacy - keep for backward compatibility
        };
      } else {
        return {
          ...prev,
          rewriteArticles: updatedArticles,
          articles: updatedArticles, // Legacy - keep for backward compatibility
        };
      }
    });
  };

  const removeArticle = (topicId: string) => {
    updateGeneratedArticles(prev => prev.filter(a => a.topicTitle !== topicId));
    // Also close view/edit if open
    if (viewingArticle === topicId) {
      setViewingArticle(null);
    }
    if (editingArticles.has(topicId)) {
      setEditingArticles(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  const updateMode = (newMode: "discovery" | "direct" | "rewrite") => {
    setPersistedState(prev => ({
      ...prev,
      mode: newMode,
    }));
  };

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
    if (!brief.niche.trim() || !(brief.language || "English").trim()) {
      alert("Please fill in at least the niche and language first.");
      return;
    }

    setLoadingStep("topics");
    setIsGeneratingTopics(true);
    setGenerationStartTime(Date.now());
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
          ? `${minutes} хв ${seconds} сек`
          : `${seconds} сек`;
        
        setNotification({
          message: "Ми шукали теми для статтей",
          time: timeString,
          visible: true,
        });
        setGenerationStartTime(null);
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:303',message:'generateTopics error',data:{error:(error as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'redesign-verify',hypothesisId:'api-calls'})}).catch(()=>{});
      // #endregion
      console.error(error);
      const errorMessage = (error as Error).message || "Unable to generate topics. Please try again.";
      alert(errorMessage);
    } finally {
      setLoadingStep(null);
      setIsGeneratingTopics(false);
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
    if (!topicsData) return;
    
    const topic = topicsData.topics.find(t => t.id === topicId);
    
    if (!topic) return;

    // Check if article was edited
    const existingArticle = generatedArticles.find(a => a.topicTitle === topicId);
    if (existingArticle?.editedText) {
      const confirmed = confirm("This article has been edited. Regenerating will replace your edits. Continue?");
      if (!confirmed) return;
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:365',message:'[regenerate] Calling /api/articles with Tavily sources',data:{topicTitle:topic.workingTitle,trustSourcesCount:trustSourcesList.length},timestamp:Date.now(),sessionId:'debug-session',runId:'regenerate-article',hypothesisId:'articles-flow'})}).catch(()=>{});
      // #endregion

      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          selectedTopics: selectedTopicsData,
          keywordList: topic.primaryKeyword ? [topic.primaryKeyword] : [],
          trustSourcesList: trustSourcesList, // Only Tavily-validated sources
          lightHumanEdit: lightHumanEditEnabled, // Pass UI toggle state to API
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
      }> };

      if (data.articles.length > 0) {
        const newArticle = data.articles[0];
        updateGeneratedArticles(
          generatedArticles.map(a =>
            a.topicTitle === topicId
              ? {
                  ...newArticle,
                  topicTitle: topicId,
                  status: "ready" as const,
                }
              : a
          )
        );
      }
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message || "Unable to regenerate article. Please try again.";
      alert(errorMessage);
      
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
      alert("Please generate topics first.");
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
    if (!topicsData) {
      alert("Please generate topics first.");
      return;
    }

    if (topics.length === 0) {
      alert("Please select at least one topic first.");
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
          lightHumanEdit: lightHumanEditEnabled, // Pass UI toggle state to API
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
      }> };

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/39eeacee-77bc-4c9e-b958-915876491934',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:495',message:'Articles received',data:{articlesCount:data.articles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'articles-generation',hypothesisId:'articles-flow'})}).catch(()=>{});
      // #endregion

      // Update generated articles with results
      updateGeneratedArticles([
        ...generatedArticles.filter(a => !topicIds.includes(a.topicTitle)),
        ...data.articles.map((article, index) => ({
          ...article,
          topicTitle: topics[index]?.id || article.topicTitle,
          status: "ready" as const,
        }))
      ]);
      
      // Clear selected topics after successful generation to make Step 2 inactive
      updateSelectedTopicIds([]);
      
      // Show notification with elapsed time
      if (generationStartTime) {
        const elapsedMs = Date.now() - generationStartTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = minutes > 0 
          ? `${minutes} хв ${seconds} сек`
          : `${seconds} сек`;
        
        setNotification({
          message: "Ми генерували і створювали найкращу статтю",
          time: timeString,
          visible: true,
        });
        setGenerationStartTime(null);
      }
      
      // Auto-scroll to the newly generated article(s) after a short delay
      // If multiple articles were generated, scroll to the last one
      setTimeout(() => {
        // Find the newly generated articles (those that were just created)
        const newArticleIds = topics.map(t => t.id);
        
        // Find the last generated article card in the DOM
        let targetElement: HTMLElement | null = null;
        
        // Try to find the last new article card
        for (let i = newArticleIds.length - 1; i >= 0; i--) {
          const articleId = newArticleIds[i];
          const articleCard = document.querySelector(`[data-article-id="${articleId}"]`) as HTMLElement;
          if (articleCard) {
            targetElement = articleCard;
            break; // Found the last new article
          }
        }
        
        // If we found a new article card, scroll to it; otherwise fall back to section
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
      alert(errorMessage);
      
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

  const generateArticlesForSelected = async () => {
    if (selectedTopicIds.length === 0) {
      alert("Please select at least one topic first.");
      return;
    }

    if (!topicsData) {
      alert("Please generate topics first.");
      return;
    }

    const selectedTopics = topicsData.topics.filter(t => selectedTopicIds.includes(t.id));
    await generateArticlesForTopics(selectedTopics, false);
  };

  const generateArticleFromBrief = async () => {
    if (clientBrief.length < 50) {
      alert("Please provide a client brief with at least 50 characters.");
      return;
    }

    setIsGeneratingArticles(true);
    setGenerationStartTime(Date.now());
    
    // Create a temporary article entry
    const tempArticleId = `direct-${Date.now()}`;
    updateGeneratedArticles(prev => [
      ...prev,
      {
        topicTitle: tempArticleId,
        titleTag: "",
        metaDescription: "",
        fullArticleText: "",
        status: "generating" as const,
      }
    ]);

    try {
      // Step 1: Find trust sources via Tavily based on brief
      const queryParts = [
        clientBrief.substring(0, 200), // First 200 chars as search query
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
        throw new Error(`Failed to find trust sources: ${errorData.error || linksResponse.statusText}`);
      }

      const linksData = await linksResponse.json() as { trustSources: Array<{ title: string; url: string; snippet: string; source: string }> };
      const trustSourcesList = linksData.trustSources.map(s => `${s.title}|${s.url}`);

      if (trustSourcesList.length === 0) {
        throw new Error("No trust sources found. Please ensure Tavily API key is configured.");
      }

      // Step 2: Generate article from brief
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "directBrief",
          brief: {
            niche: "", // Do NOT send brief.niche - use only articleSettings
            platform: "", // Do NOT send brief.platform - use only articleSettings
            contentPurpose: "", // Do NOT send brief.contentPurpose
            clientSite: brief.clientSite || "", // Keep for anchorUrl fallback only
            anchorText: "", // Do NOT send brief.anchorText - use only articleSettings
            anchorUrl: brief.anchorUrl || "", // Keep for anchorUrl if needed
            language: brief.language || "English", // Language is OK as it's a global setting
            wordCount: "", // Do NOT send brief.wordCount - use only articleSettings.targetWordCount
          },
          clientBrief: clientBrief,
          articleSettings: {
            nicheOrIndustry: directArticleSettings.nicheOrIndustry,
            brandName: directArticleSettings.brandName,
            anchorKeyword: directArticleSettings.anchorKeyword,
            targetWordCount: directArticleSettings.targetWordCount,
            writingStyle: directArticleSettings.writingStyle,
          },
          keywordList: directArticleSettings.anchorKeyword ? [directArticleSettings.anchorKeyword] : [],
          trustSourcesList: trustSourcesList,
          lightHumanEdit: lightHumanEditEnabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to generate article from brief.");
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
        // Update using functional form to get latest state
        updateGeneratedArticles(prev => {
          // Find the article with matching tempArticleId or the last "generating" article for direct mode
          const articleIndex = prev.findIndex(a => 
            a.topicTitle === tempArticleId || 
            (a.status === "generating" && a.topicTitle.startsWith("direct-"))
          );
          
          if (articleIndex !== -1) {
            // Update existing article
            return prev.map((a, idx) =>
              idx === articleIndex
                ? {
                    ...newArticle,
                    topicTitle: tempArticleId,
                    status: "ready" as const,
                  }
                : a
            );
          } else {
            // Add new article if not found (shouldn't happen, but just in case)
            return [
              ...prev,
              {
                ...newArticle,
                topicTitle: tempArticleId,
                status: "ready" as const,
              }
            ];
          }
        });

        // Scroll to article
        setTimeout(() => {
          const articleElement = document.getElementById(`article-${tempArticleId}`);
          if (articleElement) {
            articleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);

        // Show notification
        if (generationStartTime) {
          const elapsedMs = Date.now() - generationStartTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          const minutes = Math.floor(elapsedSeconds / 60);
          const seconds = elapsedSeconds % 60;
          const timeString = minutes > 0 
            ? `${minutes} хв ${seconds} сек`
            : `${seconds} сек`;
          
          setNotification({
            message: "Article generated from brief",
            time: timeString,
            visible: true,
          });
        }
      }
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message || "Failed to generate article from brief. Please try again.";
      alert(errorMessage);
      
      updateGeneratedArticles(prev =>
        prev.map(a =>
          a.topicTitle === tempArticleId
            ? { ...a, status: "error" as const }
            : a
        )
      );
    } finally {
      setIsGeneratingArticles(false);
      if (generationStartTime) {
        setGenerationStartTime(null);
      }
    }
  };

  const rewriteArticle = async () => {
    if (originalArticle.length < 100) {
      alert("Please provide an article with at least 100 characters.");
      return;
    }

    setIsGeneratingArticles(true);
    setGenerationStartTime(Date.now());
    
    // Create a temporary article entry
    const tempArticleId = `rewrite-${Date.now()}`;
    updateGeneratedArticles(prev => [
      ...prev,
      {
        topicTitle: tempArticleId,
        titleTag: "",
        metaDescription: "",
        fullArticleText: "",
        status: "generating" as const,
      }
    ]);

    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          mode: "rewrite",
          originalArticle: originalArticle,
          // For Rewrite Mode, only send language from brief (global setting), everything else from rewriteParams
          brief: {
            niche: "", // Do NOT send brief.niche - use only rewriteParams
            platform: "", // Do NOT send brief.platform - use only rewriteParams
            contentPurpose: "", // Do NOT send brief.contentPurpose
            clientSite: brief.clientSite || "", // Keep for anchorUrl fallback only
            anchorText: "", // Do NOT send brief.anchorText - use only rewriteParams
            anchorUrl: brief.anchorUrl || brief.clientSite || "", // Keep for anchorUrl if needed
            language: brief.language || "English", // Language is OK as it's a global setting
            wordCount: "", // Do NOT send brief.wordCount - use only rewriteParams
          },
          rewriteParams: {
            additionalBrief: rewriteParams.additionalBrief,
            niche: rewriteParams.niche,
            brandName: rewriteParams.brandName,
            anchorKeyword: rewriteParams.anchorKeyword,
            targetWordCount: rewriteParams.targetWordCount,
            style: rewriteParams.style,
          },
          keywordList: [], // Do NOT send keywordList from Topic Discovery Mode
          trustSourcesList: [], // Do NOT send trustSourcesList from Topic Discovery Mode
          lightHumanEdit: lightHumanEditEnabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to rewrite article.");
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
        // Update using functional form to get latest state
        updateGeneratedArticles(prev => {
          // Find the article with matching tempArticleId or the last "generating" article for rewrite mode
          const articleIndex = prev.findIndex(a => 
            a.topicTitle === tempArticleId || 
            (a.status === "generating" && a.topicTitle.startsWith("rewrite-"))
          );
          
          if (articleIndex !== -1) {
            // Update existing article
            return prev.map((a, idx) =>
              idx === articleIndex
                ? {
                    ...newArticle,
                    topicTitle: tempArticleId,
                    status: "ready" as const,
                  }
                : a
            );
          } else {
            // Add new article if not found (shouldn't happen, but just in case)
            return [
              ...prev,
              {
                ...newArticle,
                topicTitle: tempArticleId,
                status: "ready" as const,
              }
            ];
          }
        });

        // Scroll to article
        setTimeout(() => {
          const articleElement = document.getElementById(`article-${tempArticleId}`);
          if (articleElement) {
            articleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);

        // Show notification
        if (generationStartTime) {
          const elapsedMs = Date.now() - generationStartTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          const minutes = Math.floor(elapsedSeconds / 60);
          const seconds = elapsedSeconds % 60;
          const timeString = minutes > 0 
            ? `${minutes} хв ${seconds} сек`
            : `${seconds} сек`;
          
          setNotification({
            message: "Article rewritten successfully",
            time: timeString,
            visible: true,
          });
        }
      }
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message || "Failed to rewrite article. Please try again.";
      alert(errorMessage);
      
      updateGeneratedArticles(prev =>
        prev.map(a =>
          a.topicTitle === tempArticleId
            ? { ...a, status: "error" as const }
            : a
        )
      );
    } finally {
      setIsGeneratingArticles(false);
      if (generationStartTime) {
        setGenerationStartTime(null);
      }
    }
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
    const topic = topicsData?.topics.find(t => t.id === topicId);
    const title = article?.titleTag || topic?.workingTitle || topicId;
    
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
      // For plain text, strip HTML tags but preserve structure
      const plainText = content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/H[1-3]:\s*/gi, '') // Remove H1:/H2:/H3: prefixes
        .replace(/\n\s*\n\s*\n/g, '\n\n'); // Normalize line breaks
      blob = new Blob([plainText], { type: "text/plain" });
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

  const stripHtmlTags = (html: string): string => {
    return html.replace(/<[^>]*>/g, '').replace(/H[1-3]:\s*/gi, '').trim();
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
    const title = article.titleTag || topic?.workingTitle || "";
    return stripHtmlTags(title);
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
    <div className={`page ${(isGeneratingTopics || isGeneratingArticles) ? "loading-active" : ""}`}>
      {/* Loading Overlays */}
      {isGeneratingArticles && <LoadingOverlay isOpen={isGeneratingArticles} mode="articles" />}
      {isGeneratingTopics && !isGeneratingArticles && <LoadingOverlay isOpen={isGeneratingTopics} mode="topics" />}
      
      <header className="page-header">
        <div className="eyebrow">Outreach Articles App</div>
        <h1>Universal Content Creator</h1>
        <p className="page-subtitle">Plan and draft outreach content in one place</p>
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
            <button
              type="button"
              className={`mode-tab ${mode === "rewrite" ? "active" : ""}`}
              onClick={() => updateMode("rewrite")}
            >
              <span className="mode-tab-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.3333 2.66667L13.3333 4.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.33333 4.66667L11.3333 6.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66667 13.3333L6.66667 9.33333L10.6667 13.3333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.66667 9.33333L4.66667 7.33333L2.66667 9.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66667 2.66667H6.66667V6.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.3333 9.33333V13.3333H9.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="mode-tab-text">Rewrite Article</span>
            </button>
          </div>

          {/* Main Card */}
          <div className="main-card">
          {/* Two-column layout only for discovery mode */}
          {mode === "discovery" ? (
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
                placeholder="e.g. Beatport promotion for techno labels, TikTok growth for DJs"
              />
              <small>Describe the main topic or industry focus</small>
              
              {/* Niche Preset Chips */}
              <div className="niche-presets">
                {[
                  "Spotify Promotion",
                  "YouTube Promotion",
                  "TikTok Promotion",
                  "Instagram Promotion",
                  "SoundCloud Promotion",
                  "Beatport Promotion",
                  "Multi-platform music promotion",
                  "Playlist & chart promotion"
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
                    // Standard language selected
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
                    <option value="Brand blog">Brand blog</option>
                    <option value="Educational guide">Educational guide</option>
                    <option value="Partner blog">Partner blog</option>
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
              {/* Step 1 - Topics (only for discovery mode) */}
              {mode === "discovery" && (
              <div className="step-card">
                <div className="step-header">
                  <h3>Step 1 – Generate and approve topics</h3>
                  <p className="step-description">
                    Tell the engine about your niche and link. It will research the landscape and return clusters of deep, non-generic topics with mini-briefs, so you can approve the best ones for article generation.
                  </p>
                </div>
          <button
            type="button"
                  className="btn-primary"
            onClick={generateTopics}
            disabled={isLoading("topics")}
          >
                  {isLoading("topics") ? "Generating…" : "Generate topic ideas"}
          </button>

                {topicsData && (
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
                        
                        return (
                          <div key={clusterName} className="topic-collapsible-wrapper">
                            {/* Collapsed Header Card */}
                            <div className="topic-header-card-wrapper">
                              <button
                                type="button"
                                className="topic-header-card"
                                onClick={() => toggleClusterExpansion(clusterName)}
                              >
                                <div className="topic-header-content">
                                  <h4 className="topic-cluster-name">
                                    <span className="cluster-number-badge">{clusterNumber}</span>
                                    {clusterName}
                                  </h4>
                                  <div className="topic-header-meta">
                                    {firstTopic && (
                                      <span className="topic-for-problem">
                                        For: {firstTopic.forWho} · Problem: {firstTopic.problem}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="topic-chevron">
                                  {isExpanded ? "▲" : "▼"}
                                </span>
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

                                  return (
                                    <div key={topic.id} className={`topic-preview-card ${isSelected ? "selected" : ""}`}>
                                      {/* Title and Actions */}
                                      <div className="topic-preview-header">
                                        <h5 className="topic-preview-title">{topic.workingTitle}</h5>
                                        <div className="topic-preview-actions">
                                          <label className="topic-checkbox-label">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                toggleTopicSelection(topic.id);
                                              }}
                                            />
                                            <span>Add to queue</span>
                                          </label>
                                        </div>
                                      </div>

                                      {/* Quick Generate Button - appears when topic is selected */}
                                      {isSelected && (
                                        <div className="topic-quick-generate">
                                          <button
                                            type="button"
                                            className="btn-quick-generate"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              await handleQuickGenerate(topic);
                                            }}
                                            disabled={isGeneratingArticles || generatedArticles.some(a => a.topicTitle === topic.id && a.status === "generating")}
                                          >
                                            {generatedArticles.some(a => a.topicTitle === topic.id && a.status === "generating")
                                              ? "Generating…"
                                              : "Generate article"}
                                          </button>
                                        </div>
                                      )}

                                      {/* Primary Keyword */}
                                      <div className="topic-preview-field">
                                        <strong className="preview-label">Primary keyword:</strong>
                                        <p className="preview-value">{topic.primaryKeyword}</p>
                                      </div>

                                      {/* Search Intent Pill */}
                                      <div className="topic-preview-field">
                                        <span className="search-intent-pill-large">
                                          {getSearchIntentLabel(topic.searchIntent)}
                                        </span>
                                      </div>

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
              )}

              {/* Step 2 - Article Draft (only for discovery mode) */}
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
                      {/* Light Human Edit Toggle */}
                      <div className="light-human-edit-toggle">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={lightHumanEditEnabled}
                            onChange={(e) => {
                              setPersistedState(prev => ({
                                ...prev,
                                lightHumanEditEnabled: e.target.checked
                              }));
                            }}
                            disabled={isGeneratingArticles}
                          />
                          <span className="checkbox-text">
                            <strong>Light Human Edit</strong> (recommended)
                            <span className="checkbox-hint">Improves text flow and naturalness</span>
                          </span>
                        </label>
                      </div>

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

            </div>
          </div>
          ) : (
          <>
            {/* Single-column layout for direct and rewrite modes */}
            {/* Direct Article Creation Mode - Single Step */}
            {mode === "direct" && (
            <div className="two-column-layout">
              {/* Step 1 – Generate article from brief */}
              <div className="step-card step-card-active">
                <div className="step-header">
                  <h3>Step 1 – Generate article from brief</h3>
                  <p className="step-description">
                    Paste a detailed client brief or technical task (requirements, links, examples, tone, SEO details, etc.) and get a ready article. The system will analyze your brief, research trusted sources, and generate a complete article.
                  </p>
                </div>

                <div className="step-content">
                  <label>
                    <span>Client brief / technical task</span>
                    <textarea
                      value={clientBrief}
                      onChange={(e) => updateClientBrief(e.target.value)}
                      placeholder="Paste the detailed client brief here (topic, goals, target audience, tone, SEO requirements, links, examples, etc.)"
                      rows={8}
                      style={{ minHeight: "220px", resize: "vertical" }}
                      disabled={isGeneratingArticles}
                    />
                    <small>
                      {clientBrief.length} / 6000 characters
                      {clientBrief.length < 50 && clientBrief.length > 0 && (
                        <span style={{ color: "#f44336", marginLeft: "8px" }}>
                          Minimum 50 characters required
                        </span>
                      )}
                    </small>
                  </label>

                  <div className="light-human-edit-toggle">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={lightHumanEditEnabled}
                        onChange={(e) => {
                          setPersistedState(prev => ({
                            ...prev,
                            lightHumanEditEnabled: e.target.checked
                          }));
                        }}
                        disabled={isGeneratingArticles}
                      />
                      <span className="checkbox-text">
                        <strong>Light Human Edit</strong> (recommended)
                        <span className="checkbox-hint">Improves text flow and naturalness</span>
                      </span>
                    </label>
                  </div>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={generateArticleFromBrief}
                      disabled={isGeneratingArticles || clientBrief.length < 50}
                    >
                      {isGeneratingArticles ? "Generating…" : "Generate article from brief"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 – Article context (optional) */}
              <div className="step-card step-card-active">
                <div className="step-header">
                  <h3>Step 2 – Article context (optional)</h3>
                  <p className="step-description">
                    These fields help align the article with your niche, brand, SEO focus and target length.
                  </p>
                </div>

                <div className="step-content">
                  <div className="form-fields">
                    <label>
                      <span>Niche or industry (optional)</span>
                      <input
                        type="text"
                        value={directArticleSettings.nicheOrIndustry || ""}
                        onChange={(e) => updateDirectArticleSettings({ nicheOrIndustry: e.target.value || undefined })}
                        placeholder="e.g. Music promotion"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Brand / company name (optional)</span>
                      <input
                        type="text"
                        value={directArticleSettings.brandName || ""}
                        onChange={(e) => updateDirectArticleSettings({ brandName: e.target.value || undefined })}
                        placeholder="e.g. Universal Content Creator"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Anchor / primary keyword (optional)</span>
                      <input
                        type="text"
                        value={directArticleSettings.anchorKeyword || ""}
                        onChange={(e) => updateDirectArticleSettings({ anchorKeyword: e.target.value || undefined })}
                        placeholder="e.g. music promotion services"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Target word count (optional)</span>
                      <input
                        type="number"
                        value={directArticleSettings.targetWordCount || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDirectArticleSettings({
                            targetWordCount: val ? (isNaN(parseInt(val)) ? undefined : parseInt(val)) : undefined,
                          });
                        }}
                        placeholder="e.g. 1200"
                        min="100"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Writing style (optional)</span>
                      <select
                        value={directArticleSettings.writingStyle || ""}
                        onChange={(e) => updateDirectArticleSettings({ writingStyle: e.target.value || undefined })}
                        disabled={isGeneratingArticles}
                      >
                        <option value="">Select style...</option>
                        <option value="neutral">Neutral</option>
                        <option value="friendly-expert">Friendly Expert</option>
                        <option value="journalistic">Journalistic</option>
                        <option value="conversational">Conversational</option>
                        <option value="professional">Professional</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Rewrite Article Mode */}
            {mode === "rewrite" && (
            <div className="two-column-layout">
              {/* Step 1 – Rewrite article */}
              <div className="step-card step-card-active">
                <div className="step-header">
                  <h3>Step 1 – Rewrite article</h3>
                  <p className="step-description">
                    Paste an existing article and the AI will deeply analyze and rewrite it, improving structure, clarity, SEO, and overall quality while preserving the core meaning.
                  </p>
                </div>

                <div className="step-content">
                  <label>
                    <span>Original article</span>
                    <textarea
                      value={originalArticle}
                      onChange={(e) => updateOriginalArticle(e.target.value)}
                      placeholder="Paste the full article you want to rewrite or improve..."
                      rows={10}
                      style={{ minHeight: "250px", resize: "vertical" }}
                      disabled={isGeneratingArticles}
                    />
                    <small>
                      {originalArticle.length} characters
                      {originalArticle.length < 100 && originalArticle.length > 0 && (
                        <span style={{ color: "#f44336", marginLeft: "8px" }}>
                          Minimum 100 characters required
                        </span>
                      )}
                    </small>
                  </label>

                  <div className="light-human-edit-toggle">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={lightHumanEditEnabled}
                        onChange={(e) => {
                          setPersistedState(prev => ({
                            ...prev,
                            lightHumanEditEnabled: e.target.checked
                          }));
                        }}
                        disabled={isGeneratingArticles}
                      />
                      <span className="checkbox-text">
                        <strong>Light Human Edit</strong> (recommended)
                        <span className="checkbox-hint">Improves text flow and naturalness</span>
                      </span>
                    </label>
                  </div>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={rewriteArticle}
                      disabled={isGeneratingArticles || originalArticle.length < 100}
                    >
                      {isGeneratingArticles ? "Rewriting…" : "Rewrite article"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 – Article context (optional) */}
              <div className="step-card step-card-active">
                <div className="step-header">
                  <h3>Step 2 – Article context (optional)</h3>
                  <p className="step-description">
                    These fields help align the article with your niche, brand, SEO focus and target length.
                  </p>
                </div>

                <div className="step-content">
                  <div className="form-fields">
                    <label>
                      <span>Additional brief / notes (optional)</span>
                      <textarea
                        value={rewriteParams.additionalBrief || ""}
                        onChange={(e) => updateRewriteParams({ additionalBrief: e.target.value || undefined })}
                        placeholder="e.g. Keep the structure similar, make tone more conversational, avoid promising guaranteed results, highlight organic growth and transparency."
                        rows={3}
                        style={{ minHeight: "88px", resize: "vertical" }}
                        disabled={isGeneratingArticles}
                      />
                      <small>Use this to add extra instructions for the rewrite: must-keep points, tone preferences, SEO notes, or things to avoid.</small>
                    </label>

                    <label>
                      <span>Niche or industry (optional)</span>
                      <input
                        type="text"
                        value={rewriteParams.niche || ""}
                        onChange={(e) => updateRewriteParams({ niche: e.target.value || undefined })}
                        placeholder="e.g. Music promotion"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Brand / company name (optional)</span>
                      <input
                        type="text"
                        value={rewriteParams.brandName || ""}
                        onChange={(e) => updateRewriteParams({ brandName: e.target.value || undefined })}
                        placeholder="e.g. Universal Content Creator"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Anchor / primary keyword (optional)</span>
                      <input
                        type="text"
                        value={rewriteParams.anchorKeyword || ""}
                        onChange={(e) => updateRewriteParams({ anchorKeyword: e.target.value || undefined })}
                        placeholder="e.g. music promotion services"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Target word count (optional)</span>
                      <input
                        type="number"
                        value={rewriteParams.targetWordCount || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateRewriteParams({ 
                            targetWordCount: val ? (isNaN(parseInt(val)) ? undefined : parseInt(val)) : undefined 
                          });
                        }}
                        placeholder="e.g. 2000"
                        min="100"
                        disabled={isGeneratingArticles}
                      />
                    </label>

                    <label>
                      <span>Writing style (optional)</span>
                      <select
                        value={rewriteParams.style || ""}
                        onChange={(e) => updateRewriteParams({ style: e.target.value || undefined })}
                        disabled={isGeneratingArticles}
                      >
                        <option value="">Select style...</option>
                        <option value="neutral">Neutral</option>
                        <option value="friendly-expert">Friendly Expert</option>
                        <option value="journalistic">Journalistic</option>
                        <option value="conversational">Conversational</option>
                        <option value="professional">Professional</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            )}
          </>
          )}

        {/* Generated Articles Section */}
        {generatedArticles.length > 0 && (
          <div className="generated-articles-section" ref={generatedArticlesSectionRef}>
                  <h3 className="section-title">
                    {mode === "rewrite" 
                      ? "Rewritten Articles" 
                      : mode === "direct"
                      ? "Generated Articles"
                      : "Generated Articles"}
                  </h3>
                  <div className="articles-list">
                    {generatedArticles.map((article) => {
                      const topicId = article.topicTitle;
                      const topic = topicsData?.topics.find(t => t.id === topicId);
                      const isEditing = editingArticles.has(topicId);
                      const isViewing = viewingArticle === topicId;
                      const articleText = getArticleText(article);
                      
                      const articleTitle = getArticleTitle(article, topic);
                      const articleSummary = getArticleSummary(article, topic);
                      const wordCount = getWordCount(articleText);
                      const formattedWordCount = formatWordCount(wordCount);
                      // For Direct and Rewrite modes, use titleTag if available, otherwise use topicId
                      const topicTitle = topic?.workingTitle || (article.titleTag ? stripHtmlTags(article.titleTag) : topicId);
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
                                  {isViewing ? "Close" : "View"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={() => toggleArticleEdit(topicId)}
                                >
                                  {isEditing ? "Save" : "Edit"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(articleText).catch(() => {});
                                    setCopyStatus("copied");
                                    setTimeout(() => setCopyStatus("idle"), 2000);
                                  }}
                                >
                                  {copyStatus === "copied" && viewingArticle === topicId ? "Copied!" : "Copy text"}
                                </button>
                                <div className="download-dropdown-wrapper">
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={(e) => {
                                      const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                                      dropdown?.classList.toggle("show");
                                    }}
                                  >
                                    Download ▼
                                  </button>
                                  <div className="download-dropdown">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        downloadArticle(topicId, articleText, "txt");
                                        (document.querySelector(".download-dropdown.show") as HTMLElement)?.classList.remove("show");
                                      }}
                                    >
                                      Plain text (.txt)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        downloadArticle(topicId, articleText, "html");
                                        (document.querySelector(".download-dropdown.show") as HTMLElement)?.classList.remove("show");
                                      }}
                                    >
                                      HTML (.html)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        downloadArticle(topicId, articleText, "pdf");
                                        (document.querySelector(".download-dropdown.show") as HTMLElement)?.classList.remove("show");
                                      }}
                                    >
                                      PDF (.pdf)
                                    </button>
                                  </div>
                                </div>
                                {/* Only show Regenerate button for Topic Discovery Mode */}
                                {mode === "discovery" && topic && (
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={() => regenerateArticleForTopic(topicId)}
                                    disabled={isGeneratingArticles}
                                  >
                                    Regenerate
                                  </button>
                                )}
                              </div>

                              {/* View Modal */}
                              {isViewing && (
                                <div className="article-view-modal">
                                  <div className="article-view-content">
                                    <div className="article-view-header">
                                      <h1 className="article-view-title">{article.titleTag || topic?.workingTitle || topicId}</h1>
                                      <div className="article-view-header-actions">
                                        <button
                                          type="button"
                                          className="btn-outline btn-sm"
                                          onClick={async () => {
                                            const html = article.articleBodyHtml || article.fullArticleText || articleText;
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
                                          {copyStatus === "copied" && viewingArticle === topicId ? "Copied!" : "Copy text"}
                                        </button>
                                        <button
                                          type="button"
                                          className="close-modal-btn"
                                          onClick={() => setViewingArticle(null)}
                                        >
                                          ×
                                        </button>
                                      </div>
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
                                              const htmlContent = article.articleBodyHtml || article.fullArticleText || articleText;
                                              return htmlContent.replace(/H[1-3]:\s*/gi, '');
                                            })()
                                          }} 
                                        />
                                      </section>
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
                                      value={articleText}
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
                            </div>
                          ) : article && article.status === "generating" ? (
                            <div className="article-generating">
                              <p>Generating article…</p>
                            </div>
                          ) : article && article.status === "error" ? (
                            <div className="article-error">
                              <p>Failed to generate article. Please try again.</p>
                            </div>
                          ) : (
                            <div className="topic-preview">
                              {topic && (
                                <>
                                  <div className="topic-preview-meta">
                                    <span className="topic-keyword">{topic.primaryKeyword}</span>
                                  </div>
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

"use client";

import { useState, useEffect } from "react";

interface LoadingOverlayProps {
  isOpen: boolean;
  mode: "topics" | "articles" | "image";
}

// Existing messages (keep all of them)
const existingTopicsMessages = [
  "Scanning what real editors would actually say yes to…",
  "Filtering out generic '10 tips' content…",
  "Finding angles that support your anchor naturally…",
];

const existingArticlesMessages = [
  "Drafting a human-sounding article, not robotic fluff…",
  "Weaving your anchor into the story…",
  "Balancing SEO structure with real reader value…",
];

// New messages (append to existing ones)
const newTopicsMessages = [
  "Checking if these ideas are worth a backlink, not just a click…",
  "Digging past the \"10 tips to grow\" fluff…",
  "Cross-checking music blogs, creator forums and platform docs…",
  "Going one layer deeper than generic AI content…",
  "Making sure your anchor actually fits the topic, not the other way around…",
];

const newArticlesMessages = [
  "Structuring an article a real editor wouldn't delete on sight…",
  "Making sure your anchor link feels natural, not spammy…",
  "Filling the gaps with data, not filler sentences…",
  "Cutting robotic phrasing so it sounds like a human strategist…",
  "Double-checking that this actually helps a musician, not just an algorithm…",
];

const imageMessages = [
  "Composing the perfect visual concept…",
  "Selecting color palette and mood…",
  "Crafting cinematic lighting and depth…",
  "Refining details for professional quality…",
  "Ensuring art-direction-level polish…",
  "Adding subtle motion and atmosphere…",
  "Balancing composition and negative space…",
];

// Merge existing + new messages
const topicsMessages = [...existingTopicsMessages, ...newTopicsMessages];
const articlesMessages = [...existingArticlesMessages, ...newArticlesMessages];

export default function LoadingOverlay({ isOpen, mode }: LoadingOverlayProps) {
  const messages = mode === "topics" ? topicsMessages : mode === "articles" ? articlesMessages : imageMessages;
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const title = mode === "topics" 
    ? "Researching outreach ideas…" 
    : mode === "articles" 
    ? "Writing your outreach articles…"
    : "Creating your hero image…";

  // Message rotation (every 3-4 seconds)
  useEffect(() => {
    if (!isOpen) return;
    
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3500); // 3.5 seconds for variety
    
    return () => clearInterval(messageInterval);
  }, [isOpen, messages.length]);

  // Timer (updates every second)
  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isOpen]);

  // Format elapsed time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-backdrop" />
      <div className="loading-overlay-card">
        <h4 className="loading-title">{title}</h4>
        
        {/* Equalizer Bars */}
        <div className="equalizer-container">
          {[1, 2, 3, 4, 5, 6, 7].map((index) => (
            <div
              key={index}
              className="equalizer-bar"
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Rotating Status Messages */}
        <div className="loading-messages">
          {messages.map((message, index) => (
            <p
              key={message}
              className={`loading-message ${index === currentMessageIndex ? "active" : ""}`}
            >
              {message}
            </p>
          ))}
        </div>

        {/* Timer */}
        <div className="loading-timer">
          <span className="loading-timer-icon">⏱</span>
          <span className="loading-timer-text">Elapsed: {formatTime(elapsedSeconds)}</span>
        </div>
      </div>
    </div>
  );
}


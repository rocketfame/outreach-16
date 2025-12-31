"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface NotificationProps {
  message: string;
  time: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function Notification({ message, time, isVisible, onClose }: NotificationProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      onClose();
    }, 200); // Wait for slide-out animation
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsClosing(false);
      // Auto-close after 2 seconds with slide-out animation
      timerRef.current = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      setIsClosing(true);
      setTimeout(() => {
        setShouldRender(false);
      }, 200);
    }
  }, [isVisible, handleClose]);

  if (!shouldRender) return null;

  return (
    <div className={`notification ${shouldRender && isVisible && !isClosing ? "notification-visible" : ""} ${isClosing ? "notification-closing" : ""}`}>
      <div className="notification-content">
        <p className="notification-message">{message}</p>
        <span className="notification-time">{time}</span>
      </div>
      <button 
        className="notification-close" 
        onClick={handleClose}
        aria-label="Close notification"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}


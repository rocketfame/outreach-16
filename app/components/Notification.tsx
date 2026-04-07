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

  // Derive visibility-related state during render when `isVisible` changes
  // (React-recommended pattern — avoids cascading renders from setState-in-effect).
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevIsVisible, setPrevIsVisible] = useState(isVisible);
  if (prevIsVisible !== isVisible) {
    setPrevIsVisible(isVisible);
    if (isVisible) {
      setShouldRender(true);
      setIsClosing(false);
    } else {
      setIsClosing(true);
    }
  }

  // Side effects only (no synchronous setState): auto-close timer on open,
  // delayed unmount on close.
  useEffect(() => {
    if (isVisible) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    const unmountTimer = setTimeout(() => {
      setShouldRender(false);
    }, 200);
    return () => clearTimeout(unmountTimer);
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


"use client";

import { useEffect, useState } from "react";

interface NotificationProps {
  message: string;
  time: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function Notification({ message, time, isVisible, onClose }: NotificationProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsClosing(false);
      // Auto-close after 4 seconds with slide-out animation
      const timer = setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => {
          setShouldRender(false);
          onClose();
        }, 400); // Wait for slide-out animation
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setIsClosing(true);
      setTimeout(() => {
        setShouldRender(false);
      }, 400);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  return (
    <div className={`notification ${shouldRender && isVisible && !isClosing ? "notification-visible" : ""} ${isClosing ? "notification-closing" : ""}`}>
      <div className="notification-content">
        <p className="notification-message">{message}</p>
        <span className="notification-time">{time}</span>
      </div>
    </div>
  );
}


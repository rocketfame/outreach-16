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

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        setShouldRender(false);
        setTimeout(() => {
          onClose();
        }, 300); // Wait for fade-out animation
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(false);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  return (
    <div className={`notification ${shouldRender && isVisible ? "notification-visible" : ""}`}>
      <div className="notification-content">
        <p className="notification-message">{message}</p>
        <span className="notification-time">{time}</span>
      </div>
    </div>
  );
}


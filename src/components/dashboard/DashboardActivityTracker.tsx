"use client";

import { useEffect } from "react";

import { useAuth } from "../../context/AuthContext";

const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;
const MIN_SEND_INTERVAL_MS = 60 * 1000;

export function DashboardActivityTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let lastSentAt = 0;

    const registerActivity = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastSentAt < MIN_SEND_INTERVAL_MS) return;
      lastSentAt = now;

      fetch("/api/dashboard-activity", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") registerActivity();
    };

    registerActivity();
    const interval = window.setInterval(registerActivity, ACTIVITY_INTERVAL_MS);
    window.addEventListener("focus", registerActivity);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", registerActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user]);

  return null;
}

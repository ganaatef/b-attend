"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

const STORAGE_KEY = "demo-banner-dismissed";

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    // One-time post-hydration init from localStorage — safe, no cascade
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 font-medium">
        Demo Environment — This is a demonstration with sample data
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="ml-2 shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-200 hover:text-amber-900"
        aria-label="Dismiss demo banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

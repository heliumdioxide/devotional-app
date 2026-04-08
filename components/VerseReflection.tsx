"use client";

import { useState, useImperativeHandle, forwardRef } from "react";

type Language = "english" | "chinese" | "both";

type Reflection = {
  observation: string;
  interpretation: string;
  application: string;
  insight: string;
};

type Props = {
  verseReference: string;
  verseTextEnglish: string;
  verseTextChinese: string;
  chapterTextEnglish: string;
  chapterTextChinese: string;
  language: Language;
  onLoadingChange?: (loading: boolean) => void;
};

export type VerseReflectionHandle = {
  trigger: () => void;
};

const VerseReflection = forwardRef<VerseReflectionHandle, Props>(function VerseReflection(
  {
    verseReference,
    verseTextEnglish,
    verseTextChinese,
    chapterTextEnglish,
    chapterTextChinese,
    language,
    onLoadingChange,
  },
  ref
) {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [triggered, setTriggered] = useState(false);

  const isChinese = language === "chinese";

  async function loadReflection() {
    if (loading || reflection) return;
    setTriggered(true);
    setLoading(true);
    onLoadingChange?.(true);
    try {
      setError("");
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verseReference,
          verseTextEnglish,
          verseTextChinese,
          chapterTextEnglish,
          chapterTextChinese,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setReflection(data);
    } catch (err: any) {
      setError(err.message || "Failed to load reflection");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  // Expose trigger() to parent via ref
  useImperativeHandle(ref, () => ({
    trigger: loadReflection,
  }));

  const labels = isChinese
    ? { observation: "觀察", interpretation: "解釋", application: "應用", insight: "反思" }
    : { observation: "Observation", interpretation: "Interpretation", application: "Application", insight: "Insight" };

  if (!triggered) return null;

  if (loading) {
    return (
      <div className="reflection-loading">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
    );
  }

  if (error) {
    return <p className="reflection-error">{error}</p>;
  }

  if (!reflection) return null;

  return (
    <div className="reflection-card">
      <div className="reflection-section">
        <h4>{labels.observation}</h4>
        <p>{reflection.observation}</p>
      </div>
      <div className="reflection-section">
        <h4>{labels.interpretation}</h4>
        <p>{reflection.interpretation}</p>
      </div>
      <div className="reflection-section">
        <h4>{labels.application}</h4>
        <p>{reflection.application}</p>
      </div>
      <div className="reflection-section insight">
        <h4>{labels.insight}</h4>
        <p>{reflection.insight}</p>
      </div>
    </div>
  );
});

export default VerseReflection;
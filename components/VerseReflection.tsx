"use client";

import { useState, useImperativeHandle, forwardRef } from "react";

type Language = "english" | "chinese" | "both";

type Reflection = {
  keyVerse: string;
  insights: string[];
  reflection: string;
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
      const insights = Array.isArray(data.insights)
        ? data.insights
        : typeof data.insights === "string"
          ? [data.insights]
          : [];
      setReflection({
        keyVerse: String(data.keyVerse ?? ""),
        insights,
        reflection: String(data.reflection ?? ""),
      });
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
    ? { keyVerse: "關鍵經文", insights: "亮點", reflection: "反思" }
    : { keyVerse: "Key verse", insights: "Insights", reflection: "Reflection" };

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
        <h4>{labels.keyVerse}</h4>
        <p>{reflection.keyVerse}</p>
      </div>
      <div className="reflection-section">
        <h4>{labels.insights}</h4>
        <ul className="reflection-insights">
          {reflection.insights.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="reflection-section insight">
        <h4>{labels.reflection}</h4>
        <p>{reflection.reflection}</p>
      </div>
    </div>
  );
});

export default VerseReflection;
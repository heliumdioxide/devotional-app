"use client";

import { useState } from "react";

interface Props {
  verseReference: string;
  verseTextEnglish: string;
  verseTextChinese: string;
  chapterTextEnglish: string;
  chapterTextChinese: string;
  language: "english" | "chinese" | "both";
}

interface Reflection {
  observation: string;
  interpretation: string;
  application: string;
  insight: string;
}

export default function VerseReflection({
  verseReference,
  verseTextEnglish,
  verseTextChinese,
  chapterTextEnglish,
  chapterTextChinese,
  language,
}: Props) {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChinese = language === "chinese";

  const labels = isChinese
    ? {
        button: "✦ 靈修默想",
        observation: "觀察",
        interpretation: "解釋",
        application: "應用",
        insight: "反思",
        reset: "↺ 重新默想",
        errorMsg: "出了點問題，請再試一次。",
      }
    : {
        button: "✦ Reflect on this verse",
        observation: "Observation",
        interpretation: "Interpretation",
        application: "Application",
        insight: "Insight",
        reset: "↺ Generate new reflection",
        errorMsg: "Something went wrong. Please try again.",
      };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setReflection(null);

    try {
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseReference, verseTextEnglish, verseTextChinese, chapterTextEnglish, chapterTextChinese, language }),
      });

      if (!res.ok) throw new Error("Failed to generate reflection");

      const data = await res.json();
      setReflection(data);
    } catch (err) {
      setError(labels.errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reflection-container">
      {!reflection && !loading && (
        <button onClick={generate} className="reflect-button">
          {labels.button}
        </button>
      )}

      {loading && (
        <div className="reflection-loading">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      )}

      {error && <p className="reflection-error">{error}</p>}

      {reflection && (
        <div className="reflection-card">
          <div className="reflection-section">
            <h4>📖 {labels.observation}</h4>
            <p>{reflection.observation}</p>
          </div>
          <div className="reflection-section">
            <h4>🔍 {labels.interpretation}</h4>
            <p>{reflection.interpretation}</p>
          </div>
          <div className="reflection-section">
            <h4>✋ {labels.application}</h4>
            <p>{reflection.application}</p>
          </div>
          <div className="reflection-section insight">
            <h4>💡 {labels.insight}</h4>
            <p>{reflection.insight}</p>
          </div>
          <button onClick={() => setReflection(null)} className="reflect-reset">
            {labels.reset}
          </button>
        </div>
      )}
    </div>
  );
}
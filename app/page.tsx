"use client";

import { useEffect, useState, useRef } from "react";

type VerseData = {
  reference: string;
  content: string;
};

type ApiVerseResponse = {
  reference: string;
  english: string;
  chinese: string;
  verseId?: string;
  error?: string;
};

export default function Home() {
  const [english, setEnglish] = useState<VerseData | null>(null);
  const [chinese, setChinese] = useState<VerseData | null>(null);
  const [verseId, setVerseId] = useState<string>("");
  const [chapterEnglish, setChapterEnglish] = useState<VerseData | null>(null);
  const [chapterChinese, setChapterChinese] = useState<VerseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [error, setError] = useState("");
  const [chapterError, setChapterError] = useState("");
  const chapterRef = useRef<HTMLDivElement>(null);

  async function loadRandomVerse() {
    try {
      setLoading(true);
      setError("");
      setChapterEnglish(null);
      setChapterChinese(null);
      setChapterError("");

      const res = await fetch(`/api/verse?t=${Date.now()}`, { cache: "no-store" });
      const data: ApiVerseResponse = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load verse");

      setEnglish({ reference: data.reference, content: data.english });
      setChinese({ reference: data.reference, content: data.chinese });
      setVerseId(data.verseId || "");
    } catch (err: any) {
      setError(err.message || "Failed to load verse");
    } finally {
      setLoading(false);
    }
  }

  async function loadFullChapter() {
    if (!verseId) return;
    try {
      setChapterLoading(true);
      setChapterError("");

      const res = await fetch(`/api/chapter?verseId=${verseId}`, { cache: "no-store" });
      const data: ApiVerseResponse = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load chapter");

      setChapterEnglish({ reference: data.reference, content: data.english });
      setChapterChinese({ reference: data.reference, content: data.chinese });

      setTimeout(() => {
        chapterRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setChapterError(err.message || "Failed to load chapter");
    } finally {
      setChapterLoading(false);
    }
  }

  useEffect(() => {
    loadRandomVerse();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #000;
          color: #e8e0d0;
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
        }

        .page {
          max-width: 900px;
          margin: 0 auto;
          padding: 48px 20px 80px;
        }

        .header {
          margin-bottom: 48px;
          border-bottom: 1px solid #222;
          padding-bottom: 24px;
        }

        .label {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #555;
          margin-bottom: 8px;
        }

        .title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(28px, 6vw, 48px);
          font-weight: 300;
          color: #f0e8d8;
          line-height: 1.1;
        }

        .new-verse-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: 1px solid #333;
          background: transparent;
          color: #888;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 2px;
          margin-bottom: 40px;
        }

        .new-verse-btn:hover:not(:disabled) {
          border-color: #666;
          color: #ccc;
        }

        .new-verse-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 1px solid #555;
          border-top-color: #aaa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .verse-reference {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(20px, 4vw, 28px);
          font-weight: 300;
          font-style: italic;
          color: #c8b89a;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
        }

        .verse-section-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 20px;
        }

        .columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: #1a1a1a;
          border: 1px solid #1a1a1a;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 32px;
        }

        @media (max-width: 600px) {
          .columns { grid-template-columns: 1fr; }
        }

        .col {
          background: #0a0a0a;
          padding: 28px 24px;
        }

        .col-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 16px;
        }

        .verse-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(17px, 2.5vw, 20px);
          font-weight: 300;
          line-height: 1.8;
          color: #d0c8b8;
          white-space: pre-wrap;
        }

        .chapter-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          color: #c8b89a;
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px;
          font-style: italic;
          cursor: pointer;
          transition: all 0.25s;
          border-radius: 2px;
          margin-bottom: 40px;
        }

        .chapter-btn:hover:not(:disabled) {
          background: #111;
          border-color: #444;
          color: #e8d8b8;
        }

        .chapter-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .chapter-arrow {
          font-size: 18px;
          transition: transform 0.2s;
        }

        .chapter-btn:hover .chapter-arrow {
          transform: translateY(2px);
        }

        .divider {
          border: none;
          border-top: 1px solid #1a1a1a;
          margin: 40px 0;
        }

        .chapter-reference {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(18px, 3.5vw, 24px);
          font-weight: 300;
          font-style: italic;
          color: #888;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
        }

        .error {
          color: #c0392b;
          font-size: 13px;
          margin-bottom: 16px;
          padding: 12px 16px;
          border: 1px solid #3a1a1a;
          border-radius: 2px;
          background: #0f0505;
        }
      `}</style>

      <main className="page">
        <div className="header">
          <p className="label">Daily Reading</p>
          <h1 className="title">Daily Devotional</h1>
        </div>

        <button
          onClick={loadRandomVerse}
          disabled={loading}
          className="new-verse-btn"
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? "Loading" : "↻ New verse"}
        </button>

        {error && <p className="error">{error}</p>}

        {english && chinese && (
          <>
            <p className="verse-section-label">Today's verse</p>
            <h2 className="verse-reference">{english.reference}</h2>

            <div className="columns">
              <div className="col">
                <p className="col-label">English</p>
                <p className="verse-text">{english.content}</p>
              </div>
              <div className="col">
                <p className="col-label">繁體中文</p>
                <p className="verse-text">{chinese.content}</p>
              </div>
            </div>

            {!chapterEnglish && (
              <button
                onClick={loadFullChapter}
                disabled={chapterLoading}
                className="chapter-btn"
              >
                {chapterLoading
                  ? "Loading chapter..."
                  : <>Read full chapter <span className="chapter-arrow">↓</span></>}
              </button>
            )}
          </>
        )}

        {chapterError && <p className="error">{chapterError}</p>}

        {chapterEnglish && chapterChinese && (
          <>
            <hr className="divider" />
            <div ref={chapterRef}>
              <p className="verse-section-label">Full chapter</p>
              <h2 className="chapter-reference">{chapterEnglish.reference}</h2>

              <div className="columns">
                <div className="col">
                  <p className="col-label">English</p>
                  <p className="verse-text">{chapterEnglish.content}</p>
                </div>
                <div className="col">
                  <p className="col-label">繁體中文</p>
                  <p className="verse-text">{chapterChinese.content}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
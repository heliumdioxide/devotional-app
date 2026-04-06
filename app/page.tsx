"use client";

import { useEffect, useState, useRef } from "react";

type VerseData = {
  reference: string;
  content: string;
};

type Segment =
  | { type: "heading"; text: string }
  | { type: "verses"; verses: { number: string; text: string }[] };

type ApiVerseResponse = {
  reference: string;
  english: string;
  chinese: string;
  verseId?: string;
  error?: string;
};

type ApiChapterResponse = {
  reference: string;
  english: string;
  chinese: string;
  englishSegments?: Segment[];
  chineseSegments?: Segment[];
  error?: string;
};

type Language = "english" | "chinese" | "both";

function getTodaySeed(): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return parseInt(`${y}${m}${d}`, 10);
}

function parseChapterText(raw: string): Segment[] {
  const segments: Segment[] = [];
  const parts = raw.split(/\[(\d+)\]/);
  let currentVerses: { number: string; text: string }[] = [];

  function flushVerses() {
    if (currentVerses.length > 0) {
      segments.push({ type: "verses", verses: currentVerses });
      currentVerses = [];
    }
  }

  const preamble = parts[0].trim();
  if (preamble) segments.push({ type: "heading", text: preamble });

  for (let i = 1; i < parts.length; i += 2) {
    const verseNum = parts[i];
    const rawText = parts[i + 1] ?? "";
    const lines = rawText.split("\n");
    let verseText = "";
    const trailingHeadings: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (verseText && !trimmed.startsWith("[")) {
        // Lines ending with punctuation are continuations of the verse (e.g. benedictions),
        // not section headings — append them back to the verse text
        if (/[.!?:;»"』」。！？、；：」』】〕]$/.test(trimmed)) {
          verseText += " " + trimmed;
        } else {
          trailingHeadings.push(trimmed);
        }
      } else {
        verseText += (verseText ? " " : "") + trimmed;
      }
    }

    verseText = verseText.replace(/\s{2,}/g, " ").trim();
    if (verseText) currentVerses.push({ number: verseNum, text: verseText });

    if (trailingHeadings.length > 0) {
      flushVerses();
      for (const h of trailingHeadings) {
        segments.push({ type: "heading", text: h });
      }
    }
  }

  flushVerses();
  return segments;
}

function ChapterContent({ segments }: { segments: Segment[] }) {
  return (
    <div className="chapter-body">
      {segments.map((seg, i) => {
        if (seg.type === "heading") {
          return <p key={i} className="section-heading">{seg.text}</p>;
        }
        return (
          <p key={i} className="verse-block">
            {seg.verses.map((v, j) => (
              <span key={j} className="verse-unit">
                <sup className="verse-num">{v.number}</sup>
                {v.text}
                {j < seg.verses.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [english, setEnglish] = useState<VerseData | null>(null);
  const [chinese, setChinese] = useState<VerseData | null>(null);
  const [verseId, setVerseId] = useState<string>("");
  const [chapterEnglish, setChapterEnglish] = useState<VerseData | null>(null);
  const [chapterChinese, setChapterChinese] = useState<VerseData | null>(null);
  const [englishSegments, setEnglishSegments] = useState<Segment[]>([]);
  const [chineseSegments, setChineseSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [error, setError] = useState("");
  const [chapterError, setChapterError] = useState("");
  const [language, setLanguage] = useState<Language>("both");
  const chapterRef = useRef<HTMLDivElement>(null);

  async function loadDailyVerse() {
    try {
      setLoading(true);
      setError("");
      setChapterEnglish(null);
      setChapterChinese(null);
      setEnglishSegments([]);
      setChineseSegments([]);
      setChapterError("");

      const seed = getTodaySeed();
      const res = await fetch(`/api/verse?seed=${seed}`, { cache: "no-store" });
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
      const data: ApiChapterResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load chapter");

      setChapterEnglish({ reference: data.reference, content: data.english });
      setChapterChinese({ reference: data.reference, content: data.chinese });
      setEnglishSegments(parseChapterText(data.english));
      setChineseSegments(parseChapterText(data.chinese));

      setTimeout(() => {
        chapterRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setChapterError(err.message || "Failed to load chapter");
    } finally {
      setChapterLoading(false);
    }
  }

  useEffect(() => { loadDailyVerse(); }, []);

  const showEnglish = language === "english" || language === "both";
  const showChinese = language === "chinese" || language === "both";

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
          width: 1100px;
          max-width: 100%;
          margin: 0 auto;
          padding: 48px 32px 100px;
        }

        .header {
          margin-bottom: 32px;
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
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 300;
          color: #f0e8d8;
          line-height: 1.1;
        }

        .lang-toggle {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          background: #0d0d0d;
          border: 1px solid #222;
          border-radius: 6px;
          padding: 3px;
          margin-bottom: 40px;
        }

        .lang-btn {
          padding: 7px 18px;
          border: none;
          background: transparent;
          color: #555;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          letter-spacing: 0.08em;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.18s;
          white-space: nowrap;
        }

        .lang-btn:hover:not(.active) { color: #999; background: #161616; }

        .lang-btn.active {
          background: #1e1e1e;
          color: #c8b89a;
          border: 1px solid #2e2e2e;
        }

        .verse-section-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 20px;
        }

        .verse-reference {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(22px, 3vw, 32px);
          font-weight: 300;
          font-style: italic;
          color: #c8b89a;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
        }

        .verse-card {
          background-color: #1a1a1a;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 32px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          width: 100%;
        }

        .verse-card.single { grid-template-columns: 1fr; }

        @media (max-width: 600px) {
          .verse-card { grid-template-columns: 1fr; }
        }

        .col {
          background: #0a0a0a;
          padding: 32px 28px;
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
          font-size: clamp(18px, 2.5vw, 22px);
          font-weight: 300;
          line-height: 1.9;
          color: #d8d0c0;
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
          font-size: 17px;
          font-style: italic;
          cursor: pointer;
          transition: all 0.25s;
          border-radius: 2px;
          margin-bottom: 40px;
        }

        .chapter-btn:hover:not(:disabled) { background: #111; border-color: #444; color: #e8d8b8; }
        .chapter-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .chapter-arrow { font-size: 18px; transition: transform 0.2s; }
        .chapter-btn:hover .chapter-arrow { transform: translateY(2px); }

        .divider {
          border: none;
          border-top: 1px solid #1a1a1a;
          margin: 40px 0;
        }

        .chapter-reference {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(20px, 2.5vw, 28px);
          font-weight: 300;
          font-style: italic;
          color: #888;
          margin-bottom: 40px;
          letter-spacing: 0.02em;
        }

        .chapter-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          width: 100%;
        }

        .chapter-grid.single { grid-template-columns: 1fr; }

        @media (max-width: 700px) {
          .chapter-grid { grid-template-columns: 1fr; gap: 40px; }
        }

        .chapter-col-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 28px;
          padding-bottom: 14px;
          border-bottom: 1px solid #1c1c1c;
        }

        .chapter-body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* True section headings — no trailing punctuation */
        .section-heading {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(16px, 1.6vw, 20px);
          font-weight: 400;
          font-style: italic;
          color: #a09080;
          padding-top: 8px;
          letter-spacing: 0.01em;
        }

        .verse-block {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(16px, 2vw, 19px);
          font-weight: 300;
          line-height: 2.0;
          color: #c8c0b0;
        }

        .verse-unit { display: inline; }

        .verse-num {
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          font-weight: 500;
          color: #8a7050;
          vertical-align: super;
          line-height: 0;
          margin-right: 1px;
          margin-left: 5px;
          user-select: none;
        }

        .verse-unit:first-child .verse-num { margin-left: 0; }

        .chapter-plain {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(16px, 2vw, 19px);
          font-weight: 300;
          line-height: 2.0;
          color: #c8c0b0;
          white-space: pre-wrap;
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 1px solid #555;
          border-top-color: #aaa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .loading-state {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px;
          color: #444;
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 40px 0;
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

        <div className="lang-toggle">
          <button className={`lang-btn ${language === "english" ? "active" : ""}`} onClick={() => setLanguage("english")}>
            English
          </button>
          <button className={`lang-btn ${language === "both" ? "active" : ""}`} onClick={() => setLanguage("both")}>
            Both
          </button>
          <button className={`lang-btn ${language === "chinese" ? "active" : ""}`} onClick={() => setLanguage("chinese")}>
            中文
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {loading && (
          <div className="loading-state">
            <span className="spinner" /> Loading today's verse…
          </div>
        )}

        {!loading && english && chinese && (
          <>
            <p className="verse-section-label">Today's verse</p>
            <h2 className="verse-reference">{english.reference}</h2>

            <div className={`verse-card ${language !== "both" ? "single" : ""}`}>
              {showEnglish && (
                <div className="col">
                  <p className="col-label">English</p>
                  <p className="verse-text">{english.content}</p>
                </div>
              )}
              {showChinese && (
                <div className="col">
                  <p className="col-label">繁體中文</p>
                  <p className="verse-text">{chinese.content}</p>
                </div>
              )}
            </div>

            {!chapterEnglish && (
              <button onClick={loadFullChapter} disabled={chapterLoading} className="chapter-btn">
                {chapterLoading
                  ? "Loading chapter..."
                  : <><span>Read full chapter</span><span className="chapter-arrow">↓</span></>}
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

              <div className={`chapter-grid ${language !== "both" ? "single" : ""}`}>
                {showEnglish && (
                  <div>
                    <p className="chapter-col-label">English</p>
                    {englishSegments.length > 0
                      ? <ChapterContent segments={englishSegments} />
                      : <p className="chapter-plain">{chapterEnglish.content}</p>}
                  </div>
                )}
                {showChinese && (
                  <div>
                    <p className="chapter-col-label">繁體中文</p>
                    {chineseSegments.length > 0
                      ? <ChapterContent segments={chineseSegments} />
                      : <p className="chapter-plain">{chapterChinese.content}</p>}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
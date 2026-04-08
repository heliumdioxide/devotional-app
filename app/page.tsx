"use client";

import { useEffect, useState, useRef } from "react";
import VerseReflection, { type VerseReflectionHandle } from "@/components/VerseReflection";

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
  reason?: string;
  reasonZh?: string;
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

const BOOK_NAME_MAP: Record<string, string> = {
  "Genesis": "創世記", "Exodus": "出埃及記", "Leviticus": "利未記",
  "Numbers": "民數記", "Deuteronomy": "申命記", "Joshua": "約書亞記",
  "Judges": "士師記", "Ruth": "路得記", "1 Samuel": "撒母耳記上",
  "2 Samuel": "撒母耳記下", "1 Kings": "列王紀上", "2 Kings": "列王紀下",
  "1 Chronicles": "歷代志上", "2 Chronicles": "歷代志下", "Ezra": "以斯拉記",
  "Nehemiah": "尼希米記", "Esther": "以斯帖記", "Job": "約伯記",
  "Psalms": "詩篇", "Proverbs": "箴言", "Ecclesiastes": "傳道書",
  "Song of Solomon": "雅歌", "Isaiah": "以賽亞書", "Jeremiah": "耶利米書",
  "Lamentations": "耶利米哀歌", "Ezekiel": "以西結書", "Daniel": "但以理書",
  "Hosea": "何西阿書", "Joel": "約珥書", "Amos": "阿摩司書",
  "Obadiah": "俄巴底亞書", "Jonah": "約拿書", "Micah": "彌迦書",
  "Nahum": "那鴻書", "Habakkuk": "哈巴谷書", "Zephaniah": "西番雅書",
  "Haggai": "哈該書", "Zechariah": "撒迦利亞書", "Malachi": "瑪拉基書",
  "Matthew": "馬太福音", "Mark": "馬可福音", "Luke": "路加福音",
  "John": "約翰福音", "Acts": "使徒行傳", "Romans": "羅馬書",
  "1 Corinthians": "哥林多前書", "2 Corinthians": "哥林多後書", "Galatians": "加拉太書",
  "Ephesians": "以弗所書", "Philippians": "腓立比書", "Colossians": "歌羅西書",
  "1 Thessalonians": "帖撒羅尼迦前書", "2 Thessalonians": "帖撒羅尼迦後書",
  "1 Timothy": "提摩太前書", "2 Timothy": "提摩太後書", "Titus": "提多書",
  "Philemon": "腓利門書", "Hebrews": "希伯來書", "James": "雅各書",
  "1 Peter": "彼得前書", "2 Peter": "彼得後書", "1 John": "約翰一書",
  "2 John": "約翰二書", "3 John": "約翰三書", "Jude": "猶大書",
  "Revelation": "啟示錄",
};

function localizeReference(reference: string, isChinese: boolean): string {
  if (!isChinese) return reference;
  for (const [english, chinese] of Object.entries(BOOK_NAME_MAP)) {
    if (reference.startsWith(english)) {
      return reference.replace(english, chinese);
    }
  }
  return reference;
}

export default function Home() {
  const [english, setEnglish] = useState<VerseData | null>(null);
  const [chinese, setChinese] = useState<VerseData | null>(null);
  const [verseId, setVerseId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [reasonZh, setReasonZh] = useState<string>("");
  const [chapterEnglish, setChapterEnglish] = useState<VerseData | null>(null);
  const [chapterChinese, setChapterChinese] = useState<VerseData | null>(null);
  const [englishSegments, setEnglishSegments] = useState<Segment[]>([]);
  const [chineseSegments, setChineseSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [error, setError] = useState("");
  const [chapterError, setChapterError] = useState("");
  const [language, setLanguage] = useState<Language>("chinese");
  const [reflectionTriggered, setReflectionTriggered] = useState(false);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [firstAction, setFirstAction] = useState<"chapter" | "reflect" | null>(null);

  const chapterRef = useRef<HTMLDivElement>(null);
  const reflectionRef = useRef<HTMLDivElement>(null);
  const reflectionHandle = useRef<VerseReflectionHandle>(null);

  async function loadDailyVerse() {
    try {
      setLoading(true);
      setError("");
      setChapterEnglish(null);
      setChapterChinese(null);
      setEnglishSegments([]);
      setChineseSegments([]);
      setChapterError("");
      setReflectionTriggered(false);
      setReflectionLoading(false);
      setFirstAction(null);
      setReason("");
      setReasonZh("");

      const res = await fetch(`/api/verse-of-the-day`, { cache: "no-store" });
      const data: ApiVerseResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load verse");

      setEnglish({ reference: data.reference, content: data.english });
      setChinese({ reference: data.reference, content: data.chinese });
      setVerseId(data.verseId || "");
      setReason(data.reason || "");
      setReasonZh(data.reasonZh || data.reason || "");
    } catch (err: any) {
      setError(err.message || "Failed to load verse");
    } finally {
      setLoading(false);
    }
  }

  async function loadFullChapter() {
    if (!verseId) return;
    if (!firstAction) setFirstAction("chapter");
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

  function handleReflect() {
    if (!firstAction) setFirstAction("reflect");
    setReflectionTriggered(true);
    setTimeout(() => {
      reflectionHandle.current?.trigger();
      reflectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  useEffect(() => { loadDailyVerse(); }, []);

  const showEnglish = language === "english" || language === "both";
  const showChinese = language === "chinese" || language === "both";
  const isChinese = language === "chinese";
  const verseReady = !loading && english && chinese;

  const chapterBlock = chapterEnglish && chapterChinese ? (
    <>
      <hr className="divider" />
      <div ref={chapterRef}>
        <p className="verse-section-label">{isChinese ? "完整章節" : "Full chapter"}</p>
        <h2 className="chapter-reference">{localizeReference(chapterEnglish.reference, isChinese)}</h2>
        <div className={`chapter-grid ${language !== "both" ? "single" : ""}`}>
          {showEnglish && (
            <div>
              <p className="chapter-col-label">{isChinese ? "英文" : "English"}</p>
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
  ) : null;

  const reflectionBlock = reflectionTriggered ? (
    <div ref={reflectionRef}>
      <hr className="divider" />
      <VerseReflection
        ref={reflectionHandle}
        verseReference={english!.reference}
        verseTextEnglish={english!.content}
        verseTextChinese={chinese!.content}
        chapterTextEnglish={chapterEnglish?.content ?? ""}
        chapterTextChinese={chapterChinese?.content ?? ""}
        language={language}
        onLoadingChange={setReflectionLoading}
      />
    </div>
  ) : null;

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
          padding: 48px 32px 120px;
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
          margin-bottom: 16px;
          letter-spacing: 0.02em;
        }

        .verse-reason {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          color: #7a6a50;
          font-size: clamp(14px, 1.8vw, 17px);
          margin-bottom: 24px;
          line-height: 1.7;
        }

        .verse-card {
          background-color: #1a1a1a;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 48px;
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

        .sticky-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(12px);
          border-top: 1px solid #1e1e1e;
          padding: 14px 32px;
        }

        .sticky-bar-inner {
          width: 1100px;
          max-width: 100%;
          margin: 0 auto;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .sticky-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 13px 24px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px;
          font-style: italic;
          cursor: pointer;
          transition: all 0.25s;
          border-radius: 2px;
          white-space: nowrap;
        }

        .sticky-btn-chapter {
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          color: #c8b89a;
        }
        .sticky-btn-chapter:hover:not(:disabled) { background: #111; border-color: #444; color: #e8d8b8; }
        .sticky-btn-chapter:disabled { opacity: 0.4; cursor: not-allowed; }

        .sticky-btn-reflect {
          background: #13110e;
          border: 1px solid #3a2e1e;
          color: #c8b89a;
        }
        .sticky-btn-reflect:hover:not(:disabled) { background: #1a1510; border-color: #5a4a2e; color: #e8d8b8; }
        .sticky-btn-reflect:disabled { opacity: 0.4; cursor: not-allowed; }

        .chapter-arrow { font-size: 18px; transition: transform 0.2s; }
        .sticky-btn-chapter:hover .chapter-arrow { transform: translateY(2px); }

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

        .reflection-loading {
          display: flex;
          gap: 6px;
          align-items: center;
          padding: 32px 0;
        }
        .loading-dot {
          width: 6px;
          height: 6px;
          background: #c8b89a;
          border-radius: 50%;
          animation: pulse 1.2s ease-in-out infinite;
          opacity: 0.3;
        }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        .reflection-card {
          margin-bottom: 32px;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          background: #0a0a0a;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .reflection-section h4 {
          font-family: 'Inter', sans-serif;
          color: #8a7050;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .reflection-section p {
          font-family: 'Cormorant Garamond', serif;
          color: #c8c0b0;
          font-size: clamp(16px, 2vw, 19px);
          font-weight: 300;
          line-height: 1.9;
        }
        .reflection-section.insight {
          border-top: 1px solid #1c1c1c;
          padding-top: 24px;
        }
        .reflection-section.insight p {
          font-style: italic;
          color: #a09080;
        }

        .reflection-error {
          color: #c0392b;
          font-size: 13px;
          margin-bottom: 16px;
        }

        @media (max-width: 500px) {
          .sticky-bar { padding: 12px 16px; }
          .sticky-btn { font-size: 15px; padding: 12px 16px; }
        }
      `}</style>

      <main className="page">
        <div className="header">
          <p className="label">{isChinese ? "每日靈修" : "Daily Reading"}</p>
          <h1 className="title">{isChinese ? "每日靈修" : "Daily Devotional"}</h1>
        </div>

        <div className="lang-toggle">
          <button className={`lang-btn ${language === "chinese" ? "active" : ""}`} onClick={() => setLanguage("chinese")}>
            中文
          </button>
          <button className={`lang-btn ${language === "both" ? "active" : ""}`} onClick={() => setLanguage("both")}>
            Both
          </button>
          <button className={`lang-btn ${language === "english" ? "active" : ""}`} onClick={() => setLanguage("english")}>
            English
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {loading && (
          <div className="loading-state">
            <span className="spinner" /> {isChinese ? "正在載入今日經文…" : "Loading today's verse…"}
          </div>
        )}

        {verseReady && (
          <>
            <p className="verse-section-label">{isChinese ? "今日經文" : "Today's verse"}</p>
            <h2 className="verse-reference">{localizeReference(english!.reference, isChinese)}</h2>

            {(reason || reasonZh) && (
              <p className="verse-reason">{isChinese ? (reasonZh || reason) : reason}</p>
            )}

            <div className={`verse-card ${language !== "both" ? "single" : ""}`}>
              {showEnglish && (
                <div className="col">
                  <p className="col-label">{isChinese ? "英文" : "English"}</p>
                  <p className="verse-text">{english!.content}</p>
                </div>
              )}
              {showChinese && (
                <div className="col">
                  <p className="col-label">繁體中文</p>
                  <p className="verse-text">{chinese!.content}</p>
                </div>
              )}
            </div>

            {/* Render in click order */}
            {firstAction === "reflect" ? (
              <>
                {reflectionBlock}
                {chapterBlock}
              </>
            ) : (
              <>
                {chapterBlock}
                {reflectionBlock}
              </>
            )}

            {chapterError && <p className="error">{chapterError}</p>}
          </>
        )}
      </main>

      {/* Sticky bar — hides once both actions are done */}
      {verseReady && (!reflectionTriggered || !chapterEnglish) && (
        <div className="sticky-bar">
          <div className="sticky-bar-inner">
            {!chapterEnglish && (
              <button
                onClick={loadFullChapter}
                disabled={chapterLoading}
                className="sticky-btn sticky-btn-chapter"
              >
                {chapterLoading
                  ? <><span className="spinner" /> {isChinese ? "載入中…" : "Loading…"}</>
                  : <><span>{isChinese ? "閱讀完整章節" : "Read full chapter"}</span><span className="chapter-arrow">↓</span></>
                }
              </button>
            )}
            {!reflectionTriggered && (
              <button
                onClick={handleReflect}
                className="sticky-btn sticky-btn-reflect"
              >
                ✦ {isChinese ? "靈修默想" : "Reflect"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
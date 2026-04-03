"use client";

import { useState } from "react";

type ChapterVerse = {
  verse: number;
  text: string;
};

export default function Home() {
  const [verse, setVerse] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chapterVerses, setChapterVerses] = useState<ChapterVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState("");

  const getVerse = async () => {
    try {
      setLoading(true);
      setError("");
      setChapterVerses([]);
      setChapterError("");

      const res = await fetch("https://bible-api.com/?random=verse");
      if (!res.ok) {
        throw new Error("Failed to fetch verse");
      }

      const data = await res.json();
      setVerse(data.text?.trim() || "");
      setReference(data.reference || "");
    } catch {
      setError("Something went wrong while fetching the verse.");
    } finally {
      setLoading(false);
    }
  };

  const getChapterReference = () => {
    if (!reference) return "";
    return reference.split(":")[0];
  };

  const getFullChapter = async () => {
    const chapterRef = getChapterReference();
    if (!chapterRef) return;

    try {
      setChapterLoading(true);
      setChapterError("");
      setChapterVerses([]);

      const res = await fetch(
        `https://bible-api.com/${encodeURIComponent(chapterRef)}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch chapter");
      }

      const data = await res.json();

      setChapterVerses(
        (data.verses || []).map((item: { verse: number; text: string }) => ({
          verse: item.verse,
          text: item.text.trim(),
        }))
      );
    } catch {
      setChapterError("Something went wrong while loading the chapter.");
    } finally {
      setChapterLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">Daily Devotional</h1>
          <p className="text-sm text-neutral-400">
            Start with a verse, then go deeper into the chapter.
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={getVerse}
            disabled={loading}
            className="rounded-2xl border border-white/20 px-5 py-3 transition hover:bg-white hover:text-black disabled:opacity-50"
          >
            {loading ? "Loading..." : "Get Random Verse"}
          </button>
        </div>

        {error && <p className="text-center text-red-400">{error}</p>}

        {(verse || reference) && (
          <div className="space-y-5 rounded-3xl border border-white/10 p-6">
            <div className="space-y-3 text-center">
              <p className="text-lg leading-8 whitespace-pre-line">{verse}</p>
              <p className="text-sm text-neutral-400">{reference}</p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={getFullChapter}
                disabled={chapterLoading}
                className="rounded-2xl border border-white/20 px-5 py-3 transition hover:bg-white hover:text-black disabled:opacity-50"
              >
                {chapterLoading ? "Loading Chapter..." : "Read Full Chapter"}
              </button>
            </div>

            {chapterError && (
              <p className="text-center text-red-400">{chapterError}</p>
            )}

            {chapterVerses.length > 0 && (
              <div className="space-y-5 rounded-2xl border border-white/10 p-5 text-left">
                <h2 className="text-xl font-semibold">
                  {getChapterReference()}
                </h2>

                <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                  {chapterVerses.map((item) => (
                    <div key={item.verse} className="flex items-start gap-4">
                      <span className="w-6 shrink-0 pt-1 text-sm text-neutral-500">
                        {item.verse}
                      </span>
                      <p className="text-base leading-8 text-neutral-100">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
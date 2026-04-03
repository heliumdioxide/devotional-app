"use client";

import { useState } from "react";

export default function Home() {
  const [verse, setVerse] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getVerse = async () => {
    try {
      setLoading(true);
      setError("");
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

  const getChapterLink = () => {
    if (!reference) return "#";
    const chapter = reference.split(":")[0];
    return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(chapter)}`;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Daily Devotional</h1>
          <p className="text-sm text-neutral-400">
            Start with a verse, then go deeper into the chapter.
          </p>
        </div>

        <button
          onClick={getVerse}
          disabled={loading}
          className="px-5 py-3 rounded-2xl border border-white/20 hover:bg-white hover:text-black transition disabled:opacity-50"
        >
          {loading ? "Loading..." : "Get Random Verse"}
        </button>

        {error && <p className="text-red-400">{error}</p>}

        {(verse || reference) && (
          <div className="space-y-4 rounded-2xl border border-white/10 p-6">
            <p className="text-lg leading-8 whitespace-pre-line">{verse}</p>
            <p className="text-sm text-neutral-400">{reference}</p>

            <a
              href={getChapterLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-block px-5 py-3 rounded-2xl border border-white/20 hover:bg-white hover:text-black transition"
            >
              Read Full Chapter
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
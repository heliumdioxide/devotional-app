import { NextResponse } from "next/server";

const API_KEY = process.env.API_BIBLE_KEY?.trim() || "";
const EN_BIBLE_ID = process.env.API_BIBLE_EN?.trim() || "";
const ZH_BIBLE_ID = "a6e06d2c5b90ad89-01";

type Segment =
  | { type: "heading"; text: string }
  | { type: "verses"; verses: { number: string; text: string }[] };

/**
 * Parse raw API.Bible text into structured segments.
 *
 * Raw format looks like:
 *   [1] Verse text.  [2] More text.
 *   Section Heading
 *       [10] Next verse.
 *
 * We split on [N] markers, then detect section headings as lines
 * that appear between verse groups and aren't verse text themselves.
 */
function parseChapterText(raw: string): Segment[] {
  const segments: Segment[] = [];

  // Split by [number] markers — keep the number as a capture group
  const parts = raw.split(/\[(\d+)\]/);

  let currentVerses: { number: string; text: string }[] = [];

  function flushVerses() {
    if (currentVerses.length > 0) {
      segments.push({ type: "verses", verses: currentVerses });
      currentVerses = [];
    }
  }

  // Text before the very first verse marker (rare, but handle it)
  const preamble = parts[0].trim();
  if (preamble) {
    segments.push({ type: "heading", text: preamble });
  }

  // Walk pairs: [verseNumber, text, verseNumber, text, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const verseNum = parts[i];
    const rawText = parts[i + 1] ?? "";

    // Lines in this block — some may be section headings that follow the verse text
    const lines = rawText.split("\n");
    let verseText = "";
    const trailingHeadings: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Once we have verse text, any subsequent non-empty line
      // that looks like a heading (short, no brackets) is treated as one
      if (verseText && !trimmed.startsWith("[")) {
        trailingHeadings.push(trimmed);
      } else {
        verseText += (verseText ? " " : "") + trimmed;
      }
    }

    // Collapse multiple spaces left by the API between verse text
    verseText = verseText.replace(/\s{2,}/g, " ").trim();

    if (verseText) {
      currentVerses.push({ number: verseNum, text: verseText });
    }

    // Section heading found — flush current verse group first
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

async function fetchChapter(bibleId: string, chapterId: string) {
  const url = `https://rest.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?content-type=text`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "api-key": API_KEY,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`UPSTREAM: ${res.status} ${raw}`);
  }

  const json = JSON.parse(raw);
  const content: string = json.data.content.trim();

  return {
    reference: json.data.reference,
    content,
    segments: parseChapterText(content),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const verseId = searchParams.get("verseId");

  if (!verseId) {
    return NextResponse.json({ error: "Missing verseId" }, { status: 400 });
  }

  // "MAT.11.28" → "MAT.11"
  const chapterId = verseId.split(".").slice(0, 2).join(".");

  try {
    const [english, chinese] = await Promise.all([
      fetchChapter(EN_BIBLE_ID, chapterId),
      fetchChapter(ZH_BIBLE_ID, chapterId),
    ]);

    return NextResponse.json({
      reference: english.reference,
      english: english.content,
      chinese: chinese.content,
      englishSegments: english.segments,
      chineseSegments: chinese.segments,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load chapter" },
      { status: 500 }
    );
  }
}
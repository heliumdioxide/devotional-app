import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.API_BIBLE_KEY?.trim() || "";
const EN_BIBLE_ID = process.env.API_BIBLE_EN?.trim() || "";
const ZH_BIBLE_ID = "a6e06d2c5b90ad89-01";

const BOOKS = [
  { id: "GEN", chapters: 50 },
  { id: "EXO", chapters: 40 },
  { id: "LEV", chapters: 27 },
  { id: "NUM", chapters: 36 },
  { id: "DEU", chapters: 34 },
  { id: "JOS", chapters: 24 },
  { id: "JDG", chapters: 21 },
  { id: "RUT", chapters: 4 },
  { id: "1SA", chapters: 31 },
  { id: "2SA", chapters: 24 },
  { id: "1KI", chapters: 22 },
  { id: "2KI", chapters: 25 },
  { id: "1CH", chapters: 29 },
  { id: "2CH", chapters: 36 },
  { id: "EZR", chapters: 10 },
  { id: "NEH", chapters: 13 },
  { id: "EST", chapters: 10 },
  { id: "JOB", chapters: 42 },
  { id: "PSA", chapters: 150 },
  { id: "PRO", chapters: 31 },
  { id: "ECC", chapters: 12 },
  { id: "SNG", chapters: 8 },
  { id: "ISA", chapters: 66 },
  { id: "JER", chapters: 52 },
  { id: "LAM", chapters: 5 },
  { id: "EZK", chapters: 48 },
  { id: "DAN", chapters: 12 },
  { id: "HOS", chapters: 14 },
  { id: "JOL", chapters: 3 },
  { id: "AMO", chapters: 9 },
  { id: "OBA", chapters: 1 },
  { id: "JON", chapters: 4 },
  { id: "MIC", chapters: 7 },
  { id: "NAM", chapters: 3 },
  { id: "HAB", chapters: 3 },
  { id: "ZEP", chapters: 3 },
  { id: "HAG", chapters: 2 },
  { id: "ZEC", chapters: 14 },
  { id: "MAL", chapters: 4 },
  { id: "MAT", chapters: 28 },
  { id: "MRK", chapters: 16 },
  { id: "LUK", chapters: 24 },
  { id: "JHN", chapters: 21 },
  { id: "ACT", chapters: 28 },
  { id: "ROM", chapters: 16 },
  { id: "1CO", chapters: 16 },
  { id: "2CO", chapters: 13 },
  { id: "GAL", chapters: 6 },
  { id: "EPH", chapters: 6 },
  { id: "PHP", chapters: 4 },
  { id: "COL", chapters: 4 },
  { id: "1TH", chapters: 5 },
  { id: "2TH", chapters: 3 },
  { id: "1TI", chapters: 6 },
  { id: "2TI", chapters: 4 },
  { id: "TIT", chapters: 3 },
  { id: "PHM", chapters: 1 },
  { id: "HEB", chapters: 13 },
  { id: "JAS", chapters: 5 },
  { id: "1PE", chapters: 5 },
  { id: "2PE", chapters: 3 },
  { id: "1JN", chapters: 5 },
  { id: "2JN", chapters: 1 },
  { id: "3JN", chapters: 1 },
  { id: "JUD", chapters: 1 },
  { id: "REV", chapters: 22 },
];

// Robust deterministic RNG — works reliably for any seed value
function makeRng(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return function () {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s = (s ^ (s >>> 16)) >>> 0;
    return s / 0x100000000;
  };
}

function seededVerseId(seed: number, offset: number = 0): string {
  const rng = makeRng(seed + offset);
  const bookIndex = Math.min(Math.floor(rng() * BOOKS.length), BOOKS.length - 1);
  const book = BOOKS[bookIndex];
  const chapter = Math.min(Math.floor(rng() * book.chapters) + 1, book.chapters);
  const verse = Math.floor(rng() * 20) + 1;
  return `${book.id}.${chapter}.${verse}`;
}

type ApiBibleVerseResponse = {
  data: {
    reference: string;
    content: string;
  };
};

async function fetchWithKey(url: string) {
  return fetch(url, {
    method: "GET",
    headers: {
      "api-key": API_KEY,
      Accept: "application/json",
    },
    cache: "no-store",
    redirect: "manual",
  });
}

async function fetchVerse(bibleId: string, verseId: string) {
  const url = `https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?content-type=text`;

  let res = await fetchWithKey(url);

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) {
      const raw = await res.text();
      throw new Error(`Redirect without location: ${res.status} ${raw}`);
    }
    res = await fetch(location, {
      method: "GET",
      headers: {
        "api-key": API_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  }

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`UPSTREAM: ${res.status} ${raw}`);
  }

  const json: ApiBibleVerseResponse = JSON.parse(raw);

  return {
    reference: json.data.reference,
    content: json.data.content.trim(),
  };
}

export async function GET(request: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "SERVER: API_BIBLE_KEY is missing" },
      { status: 500 }
    );
  }

  if (!EN_BIBLE_ID) {
    return NextResponse.json(
      { error: "SERVER: API_BIBLE_EN is missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const seed = parseInt(searchParams.get("seed") || "0", 10);

  let english: { reference: string; content: string } | undefined;
  let chinese: { reference: string; content: string } | undefined;
  let verseId = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    verseId = seededVerseId(seed, attempt);
    try {
      [english, chinese] = await Promise.all([
        fetchVerse(EN_BIBLE_ID, verseId),
        fetchVerse(ZH_BIBLE_ID, verseId),
      ]);
      break;
    } catch {
      // try next offset
    }
  }

  if (!english || !chinese) {
    return NextResponse.json(
      { error: "Failed to load verse after multiple attempts" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    reference: english.reference,
    english: english.content,
    chinese: chinese.content,
    verseId,
  });
}
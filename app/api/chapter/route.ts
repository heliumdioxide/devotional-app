import { NextResponse } from "next/server";

const API_KEY = process.env.API_BIBLE_KEY?.trim() || "";
const EN_BIBLE_ID = process.env.API_BIBLE_EN?.trim() || "";
const ZH_BIBLE_ID = "a6e06d2c5b90ad89-01";

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

  return {
    reference: json.data.reference,
    content: json.data.content.trim(),
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
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load chapter" },
      { status: 500 }
    );
  }
}
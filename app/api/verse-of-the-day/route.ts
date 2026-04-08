import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.API_BIBLE_KEY?.trim() || "";
const EN_BIBLE_ID = process.env.API_BIBLE_EN?.trim() || "";
const ZH_BIBLE_ID = "a6e06d2c5b90ad89-01";

const VALID_BOOK_CODES = new Set([
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
  "1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER",
  "LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP",
  "HAG","ZEC","MAL","MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL",
  "EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE",
  "2PE","1JN","2JN","3JN","JUD","REV"
]);

function isValidVerseId(verseId: string): boolean {
  if (!verseId || typeof verseId !== "string") return false;
  const parts = verseId.split(".");
  if (parts.length !== 3) return false;
  const [book, chapter, verse] = parts;
  if (!VALID_BOOK_CODES.has(book)) return false;
  if (isNaN(Number(chapter)) || isNaN(Number(verse))) return false;
  if (Number(chapter) < 1 || Number(verse) < 1) return false;
  return true;
}

async function fetchWithKey(url: string) {
  return fetch(url, {
    method: "GET",
    headers: { "api-key": API_KEY, Accept: "application/json" },
    cache: "no-store",
    redirect: "manual",
  });
}

async function fetchVerse(bibleId: string, verseId: string) {
  const url = `https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?content-type=text`;
  let res = await fetchWithKey(url);

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) throw new Error(`Redirect without location`);
    res = await fetch(location, {
      method: "GET",
      headers: { "api-key": API_KEY, Accept: "application/json" },
      cache: "no-store",
    });
  }

  const raw = await res.text();
  if (!res.ok) throw new Error(`UPSTREAM: ${res.status} ${raw}`);

  const json = JSON.parse(raw);
  return {
    reference: json.data.reference,
    content: json.data.content.trim(),
  };
}

function getSeasonContext(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = date.getDay();
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  if (month === 12 && day === 25) return "Christmas Day — the incarnation of Jesus Christ";
  if (month === 1 && day === 1) return "New Year's Day — new beginnings under God's sovereignty";
  if (month === 10 && day === 31) return "Reformation Day — Scripture alone, grace alone, faith alone";
  if (month === 12 && day >= 1 && day <= 24) return "Advent — anticipating the coming of Christ";
  if (month === 4 && day >= 1 && day <= 7) return "Easter week — the resurrection of Jesus Christ";
  if (month === 3 && day >= 25 && day <= 31) return "Holy Week — the cross and sacrifice of Christ";
  if (month === 5 && day >= 15 && day <= 25) return "Pentecost season — the gift of the Holy Spirit";

  const monthThemes: Record<number, string> = {
    1: "God's sovereignty — trusting His plan for the year ahead",
    2: "grace and forgiveness — the unearned love of God",
    3: "repentance and renewal — turning back to God",
    4: "resurrection life — living in the power of the risen Christ",
    5: "prayer — dependence on God in daily life",
    6: "the Word of God — the authority and sufficiency of Scripture",
    7: "faith — trusting God when circumstances are uncertain",
    8: "the church — Christian community and belonging",
    9: "evangelism — the Great Commission and sharing the gospel",
    10: "perseverance — holding fast through suffering and doubt",
    11: "gratitude — thanksgiving for God's faithfulness",
    12: "hope — the return of Christ and the coming kingdom",
  };

  const dayThemes: Record<number, string> = {
    0: "the Lord's Day — gathered worship, rest, and delight in God",
    1: "faith and vocation — serving God through ordinary work",
    2: "prayer and dependence — bringing every need before God",
    3: "the Word of God — studying and sitting with Scripture",
    4: "Christian community — the body of Christ caring for one another",
    5: "the cross — repentance and the cost of following Jesus",
    6: "sabbath rest — stillness and preparation of the heart",
  };

  return [
    `Day ${dayOfYear} of the year.`,
    `Monthly theme: ${monthThemes[month]}.`,
    `Today's rhythm: ${dayThemes[dayOfWeek]}.`,
    `Select a verse at the intersection of both themes.`,
  ].join(" ");
}

async function getVerseFromAI(dateKey: string, seasonContext: string, attempt: number = 1): Promise<{ verseId: string; reason: string; reasonZh: string }> {
  const prompt = [
    "You are a thoughtful evangelical pastor selecting today's verse of the day.",
    "",
    `Today is ${dateKey}. The occasion is: ${seasonContext}`,
    attempt > 1 ? `\nNote: Your previous suggestion failed validation. Please pick a different, well-known verse.\n` : "",
    "Select ONE Bible verse that is deeply fitting for this occasion from an evangelical perspective.",
    "Ground your choice in the authority of Scripture, the gospel of Jesus Christ, and practical discipleship.",
    "",
    "Respond ONLY with a valid JSON object (no markdown, no backticks) with exactly these keys:",
    "",
    '- "verseId": the verse in API.Bible format e.g. "ROM.8.28" or "PSA.23.1"',
    '- "reason_en": one sentence in English explaining why this verse fits today (warm, pastoral, evangelical)',
    '- "reason_zh": one sentence in Traditional Chinese (繁體中文) explaining why this verse fits today (warm, pastoral, evangelical)',
    "",
    "CRITICAL: Use ONLY these exact book codes (case-sensitive):",
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV",
    "",
    "Format MUST be BOOK.CHAPTER.VERSE with dots, e.g. JHN.3.16 or PSA.23.1",
    "Choose a verse substantial enough to stand alone — avoid very short verses that lose meaning without context.",
    "",
    "CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. Start with { and end with }",
  ].join("\n");

  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const aiData = await aiRes.json();
  const raw = aiData.choices?.[0]?.message?.content ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in AI response: ${raw}`);
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    verseId: parsed.verseId,
    reason: parsed.reason_en || parsed.reason || "",
    reasonZh: parsed.reason_zh || parsed.reason_en || parsed.reason || "",
  };
}

export async function GET() {
  if (!API_KEY || !EN_BIBLE_ID) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  const today = new Date();
  const dateKey = today.toISOString().split("T")[0];
  const seasonContext = getSeasonContext(today);

  const MAX_ATTEMPTS = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let verseId: string;
    let reason: string;
    let reasonZh: string;

    try {
      ({ verseId, reason, reasonZh } = await getVerseFromAI(dateKey, seasonContext, attempt));
    } catch (err) {
      return NextResponse.json({ error: "AI parse failed", detail: String(err) }, { status: 500 });
    }

    if (!isValidVerseId(verseId)) {
      lastError = `Invalid verseId format: "${verseId}"`;
      console.warn(`[verse-of-the-day] Attempt ${attempt}: ${lastError}`);
      continue;
    }

    try {
      const [english, chinese] = await Promise.all([
        fetchVerse(EN_BIBLE_ID, verseId),
        fetchVerse(ZH_BIBLE_ID, verseId),
      ]);

      return NextResponse.json({
        reference: english.reference,
        english: english.content,
        chinese: chinese.content,
        verseId,
        reason,
        reasonZh,
        season: seasonContext,
        date: dateKey,
      });
    } catch (err) {
      lastError = String(err);
      console.warn(`[verse-of-the-day] Attempt ${attempt}: Verse fetch failed for "${verseId}": ${lastError}`);
    }
  }

  return NextResponse.json(
    { error: "Failed after 3 attempts", detail: lastError },
    { status: 500 }
  );
}
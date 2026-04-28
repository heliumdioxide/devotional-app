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

  if (month === 12 && day === 25) return "Christmas — celebrating the incarnation of Jesus Christ";
  if (month === 1 && day === 1) return "New Year's Day — new beginnings under God's care and rule";
  if (month === 10 && day === 31) return "Reformation Day — Scripture, grace, and faith alone";
  if (month === 12 && day >= 1 && day <= 24) return "Advent — waiting and preparing for Christ's coming";
  if (month === 4 && day >= 1 && day <= 7) return "Easter week — Christ risen from the dead";
  if (month === 3 && day >= 25 && day <= 31) return "Holy Week — the cross and Christ's self-giving love";
  if (month === 5 && day >= 15 && day <= 25) return "Pentecost season — the Holy Spirit given to the church";

  const monthThemes: Record<number, string> = {
    1: "God's rule and care — trusting him with the year ahead",
    2: "grace and forgiveness — love we never earned",
    3: "repentance and newness — turning back to God",
    4: "resurrection life — walking in the risen Christ",
    5: "prayer — leaning on God day by day",
    6: "God's Word — its authority and sufficiency for everyday life",
    7: "faith — staying with God when life is unclear",
    8: "the church — belonging and life together in Christ",
    9: "the gospel going out — witness and the Great Commission",
    10: "steadfastness — staying faithful through hardship and doubt",
    11: "thanksgiving — noticing God's faithfulness",
    12: "hope — Christ's return and the kingdom to come",
  };

  const dayThemes: Record<number, string> = {
    0: "the Lord's Day — worship, rest, and joy in God",
    1: "faith at work — honoring God in ordinary tasks",
    2: "prayer — laying every need before God",
    3: "Scripture — reading slowly and listening well",
    4: "community — caring for one another as Christ's body",
    5: "the cross — repentance and what it costs to follow Jesus",
    6: "rest — quieting the heart before God",
  };

  return [
    `Day ${dayOfYear} of the year.`,
    `This month's tone: ${monthThemes[month]}.`,
    `Today's angle: ${dayThemes[dayOfWeek]}.`,
    `Pick a verse that fits where these meet.`,
  ].join(" ");
}

async function getVerseFromAI(dateKey: string, seasonContext: string, attempt: number = 1): Promise<{ verseId: string; reason: string; reasonZh: string }> {
  const prompt = [
    "Choose today's verse of the day the way a careful evangelical pastor would: one verse, faithful to Scripture, right for the day.",
    "",
    `Date: ${dateKey}. Context: ${seasonContext}`,
    attempt > 1 ? `\nYour last pick didn't pass checks—choose a different, widely known verse.\n` : "",
    "Pick a single verse that fits this moment well from an evangelical outlook.",
    "Let Scripture's authority, the gospel, and everyday following of Jesus guide you.",
    "",
    "Reply with a valid JSON object only (no markdown, no backticks). Use exactly these keys:",
    "",
    '- "verseId": API.Bible format, e.g. "ROM.8.28" or "PSA.23.1"',
    '- "reason_en": one warm, pastoral sentence in English on why this verse suits today',
    '- "reason_zh": the same in Traditional Chinese (繁體中文, not 簡體中文). Traditional characters only—e.g. 這、來、說、愛、時、會.',
    "",
    "Book codes must be one of these (case-sensitive, exactly as written):",
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV",
    "",
    "Use BOOK.CHAPTER.VERSE with dots (e.g. JHN.3.16, PSA.23.1).",
    "Prefer a verse that can stand on its own—skip fragments that need lots of setup to make sense.",
    "",
    "Output: raw JSON only. No markdown, no code fences. Start with { and end with }.",
  ].join("\n");

  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistralai/mistral-medium-3",
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
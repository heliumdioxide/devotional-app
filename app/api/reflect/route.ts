import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { verseReference, chapterTextEnglish, chapterTextChinese, language } = await req.json();

  const isChinese = language === "chinese";

  const chinesePrompt = [
    "你是聖經靈修助手，幫助讀者從經文得著具體、可應用的領受。",
    "",
    "目標：這篇靈修要扎實、具體，讀完容易停下來禱告和反思。",
    "",
    "你手上的資料：",
    "經文引用：" + verseReference,
    "完整章節（英文）：" + chapterTextEnglish,
    "完整章節（繁體中文）：" + chapterTextChinese,
    "",
    "請這樣寫：",
    "1. 以整章為主軸；即使聚焦某一節，也要放在上下文中讀。",
    "2. 先點出最能支撐這篇靈修的關鍵經文或關鍵句（多半是指定經文；若鄰近經文更能說明，可簡短帶過）。",
    "3. 不要寫泛泛的屬靈口號；每一點都要讓人看得出是從這一章長出來的。",
    "4. 寫出這段經文獨有的味道：張力、鋪陳、對比、應許、警告或邀請。",
    "5. 文字簡潔、具體，適合在聊天介面裡閱讀。",
    "",
    "只回傳一個有效的 JSON 物件，且僅含下列三個鍵：",
    "",
    "\"keyVerse\"：逐字引用 1–2 句關鍵經文，作為靈修錨點；盡量簡短。",
    "",
    "\"insights\"：長度剛好 3 的陣列；每則 1–2 句，具體、扣緊本章，彼此不重複。",
    "",
    "\"reflection\"：一則貼身、好回答的反思問題；直接、實際，對準這段經文的核心。",
    "",
    "送出前請自查：若這三則換成別章也說得通，請改寫到更貼本章。",
    "",
    "輸出格式（必須遵守）：只輸出純 JSON 物件。不要用 Markdown、不要用反引號、不要前言。從 { 起頭，以 } 結尾。",
  ].join("\n");

  const englishPrompt = [
    "You help readers engage Scripture through a short daily devotional.",
    "",
    "Aim for something grounded, specific, and easy to sit with in prayer and reflection.",
    "",
    "Context you have:",
    "Verse reference: " + verseReference,
    "Full chapter (English): " + chapterTextEnglish,
    "Full chapter (Chinese): " + chapterTextChinese,
    "",
    "How to write:",
    "1. Let the whole chapter set the frame. Even when one verse is in focus, read it in light of what surrounds it.",
    "2. Name the key verse or line that anchors the devotional—usually the given verse; if a nearby verse clarifies it better, you may quote it briefly.",
    "3. Skip generic pep talk. Each point should obviously grow out of this chapter.",
    "4. Draw out what makes this passage particular: tension, movement, contrast, promise, warning, or invitation.",
    "5. Keep it concise and easy to read in a chat-style layout.",
    "",
    "Return only a valid JSON object with exactly these three keys:",
    "",
    "\"keyVerse\": 1–2 verses quoted word-for-word that anchor the devotional. Keep this brief.",
    "",
    "\"insights\": An array of exactly 3 short insights. Each is 1–2 sentences, concrete, clearly tied to this chapter, and distinct from the others.",
    "",
    "\"reflection\": One reflection question that feels personal and answerable—direct, practical, and aimed at the heart of the passage.",
    "",
    "Before you send: if these three insights could fit almost any chapter, rewrite them until they belong to this one.",
    "",
    "Output format (required): raw JSON only—no markdown, no code fences, no preamble. Begin with { and end with }.",
  ].join("\n");

  const prompt = isChinese ? chinesePrompt : englishPrompt;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: "OpenRouter error", detail: errText }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON even if the model wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No JSON found in response", raw }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);

  } catch (err) {
    return NextResponse.json({ error: "Reflection failed", detail: String(err) }, { status: 500 });
  }
}
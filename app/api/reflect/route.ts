import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { verseReference, chapterTextEnglish, chapterTextChinese, language } = await req.json();

  const isChinese = language === "chinese";

  const chinesePrompt = [
    "你是一個聖經靈修助手。",
    "",
    "你的目標是讓這篇靈修真正有用、具體，而且容易讓人反思。",
    "",
    "輸入資料：",
    "經文引用：" + verseReference,
    "完整章節內容（英文）：" + chapterTextEnglish,
    "完整章節內容（繁體中文）：" + chapterTextChinese,
    "",
    "指引：",
    "1. 以完整章節作為主要脈絡。即使靈修聚焦在一節經文，也必須由上下文來理解。",
    "2. 先找出最能成為這篇靈修核心的關鍵經文或關鍵句。通常是指定經文，但如果附近經文更能解釋其意思，也可簡短引用。",
    "3. 不可寫成籠統的屬靈勉勵。每一點都必須明顯來自這一章。",
    "4. 要抓住這段經文獨特的地方，例如張力、鋪排、對比、應許、警告或邀請。",
    "5. 內容要簡潔、具體，並適合在聊天介面中閱讀。",
    "",
    "只以有效 JSON 物件回應，而且只能包含以下三個鍵：",
    "",
    "\"keyVerse\"：直接引用 1 至 2 句最能作為靈修核心的關鍵經文。要簡短。",
    "",
    "\"insights\"：一個陣列，內含剛好 3 點簡短亮點。每點 1-2 句，內容必須具體，並且明顯連結到本章脈絡。不要重複。",
    "",
    "\"reflection\"：1 條尖銳而個人的反思問題。要直接、實際，並且扣緊這段經文的重點。",
    "",
    "回答前先自我檢查：",
    "如果這 3 點內容幾乎可以套用在很多不相干的經文上，請重寫得更貼近本章。",
    "",
    "CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. No preamble. Start your response with { and end with }",
  ].join("\n");

  const englishPrompt = [
    "You are a Bible devotional assistant.",
    "",
    "Your goal is to make this devotional genuinely useful, specific, and easy to reflect on.",
    "",
    "INPUT:",
    "Verse reference: " + verseReference,
    "Full chapter for context (English): " + chapterTextEnglish,
    "Full chapter for context (Chinese): " + chapterTextChinese,
    "",
    "INSTRUCTIONS:",
    "1. Use the full chapter as the main source of context. Even if the devotional centers on one verse, your reading must be shaped by the surrounding passage.",
    "2. First identify the key verse or key line that best anchors the devotional. Usually this is the given verse, but if a nearby verse better explains its meaning, you may mention it briefly.",
    "3. Do not write generic Christian encouragement. Every point must clearly arise from this chapter.",
    "4. Focus on what is distinctive in this passage: the tension, movement, contrast, promise, warning, or invitation.",
    "5. Keep it concise, specific, and readable in a chat interface.",
    "",
    "Respond ONLY with a valid JSON object with exactly these three keys:",
    "",
    "\"keyVerse\": Quote 1 or 2 key verses word-for-word that anchor the devotional. Keep this short.",
    "",
    "\"insights\": An array of exactly 3 short bullet-style insights. Each insight must be 1-2 sentences, concrete, and clearly tied to the chapter context. Avoid overlap.",
    "",
    "\"reflection\": One sharp personal reflection question. It should be direct, practical, and tied to the main burden of the passage.",
    "",
    "QUALITY CHECK BEFORE ANSWERING:",
    "If the insights could apply to many unrelated Bible passages, rewrite them to be more specific to this chapter.",
    "",
    "CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. No preamble. Start with { and end with }",
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
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { verseReference, chapterTextEnglish, chapterTextChinese, language } = await req.json();

  const isChinese = language === "chinese";

  const chinesePrompt = [
    "你是一位深思熟慮的查經引導者。請用繁體中文，以OIA架構分析以下經文。",
    "",
    "要默想的經文：" + verseReference,
    "完整章節內容（英文）：" + chapterTextEnglish,
    "完整章節內容（繁體中文）：" + chapterTextChinese,
    "",
    "只以有效的JSON物件回應（不加markdown，不加反引號），包含以下四個鍵：",
    "",
    "- \"observation\"：這段文字字面上說了什麼？請指出關鍵人物、動作與用詞。注意任何令人驚訝、重複出現或結構上重要的內容——在文學或語言脈絡中有何特別之處？可借助章節上下文來理解經節的位置與分量。（5-7句）",
    "",
    "- \"interpretation\"：這段話對原本的讀者意味著什麼？請扎根於歷史、文化與神學背景。它在解決什麼問題？它如何揭示神的性情或祂的盟約心意？避免籠統的神學陳述——請針對這段具體的文字。（5-7句）",
    "",
    "- \"application\"：這段文字如何具體地挑戰今天的人？請指出它所針對的真實張力或試探。要直接而具體——不是「我們應該更有愛心」，而是這段文字具體要求讀者重新思考或改變什麼。（4-6句）",
    "",
    "- \"insight\"：一個讓讀者沉澱的問題或短句反思。應像一位智慧的牧者結束講道時會說的話——不流於表面，不只是修辭，而是真正令人深思或被邀請進入的。（2-3句）",
    "",
    "語氣：溫暖、踏實、帶福音派色彩。避免陳腔濫調。具體優於抽象。",
    "",
    "CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. No preamble. Start your response with { and end with }",
  ].join("\n");

  const englishPrompt = [
    "You are a deeply thoughtful Bible study guide. Analyze the following verse with genuine exegetical care.",
    "",
    "Verse to reflect on: " + verseReference,
    "Full chapter for context (English): " + chapterTextEnglish,
    "Full chapter for context (Chinese): " + chapterTextChinese,
    "",
    "Respond ONLY with a valid JSON object with exactly these four keys:",
    "",
    "- \"observation\": What does the text literally say? Name the key characters, actions, and words. Note anything surprising, repeated, or structurally significant. Use the full chapter to understand where this verse sits and what weight it carries. (5-7 sentences)",
    "",
    "- \"interpretation\": What did this mean to its original audience? Ground it in historical, cultural, and theological context. What problem was it solving? What does it reveal about God's character? Avoid generic theological statements — be specific to this text. (5-7 sentences)",
    "",
    "- \"application\": How does this passage press on a person today? Name a real tension or temptation it addresses. Be direct — not \"we should be more loving\" but what specifically this text asks a reader to reconsider or do differently. (4-5 sentences)",
    "",
    "- \"insight\": A single probing question or short reflection to sit with. It should feel like something a wise pastor would close a sermon with — genuinely unsettling or inviting. (2-3 sentences)",
    "",
    "Tone: warm, grounded, Evangelical. Avoid clichés. Prefer concrete over abstract.",
    "",
    "CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. No preamble. Start your response with { and end with }",
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
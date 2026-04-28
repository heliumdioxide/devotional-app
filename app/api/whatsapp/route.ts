import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ── Template SIDs ──────────────────────────────────────────────
const TEMPLATES = {
  welcome_en: "HXada29ce32d95e0ed2fb3f9d57c48b1bc",
  welcome_hk: "HXf576519767d82de62401e32d1963bcda",
  verse_en:   "HX7598c1c70624b0cb1c5dace78097a3ea",
  verse_hk:   "HX973433daa6fff57fddc7bbb95ff9a0c8",
  lang_en:    "HXfc310f2cbd91bdcde9a1f12b37512993",
  lang_hk:    "HXaf98fd6cb554f6c5857d8845228dfbab",
};

// ── Supabase ───────────────────────────────────────────────────
function getSupabase() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing Supabase env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Twilio helpers ─────────────────────────────────────────────
function twilioWhatsAppFrom(): string {
  const raw = (process.env.TWILIO_WHATSAPP_FROM ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("whatsapp:") ? raw : `whatsapp:${raw}`;
}

async function sendTwilioTemplate(
  to: string,
  templateSid: string,
  variables?: Record<string, string>
): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = twilioWhatsAppFrom();
  if (!sid || !token || !from) throw new Error("Missing Twilio env vars");

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params: Record<string, string> = { To: to, From: from, ContentSid: templateSid };
  if (variables && Object.keys(variables).length > 0) {
    params.ContentVariables = JSON.stringify(variables);
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
}

async function sendTwilioWhatsApp(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = twilioWhatsAppFrom();
  if (!sid || !token || !from) throw new Error("Missing Twilio env vars");

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
}

function twimlEmpty(): NextResponse {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } }
  );
}

// ── Language detection ─────────────────────────────────────────
function detectLangFromPhone(phone: string): "chinese" | "english" {
  const digits = phone.replace(/^whatsapp:\+?/, "");
  return digits.startsWith("852") ? "chinese" : "english";
}

function isHK(lang: string) {
  return lang.toLowerCase() === "chinese";
}

// ── Button payload detection ───────────────────────────────────
type ButtonAction =
  | "show_verse"
  | "change_language"
  | "select_english"
  | "select_chinese"
  | "i_have_read"
  | null;

  function detectButtonAction(body: string): ButtonAction {
    const t = body.trim().toLowerCase();
    const raw = body.trim();
    console.log("[whatsapp] detectButtonAction input:", JSON.stringify(raw));
    if (t === "show_verse"      || t === "show verse"      || raw === "閱讀今日經文") return "show_verse";
    if (t === "change_language" || t === "change language" || raw === "更換語言")     return "change_language";
    if (t === "english")                                                              return "select_english";
    if (raw === "中文")                                                                return "select_chinese";
    if (t === "i_have_read"     || t === "i have read"     || raw === "我已閱讀")     return "i_have_read";
    return null;
  }

// ── Lang command detection ─────────────────────────────────────
type LangCode = "english" | "chinese";

function detectLangCommand(msg: string): LangCode | null {
  const t = msg.trim().toLowerCase();
  if (t === "english") return "english";
  if (msg.trim() === "中文") return "chinese";
  return null;
}

function isHelpCommand(msg: string): boolean {
  return msg.trim().toLowerCase() === "help";
}

function commandMenu(lang: string): string {
  if (isHK(lang)) {
    return ["可用指令：", "• english — 只用英文", "• 中文 — 只用繁體中文", "• help — 顯示這份選單"].join("\n");
  }
  return ["Quick commands:", "• english — English only", "• 中文 — Traditional Chinese", "• help — Show this menu"].join("\n");
}

// ── Reflection helpers ─────────────────────────────────────────
type ReflectLang = "english" | "chinese" | "both";

function toReflectLanguage(userLang: string): ReflectLang {
  const l = userLang.toLowerCase();
  if (l === "chinese") return "chinese";
  if (l === "both")    return "both";
  return "english";
}

function reflectSectionLabels(userLang: string) {
  if (isHK(userLang)) {
    return { keyVerse: "關鍵經文", insights: "亮點", reflection: "反思" };
  }
  return { keyVerse: "Key verse", insights: "Insights", reflection: "Reflection" };
}

type ReflectPayload = {
  keyVerse: string;
  insights: string[];
  reflection: string;
};

async function fetchReflectionJson(
  baseUrl: string,
  verseReference: string,
  verseEnglish: string,
  verseChinese: string,
  verseId: string,
  language: ReflectLang
): Promise<ReflectPayload | null> {
  const chapterRes = await fetch(
    `${baseUrl}/api/chapter?verseId=${encodeURIComponent(verseId)}`,
    { cache: "no-store" }
  );
  if (!chapterRes.ok) return null;
  const chapterData = (await chapterRes.json()) as { english?: string; chinese?: string };

  const reflectRes = await fetch(`${baseUrl}/api/reflect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verseReference,
      verseTextEnglish:   verseEnglish,
      verseTextChinese:   verseChinese,
      chapterTextEnglish: chapterData.english ?? "",
      chapterTextChinese: chapterData.chinese ?? "",
      language,
    }),
  });
  if (!reflectRes.ok) return null;
  const data = await reflectRes.json();
  if (data?.error) return null;

  const insights = Array.isArray(data.insights)
    ? data.insights
    : typeof data.insights === "string"
      ? [data.insights]
      : [];

  return {
    keyVerse:   String(data.keyVerse   ?? ""),
    insights,
    reflection: String(data.reflection ?? ""),
  };
}

const MAX_WHATSAPP_SEGMENT = 3800;

function chunkForWhatsApp(text: string): string[] {
  if (text.length <= MAX_WHATSAPP_SEGMENT) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_WHATSAPP_SEGMENT) {
    let cut = rest.lastIndexOf("\n\n", MAX_WHATSAPP_SEGMENT);
    if (cut < MAX_WHATSAPP_SEGMENT / 2) cut = rest.lastIndexOf("\n", MAX_WHATSAPP_SEGMENT);
    if (cut < MAX_WHATSAPP_SEGMENT / 2) cut = MAX_WHATSAPP_SEGMENT;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// ── Send verse only (no reflection) ───────────────────────────
async function sendVerseOnly(
  to: string,
  userLang: string,
  baseUrl: string
): Promise<void> {
  const verseRes = await fetch(`${baseUrl}/api/verse-of-the-day`, { cache: "no-store" });

  if (!verseRes.ok) {
    const errMsg = isHK(userLang)
      ? "無法載入今日經文，請稍後再試。"
      : "We couldn't load today's verse. Please try again in a moment.";
    await sendTwilioWhatsApp(to, errMsg);
    return;
  }

  const { reference, english, chinese } = await verseRes.json();
  const verseText   = isHK(userLang) ? chinese : english;
  const templateSid = isHK(userLang) ? TEMPLATES.verse_hk : TEMPLATES.verse_en;

  await sendTwilioTemplate(to, templateSid, { "1": verseText, "2": reference });
}

// ── Send reflection only (after "I have read") ────────────────
async function sendReflectionOnly(
  to: string,
  userLang: string,
  baseUrl: string
): Promise<void> {
  const verseRes = await fetch(`${baseUrl}/api/verse-of-the-day`, { cache: "no-store" });

  if (!verseRes.ok) {
    const errMsg = isHK(userLang)
      ? "無法載入反思，請稍後再試。"
      : "Reflection isn't available right now. Please try again.";
    await sendTwilioWhatsApp(to, errMsg);
    return;
  }

  const { reference, english, chinese, verseId } = await verseRes.json();
  const reflectLang = toReflectLanguage(userLang);
  const reflection  = await fetchReflectionJson(
    baseUrl, reference, english, chinese, verseId, reflectLang
  );

  if (!reflection) {
    const fallback = isHK(userLang)
      ? "（默想暫時無法顯示。）"
      : "(Reflection isn't available right now.)";
    await sendTwilioWhatsApp(to, fallback);
    return;
  }

  const labels        = reflectSectionLabels(userLang);
  const insightsLines = reflection.insights.map((s) => `• ${s}`).join("\n");
  const insightsBlock =
    `*${labels.keyVerse}*\n${reflection.keyVerse}\n\n` +
    `*${labels.insights}*\n${insightsLines}`;
  const reflectionBlock = `*${labels.reflection}*\n${reflection.reflection}`;

  for (const segment of chunkForWhatsApp(insightsBlock)) {
    await sendTwilioWhatsApp(to, segment);
  }
  for (const segment of chunkForWhatsApp(reflectionBlock)) {
    await sendTwilioWhatsApp(to, segment);
  }
}

// ── Main POST handler ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return twimlEmpty();
  }

  const from = String(formData.get("From") ?? "");
  const body = String(formData.get("Body") ?? "");

  console.log("[whatsapp] incoming from:", from, "body:", JSON.stringify(body));

  if (!from) return twimlEmpty();

  try {
    const supabase = getSupabase();
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;

    const { data: user, error: selectError } = await supabase
      .from("users")
      .select("phone, lang, welcomed")
      .eq("phone", from)
      .maybeSingle();

    if (selectError) {
      console.error("[whatsapp] Supabase select:", selectError);
      await sendTwilioWhatsApp(from, "Something went wrong. Please try again.");
      return twimlEmpty();
    }

    // ── New user ──────────────────────────────────────────────
    if (!user || user.welcomed !== true) {
      const detectedLang = detectLangFromPhone(from);
      const welcomeSid   = detectedLang === "chinese" ? TEMPLATES.welcome_hk : TEMPLATES.welcome_en;

      await sendTwilioTemplate(from, welcomeSid);

      if (!user) {
        const { error: insertError } = await supabase.from("users").insert({
          phone: from, lang: detectedLang, welcomed: true,
        });
        if (insertError) console.error("[whatsapp] Supabase insert:", insertError);
      } else {
        const { error: updateError } = await supabase
          .from("users")
          .update({ welcomed: true, lang: detectedLang })
          .eq("phone", from);
        if (updateError) console.error("[whatsapp] Supabase update welcomed:", updateError);
      }

      return twimlEmpty();
    }

    const userLang = ((user.lang as string) || "english").toLowerCase();
    const buttonAction = detectButtonAction(body);

    console.log("[whatsapp] buttonAction:", buttonAction, "userLang:", userLang);

    // ── Button: Show Verse → verse only ──────────────────────
    if (buttonAction === "show_verse") {
      await sendVerseOnly(from, userLang, baseUrl);
      return twimlEmpty();
    }

    // ── Button: I have read → reflection only ─────────────────
    if (buttonAction === "i_have_read") {
      await sendReflectionOnly(from, userLang, baseUrl);
      return twimlEmpty();
    }

    // ── Button: Change Language → lang selection template ─────
    if (buttonAction === "change_language") {
      const langSid = isHK(userLang) ? TEMPLATES.lang_hk : TEMPLATES.lang_en;
      await sendTwilioTemplate(from, langSid);
      return twimlEmpty();
    }

    // ── Button: English / 中文 → update lang, send verse ──────
    if (buttonAction === "select_english" || buttonAction === "select_chinese") {
      const newLang: LangCode = buttonAction === "select_chinese" ? "chinese" : "english";
      const { error: updateError } = await supabase
        .from("users")
        .update({ lang: newLang })
        .eq("phone", from);

      if (updateError) {
        console.error("[whatsapp] Supabase update lang:", updateError);
        await sendTwilioWhatsApp(from, "We couldn't update your language. Please try again.");
        return twimlEmpty();
      }

      await sendVerseOnly(from, newLang, baseUrl);
      return twimlEmpty();
    }

    // ── Manual text: english / 中文 ───────────────────────────
    const langCmd = detectLangCommand(body);
    if (langCmd) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ lang: langCmd })
        .eq("phone", from);

      if (updateError) {
        console.error("[whatsapp] Supabase update lang:", updateError);
        await sendTwilioWhatsApp(from, "We couldn't update your language. Please try again.");
        return twimlEmpty();
      }

      await sendVerseOnly(from, langCmd, baseUrl);
      return twimlEmpty();
    }

    // ── Manual text: help ─────────────────────────────────────
    if (isHelpCommand(body)) {
      await sendTwilioWhatsApp(from, commandMenu(userLang));
      return twimlEmpty();
    }

    // ── Any other message: send verse only ────────────────────
    await sendVerseOnly(from, userLang, baseUrl);

  } catch (err) {
    console.error("[whatsapp] error:", err);
    try {
      if (from) await sendTwilioWhatsApp(from, "Something went wrong. Please try again.");
    } catch { /* ignore */ }
  }

  return twimlEmpty();
}
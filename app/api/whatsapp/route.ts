import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const WELCOME_MESSAGE = [
  "🙏 Welcome to Daily Devotional!",
  "I'll send you a Bible verse and reflection every day.",
  "",
  "Choose your language:",
  "english — English only",
  "中文 — Traditional Chinese",
  "",
  "Or just reply anything to receive today's verse in English.",
].join("\n");

function commandMenu(lang: string): string {
  const isZh = lang === "chinese";
  if (isZh) {
    return [
      "指令選單：",
      "• english — 只用英文",
      "• 中文 — 只用繁體中文",
      "• help — 顯示此選單",
    ].join("\n");
  }
  return [
    "Commands:",
    "• english — English only",
    "• 中文 — Traditional Chinese",
    "• help — Show this menu",
  ].join("\n");
}

function getSupabase() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function twilioWhatsAppFrom(): string {
  const raw = (process.env.TWILIO_WHATSAPP_FROM ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("whatsapp:")) return raw;
  return `whatsapp:${raw}`;
}

async function sendTwilioWhatsApp(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = twilioWhatsAppFrom();
  if (!sid || !token || !from) {
    throw new Error("Missing Twilio environment variables");
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: body,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
}

function twimlEmpty(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

type LangCode = "english" | "chinese";

function detectLangCommand(msg: string): LangCode | null {
  const t = msg.trim();
  const lower = t.toLowerCase();
  if (lower === "english") return "english";
  if (t === "中文" || lower === "中文") return "chinese";
  return null;
}

function isHelpCommand(msg: string): boolean {
  return msg.trim().toLowerCase() === "help";
}

function langConfirmation(code: LangCode): string {
  switch (code) {
    case "english":
      return "Got it! I'll reply in English from now on.";
    case "chinese":
      return "好的！我會用繁體中文回覆你。";
    default:
      return "OK.";
  }
}

function formatVerseMessage(
  lang: string,
  data: { reference: string; english: string; chinese: string }
): string {
  if (lang === "chinese") {
    return `📖 *${data.reference}*\n\n${data.chinese}`;
  }
  if (lang === "both") {
    return `📖 *${data.reference}*\n\n*EN*\n${data.english}\n\n*中文*\n${data.chinese}`;
  }
  return `📖 *${data.reference}*\n\n${data.english}`;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return twimlEmpty();
  }

  const from = String(formData.get("From") ?? "");
  const body = String(formData.get("Body") ?? "");

  if (!from) {
    return twimlEmpty();
  }

  try {
    const supabase = getSupabase();

    const { data: user, error: selectError } = await supabase
      .from("users")
      .select("phone, lang, welcomed")
      .eq("phone", from)
      .maybeSingle();

    if (selectError) {
      console.error("[whatsapp] Supabase select:", selectError);
      await sendTwilioWhatsApp(
        from,
        "Sorry, something went wrong. Please try again in a moment."
      );
      return twimlEmpty();
    }

    const needsWelcome = !user || user.welcomed !== true;

    if (needsWelcome) {
      await sendTwilioWhatsApp(from, WELCOME_MESSAGE);

      if (!user) {
        const { error: insertError } = await supabase.from("users").insert({
          phone: from,
          lang: "english",
          welcomed: true,
        });
        if (insertError) {
          console.error("[whatsapp] Supabase insert:", insertError);
        }
      } else {
        const { error: updateError } = await supabase
          .from("users")
          .update({ welcomed: true })
          .eq("phone", from);
        if (updateError) {
          console.error("[whatsapp] Supabase update welcomed:", updateError);
        }
      }

      return twimlEmpty();
    }

    const langCmd = detectLangCommand(body);
    if (langCmd) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ lang: langCmd })
        .eq("phone", from);

      if (updateError) {
        console.error("[whatsapp] Supabase update lang:", updateError);
        await sendTwilioWhatsApp(
          from,
          "Sorry, couldn't update your language. Please try again."
        );
        return twimlEmpty();
      }

      await sendTwilioWhatsApp(from, langConfirmation(langCmd));
      return twimlEmpty();
    }

    if (isHelpCommand(body)) {
      const currentLang = (user.lang as string) || "english";
      await sendTwilioWhatsApp(from, commandMenu(currentLang));
      return twimlEmpty();
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
    const verseRes = await fetch(`${baseUrl}/api/verse-of-the-day`, { cache: "no-store" });

    if (!verseRes.ok) {
      const detail = await verseRes.text();
      console.error("[whatsapp] verse-of-the-day:", verseRes.status, detail);
      await sendTwilioWhatsApp(
        from,
        "Sorry, couldn't load today's verse. Please try again in a moment."
      );
      return twimlEmpty();
    }

    const verseData = await verseRes.json();
    const { reference, english, chinese } = verseData as {
      reference: string;
      english: string;
      chinese: string;
    };

    const userLang = ((user.lang as string) || "english").toLowerCase();
    const msg = formatVerseMessage(userLang, { reference, english, chinese });
    await sendTwilioWhatsApp(from, msg);
  } catch (err) {
    console.error("[whatsapp] error:", err);
    try {
      if (from) {
        await sendTwilioWhatsApp(
          from,
          "Sorry, something went wrong. Please try again in a moment."
        );
      }
    } catch {
      /* ignore */
    }
  }

  return twimlEmpty();
}

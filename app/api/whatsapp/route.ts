import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;

const userLang: Record<string, 'en' | 'zh' | 'both'> = {};

async function sendWhatsApp(to: string, body: string) {
  await twilioClient.messages.create({ from: FROM, to, body });
}

function detectLang(msg: string): 'en' | 'zh' | 'both' | null {
  const m = msg.trim().toLowerCase();
  if (m === 'english') return 'en';
  if (m === '中文') return 'zh';
  if (m === 'both') return 'both';
  return null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const from = formData.get('From') as string;
  const body = (formData.get('Body') as string) ?? '';

  const langSwitch = detectLang(body);
  if (langSwitch) {
    userLang[from] = langSwitch;
    const confirmations = {
      en: "Got it! I'll reply in English from now on.",
      zh: '好的！我會用繁體中文回覆你。',
      both: "Got it! I'll reply in both English and Traditional Chinese.",
    };
    await sendWhatsApp(from, confirmations[langSwitch]);
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  await sendWhatsApp(from, '🙏 Fetching today\'s verse...');

  const lang = userLang[from] ?? 'en';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  try {
    const verseRes = await fetch(`${baseUrl}/api/verse-of-the-day`, { cache: 'no-store' });
    const verseData = await verseRes.json();
    const { reference, english, chinese, verseId } = verseData;

    // Fetch full chapter for reflection context
    const chapterRes = await fetch(`${baseUrl}/api/chapter?verseId=${verseId}`, { cache: 'no-store' });
    const chapterData = await chapterRes.json();

    const reflectRes = await fetch(`${baseUrl}/api/reflect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verseReference: reference,
        verseTextEnglish: english,
        verseTextChinese: chinese,
        chapterTextEnglish: chapterData.english ?? '',
        chapterTextChinese: chapterData.chinese ?? '',
        language: lang === 'zh' ? 'chinese' : lang === 'both' ? 'both' : 'english',
      }),
    });
    const reflectData = await reflectRes.json();

    const verseMsg = `📖 *${reference}*\n\n${english}`;

    const reflectionMsg =
      `*Observation*\n${reflectData.observation}\n\n` +
      `*Interpretation*\n${reflectData.interpretation}\n\n` +
      `*Application*\n${reflectData.application}\n\n` +
      `*Insight*\n${reflectData.insight}`;

    await sendWhatsApp(from, verseMsg);
    await sendWhatsApp(from, reflectionMsg);

  } catch (err) {
    console.error('WhatsApp bot error:', err);
    await sendWhatsApp(from, 'Sorry, something went wrong. Please try again in a moment.');
  };
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
}
/**
 * Optional OpenAI vision tagging for imported product images (no extra npm deps — uses axios).
 *
 * Env:
 *   OPENAI_API_KEY     — required to call the API
 *   OPENAI_VISION_MODEL — default gpt-4o-mini
 *   VISION_DELAY_MS    — optional pause between requests (default 250) to reduce rate limits
 */

import axios from 'axios';
import * as fs from 'fs';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface GarmentVisionTags {
  description: string;
  keywords: string;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reads a local image file, sends it to OpenAI vision, returns description + keyword string.
 */
export async function describeGarmentImage(
  imageAbsolutePath: string,
  apiKey: string,
  model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'
): Promise<GarmentVisionTags | null> {
  if (!apiKey || !fs.existsSync(imageAbsolutePath)) return null;

  let buf: Buffer;
  try {
    buf = fs.readFileSync(imageAbsolutePath);
  } catch {
    return null;
  }

  const lower = imageAbsolutePath.toLowerCase();
  const mime = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.gif')
        ? 'image/gif'
        : 'image/jpeg';
  const b64 = buf.toString('base64');
  const dataUrl = `data:${mime};base64,${b64}`;

  const body = {
    model,
    max_tokens: 350,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'You help a luxury fashion e-commerce site. Look at this runway or lookbook photo. ' +
              'Return ONLY valid JSON with keys: ' +
              '"description" (1–2 short English sentences about the visible garment: silhouette, colour, notable details) ' +
              'and "keywords" (a single string of 5–12 comma-separated lowercase search tags, e.g. "evening gown, navy, embroidery"). ' +
              'If multiple outfits appear, focus on the most prominent. No markdown, no extra keys.',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  try {
    const res = await axios.post(CHAT_URL, body, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });
    const raw = res.data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') return null;
    const o = parseJsonObject(raw);
    if (!o) return null;
    const description = typeof o.description === 'string' ? o.description.trim().slice(0, 800) : '';
    const keywords = typeof o.keywords === 'string' ? o.keywords.trim().slice(0, 500) : '';
    if (!description && !keywords) return null;
    return { description, keywords };
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message?: string };
    const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 500) : err.message;
    console.warn(`   ⚠️  OpenAI vision: ${detail}`);
    return null;
  }
}

export function visionDelayMs(): number {
  const n = parseInt(process.env.VISION_DELAY_MS ?? '250', 10);
  return Number.isNaN(n) || n < 0 ? 250 : n;
}

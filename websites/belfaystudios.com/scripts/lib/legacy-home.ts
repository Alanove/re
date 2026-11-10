import { toPlainText } from '../../src/services/sanitizeService.js';

export interface LegacyService {
  title: string;
  text: string;
}

export interface LegacyMember {
  name: string;
  role: string;
  photoSrc: string;
  bio: string;
}

function plain(html: string): string {
  return toPlainText(html).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function headings(html: string, level: 2 | 3): string[] {
  return [...html.matchAll(new RegExp(`<h${level}[^>]*>([\\s\\S]*?)</h${level}>`, 'gi'))].map((match) => plain(match[1] ?? '')).filter(Boolean);
}

export function extractSlogans(html: string): string[] {
  return headings(html, 2);
}

/** Splits off the last h2/h3 of a block, which the legacy one-page design showed as a highlighted closing line. */
export function splitClosingHeading(html: string): { content: string; heading: string } {
  const matches = [...html.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) {
    return { content: html.trim(), heading: '' };
  }
  const rest = `${html.slice(0, last.index)}${html.slice(last.index + last[0].length)}`;
  return { content: rest.trim(), heading: plain(last[2] ?? '') };
}

export function extractServices(html: string): LegacyService[] {
  const parts = html.split(/<h3[^>]*>/i).slice(1);
  return parts
    .map((part) => {
      const [titleHtml = '', rest = ''] = part.split(/<\/h3>/i);
      const paragraphs = [...rest.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => plain(match[1] ?? '')).filter(Boolean);
      return { title: plain(titleHtml), text: paragraphs.join(' ') };
    })
    .filter((service) => service.title !== '');
}

export function splitTeam(html: string): { intro: string; members: LegacyMember[] } {
  const start = html.search(/<div[^>]*class="[^"]*team-row/i);
  const introHtml = start === -1 ? html : html.slice(0, start);
  const intro = introHtml.replace(/<p>(?:\s|&nbsp;)*<\/p>/gi, '').trim();
  if (start === -1) {
    return { intro, members: [] };
  }
  const blocks = html.slice(start).split(/<div[^>]*class="[^"]*\bcol-[^"]*"[^>]*>/i).slice(1);
  const members = blocks
    .map((block) => {
      const image = /<img[^>]*src="([^"]+)"[^>]*>/i.exec(block);
      const bioHtml = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ?? '';
      const bio = bioHtml
        .split(/<br\s*\/?>/i)
        .map((line) => plain(line))
        .filter(Boolean)
        .join('\n');
      return { name: headings(block, 2)[0] ?? '', role: headings(block, 3)[0] ?? '', photoSrc: image?.[1] ?? '', bio };
    })
    .filter((member) => member.name !== '');
  return { intro, members };
}

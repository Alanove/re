import type { ContactLocation } from '../types/contactLocation';

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Loose phone detector for lines like +961-1-902-121 or +1 (310) 597-2442 */
function looksLikePhoneToken(s: string): boolean {
  const t = s.trim();
  if (t.length < 8) return false;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 7) return false;
  if (/[a-zA-Z]/.test(t)) return false;
  return /^[\+\d]/.test(t);
}

function extractEmailsFromLine(line: string): string[] {
  const found = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return found ? [...new Set(found)] : [];
}

function extractPhonesFromLine(line: string): string[] {
  const parts = line.split(/\s{2,}|(?<=\d)\s+(?=\+)/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  if (parts.length > 1 && parts.every((p) => looksLikePhoneToken(p))) {
    return [...new Set(parts)];
  }
  if (looksLikePhoneToken(line)) {
    out.push(line.trim());
    return out;
  }
  const loose = line.match(/\+\d[\d\-\s\(\)]{6,}\d|\d{3}[\-\.\s]\d{3}[\-\.\s]\d{4}/g);
  if (loose) {
    for (const m of loose) {
      const z = m.trim();
      if (looksLikePhoneToken(z)) out.push(z);
    }
  }
  return [...new Set(out)];
}

function extractFirstMapHref(panelHtml: string): string | undefined {
  const re = /<a[^>]+href="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(panelHtml)) !== null) {
    const href = decodeHtmlEntities(m[1]);
    if (/google|maps|parastorage.*map/i.test(href)) return href;
  }
  return undefined;
}

export function parseContactLegacyAccordionHtml(html: string): ContactLocation[] {
  const results: ContactLocation[] = [];
  if (!html || typeof html !== 'string') return results;

  const chunks = html.split('<!-- Inner panel Start -->');
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const titleMatch = chunk.match(/<span class="ac_title_class">\s*([\s\S]*?)\s*<\/span>/);
    const bodyMatch = chunk.match(/<div class="wpsm_panel-body">\s*([\s\S]*?)\s*<\/div>/);
    if (!titleMatch || !bodyMatch) continue;

    const label = stripTags(titleMatch[1]);
    const bodyHtml = bodyMatch[1];
    const mapUrl = extractFirstMapHref(bodyHtml);

    const segments = bodyHtml.split(/<br\s*\/?>/gi);
    const addressLines: string[] = [];
    const phones: string[] = [];
    const emails: string[] = [];

    for (const seg of segments) {
      const hrefOnly = seg.match(/^\s*<a[^>]+href="([^"]+)"[^>]*>[\s\S]*<\/a>\s*$/i);
      if (hrefOnly) continue;

      const text = stripTags(seg);
      if (!text || /^google\s*map$/i.test(text)) continue;

      const lineEmails = extractEmailsFromLine(text);
      if (lineEmails.length) {
        emails.push(...lineEmails);
        let remainder = text;
        for (const em of lineEmails) {
          remainder = remainder.replace(em, '');
        }
        remainder = remainder.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (remainder && !looksLikePhoneToken(remainder)) {
          addressLines.push(remainder);
        }
        continue;
      }

      const linePhones = extractPhonesFromLine(text);
      if (linePhones.length) {
        phones.push(...linePhones);
        let remainder = text;
        for (const p of linePhones) {
          remainder = remainder.split(p).join(' ');
        }
        remainder = remainder.replace(/\s+/g, ' ').trim();
        if (remainder && !looksLikePhoneToken(remainder)) {
          addressLines.push(remainder);
        }
        continue;
      }

      addressLines.push(text);
    }

    const dedupe = (arr: string[]) => [...new Set(arr.map((s) => s.trim()).filter(Boolean))];

    const loc: ContactLocation = {
      label,
      addressLines: dedupe(addressLines),
      phones: dedupe(phones),
      emails: dedupe(emails)
    };
    if (mapUrl) loc.mapUrl = mapUrl;
    results.push(loc);
  }

  return results.filter((r) => r.label || r.addressLines.length || r.phones.length || r.emails.length);
}

/** Bundled sample (accordion inner panels) used to pre-fill admin when DB is empty */
export const SAMPLE_LEGACY_CONTACT_ACCORDION_HTML = `
<!-- Inner panel Start -->
<div class="wpsm_panel wpsm_panel-default">
<div class="wpsm_panel-heading" role="tab">
<h4 class="wpsm_panel-title">
<span class="ac_title_class">Antonios Couture - Lebanon</span>
</h4>
</div>
<div class="wpsm_panel-collapse collapse in">
<div class="wpsm_panel-body">
Zalka - El Matn<br>
Municipality Bldg.<br>
+961-1-902-121 <br>
+961-71-902-121
<br>
<a href="https://static.parastorage.com/services/santa/1.1486.16/static/external/googleMap.html?address=Lebanon%20Zalka%20municipality&amp;addressInfo=Antonios%20Couture&amp;language=en&amp;lat=33.9014596&amp;long=35.57377410000004&amp;mapInteractive=true&amp;mapType=ROADMAP&amp;showMapType=true&amp;showPosition=true&amp;showStreetView=true&amp;showZoom=true&amp;ts=661" target="_blank">Google Map</a>
</div>
</div>
</div>
<!-- Inner panel End -->
<!-- Inner panel Start -->
<div class="wpsm_panel wpsm_panel-default">
<span class="ac_title_class">Antonios Couture - USA</span>
<div class="wpsm_panel-body">
10644 Cushdon Ave<br>
Los Angeles California 90064<br>
+1-310-597 2442 <br>
+1-310-597-0722
<br>
<a href="https://static.parastorage.com/services/santa/1.1486.16/static/external/googleMap.html?address=10644%20cushdon%20ave%20los%20angeles%20california%2090064&amp;addressInfo=Antonios%20Couture&amp;language=en&amp;lat=34.039892&amp;long=-118.42213800000002&amp;mapInteractive=true&amp;mapType=ROADMAP&amp;showMapType=true&amp;showPosition=true&amp;showStreetView=true&amp;showZoom=true&amp;ts=676" target="_blank">Google Map</a>
</div>
</div>
<!-- Inner panel End -->
<!-- Inner panel Start -->
<div class="wpsm_panel wpsm_panel-default">
<span class="ac_title_class">Esti's - USA</span>
<div class="wpsm_panel-body">
1888 Coney Island Avenue, Brooklyn, NY 11230, United States<br>
+1-718-645-2600
<br>
<a href="https://static.parastorage.com/services/santa/1.1486.16/static/external/googleMap.html?address=1888%20Coney%20Island%20Avenue%2C%20Brooklyn%2C%20NY%2011230%2C%20United%20States&amp;addressInfo=Esti%27s%2C%20Bridal%20Shop&amp;language=en&amp;lat=40.611279&amp;long=-73.96301399999999&amp;mapInteractive=true&amp;mapType=ROADMAP&amp;showMapType=true&amp;showPosition=true&amp;showStreetView=true&amp;showZoom=true&amp;ts=668" target="_blank">Google Map</a>
</div>
</div>
<!-- Inner panel End -->
<!-- Inner panel Start -->
<div class="wpsm_panel wpsm_panel-default">
<span class="ac_title_class">Vivaldi Boutique - USA</span>
<div class="wpsm_panel-body">
1388 3rd Ave, New York<br>
NY 10075<br>
+1-212-734-2805
<br>
<a href="https://static.parastorage.com/services/santa/1.1486.16/static/external/googleMap.html?address=%201388%203rd%20Ave%2C%20New%20York%2C%20NY%2010075&amp;addressInfo=Vivaldi%20Boutique&amp;language=en&amp;lat=40.7742097&amp;long=-73.95770679999998&amp;mapInteractive=true&amp;mapType=ROADMAP&amp;showMapType=true&amp;showPosition=true&amp;showStreetView=true&amp;showZoom=true&amp;ts=676" target="_blank">Google Map</a>
</div>
</div>
<!-- Inner panel End -->
<!-- Inner panel Start -->
<div class="wpsm_panel wpsm_panel-default">
<span class="ac_title_class">Elite Pour La Vie - USA</span>
<div class="wpsm_panel-body">
631 North Main Street #206, (second floor),<br> Alpharetta, GA 30009, United States<br><br>
+1-678-490-2227<br>
ga@antonioscouture.com
<br>
<a href="https://www.google.com/maps/place/Elite+Pour+La+Vie/@34.0908401,-84.3592751,12z/data=!4m24!1m18!4m17!1m8!2m2!1d-84.2885506!2d34.0972371!3m4!1m2!1d-84.2689027!2d34.0875898!3s0x88f59e1feeace0e7:0x368701208c1ae70e!1m6!1m2!1s0x88f575ea5a553275:0xbad4cd06dfba4403!2sElite+pour+la+vie!2m2!1d-84.289235!2d34.09086!3e2!3m4!1s0x88f575ea5a553275:0xbad4cd06dfba4403!8m2!3d34.09086!4d-84.289235" target="_blank">Google Map</a>
</div>
</div>
<!-- Inner panel End -->
<!-- Inner panel Start -->
<div class="wpsm_panel wpsm_panel-default">
<span class="ac_title_class">Hugo Nicholson - Canada</span>
<div class="wpsm_panel-body">
ON M5R 2E3,<br>
43 Hazelton Ave, Toronto Canada<br>
+1-416-927-7714<br>
ga@antonioscouture.com
<br>
<a href="https://static.parastorage.com/services/santa/1.1486.16/static/external/googleMap.html?address=43%20Hazelton%20Ave%2C%20Toronto%2C%20ON%20M5R%202E3%2C%20Canada&amp;addressInfo=Hugo%20Nicholson&amp;language=en&amp;lat=43.6721635&amp;long=-79.39335460000001&amp;mapInteractive=true&amp;mapType=ROADMAP&amp;showMapType=true&amp;showPosition=true&amp;showStreetView=true&amp;showZoom=true&amp;ts=676" target="_blank">Google Map</a>
</div>
</div>
<!-- Inner panel End -->
`;

export function getSuggestedContactLocationsFromLegacyHtml(): ContactLocation[] {
  return parseContactLegacyAccordionHtml(SAMPLE_LEGACY_CONTACT_ACCORDION_HTML);
}

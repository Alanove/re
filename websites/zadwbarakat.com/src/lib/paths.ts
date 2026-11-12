/** Decodes an Express request path (percent-encoded UTF-8) into the NFC form stored in the data files. */
export function decodeRequestPath(rawPath: string): string {
  let value: string;
  try {
    value = decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
  const segments = value
    .normalize('NFC')
    .split('/')
    .filter(Boolean)
    .map((segment) => (/^[\x20-\x7e]+$/.test(segment) ? segment.toLowerCase() : segment));
  return `/${segments.join('/')}`;
}

function encodeSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

/**
 * Percent-encodes a stored path for links, Location headers and sitemaps. Absolute URLs, `mailto:`/`tel:` links and
 * bare anchors pass through; a query string or fragment after the path is kept as given (callers encode its values).
 */
export function encodePath(sitePath: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(sitePath) || sitePath.startsWith('#') || sitePath.startsWith('//')) {
    return sitePath;
  }
  const cut = sitePath.search(/[?#]/);
  const path = cut === -1 ? sitePath : sitePath.slice(0, cut);
  const suffix = cut === -1 ? '' : sitePath.slice(cut);
  return path.split('/').map(encodeSegment).join('/') + suffix;
}

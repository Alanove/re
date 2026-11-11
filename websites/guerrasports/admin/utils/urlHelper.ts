/**
 * Convert text to URL-friendly format with transliteration support
 * Handles Cyrillic, Arabic, and other non-English characters
 * @param text - The text to convert
 * @returns URL-friendly string
 */
export function TOUrl(text: string): string {
  if (!text) return '';
  
  let slug = text.toLowerCase().trim();
  
  // Transliteration map for Cyrillic characters (Russian)
  const cyrillicMap: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  // Transliteration map for Arabic characters
  const arabicMap: { [key: string]: string } = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'h', 'ئ': 'y', 'ء': 'a'
  };
  
  // Common accented characters (French, Spanish, German, etc.)
  const accentMap: { [key: string]: string } = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ç': 'c', 'ñ': 'n',
    'ß': 'ss', 'æ': 'ae', 'œ': 'oe'
  };
  
  // Combine all transliteration maps
  const transliterationMap = { ...cyrillicMap, ...arabicMap, ...accentMap };
  
  // Transliterate characters
  slug = slug.split('').map(char => {
    // Check if character exists in transliteration map
    if (transliterationMap[char]) {
      return transliterationMap[char];
    }
    // Keep the character if it's already ASCII alphanumeric, space, or hyphen
    return char;
  }).join('');
  
  // Remove HTML file extension if present
  slug = slug.replace(/\.html?$/i, '');
  
  // Replace spaces and special characters with hyphens (keep only alphanumeric and hyphens)
  slug = slug.replace(/[^a-z0-9-]/gi, '-');
  
  // Replace multiple consecutive hyphens with single hyphen
  slug = slug.replace(/-+/g, '-');
  
  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  // Limit length to 500 characters (database limit)
  if (slug.length > 500) {
    slug = slug.substring(0, 500);
    slug = slug.replace(/-+$/, ''); // Remove trailing hyphen if truncated
  }
  
  return slug || 'page';
} 
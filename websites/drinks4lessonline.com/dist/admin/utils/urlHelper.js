"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOUrl = TOUrl;
function TOUrl(text) {
    if (!text)
        return '';
    let slug = text.toLowerCase().trim();
    const cyrillicMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    const arabicMap = {
        'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th',
        'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
        'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
        'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
        'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'h', 'ئ': 'y', 'ء': 'a'
    };
    const accentMap = {
        'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
        'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
        'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
        'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
        'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
        'ý': 'y', 'ÿ': 'y',
        'ç': 'c', 'ñ': 'n',
        'ß': 'ss', 'æ': 'ae', 'œ': 'oe'
    };
    const transliterationMap = { ...cyrillicMap, ...arabicMap, ...accentMap };
    slug = slug.split('').map(char => {
        if (transliterationMap[char]) {
            return transliterationMap[char];
        }
        return char;
    }).join('');
    slug = slug.replace(/\.html?$/i, '');
    slug = slug.replace(/[^a-z0-9-]/gi, '-');
    slug = slug.replace(/-+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');
    if (slug.length > 500) {
        slug = slug.substring(0, 500);
        slug = slug.replace(/-+$/, '');
    }
    return slug || 'page';
}
//# sourceMappingURL=urlHelper.js.map
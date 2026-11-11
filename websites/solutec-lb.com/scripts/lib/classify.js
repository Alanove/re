const KEEP_PAGE_IDS = new Set([1470, 346, 350, 352, 1731, 2, 1607, 1482]);
const CHROME_IDS = new Set([78, 103]);

const HACK_RE = /hacked\s*by|coupdegrace|trenggalek|cdg-wrap|wp2shell|base64_decode|eval\s*\(|javascript\s*:|wp2!|filesman|c99shell|r57shell|<\s*script\b|<\s*iframe\b/i;
const SPAM_RE = /\b(casino|viagra|porn|xxx|crypto(?:currency)?|bitcoin|forex|gambling|essay writing|replica watches|buy cheap)\b/i;
const HEX_SLUG_RE = /^[a-f0-9]{8,}(?:-htm)?$/i;

function yearOf(dateValue) {
  const match = String(dateValue || '').match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function blobOf(post, extra) {
  return [
    post.post_title,
    post.post_name,
    post.post_excerpt,
    post.post_content,
    post.post_password,
    extra || ''
  ].join('\n');
}

function reasonsFor(post, extra) {
  const reasons = [];
  const text = blobOf(post, extra);
  const year = yearOf(post.post_date);
  if (HACK_RE.test(text)) reasons.push('hack-marker');
  if (SPAM_RE.test(text)) reasons.push('spam-keyword');
  if (year >= 2026) reasons.push('dated-2026-or-later');
  if (HEX_SLUG_RE.test(String(post.post_name || ''))) reasons.push('hex-slug');
  if (/^Wp2!/i.test(String(post.post_password || ''))) reasons.push('exploit-password');
  if (/^hacked by/i.test(String(post.post_title || ''))) reasons.push('defacement-title');
  return reasons;
}

function classifyPost(post, extra) {
  const type = String(post.post_type || '');
  const status = String(post.post_status || '');
  const id = Number(post.ID);
  const reasons = reasonsFor(post, extra);
  const year = yearOf(post.post_date);

  if (['revision', 'customize_changeset', 'oembed_cache', 'attachment', 'nav_menu_item', 'shop_order', 'shop_order_refund', 'wp_global_styles', 'custom_css', 'user_request', 'wp_navigation'].includes(type)) {
    return { verdict: 'skip', reasons: ['not-content'], id, type, title: post.post_title, slug: post.post_name };
  }

  if (type === 'page' && (KEEP_PAGE_IDS.has(id) || CHROME_IDS.has(id))) {
    const contentReasons = reasonsFor({ ...post, post_content: post.post_content }, '');
    const elementorReasons = extra ? reasonsFor({ ...post, post_content: '', post_title: '', post_name: post.post_name }, extra) : [];
    const hard = elementorReasons.filter((r) => r !== 'dated-2026-or-later');
    if (hard.length) {
      return { verdict: 'drop', reasons: hard, id, type, title: post.post_title, slug: post.post_name, note: 'elementor-or-body-compromised' };
    }
    return {
      verdict: 'keep',
      reasons: contentReasons.length ? ['body-has-markers-use-elementor'] : [],
      id,
      type,
      title: post.post_title,
      slug: post.post_name,
      role: CHROME_IDS.has(id) ? 'chrome' : 'page'
    };
  }

  if (status !== 'publish') {
    return { verdict: 'skip', reasons: [`status-${status}`], id, type, title: post.post_title, slug: post.post_name };
  }

  if (type === 'page') {
    return { verdict: 'drop', reasons: reasons.length ? reasons : ['not-on-whitelist'], id, type, title: post.post_title, slug: post.post_name };
  }

  if (type === 'post') {
    if (reasons.length) {
      return { verdict: 'drop', reasons, id, type, title: post.post_title, slug: post.post_name };
    }
    if (year >= 2018 && year <= 2023) {
      return { verdict: 'keep', reasons: [], id, type, title: post.post_title, slug: post.post_name };
    }
    return { verdict: 'review', reasons: [`year-${year || 'unknown'}`], id, type, title: post.post_title, slug: post.post_name };
  }

  if (type === 'product') {
    if (reasons.length) {
      return { verdict: reasons.includes('hack-marker') || reasons.includes('defacement-title') ? 'drop' : 'review', reasons, id, type, title: post.post_title, slug: post.post_name };
    }
    return { verdict: 'keep', reasons: [], id, type, title: post.post_title, slug: post.post_name };
  }

  if (type === 'elementor-hf' || type === 'elementor_library') {
    if (reasons.some((r) => r !== 'dated-2026-or-later')) {
      return { verdict: 'drop', reasons, id, type, title: post.post_title, slug: post.post_name };
    }
    if (CHROME_IDS.has(id)) {
      return { verdict: 'keep', reasons: [], id, type, title: post.post_title, slug: post.post_name, role: 'chrome' };
    }
    return { verdict: 'review', reasons: ['unused-template'], id, type, title: post.post_title, slug: post.post_name };
  }

  return { verdict: 'skip', reasons: [`type-${type}`], id, type, title: post.post_title, slug: post.post_name };
}

function classifyTerm(term, taxonomy) {
  const text = `${term.name || ''}\n${term.slug || ''}\n${taxonomy.description || ''}`;
  const reasons = [];
  if (HACK_RE.test(text)) reasons.push('hack-marker');
  if (SPAM_RE.test(text)) reasons.push('spam-keyword');
  if (HEX_SLUG_RE.test(String(term.slug || ''))) reasons.push('hex-slug');
  const tax = String(taxonomy.taxonomy || '');
  if (tax === 'product_cat') {
    if (Number(taxonomy.count) === 0 && String(term.slug) === 'uncategorized') {
      return { verdict: 'skip', reasons: ['empty-uncategorized'], id: term.term_id, type: tax, title: term.name, slug: term.slug };
    }
    if (reasons.length) return { verdict: 'drop', reasons, id: term.term_id, type: tax, title: term.name, slug: term.slug };
    return { verdict: 'keep', reasons: [], id: term.term_id, type: tax, title: term.name, slug: term.slug };
  }
  if (tax === 'category') {
    if (reasons.length) return { verdict: 'drop', reasons, id: term.term_id, type: tax, title: term.name, slug: term.slug };
    return { verdict: 'review', reasons: ['category-kept-only-if-posts-survive'], id: term.term_id, type: tax, title: term.name, slug: term.slug };
  }
  return { verdict: 'skip', reasons: [`taxonomy-${tax}`], id: term.term_id, type: tax, title: term.name, slug: term.slug };
}

module.exports = {
  KEEP_PAGE_IDS,
  CHROME_IDS,
  HACK_RE,
  classifyPost,
  classifyTerm,
  reasonsFor
};

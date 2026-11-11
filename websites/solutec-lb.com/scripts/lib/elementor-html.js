function rewriteUrls(value) {
  return String(value || '')
    .replace(/https?:\/\/(?:www\.)?solutec-lb\.com\/wp-content\/uploads\//gi, '/uploads/')
    .replace(/https?:\/\/linuxfinal\.liteweb\.info\/~zazoo\/wp-content\/uploads\//gi, '/uploads/')
    .replace(/https?:\/\/manufacturer\.stylemixthemes\.com\/industrial\/wp-content\/uploads\/sites\/2\/2018\/08\/dots\.png/gi, '/uploads/2023/07/dots.png')
    .replace(/https?:\/\/(?:www\.)?solutec-lb\.com/gi, '')
    .replace(/(^|[\s"'(=])\/wp-content\/uploads\//g, '$1/uploads/');
}

function stripDanger(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (match) => {
      const src = match.match(/\bsrc\s*=\s*(['"])([\s\S]*?)\1/i);
      const url = src ? src[2].replace(/&amp;/g, '&') : '';
      if (/^https:\/\/maps\.google\.com\/maps\?/i.test(url)) return match;
      return '';
    })
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(url) {
  let cleaned = rewriteUrls(stripDanger(url)).trim();
  if (!cleaned || /^javascript:/i.test(cleaned)) return '';
  const pageMap = {
    '/': '/',
    '/industrial': '/',
    '/industrial/': '/',
    '/services': '/services',
    '/services/': '/services',
    '/about-us': '/about-us',
    '/about-us/': '/about-us',
    '/contact-us': '/contact-us',
    '/contact-us/': '/contact-us',
    '/products': '/products',
    '/products/': '/products',
    '/support': '/support',
    '/support/': '/support',
    '/investor-relations': '/investor-relations',
    '/investor-relations/': '/investor-relations',
    '/about-us/sustainability': '/about-us/sustainability',
    '/about-us/sustainability/': '/about-us/sustainability',
    '/services.htm': '/services',
    '/about-us.htm': '/about-us',
    '/contact-us.htm': '/contact-us',
    '/products.htm': '/products',
    '/support.htm': '/support',
    '/investor-relations.htm': '/investor-relations',
    '/about-us/sustainability.htm': '/about-us/sustainability',
    '/category/news': '/category/news',
    '/category/news/': '/category/news'
  };
  if (pageMap[cleaned]) return pageMap[cleaned];
  if (/^\/product-category\/[^/]+\/$/.test(cleaned)) return cleaned.slice(0, -1);
  return cleaned;
}

function visibilityClasses(s) {
  return ['hide_desktop', 'hide_tablet', 'hide_mobile']
    .map((key) => (s[key] ? `elementor-${s[key]}` : ''))
    .filter(Boolean);
}

function animationAttrs(s, nameKey, delayKey) {
  const name = s[nameKey];
  if (!name || name === 'none') return { classes: [], settings: {} };
  const settings = { [nameKey]: name };
  if (s[delayKey]) settings[delayKey] = Number(s[delayKey]) || 0;
  return { classes: ['elementor-invisible'], settings };
}

function settingsAttr(settings) {
  return Object.keys(settings).length ? ` data-settings="${esc(JSON.stringify(settings))}"` : '';
}

function widgetWrap(node, inner, extra) {
  const type = node.widgetType || 'widget';
  const s = node.settings || {};
  const classes = ['elementor-element', `elementor-element-${node.id}`];
  if (s._element_width === 'auto') classes.push('elementor-widget__width-auto');
  if (s._element_width === 'initial') classes.push('elementor-widget__width-initial');
  if (s._position === 'absolute') classes.push('elementor-absolute');
  if (s._position === 'fixed') classes.push('elementor-fixed');
  if (s.inline === 'yes') classes.push('sm_display_inline');
  classes.push(...visibilityClasses(s));
  const anim = animationAttrs(s, '_animation', '_animation_delay');
  classes.push(...anim.classes);
  if (extra && extra.classes) classes.push(...extra.classes);
  classes.push('elementor-widget', `elementor-widget-${type}`);
  const attrs = extra && extra.attrs ? extra.attrs : '';
  return `<div class="${classes.join(' ')}" data-id="${esc(node.id)}" data-element_type="widget"${settingsAttr(anim.settings)}${attrs} data-widget_type="${esc(type)}.default"><div class="elementor-widget-container">${inner}</div></div>`;
}

function contactFormHtml() {
  const field = (name, placeholder, required) => {
    const req = required ? ' aria-required="true" required' : '';
    const reqClass = required ? ' wpcf7-validates-as-required' : '';
    return `<span class="wpcf7-form-control-wrap" data-name="${name}"><input size="40" class="wpcf7-form-control wpcf7-text${reqClass}" aria-invalid="false" placeholder="${placeholder}" value="" type="text" name="${name}"${req}></span>`;
  };
  return `<div class="elementor-shortcode"><div class="wpcf7 js" id="wpcf7-f1350-p350-o1" lang="en-US" dir="ltr"><form id="contact-form" action="/contact-us#wpcf7-f1350-p350-o1" method="post" class="wpcf7-form init" aria-label="Contact form" novalidate="novalidate"><div class="row"><div class="col-md-6"><p>${field('your-name', 'Name', true)}</p></div><div class="col-md-6"><p>${field('company', 'Company', false)}</p></div></div><div class="row"><div class="col-md-6"><p>${field('mail', 'E-mail Address', true)}</p></div><div class="col-md-6"><p>${field('phone', 'Phone', false)}</p></div></div><div class="row"><div class="col-md-12"><p><span class="wpcf7-form-control-wrap" data-name="Help"><textarea cols="40" rows="10" class="wpcf7-form-control wpcf7-textarea" aria-invalid="false" placeholder="How can we help?" name="Help"></textarea></span></p></div></div><p><input class="wpcf7-form-control wpcf7-submit has-spinner" type="submit" value="Submit"></p><div class="wpcf7-response-output solu-form-status" aria-hidden="true"></div></form></div></div>`;
}

function renderWidget(node, unknown) {
  const s = node.settings || {};
  const type = node.widgetType || '';
  switch (type) {
    case 'heading': {
      const tag = /^(h[1-6]|div|span|p)$/.test(s.header_size) ? s.header_size : 'h2';
      const classes = ['elementor-heading-title', `elementor-size-${esc(s.size || 'default')}`];
      if (s.align) classes.push(`elementor-align-after-${esc(s.align)}`);
      if (s.align_tablet) classes.push(`elementor-align-after-tablet-${esc(s.align_tablet)}`);
      if (s.align_mobile) classes.push(`elementor-align-after-mobile-${esc(s.align_mobile)}`);
      let title = s.title || '';
      if (s.icons) title = `<i class="${esc(s.icons)}"></i><span>${title}</span>`;
      const href = s.link && s.link.url ? safeUrl(s.link.url) : '';
      if (href) title = `<a href="${esc(href)}">${title}</a>`;
      return widgetWrap(node, `<${tag} class="${classes.join(' ')}">${title}</${tag}>`);
    }
    case 'text-editor':
      return widgetWrap(node, stripDanger(s.editor || ''));
    case 'image': {
      const url = safeUrl((s.image && s.image.url) || '');
      if (!url) return '';
      const alt = esc((s.image && s.image.alt) || s.caption || '');
      return widgetWrap(node, `<img src="${esc(url)}" alt="${alt}" />`);
    }
    case 'button':
    case 'theme-button': {
      const url = safeUrl((s.link && s.link.url) || s.link_url || '#');
      const text = s.text || s.button_text || 'Read more';
      const target = s.link && s.link.is_external ? ' target="_blank" rel="noopener"' : '';
      const align = s.align ? { classes: [`elementor-align-${s.align}`] } : undefined;
      return widgetWrap(node, `<div class="elementor-button-wrapper"><a class="elementor-button elementor-button-link elementor-size-${esc(s.size || 'sm')}" href="${esc(url || '#')}"${target}><span class="elementor-button-content-wrapper"><span class="elementor-button-text">${text}</span></span></a></div>`, align);
    }
    case 'icon-box':
    case 'image-box': {
      const title = s.title_text || '';
      const desc = s.description_text || '';
      const img = s.image && s.image.url ? `<img src="${esc(safeUrl(s.image.url))}" alt="" />` : '';
      return widgetWrap(node, `${img}<h3 class="elementor-icon-box-title">${title}</h3><p class="elementor-icon-box-description">${desc}</p>`);
    }
    case 'icon-list': {
      const items = Array.isArray(s.icon_list) ? s.icon_list : [];
      const lis = items.map((item) => {
        const link = item.link && item.link.url ? safeUrl(item.link.url) : '';
        const text = item.text || '';
        return `<li>${link ? `<a href="${esc(link)}">${text}</a>` : text}</li>`;
      }).join('');
      return widgetWrap(node, `<ul class="elementor-icon-list-items">${lis}</ul>`);
    }
    case 'spacer':
      return widgetWrap(node, '<div class="elementor-spacer"></div>');
    case 'divider':
      return widgetWrap(node, '<div class="elementor-divider"></div>');
    case 'video': {
      const url = safeUrl(s.youtube_url || s.vimeo_url || s.url || (s.link && s.link.url) || '');
      if (!/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) return '';
      return widgetWrap(node, `<a href="${esc(url)}">Watch video</a>`);
    }
    case 'html':
      return widgetWrap(node, stripDanger(s.html || ''));
    case 'shortcode': {
      const raw = String(s.shortcode || '');
      if (/product/i.test(raw)) return '<div class="solu-catalog-embed"></div>';
      if (/contact-form-7/i.test(raw)) return widgetWrap(node, contactFormHtml());
      return '';
    }
    case 'accordion':
    case 'toggle':
    case 'nested-accordion': {
      const items = s.tabs || s.items || [];
      const html = items.map((item) => `<details class="elementor-accordion-item"><summary>${item.tab_title || item.title || ''}</summary><div>${stripDanger(item.tab_content || item.content || '')}</div></details>`).join('');
      return widgetWrap(node, html);
    }
    case 'tabs':
    case 'nested-tabs': {
      const items = s.tabs || s.items || [];
      const html = items.map((item) => `<section><h3>${item.tab_title || item.title || ''}</h3><div>${stripDanger(item.tab_content || item.content || '')}</div></section>`).join('');
      return widgetWrap(node, html);
    }
    case 'social-icons': {
      const items = s.social_icon_list || [];
      const html = items.map((item) => {
        const url = safeUrl(item.link && item.link.url);
        return url ? `<a href="${esc(url)}">${esc(item.social_icon && item.social_icon.value || 'social')}</a>` : '';
      }).join(' ');
      return widgetWrap(node, html);
    }
    case 'counter':
      return widgetWrap(node, `<div class="elementor-counter"><span class="elementor-counter-number">${esc(s.ending_number || '')}</span><span>${s.title || ''}</span></div>`);
    case 'nav-menu':
    case 'hfe-nav-menu':
      return '<!--SOLU_MENU-->';
    case 'sm-menu': {
      const location = esc(s.sm_menu_location || 'primary');
      return widgetWrap(node, `<div id="elementor-header-${location}" class="elementor-header"><button class="sm_menu_toggle"><i class="ti ti-menu"></i></button><a class="sm_menu_toggle_close" href="#"><i class="ti ti-close"></i></a><div id="sm_menu" class="sm_menu"><nav itemtype="http://schema.org/SiteNavigationElement" itemscope="itemscope" id="elementor-navigation" class="elementor-navigation" role="navigation" aria-label="Elementor Menu"><!--SOLU_MENU--></nav></div></div>`);
    }
    case 'sm-logo': {
      const url = safeUrl((s.image && s.image.url) || '');
      const href = safeUrl(s.link || '/');
      const alt = esc((s.image && s.image.alt) || s.text || 'Solutec');
      const img = url ? `<div class="man_logo_img"><img src="${esc(url)}" alt="${alt}"></div>` : '';
      const txt = s.text && s.text_display === 'yes' ? `<div class="man_logo_txt">${esc(s.text)}</div>` : '';
      return widgetWrap(node, `<a class="man_logo" href="${esc(href || '/')}">${img}${txt}</a>`);
    }
    case 'sm-search':
      return widgetWrap(node, '<div class="man_search_block"><i class="ti ti-search"></i></div><div class="man_search_block_bg"><div class="man_search_block_bg_close"></div><div class="search-form"><form action="/search" method="get"><input type="text" name="s" class="search-form-text" placeholder="Search..."><button type="submit" class="search-form-submit"><i class="ti ti-search"></i></button></form></div></div>');
    case 'sm-default-button': {
      const buttons = Array.isArray(s.buttons) ? s.buttons : [];
      const html = buttons.map((item) => {
        const cls = [item.inline_style === 'yes' ? 'btn_inline_style' : 'btn'];
        if (item.transparent === 'yes') cls.push('btn_transparent');
        const target = item.new_window === 'yes' ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${esc(safeUrl(item.link || '#'))}" class="${cls.join(' ')}"${target}>${esc(item.text || '')}<i class="ti ti-arrow-right"></i></a>`;
      }).join('\n');
      return widgetWrap(node, html);
    }
    case 'sm-menu-links': {
      const links = Array.isArray(s.menu_links) ? s.menu_links : [];
      const html = links.map((item) => `<li><a href="${esc(safeUrl(item.menu_link || '#'))}">${item.menu_title || ''}</a></li>`).join('');
      return widgetWrap(node, `<ul class="man_menu_links menu">${html}</ul>`);
    }
    case 'sm-service-block': {
      const hover = s.hover_margin === 'yes' ? ' man_hover_margin' : '';
      const link = safeUrl(s.link || '');
      const more = s.link_text ? `<a href="${esc(link || '#')}" class="btn_inline_style">${esc(s.link_text)}</a>` : '';
      return widgetWrap(node, `<div class="man_service_block${hover}"><i class="${esc(s.icons || '')} sm_icon"></i><h4>${s.title || ''}</h4><p>${s.content || ''}</p>${more}</div>`);
    }
    case 'sm-service-block-II': {
      const url = safeUrl((s.image && s.image.url) || '');
      const href = safeUrl(s.link || '#');
      const style = url ? ` style="background-image:url('${esc(url)}')"` : '';
      return widgetWrap(node, `<div class="man_woo_cat_item man_service_block_II man_woo_cat_item_centered"><a href="${esc(href || '#')}" class="man_image_bck" data-image="${esc(url)}"${style}><span class="man_woo_cat_item_over"></span><div class="man_woo_cat_item_cont"><i class="${esc(s.icons || '')} man_icon"></i><h3 class="man_woo_cat_item_cont_name">${s.title || ''}</h3></div><div class="man_woo_cat_item_cont man_woo_cat_item_cont_2"><h3 class="man_woo_cat_item_cont_name">${s.title || ''}</h3><div class="man_woo_cat_item_cont_an"><div>${s.content || ''}</div><span class="btn btn_transparent">View<i class="ti ti-arrow-right"></i></span></div></div></a></div>`);
    }
    case 'sm-number-block':
      return widgetWrap(node, `<div class="man_number_block"><div class="man_number_block_number">${esc(s.number || '')}</div><h3 class="man_number_block_title"><span>${esc(s.number || '')}</span>${s.title || ''}</h3>${esc(s.text || '')}</div>`);
    case 'sm-absolute-image': {
      const url = safeUrl((s.image && s.image.url) || '');
      return url ? widgetWrap(node, `<div class="man_absolute_image"><img src="${esc(url)}" alt=""></div>`) : '';
    }
    case 'image-gallery': {
      const images = Array.isArray(s.wp_gallery) ? s.wp_gallery : [];
      const columns = esc(s.gallery_columns || '4');
      const items = images.map((image) => image.url ? `<figure class="gallery-item"><div class="gallery-icon landscape"><img src="${esc(safeUrl(image.url))}" alt="${esc(image.alt || '')}"></div></figure>` : '').join('');
      const slider = s.slider === 'yes' ? { classes: ['man_gallery_slider'], attrs: ` data-items="${columns}"` } : undefined;
      return widgetWrap(node, `<div class="elementor-image-gallery"><div id="gallery-${esc(node.id)}" class="gallery gallery-columns-${columns} gallery-size-${esc(s.thumbnail_size || 'thumbnail')}">${items}</div></div>`, slider);
    }
    case 'sm-news':
    case 'sm-posts':
      return widgetWrap(node, '<div class="man_news_list row"><!--SOLU_NEWS--></div>');
    case 'icon': {
      const icon = (s.selected_icon && s.selected_icon.value) || (s.icon || 'fas fa-star');
      const href = safeUrl(s.link && s.link.url);
      const target = s.link && s.link.is_external ? ' target="_blank" rel="noopener"' : '';
      const glyph = `<i aria-hidden="true" class="${esc(icon)}"></i>`;
      const inner = href ? `<a class="elementor-icon" href="${esc(href)}"${target}>${glyph}</a>` : `<div class="elementor-icon">${glyph}</div>`;
      const view = { classes: [`elementor-view-${esc(s.view || 'default')}`] };
      return widgetWrap(node, `<div class="elementor-icon-wrapper">${inner}</div>`, view);
    }
    case 'form':
    case 'contact-form-7':
    case 'hfe-form':
      return '<div class="solu-contact-slot"></div>';
    case 'google_maps':
    case 'map': {
      const address = String(s.address || '').trim();
      if (!address) return '';
      const zoom = (s.zoom && s.zoom.size) || 15;
      const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=m&z=${encodeURIComponent(zoom)}&output=embed&iwloc=near`;
      return widgetWrap(node, `<div class="elementor-custom-embed"><iframe loading="lazy" src="${esc(src)}" title="${esc(address)}" aria-label="${esc(address)}"></iframe></div>`);
    }
    default:
      if (type && unknown) unknown.add(type);
      if (s.editor || s.title || s.title_text) {
        return widgetWrap(node, stripDanger(s.editor || s.title_text || s.title || ''));
      }
      return '';
  }
}

function renderNode(node, unknown, top) {
  if (!node || typeof node !== 'object') return '';
  const id = node.id || '';
  const s = node.settings || {};
  if (node.elType === 'section' || node.elType === 'container') {
    const inner = (node.elements || []).map((child) => renderNode(child, unknown, false)).join('');
    const height = s.height || 'default';
    const classes = [
      'elementor-section',
      node.isInner || !top ? 'elementor-inner-section' : 'elementor-top-section',
      'elementor-element',
      `elementor-element-${id}`,
      s.layout === 'full_width' ? 'elementor-section-full_width' : 'elementor-section-boxed',
      `elementor-section-height-${esc(height)}`
    ];
    if (height !== 'default') classes.push(`elementor-section-items-${esc(s.column_position || 'middle')}`);
    if (s.content_position) classes.push(`elementor-section-content-${esc(s.content_position)}`);
    classes.push(...visibilityClasses(s));
    const anim = animationAttrs(s, 'animation', 'animation_delay');
    classes.push(...anim.classes);
    const settings = Object.assign(s.background_background ? { background_background: s.background_background } : {}, anim.settings);
    const overlay = s.background_overlay_background ? '<div class="elementor-background-overlay"></div>' : '';
    return `<section class="${classes.join(' ')}" data-id="${esc(id)}" data-element_type="section"${settingsAttr(settings)}>${overlay}<div class="elementor-container elementor-column-gap-${esc(s.gap || 'default')}">${inner}</div></section>`;
  }
  if (node.elType === 'column') {
    const size = s._column_size || 100;
    const inner = (node.elements || []).map((child) => renderNode(child, unknown, false)).join('');
    const classes = ['elementor-column', `elementor-col-${size}`, node.isInner ? 'elementor-inner-column' : 'elementor-top-column', 'elementor-element', `elementor-element-${id}`];
    const anim = animationAttrs(s, 'animation', 'animation_delay');
    classes.push(...anim.classes);
    const overlay = s.background_overlay_background ? '<div class="elementor-background-overlay"></div>' : '';
    return `<div class="${classes.join(' ')}" data-id="${esc(id)}" data-element_type="column"${settingsAttr(anim.settings)}><div class="elementor-widget-wrap elementor-element-populated">${overlay}${inner}</div></div>`;
  }
  if (node.elType === 'widget') return renderWidget(node, unknown);
  return (node.elements || []).map((child) => renderNode(child, unknown, false)).join('');
}

function renderElementor(raw, postId) {
  if (!raw) return { html: '', unknown: [] };
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { html: '', unknown: ['invalid-json'] };
  }
  const unknown = new Set();
  const nodes = Array.isArray(data) ? data : [];
  const inner = nodes.map((node) => renderNode(node, unknown, true)).join('');
  const html = stripDanger(`<div class="elementor elementor-${postId}" data-elementor-type="wp-page" data-elementor-id="${postId}"><div class="elementor-section-wrap">${inner}</div></div>`);
  return { html, unknown: [...unknown] };
}

module.exports = { renderElementor, rewriteUrls, stripDanger, safeUrl };

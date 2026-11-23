"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVariantDisplayModel = buildVariantDisplayModel;
exports.isColorAttributeName = isColorAttributeName;
exports.buildColorOptionsForListing = buildColorOptionsForListing;
const imageThumbService_1 = require("./imageThumbService");
function normalizeVal(s) {
    return String(s || '')
        .trim()
        .toLowerCase();
}
function normalizeMediaUrl(url) {
    if (!url || typeof url !== 'string')
        return '';
    let u = url.trim();
    if (!u)
        return '';
    if (/^https?:\/\//i.test(u))
        return u;
    if (u.indexOf('//') === 0)
        return u;
    u = u.replace(/\\/g, '/');
    if (u.indexOf('/') !== 0)
        u = '/' + u;
    return u;
}
function parseAttributes(variant) {
    if (!variant || variant.attributes == null)
        return {};
    let attrs = variant.attributes;
    if (typeof attrs === 'string') {
        try {
            attrs = JSON.parse(attrs);
        }
        catch {
            return {};
        }
    }
    if (typeof attrs !== 'object' || attrs === null)
        return {};
    const out = {};
    for (const [k, v] of Object.entries(attrs)) {
        if (v != null && v !== '')
            out[k] = String(v);
    }
    return out;
}
function buildBucketsFromVariants(variants) {
    const byNormKey = new Map();
    for (const v of variants) {
        const attrs = parseAttributes(v);
        const vid = Number(v.id);
        for (const [key, value] of Object.entries(attrs)) {
            const nk = normalizeVal(key);
            if (!byNormKey.has(nk)) {
                byNormKey.set(nk, { storageKey: key, options: [] });
            }
            const bucket = byNormKey.get(nk);
            const nv = normalizeVal(value);
            if (!bucket.options.some(o => normalizeVal(o.value) === nv)) {
                bucket.options.push({ value, variant_id: vid });
            }
        }
    }
    return byNormKey;
}
function resolveStorageKeyFromDisplayName(displayName, variants) {
    const want = normalizeVal(displayName);
    if (!variants.length)
        return displayName;
    const first = parseAttributes(variants[0]);
    for (const k of Object.keys(first)) {
        if (normalizeVal(k) === want)
            return k;
    }
    return displayName;
}
function variantOptionsForNormKey(byNormKey, attrKey) {
    const want = normalizeVal(attrKey);
    for (const [nk, bucket] of byNormKey) {
        if (nk === want)
            return bucket.options;
    }
    return [];
}
function getBucketStorageKey(byNormKey, attrKey) {
    const want = normalizeVal(attrKey);
    for (const [nk, bucket] of byNormKey) {
        if (nk === want)
            return bucket.storageKey;
    }
    return null;
}
function mergeAttrKeySetFixed(variantsParam, byNormKey, productAttributes) {
    const paByNorm = new Map();
    for (const pa of productAttributes) {
        if (pa.name)
            paByNorm.set(normalizeVal(pa.name), pa.name);
    }
    const ordered = [];
    const seen = new Set();
    const add = (displayName) => {
        const n = normalizeVal(displayName);
        if (seen.has(n))
            return;
        seen.add(n);
        ordered.push(displayName);
    };
    const sortedPa = [...productAttributes].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    for (const pa of sortedPa) {
        if (pa.name)
            add(pa.name);
    }
    if (variantsParam.length) {
        const fa = parseAttributes(variantsParam[0]);
        for (const k of Object.keys(fa)) {
            const canonical = paByNorm.get(normalizeVal(k)) || k;
            add(canonical);
        }
    }
    for (const nk of byNormKey.keys()) {
        const bucket = byNormKey.get(nk);
        const canonical = paByNorm.get(nk) || bucket.storageKey;
        add(canonical);
    }
    return ordered;
}
function findPaByName(productAttributes, attrKey) {
    const want = normalizeVal(attrKey);
    return productAttributes.find(pa => normalizeVal(pa.name) === want);
}
function filterPaValues(attr) {
    if (!attr.values || attr.values.length === 0)
        return [];
    const sel = attr.selected_values || [];
    if (sel.length > 0) {
        return attr.values.filter(v => sel.indexOf(v.id) >= 0);
    }
    return attr.values;
}
function buildValueDetailsMap(productImages, productAttributes) {
    const map = new Map();
    for (const attr of productAttributes) {
        const attrName = attr.name || '';
        if (!attr.values)
            continue;
        for (const val of attr.values) {
            if (!val.value)
                continue;
            const valAny = val;
            const key = `${normalizeVal(attrName)}:${normalizeVal(val.value)}`;
            let resolved = '';
            let thumbFromPi = null;
            if (productImages && val.id) {
                const row = productImages.find(im => im.attribute_value_id != null && Number(im.attribute_value_id) === Number(val.id));
                if (row?.image_url)
                    resolved = normalizeMediaUrl(row.image_url);
                if (row) {
                    const rawDb = row.thumb_url_db ?? null;
                    if (row.thumb_url) {
                        const t = normalizeMediaUrl(row.thumb_url);
                        thumbFromPi = t || null;
                    }
                    if (!thumbFromPi && row.image_url) {
                        thumbFromPi = (0, imageThumbService_1.resolveListingThumbUrl)(normalizeMediaUrl(row.image_url), rawDb ?? undefined);
                    }
                }
            }
            if (!resolved && valAny.image_url)
                resolved = normalizeMediaUrl(valAny.image_url);
            const thumbFromVal = valAny.thumb_url ? normalizeMediaUrl(valAny.thumb_url) || null : null;
            const thumbCombined = thumbFromPi || thumbFromVal || null;
            map.set(key, {
                id: val.id,
                color_code: val.color_code,
                image_url: valAny.image_url ?? null,
                resolved_image_url: resolved,
                thumb_url: thumbCombined
            });
        }
    }
    return map;
}
function getDetailsForOption(valueDetailsMap, attrKey, optionValue) {
    const k = `${normalizeVal(attrKey)}:${normalizeVal(optionValue)}`;
    const direct = valueDetailsMap.get(k);
    if (direct)
        return { ...direct, id: direct.id };
    const nv = normalizeVal(optionValue);
    const wantAttr = normalizeVal(attrKey);
    for (const [key, det] of valueDetailsMap) {
        const colon = key.indexOf(':');
        if (colon < 0)
            continue;
        const attrPart = key.slice(0, colon);
        const valPart = key.slice(colon + 1);
        if (normalizeVal(attrPart) === wantAttr && valPart === nv) {
            return { ...det, id: det.id };
        }
    }
    return { id: null, color_code: null, image_url: null, resolved_image_url: '', thumb_url: null };
}
function buildVariantDisplayModel(product, variants, productAttributes) {
    if (!variants || variants.length === 0) {
        return { groups: [] };
    }
    const byNormKey = buildBucketsFromVariants(variants);
    const attrKeys = mergeAttrKeySetFixed(variants, byNormKey, productAttributes);
    const valueDetailsMap = buildValueDetailsMap(product.images, productAttributes);
    const groups = [];
    for (const attrKey of attrKeys) {
        const pa = findPaByName(productAttributes, attrKey);
        const displayName = pa?.name || attrKey;
        const displayOrder = pa?.display_order ?? 999;
        const storageKey = getBucketStorageKey(byNormKey, attrKey) || resolveStorageKeyFromDisplayName(displayName, variants);
        const fromV = variantOptionsForNormKey(byNormKey, attrKey);
        const fromPa = pa ? filterPaValues(pa) : [];
        const seen = new Set();
        const merged = [];
        const addOpt = (value, variantId, force = false) => {
            const nv = normalizeVal(value);
            if (!nv)
                return;
            if (seen.has(nv) && !force)
                return;
            seen.add(nv);
            const det = getDetailsForOption(valueDetailsMap, displayName, value);
            let resolved = det.resolved_image_url || '';
            if (!resolved && det.image_url)
                resolved = normalizeMediaUrl(det.image_url);
            merged.push({
                value,
                variant_id: variantId,
                value_id: det.id,
                color_code: det.color_code,
                image_url: det.image_url,
                resolved_image_url: resolved || null,
                thumb_url: det.thumb_url ?? null
            });
        };
        for (const o of fromPa) {
            const match = fromV.find(v => normalizeVal(v.value) === normalizeVal(o.value));
            addOpt(o.value, match ? match.variant_id : null);
        }
        for (const o of fromV) {
            addOpt(o.value, o.variant_id);
        }
        if (merged.length === 0 && pa) {
            for (const o of filterPaValues(pa)) {
                addOpt(o.value, null, true);
            }
        }
        if (merged.length === 0)
            continue;
        groups.push({
            displayName,
            storageKey,
            display_order: displayOrder,
            options: merged.sort((a, b) => (fromPa.findIndex(x => normalizeVal(x.value) === normalizeVal(a.value)) -
                fromPa.findIndex(x => normalizeVal(x.value) === normalizeVal(b.value))) ||
                a.value.localeCompare(b.value))
        });
    }
    groups.sort((a, b) => a.display_order - b.display_order);
    if (groups.length === 0 && variants.length > 0) {
        const byNorm = buildBucketsFromVariants(variants);
        const orderKeys = Array.from(byNorm.keys()).sort();
        for (const nk of orderKeys) {
            const bucket = byNorm.get(nk);
            const opts = bucket.options.map(o => {
                const det = getDetailsForOption(valueDetailsMap, bucket.storageKey, o.value);
                let resolved = det.resolved_image_url || '';
                if (!resolved && det.image_url)
                    resolved = normalizeMediaUrl(det.image_url);
                return {
                    value: o.value,
                    variant_id: o.variant_id,
                    value_id: det.id,
                    color_code: det.color_code,
                    image_url: det.image_url,
                    resolved_image_url: resolved || null
                };
            });
            if (opts.length)
                groups.push({
                    displayName: bucket.storageKey,
                    storageKey: bucket.storageKey,
                    display_order: 999,
                    options: opts
                });
        }
    }
    return { groups };
}
const COLOR_ATTR_RE = /colou?r/i;
function isColorAttributeName(name) {
    return COLOR_ATTR_RE.test(String(name || ''));
}
function buildColorOptionsForListing(product, variants, productAttributes) {
    if (!variants || variants.length === 0) {
        return [];
    }
    const { groups } = buildVariantDisplayModel(product, variants, productAttributes);
    const colorGroup = groups.find(g => isColorAttributeName(g.displayName) || isColorAttributeName(g.storageKey));
    if (!colorGroup || colorGroup.options.length === 0) {
        return [];
    }
    const defaultFull = product.images && product.images.length > 0
        ? normalizeMediaUrl(product.images[0].image_url || '')
        : '';
    const out = [];
    for (const opt of colorGroup.options) {
        let fullUrl = opt.resolved_image_url || '';
        if (!fullUrl && opt.image_url)
            fullUrl = normalizeMediaUrl(opt.image_url);
        if (!fullUrl)
            fullUrl = defaultFull;
        if (!fullUrl)
            continue;
        const swatchUrl = (0, imageThumbService_1.resolveListingThumbUrl)(fullUrl, opt.thumb_url ?? null) || fullUrl;
        const vid = opt.value_id != null && opt.value_id > 0 ? opt.value_id : null;
        out.push({
            value_id: vid,
            value: opt.value,
            color_code: opt.color_code,
            image_url: fullUrl,
            swatch_image_url: swatchUrl
        });
    }
    return out;
}
//# sourceMappingURL=variantDisplayService.js.map
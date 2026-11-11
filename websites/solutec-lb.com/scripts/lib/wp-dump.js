/**
 * Streaming-enough parser for phpMyAdmin / mysqldump INSERT statements.
 * The Solutec dump is small enough to load, but values are parsed without
 * splitting on commas so embedded HTML survives.
 */

const fs = require('fs');

function parseString(sql, i) {
  if (sql[i] !== "'") {
    throw new Error(`Expected string at ${i}`);
  }
  i += 1;
  let out = '';
  while (i < sql.length) {
    const c = sql[i];
    if (c === '\\') {
      const n = sql[i + 1];
      if (n === undefined) break;
      const map = {
        '0': '\0',
        b: '\b',
        n: '\n',
        r: '\r',
        t: '\t',
        Z: '\u001a',
        '\\': '\\',
        "'": "'",
        '"': '"'
      };
      out += Object.prototype.hasOwnProperty.call(map, n) ? map[n] : n;
      i += 2;
      continue;
    }
    if (c === "'") {
      if (sql[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, end: i + 1 };
    }
    out += c;
    i += 1;
  }
  throw new Error(`Unterminated string near offset ${i}`);
}

function isIdentChar(c) {
  return /[A-Za-z0-9_]/.test(c || '');
}

function parseValue(sql, i) {
  while (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t') i += 1;
  if (sql.startsWith('NULL', i) && !isIdentChar(sql[i + 4])) {
    return { value: null, end: i + 4 };
  }
  if (sql[i] === "'") return parseString(sql, i);
  let j = i;
  if (sql[j] === '-' || sql[j] === '+') j += 1;
  const start = j;
  while (/[0-9.eE]/.test(sql[j] || '')) j += 1;
  if (j === start) {
    throw new Error(`Unexpected value at ${i}: ${sql.slice(i, i + 40)}`);
  }
  const raw = sql.slice(i, j);
  const value = raw.includes('.') || /e/i.test(raw) ? Number(raw) : parseInt(raw, 10);
  return { value, end: j };
}

function parseTuple(sql, i) {
  while (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t') i += 1;
  if (sql[i] !== '(') {
    throw new Error(`Expected tuple at ${i}`);
  }
  i += 1;
  const values = [];
  while (i < sql.length) {
    while (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t') i += 1;
    if (sql[i] === ')') {
      return { values, end: i + 1 };
    }
    const parsed = parseValue(sql, i);
    values.push(parsed.value);
    i = parsed.end;
    while (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t') i += 1;
    if (sql[i] === ',') {
      i += 1;
      continue;
    }
    if (sql[i] === ')') {
      return { values, end: i + 1 };
    }
    throw new Error(`Expected comma or end of tuple at ${i}: ${sql.slice(i, i + 40)}`);
  }
  throw new Error('Unterminated tuple');
}

function columnNames(header) {
  const open = header.lastIndexOf('(');
  const section = open === -1 ? header : header.slice(open);
  const names = [];
  const re = /`([^`]+)`/g;
  let match;
  while ((match = re.exec(section))) names.push(match[1]);
  return names;
}

function parseInserts(sql, table, filterRow) {
  const marker = `INSERT INTO \`${table}\``;
  const rows = [];
  let idx = 0;
  while ((idx = sql.indexOf(marker, idx)) !== -1) {
    const valuesAt = sql.indexOf('VALUES', idx);
    if (valuesAt === -1) break;
    const columns = columnNames(sql.slice(idx, valuesAt));
    let i = valuesAt + 'VALUES'.length;
    while (i < sql.length) {
      while (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === '\t' || sql[i] === ',') i += 1;
      if (sql[i] === ';') {
        idx = i + 1;
        break;
      }
      if (sql[i] !== '(') {
        idx = i;
        break;
      }
      const tuple = parseTuple(sql, i);
      i = tuple.end;
      if (tuple.values.length !== columns.length) {
        continue;
      }
      const row = {};
      columns.forEach((name, n) => {
        row[name] = tuple.values[n];
      });
      if (!filterRow || filterRow(row)) rows.push(row);
    }
  }
  return rows;
}

function loadDump(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const metaKeys = new Set([
    '_elementor_data',
    '_thumbnail_id',
    '_product_image_gallery',
    '_sku',
    '_regular_price',
    '_price',
    '_sale_price',
    '_wp_attached_file',
    '_wp_page_template',
    '_elementor_template_type',
    '_menu_item_url',
    '_menu_item_type',
    '_menu_item_object',
    '_menu_item_object_id',
    '_yoast_wpseo_title',
    '_yoast_wpseo_metadesc',
    'rank_math_title',
    'rank_math_description'
  ]);
  const optionNames = new Set([
    'blogname',
    'blogdescription',
    'admin_email',
    'siteurl',
    'home',
    'permalink_structure',
    'page_on_front',
    'show_on_front'
  ]);

  const posts = parseInserts(sql, 'wp_posts');
  const metaRows = parseInserts(sql, 'wp_postmeta', (row) => metaKeys.has(String(row.meta_key)));
  const terms = parseInserts(sql, 'wp_terms');
  const taxonomies = parseInserts(sql, 'wp_term_taxonomy');
  const relationships = parseInserts(sql, 'wp_term_relationships');
  const options = parseInserts(sql, 'wp_options', (row) => optionNames.has(String(row.option_name)));

  const metaByPost = new Map();
  metaRows.forEach((row) => {
    const id = Number(row.post_id);
    if (!metaByPost.has(id)) metaByPost.set(id, {});
    metaByPost.get(id)[String(row.meta_key)] = row.meta_value == null ? '' : String(row.meta_value);
  });

  const optionMap = {};
  options.forEach((row) => {
    optionMap[String(row.option_name)] = row.option_value == null ? '' : String(row.option_value);
  });

  return { posts, metaByPost, terms, taxonomies, relationships, options: optionMap };
}

module.exports = { loadDump, parseInserts };

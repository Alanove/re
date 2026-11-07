import assert from 'node:assert/strict';
import test from 'node:test';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

function createDocument() {
  function detach(child) {
    if (child && child.parentNode) child.parentNode.removeChild(child);
  }

  function makeText(doc, value) {
    return {
      nodeType: 3,
      textContent: value == null ? '' : String(value),
      ownerDocument: doc,
      parentNode: null,
      childNodes: [],
      get firstChild() {
        return null;
      },
    };
  }

  function makeElement(doc, tag) {
    const element = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      ownerDocument: doc,
      parentNode: null,
      childNodes: [],
      _attrs: Object.create(null),
      get firstChild() {
        return this.childNodes[0] || null;
      },
      get textContent() {
        return this.childNodes.map((child) => child.textContent || '').join('');
      },
      getAttribute(name) {
        const key = String(name).toLowerCase();
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      setAttribute(name, value) {
        this._attrs[String(name).toLowerCase()] = String(value);
      },
      removeAttribute(name) {
        delete this._attrs[String(name).toLowerCase()];
      },
      appendChild(child) {
        detach(child);
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
      },
      removeChild(child) {
        const index = this.childNodes.indexOf(child);
        if (index >= 0) this.childNodes.splice(index, 1);
        if (child) child.parentNode = null;
        return child;
      },
      insertBefore(child, ref) {
        detach(child);
        child.parentNode = this;
        if (!ref) {
          this.childNodes.push(child);
          return child;
        }
        const index = this.childNodes.indexOf(ref);
        if (index < 0) this.childNodes.push(child);
        else this.childNodes.splice(index, 0, child);
        return child;
      },
    };
    return element;
  }

  const doc = {
    nodeType: 9,
    ownerDocument: null,
    createElement(tag) {
      return makeElement(doc, tag);
    },
    createTextNode(value) {
      return makeText(doc, value);
    },
  };
  return doc;
}

const VOID = new Set(['br', 'hr', 'img', 'col', 'wbr', 'input', 'source']);

function parseHtml(html, doc) {
  const root = doc.createElement('div');
  const stack = [root];
  const re = /<\/?([a-zA-Z0-9]+)\s*([^>]*?)(\/?)>|([^<]+)/g;
  let match;
  while ((match = re.exec(html))) {
    if (match[4] != null) {
      const text = match[4].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      if (text) stack[stack.length - 1].appendChild(doc.createTextNode(text));
      continue;
    }
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag.toUpperCase()) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const element = doc.createElement(tag);
    const attrRe = /([^\s=]+)\s*=\s*"([^"]*)"/g;
    let attr;
    while ((attr = attrRe.exec(match[2] || ''))) {
      element.setAttribute(attr[1], attr[2]);
    }
    stack[stack.length - 1].appendChild(element);
    if (!VOID.has(tag) && !match[3]) stack.push(element);
  }
  return root;
}

function serialize(node) {
  let html = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      html += child.textContent;
      continue;
    }
    const tag = child.tagName.toLowerCase();
    const attrs = [];
    const colspan = child.getAttribute('colspan');
    const rowspan = child.getAttribute('rowspan');
    if (colspan) attrs.push(`colspan="${colspan}"`);
    if (rowspan) attrs.push(`rowspan="${rowspan}"`);
    const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
    if (VOID.has(tag)) {
      html += `<${tag}${attrText}>`;
    } else {
      html += `<${tag}${attrText}>${serialize(child)}</${tag}>`;
    }
  }
  return html;
}

async function loadStrip() {
  const entry = path.join(srcDir, 'clear-formatting.ts');
  const outfile = path.join(os.tmpdir(), `rte-test-clear-formatting-${Date.now()}.mjs`);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  const mod = await import('file://' + outfile.replace(/\\/g, '/'));
  try {
    fs.unlinkSync(outfile);
  } catch {
    /* ignore */
  }
  return mod.stripFormatting;
}

function cleaned(stripFormatting, html) {
  const doc = createDocument();
  const root = parseHtml(html, doc);
  stripFormatting(root);
  return serialize(root);
}

test('stripFormatting keeps structure and drops styles', async () => {
  const stripFormatting = await loadStrip();
  const clean = (html) => cleaned(stripFormatting, html);

  assert.equal(
    clean('<p style="color:red"><span class="x"><strong style="font-size:20px"><em>Hi</em></strong></span></p>'),
    '<p><strong>Hi</strong></p>'
  );
  assert.equal(clean('<h2 class="title" style="font-size:40px">Title</h2>'), '<h2>Title</h2>');
  assert.equal(clean('<p>See <a href="/x">this</a> link</p>'), '<p>See this link</p>');
  assert.equal(
    clean('<ul style="color:red"><li class="item"><span>One</span></li><li>Two</li></ul>'),
    '<ul><li>One</li><li>Two</li></ul>'
  );
  assert.equal(
    clean('<ol start="3"><li><b style="color:red">A</b></li></ol>'),
    '<ol><li><b>A</b></li></ol>'
  );
  assert.equal(
    clean('<ul><li>A<ul><li><b style="color:red">B</b></li></ul></li></ul>'),
    '<ul><li>A<ul><li><b>B</b></li></ul></li></ul>'
  );
  assert.equal(
    clean('<table style="width:100%"><tbody><tr><td style="background:yellow" colspan="2" rowspan="1"><p style="font-size:20px"><a href="/x">Cell</a></p></td></tr></tbody></table>'),
    '<table><tbody><tr><td colspan="2"><p>Cell</p></td></tr></tbody></table>'
  );
  assert.equal(clean('<p><b><strong>Hi</strong></b></p>'), '<p><b>Hi</b></p>');
  assert.equal(clean('<p>Line<br>break</p>'), '<p>Line<br>break</p>');
  assert.equal(clean('<div style="color:blue">Hello <i>there</i></div>'), '<p>Hello there</p>');
  assert.equal(clean('<p>Keep <img src="x.png" alt="pic"> text</p>'), '<p>Keep  text</p>');
  assert.equal(clean('<pre>a\nb</pre>'), '<p>a<br>b</p>');
  assert.equal(clean('<p>Hi<script>alert(1)</script></p>'), '<p>Hi</p>');
  assert.equal(clean('<p></p><p>Hi</p>'), '<p>Hi</p>');
});

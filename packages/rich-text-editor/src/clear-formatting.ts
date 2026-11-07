/**
 * Remove formatting from editor HTML.
 * Keeps paragraphs, line breaks, headings, bold, lists, and tables.
 * Presentational attributes are removed. Table colspan and rowspan stay.
 */

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const DROP = new Set([
  'SCRIPT',
  'STYLE',
  'META',
  'LINK',
  'OBJECT',
  'EMBED',
  'IFRAME',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'IMG',
  'PICTURE',
  'SOURCE',
  'NOSCRIPT',
  'FORM',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'BASE',
  'FRAME',
  'FRAMESET',
  'TEMPLATE',
  'HR',
  'COL',
  'COLGROUP',
  'WBR',
]);

const KEEP_BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const KEEP_BOLD = new Set(['B', 'STRONG']);
const CONVERT_BLOCKS = new Set([
  'DIV',
  'BLOCKQUOTE',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'MAIN',
  'FIGURE',
  'FIGCAPTION',
  'CENTER',
  'NAV',
  'ADDRESS',
]);

const LEAF_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'td',
  'th',
  'caption',
  'blockquote',
  'pre',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'aside',
  'main',
  'figure',
  'figcaption',
  'center',
  'address',
].join(',');

const SHELL_TAGS = new Set(['LI', 'TD', 'TH', 'CAPTION']);

type PartialSnap = {
  before: DocumentFragment | null;
  mid: DocumentFragment;
  after: DocumentFragment | null;
  tag: string;
};

function documentOf(node: Node): Document {
  if (node.ownerDocument) return node.ownerDocument;
  return node as Document;
}

function isBlockTag(tag: string): boolean {
  return (
    KEEP_BLOCKS.has(tag) ||
    tag === 'UL' ||
    tag === 'OL' ||
    tag === 'TABLE' ||
    tag === 'LI'
  );
}

function containsBlock(nodes: Node[]): boolean {
  return nodes.some(
    (node) => node.nodeType === ELEMENT_NODE && isBlockTag((node as Element).tagName)
  );
}

function hasMeaningful(node: Node): boolean {
  if (node.nodeType === TEXT_NODE) {
    return /\S/.test(node.textContent || '');
  }
  if (node.nodeType === ELEMENT_NODE) {
    const tag = (node as Element).tagName;
    if (tag === 'BR') return true;
    if (tag === 'TD' || tag === 'TH') return true;
  }
  const children = node.childNodes;
  if (!children) return false;
  for (let i = 0; i < children.length; i++) {
    if (hasMeaningful(children[i])) return true;
  }
  return false;
}

function mergeAdjacentText(parent: ParentNode): void {
  let index = 1;
  while (index < parent.childNodes.length) {
    const current = parent.childNodes[index];
    const previous = parent.childNodes[index - 1];
    if (
      current &&
      previous &&
      current.nodeType === TEXT_NODE &&
      previous.nodeType === TEXT_NODE
    ) {
      previous.textContent = (previous.textContent || '') + (current.textContent || '');
      parent.removeChild(current);
      continue;
    }
    index += 1;
  }
}

function pushMerged(output: Node[], node: Node): void {
  const previous = output[output.length - 1];
  if (
    previous &&
    previous.nodeType === TEXT_NODE &&
    node.nodeType === TEXT_NODE
  ) {
    previous.textContent = (previous.textContent || '') + (node.textContent || '');
    return;
  }
  output.push(node);
}

function appendAll(parent: Element, nodes: Node[]): void {
  for (const node of nodes) parent.appendChild(node);
  mergeAdjacentText(parent);
}

function groupLoose(nodes: Node[], doc: Document, wrapTag = 'p'): Node[] {
  if (!containsBlock(nodes)) return nodes;
  const output: Node[] = [];
  let buffer: Node[] = [];
  const flush = () => {
    if (!buffer.length) return;
    if (buffer.some((node) => hasMeaningful(node))) {
      const paragraph = doc.createElement(wrapTag);
      buffer.forEach((node) => paragraph.appendChild(node));
      mergeAdjacentText(paragraph);
      output.push(paragraph);
    }
    buffer = [];
  };
  for (const node of nodes) {
    if (node.nodeType === ELEMENT_NODE && isBlockTag((node as Element).tagName)) {
      flush();
      output.push(node);
    } else {
      buffer.push(node);
    }
  }
  flush();
  return output;
}

function expandNewlines(nodes: Node[], doc: Document): Node[] {
  const output: Node[] = [];
  for (const node of nodes) {
    if (node.nodeType !== TEXT_NODE) {
      output.push(node);
      continue;
    }
    const parts = (node.textContent || '').replace(/\r\n?/g, '\n').split('\n');
    parts.forEach((part, index) => {
      if (index > 0) output.push(doc.createElement('br'));
      if (part) output.push(doc.createTextNode(part));
    });
  }
  return output;
}

function applySpan(source: Element, target: Element): void {
  for (const name of ['colspan', 'rowspan']) {
    const value = source.getAttribute(name);
    if (value && /^[1-9]\d*$/.test(value) && value !== '1') {
      target.setAttribute(name, value);
    }
  }
}

function appendFlattenBold(parent: Element, nodes: Node[]): void {
  for (const node of nodes) {
    if (node.nodeType === ELEMENT_NODE && KEEP_BOLD.has((node as Element).tagName)) {
      while (node.firstChild) parent.appendChild(node.firstChild);
    } else {
      parent.appendChild(node);
    }
  }
  mergeAdjacentText(parent);
}

function cleanList(nodes: Node[], doc: Document): Node[] {
  const output: Node[] = [];
  for (const node of nodes) {
    for (const cleaned of cleanNode(node, doc)) pushMerged(output, cleaned);
  }
  return output;
}

function cleanNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === TEXT_NODE) {
    const text = node.textContent || '';
    if (!text) return [];
    return [doc.createTextNode(text)];
  }
  if (node.nodeType !== ELEMENT_NODE) return [];

  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (DROP.has(tag)) return [];
  if (tag === 'BR') return [doc.createElement('br')];

  const children = cleanList(Array.from(element.childNodes), doc);

  if (KEEP_BOLD.has(tag)) {
    if (containsBlock(children)) return groupLoose(children, doc);
    const bold = doc.createElement(tag.toLowerCase());
    appendFlattenBold(bold, children);
    return hasMeaningful(bold) ? [bold] : [];
  }

  if (KEEP_BLOCKS.has(tag)) {
    if (containsBlock(children)) return groupLoose(children, doc, tag.toLowerCase());
    const block = doc.createElement(tag.toLowerCase());
    appendAll(block, children);
    return hasMeaningful(block) ? [block] : [];
  }

  if (tag === 'UL' || tag === 'OL') {
    const list = doc.createElement(tag.toLowerCase());
    for (const child of children) {
      if (child.nodeType !== ELEMENT_NODE) {
        if (!hasMeaningful(child)) continue;
        const item = doc.createElement('li');
        item.appendChild(child);
        list.appendChild(item);
        continue;
      }
      const childTag = (child as Element).tagName;
      if (childTag === 'LI') {
        list.appendChild(child);
      } else if (childTag === 'UL' || childTag === 'OL') {
        const item = doc.createElement('li');
        item.appendChild(child);
        list.appendChild(item);
      } else if (hasMeaningful(child)) {
        const item = doc.createElement('li');
        item.appendChild(child);
        list.appendChild(item);
      }
    }
    return list.firstChild ? [list] : [];
  }

  if (tag === 'LI') {
    const item = doc.createElement('li');
    appendAll(item, children);
    return hasMeaningful(item) ? [item] : [];
  }

  if (tag === 'TABLE') {
    const table = doc.createElement('table');
    for (const child of children) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const childTag = (child as Element).tagName;
      if (
        childTag === 'THEAD' ||
        childTag === 'TBODY' ||
        childTag === 'TFOOT' ||
        childTag === 'CAPTION' ||
        childTag === 'TR'
      ) {
        table.appendChild(child);
      }
    }
    return table.firstChild ? [table] : [];
  }

  if (tag === 'THEAD' || tag === 'TBODY' || tag === 'TFOOT') {
    const section = doc.createElement(tag.toLowerCase());
    for (const child of children) {
      if (child.nodeType === ELEMENT_NODE && (child as Element).tagName === 'TR') {
        section.appendChild(child);
      }
    }
    return section.firstChild ? [section] : [];
  }

  if (tag === 'TR') {
    const row = doc.createElement('tr');
    for (const child of children) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const childTag = (child as Element).tagName;
      if (childTag === 'TD' || childTag === 'TH') row.appendChild(child);
    }
    return row.firstChild ? [row] : [];
  }

  if (tag === 'TD' || tag === 'TH') {
    const cell = doc.createElement(tag.toLowerCase());
    applySpan(element, cell);
    appendAll(cell, children);
    return [cell];
  }

  if (tag === 'CAPTION') {
    const caption = doc.createElement('caption');
    appendAll(caption, children);
    return hasMeaningful(caption) ? [caption] : [];
  }

  if (tag === 'PRE') {
    const paragraph = doc.createElement('p');
    appendAll(paragraph, expandNewlines(children, doc));
    return hasMeaningful(paragraph) ? [paragraph] : [];
  }

  if (CONVERT_BLOCKS.has(tag)) {
    if (containsBlock(children)) return groupLoose(children, doc);
    const paragraph = doc.createElement('p');
    appendAll(paragraph, children);
    return hasMeaningful(paragraph) ? [paragraph] : [];
  }

  if (containsBlock(children)) return groupLoose(children, doc);
  return children;
}

/**
 * Rewrite the children of `root` to the kept plain structure.
 * The root element itself is left in place.
 */
export function stripFormatting(root: ParentNode): void {
  const doc = documentOf(root);
  const cleaned = groupLoose(cleanList(Array.from(root.childNodes), doc), doc);
  while (root.firstChild) root.removeChild(root.firstChild);
  for (const node of cleaned) root.appendChild(node);
  mergeAdjacentText(root);
}

function replaceNodeWith(node: Node, replacements: Node[]): void {
  const parent = node.parentNode;
  if (!parent) return;
  const next = node.nextSibling;
  parent.removeChild(node);
  for (const replacement of replacements) parent.insertBefore(replacement, next);
}

function replaceWithCleaned(block: HTMLElement): void {
  replaceNodeWith(block, cleanNode(block, documentOf(block)));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, '');
}

function intersects(range: Range, element: HTMLElement): boolean {
  try {
    return range.intersectsNode(element);
  } catch {
    return false;
  }
}

function intersectRange(range: Range, blockRange: Range): Range | null {
  const mid = range.cloneRange();
  try {
    if (mid.compareBoundaryPoints(Range.START_TO_START, blockRange) < 0) {
      mid.setStart(blockRange.startContainer, blockRange.startOffset);
    }
    if (mid.compareBoundaryPoints(Range.END_TO_END, blockRange) > 0) {
      mid.setEnd(blockRange.endContainer, blockRange.endOffset);
    }
  } catch {
    return null;
  }
  return mid;
}

function textCovered(range: Range, element: HTMLElement): boolean {
  if (!intersects(range, element)) return false;
  const blockRange = documentOf(element).createRange();
  blockRange.selectNodeContents(element);
  const mid = intersectRange(range, blockRange);
  if (!mid) return false;
  try {
    return compactText(mid.toString()) === compactText(element.textContent || '');
  } catch {
    return false;
  }
}

function fragmentHasMeaningful(fragment: DocumentFragment | null): boolean {
  if (!fragment) return false;
  for (let i = 0; i < fragment.childNodes.length; i++) {
    if (hasMeaningful(fragment.childNodes[i])) return true;
  }
  return false;
}

function cleanedChildren(fragment: DocumentFragment, doc: Document): Node[] {
  const holder = doc.createElement('div');
  holder.appendChild(fragment);
  stripFormatting(holder);
  return Array.from(holder.childNodes);
}

function wrapClean(nodes: Node[], sourceTag: string, doc: Document): Node[] {
  if (!nodes.length) return [];
  const tag = sourceTag.toUpperCase();
  if (tag === 'P' || /^H[1-6]$/.test(tag)) {
    if (containsBlock(nodes)) return groupLoose(nodes, doc, tag.toLowerCase());
    const element = doc.createElement(tag.toLowerCase());
    appendAll(element, nodes);
    return hasMeaningful(element) ? [element] : [];
  }
  if (containsBlock(nodes)) return groupLoose(nodes, doc, 'p');
  const paragraph = doc.createElement('p');
  appendAll(paragraph, nodes);
  return hasMeaningful(paragraph) ? [paragraph] : [];
}

function snapshotPartial(block: HTMLElement, range: Range): PartialSnap | null {
  const doc = documentOf(block);
  const blockRange = doc.createRange();
  blockRange.selectNodeContents(block);
  const mid = intersectRange(range, blockRange);
  if (!mid || mid.collapsed) return null;

  const beforeRange = doc.createRange();
  const afterRange = doc.createRange();
  try {
    beforeRange.setStart(blockRange.startContainer, blockRange.startOffset);
    beforeRange.setEnd(mid.startContainer, mid.startOffset);
    afterRange.setStart(mid.endContainer, mid.endOffset);
    afterRange.setEnd(blockRange.endContainer, blockRange.endOffset);
  } catch {
    return null;
  }

  return {
    tag: block.tagName,
    before: beforeRange.collapsed ? null : beforeRange.cloneContents(),
    mid: mid.cloneContents(),
    after: afterRange.collapsed ? null : afterRange.cloneContents(),
  };
}

function applyShell(block: HTMLElement, snap: PartialSnap): void {
  const doc = documentOf(block);
  const middle = cleanedChildren(snap.mid, doc);
  while (block.firstChild) block.removeChild(block.firstChild);
  if (fragmentHasMeaningful(snap.before) && snap.before) block.appendChild(snap.before);
  for (const node of middle) block.appendChild(node);
  if (fragmentHasMeaningful(snap.after) && snap.after) block.appendChild(snap.after);
  mergeAdjacentText(block);
}

function applySplit(block: HTMLElement, snap: PartialSnap): void {
  const doc = documentOf(block);
  const pieces: Node[] = [];
  if (fragmentHasMeaningful(snap.before) && snap.before) {
    const before = block.cloneNode(false) as HTMLElement;
    before.appendChild(snap.before);
    pieces.push(before);
  }
  pieces.push(...wrapClean(cleanedChildren(snap.mid, doc), snap.tag, doc));
  if (fragmentHasMeaningful(snap.after) && snap.after) {
    const after = block.cloneNode(false) as HTMLElement;
    after.appendChild(snap.after);
    pieces.push(after);
  }
  replaceNodeWith(block, pieces);
}

function hasDeeperLeaf(element: HTMLElement, range: Range): boolean {
  const descendants = element.querySelectorAll(LEAF_SELECTOR);
  for (let i = 0; i < descendants.length; i++) {
    const descendant = descendants[i] as HTMLElement;
    if (descendant !== element && intersects(range, descendant)) return true;
  }
  return false;
}

function depth(element: HTMLElement): number {
  let count = 0;
  let node: Node | null = element;
  while (node) {
    count += 1;
    node = node.parentNode;
  }
  return count;
}

function stripPresentationalAttributes(element: HTMLElement): void {
  const colspan = element.getAttribute('colspan');
  const rowspan = element.getAttribute('rowspan');
  while (element.attributes.length > 0) {
    element.removeAttribute(element.attributes[0].name);
  }
  if (element.tagName === 'TD' || element.tagName === 'TH') {
    if (colspan && /^[1-9]\d*$/.test(colspan) && colspan !== '1') element.setAttribute('colspan', colspan);
    if (rowspan && /^[1-9]\d*$/.test(rowspan) && rowspan !== '1') element.setAttribute('rowspan', rowspan);
  }
  if (element.tagName === 'TABLE') {
    element.querySelectorAll('colgroup, col').forEach((column) => column.remove());
  }
}

function selectionInside(editor: HTMLElement, range: Range): boolean {
  const node = range.commonAncestorContainer;
  return node === editor || editor.contains(node);
}

function closestLeaf(node: Node, editor: HTMLElement): HTMLElement | null {
  let element: HTMLElement | null =
    node.nodeType === ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  while (element && element !== editor) {
    if (LEAF_SELECTOR.split(',').includes(element.tagName.toLowerCase())) return element;
    element = element.parentElement;
  }
  return null;
}

/**
 * Clear formatting for the current selection inside `editor`.
 * A collapsed caret clears the block under the caret.
 * A partial paragraph or heading is split so the cleaned slice does not keep ancestor styles.
 * List items and table cells stay as one shell so the list or grid is not broken.
 */
export function clearFormattingInSelection(editor: HTMLElement): void {
  const view = editor.ownerDocument.defaultView;
  const selection = view && view.getSelection ? view.getSelection() : null;
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!selectionInside(editor, range)) return;

  if (range.collapsed) {
    const leaf = closestLeaf(range.startContainer, editor);
    if (!leaf) return;
    replaceWithCleaned(leaf);
    return;
  }

  const leaves = Array.from(editor.querySelectorAll(LEAF_SELECTOR)).filter((element) => {
    const leaf = element as HTMLElement;
    return intersects(range, leaf) && !hasDeeperLeaf(leaf, range);
  }) as HTMLElement[];

  if (!leaves.length) {
    const extracted = range.extractContents();
    const holder = editor.ownerDocument.createElement('div');
    holder.appendChild(extracted);
    stripFormatting(holder);
    const fragment = editor.ownerDocument.createDocumentFragment();
    while (holder.firstChild) fragment.appendChild(holder.firstChild);
    range.insertNode(fragment);
    return;
  }

  const partials: { leaf: HTMLElement; snap: PartialSnap }[] = [];
  const full: HTMLElement[] = [];
  for (const leaf of leaves) {
    if (textCovered(range, leaf)) {
      full.push(leaf);
      continue;
    }
    const snap = snapshotPartial(leaf, range);
    if (snap) partials.push({ leaf, snap });
  }

  const stripTargets = Array.from(
    editor.querySelectorAll('ul, ol, li, table, thead, tbody, tfoot, tr, td, th, caption')
  ).filter((element) => textCovered(range, element as HTMLElement)) as HTMLElement[];

  const preserveTags = new Set([
    'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'B', 'STRONG', 'BR',
    'UL', 'OL', 'LI',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION',
  ]);
  const unwrapTargets = Array.from(editor.querySelectorAll('*'))
    .filter((element) => {
      const node = element as HTMLElement;
      return !preserveTags.has(node.tagName) && textCovered(range, node);
    }) as HTMLElement[];
  unwrapTargets.sort((left, right) => depth(right) - depth(left));

  for (const item of partials) {
    if (SHELL_TAGS.has(item.leaf.tagName)) applyShell(item.leaf, item.snap);
    else applySplit(item.leaf, item.snap);
  }
  for (const leaf of full) {
    if (leaf.isConnected) replaceWithCleaned(leaf);
  }
  for (const element of stripTargets) {
    if (element.isConnected) stripPresentationalAttributes(element);
  }
  for (const wrapper of unwrapTargets) {
    if (!wrapper.isConnected || !wrapper.parentNode) continue;
    const parent = wrapper.parentNode;
    const doc = documentOf(wrapper);
    const holder = doc.createElement('div');
    while (wrapper.firstChild) holder.appendChild(wrapper.firstChild);
    stripFormatting(holder);
    const next = wrapper.nextSibling;
    parent.removeChild(wrapper);
    while (holder.firstChild) parent.insertBefore(holder.firstChild, next);
  }
}

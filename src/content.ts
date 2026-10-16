/**
 * Content script: apply the map to the page's visible text, and keep applying it
 * as the page changes underneath us.
 */

import { mayChange, splitText, type Piece } from "./core/replace";
import type { Settings } from "./core/settings";
import { loadSettings } from "./storage";

/**
 * Text inside these is not prose we should be editing: either it is not shown
 * to the reader as language, or it is a field someone is typing into, or it is
 * a code sample that would be wrong if we touched it.
 */
const SKIP_TAGS = new Set([
  "CODE",
  "NOSCRIPT",
  "PRE",
  "SCRIPT",
  "SELECT",
  "STYLE",
  "TEMPLATE",
  "TEXTAREA",
  "TITLE",
]);

/** The class the reveal-on-hover spans carry, and the stylesheet styles. */
const REPLACED_CLASS = "wa-replaced";

/**
 * What we last wrote into a text node.
 *
 * A node is rewritten only when its content is not already our own output.
 * Without this, a map like `AI → LLM` plus `LLM → large language model` would
 * keep going in the page even though the pure engine stops at one correction,
 * and our own spans would be walked and rewritten on the next pass.
 */
const written = new WeakMap<Text, string>();

let settings: Settings;

/** Whether this text node is somewhere we must leave alone. */
function skippable(node: Text): boolean {
  const element = node.parentElement;
  return element === null || element.isContentEditable || SKIP_TAGS.has(element.tagName);
}

/** Whether this text node is one we would actually rewrite. */
function rewriteable(node: Text): boolean {
  if (written.get(node) === node.data) return false;
  return !skippable(node) && mayChange(node.data, settings.rules);
}

/**
 * Every text node at or under `root` that a rule might match.
 *
 * `root` may itself be a text node: a mutation record can hand us one directly,
 * and a TreeWalker rooted at a text node would walk *past* it rather than
 * offer it up.
 */
function collect(root: Node, out: Text[]): void {
  if (root.nodeType === Node.TEXT_NODE) {
    const node = root as Text;
    if (rewriteable(node)) out.push(node);
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return rewriteable(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    out.push(node as Text);
  }
}

/**
 * Put the corrected text where the page had it.
 *
 * Plainly that is one assignment. With reveal on, each claimed piece becomes a
 * span carrying the original in its title, which is the only way a stretch of
 * text can be hovered — and the reason the option is off by default: a span is
 * a real element, and a page that lays its text out as flex or grid items will
 * notice one appearing.
 */
function write(node: Text, pieces: readonly Piece[]): void {
  if (!pieces.some((piece) => piece.original !== undefined)) return;

  if (!settings.reveal) {
    const text = pieces.map((piece) => piece.text).join("");
    written.set(node, text);
    node.data = text;
    return;
  }

  const parent = node.parentNode;
  if (parent === null) return;

  const fragment = document.createDocumentFragment();
  for (const piece of pieces) {
    if (piece.original === undefined) {
      fragment.append(piece.text);
      continue;
    }
    if (piece.text === "") continue;

    const span = document.createElement("span");
    span.className = REPLACED_CLASS;
    span.title = piece.original;
    span.textContent = piece.text;
    if (span.firstChild !== null) written.set(span.firstChild as Text, piece.text);
    fragment.append(span);
  }

  parent.replaceChild(fragment, node);
}

/**
 * Rewrite each node. Writing only when the text really changed is what makes
 * re-running a pass safe and keeps the mutation observer's callback for our own
 * edit a no-op.
 */
function apply(nodes: readonly Text[]): void {
  for (const node of nodes) write(node, splitText(node.data, settings.rules));
}

let pending: Text[] = [];
let flushQueued = false;

function flush(): void {
  flushQueued = false;
  const nodes = pending;
  pending = [];
  apply(nodes);
}

/**
 * Queue nodes and rewrite them once, after the current round of page work.
 * A page that inserts a thousand nodes gets one pass, not a thousand.
 */
function enqueue(nodes: readonly Text[]): void {
  if (nodes.length === 0) return;
  pending.push(...nodes);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flush);
}

function onMutations(records: readonly MutationRecord[]): void {
  const found: Text[] = [];

  for (const record of records) {
    if (record.type === "characterData") {
      const node = record.target as Text;
      if (rewriteable(node)) found.push(node);
      continue;
    }
    for (const added of record.addedNodes) collect(added, found);
  }

  enqueue(found);
}

async function start(): Promise<void> {
  settings = await loadSettings();

  // Observing the document element rather than the body, and sweeping the same
  // root, so that a page which replaces its own <body> wholesale is still
  // covered. Text inside <head> is filtered out by SKIP_TAGS.
  const root = document.documentElement;

  const nodes: Text[] = [];
  collect(root, nodes);
  apply(nodes);

  new MutationObserver(onMutations).observe(root, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
} else {
  void start();
}

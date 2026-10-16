/**
 * Content script: apply the rules to the page's visible text, and keep applying
 * them as the page changes underneath us.
 */

import { mayChange, replaceText } from "./core/replace";
import { DEFAULT_RULES, type Rule } from "./core/rules";

const RULES: readonly Rule[] = DEFAULT_RULES;

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

/** Whether this text node is somewhere we must leave alone. */
function skippable(node: Text): boolean {
  const element = node.parentElement;
  return element === null || element.isContentEditable || SKIP_TAGS.has(element.tagName);
}

/** Whether this text node is one we would actually rewrite. */
function rewriteable(node: Text): boolean {
  return !skippable(node) && mayChange(node.data, RULES);
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
 * Rewrite each node, writing only when the text really changed.
 *
 * That conditional write is the whole reason this terminates: our own edit
 * fires a characterData mutation, the observer looks at the new text, finds no
 * rule can match it, and stops. No bookkeeping of which nodes we have seen, and
 * therefore nothing to go stale when a page rewrites a node in place.
 */
function apply(nodes: readonly Text[]): void {
  for (const node of nodes) {
    const next = replaceText(node.data, RULES);
    if (next !== node.data) node.data = next;
  }
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

function main(): void {
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
  document.addEventListener("DOMContentLoaded", () => main(), { once: true });
} else {
  main();
}

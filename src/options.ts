/**
 * The options page: the map, editable.
 *
 * Everything the page does to the settings record goes through the same
 * normalizeSettings the content script uses, so what is saved here is exactly
 * what the page will read back — no second opinion about what a rule is.
 */

import { PRESETS } from "./core/presets";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./core/settings";
import { loadSettings, saveSettings } from "./storage";

function must<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) throw new Error(`the options page is missing ${selector}`);
  return found;
}

function firstElement(template: HTMLTemplateElement): HTMLElement {
  const element = template.content.firstElementChild;
  if (element === null) throw new Error("the row template is empty");
  return element as HTMLElement;
}

function field(row: HTMLElement, className: string): HTMLInputElement {
  const found = row.querySelector<HTMLInputElement>(`.${className}`);
  if (found === null) throw new Error(`a rule row is missing .${className}`);
  return found;
}

const rulesBody = must<HTMLTableSectionElement>("#rules");
const presetsBox = must<HTMLDivElement>("#presets");
const revealBox = must<HTMLInputElement>("#reveal");
const statusBox = must<HTMLSpanElement>("#status");
const rowPrototype = firstElement(must<HTMLTemplateElement>("#row"));

function setStatus(message: string, failed = false): void {
  statusBox.textContent = message;
  statusBox.classList.toggle("failed", failed);
}

function addRow(from: string, to: string): void {
  const row = rowPrototype.cloneNode(true) as HTMLElement;
  field(row, "from").value = from;
  field(row, "to").value = to;

  const remove = row.querySelector("button.remove");
  if (remove === null) throw new Error("a rule row is missing its remove button");
  remove.addEventListener("click", () => row.remove());

  rulesBody.append(row);
}

function showRules(rules: readonly { from: string; to: string }[]): void {
  rulesBody.replaceChildren();
  for (const rule of rules) addRow(rule.from, rule.to);
}

/** What the form currently says, filtered through the shared schema. */
function formSettings(): Settings {
  const rules = [...rulesBody.querySelectorAll<HTMLElement>("tr")].map((row) => ({
    from: field(row, "from").value.trim(),
    to: field(row, "to").value.trim(),
  }));

  return normalizeSettings({ rules, reveal: revealBox.checked });
}

function ignoredRowCount(): number {
  const typed = rulesBody.querySelectorAll("tr").length;
  return typed - formSettings().rules.length;
}

async function save(): Promise<void> {
  const settings = formSettings();
  const ignored = ignoredRowCount();

  try {
    await saveSettings(settings);
    const count = settings.rules.length;
    const rules = `${count} rule${count === 1 ? "" : "s"}`;
    const dropped = ignored > 0 ? ` ${ignored} row without a "find" value ignored.` : "";
    setStatus(`Saved ${rules}.${dropped}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    setStatus(`Could not save: ${reason}`, true);
  }
}

function renderPresets(): void {
  for (const preset of PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";

    const name = document.createElement("strong");
    name.textContent = preset.name;
    const summary = document.createElement("span");
    summary.className = "summary";
    summary.textContent = preset.summary;

    button.append(name, summary);
    button.addEventListener("click", () => {
      showRules(preset.rules);
      setStatus(`${preset.name} loaded. Save to apply it.`);
    });

    presetsBox.append(button);
  }
}

async function start(): Promise<void> {
  const settings = await loadSettings();
  showRules(settings.rules);
  revealBox.checked = settings.reveal;
  renderPresets();

  must<HTMLButtonElement>("#add").addEventListener("click", () => {
    addRow("", "");
    const rows = rulesBody.querySelectorAll("tr");
    const last = rows[rows.length - 1];
    if (last !== undefined) field(last as HTMLElement, "from").focus();
  });

  must<HTMLButtonElement>("#reset").addEventListener("click", () => {
    showRules(DEFAULT_SETTINGS.rules);
    setStatus("Default map loaded. Save to apply it.");
  });

  must<HTMLButtonElement>("#save").addEventListener("click", () => void save());
}

void start();

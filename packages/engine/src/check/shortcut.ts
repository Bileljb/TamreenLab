import type { AnswerFor, Platform, StepOf } from '@tamreen/shared';
import { result, type CheckResult } from './result';

export type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';
export type Combo = { modifiers: Set<Modifier>; key: string };

const MODIFIERS: Record<string, Modifier> = {
  CTRL: 'ctrl',
  CONTROL: 'ctrl',
  SHIFT: 'shift',
  ALT: 'alt',
  OPTION: 'alt',
  OPT: 'alt',
  CMD: 'meta',
  COMMAND: 'meta',
  META: 'meta',
  WIN: 'meta',
};

const KEY_ALIASES: Record<string, string> = {
  RETURN: 'ENTER',
  ESC: 'ESCAPE',
  ' ': 'SPACE',
  SPACEBAR: 'SPACE',
  PLUS: '+',
  MINUS: '-',
  DEL: 'DELETE',
  UP: 'ARROWUP',
  DOWN: 'ARROWDOWN',
  LEFT: 'ARROWLEFT',
  RIGHT: 'ARROWRIGHT',
  PGUP: 'PAGEUP',
  PGDN: 'PAGEDOWN',
  NUMPADADD: '+',
  NUMPADSUBTRACT: '-',
  // Physical punctuation keys (KeyboardEvent.code), so they match on any layout.
  EQUAL: '=',
  SEMICOLON: ';',
  BACKQUOTE: '`',
  QUOTE: "'",
  COMMA: ',',
  PERIOD: '.',
  SLASH: '/',
  BACKSLASH: '\\',
  BRACKETLEFT: '[',
  BRACKETRIGHT: ']',
};

/** What Shift turns a physical key into on a US keyboard, the layout Excel's docs are written for. */
const US_SHIFTED: Record<string, string> = {
  Digit1: '!',
  Digit2: '@',
  Digit3: '#',
  Digit4: '$',
  Digit5: '%',
  Digit6: '^',
  Digit7: '&',
  Digit8: '*',
  Digit9: '(',
  Digit0: ')',
  Minus: '_',
  Equal: '+',
  Backquote: '~',
  Semicolon: ':',
};

function normalizeKey(key: string): string {
  const upper = key.length === 1 ? key.toUpperCase() : key.toUpperCase().replace(/\s+/g, '');
  return KEY_ALIASES[upper] ?? upper;
}

/** `Ctrl+Shift+L` -> {ctrl, shift} + "L". The last segment is the key, so `Ctrl++` is plus. */
export function parseCombo(text: string): Combo {
  const key = text.endsWith('++') || text === '+' ? '+' : text.slice(text.lastIndexOf('+') + 1);
  const head = text.slice(0, text.length - key.length).replace(/\+$/, '');
  const modifiers = new Set<Modifier>();
  for (const part of head ? head.split('+') : []) {
    const m = MODIFIERS[part.toUpperCase()];
    if (m) modifiers.add(m);
  }
  return { modifiers, key: normalizeKey(key) };
}

function equalCombos(a: Combo, b: Combo): boolean {
  return (
    a.key === b.key &&
    a.modifiers.size === b.modifiers.size &&
    [...a.modifiers].every((m) => b.modifiers.has(m))
  );
}

/** True when two written combos mean the same keys (`Option+Down` = `Alt+ArrowDown`). */
export function sameCombo(a: string, b: string): boolean {
  return equalCombos(parseCombo(a), parseCombo(b));
}

/**
 * Combos the browser or the operating system keeps for itself: a page cannot stop them with
 * `preventDefault`, so a step that teaches only these becomes multiple choice (ADR 010).
 * Ctrl/⌘+1…9 are listed although some browsers let pages take them, to be safe everywhere.
 */
export const RESERVED_COMBOS: Record<Platform, readonly string[]> = {
  win: [
    'Ctrl+N',
    'Ctrl+T',
    'Ctrl+W',
    'Ctrl+Shift+N',
    'Ctrl+Shift+T',
    'Ctrl+Shift+W',
    'Ctrl+Shift+P',
    'Ctrl+Shift+Q',
    'Ctrl+Tab',
    'Ctrl+Shift+Tab',
    'Ctrl+PageUp',
    'Ctrl+PageDown',
    'Ctrl+F4',
    'Alt+F4',
    'Alt+Tab',
    'F11',
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => `Ctrl+${d}`),
  ],
  mac: [
    'Cmd+N',
    'Cmd+T',
    'Cmd+W',
    'Cmd+Q',
    'Cmd+H',
    'Cmd+M',
    'Cmd+Shift+N',
    'Cmd+Shift+T',
    'Cmd+Shift+W',
    'Cmd+Tab',
    'Cmd+`',
    'Cmd+Space',
    'Ctrl+Space',
    'Ctrl+Up',
    'Ctrl+Down',
    'Ctrl+Left',
    'Ctrl+Right',
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => `Cmd+${d}`),
  ],
};

const RESERVED = {
  win: RESERVED_COMBOS.win.map(parseCombo),
  mac: RESERVED_COMBOS.mac.map(parseCombo),
};

/** True when the browser will not hand this combo to the page on that platform. */
export function isReserved(text: string, platform: Platform): boolean {
  const combo = parseCombo(text);
  // Windows-key combos belong to the operating system.
  if (platform === 'win' && combo.modifiers.has('meta')) return true;
  return RESERVED[platform].some((r) => equalCombos(r, combo));
}

export type ShortcutMode = 'keys' | 'choice';

/**
 * How the learner answers: press the keys, or pick the combo from a list. Choice is used on touch
 * devices, when the author forces it, and when every correct combo is reserved on this platform.
 */
export function shortcutMode(
  step: StepOf<'SHORTCUT'>,
  platform: Platform,
  device: { touch?: boolean } = {},
): ShortcutMode {
  if (device.touch || step.check.blockedInBrowser) return 'choice';
  return step.check.combos.every((c) => isReserved(c[platform], platform)) ? 'choice' : 'keys';
}

/** A small string hash (FNV-1a), so option order is fixed per step without randomness. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The choice-mode options: the taught combo and the distractors, in a fixed order per step. */
export function shortcutOptions(step: StepOf<'SHORTCUT'>, platform: Platform): string[] {
  const all = [step.check.combos[0]!, ...(step.check.distractors ?? [])].map((c) => c[platform]);
  const options = all.filter((c, i) => all.findIndex((o) => sameCombo(o, c)) === i);
  let seed = hash(`${step.slug}:${platform}`);
  for (let i = options.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    const j = seed % (i + 1);
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return options;
}

const KEY_LABELS: Record<string, string> = {
  ARROWUP: '↑',
  ARROWDOWN: '↓',
  ARROWLEFT: '←',
  ARROWRIGHT: '→',
  ESCAPE: 'Esc',
  SPACE: 'Space',
  ENTER: 'Enter',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
  PAGEUP: 'PgUp',
  PAGEDOWN: 'PgDn',
};

// Mac keyboards print "return", and "delete" on the key that sends Backspace.
const MAC_KEY_LABELS: Record<string, string> = {
  ENTER: 'Return',
  BACKSPACE: 'Delete',
  DELETE: '⌦',
};

const MODIFIER_LABELS: Record<Platform, [Modifier, string][]> = {
  win: [
    ['ctrl', 'Ctrl'],
    ['alt', 'Alt'],
    ['shift', 'Shift'],
    ['meta', 'Win'],
  ],
  // Apple's order: Control, Option, Shift, Command.
  mac: [
    ['ctrl', '⌃'],
    ['alt', '⌥'],
    ['shift', '⇧'],
    ['meta', '⌘'],
  ],
};

/** The keycaps to draw for a combo, modifiers first, in each platform's usual order and names. */
export function formatCombo(text: string, platform: Platform): string[] {
  const combo = parseCombo(text);
  const mods = MODIFIER_LABELS[platform].filter(([m]) => combo.modifiers.has(m)).map(([, l]) => l);
  let key = KEY_LABELS[combo.key] ?? combo.key;
  if (platform === 'mac') key = MAC_KEY_LABELS[combo.key] ?? key;
  return [...mods, key];
}

/** Keys a press can stand for: the produced character, and the physical key on any layout. */
function pressedKeys(keys: Extract<AnswerFor['SHORTCUT'], { keys: unknown }>['keys']): string[] {
  const out = [normalizeKey(keys.key)];
  const code = keys.code ?? '';
  const physical = /^(?:Key|Digit)(.)$/.exec(code)?.[1];
  if (physical) out.push(physical.toUpperCase());
  else if (code) out.push(normalizeKey(code));
  const shifted = US_SHIFTED[code];
  if (keys.shiftKey && shifted) out.push(shifted);
  return out;
}

export function checkShortcut(
  step: StepOf<'SHORTCUT'>,
  answer: AnswerFor['SHORTCUT'],
): CheckResult {
  const { platform } = answer;
  const correct = step.check.combos.map((c) => parseCombo(c[platform]));

  if ('combo' in answer) {
    const picked = parseCombo(answer.combo);
    return result(correct.some((c) => equalCombos(c, picked)) ? 'OK' : 'WRONG_VALUE');
  }

  const { keys } = answer;
  const held = new Set<Modifier>();
  if (keys.ctrlKey) held.add('ctrl');
  if (keys.shiftKey) held.add('shift');
  if (keys.altKey) held.add('alt');
  if (keys.metaKey) held.add('meta');
  const pressed = pressedKeys(keys);

  const matches = correct.some(
    (combo) =>
      pressed.includes(combo.key) &&
      combo.modifiers.size === held.size &&
      [...combo.modifiers].every((m) => held.has(m)),
  );
  return result(matches ? 'OK' : 'WRONG_VALUE');
}

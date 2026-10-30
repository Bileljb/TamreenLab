import type { AnswerFor, StepOf } from '@tamreen/shared';
import { result, type CheckResult } from './result';

type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';
type Combo = { modifiers: Set<Modifier>; key: string };

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
};

function normalizeKey(key: string): string {
  const upper = key.length === 1 ? key.toUpperCase() : key.toUpperCase().replace(/\s+/g, '');
  return KEY_ALIASES[upper] ?? upper;
}

/** `Ctrl+Shift+L` -> {ctrl, shift} + "L". The last segment is the key, so `Ctrl++` is plus. */
function parseCombo(text: string): Combo {
  const key = text.endsWith('++') || text === '+' ? '+' : text.slice(text.lastIndexOf('+') + 1);
  const head = text.slice(0, text.length - key.length).replace(/\+$/, '');
  const modifiers = new Set<Modifier>();
  for (const part of head ? head.split('+') : []) {
    const m = MODIFIERS[part.toUpperCase()];
    if (m) modifiers.add(m);
  }
  return { modifiers, key: normalizeKey(key) };
}

/** Keys a press can stand for: the produced character, and the physical key on any layout. */
function pressedKeys(keys: AnswerFor['SHORTCUT']['keys']): string[] {
  const out = [normalizeKey(keys.key)];
  const code = keys.code ?? '';
  const physical = /^(?:Key|Digit)(.)$/.exec(code)?.[1];
  if (physical) out.push(physical.toUpperCase());
  else if (code) out.push(normalizeKey(code));
  return out;
}

export function checkShortcut(
  step: StepOf<'SHORTCUT'>,
  answer: AnswerFor['SHORTCUT'],
): CheckResult {
  const { keys, platform } = answer;
  const held = new Set<Modifier>();
  if (keys.ctrlKey) held.add('ctrl');
  if (keys.shiftKey) held.add('shift');
  if (keys.altKey) held.add('alt');
  if (keys.metaKey) held.add('meta');
  const pressed = pressedKeys(keys);

  const matches = step.check.combos.some((c) => {
    const combo = parseCombo(c[platform]);
    return (
      pressed.includes(combo.key) &&
      combo.modifiers.size === held.size &&
      [...combo.modifiers].every((m) => held.has(m))
    );
  });
  return result(matches ? 'OK' : 'WRONG_VALUE');
}

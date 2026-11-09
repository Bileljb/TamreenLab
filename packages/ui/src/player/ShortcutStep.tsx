'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { formatCombo, shortcutMode, shortcutOptions } from '@tamreen/engine';
import type { AnswerFor, Platform, StepOf } from '@tamreen/shared';

type ShortcutAnswer = AnswerFor['SHORTCUT'];

const MODIFIER_KEYS = new Set([
  'Control',
  'Shift',
  'Alt',
  'AltGraph',
  'Meta',
  'OS',
  'Fn',
  'CapsLock',
]);

/** A combo drawn as keyboard keys, always left to right. */
export function Keycaps({
  combo,
  platform,
  size = 'md',
}: {
  combo: string;
  platform: Platform;
  size?: 'md' | 'lg';
}) {
  const cap = size === 'lg' ? 'min-w-10 px-3 py-1.5 text-lg' : 'min-w-7 px-2 py-0.5 text-sm';
  return (
    <span dir="ltr" className="inline-flex flex-wrap items-center gap-1 align-middle">
      {formatCombo(combo, platform).map((label, i) => (
        <kbd
          key={i}
          className={`inline-block rounded-lg border border-b-[3px] border-line-strong bg-canvas text-center font-mono font-semibold text-ink ${cap}`}
        >
          {label}
        </kbd>
      ))}
    </span>
  );
}

/** A key press written as a combo (`Ctrl+Shift+L`), naming the key the way a US keyboard prints it. */
function heldModifiers(e: KeyboardEvent): string[] {
  return [
    e.ctrlKey && 'Ctrl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Meta',
  ].filter((m): m is string => !!m);
}

function pressText(e: KeyboardEvent): string {
  const mods = heldModifiers(e);
  const physical = /^(?:Key|Digit)(.)$/.exec(e.code)?.[1];
  const ascii = e.key.length === 1 && /[\x21-\x7e]/.test(e.key);
  const key = ascii ? e.key : (physical ?? (e.code || e.key));
  return [...mods, key === ' ' ? 'Space' : key].join('+');
}

type Props = {
  step: StepOf<'SHORTCUT'>;
  platform: Platform;
  touch: boolean;
  settled: boolean;
  picked: string | null;
  onPlatform: (platform: Platform) => void;
  onPick: (combo: string) => void;
  onPress: (answer: ShortcutAnswer) => void;
  onEnter: () => void;
};

/**
 * Answers a shortcut step: press the keys in the capture box, or, on touch screens and for combos
 * the browser keeps for itself, pick the combo from a list (ADR 010).
 */
export function ShortcutStep(props: Props) {
  const { step, platform, touch, settled } = props;
  const t = useTranslations('player');
  const mode = shortcutMode(step, platform, { touch });
  const [held, setHeld] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  // Tab moves focus out of the box, unless this step teaches a Tab combo.
  const teachesTab = step.check.combos.some((c) => /(^|\+)tab$/i.test(c[platform]));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (settled || e.repeat) return;
    if (e.key === 'Tab' && !teachesTab) return;
    e.preventDefault();
    e.stopPropagation();
    if (MODIFIER_KEYS.has(e.key)) {
      const mods = heldModifiers(e);
      setHeld(mods.length ? mods.join('+') : null);
      return;
    }
    const text = pressText(e);
    setHeld(null);
    setPressed(text);
    props.onPress({
      keys: {
        key: e.key,
        code: e.code || undefined,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      },
      platform,
    });
  }

  function onKeyUp(e: KeyboardEvent<HTMLDivElement>) {
    if (!MODIFIER_KEYS.has(e.key)) return;
    // Stops Alt from opening the browser's menu bar (Firefox on Windows).
    e.preventDefault();
    setHeld(null);
  }

  const toggle =
    'rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t('platformLabel')}
        className="flex items-center gap-2 self-start text-xs text-muted"
      >
        <span aria-hidden>{t('platformLabel')}</span>
        <span className="inline-flex rounded-full border border-line bg-canvas p-0.5">
          {(['win', 'mac'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={platform === p}
              className={`${toggle} ${platform === p ? 'bg-brand text-brand-ink shadow-soft' : 'text-muted hover:text-ink'}`}
              onClick={() => {
                setPressed(null);
                props.onPlatform(p);
              }}
            >
              {t(p === 'win' ? 'platformWin' : 'platformMac')}
            </button>
          ))}
        </span>
      </div>

      {mode === 'keys' ? (
        <div
          tabIndex={0}
          role="textbox"
          aria-readonly
          aria-label={t('shortcutPress')}
          data-shortcut-capture
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-canvas px-4 py-6 text-center transition focus:border-solid focus:border-brand focus:bg-brand-soft focus:outline-none"
        >
          <span className="flex min-h-10 items-center">
            {held ? (
              <Keycaps combo={`${held}+…`} platform={platform} size="lg" />
            ) : pressed ? (
              <span className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted">{t('shortcutPressed')}</span>
                <Keycaps combo={pressed} platform={platform} size="lg" />
              </span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="size-9 text-muted group-focus:text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="2.5" y="6" width="19" height="12" rx="2" />
                <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" />
              </svg>
            )}
          </span>
          <span className="text-sm font-medium text-muted group-focus:text-brand-strong">
            {t('shortcutPress')}
          </span>
        </div>
      ) : (
        <fieldset
          className="flex flex-col gap-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              props.onEnter();
            }
          }}
        >
          <legend className="mb-2 text-sm text-muted">
            {t(touch ? 'shortcutTouchNote' : 'shortcutBlockedNote')}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {shortcutOptions(step, platform).map((combo) => (
              <label
                key={combo}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${
                  props.picked === combo
                    ? 'border-brand bg-brand-soft shadow-glow'
                    : 'border-line bg-raised hover:-translate-y-px hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name={`shortcut-${step.slug}`}
                  className="size-4 accent-brand"
                  aria-label={formatCombo(combo, platform).join(' + ')}
                  checked={props.picked === combo}
                  disabled={settled}
                  onChange={() => props.onPick(combo)}
                />
                <Keycaps combo={combo} platform={platform} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

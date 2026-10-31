'use client';

import type { Dispatch } from 'react';
import { useTranslations } from 'next-intl';
import type { GridAction } from './state';

const KEYS = ['=', '(', ')', ',', ':', '$', '"'] as const;
const COMMON_FUNCTIONS = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'IF'];

type Props = {
  functions: string[];
  dispatch: Dispatch<GridAction>;
};

/**
 * On-screen keys for touch keyboards, where "(", ":" and "$" are buried (PLAN §1.6). Shown on
 * narrow or touch screens. Buttons never take focus, so the caret stays in the editor.
 */
export function FormulaHelperBar({ functions, dispatch }: Props) {
  const t = useTranslations('grid');
  const names = [...new Set([...functions, ...COMMON_FUNCTIONS])];
  const button =
    'h-9 min-w-9 shrink-0 rounded-lg border border-line bg-raised px-2.5 font-mono text-sm shadow-soft transition active:scale-95 active:bg-brand-soft';

  return (
    <div
      role="toolbar"
      aria-label={t('helperBar')}
      className="hidden gap-1.5 overflow-x-auto pb-1 max-sm:flex pointer-coarse:flex"
      data-helper-bar=""
    >
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={button}
          aria-label={t('insertKey', { key })}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => dispatch({ type: 'insertText', text: key })}
        >
          {key}
        </button>
      ))}
      {names.map((name) => (
        <button
          key={name}
          type="button"
          className={`${button} text-brand-strong`}
          aria-label={t('insertFunction', { name })}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => dispatch({ type: 'insertText', text: `${name}(` })}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

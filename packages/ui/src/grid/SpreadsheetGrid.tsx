'use client';

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  indexToColumn,
  normalizeAddress,
  normalizeRange,
  parseAddress,
} from '@tamreen/engine';
import type { SheetSpec } from '@tamreen/shared';
import { formatFor, formatValue } from './format';
import { FormulaHelperBar } from './FormulaHelperBar';
import {
  addressOf,
  canPoint,
  createGridState,
  gridReducer,
  isSelected,
  parseTSV,
  rawText,
  selectionBounds,
  selectionLabel,
  toTSV,
  type GridAction,
  type GridState,
  type Pos,
} from './state';

/** Grid state owned by the caller (the lesson player reads the selection and the last entry). */
export function useGrid(sheet: SheetSpec) {
  return useReducer(gridReducer, sheet, (s) => createGridState(s.visible, s.cells));
}

type Props = {
  sheet: SheetSpec;
  state: GridState;
  dispatch: Dispatch<GridAction>;
  /** Function names offered as chips in the helper bar. */
  functions?: string[];
  /** Enter pressed while not editing: the player uses it for Check / Continue. */
  onIdleEnter?: () => void;
};

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function posFromElement(el: Element | null): Pos | null {
  const cell = el?.closest<HTMLElement>('[data-row]');
  if (!cell) return null;
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

export function SpreadsheetGrid({ sheet, state, dispatch, functions = [], onIdleEnter }: Props) {
  const t = useTranslations('grid');
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const cellInput = useRef<HTMLInputElement>(null);
  const barInput = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ anchor: Pos; point: boolean } | null>(null);
  const [nameBox, setNameBox] = useState<string | null>(null);

  const values = useMemo(() => {
    const evaluated = new Sheet({ ...state.base, ...state.overrides });
    return (address: string) =>
      formatValue(evaluated.valueAt(address), formatFor(sheet.formats, address));
  }, [state.base, state.overrides, sheet.formats]);

  const rows = range(state.top.row, state.bottom.row);
  const cols = range(state.top.col, state.bottom.col);
  const { start, end } = selectionBounds(state);
  const activeAddress = addressOf(state.active);
  const edit = state.edit;

  // Keep keyboard focus on the active cell when it moves, as long as focus is inside the grid.
  useEffect(() => {
    if (edit) return;
    if (!container.current?.contains(document.activeElement)) return;
    if (document.activeElement === barInput.current) return;
    cellRefs.current.get(activeAddress)?.focus();
  }, [activeAddress, edit]);

  // Put focus and the caret where the edit happens (the helper bar edits without focus).
  useEffect(() => {
    if (!edit) return;
    const input = edit.source === 'cell' ? cellInput.current : barInput.current;
    if (!input) return;
    if (document.activeElement !== input) input.focus();
    if (input.selectionStart !== edit.caret) input.setSelectionRange(edit.caret, edit.caret);
  }, [edit]);

  const focusActiveCell = () => cellRefs.current.get(activeAddress)?.focus();

  function onCellKeyDown(e: KeyboardEvent) {
    if (edit) return;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      dispatch({ type: 'move', dRow: move[0], dCol: move[1], extend: e.shiftKey });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: 'move', dRow: 0, dCol: e.shiftKey ? -1 : 1 });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onIdleEnter?.();
    } else if (e.key === 'F2') {
      e.preventDefault();
      dispatch({ type: 'startEdit', source: 'cell' });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'clear' });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      dispatch({ type: 'startEdit', text: e.key, source: 'cell' });
    }
  }

  function onEditorKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      dispatch({ type: 'commit', move: 'down' });
      focusAfterEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      dispatch({ type: 'commit', move: e.shiftKey ? 'none' : 'right' });
      focusAfterEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatch({ type: 'cancel' });
      focusAfterEdit();
    }
  }

  // After a commit the active cell may change; focus it once React has re-rendered.
  function focusAfterEdit() {
    requestAnimationFrame(() => {
      const active = container.current?.querySelector<HTMLElement>('[data-active="true"]');
      active?.focus();
    });
  }

  function onCopy(e: ClipboardEvent) {
    if (edit) return;
    const text = toTSV(
      range(start.row, end.row).map((r) =>
        range(start.col, end.col).map((c) => values(addressOf({ row: r, col: c }))),
      ),
    );
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  }

  function onPaste(e: ClipboardEvent) {
    if (edit) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    dispatch({ type: 'paste', rows: parseTSV(text) });
  }

  function onPointerDown(e: PointerEvent) {
    const pos = posFromElement(e.target as Element);
    if (!pos || e.button !== 0) return;
    // Touch pointers are captured by the first element; release so moves report other cells.
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const pointing = !!edit && (edit.point !== null || canPoint(edit.text, edit.caret));
    if (pointing) {
      e.preventDefault(); // keep focus (and the caret) in the editor
      drag.current = { anchor: pos, point: true };
      dispatch({ type: 'point', anchor: pos, active: pos });
      return;
    }
    if (edit && addressOf(pos) === activeAddress) return; // clicking inside the cell being edited
    drag.current = { anchor: e.shiftKey ? state.anchor : pos, point: false };
    dispatch({ type: 'select', pos, extend: e.shiftKey });
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const pos = posFromElement(document.elementFromPoint?.(e.clientX, e.clientY) ?? null);
    if (!pos) return;
    dispatch(
      d.point
        ? { type: 'point', anchor: d.anchor, active: pos }
        : { type: 'selectRange', anchor: d.anchor, active: pos },
    );
  }

  const endDrag = () => {
    drag.current = null;
  };

  function onNameBoxKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setNameBox(null);
      focusActiveCell();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const text = (nameBox ?? '').trim();
    try {
      if (text.includes(':')) {
        const [a, b] = normalizeRange(text).split(':').map(parseAddress) as [Pos, Pos];
        dispatch({ type: 'selectRange', anchor: a, active: b });
      } else {
        dispatch({ type: 'select', pos: parseAddress(normalizeAddress(text)) });
      }
    } catch {
      // Not an address: leave the selection as it is.
    }
    setNameBox(null);
    focusAfterEdit();
  }

  const barValue = edit ? edit.text : rawText(state, activeAddress);

  return (
    <div ref={container} dir="ltr" className="flex w-full max-w-full flex-col gap-2 text-start">
      <div className="flex items-stretch gap-2">
        <input
          aria-label={t('nameBox')}
          className="w-24 shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:outline-2 focus:outline-emerald-600"
          value={nameBox ?? selectionLabel(state)}
          spellCheck={false}
          autoCapitalize="characters"
          onFocus={(e) => {
            setNameBox(selectionLabel(state));
            e.currentTarget.select();
          }}
          onBlur={() => setNameBox(null)}
          onChange={(e) => setNameBox(e.target.value)}
          onKeyDown={onNameBoxKeyDown}
        />
        <span aria-hidden className="flex items-center font-serif text-sm italic text-slate-500">
          fx
        </span>
        <input
          ref={barInput}
          aria-label={t('formulaBar')}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:outline-2 focus:outline-emerald-600"
          value={barValue}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onFocus={() => {
            if (!edit) dispatch({ type: 'startEdit', source: 'bar' });
          }}
          onChange={(e) =>
            dispatch({
              type: 'setEditText',
              text: e.target.value,
              caret: e.target.selectionStart ?? e.target.value.length,
              source: 'bar',
            })
          }
          onSelect={(e) => {
            const input = e.currentTarget;
            if (edit && input.selectionStart !== null && input.selectionStart !== edit.caret) {
              dispatch({
                type: 'setEditText',
                text: input.value,
                caret: input.selectionStart,
                source: 'bar',
              });
            }
          }}
          onKeyDown={onEditorKeyDown}
        />
      </div>

      <FormulaHelperBar functions={functions} dispatch={dispatch} />

      <div className="max-w-full overflow-x-auto rounded-md border border-slate-300 bg-white">
        <table
          role="grid"
          aria-label={t('label')}
          aria-rowcount={rows.length + 1}
          aria-colcount={cols.length + 1}
          aria-multiselectable="true"
          className="touch-none select-none border-collapse text-sm"
          onKeyDown={onCellKeyDown}
          onCopy={onCopy}
          onPaste={onPaste}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(e) => {
            if (posFromElement(e.target as Element))
              dispatch({ type: 'startEdit', source: 'cell' });
          }}
        >
          <thead>
            <tr role="row">
              <th className="w-10 border-b border-e border-slate-300 bg-slate-100" aria-hidden />
              {cols.map((c) => (
                <th
                  key={c}
                  role="columnheader"
                  scope="col"
                  className={`min-w-16 border-b border-e border-slate-300 px-2 py-1 font-medium ${
                    c >= start.col && c <= end.col
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {indexToColumn(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} role="row">
                <th
                  role="rowheader"
                  scope="row"
                  className={`border-b border-e border-slate-300 px-2 font-medium ${
                    r >= start.row && r <= end.row
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {r + 1}
                </th>
                {cols.map((c) => {
                  const pos = { row: r, col: c };
                  const address = addressOf(pos);
                  const active = address === activeAddress;
                  const selected = isSelected(state, pos);
                  const text = values(address);
                  const numeric = /^-?[\d.,]+%?$/.test(text);
                  return (
                    <td
                      key={c}
                      ref={(el) => {
                        if (el) cellRefs.current.set(address, el);
                        else cellRefs.current.delete(address);
                      }}
                      role="gridcell"
                      aria-selected={selected}
                      aria-label={text ? undefined : address}
                      tabIndex={active ? 0 : -1}
                      data-row={r}
                      data-col={c}
                      data-address={address}
                      data-active={active}
                      className={`relative h-9 min-w-16 max-w-48 truncate border-b border-e border-slate-200 px-2 ${
                        numeric ? 'text-end' : 'text-start'
                      } ${selected ? 'bg-emerald-50' : ''} ${
                        active ? 'outline-2 -outline-offset-2 outline-emerald-600' : ''
                      } focus:outline-none focus-visible:outline-2 focus-visible:outline-emerald-700`}
                    >
                      {active && edit?.source === 'cell' ? (
                        <input
                          ref={cellInput}
                          aria-label={t('cellEditor', { address })}
                          className="absolute inset-0 w-full bg-white px-2 font-mono outline-2 -outline-offset-2 outline-emerald-600"
                          value={edit.text}
                          spellCheck={false}
                          autoComplete="off"
                          onChange={(e) =>
                            dispatch({
                              type: 'setEditText',
                              text: e.target.value,
                              caret: e.target.selectionStart ?? e.target.value.length,
                              source: 'cell',
                            })
                          }
                          onKeyDown={onEditorKeyDown}
                        />
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { CellInput, Cells } from '@tamreen/shared';
import {
  normalizeAddress,
  normalizeDigits,
  normalizeRange,
  parseAddress,
  prepareFormula,
  toAddress,
} from '@tamreen/engine';

/** Zero-based position inside the whole sheet (not the visible window). */
export type Pos = { row: number; col: number };

export type EditState = {
  text: string;
  caret: number;
  /** Where the learner is typing; the other editor mirrors it. */
  source: 'cell' | 'bar';
  /** Text span of the reference inserted by clicking a cell (point mode), replaced on the next click. */
  point: { start: number; end: number } | null;
};

export type GridState = {
  /** Visible window, inclusive. */
  top: Pos;
  bottom: Pos;
  active: Pos;
  anchor: Pos;
  edit: EditState | null;
  /** The step's starting cells. */
  base: Cells;
  /** What the learner entered, keyed by address; formulas already normalised for evaluation. */
  overrides: Cells;
  /** The last committed entry, as typed. The player checks ENTER_* steps against it. */
  lastCommit: { address: string; text: string; seq: number } | null;
};

export type GridAction =
  | { type: 'select'; pos: Pos; extend?: boolean }
  | { type: 'selectRange'; anchor: Pos; active: Pos }
  | { type: 'move'; dRow: number; dCol: number; extend?: boolean }
  | { type: 'startEdit'; text?: string; source: 'cell' | 'bar' }
  | { type: 'setEditText'; text: string; caret: number; source?: 'cell' | 'bar' }
  | { type: 'insertText'; text: string; caretOffset?: number }
  | { type: 'point'; anchor: Pos; active: Pos }
  | { type: 'commit'; move: 'down' | 'right' | 'none' }
  | { type: 'cancel' }
  | { type: 'clear' }
  | { type: 'paste'; rows: string[][] }
  | { type: 'setCell'; address: string; text: string };

export function createGridState(visible: string, base: Cells = {}): GridState {
  const [start, end] = normalizeRange(visible).split(':').map(parseAddress) as [Pos, Pos];
  return {
    top: start,
    bottom: end,
    active: start,
    anchor: start,
    edit: null,
    base: Object.fromEntries(Object.entries(base).map(([a, v]) => [normalizeAddress(a), v])),
    overrides: {},
    lastCommit: null,
  };
}

export const addressOf = (pos: Pos) => toAddress(pos.row, pos.col);

/** The selected range, top-left first. */
export function selectionBounds(state: Pick<GridState, 'active' | 'anchor'>): {
  start: Pos;
  end: Pos;
} {
  const { active: a, anchor: b } = state;
  return {
    start: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    end: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
}

/** `B3` for a single cell, `A1:C4` for a range. */
export function selectionLabel(state: Pick<GridState, 'active' | 'anchor'>): string {
  const { start, end } = selectionBounds(state);
  const a = addressOf(start);
  const b = addressOf(end);
  return a === b ? a : `${a}:${b}`;
}

export function isSelected(state: Pick<GridState, 'active' | 'anchor'>, pos: Pos): boolean {
  const { start, end } = selectionBounds(state);
  return pos.row >= start.row && pos.row <= end.row && pos.col >= start.col && pos.col <= end.col;
}

/** What a typed entry becomes in the cell, as Excel would store it. */
export function parseInput(text: string): CellInput | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (trimmed.startsWith('=') || trimmed.startsWith('＝')) return prepareFormula(trimmed);
  const asNumber = normalizeDigits(trimmed);
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(asNumber)) return Number(asNumber);
  const upper = trimmed.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return upper === 'TRUE';
  return text;
}

/** A formula caret where a reference can go: right after "=", "(", a separator or an operator. */
export function canPoint(text: string, caret: number): boolean {
  if (!text.startsWith('=')) return false;
  const before = text.slice(0, caret).trimEnd();
  return /[=(,;؛،+\-*/^&<>:]$/.test(before);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function clampPos(state: GridState, pos: Pos): Pos {
  return {
    row: clamp(pos.row, state.top.row, state.bottom.row),
    col: clamp(pos.col, state.top.col, state.bottom.col),
  };
}

function commitText(state: GridState, address: string, text: string): GridState {
  const overrides = { ...state.overrides };
  const value = parseInput(text);
  // An empty entry clears the cell; '' overrides a base value too.
  overrides[address] = value === undefined ? '' : value;
  return {
    ...state,
    overrides,
    lastCommit: { address, text, seq: (state.lastCommit?.seq ?? 0) + 1 },
  };
}

function insertAt(edit: EditState, text: string, caretOffset = text.length): EditState {
  const { text: current, caret } = edit;
  return {
    ...edit,
    text: current.slice(0, caret) + text + current.slice(caret),
    caret: caret + caretOffset,
    point: null,
  };
}

export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'select': {
      const pos = clampPos(state, action.pos);
      return {
        ...state,
        edit: null,
        active: pos,
        anchor: action.extend ? state.anchor : pos,
      };
    }
    case 'selectRange':
      return {
        ...state,
        edit: null,
        anchor: clampPos(state, action.anchor),
        active: clampPos(state, action.active),
      };
    case 'move': {
      const active = clampPos(state, {
        row: state.active.row + action.dRow,
        col: state.active.col + action.dCol,
      });
      return { ...state, edit: null, active, anchor: action.extend ? state.anchor : active };
    }
    case 'startEdit': {
      const text = action.text ?? rawText(state, addressOf(state.active));
      return {
        ...state,
        anchor: state.active,
        edit: { text, caret: text.length, source: action.source, point: null },
      };
    }
    case 'setEditText': {
      const base = state.edit ?? {
        text: '',
        caret: 0,
        source: action.source ?? 'cell',
        point: null,
      };
      return {
        ...state,
        anchor: state.edit ? state.anchor : state.active,
        edit: {
          ...base,
          text: action.text,
          caret: clamp(action.caret, 0, action.text.length),
          source: action.source ?? base.source,
          point: null,
        },
      };
    }
    case 'insertText': {
      const edit = state.edit ?? {
        text: rawText(state, addressOf(state.active)),
        caret: 0,
        source: 'bar' as const,
        point: null,
      };
      const from = state.edit ? edit : { ...edit, caret: edit.text.length };
      return {
        ...state,
        anchor: state.active,
        edit: insertAt(from, action.text, action.caretOffset),
      };
    }
    case 'point': {
      const edit = state.edit;
      if (!edit) return state;
      const a = clampPos(state, action.anchor);
      const b = clampPos(state, action.active);
      const ref = selectionLabel({ anchor: a, active: b });
      // Replace the previous point-inserted reference, or insert at the caret.
      const span =
        edit.point ??
        (canPoint(edit.text, edit.caret) ? { start: edit.caret, end: edit.caret } : null);
      if (!span) return state;
      const text = edit.text.slice(0, span.start) + ref + edit.text.slice(span.end);
      const end = span.start + ref.length;
      return { ...state, edit: { ...edit, text, caret: end, point: { start: span.start, end } } };
    }
    case 'commit': {
      if (!state.edit) return state;
      const committed = commitText(state, addressOf(state.active), state.edit.text);
      const delta =
        action.move === 'down'
          ? { dRow: 1, dCol: 0 }
          : action.move === 'right'
            ? { dRow: 0, dCol: 1 }
            : null;
      const next = { ...committed, edit: null };
      return delta ? gridReducer(next, { type: 'move', ...delta }) : next;
    }
    case 'cancel':
      return { ...state, edit: null };
    case 'clear': {
      const { start, end } = selectionBounds(state);
      const overrides = { ...state.overrides };
      for (let r = start.row; r <= end.row; r++) {
        for (let c = start.col; c <= end.col; c++) overrides[toAddress(r, c)] = '';
      }
      return { ...state, edit: null, overrides };
    }
    case 'paste': {
      const overrides = { ...state.overrides };
      const { start } = selectionBounds(state);
      action.rows.forEach((row, r) =>
        row.forEach((text, c) => {
          const pos = { row: start.row + r, col: start.col + c };
          if (pos.row > state.bottom.row || pos.col > state.bottom.col) return;
          const value = parseInput(text);
          overrides[addressOf(pos)] = value === undefined ? '' : value;
        }),
      );
      return { ...state, edit: null, overrides };
    }
    case 'setCell':
      return commitText({ ...state, edit: null }, action.address, action.text);
  }
}

/** The text the learner sees when editing a cell: the formula, or the value as typed. */
export function rawText(state: Pick<GridState, 'overrides' | 'base'>, address: string): string {
  const value = address in state.overrides ? state.overrides[address] : state.base[address];
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

/** Tab-separated rows, as spreadsheets put on the clipboard. */
export function toTSV(rows: string[][]): string {
  return rows.map((r) => r.join('\t')).join('\n');
}

export function parseTSV(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => line.split('\t'));
}

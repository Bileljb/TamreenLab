import { describe, expect, it } from 'vitest';
import {
  canPoint,
  createGridState,
  gridReducer,
  isSelected,
  parseInput,
  parseTSV,
  rawText,
  selectionLabel,
  toTSV,
  type GridAction,
  type GridState,
} from './state';

const run = (state: GridState, ...actions: GridAction[]) => actions.reduce(gridReducer, state);
const fresh = () => createGridState('A1:D6', { a1: 'المنتج', B2: 120, C2: '=B2*2', D1: true });
const at = (row: number, col: number) => ({ row, col });

describe('createGridState', () => {
  it('starts at the top-left of the visible range, with normalised base addresses', () => {
    const s = createGridState('B2:$D$5');
    expect(selectionLabel(s)).toBe('B2');
    expect(s.top).toEqual(at(1, 1));
    expect(s.bottom).toEqual(at(4, 3));
    expect(fresh().base.A1).toBe('المنتج');
  });
});

describe('selection', () => {
  it('moves with arrows and stays inside the visible range', () => {
    let s = run(fresh(), { type: 'move', dRow: 1, dCol: 2 });
    expect(selectionLabel(s)).toBe('C2');
    s = run(s, { type: 'move', dRow: -10, dCol: 10 });
    expect(selectionLabel(s)).toBe('D1');
  });

  it('extends a range with shift+arrows and collapses on a plain move', () => {
    let s = run(fresh(), { type: 'move', dRow: 2, dCol: 1, extend: true });
    expect(selectionLabel(s)).toBe('A1:B3');
    expect(isSelected(s, at(1, 1))).toBe(true);
    expect(isSelected(s, at(3, 0))).toBe(false);
    s = run(s, { type: 'move', dRow: 0, dCol: 1 });
    expect(selectionLabel(s)).toBe('C3');
  });

  it('selects by click, shift+click and drag in any direction', () => {
    let s = run(fresh(), { type: 'select', pos: at(3, 2) });
    expect(selectionLabel(s)).toBe('C4');
    s = run(s, { type: 'select', pos: at(1, 0), extend: true });
    expect(selectionLabel(s)).toBe('A2:C4');
    s = run(s, { type: 'selectRange', anchor: at(5, 3), active: at(0, 0) });
    expect(selectionLabel(s)).toBe('A1:D6');
    s = run(s, { type: 'selectRange', anchor: at(0, 0), active: at(99, 99) });
    expect(selectionLabel(s)).toBe('A1:D6');
  });
});

describe('editing', () => {
  it('typing replaces the cell; Enter commits and moves down', () => {
    const s = run(
      fresh(),
      { type: 'select', pos: at(1, 3) },
      { type: 'startEdit', text: '4', source: 'cell' },
      { type: 'setEditText', text: '42', caret: 2 },
      { type: 'commit', move: 'down' },
    );
    expect(s.overrides.D2).toBe(42);
    expect(s.lastCommit).toEqual({ address: 'D2', text: '42', seq: 1 });
    expect(selectionLabel(s)).toBe('D3');
    expect(s.edit).toBeNull();
  });

  it('F2 / formula bar edits keep the existing content', () => {
    const s = run(fresh(), { type: 'select', pos: at(1, 2) }, { type: 'startEdit', source: 'bar' });
    expect(s.edit).toMatchObject({ text: '=B2*2', caret: 5, source: 'bar' });
  });

  it('Tab commits and moves right; Escape cancels', () => {
    let s = run(
      fresh(),
      { type: 'startEdit', text: 'x', source: 'cell' },
      { type: 'commit', move: 'right' },
    );
    expect(selectionLabel(s)).toBe('B1');
    s = run(s, { type: 'startEdit', text: 'y', source: 'cell' }, { type: 'cancel' });
    expect(s.overrides.B1).toBeUndefined();
    expect(s.edit).toBeNull();
  });

  it('stores formulas normalised for evaluation and keeps the raw text for checking', () => {
    const s = run(
      fresh(),
      { type: 'select', pos: at(5, 1) },
      { type: 'startEdit', text: '=SUM(B1:B5؛١٠)', source: 'cell' },
      { type: 'commit', move: 'none' },
    );
    expect(s.overrides.B6).toBe('=SUM(B1:B5,10)');
    expect(s.lastCommit?.text).toBe('=SUM(B1:B5؛١٠)');
    expect(rawText(s, 'B6')).toBe('=SUM(B1:B5,10)');
    expect(rawText(s, 'D1')).toBe('TRUE');
    expect(rawText(s, 'D6')).toBe('');
  });

  it('typing in the formula bar without startEdit begins an edit of the active cell', () => {
    const s = run(fresh(), { type: 'setEditText', text: 'abc', caret: 99, source: 'bar' });
    expect(s.edit).toMatchObject({ text: 'abc', caret: 3, source: 'bar' });
  });

  it('commit without an edit does nothing', () => {
    const s = fresh();
    expect(gridReducer(s, { type: 'commit', move: 'down' })).toBe(s);
  });

  it('an empty entry clears a base value', () => {
    const s = run(
      fresh(),
      { type: 'startEdit', text: '', source: 'cell' },
      { type: 'commit', move: 'none' },
    );
    expect(s.overrides.A1).toBe('');
  });

  it('Delete clears the whole selection', () => {
    const s = run(
      fresh(),
      { type: 'selectRange', anchor: at(0, 0), active: at(1, 1) },
      { type: 'clear' },
    );
    expect(s.overrides).toEqual({ A1: '', B1: '', A2: '', B2: '' });
  });

  it('setCell writes a cell directly (Show Answer)', () => {
    const s = run(fresh(), { type: 'setCell', address: 'C5', text: '=SUM(B1:B4)' });
    expect(s.overrides.C5).toBe('=SUM(B1:B4)');
    expect(s.lastCommit?.address).toBe('C5');
  });
});

describe('helper-bar insertion', () => {
  it('inserts at the caret and can place the caret inside', () => {
    const s = run(
      fresh(),
      { type: 'startEdit', text: '=', source: 'bar' },
      { type: 'insertText', text: 'SUM()', caretOffset: 4 },
    );
    expect(s.edit).toMatchObject({ text: '=SUM()', caret: 5 });
  });

  it('starts an edit at the end of the cell content when none is open', () => {
    const s = run(fresh(), { type: 'select', pos: at(1, 2) }, { type: 'insertText', text: '+1' });
    expect(s.edit).toMatchObject({ text: '=B2*2+1', caret: 7 });
  });
});

describe('point mode', () => {
  const editing = (text: string) =>
    run(fresh(), { type: 'select', pos: at(5, 3) }, { type: 'startEdit', text, source: 'cell' });

  it('clicking a cell inserts its address after "(", a separator or an operator', () => {
    let s = run(editing('=SUM('), { type: 'point', anchor: at(1, 1), active: at(1, 1) });
    expect(s.edit?.text).toBe('=SUM(B2');
    // Clicking again replaces the reference just inserted; dragging makes it a range.
    s = run(s, { type: 'point', anchor: at(1, 1), active: at(4, 1) });
    expect(s.edit?.text).toBe('=SUM(B2:B5');
    s = run(
      s,
      { type: 'insertText', text: ',' },
      { type: 'point', anchor: at(0, 0), active: at(0, 0) },
    );
    expect(s.edit?.text).toBe('=SUM(B2:B5,A1');
  });

  it('does nothing where a reference cannot go', () => {
    const s = editing('=SUM(B2');
    expect(gridReducer(s, { type: 'point', anchor: at(0, 0), active: at(0, 0) })).toBe(s);
    const plain = run(fresh(), { type: 'point', anchor: at(0, 0), active: at(0, 0) });
    expect(plain.edit).toBeNull();
  });

  it.each([
    ['=', 1, true],
    ['=SUM(', 5, true],
    ['=A1+', 4, true],
    ['=A1+ ', 5, true],
    ['=IF(A1>1;', 9, true],
    ['=SUM(A1', 7, false],
    ['SUM(', 4, false],
    ['=SUM(', 2, false],
  ])('canPoint(%s, %i) = %s', (text, caret, expected) => {
    expect(canPoint(text, caret)).toBe(expected);
  });
});

describe('parseInput', () => {
  it.each([
    ['120', 120],
    ['  -1.5 ', -1.5],
    ['١٢٠', 120],
    ['true', true],
    ['FALSE', false],
    ['الرياض', 'الرياض'],
    ['12abc', '12abc'],
    ['＝sum(A1)', '=sum(A1)'],
    ['   ', undefined],
  ])('%s -> %s', (text, expected) => {
    expect(parseInput(text)).toBe(expected);
  });
});

describe('clipboard', () => {
  it('round-trips tab-separated rows and pastes from the selection corner', () => {
    expect(
      toTSV([
        ['a', '1'],
        ['b', '2'],
      ]),
    ).toBe('a\t1\nb\t2');
    expect(parseTSV('a\t1\r\nb\t2\r\n')).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
    const s = run(
      fresh(),
      { type: 'select', pos: at(4, 2) },
      {
        type: 'paste',
        rows: [
          ['5', 'x', 'cut off'],
          ['', '٧'],
        ],
      },
    );
    expect(s.overrides).toEqual({ C5: 5, D5: 'x', C6: '', D6: 7 });
  });
});

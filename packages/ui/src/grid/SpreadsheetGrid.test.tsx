import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SheetSpec } from '@tamreen/shared';
import { renderWithIntl } from '../test/intl';
import { SpreadsheetGrid, useGrid } from './SpreadsheetGrid';
import type { GridState } from './state';

const sheet: SheetSpec = {
  visible: 'A1:C5',
  cells: { A1: 'المنتج', B1: 'الكمية', A2: 'قلم', B2: 120, A3: 'دفتر', B3: 80, B4: '=SUM(B2:B3)' },
  formats: { B2: 'number' },
};

let latest: GridState | null = null;

function Harness({ onIdleEnter }: { onIdleEnter?: () => void }) {
  const [state, dispatch] = useGrid(sheet);
  latest = state;
  return (
    <SpreadsheetGrid
      sheet={sheet}
      state={state}
      dispatch={dispatch}
      functions={['SUMIF']}
      onIdleEnter={onIdleEnter}
    />
  );
}

const cell = (address: string) =>
  document.querySelector<HTMLElement>(`[data-address="${address}"]`)!;
const nameBox = () => screen.getByRole('textbox', { name: 'مربع الاسم' });
const formulaBar = () => screen.getByRole('textbox', { name: 'شريط المعادلة' });

describe('SpreadsheetGrid', () => {
  it('renders an accessible grid with headers and computed values, left to right', () => {
    renderWithIntl(<Harness />);
    const grid = screen.getByRole('grid', { name: 'ورقة العمل' });
    expect(grid.closest('[dir]')).toHaveProperty('dir', 'ltr');
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['A', 'B', 'C']);
    expect(within(grid).getAllByRole('rowheader')).toHaveLength(5);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(15);
    expect(cell('B4').textContent).toBe('200');
    expect(cell('A2').textContent).toBe('قلم');
    expect(cell('A1')).toHaveProperty('tabIndex', 0);
    expect(cell('B1')).toHaveProperty('tabIndex', -1);
  });

  it('selects with the mouse and shows the selection in the name box and formula bar', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.pointer({ keys: '[MouseLeft]', target: cell('B4') });
    expect(nameBox()).toHaveProperty('value', 'B4');
    expect(formulaBar()).toHaveProperty('value', '=SUM(B2:B3)');
    expect(cell('B4').getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{Shift>}');
    await user.pointer({ keys: '[MouseLeft]', target: cell('A2') });
    await user.keyboard('{/Shift}');
    expect(nameBox()).toHaveProperty('value', 'A2:B4');
  });

  it('navigates with arrows, extends with shift+arrows and Tab moves right', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    cell('A1').focus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(nameBox()).toHaveProperty('value', 'B2');
    expect(document.activeElement).toBe(cell('B2'));
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(nameBox()).toHaveProperty('value', 'B2:B4');
    await user.keyboard('{Tab}');
    expect(nameBox()).toHaveProperty('value', 'C4');
  });

  it('types into a cell, commits with Enter and recomputes formulas', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('B3'));
    await user.keyboard('5');
    expect(screen.getByRole('textbox', { name: 'تحرير الخلية B3' })).toHaveProperty('value', '5');
    await user.keyboard('0{Enter}');
    expect(cell('B3').textContent).toBe('50');
    expect(cell('B4').textContent).toBe('170');
    expect(nameBox()).toHaveProperty('value', 'B4');
    expect(latest?.lastCommit).toMatchObject({ address: 'B3', text: '50' });
  });

  it('Escape cancels an edit and Delete clears the selection', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('A2'));
    await user.keyboard('x{Escape}');
    expect(cell('A2').textContent).toBe('قلم');
    await user.keyboard('{Delete}');
    expect(cell('A2').textContent).toBe('');
  });

  it('edits through the formula bar', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('C2'));
    await user.click(formulaBar());
    await user.keyboard('=B2*2{Enter}');
    expect(cell('C2').textContent).toBe('240');
  });

  it('inserts references by clicking cells while typing a formula (point mode)', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('C5'));
    await user.keyboard('=SUM(');
    await user.pointer({ keys: '[MouseLeft]', target: cell('B2') });
    const editor = screen.getByRole('textbox', { name: 'تحرير الخلية C5' });
    expect(editor).toHaveProperty('value', '=SUM(B2');
    await user.pointer({ keys: '[MouseLeft]', target: cell('B3') });
    expect(editor).toHaveProperty('value', '=SUM(B3');
    await user.keyboard('){Enter}');
    expect(cell('C5').textContent).toBe('80');
  });

  it('drags across cells to insert a range in point mode', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('C5'));
    await user.keyboard('=SUM(');
    const original = document.elementFromPoint;
    document.elementFromPoint = () => cell('B3');
    fireEvent.pointerDown(cell('B2'), { button: 0, pointerId: 1 });
    fireEvent.pointerMove(cell('B3'), { pointerId: 1 });
    fireEvent.pointerUp(cell('B3'), { pointerId: 1 });
    document.elementFromPoint = original;
    await user.keyboard('){Enter}');
    expect(cell('C5').textContent).toBe('200');
  });

  it('drags across cells to select a range', () => {
    renderWithIntl(<Harness />);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => cell('B3');
    fireEvent.pointerDown(cell('A1'), { button: 0, pointerId: 1 });
    fireEvent.pointerMove(cell('B3'), { pointerId: 1 });
    fireEvent.pointerUp(cell('B3'), { pointerId: 1 });
    // A move after release does nothing.
    fireEvent.pointerMove(cell('C5'), { pointerId: 1 });
    document.elementFromPoint = original;
    expect(nameBox()).toHaveProperty('value', 'A1:B3');
  });

  it('jumps to a cell or a range typed in the name box', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(nameBox());
    await user.keyboard('{Control>}a{/Control}c3{Enter}');
    expect(latest && nameBox()).toHaveProperty('value', 'C3');
    await user.click(nameBox());
    await user.keyboard('{Control>}a{/Control}b2:a1{Enter}');
    expect(nameBox()).toHaveProperty('value', 'A1:B2');
    await user.click(nameBox());
    await user.keyboard('{Control>}a{/Control}nonsense{Enter}');
    expect(nameBox()).toHaveProperty('value', 'A1:B2');
    await user.click(nameBox());
    await user.keyboard('zz{Escape}');
    expect(nameBox()).toHaveProperty('value', 'A1:B2');
  });

  it('calls onIdleEnter when Enter is pressed outside an edit', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderWithIntl(<Harness onIdleEnter={() => calls++} />);
    await user.click(cell('A1'));
    await user.keyboard('{Enter}');
    expect(calls).toBe(1);
  });

  it('F2 and double-click edit the existing content', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('B4'));
    await user.keyboard('{F2}');
    expect(screen.getByRole('textbox', { name: 'تحرير الخلية B4' })).toHaveProperty(
      'value',
      '=SUM(B2:B3)',
    );
    await user.keyboard('{Escape}');
    await user.dblClick(cell('A2'));
    expect(screen.getByRole('textbox', { name: 'تحرير الخلية A2' })).toHaveProperty('value', 'قلم');
  });

  it('copies the selection as tab-separated values and pastes values', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('A2'));
    await user.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}');
    const data = new Map<string, string>();
    const clipboardData = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    };
    fireEvent.copy(cell('B3'), { clipboardData });
    expect(data.get('text/plain')).toBe('قلم\t120\nدفتر\t80');

    await user.click(cell('C1'));
    fireEvent.paste(cell('C1'), { clipboardData });
    expect(cell('C1').textContent).toBe('قلم');
    expect(cell('D2')).toBeNull();
    expect(cell('C2').textContent).toBe('دفتر');
  });

  it('offers helper keys and function chips that type into the formula bar', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.click(cell('C5'));
    const bar = screen.getByRole('toolbar', { name: 'أزرار إدخال المعادلة' });
    await user.click(within(bar).getByRole('button', { name: 'أدرج =' }));
    await user.click(within(bar).getByRole('button', { name: 'أدرج الدالة SUMIF' }));
    expect(formulaBar()).toHaveProperty('value', '=SUMIF(');
    expect(document.activeElement).toBe(formulaBar());
    expect(within(bar).getByRole('button', { name: 'أدرج الدالة SUM' })).toBeTruthy();
  });
});

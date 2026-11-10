import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../test/intl';
import { AuthForm, safeNext } from './AuthForm';

describe('safeNext', () => {
  it.each([
    ['/ar/lessons/basics/cells-and-selection', '/ar/lessons/basics/cells-and-selection'],
    ['/ar', '/ar'],
    [null, '/fallback'],
    ['', '/fallback'],
    ['https://evil.example', '/fallback'],
    ['//evil.example', '/fallback'],
    ['/\\evil.example', '/fallback'],
    ['javascript:alert(1)', '/fallback'],
  ])('%s -> %s', (raw, expected) => {
    expect(safeNext(raw, '/fallback')).toBe(expected);
  });
});

describe('AuthForm labels', () => {
  it('names each field by its label alone and describes it with its hint', () => {
    renderWithIntl(<AuthForm mode="signUp" fallbackNext="/ar" switchHref="/ar/login" />);
    const name = screen.getByRole('textbox', { name: 'الاسم الظاهر' });
    expect(name.getAttribute('aria-describedby')).toBe('display-name-hint');
    expect(screen.getByLabelText('كلمة المرور', { exact: true })).toHaveProperty(
      'type',
      'password',
    );
  });
});

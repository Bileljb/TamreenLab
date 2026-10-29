import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Formula } from './Formula';

describe('Formula', () => {
  it('isolates the formula as left-to-right text', () => {
    const html = renderToStaticMarkup(<Formula>=SUM(A1:A3)</Formula>);
    expect(html).toBe('<bdi dir="ltr" data-formula=""><code>=SUM(A1:A3)</code></bdi>');
  });
});

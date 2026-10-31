import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prompt, firstUses, tokenizePrompt } from './Prompt';

describe('tokenizePrompt', () => {
  it('splits text, bold, formulas and glossary terms', () => {
    expect(tokenizePrompt('اختر {{الخلية}} `B2` ثم **اضغط** Enter')).toEqual([
      { kind: 'text', text: 'اختر ' },
      { kind: 'term', text: 'الخلية' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'B2' },
      { kind: 'text', text: ' ثم ' },
      { kind: 'bold', text: 'اضغط' },
      { kind: 'text', text: ' Enter' },
    ]);
    expect(tokenizePrompt('نص فقط')).toEqual([{ kind: 'text', text: 'نص فقط' }]);
  });
});

describe('firstUses', () => {
  it('introduces each term in the first prompt that uses it', () => {
    const uses = firstUses(['{{خلية}} و{{نطاق}}', '{{خلية}} و{{معادلة}}', 'لا شيء']);
    expect(uses.map((s) => [...s])).toEqual([['خلية', 'نطاق'], ['معادلة'], []]);
  });

  it('treats a term with the article as the same term', () => {
    const uses = firstUses(['{{الخلية}}', '{{خلية}} و{{المعادلة}}']);
    expect(uses.map((s) => [...s])).toEqual([['خلية'], ['معادلة']]);
    const html = renderToStaticMarkup(
      <Prompt text="{{الخلية}}" glossary={{ خلية: 'cell' }} introduce={uses[0]!} />,
    );
    expect(html).toContain('الخلية</dfn> (<bdi dir="ltr" lang="en">cell</bdi>)');
  });
});

describe('Prompt', () => {
  const glossary = { خلية: 'cell' };

  it('renders formulas left to right and the English term on first use', () => {
    const html = renderToStaticMarkup(
      <Prompt
        text="اكتب في {{خلية}} `=SUM(A1:A3)`"
        glossary={glossary}
        introduce={new Set(['خلية'])}
      />,
    );
    expect(html).toContain(
      '<dfn class="font-semibold not-italic text-brand-strong" title="cell">خلية</dfn> (<bdi dir="ltr" lang="en">cell</bdi>)',
    );
    expect(html).toContain(
      '<bdi dir="ltr" class="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.9em]" data-formula=""><code>=SUM(A1:A3)</code></bdi>',
    );
  });

  it('omits the English term after its first use, and for unknown terms', () => {
    const html = renderToStaticMarkup(
      <Prompt text="{{خلية}} {{مجهول}}" glossary={glossary} introduce={new Set(['مجهول'])} />,
    );
    expect(html).not.toContain('(<bdi');
  });
});

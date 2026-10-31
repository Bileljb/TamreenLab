import { describe, expect, it } from 'vitest';
import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

/** Every key path of a message tree, like `home.features.practice.title`. */
function keys(tree: object, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** ICU placeholders and rich-text tags of one message, like `{points}` and `<link>`. */
function slots(text: string): string[] {
  const names = [...text.matchAll(/\{(\w+)[,}]|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`);
  return [...new Set(names)].sort();
}

const lookup = (tree: object, path: string) =>
  path.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown>)[k], tree);

describe('message files', () => {
  const arabic = keys(ar).sort();

  it.each([
    ['en', en],
    ['fr', fr],
  ])('%s has exactly the Arabic keys', (_locale, messages) => {
    expect(keys(messages).sort()).toEqual(arabic);
  });

  it.each([
    ['en', en],
    ['fr', fr],
  ])('%s keeps every placeholder and tag of the Arabic text', (_locale, messages) => {
    for (const path of arabic) {
      expect(slots(String(lookup(messages, path))), path).toEqual(
        slots(String(lookup(ar, path))),
      );
    }
  });
});

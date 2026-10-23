import { describe, test, expect, mock } from 'bun:test';

mock.module('@/integrations/supabase/client', () => ({ supabase: {} }));
const { normalizeSearchQuery, filterCachedRows } = await import('./profileSearch');

describe('profile search query', () => {
  test('drops the space an iPhone keyboard adds after a word', () => {
    expect(normalizeSearchQuery('nilesh ')).toBe('nilesh');
  });
  test('drops a leading @', () => {
    expect(normalizeSearchQuery('@bpp')).toBe('bpp');
  });
  test('a lone space is an empty search', () => {
    expect(normalizeSearchQuery('  ')).toBe('');
  });
});

describe('instant matches from an earlier letter', () => {
  const rows = [
    { username: 'bpp', display_name: 'Nilesh Maurya' },
    { username: 'alex', display_name: null },
  ];
  test('keeps a person whose name contains the longer text, ignoring capitals', () => {
    expect(filterCachedRows(rows, 'nil').map((r) => r.username)).toEqual(['bpp']);
  });
  test('drops a person who no longer matches', () => {
    expect(filterCachedRows(rows, 'bpx')).toEqual([]);
  });
});

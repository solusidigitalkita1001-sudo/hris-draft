/**
 * Kamus i18n per-modul. `defineDictionary` memaksa paritas kunci ID↔EN pada
 * level type: K diinfer dari gabungan kedua bahasa sehingga kunci yang hilang
 * di salah satu bahasa menjadi error TypeScript, bukan bug runtime.
 */
export type DictionaryShape<K extends string> = {
  id: Record<K, string>;
  en: Record<K, string>;
};

export function defineDictionary<K extends string>(dictionary: DictionaryShape<K>): DictionaryShape<K> {
  return dictionary;
}

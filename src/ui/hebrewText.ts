/**
 * Marks that make Hebrew sentences with Latin words in them read right: the browser orders a
 * run of Latin words and the punctuation between them left to right, as one piece.
 */

/**
 * A Hebrew prefix is written with a hyphen before a Latin word or a number (ה-ALU, ב-L3). A
 * word joiner after the hyphen stops a line from breaking there and leaving the prefix alone.
 */
function joinPrefixes(text: string): string {
  return text.replace(/(?<=[\u0590-\u05ff])-(?=[^\s\u2060])/g, '-\u2060');
}

/**
 * Punctuation followed by a space ends a clause or a list item. A right-to-left mark after it
 * keeps "CX. IP" or "AX, BX" from joining into one left-to-right run that a Hebrew reader would
 * meet back to front.
 */
function separateClauses(text: string): string {
  // Code set apart in a left-to-right isolate keeps its punctuation as written.
  return text
    .split(/(\u2066[^\u2069]*\u2069)/)
    .map((part) => (part.startsWith('\u2066') ? part : part.replace(/([.,:;])(?= )/g, '$1\u200f')))
    .join('');
}

export function hebrewText(text: string): string {
  return separateClauses(joinPrefixes(text));
}

/** The same messages, with every text, or text a function returns, passed through `fix`. */
export function mapTexts<T>(value: T, fix: (text: string) => string): T {
  if (typeof value === 'string') return fix(value) as T;
  if (typeof value === 'function') {
    return ((...args: unknown[]) => fix((value as (...args: unknown[]) => string)(...args))) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, mapTexts(inner, fix)])
    ) as T;
  }
  return value;
}

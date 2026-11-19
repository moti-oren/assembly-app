/**
 * A sentence the core builds from numbers and names it knows, kept as a template with `{name}`
 * holes plus the values for them. The core writes the English; another language swaps in a
 * template of its own for the same key and fills the same holes, so the values must not need
 * a word of their own (a plural, an article).
 */
export type TextParams = Readonly<Record<string, string | number>>;

/** A template with its holes filled in. */
export function fillText(template: string, params: TextParams): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}

/**
 * The shape of a set of messages with every text widened to `string`, so another language can
 * fill it: a function keeps its parameters but may return any text.
 */
export type Widen<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends string
    ? string
    : { [K in keyof T]: Widen<T[K]> };

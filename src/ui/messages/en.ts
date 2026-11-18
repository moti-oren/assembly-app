/**
 * The interface's texts in English. Their shape is the `Messages` type, which every other
 * language must fill in full: a text missing from one is a type error.
 */
export const en = {
  language: {
    /** The language switch, on its tooltip and in the command palette. */
    switch: 'Switch the interface to Hebrew'
  }
};

export type Messages = typeof en;

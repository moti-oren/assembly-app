/**
 * The interface's texts in English. Their shape is the `Messages` type, which every other
 * language must fill in full: a text missing from one is a type error.
 */
export const en = {
  language: {
    /** The language switch, on its tooltip and in the command palette. */
    switch: 'Switch the interface to Hebrew',
    /** The heading of the language choice in the settings menu. */
    label: 'Language'
  }
};

export type Messages = typeof en;

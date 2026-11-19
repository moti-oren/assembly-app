import type { Widen } from '../widen';
import { app } from './app';
import { architectures } from './architectures';
import { builder } from './builder';
import { explain6502 } from './explain6502';
import { explainRv32 } from './explainRv32';
import { explainX86 } from './explainX86';
import { panels } from './panels';

/**
 * The interface's texts in English, one section per area. Their shape is the `Messages` type,
 * which every other language must fill in full: a text missing from one is a type error.
 */
export const en = {
  ...app,
  ...panels,
  ...architectures,
  ...explainX86,
  ...explainRv32,
  ...explain6502,
  ...builder
};

export type Messages = Widen<typeof en>;

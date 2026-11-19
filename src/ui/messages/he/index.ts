import type { Messages } from '../en';
import { app } from './app';
import { architectures } from './architectures';
import { builder } from './builder';
import { explain6502 } from './explain6502';
import { explainRv32 } from './explainRv32';
import { explainX86 } from './explainX86';
import { panels } from './panels';

/** The interface's texts in Hebrew. Technical terms, registers and code stay in English. */
export const he: Messages = {
  ...app,
  ...panels,
  ...architectures,
  ...explainX86,
  ...explainRv32,
  ...explain6502,
  ...builder
};

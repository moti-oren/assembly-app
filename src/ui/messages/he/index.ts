import type { Messages } from '../en';
import { app } from './app';
import { architectures } from './architectures';
import { panels } from './panels';

/** The interface's texts in Hebrew. Technical terms, registers and code stay in English. */
export const he: Messages = { ...app, ...panels, ...architectures };

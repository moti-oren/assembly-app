import type { Widen } from '../widen';
import { app } from './app';
import { architectures } from './architectures';
import { panels } from './panels';

/**
 * The interface's texts in English, one section per area. Their shape is the `Messages` type,
 * which every other language must fill in full: a text missing from one is a type error.
 */
export const en = { ...app, ...panels, ...architectures };

export type Messages = Widen<typeof en>;

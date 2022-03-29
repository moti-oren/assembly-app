import { Registers } from '../types/processor';
import { Flags } from '../types/processor';
import { Instructions } from '../types/processor';

export default class Processor {
  constructor(
    public registers: Registers,
    public flags: Flags,
    public instructions: Instructions
  ) { }
}

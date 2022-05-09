import EventEmitter from './EventEmitter';
import Instruction, { NumericUnaryOperands, NumericBinaryOperands } from '../types/instruction';
import { DstOperand, SrcOperand } from '../types/operation';
import {
  Registers,
  Flags,
  Instructions,
  Operands
} from '../types/processor';

export default class Processor {
  private eventEmitter = new EventEmitter();
  private events = {
    arithmetic: 'arithmetic',
    logic: 'logical',
    shift: 'shift'
  };

  constructor(
    public registers: Registers,
    public flags: Flags,
    public instructions: Instructions
  ) { }

  private perform<T extends NumericUnaryOperands> (instruction: Instruction<T>, operands: Operands<T extends NumericBinaryOperands ? 'dst' | 'src' : 'dst'>, eventName: string) {

  }

  mov (dst: DstOperand, src: SrcOperand) {
    return this.perform(this.instructions.mov, { dst, src }, 'mov');
  }

  inc (dst: DstOperand) {
    return this.perform(this.instructions.inc, { dst }, this.events.arithmetic);
  }

  dec (dst: DstOperand) {
    return this.perform(this.instructions.dec, { dst }, this.events.arithmetic);
  }

  add (dst: DstOperand, src: SrcOperand) {
    return this.perform(this.instructions.add, { dst, src }, this.events.arithmetic);
  }

  sub (dst: DstOperand, src: SrcOperand) {
    return this.perform(this.instructions.sub, { dst, src }, this.events.arithmetic);
  }

  mul (src: SrcOperand) { // TODO
    const dst = this.registers.ax;
    return this.perform(this.instructions.mul, { dst, src }, this.events.arithmetic);
  }

  imul (src: SrcOperand) { // TODO
    const dst = this.registers.ax;
    return this.perform(this.instructions.imul, { dst, src }, this.events.arithmetic);
  }

  div (src: SrcOperand) { // TODO
    const dst = this.registers.ax;
    return this.perform(this.instructions.div, { dst, src }, this.events.arithmetic);
  }

  idiv (src: SrcOperand) { // TODO
    const dst = this.registers.ax;
    return this.perform(this.instructions.idiv, { dst, src }, this.events.arithmetic);
  }

  not (dst: DstOperand) {
    return this.perform(this.instructions.not, { dst }, this.events.logic);
  }

  and (dst: DstOperand, src: SrcOperand) {
    return this.perform(this.instructions.and, { dst, src }, this.events.logic);
  }

  or (dst: DstOperand, src: SrcOperand) {
    return this.perform(this.instructions.or, { dst, src }, this.events.logic);
  }

  xor (dst: DstOperand, src: SrcOperand) {
    return this.perform(this.instructions.xor, { dst, src }, this.events.logic);
  }

  shl (dst: DstOperand) {
    // TODO: srcOperand can be only cl or const
  }

  shr (dst: DstOperand) {
    // TODO
  }
}

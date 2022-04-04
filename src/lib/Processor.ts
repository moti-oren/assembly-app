import EventEmitter from './EventEmitter';
import { Register } from '../types/register';
import { Registers } from '../types/processor';
import { Flags } from '../types/processor';
import { Instructions } from '../types/processor';
import { Instruction, Operands, SrcOperand } from '../types/instruction';

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

  private perform (instruction: Instruction, operands: Operands, eventName: string) {
    const operation = instruction.perform(operands);
    this.eventEmitter.emit(eventName, operation);
    return operands.dstOperand;
  }

  mov (dst: Register, src: SrcOperand) {
    return this.perform(this.instructions.mov, { dstOperand: dst, srcOperand: src }, 'mov');
  }

  inc (dst: Register) {
    return this.perform(this.instructions.inc, { dstOperand: dst }, this.events.arithmetic);
  }

  dec (dst: Register) {
    return this.perform(this.instructions.dec, { dstOperand: dst }, this.events.arithmetic);
  }

  add (dst: Register, src: SrcOperand) {
    return this.perform(this.instructions.add, { dstOperand: dst, srcOperand: src }, this.events.arithmetic);
  }

  sub (dst: Register, src: SrcOperand) {
    return this.perform(this.instructions.sub, { dstOperand: dst, srcOperand: src }, this.events.arithmetic);
  }

  mul (src: SrcOperand) { // TODO
    const operation = this.instructions.mul.perform({ dstOperand: this.registers.eax, srcOperand: src });
    this.eventEmitter.emit('arithmetic.mul', operation);
    return src;
  }

  imul (src: SrcOperand) { // TODO
    const operation = this.instructions.imul.perform({ dstOperand: this.registers.eax, srcOperand: src });
    this.eventEmitter.emit('arithmetic.imul', operation);
    return src;
  }

  div (src: SrcOperand) { // TODO
    const operation = this.instructions.div.perform({ dstOperand: this.registers.eax, srcOperand: src });
    this.eventEmitter.emit('arithmetic.div', operation);
    return src;
  }

  idiv (src: SrcOperand) { // TODO
    const operation = this.instructions.idiv.perform({ dstOperand: this.registers.eax, srcOperand: src });
    this.eventEmitter.emit('arithmetic.idiv', operation);
    return src;
  }

  not (dst: Register) {
    return this.perform(this.instructions.not, { dstOperand: dst }, this.events.logic);
  }

  and (dst: Register, src: SrcOperand) {
    return this.perform(this.instructions.and, { dstOperand: dst, srcOperand: src }, this.events.logic);
  }

  or (dst: Register, src: SrcOperand) {
    return this.perform(this.instructions.or, { dstOperand: dst, srcOperand: src }, this.events.logic);
  }

  xor (dst: Register, src: SrcOperand) {
    return this.perform(this.instructions.xor, { dstOperand: dst, srcOperand: src }, this.events.logic);
  }

  shl () {
    // TODO
  }

  shr () {
    // TODO
  }
}

import EventEmitter from './EventEmitter';
import { UnaryInstruction } from './Instruction';
import Register from '../types/register';
import {
  UnaryOperands,
  BinaryOperands,
  DstOperand,
  SrcOperand
} from '../types/operation';
import {
  UnaryInstruction as IUnaryInstruction,
  BinaryInstruction as IBinaryInstruction
} from '../types/instruction';
import {
  Registers,
  Flags,
  Instructions
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

  private perform (instruction: IUnaryInstruction, operands: UnaryOperands, event: string): Register;
  private perform (instruction: IBinaryInstruction, operands: BinaryOperands, event: string): Register;
  private perform (instruction: IUnaryInstruction | IBinaryInstruction, operands: UnaryOperands | BinaryOperands, event: string): Register {
    if (instruction instanceof UnaryInstruction) {
      const result = instruction.operate({ dst: operands.dst.decimal });
      this.eventEmitter.emit(event, result);
      return operands.dst;
    }

    if ('src' in operands) {
      const result = instruction.operate({ dst: operands.dst.decimal, src: this.getValue(operands.src) });
      this.eventEmitter.emit(event, result);
      return operands.dst;
    }

    return operands.dst;
  }

  private getValue (src: SrcOperand) {
    if (typeof src === 'number') {
      return src;
    }
    return src.decimal;
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

  mul (src: SrcOperand) {
    const dst = this.registers.ax; // TODO: handle by size of src
    return this.perform(this.instructions.mul, { dst, src }, this.events.arithmetic);
  }

  imul (src: SrcOperand) {
    const dst = this.registers.ax;
    return this.perform(this.instructions.imul, { dst, src }, this.events.arithmetic);
  }

  div (src: SrcOperand) {
    const dst = this.registers.ax;
    return this.perform(this.instructions.div, { dst, src }, this.events.arithmetic);
  }

  idiv (src: SrcOperand) {
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

  }
}

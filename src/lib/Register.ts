import processor from '../cpu-components/processor';
import Mask from './Mask';
import { eventEmitterSingleton as eventEmitter } from './EventEmitter';
import {
  Register as IRegister,
  RegisterSize as Size
} from '../types/register';
import { SrcOperand } from '../types/instruction';

export default class Register implements IRegister {
  private value: number = 0;
  public size: Size = 16;
  public description: string = '';

  constructor(public name: string) { } // TODO: size is public?

  updateValueDirectly (val: number) { // TODO
    this.value = Mask.asLow16Bit(val);
  }

  set decimal (val: number) {
    this.value = Mask.asLow16Bit(val);
  }

  set hexadecimal (val: string) {
    this.decimal = parseInt(val, 16);
  }

  set binary (val: string) {
    this.decimal = parseInt(val, 2);
  }

  get decimal (): number {
    return this.value;
  }

  get hexadecimal (): string {
    return this.decimal.toString(16);
  }

  get binary (): string {
    return this.decimal.toString(2);
  }

  mov (src: SrcOperand): IRegister {
    return processor.mov(this, src);
  }

  inc (): IRegister {
    return processor.inc(this);
  }

  dec (): IRegister {
    return processor.dec(this);
  }

  add (src: SrcOperand): IRegister {
    return processor.add(this, src);
  }

  sub (src: SrcOperand): IRegister {
    return processor.sub(this, src);
  }

  mul (): Register {
    const operation = processor.instructions['mul'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.mul', operation);
    return this;
  }

  imul (): Register {
    const operation = processor.instructions['imul'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.imul', operation);
    return this;
  }

  div (): Register {
    const operation = processor.instructions['div'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.div', operation);
    return this;
  }

  idiv (): Register {
    const operation = processor.instructions['idiv'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.idiv', operation);
    return this;
  }

  not (): IRegister {
    return processor.not(this);
  }

  and (src: SrcOperand): IRegister {
    return processor.and(this, src);
  }

  or (src: SrcOperand): IRegister {
    return processor.or(this, src);
  }

  xor (src: SrcOperand): IRegister {
    return processor.xor(this, src);
  }

  shr (amount: number): Register { // TODO
    const operation = processor.instructions['shr'].perform({ dstOperand: this, srcOperand: amount });
    eventEmitter.emit('logic.shr', operation);
    return this;
  }

  shl (amount: number): Register { // TODO
    const operation = processor.instructions['shl'].perform({ dstOperand: this, srcOperand: amount });
    eventEmitter.emit('logic.shl', operation);
    return this;
  }
}

// TODO

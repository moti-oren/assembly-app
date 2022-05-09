import processor from '../cpu-components/processor';
import Mask from './Mask';
import { eventEmitterSingleton as eventEmitter } from './EventEmitter';
import IRegister,{ Size } from '../types/register';
import { SrcOperand } from '../types/operation';

export default class Register implements IRegister {
  private value: number = 0;
  public readonly size: Size = 16;
  public description: string = '';

  constructor(public name: string, subRegisters?: { high: Register, low: Register }) { } // TODO: size is public?

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

  mov (src: SrcOperand) {
    return processor.mov(this, src);
  }

  inc () {
    return processor.inc(this);
  }

  dec () {
    return processor.dec(this);
  }

  add (src: SrcOperand) {
    return processor.add(this, src);
  }

  sub (src: SrcOperand) {
    return processor.sub(this, src);
  }

  mul () {
    return processor.mul(this);
  }

  imul () {
    return processor.imul(this);
  }

  div () {
    return processor.div(this);
  }

  idiv () {
    return processor.idiv(this);
  }

  not () {
    return processor.not(this);
  }

  and (src: SrcOperand) {
    return processor.and(this, src);
  }

  or (src: SrcOperand) {
    return processor.or(this, src);
  }

  xor (src: SrcOperand) {
    return processor.xor(this, src);
  }

  shr (amount: number) { // TODO
    return processor.shr(this, amount);
  }

  shl (amount: number) { // TODO
    return processor.shl(this, amount);
  }
}

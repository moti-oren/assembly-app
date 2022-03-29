import Mask from './Mask';
import { SubRegister as ISubRegister } from '../types/register';

type Size = 8;

export default class SubRegister implements ISubRegister {
  private value: number = 0;
  public size: Size = 8; // TODO: size is public?

  constructor(public name: string) { }

  set decimal (val: number) {
    this.value = Mask.asLow8Bit(val);
  }

  set hexadecimal (val: string) {
    this.value = Mask.asLow8Bit(parseInt(val, 16));
  }

  set binary (val: string) {
    this.value = Mask.asLow8Bit(parseInt(val, 2));
  }

  get decimal (): number {
    return this.value;
  }

  get hexadecimal (): string {
    return this.value.toString(16);
  }

  get binary (): string {
    return this.value.toString(2);
  }
}

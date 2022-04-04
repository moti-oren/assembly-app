import Mask from './Mask';
import { Register, SubRegister as ISubRegister } from '../types/register';
import { SubRegisterSize as Size } from '../types/register';

export default class SubRegister implements ISubRegister {
  private value: number = 0;
  public size: Size = 8; // TODO: size is public?

  constructor(public name: string, private parent: Register) { }

  updateValueDirectly (val: number) { // TODO
    this.value = Mask.asLow8Bit(val);
  }

  set decimal (val: number) {
    const finalVal = Mask.asLow8Bit(val);
    this.value = finalVal;
    this.parent.updateValueDirectly(finalVal);
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
    return this.value.toString(16);
  }

  get binary (): string {
    return this.value.toString(2);
  }
}

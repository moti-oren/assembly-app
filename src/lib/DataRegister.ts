import Register from './Register';
import SubRegister from './SubRegister';
import Mask from './Mask';
import { DataRegister as IDataRegister } from '../types/register';

export default class DataRegister extends Register implements IDataRegister {
  constructor(name: string, public high: SubRegister, public low: SubRegister) {
    super(name);
  }

  set decimal (value: number) {
    this.high.decimal = Mask.asHigh8Bit(value);
    this.low.decimal = Mask.asLow8Bit(value);
  }

  set hexadecimal (value: string) {
    this.decimal = parseInt(value, 16);
  }

  set binary (value: string) {
    this.decimal = parseInt(value, 2);
  }

  get decimal (): number {
    return Mask.join16Bit(this.high.decimal, this.low.decimal);
  }

  get hexadecimal (): string {
    return this.decimal.toString(16);
  }

  get binary (): string {
    return this.decimal.toString(2);
  }
}

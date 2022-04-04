import Register from './Register';
import Mask from './Mask';
import { DataRegister as IDataRegister } from '../types/register';
import { SubRegisters } from '../types/register';

export default class DataRegister extends Register implements IDataRegister {
  constructor(name: string, public subRegisters: SubRegisters) {
    super(name);
  }

  set decimal (value: number) {
    this.subRegisters.high.updateValueDirectly(Mask.asHigh8Bit(value));
    this.subRegisters.low.updateValueDirectly(Mask.asLow8Bit(value));
  }

  get decimal (): number {
    return Mask.join16Bit(this.subRegisters.high.decimal, this.subRegisters.low.decimal);
  }
}

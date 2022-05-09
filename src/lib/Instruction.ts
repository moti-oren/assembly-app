import IInstruction, {
  Result,
  NumericUnaryOperands
} from '../types/instruction';

export default class Instruction<T extends NumericUnaryOperands> implements IInstruction<T> {
  public description: string = '';

  constructor(
    public name: string,
    public opcode: number,
    protected operation: (operands: T) => number
  ) { }

  operate (operands: T): Result<T> {
    const result = this.operation(operands);

    return {
      operands,
      result
    }
  }
}

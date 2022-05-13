import IInstruction, {
  UnaryInstruction as IUnaryInstruction,
  BinaryInstruction as IBinaryInstruction,
} from '../types/instruction';

abstract class Instruction implements IInstruction {
  public description: string = '';

  constructor(
    public name: string,
    public opcode: number
  ) { }
}

export class UnaryInstruction extends Instruction implements IUnaryInstruction {
  constructor(
    name: string,
    opcode: number,
    protected operation: (operands: { dst: number }) => number
  ) {
    super(name, opcode);
  }

  operate (operands: { dst: number }) {
    const result = this.operation(operands);

    return {
      operands,
      result
    }
  }
}

export class BinaryInstruction extends Instruction implements IBinaryInstruction {
  constructor(
    name: string,
    opcode: number,
    protected operation: (operands: { dst: number, src: number }) => number
  ) {
    super(name, opcode);
  }

  operate (operands: { dst: number, src: number }) {
    const result = this.operation(operands);

    return {
      operands,
      result
    }
  }
}

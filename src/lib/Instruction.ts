import Register from './Register';
import { Operands } from '../types/instruction';
import { Operation } from '../types/instruction';
import { UnaryOperation } from '../types/instruction';
import { BinaryOperation } from '../types/instruction';

export default class Instruction {
  public description: string = '';

  constructor(
    public opcode: string,
    public execute: UnaryOperation | BinaryOperation
  ) { }

  private getOperation (operands: Operands, operationFunction: (dst: number) => number): Operation;
  private getOperation (operands: Operands, operationFunction: (dst: number, src: number) => number): Operation;

  private getOperation (operands: Operands, operationFunction: Function): Operation {
    const dst = operands.dstOperand.decimal;

    let src;
    if (typeof operands.srcOperand === 'number') {
      src = operands.srcOperand;
    } else if (operands.srcOperand instanceof Register) {
      src = operands.srcOperand.decimal;
    }

    const result: number = operationFunction(dst, src);

    return { src, dst, result };
  }

  test (operands: Operands): Operation {
    return this.getOperation(operands, this.execute);
  }

  perform ({ dstOperand, srcOperand }: Operands): Operation {
    const operation = this.getOperation({ dstOperand, srcOperand }, this.execute);
    dstOperand.decimal = operation.result;
    return operation;
  }
}

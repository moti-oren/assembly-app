import { solveArithmetic, type ArithmeticRequest, type ArithmeticSolution } from './arithmetic';
import { solveBcd, type BcdRequest, type BcdSolution } from './bcd';
import { solveExtension, type ExtensionRequest, type ExtensionSolution } from './extension';
import { readValue, type ValueReadings, type Width } from './readings';

/** One row of bits, to be read every way it can be. */
export interface ValueRequest {
  kind: 'value';
  width: Width;
  bits: number;
}

export interface ValueSolution {
  request: ValueRequest;
  readings: ValueReadings;
}

/** Something the number topic can show. */
export type NumberRequest = ArithmeticRequest | ExtensionRequest | BcdRequest | ValueRequest;

export type NumberSolution = ArithmeticSolution | ExtensionSolution | BcdSolution | ValueSolution;

export function solveNumber(request: ArithmeticRequest): ArithmeticSolution;
export function solveNumber(request: ExtensionRequest): ExtensionSolution;
export function solveNumber(request: BcdRequest): BcdSolution;
export function solveNumber(request: ValueRequest): ValueSolution;
export function solveNumber(request: NumberRequest): NumberSolution;
export function solveNumber(request: NumberRequest): NumberSolution {
  switch (request.kind) {
    case 'add':
    case 'subtract':
      return solveArithmetic(request);
    case 'extend':
      return solveExtension(request);
    case 'bcd':
      return solveBcd(request);
    case 'value':
      return { request, readings: readValue(request.bits, request.width) };
  }
}

/** The bits an operation leaves behind. */
export function resultOf(solution: NumberSolution): number {
  return 'readings' in solution ? solution.readings.bits : solution.result;
}

import { evaluate, type Bit, type Circuit, type Gate, type Signals } from './gates';

/** One AND gate of a decoder: on when every input it names carries the bit it asks for. */
export interface DecoderTerm {
  id: string;
  match: Readonly<Record<string, Bit>>;
}

/** One output of a decoder: an OR gate, on when any of its terms is. */
export interface DecoderLine {
  id: string;
  terms: readonly string[];
}

/** A decoder as two planes: the AND gates that recognise a pattern, and the OR gates they feed. */
export interface DecoderShape {
  inputs: readonly string[];
  terms: readonly DecoderTerm[];
  lines: readonly DecoderLine[];
}

/** The names of a decoder's own wires; its terms and lines are named by their ids. */
export const DECODER = {
  /** An input through a NOT gate, for the terms that ask for a 0. */
  inverted: (input: string) => `not_${input}`,
  /** 1 when any term is on. */
  any: 'any',
  /** 1 when no term is on: the inputs are a pattern the decoder does not know. */
  none: 'none'
};

function termGate({ id, match }: DecoderTerm, inputs: readonly string[]): Gate {
  const read = inputs
    .filter((input) => input in match)
    .map((input) => (match[input] ? input : DECODER.inverted(input)));
  return { id, kind: 'and', inputs: read };
}

/** Builds the gates of a decoder: a NOT per input a term wants low, the ANDs, then the ORs. */
export function decoder({ inputs, terms, lines }: DecoderShape): Circuit {
  const low = inputs.filter((input) => terms.some(({ match }) => match[input] === 0));
  const ids = terms.map((term) => term.id);
  return {
    inputs,
    gates: [
      ...low.map((input): Gate => ({ id: DECODER.inverted(input), kind: 'not', inputs: [input] })),
      ...terms.map((term) => termGate(term, inputs)),
      { id: DECODER.any, kind: 'or', inputs: ids },
      { id: DECODER.none, kind: 'not', inputs: [DECODER.any] },
      ...lines.map((line): Gate => ({ id: line.id, kind: 'or', inputs: line.terms }))
    ]
  };
}

/** A decoder with values on its inputs, worked out gate by gate. */
export interface DecoderSolution {
  shape: DecoderShape;
  circuit: Circuit;
  signals: Signals;
}

/** Builds the decoder and runs the inputs through it. */
export function solveDecoder(shape: DecoderShape, inputs: Signals): DecoderSolution {
  const circuit = decoder(shape);
  return { shape, circuit, signals: evaluate(circuit, inputs) };
}

/** The terms that are on. */
export function activeTerms({ shape, signals }: DecoderSolution): string[] {
  return shape.terms.filter((term) => signals[term.id] === 1).map((term) => term.id);
}

/** The lines that are on. */
export function activeLines({ shape, signals }: DecoderSolution): string[] {
  return shape.lines.filter((line) => signals[line.id] === 1).map((line) => line.id);
}

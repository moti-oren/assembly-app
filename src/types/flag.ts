export default interface Flag {
  description: string;
  name: string;
  value: boolean;
  toggle (): Flag;
  turnOn (): Flag;
  turnOff (): Flag;
}

export enum Names {
  carry = 'carry',
  zero = 'zero',
  sign = 'sign',
  parity = 'parity',
  auxiliaryCarry = 'auxiliaryCarry',
  overflow = 'overflow',
  direction = 'direction',
  interrupt = 'interrupt',
  trace = 'trace'
}

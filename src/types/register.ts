export interface Register {
  name: string;
  size: 16;
  get decimal(): number;
  get hexadecimal(): string;
  get binary(): string;
  set decimal(val: number);
  set hexadecimal(val: string);
  set binary(val: string);
}

export interface SubRegister {
  name: string;
  size: 8;
  get decimal(): number;
  get hexadecimal(): string;
  get binary(): string;
  set decimal(val: number);
  set hexadecimal(val: string);
  set binary(val: string);
}

export interface DataRegister extends Register {
  high: SubRegister;
  low: SubRegister;
}

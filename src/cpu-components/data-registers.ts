import DataRegister from "../lib/DataRegister";
import SubRegister from "../lib/SubRegister";

const ah = new SubRegister("ah");
const al = new SubRegister("al");
const ax = new DataRegister("ax", ah, al);

const bh = new SubRegister("bh");
const bl = new SubRegister("bl");
const bx = new DataRegister("bx", bh, bl);

const ch = new SubRegister("ch");
const cl = new SubRegister("cl");
const cx = new DataRegister("cx", ch, cl);

const dh = new SubRegister("dh");
const dl = new SubRegister("dl");
const dx = new DataRegister("dx", dh, dl);

const mainRegisters = { ax, bx, cx, dx };
export const subRegisters = { ah, al, bh, bl, ch, cl, dh, dl };
export const registers = { ...mainRegisters, ...subRegisters };

export default mainRegisters;

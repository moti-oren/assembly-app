import Register from '../lib/Register';

const axSubRegisters = {
  high: new Register('ah'),
  low: new Register('al')
};

const bxSubRegisters = {
  high: new Register('bh'),
  low: new Register('bl')
};

const cxSubRegisters = {
  high: new Register('ch'),
  low: new Register('cl')
};

const dxSubRegisters = {
  high: new Register('dh'),
  low: new Register('dl')
};

const ax = new Register('ax', axSubRegisters);
const bx = new Register('bx', bxSubRegisters);
const cx = new Register('cx', cxSubRegisters);
const dx = new Register('dx', dxSubRegisters);
const si = new Register('si');
const di = new Register('di');
const bp = new Register('bp');
const sp = new Register('sp');
const ip = new Register('ip');
const cs = new Register('cs');
const ds = new Register('ds');
const ss = new Register('ss');

export default {
  ax,
  bx,
  cx,
  dx,
  si,
  di,
  bp,
  sp,
  ip,
  cs,
  ds,
  ss
};

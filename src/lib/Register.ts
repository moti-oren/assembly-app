import processor from '../cpu-components/processor';
import Mask from './Mask';
import { eventEmitter } from './EventEmitter';

type Size = 16;
type SrcOperand = Register | number;

export default class Register {
  private value: number = 0;
  public size: Size = 16;
  public description: string = '';

  constructor(public name: string) { } // TODO: size is public?

  set decimal (val: number) {
    this.value = Mask.asLow16Bit(val);
  }

  set hexadecimal (val: string) {
    this.value = Mask.asLow16Bit(parseInt(val, 16));
  }

  set binary (val: string) {
    this.value = Mask.asLow16Bit(parseInt(val, 2));
  }

  get decimal (): number {
    return this.value;
  }

  get hexadecimal (): string {
    return this.value.toString(16);
  }

  get binary (): string {
    return this.value.toString(2);
  }

  mov (src: SrcOperand): Register {
    processor.instructions['mov'].perform({ dstOperand: this, srcOperand: src });
    return this;
  }

  inc (): Register {
    const operation = processor.instructions['inc'].perform({ dstOperand: this });
    eventEmitter.emit('arithmetic.inc', operation);
    return this;
  }

  dec (): Register {
    const operation = processor.instructions['dec'].perform({ dstOperand: this });
    eventEmitter.emit('arithmetic.dec', operation);
    return this;
  }

  add (src: SrcOperand): Register {
    const operation = processor.instructions['add'].perform({ dstOperand: this, srcOperand: src });
    eventEmitter.emit('arithmetic.add', operation);
    return this;
  }

  sub (src: SrcOperand): Register {
    const operation = processor.instructions['sub'].perform({ dstOperand: this, srcOperand: src });
    eventEmitter.emit('arithmetic.sub', operation);
    return this;
  }

  mul (): Register {
    const operation = processor.instructions['mul'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.mul', operation);
    return this;
  }

  imul (): Register {
    const operation = processor.instructions['imul'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.imul', operation);
    return this;
  }

  div (): Register {
    const operation = processor.instructions['div'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.div', operation);
    return this;
  }

  idiv (): Register {
    const operation = processor.instructions['idiv'].perform({ dstOperand: this }); // TODO
    eventEmitter.emit('arithmetic.idiv', operation);
    return this;
  }

  not (): Register {
    const operation = processor.instructions['not'].perform({ dstOperand: this });
    eventEmitter.emit('logic.not', operation);
    return this;
  }

  and (src: SrcOperand): Register {
    const operation = processor.instructions['and'].perform({ dstOperand: this, srcOperand: src });
    eventEmitter.emit('logic.and', operation);
    return this;
  }

  or (src: SrcOperand): Register {
    const operation = processor.instructions['or'].perform({ dstOperand: this, srcOperand: src });
    eventEmitter.emit('logic.or', operation);
    return this;
  }

  xor (src: SrcOperand): Register {
    const operation = processor.instructions['xor'].perform({ dstOperand: this, srcOperand: src });
    eventEmitter.emit('logic.xor', operation);
    return this;
  }

  shr (amount: number): Register {
    const operation = processor.instructions['shr'].perform({ dstOperand: this, srcOperand: amount });
    eventEmitter.emit('logic.shr', operation);
    return this;
  }

  shl (amount: number): Register {
    const operation = processor.instructions['shl'].perform({ dstOperand: this, srcOperand: amount });
    eventEmitter.emit('logic.shl', operation);
    return this;
  }
}

// TODO

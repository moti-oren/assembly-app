import type { CoreTextMessages } from '../en/coreText';
import { coreText as english } from '../en/coreText';
import { EXAMPLE_TEXTS, TASK_TEXTS } from './examples';
import type { FlagName } from '@/core/x86/flags';
import type {
  Category as X86Category,
  Mnemonic as X86Mnemonic,
  RepeatPrefix
} from '@/core/x86/instructions';
import type { OperandKind } from '@/core/x86/operands';
import type { WordRegister } from '@/core/x86/registers';
import type { Category as Rv32Category, Mnemonic as Rv32Mnemonic } from '@/core/rv32/instructions';
import type { PseudoMnemonic } from '@/core/rv32/pseudo';
import type {
  Category as Mos6502Category,
  Mnemonic as Mos6502Mnemonic
} from '@/core/mos6502/instructions';

const X86_CATEGORIES: Record<X86Category, string> = {
  transfer: 'העברת נתונים',
  arithmetic: 'חשבון',
  logic: 'לוגיקה',
  shift: 'הזזה וסיבוב',
  string: 'מחרוזות',
  io: 'קלט ופלט',
  control: 'קפיצות וקריאות',
  interrupt: 'פסיקות',
  flags: 'שליטה בדגלים'
};

const REPEAT_PREFIXES: Record<RepeatPrefix, string> = {
  rep: 'חוזרת CX פעמים',
  repe: 'חוזרת כל עוד CX ≠ 0 והערכים שהושוו שווים (ZF = 1)',
  repne: 'חוזרת כל עוד CX ≠ 0 והערכים שהושוו שונים (ZF = 0)'
};

const OPERAND_KINDS: Record<OperandKind, string> = {
  r8: 'רגיסטר של 8 סיביות',
  r16: 'רגיסטר של 16 סיביות',
  sreg: 'רגיסטר segment',
  sregw: 'רגיסטר segment',
  cl: 'כמות הזזה ב-CL',
  al: 'רגיסטר נתונים של 8 סיביות',
  ax: 'רגיסטר נתונים של 16 סיביות',
  dx: 'מספר פורט ב-DX',
  one: 'כמות הזזה של 1',
  imm8: 'immediate של 8 סיביות',
  imm16: 'immediate של 16 סיביות',
  m8: 'בית בזיכרון',
  m16: 'מילה בזיכרון',
  label: 'שורה בתוכנית'
};

const FLAGS: Record<FlagName, { label: string; description: string }> = {
  CF: { label: 'נשא', description: 'גלישה ללא סימן: נשא מהסיבית העליונה, או לווה אליה' },
  PF: { label: 'זוגיות', description: 'בבית הנמוך של התוצאה יש מספר זוגי של סיביות 1' },
  AF: { label: 'נשא עזר', description: 'נשא מסיבית 3 (משמש בחשבון BCD)' },
  ZF: { label: 'אפס', description: 'התוצאה היא אפס' },
  SF: { label: 'סימן', description: 'הסיבית העליונה של התוצאה היא 1 (שלילי כמספר עם סימן)' },
  TF: { label: 'מלכודת', description: 'מצב צעד בודד' },
  IF: { label: 'פסיקות', description: 'פסיקות שאפשר לחסום מופעלות' },
  DF: { label: 'כיוון', description: 'הוראות מחרוזת סופרות למטה' },
  OF: { label: 'גלישה', description: 'גלישה עם סימן: התוצאה לא נכנסת כמספר עם סימן' }
};

const REGISTERS: Record<WordRegister, string> = {
  ax: 'צובר: אופרנד סמוי של MUL/DIV',
  bx: 'בסיס: אפשר לפנות איתו לזיכרון ([bx])',
  cx: 'מונה: CL מחזיק את כמות ההזזה או הסיבוב',
  dx: 'נתונים: המילה הגבוהה של תוצאות MUL/DIV',
  si: 'אינדקס מקור',
  di: 'אינדקס יעד',
  bp: 'מצביע בסיס: פונה ל-stack segment ([bp])',
  sp: 'מצביע מחסנית: ראש המחסנית (SS:SP)',
  cs: 'code segment',
  ds: 'data segment: ברירת המחדל לאופרנדים בזיכרון',
  es: 'extra segment',
  ss: 'stack segment: משמש את PUSH/POP ואת [bp]',
  ip: 'מצביע ההוראה: שורת התוכנית הבאה שתרוץ'
};

const X86_DESCRIPTIONS: Record<X86Mnemonic, string> = {
  mov: 'dst = src',
  xchg: 'החלפה בין dst ל-src',
  push: 'SP -= 2, ואז [SS:SP] = src',
  pop: 'dst = [SS:SP], ואז SP += 2',
  add: 'dst = dst + src',
  adc: 'dst = dst + src + CF',
  sub: 'dst = dst - src',
  sbb: 'dst = dst - src - CF',
  cmp: 'קביעת הדגלים כמו ב-dst - src, בלי לשמור את התוצאה',
  inc: 'dst = dst + 1 (‏CF לא משתנה)',
  dec: 'dst = dst - 1 (‏CF לא משתנה)',
  neg: 'dst = -dst (משלים ל-2)',
  mul: 'ללא סימן: AX = AL * src, או DX:AX = AX * src',
  imul: 'עם סימן: AX = AL * src, או DX:AX = AX * src',
  div: 'ללא סימן: AL,AH = AX / src, או AX,DX = DX:AX / src',
  idiv: 'עם סימן: AL,AH = AX / src, או AX,DX = DX:AX / src',
  and: 'dst = dst AND src',
  or: 'dst = dst OR src',
  xor: 'dst = dst XOR src',
  not: 'dst = NOT dst (הדגלים לא משתנים)',
  test: 'קביעת הדגלים כמו ב-dst AND src, בלי לשמור את התוצאה',
  shl: 'הזזה שמאלה, הסיבית העליונה עוברת ל-CF',
  shr: 'הזזה לוגית ימינה, הסיבית התחתונה עוברת ל-CF',
  sar: 'הזזה אריתמטית ימינה (שומרת על הסימן)',
  rol: 'סיבוב שמאלה',
  ror: 'סיבוב ימינה',
  rcl: 'סיבוב שמאלה דרך CF',
  rcr: 'סיבוב ימינה דרך CF',
  movsb: 'העתקת הבית ב-DS:SI אל ES:DI, ואז קידום SI ו-DI',
  movsw: 'העתקת המילה ב-DS:SI אל ES:DI, ואז קידום SI ו-DI',
  stosb: 'שמירת AL ב-ES:DI, ואז קידום DI',
  stosw: 'שמירת AX ב-ES:DI, ואז קידום DI',
  lodsb: 'טעינת הבית ב-DS:SI אל AL, ואז קידום SI',
  lodsw: 'טעינת המילה ב-DS:SI אל AX, ואז קידום SI',
  scasb: 'קביעת הדגלים כמו ב-AL - הבית ב-ES:DI, ואז קידום DI',
  scasw: 'קביעת הדגלים כמו ב-AX - המילה ב-ES:DI, ואז קידום DI',
  cmpsb: 'קביעת הדגלים כמו ב: הבית ב-DS:SI - הבית ב-ES:DI, ואז קידום SI ו-DI',
  cmpsw: 'קביעת הדגלים כמו ב: המילה ב-DS:SI - המילה ב-ES:DI, ואז קידום SI ו-DI',
  in: 'קריאת AL או AX מפורט I/O',
  out: 'כתיבת AL או AX לפורט I/O',
  jmp: 'קפיצה תמיד',
  je: 'קפיצה אם שווה (ZF = 1)',
  jne: 'קפיצה אם לא שווה (ZF = 0)',
  jz: 'קפיצה אם אפס (ZF = 1)',
  jnz: 'קפיצה אם לא אפס (ZF = 0)',
  ja: 'ללא סימן: קפיצה אם גדול (CF = 0 ו-ZF = 0)',
  jae: 'ללא סימן: קפיצה אם גדול או שווה (CF = 0)',
  jb: 'ללא סימן: קפיצה אם קטן (CF = 1)',
  jbe: 'ללא סימן: קפיצה אם קטן או שווה (CF = 1 או ZF = 1)',
  jg: 'עם סימן: קפיצה אם גדול (ZF = 0 ו-SF = OF)',
  jge: 'עם סימן: קפיצה אם גדול או שווה (SF = OF)',
  jl: 'עם סימן: קפיצה אם קטן (SF ≠ OF)',
  jle: 'עם סימן: קפיצה אם קטן או שווה (ZF = 1 או SF ≠ OF)',
  jc: 'קפיצה אם יש נשא (CF = 1)',
  jnc: 'קפיצה אם אין נשא (CF = 0)',
  js: 'קפיצה אם יש סימן (SF = 1)',
  jns: 'קפיצה אם אין סימן (SF = 0)',
  jo: 'קפיצה אם יש גלישה (OF = 1)',
  jno: 'קפיצה אם אין גלישה (OF = 0)',
  jp: 'קפיצה אם הזוגיות זוגית (PF = 1)',
  jnp: 'קפיצה אם הזוגיות אי-זוגית (PF = 0)',
  jcxz: 'קפיצה אם CX = 0',
  loop: 'CX -= 1, קפיצה אם CX ≠ 0 (הדגלים לא משתנים)',
  loope: 'CX -= 1, קפיצה אם CX ≠ 0 ו-ZF = 1',
  loopne: 'CX -= 1, קפיצה אם CX ≠ 0 ו-ZF = 0',
  call: 'דחיפת IP (השורה הבאה), ואז קפיצה',
  ret: 'שליפת IP: חזרה לשורה שאחרי ה-CALL',
  int: 'דחיפת FLAGS,‏ CS ו-IP, ואז קפיצה למטפל בווקטור n (ב-0000:n×4)',
  into: 'פסיקה 4 אם OF = 1, אחרת לא עושה כלום',
  iret: 'שליפת IP,‏ CS ו-FLAGS: חזרה ממטפל פסיקה',
  pushf: 'דחיפת FLAGS למחסנית',
  popf: 'שליפת FLAGS מהמחסנית',
  clc: 'CF = 0',
  stc: 'CF = 1',
  cmc: 'CF = NOT CF',
  cld: 'DF = 0',
  std: 'DF = 1',
  cli: 'IF = 0',
  sti: 'IF = 1',
  nop: 'לא עושה כלום'
};

const RV32_CATEGORIES: Record<Rv32Category, string> = {
  arithmetic: 'חשבון',
  logic: 'לוגיקה',
  shift: 'הזזה',
  compare: 'השוואה',
  multiply: 'כפל וחילוק (M)',
  load: 'טעינה מהזיכרון',
  store: 'שמירה בזיכרון',
  branch: 'הסתעפות',
  jump: 'קפיצה וקישור',
  upper: 'immediate עליון'
};

const RV32_DESCRIPTIONS: Record<Rv32Mnemonic, string> = {
  add: 'rd = rs1 + rs2',
  sub: 'rd = rs1 - rs2',
  addi: 'rd = rs1 + imm',
  and: 'rd = rs1 AND rs2',
  or: 'rd = rs1 OR rs2',
  xor: 'rd = rs1 XOR rs2',
  andi: 'rd = rs1 AND imm',
  ori: 'rd = rs1 OR imm',
  xori: 'rd = rs1 XOR imm',
  sll: 'rd = rs1 << rs2 (5 הסיביות התחתונות)',
  srl: 'rd = rs1 >> rs2, עם מילוי באפסים',
  sra: 'rd = rs1 >> rs2, עם שמירה על הסימן',
  slli: 'rd = rs1 << shamt',
  srli: 'rd = rs1 >> shamt, עם מילוי באפסים',
  srai: 'rd = rs1 >> shamt, עם שמירה על הסימן',
  slt: 'עם סימן: rd = 1 אם rs1 < rs2, אחרת 0',
  sltu: 'ללא סימן: rd = 1 אם rs1 < rs2, אחרת 0',
  slti: 'עם סימן: rd = 1 אם rs1 < imm, אחרת 0',
  sltiu: 'ללא סימן: rd = 1 אם rs1 < imm (אחרי הרחבת סימן), אחרת 0',
  mul: 'rd = 32 הסיביות התחתונות של rs1 × rs2',
  mulh: 'עם סימן: rd = 32 הסיביות העליונות של rs1 × rs2',
  mulhsu: 'rd = 32 הסיביות העליונות של rs1 (עם סימן) × rs2 (ללא סימן)',
  mulhu: 'ללא סימן: rd = 32 הסיביות העליונות של rs1 × rs2',
  div: 'עם סימן: rd = rs1 / rs2, מעוגל לכיוון אפס',
  divu: 'ללא סימן: rd = rs1 / rs2',
  rem: 'עם סימן: rd = שארית החלוקה rs1 / rs2',
  remu: 'ללא סימן: rd = שארית החלוקה rs1 / rs2',
  lb: 'rd = הבית ב-offset(rs1), עם הרחבת סימן',
  lh: 'rd = חצי המילה ב-offset(rs1), עם הרחבת סימן',
  lw: 'rd = המילה ב-offset(rs1)',
  lbu: 'rd = הבית ב-offset(rs1), עם הרחבת אפסים',
  lhu: 'rd = חצי המילה ב-offset(rs1), עם הרחבת אפסים',
  sb: 'הבית ב-offset(rs1) = הבית התחתון של rs2',
  sh: 'חצי המילה ב-offset(rs1) = החצי התחתון של rs2',
  sw: 'המילה ב-offset(rs1) = rs2',
  beq: 'קפיצה אם rs1 = rs2',
  bne: 'קפיצה אם rs1 ≠ rs2',
  blt: 'עם סימן: קפיצה אם rs1 < rs2',
  bge: 'עם סימן: קפיצה אם rs1 ≥ rs2',
  bltu: 'ללא סימן: קפיצה אם rs1 < rs2',
  bgeu: 'ללא סימן: קפיצה אם rs1 ≥ rs2',
  jal: 'rd = כתובת ההוראה הבאה, ואז קפיצה',
  jalr: 'rd = כתובת ההוראה הבאה, ואז קפיצה אל offset(rs1)',
  lui: 'rd = imm << 12: 20 הסיביות העליונות, ו-12 התחתונות 0',
  auipc: 'rd = כתובת ההוראה הזו + (imm << 12)'
};

const PSEUDO_DESCRIPTIONS: Record<PseudoMnemonic, string> = {
  li: 'rd = כל ערך של 32 סיביות',
  mv: 'rd = rs (ADDI rd, rs, 0)',
  not: 'rd = NOT rs (XORI rd, rs, -1)',
  neg: 'rd = -rs (SUB rd, zero, rs)',
  nop: 'לא עושה כלום (ADDI zero, zero, 0)',
  seqz: 'rd = 1 אם rs = 0 (SLTIU rd, rs, 1)',
  snez: 'rd = 1 אם rs ≠ 0 (SLTU rd, zero, rs)',
  j: 'קפיצה (JAL zero, label: הקישור נזרק)',
  jr: 'קפיצה לכתובת ב-rs (JALR zero, 0(rs))',
  ret: 'חזרה לכתובת ב-ra (JALR zero, 0(ra))',
  beqz: 'קפיצה אם rs = 0 (BEQ rs, zero, label)',
  bnez: 'קפיצה אם rs ≠ 0 (BNE rs, zero, label)',
  bltz: 'קפיצה אם rs < 0 (BLT rs, zero, label)',
  bgez: 'קפיצה אם rs ≥ 0 (BGE rs, zero, label)',
  bgtz: 'קפיצה אם rs > 0 (BLT zero, rs, label)',
  blez: 'קפיצה אם rs ≤ 0 (BGE zero, rs, label)',
  bgt: 'עם סימן: קפיצה אם rs > rt (BLT rt, rs, label)',
  ble: 'עם סימן: קפיצה אם rs ≤ rt (BGE rt, rs, label)',
  bgtu: 'ללא סימן: קפיצה אם rs > rt (BLTU rt, rs, label)',
  bleu: 'ללא סימן: קפיצה אם rs ≤ rt (BGEU rt, rs, label)'
};

const MOS6502_CATEGORIES: Record<Mos6502Category, string> = {
  load: 'טעינה ושמירה',
  transfer: 'העברה בין רגיסטרים',
  stack: 'מחסנית',
  arithmetic: 'חשבון והשוואה',
  logic: 'לוגיקה',
  shift: 'הזזה וסיבוב',
  jump: 'קפיצה ותת-שגרה',
  branch: 'הסתעפות',
  flags: 'דגלים',
  interrupt: 'פסיקה ואחרים'
};

const MOS6502_DESCRIPTIONS: Record<Mos6502Mnemonic, string> = {
  lda: 'A = האופרנד',
  ldx: 'X = האופרנד',
  ldy: 'Y = האופרנד',
  sta: 'האופרנד = A',
  stx: 'האופרנד = X',
  sty: 'האופרנד = Y',
  tax: 'X = A',
  tay: 'Y = A',
  txa: 'A = X',
  tya: 'A = Y',
  tsx: 'X = SP',
  txs: 'SP = X (הדגלים לא משתנים)',
  pha: 'דחיפת A למחסנית',
  php: 'דחיפת P, כשהדגל B דולק, למחסנית',
  pla: 'שליפת A מהמחסנית',
  plp: 'שליפת P מהמחסנית',
  adc: 'A = A + האופרנד + C (עשרוני כש-D = 1)',
  sbc: 'A = A - האופרנד - (1 - C) (עשרוני כש-D = 1)',
  cmp: 'קביעת הדגלים כמו ב-A - האופרנד: C = 1 אם A ≥ האופרנד',
  cpx: 'קביעת הדגלים כמו ב-X - האופרנד',
  cpy: 'קביעת הדגלים כמו ב-Y - האופרנד',
  inc: 'האופרנד = האופרנד + 1',
  dec: 'האופרנד = האופרנד - 1',
  inx: 'X = X + 1',
  iny: 'Y = Y + 1',
  dex: 'X = X - 1',
  dey: 'Y = Y - 1',
  and: 'A = A AND האופרנד',
  ora: 'A = A OR האופרנד',
  eor: 'A = A XOR האופרנד',
  bit: 'Z = (A AND האופרנד) = 0; ‏N ו-V = סיביות 7 ו-6 שלו',
  asl: 'הזזה שמאלה; סיבית 7 עוברת ל-C',
  lsr: 'הזזה ימינה; סיבית 0 עוברת ל-C',
  rol: 'סיבוב שמאלה דרך C',
  ror: 'סיבוב ימינה דרך C',
  jmp: 'קפיצה',
  jsr: 'דחיפת הכתובת של הבית האחרון שלה, ואז קפיצה',
  rts: 'שליפת כתובת, הוספת 1, וקפיצה אליה',
  bcc: 'הסתעפות אם C = 0',
  bcs: 'הסתעפות אם C = 1',
  beq: 'הסתעפות אם Z = 1 (שווה)',
  bne: 'הסתעפות אם Z = 0 (לא שווה)',
  bmi: 'הסתעפות אם N = 1 (שלילי)',
  bpl: 'הסתעפות אם N = 0 (חיובי)',
  bvc: 'הסתעפות אם V = 0',
  bvs: 'הסתעפות אם V = 1',
  clc: 'C = 0',
  sec: 'C = 1',
  cli: 'I = 0',
  sei: 'I = 1',
  cld: 'D = 0: חשבון בינארי',
  sed: 'D = 1: חשבון עשרוני (BCD)',
  clv: 'V = 0',
  brk: 'דחיפת PC + 2 ו-P, הדלקת I, וקפיצה דרך הווקטור ב-$FFFE',
  rti: 'שליפת P ואז PC: חזרה מפסיקה',
  nop: 'לא עושה כלום'
};

export const coreText: CoreTextMessages = {
  x86Text: {
    category: (category) => X86_CATEGORIES[category],
    description: (mnemonic, prefix) =>
      prefix
        ? `${REPEAT_PREFIXES[prefix]}: ${X86_DESCRIPTIONS[mnemonic]}`
        : X86_DESCRIPTIONS[mnemonic],
    prefix: (prefix) => REPEAT_PREFIXES[prefix],
    operandKind: (kind) => OPERAND_KINDS[kind],
    flagLabel: (flag) => FLAGS[flag].label,
    flagDescription: (flag) => FLAGS[flag].description,
    register: (register) => REGISTERS[register]
  },
  rv32Text: {
    category: (category) => RV32_CATEGORIES[category],
    description: (mnemonic) => RV32_DESCRIPTIONS[mnemonic],
    pseudo: (mnemonic) => PSEUDO_DESCRIPTIONS[mnemonic]
  },
  mos6502Text: {
    category: (category) => MOS6502_CATEGORIES[category],
    description: (mnemonic) => MOS6502_DESCRIPTIONS[mnemonic]
  },
  // An example or task with no Hebrew text yet shows its English one; a test lists those.
  examples: {
    name: (architecture, id) =>
      EXAMPLE_TEXTS[architecture][id]?.name ?? english.examples.name(architecture, id),
    description: (architecture, id) =>
      EXAMPLE_TEXTS[architecture][id]?.description ?? english.examples.description(architecture, id)
  },
  tasks: {
    name: (id) => TASK_TEXTS[id]?.name ?? english.tasks.name(id),
    lesson: (id) => TASK_TEXTS[id]?.lesson ?? english.tasks.lesson(id)
  }
};

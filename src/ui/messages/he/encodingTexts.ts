import type { Mos6502EncodingTextKey } from '@/core/mos6502/encodingTexts';
import type { Rv32EncodingTextKey } from '@/core/rv32/encodingTexts';
import type { EncodingTextKey } from '@/core/x86/encodingTexts';

/** What each field of the machine code says about itself, as Hebrew templates (`{name}` is a hole). */
export const X86_ENCODING_TEXTS: Record<EncodingTextKey, string> = {
  wholeByte: '{name}: כל ההוראה היא הבית הזה',
  shortDistance: '{name} עם מרחק של 8 סיביות',
  groupSignExtended: 'קבוצה: r/m16 עם immediate של 8 סיביות שמורחב סימן ל-16 סיביות',
  groupImmediate: 'קבוצה: r/m{size} עם immediate של {size} סיביות',
  accumulatorImmediate: '{name} {register}, imm{size}: צורה קצרה בלי ModR/M',
  groupArithmetic: 'קבוצה: חשבון עם אופרנד אחד על r/m{size}',
  groupShift: 'קבוצה: הזזה של r/m{size} ב-{count}',
  movSegmentFrom: 'MOV sreg, r/m16',
  movSegmentTo: 'MOV r/m16, sreg',
  movRegisterImmediate: 'MOV r{size}, imm{size}: {base} + מספר הרגיסטר ({register} = {number})',
  movMemoryImmediate: 'MOV r/m{size}, imm{size}',
  movFromAddress: 'MOV {register}, [address]: צורה קצרה בלי ModR/M',
  movToAddress: 'MOV [address], {register}: צורה קצרה בלי ModR/M',
  xchgAccumulator: 'XCHG AX, r16: 90 + מספר הרגיסטר ({register} = {number})',
  xchgMemory: 'XCHG r{size}, r/m{size}',
  registerFromRm: '{name} r{size}, r/m{size}',
  rmFromRegister: '{name} r/m{size}, r{size}',
  testAccumulator: 'TEST {register}, imm{size}: צורה קצרה בלי ModR/M',
  pushPopSegment: '{name} sreg: מספר רגיסטר ה-segment ({register} = {number}) יושב בסיביות 3 ו-4',
  registerPlusNumber: '{name} r16: {base} + מספר הרגיסטר ({register} = {number})',
  groupOneOperand16: 'קבוצה: הוראות עם אופרנד אחד על r/m16',
  popMemory: 'POP r/m16',
  groupOneOperand: 'קבוצה: הוראות עם אופרנד אחד על r/m{size}',
  jmpNear: 'JMP עם מרחק של 16 סיביות (near)',
  jmpShort: 'JMP עם מרחק של 8 סיביות (short)',
  callNear: 'CALL עם מרחק של 16 סיביות',
  portInDx: '{name} דרך הפורט ב-DX, {size} סיביות',
  portFixed: '{name} דרך פורט קבוע, {size} סיביות',
  int3: 'INT 3: ל-opcode שלה בית אחד משלה, שנועד לנקודות עצירה',
  intNumber: 'INT',
  repeatPrefix: '{prefix}: חוזרת על הוראת המחרוזת שאחריה כל עוד CX ≠ 0',

  immediateSignExtended: 'ה-immediate, שמור בבית אחד ומורחב סימן',
  immediateLowFirst: 'ה-immediate, הבית הנמוך קודם',
  labelOffset: 'ה-offset של {label} בקוד, הבית הנמוך קודם',
  addressLowFirst: 'הכתובת של 16 סיביות, הבית הנמוך קודם',
  displacementZero: 'displacement אפס: אי אפשר לקודד [BP] בלעדיו',
  displacement8: 'ה-displacement של 8 סיביות, מורחב סימן ומתווסף לרגיסטר',
  displacement16: 'ה-displacement של 16 סיביות, הבית הנמוך קודם, מתווסף לרגיסטר',
  portNumber: 'מספר הפורט',
  interruptNumber: 'מספר הפסיקה',
  distance: 'המרחק לקפיצה, נמדד מההוראה הבאה: {sum}, ולכן {distance}',
  distanceSum: '{label} נמצאת ב-{destination}h וההוראה הבאה ב-{next}h',

  modrm: 'ModR/M: באיזה רגיסטר ובאיזה רגיסטר או מקום בזיכרון ה-opcode משתמש',
  modRegister: '11: r/m הוא רגיסטר',
  modDirect: '00: r/m 110, אחריו בא כתובת ישירה',
  modMemory: '00: זיכרון, בלי displacement',
  modDisplacement8: '01: זיכרון, אחריו בא displacement של 8 סיביות',
  modDisplacement16: '10: זיכרון, אחריו בא displacement של 16 סיביות',
  regRegister: '{bits} = {register}',
  regExtension: '{bits} = /{number}: בוחר את {name} מתוך הקבוצה של ה-opcode הזה',
  rmRegister: '{bits} = {register}',
  rmDirect: '110 = כתובת ישירה',
  rmBase: '{bits} = [{base}]',

  tooFar:
    'רחוק מדי לקפיצה מותנית: היא מגיעה 128 בתים אחורה או 127 קדימה, ו-{label} במרחק {distance}. אפשר לקפוץ לפי התנאי ההפוך מעל JMP אל היעד.'
};

export const RV32_ENCODING_TEXTS: Record<Rv32EncodingTextKey, string> = {
  register: '{abi} (x{index})',
  opcodeName: '{name}',
  opcodeOpImm: 'OP-IMM: רגיסטר ו-immediate',
  opcodeOp: 'OP: רגיסטר ורגיסטר',
  picks: 'בוחר את {name} בתוך ה-opcode שלו',
  mulDiv: 'מסמן כפל או חילוק (הרחבת M)',
  shiftAmount: 'כמות ההזזה, 0 עד 31',
  immediateI: 'ה-immediate של 12 סיביות, מורחב סימן בשימוש',
  immediateS: 'ה-offset של 12 סיביות, מפוצל סביב rs1 ו-rs2 כדי שהם יישארו במקום שיש להם בכל פורמט',
  immediateBJ: 'המרחק לקפיצה, בבתים מההוראה הזו. הוא תמיד זוגי, ולכן סיבית 0 לא נשמרת',
  immediateU: '20 הסיביות העליונות של הערך; 12 התחתונות הן 0',
  outOfRangeBranch:
    'מחוץ לטווח: הסתעפות מגיעה רק {reach} לכל כיוון, ו-{label} במרחק {distance} בתים',
  outOfRangeJal: 'מחוץ לטווח: JAL מגיעה רק {reach} לכל כיוון, ו-{label} במרחק {distance} בתים'
};

export const MOS6502_ENCODING_TEXTS: Record<Mos6502EncodingTextKey, string> = {
  opcode: '{name}, {mode}: בית אחד לשניהם',
  valueItself: 'הערך עצמו',
  zeroPage: 'כתובת ה-zero page',
  zeroPageIndexed: 'כתובת ה-zero page, לפני שמוסיפים את {index}',
  pointerAddress: 'המקום ב-zero page שבו נמצא המצביע',
  lowAddress: 'הבית הנמוך של הכתובת',
  highAddress: 'הבית הגבוה של הכתובת',
  lowAddressIndexed: 'הבית הנמוך של הכתובת, לפני שמוסיפים את {index}',
  highAddressIndexed: 'הבית הגבוה של הכתובת, לפני שמוסיפים את {index}',
  lowStored: 'הבית הנמוך של המקום שבו שמורה כתובת היעד',
  highStored: 'הבית הגבוה של המקום שבו שמורה כתובת היעד',
  lowTarget: 'הבית הנמוך של הכתובת של {label}, {address}',
  highTarget: 'הבית הגבוה של הכתובת של {label}, {address}',
  branchDistance: 'כמה רחוק להסתעף מההוראה הבאה ב-{next}: {distance}',
  signature: 'בית חתימה: BRK מדלגת עליו, ולכן החזרה נוחתת אחריו',
  outOfRange:
    'מחוץ לטווח: הסתעפות מגיעה רק 128 בתים אחורה או 127 קדימה, ו-{label} במרחק {distance}',
  cyclesBranch: '{cycles} (+1 אם ההסתעפות מתבצעת, ועוד +1 בחציית עמוד)',
  cyclesPage: '{cycles} (+1 בחציית עמוד)'
};

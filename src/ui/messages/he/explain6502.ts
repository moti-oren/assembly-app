import type { Explain6502Messages } from '../en/explain6502';

const cycles = (count: number) => (count === 1 ? 'מחזור אחד' : `${count} מחזורים`);

export const explain6502: Explain6502Messages = {
  mos6502Explain: {
    encodingSummary: (bytes, address, where, count) =>
      `${bytes} ב-${address}, ${where} · מחזורים: ${count}`,
    pastEnd: (pc) => `PC הוא ${pc}, אחרי השורה האחרונה.`,
    fetch: (pc, line, opcode, mnemonic, mode, bytes, next) =>
      `PC הוא ${pc}, המקום שבו ${line} מתחילה. ה-CPU קורא שם את ה-opcode,\u200f ${opcode}: ${mnemonic} בשיטת המיעון ${mode}, ${bytes} בסך הכול, ולכן PC מתקדם ל-${next}.`,
    kind: (category, mode, description) => `${category}, ${mode}: ${description}.`,
    reads: (items) => `היא קוראת את ${items}.`,
    readsMemory: 'היא תקרא בית מהזיכרון.',
    writesMemory: 'היא תכתוב בית לזיכרון.',
    writes: (items) => `היא כותבת ל-${items}.`,
    sets: (flags) => `היא קובעת את ${flags}.`,
    takes: (count, pageCross, branch) =>
      `היא לוקחת ${cycles(count)}${pageCross ? ', ועוד אחד אם האינדקס חוצה עמוד' : ''}${branch ? ', ויותר אם היא מסתעפת' : ''}.`,
    extraPage: '1 על חציית עמוד',
    extraBranch: '1 על ביצוע ההסתעפות',
    extraBranchPage: '2 על הסתעפות לעמוד אחר',
    cycles: (count) => cycles(count),
    cyclesPlus: (count, base, extras) => `${cycles(count)}: ${base}, ועוד ${extras}`,
    flags: 'הדגלים',
    memory: 'הזיכרון',
    device: 'התקן',
    changed: (items) => `היא שינתה את ${items}.`,
    changedNothing: 'היא לא שינתה כלום.',
    direct: 'הורצה ישירות, ולכן שום דבר לא נקרא.',
    jumpedTo: (pc) => `היא קפצה ל-${pc}.`,
    jumped: (pc) => `היא קפצה: PC עכשיו ${pc}.`,
    nextLine: (pc) => `PC ב-${pc}, השורה הבאה.`,
    zeroPage: (base) => `${base}, ב-zero page`,
    zeroPageIndexed: (sum, address) => `${sum} = ${address}, בגלגול בתוך ה-zero page`,
    intoPage: (page) => `, לתוך עמוד ${page}`,
    indexedIndirect: (sum, at, address) => `${sum} = ${at}; המצביע שם מחזיק ${address}`,
    indirectIndexed: (base, pointer, rest) => `המצביע ב-${base} מחזיק ${pointer}${rest}`,
    indirectBug: (page) => `, והבית הגבוה שלה נקרא מ-${page}: הבאג של ה-NMOS`,
    indirect: (base, address, bug) => `הכתובת השמורה ב-${base} היא ${address}${bug}`,
    devices: {
      leds: 'הנורות',
      switches: 'המתגים',
      leftDigit: 'הספרה השמאלית',
      rightDigit: 'הספרה הימנית',
      terminal: 'המסוף',
      other: 'התקן'
    },
    inCode: 'בתוך הקוד',
    wrote: (value, where) => `כתבה ${value} ל-${where}`,
    read: (value, where) => `קראה ${value} מ-${where}`
  },
  mos6502Alu: {
    flagsOnly: 'רק הדגלים נשמרים',
    into: (register) => `אל ${register}`,
    backTo: (address) => `בחזרה ל-${address}`,
    decimal: 'ספרות עשרוניות (BCD)',
    borrow: 'הנשא הנכנס הוא 1 − C, הלווה',
    bitNote: 'N ו-V באים מהבית עצמו',
    rotate: (carry) => `C נכנס (היה ${carry})`,
    carryAlone: 'C לא משתנה',
    borrowMark: '(לווה)',
    direct: {
      clc: 'CLC ניקתה את C',
      sec: 'SEC הדליקה את C',
      cli: 'CLI ניקתה את I: פסיקות יכולות להיכנס',
      sei: 'SEI הדליקה את I: פסיקות מעוכבות',
      cld: 'CLD ניקתה את D: חשבון בינארי',
      sed: 'SED הדליקה את D: ADC ו-SBC עובדות בעשרוני',
      clv: 'CLV ניקתה את V',
      brk: 'BRK הדליקה את I, כך שפסיקה נוספת ממתינה',
      plp: 'PLP שלפה את P מהמחסנית',
      rti: 'RTI שלפה את P מהמחסנית'
    },
    bit7OfByte: (bit) => `סיבית 7 של הבית היא ${bit}`,
    decimalNV: 'במצב עשרוני ה-6502 של NMOS לוקח את N מהסכום לפני שהספרה הגבוהה שלו מתוקנת',
    bit7Of: (value, bit) => `סיבית 7 של ${value} היא ${bit}`,
    andByte: (value, zero) => `A AND הבית הוא ${value}${zero ? ': אפס' : ''}`,
    decimalZ: (value) => `במצב עשרוני ה-6502 של NMOS לוקח את Z מהסכום הבינארי, לא מ-${value}`,
    zero: (value) => `התוצאה ${value} היא אפס`,
    notZero: (value) => `התוצאה ${value} אינה אפס`,
    atLeast: (a, b) => `${a} ≥ ${b} (ללא סימן)`,
    below: (a, b) => `${a} < ${b} (ללא סימן)`,
    noBorrow: 'לא היה צורך בלווה',
    borrowed: 'היה צורך בלווה',
    shiftedOut: (bit) => `הסיבית שיצאה בהזזה הייתה ${bit}`,
    carried: 'הסכום יצר נשא מסיבית 7',
    fit: 'הסכום נכנס ב-8 סיביות',
    bit6: (bit) => `סיבית 6 של הבית היא ${bit}`,
    decimalV: 'במצב עשרוני ה-6502 של NMOS לוקח את V מהסכום לפני שהספרה הגבוהה שלו מתוקנת',
    overflowed: 'כמספרים עם סימן התוצאה לא נכנסת: היא גלשה',
    fits: 'כמספרים עם סימן התוצאה נכנסת'
  },
  mos6502Diagram: {
    idle: 'לא פעיל',
    readOpcode: (opcode, address) => `קרא את ה-opcode ${opcode} מ-${address}`,
    willSet: (flags) => `יקבע את ${flags}`,
    willAddress: 'יחשב את הכתובת',
    willWrite: 'יכתוב בית',
    willRead: 'יקרא בית'
  },
  mos6502Flags: {
    N: { label: 'שלילי', description: 'סיבית 7 של התוצאה' },
    V: { label: 'גלישה', description: 'התוצאה עם הסימן לא נכנסת, או סיבית 6 בהוראת BIT' },
    D: { label: 'עשרוני', description: 'ADC ו-SBC מחברות ומחסרות ספרות עשרוניות' },
    I: { label: 'חסימת פסיקות', description: 'בקשות פסיקה מעוכבות' },
    Z: { label: 'אפס', description: 'התוצאה היא אפס' },
    C: { label: 'נשא', description: 'נשא מסיבית 7; ב-SBC וב-CMP, אין לווה' }
  }
};

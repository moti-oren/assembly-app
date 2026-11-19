import type { BuilderMessages } from '../en/builder';

const cycles = (count: number) => (count === 1 ? 'מחזור אחד' : `${count} מחזורים`);

export const builder: BuilderMessages = {
  builderCommon: {
    filterInstructions: 'מקלידים כדי לסנן הוראות',
    filter: 'מקלידים כדי לסנן',
    runOrAdd: 'Enter: הרצה עכשיו · Shift+Enter: הוספה לתוכנית',
    pickLine: 'בוחרים שורה לקפוץ אליה, או מקלידים את המספר שלה',
    jumpTo: 'קפיצה לשורה בתוכנית',
    branchTo: 'הסתעפות לשורה בתוכנית',
    endOfProgram: 'סוף התוכנית'
  },
  builderX86: {
    repeatPrefix: 'קידומת חזרה',
    prefixHint: (description) => `${description}. אחר כך בוחרים את הוראת המחרוזת.`,
    addressInRegister: 'כתובת ברגיסטר',
    directAddress: 'כתובת ישירה',
    immediate: (bits) => `Immediate (${bits} סיביות)`,
    count: 'מונה',
    lineNumber: 'מספר של שורה בתוכנית',
    byteRegisters: 'רגיסטרים של 8 סיביות',
    segmentRegisters: 'רגיסטרי segment',
    wordRegisters: 'רגיסטרים של 16 סיביות',
    memory: 'זיכרון',
    memoryHint: (bits) => `ערך של ${bits} סיביות בזיכרון`,
    pickString: 'בוחרים את הוראת המחרוזת שתחזור על עצמה',
    pickAddress: 'בוחרים רגיסטר או מקלידים offset (למשל 0x10)',
    tooBig: (text, bits) => `${text} לא נכנס ב-${bits} סיביות`,
    typeNumber: 'מקלידים מספר: 42 (עשרוני), 0x2A או 2Ah (הקס), 101010b (בינארי)'
  },
  builderRv32: {
    immediates: {
      imm12: '12 סיביות, \u200e-2048 עד 2047',
      shamt: 'כמות הזזה, 0 עד 31',
      imm20: '20 הסיביות העליונות, 0 עד 0xFFFFF',
      imm32: 'כל ערך של 32 סיביות',
      mem: 'offset של 12 סיביות, \u200e-2048 עד 2047'
    },
    roles: {
      special: 'מיוחדים: אפס, כתובת חזרה, מחסנית, מצביעים גלובלי ושל thread',
      argument: 'ארגומנטים וערכי החזרה (a0–a7)',
      temporary: 'זמניים (t0–t6)',
      saved: 'נשמרים בין קריאות לפונקציות (s0–s11)'
    },
    withFormat: (description, format) => `${description} (${format}-type)`,
    pseudo: 'פסאודו-הוראות: האסמבלר הופך כל אחת להוראות אמיתיות',
    zero: 'x0: תמיד נקרא כ-0; כתיבה אליו לא משפיעה',
    offset: 'Offset מרגיסטר בסיס',
    offsetHint: 'אחר כך בוחרים את הרגיסטר שה-offset מתווסף אליו',
    immediate: (range) => `Immediate (${range})`,
    pickBase: 'בוחרים את רגיסטר הבסיס שה-offset מתווסף אליו',
    tooBig: (text, range) => `${text} לא נכנס: ${range}`,
    typeOffset: 'מקלידים offset (למשל 8 או \u200e-4), או בוחרים את רגיסטר הבסיס',
    pickRegister: 'בוחרים רגיסטר, או מקלידים את השם שלו (a0, t1, sp…)',
    typeNumber: 'מקלידים מספר: 42 (עשרוני), \u200e-5, 0x2A או 101010b',
    becomes: (instructions) => `הופכת ל-${instructions.join(', ואז ')}`
  },
  builder6502: {
    cycles: (count, pageCross) => `${cycles(count)}${pageCross ? ', \u200f+1 בחציית עמוד' : ''}`,
    meanings: {
      imm: (value) => `הערך ${value} עצמו`,
      zp: (address) => `הבית ב-${address}, ב-zero page: בית אחד קצר יותר מ-absolute`,
      zpx: (address) => `הבית ב-${address} + X, בגלגול בתוך ה-zero page`,
      zpy: (address) => `הבית ב-${address} + Y, בגלגול בתוך ה-zero page`,
      abs: (address) => `הבית ב-${address}`,
      abx: (address) => `הבית ב-${address} + X`,
      aby: (address) => `הבית ב-${address} + Y`,
      ind: (address) => `קפיצה לכתובת השמורה ב-${address}`,
      izx: (address) => `הבית בכתובת השמורה ב-${address} + X ב-zero page`,
      izy: (address) => `הבית בכתובת השמורה ב-${address}, ועוד Y`
    },
    accumulator: 'Accumulator',
    aItself: (count) => `A עצמו · ${count}`,
    fitsNone: (text, mnemonic) => `${text} לא מתאים לאף שיטת מיעון של ${mnemonic}`,
    pickLine: 'בוחרים שורה, או מקלידים את המספר שלה',
    typeNumber: (accumulator) =>
      `מקלידים מספר ($2A, 42, 0x2A): כל שיטת מיעון שהוא מתאים לה מוצעת${accumulator ? ', או בוחרים a בשביל A' : ''}`,
    modes: (description, modes) => `${description}. שיטות מיעון: ${modes}`,
    withOpcode: (description, mode, opcode, count) =>
      `${description} · ${mode}, opcode ${opcode}, ${count}`
  }
};

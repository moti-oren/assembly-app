import type { ExplainRv32Messages } from '../en/explainRv32';

const cycles = (count: number) => (count === 1 ? 'מחזור אחד' : `${count} מחזורים`);
const accessWord = (access: 'load' | 'store') => (access === 'load' ? 'תטען' : 'תשמור');

export const explainRv32: ExplainRv32Messages = {
  rv32Explain: {
    encodingSummary: (format, address, where) =>
      `${format}-type, \u200f4 בתים ב-${address}, ${where}`,
    nothing: 'כלום',
    fetch: (pc, line, word, next) =>
      `PC הוא ${pc}, המקום שבו ${line} מתחילה. ה-CPU קורא את המילה של 4 הבתים שם, ${word}, ו-PC מתקדם ל-${next} לפני שמשהו רץ.`,
    sizes: { 1: 'בית', 2: 'חצי מילה', 4: 'מילה' },
    kind: (category, format, description) => `${category}, ${format}-type: ${description}.`,
    fields: (fields) => `שדות הרגיסטרים אומרים ${fields}.`,
    immediate: (hex, decimal) => `ה-immediate הוא ${hex} (${decimal}).`,
    willRead: (items) => `היא תקרא את ${items}.`,
    willAccess: (access, size) => `היא ${accessWord(access)} ${size}.`,
    willWrite: (items) => `היא תכתוב ל-${items}.`,
    branch: 'אם היא תקפוץ תלוי בהשוואה.',
    jump: 'היא תמיד קופצת.',
    memory: 'הזיכרון',
    device: 'התקן',
    changed: (items) => `היא שינתה את ${items}.`,
    changedNothing: 'היא לא שינתה אף רגיסטר או זיכרון.',
    direct: 'הורצה ישירות, ולכן שום דבר לא נקרא מהתוכנית.',
    jumped: (pc) => `היא קפצה: PC עכשיו ${pc}.`,
    nextLine: (pc) => `PC ב-${pc}, השורה הבאה.`,
    notes: {
      srl: 'ממלא באפסים',
      sra: 'שומר על הסימן',
      slt: 'עם סימן: 1 אם נכון, אחרת 0',
      sltu: 'ללא סימן: 1 אם נכון, אחרת 0',
      mul: '32 הסיביות הנמוכות',
      mulh: 'עם סימן, 32 הסיביות הגבוהות',
      mulhsu: 'עם סימן × ללא סימן, 32 הסיביות הגבוהות',
      mulhu: 'ללא סימן, 32 הסיביות הגבוהות',
      div: 'עם סימן',
      divu: 'ללא סימן',
      rem: 'עם סימן',
      remu: 'ללא סימן'
    },
    into: (register) => `אל ${register}`,
    theAddress: 'הכתובת',
    jumpTarget: 'יעד הקפיצה',
    bitForBit: 'סיבית מול סיבית',
    asSigned: 'כמספרים עם סימן',
    asUnsigned: 'כמספרים ללא סימן',
    taken: (at) => `נכון: קפצה ל-${at}`,
    notTaken: (at) => `לא נכון: המשיכה ל-${at}`,
    devices: {
      leds: 'הנורות',
      switches: 'המתגים',
      leftDigit: 'הספרה השמאלית',
      rightDigit: 'הספרה הימנית',
      terminal: 'המסוף',
      other: 'התקן'
    },
    inCode: 'בתוך הקוד',
    stored: (size, value, where) => `שמרה את ה${size} ${value} ב-${where}`,
    loaded: (size, value, where) => `טענה את ה${size} ${value} מ-${where}`
  },
  datapath: {
    idle: 'לא פעיל',
    direct: 'הורצה ישירות: שום דבר לא נקרא',
    sources: {
      alu: 'התוצאה של ה-ALU',
      memory: 'הערך שנטען',
      link: 'הקישור, PC + 4',
      immediate: 'ה-immediate העליון'
    },
    willAccess: (access) => (access === 'load' ? 'תטען' : 'תשמור'),
    depends: 'תלוי בהשוואה',
    jumps: 'קופצת'
  },
  pipelineNotes: {
    pastEnd: 'אחרי הסוף',
    load: (source) => `הטעינה ב-${source} מקבלת אותו רק אחרי MEM`,
    noForwarding: (source) => `ה-forwarding כבוי, ולכן ${source} חייבת קודם לכתוב אותו לרגיסטר`,
    waits: (row, count, register, why) =>
      `${row} ממתינה ${cycles(count)} ב-ID ל-${register}: ${why}.`,
    flushes: (row) => `${row} משנה את PC ב-EX: שתי ההוראות שנקראו אחריה נזרקות (flush).`,
    instructions: (count) => (count === 1 ? 'הוראה אחת' : `${count} הוראות`),
    fill: '4 למילוי ה-pipeline',
    stalled: (count) => `${count} ב-stall`,
    flushed: (count) => `${count} שאבדו ל-flushes`,
    summary: (count, parts, cpi) => `${cycles(count)} = ${parts} · ${cpi} מחזורים להוראה`
  }
};

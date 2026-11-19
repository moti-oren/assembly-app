import type { ExplainX86Messages } from '../en/explainX86';

/** "a, b ו-c": the last item joins with ו, written with a hyphen before Latin text or a number. */
const list = (items: readonly string[]) => {
  if (items.length <= 1) return items.join('');
  const last = items.at(-1)!;
  const and = /^[A-Za-z0-9$]/.test(last) ? 'ו-' : 'ו';
  return `${items.slice(0, -1).join(', ')} ${and}${last}`;
};

export const explainX86: ExplainX86Messages = {
  common: {
    list,
    // Isolated, so its commas and order stay as written inside a right-to-left sentence.
    code: (text) => `\u2066${text}\u2069`,
    sentences: (parts) => parts.filter((part) => typeof part === 'string' && part !== '').join(' '),
    bytes: (count) => (count === 1 ? 'בית אחד' : `${count} בתים`),
    where: {
      draft: 'בתור השורה הבאה של התוכנית',
      line: (line) => `שורה ${line}`,
      lastLine: (line) => `שורה ${line}, האחרונה שרצה`,
      last: 'ההוראה האחרונה שרצה'
    }
  },
  x86Encoding: {
    summary: (bytes, offset, where) => `${bytes} ב-offset ${offset}, ${where}`,
    fields: {
      prefix: 'קידומת',
      opcode: 'Opcode',
      modrm: 'ModR/M',
      displacement: 'Displacement',
      immediate: 'Immediate',
      relative: 'מרחק'
    }
  },
  x86Cycle: {
    fetch: (line, next) =>
      `IP מצביע על ${line}. השורה הזו נקראת מהתוכנית, ו-IP מתקדם ל-${next} לפני שמשהו רץ.`,
    kind: (category, size, description) =>
      `${category}${size ? `, ${size} סיביות` : ''}: ${description}.`,
    roles: {
      destination: 'היעד',
      source: 'המקור',
      count: 'המונה',
      target: 'היעד לקפיצה',
      vector: 'הווקטור',
      operand: 'האופרנד'
    },
    operand: (text, role, kind) => `${text} הוא ${role} (${kind})`,
    here: (operands) => `כאן ${operands}.`,
    willRead: (items) => `היא תקרא את ${items}.`,
    willWrite: (items) => `היא תכתוב ל-${items}.`,
    memory: 'הזיכרון',
    port: 'פורט I/O',
    flags: 'הדגלים',
    changed: (items) => `היא שינתה את ${items}.`,
    changedNothing: 'היא לא שינתה אף רגיסטר, דגל או זיכרון.',
    interrupt: (vector) => `היא נכנסה לפסיקה ${vector}.`,
    direct: 'הורצה ישירות, ולכן שום דבר לא נקרא מהתוכנית.',
    jumped: (next) => `היא קפצה: IP עכשיו ${next}.`,
    nextLine: (next) => `IP ב-${next}, השורה הבאה.`
  },
  x86Notes: {
    aluFetching: 'ממתין: ההוראה עדיין בשלב ה-fetch.',
    aluSelected: 'נבחר. האופרנדים נכנסים כשההוראה מתבצעת.',
    notNeeded: (mnemonic) => `${mnemonic} לא צריכה אותו.`,
    aluIdle: 'מריצים הוראה כדי לראות איך התוצאה שלה מחושבת.',
    aluComputed: 'חושב כאן. התוצאה ברגיסטרים המודגשים.',
    notUsed: (mnemonic) => `${mnemonic} לא השתמשה בו.`,
    adderFetching: 'לא פעיל: התוכנית לא שמורה כאן בזיכרון, ולכן ה-fetch של שורה לא יוצר כתובת.',
    adderSelected: 'נבחר. הוא יהפוך את segment:offset לכתובת של 20 סיביות.',
    portNotNeeded: 'לא נדרש: מספר פורט עובר בערוץ כמו שהוא.',
    adderIdle: 'הופך את segment:offset לכתובת של 20 סיביות שעוברת בערוץ.',
    portNotUsed: 'לא היה בשימוש: מספר פורט עובר בערוץ כמו שהוא.',
    noMemory: (mnemonic) => `לא היה בשימוש: ${mnemonic} לא נגעה בזיכרון.`,
    readWritten: 'ייקרא וייכתב',
    written: 'ייכתב',
    read: 'ייקרא',
    unused: 'לא בשימוש',
    busMemory: (address, data) => `כתובת ${address}, נתון ${data}`,
    busPort: (port, data) => `פורט ${port}, נתון ${data}`
  }
};

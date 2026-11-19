import type { AppMessages } from '../en/app';

const lineCount = (lines: number) => (lines === 1 ? 'השורה היחידה' : `כל ${lines} השורות`);
const instructionCount = (count: number) => (count === 1 ? 'הוראה אחת' : `${count} הוראות`);

export const app: AppMessages = {
  language: {
    switch: 'החלפת הממשק לאנגלית',
    label: 'שפה'
  },
  header: {
    architecture: 'ארכיטקטורה',
    commands: 'פקודות',
    compare: 'השוואה',
    compareLabel: 'השוואת המעבדים',
    compareHint: 'אותה משימה בשלושת המעבדים, זה לצד זה',
    examples: 'דוגמאות',
    examplesHint: 'מחליפה את התוכנית שלך ומאפסת את ה-CPU ואת ההיסטוריה שלו',
    settings: 'הגדרות',
    sound: 'צליל',
    darkTheme: 'ערכת נושא כהה',
    reduceAnimations: 'הפחתת אנימציות'
  },
  palette: {
    title: 'פקודות',
    description: 'חיפוש של משהו לעשות',
    search: 'חיפוש פקודות',
    empty: 'אין פקודה שמתאימה.',
    move: 'מעבר',
    run: 'הפעלה',
    close: 'סגירה'
  },
  commandGroups: {
    program: 'תוכנית',
    history: 'היסטוריה',
    cpu: 'CPU',
    devices: 'התקנים',
    runSpeed: 'מהירות הרצה',
    examples: 'דוגמאות',
    preferences: 'העדפות'
  },
  commands: {
    writeInstruction: 'כתיבת הוראה',
    stepLine: 'צעד של שורה אחת',
    stepPhase: 'צעד של שלב אחד (fetch,\u200f decode,\u200f execute)',
    pause: 'השהיה',
    run: 'הרצת התוכנית',
    addAtEnd: 'הוספת שורות חדשות בסוף',
    clearProgram: 'מחיקת התוכנית…',
    machineCode: (shown) => (shown ? 'הסתרת קוד המכונה' : 'הצגת קוד המכונה'),
    undo: 'ביטול',
    redo: 'ביצוע מחדש',
    toStart: 'חזרה להתחלה',
    toLatest: 'מעבר להוראה האחרונה',
    historyList: (shown) => (shown ? 'הסתרת רשימת ההיסטוריה' : 'הצגת רשימת ההיסטוריה'),
    reset: 'איפוס ה-CPU ומחיקת ההיסטוריה',
    stackTop: 'הצגת ראש המחסנית בזיכרון',
    lastAccess: 'הצגת הגישה האחרונה לזיכרון',
    devices: (shown) => (shown ? 'הסתרת התקני ה-I/O' : 'הצגת התקני ה-I/O'),
    switchTo: (architecture) => `מעבר ל-${architecture}`,
    compare: 'השוואת המעבדים על אותה משימה…',
    loadExample: (name) => `טעינת "${name}"`,
    theme: (dark) => (dark ? 'מעבר לערכת נושא בהירה' : 'מעבר לערכת נושא כהה'),
    sound: (on) => (on ? 'כיבוי הצליל' : 'הפעלת הצליל'),
    motionBySystem: 'האנימציות מופחתות על ידי המערכת',
    motion: (reduced) => (reduced ? 'אנימציות מלאות' : 'הפחתת אנימציות'),
    resetCardOrder: 'איפוס סדר הכרטיסיות',
    pipeline: (shown) => (shown ? 'הסתרת ה-pipeline' : 'הצגת ה-pipeline'),
    forwarding: (on) => (on ? 'כיבוי ה-forwarding ב-pipeline' : 'הפעלת ה-forwarding ב-pipeline')
  },
  cpuView: {
    label: 'תצוגת ה-CPU',
    diagram: 'הצגת ה-CPU כתרשים',
    table: 'הצגת ה-CPU כטבלאות'
  },
  speeds: {
    slow: 'איטית',
    normal: 'רגילה',
    fast: 'מהירה',
    instant: 'מיידית'
  },
  clearDialog: {
    title: (lines) => `למחוק את ${lineCount(lines)}?`,
    description: 'אי אפשר לשחזר את התוכנית עם ביטול.',
    keep: 'השארת התוכנית',
    confirm: 'מחיקת התוכנית'
  },
  resetDialog: {
    title: 'לאפס את ה-CPU?',
    description: (instructions) =>
      `הרגיסטרים, הדגלים והזיכרון חוזרים לערכי ההתחלה שלהם, וההיסטוריה נמחקת (${instructionCount(instructions)}). התוכנית נשארת. אי אפשר לבטל את זה.`,
    keep: 'השארת המצב הנוכחי',
    confirm: 'איפוס ה-CPU'
  },
  appError: {
    title: 'משהו השתבש בתוך האפליקציה.',
    body: 'אפשר לבטל או לאפס כדי להמשיך. פרטים:',
    dismiss: 'סגירה'
  },
  transport: {
    controls: 'פקדי התוכנית וההיסטוריה',
    step: 'צעד',
    phaseLabel: (phase) => `צעד: ${phase}`,
    phaseHint: 'צעד של שלב אחד בשורה הבאה: fetch, אחריו decode ואז execute',
    pause: 'השהיה',
    run: 'הרצה',
    runProgram: 'הרצת התוכנית',
    speed: 'מהירות:',
    speedLabel: (speed) => `מהירות הרצה: ${speed}`,
    reset: 'איפוס',
    resetLabel: 'איפוס ה-CPU',
    resetHint: 'מוחק את הרגיסטרים, הדגלים, הזיכרון וההיסטוריה. התוכנית נשארת.',
    undo: 'ביטול ההוראה האחרונה',
    redo: 'ביצוע מחדש של ההוראה שבוטלה',
    seek: 'מעבר בין ההוראות שרצו',
    position: (run, total) => `${run} מתוך ${total} הוראות רצו`,
    panels: 'חלוניות',
    history: 'היסטוריה',
    devices: 'I/O',
    machineCode: 'קוד מכונה'
  },
  panels: {
    names: {
      builder: 'הוראה',
      program: 'תוכנית',
      history: 'היסטוריה',
      encoding: 'קוד מכונה',
      cpu: 'CPU',
      cycle: 'מחזור',
      registers: 'רגיסטרים',
      operation: 'הפעולה האחרונה',
      flags: 'דגלים',
      devices: 'התקני I/O',
      memory: 'זיכרון'
    },
    mos6502Operation: 'ALU ומחזורי שעון',
    rv32Operation: 'ALU',
    rv32Flags: 'אין דגלים',
    moveCard: (card) => `הזזת הכרטיסייה ${card}`,
    dragHint: 'גוררים כדי להזיז את הכרטיסייה בתוך העמודה שלה',
    keyHint: 'אפשר לגרור אותה, או להזיז אותה בתוך העמודה בעזרת מקשי החיצים למעלה ולמטה.',
    moved: (card, position, count) => `${card} הועברה למקום ${position} מתוך ${count}`
  }
};

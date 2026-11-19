import type { ArchitectureMessages } from '../en/architectures';

export const architectures: ArchitectureMessages = {
  rv32: {
    cycleIntro:
      'כל הוראה עוברת fetch, אחר כך decode ואז execute. הוראת RISC-V היא תמיד מילה אחת של 4 בתים, ולכן PC מתקדם ב-4. הכפתור Fetch שלמטה מעביר שורה דרך שלושת השלבים.',
    cycleView: {
      label: 'תצוגת המחזור',
      single: 'אחת אחת',
      singleHint: 'הצגת המחזור של הוראה אחת',
      pipeline: 'Pipeline',
      pipelineHint: 'הצגת ה-pipeline'
    },
    memoryIntro:
      'מרחב אחד שטוח של כתובות של 32 סיביות: RAM החל מ-0x00000000 (הקוד בתחילתו), וההתקנים ב-0x10000000. נקודות מסמנות כתובות שאין אליהן שום דבר מחובר.',
    noFlags: 'אין דגלים',
    noFlagsBefore: 'ל-RISC-V אין דגלים. הוראת הסתעפות משווה בעצמה בין שני רגיסטרים',
    noFlagsMiddle: ', והוראת',
    noFlagsAfter: 'שמה את התשובה של השוואה, 1 או 0, ברגיסטר.',
    compared: (how) => `השוואה ${how}`,
    comparedNothing: 'ההוראה האחרונה לא השוותה כלום.',
    runBranch: 'מריצים הוראת הסתעפות כדי לראות מה היא משווה.',
    registerFile: 'קובץ הרגיסטרים',
    stages: {
      fetch: 'Fetch',
      decode: 'Decode',
      execute: 'Execute',
      memory: 'Memory',
      writeBack: 'Write back',
      nextPc: 'Next PC'
    },
    encodingEmpty: 'בונים הוראה, או מוסיפים אחת לתוכנית, כדי לראות את 32 הסיביות שהיא הופכת אליהן.',
    bits: '32 הסיביות של ההוראה',
    lowByteFirst: 'נשמרת מהבית הנמוך:',
    bitRange: (high, low) => (high === low ? `סיבית ${high}` : `סיביות ${high}–${low}`),
    roles: {
      special: 'מיוחדים',
      argument: 'ארגומנטים',
      temporary: 'זמניים',
      saved: 'שמורים'
    },
    roleHints: {
      special: 'zero תמיד קורא 0; ra מחזיק את כתובת החזרה, ו-sp את ראש המחסנית',
      argument: 'הארגומנטים של קריאה לפונקציה, והתוצאות שלה ב-a0 וב-a1. קריאה עלולה לשנות אותם',
      temporary: 'חופשיים לשימוש; קריאה לפונקציה עלולה לשנות אותם',
      saved: 'פונקציה שמשתמשת בהם חייבת להחזיר אותם לקדמותם לפני שהיא חוזרת'
    },
    unsigned: (value) => `${value} ללא סימן`,
    pcHint: 'מונה התוכנית: הכתובת של ההוראה הבאה. הוא אינו אחד מ-32 הרגיסטרים.',
    pipeline: {
      title: 'Pipeline',
      about: 'על ה-pipeline',
      intro:
        'מעבד עם pipeline עובד על חמש הוראות בבת אחת, כל אחת בשלב אחר. צועדים או מריצים את התוכנית: כל הוראה מופיעה כאן, מחזור אחרי מחזור, עם ה-stalls וה-flushes שהחפיפה עולה.',
      stages: {
        IF: 'קריאת ההוראה',
        ID: 'פענוח שלה וקריאת הרגיסטרים שלה',
        EX: 'חישוב ב-ALU; כאן הסתעפויות מחליטות',
        MEM: 'טעינה או שמירה בזיכרון',
        WB: 'כתיבת התוצאה לרגיסטר'
      },
      forwardingHint: 'העברת תוצאה ישר להוראה הבאה, לפני שהיא נכתבת לרגיסטר',
      forwarding: (on) => `Forwarding ${on ? 'פעיל' : 'כבוי'}`,
      cycle: 'מחזור',
      flushed: '(flushed)',
      waiting: '(ממתינה)',
      newest: 'ההוראה האחרונה שרצה'
    }
  },
  mos6502: {
    cycleIntro:
      'כל הוראה עוברת fetch, אחר כך decode ואז execute. ה-opcode, בית אחד, קובע גם את ההוראה וגם את שיטת המיעון שלה; אחריו ה-6502 קורא עוד 0 עד 2 בתים. הכפתור Fetch שלמטה מעביר שורה דרך השלבים.',
    memoryIntro:
      '64K כתובות של 16 סיביות: ה-zero page ב-$0000, המחסנית בעמוד $01, הקוד החל מ-$0600, ההתקנים ב-$D000 והווקטורים ב-$FFFA.',
    eightBit: '8 סיביות',
    pcNote: 'מונה התוכנית',
    addressUnit: 'יחידת הכתובות',
    dataBus: 'אפיק הנתונים',
    dataBusTag: 'זיכרון · התקנים',
    cycles: 'מחזורי שעון',
    clock: 'שעון',
    encodingEmpty: 'בונים הוראה, או מוסיפים אחת לתוכנית, כדי לראות לאילו בתים היא הופכת.',
    fields: {
      opcode: 'Opcode',
      value: 'Immediate',
      address: 'כתובת',
      low: 'בית נמוך',
      high: 'בית גבוה',
      offset: 'מרחק',
      signature: 'חתימה'
    },
    flagsIntro: 'P, רגיסטר המצב. סיבית 5 תמיד נקראת 1; הדגל B קיים רק בעותק ש-BRK ו-PHP דוחפות.',
    flagsList: 'הדגלים ב-P, מסיבית 7 עד סיבית 0',
    because: 'כי',
    noFlagSet: (instruction) => `${instruction} לא קבעה אף דגל.`,
    runForFlags: 'מריצים הוראה כדי לראות למה היא קבעה את הדגלים שלה כפי שקבעה.',
    nextFree: 'המקום הפנוי הבא',
    registerHints: {
      a: 'הצובר (Accumulator): הרגיסטר היחיד שה-ALU מחבר אליו, עושה איתו AND ומשווה אליו',
      x: 'רגיסטר אינדקס: סופר, ומתווסף לכתובת ($nn,X, ($nn,X))',
      y: 'רגיסטר אינדקס: סופר, ומתווסף לכתובת ($nn,Y, ($nn),Y)',
      sp: 'מצביע המחסנית: הבית הנמוך של המקום הפנוי הבא בעמוד $01',
      pc: 'מונה התוכנית: הכתובת של 16 סיביות של ההוראה הבאה'
    }
  },
  compare: {
    title: 'השוואת המעבדים',
    description: 'משימה אחת, כתובה לכל מעבד: כמה גדולה התוכנית שלו, ומה ההרצה שלה דורשת.',
    task: 'משימה',
    measure: 'מדד',
    fewest: '(הכי מעט)',
    program: (architecture) => `התוכנית של ${architecture}`,
    leaves: 'משאירה',
    load: (architecture) => `טעינה ל-${architecture}`,
    loadNote: 'טעינת תוכנית מחליפה את התוכנית של אותו מעבד ומוחקת את ההיסטוריה שלו, כמו דוגמה.'
  }
};

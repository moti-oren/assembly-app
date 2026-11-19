import type { PanelMessages } from '../en/panels';

const placeName = (place: 'port' | 'address') => (place === 'port' ? 'פורט' : 'כתובת ההתקן');

export const panels: PanelMessages = {
  program: {
    title: 'תוכנית',
    empty: 'אין עדיין שורות',
    finished: 'הסתיימה',
    next: (line) => `הבאה: ${line}`,
    clear: 'מחיקת התוכנית',
    lines: 'שורות התוכנית',
    insertHere: 'שורות חדשות נכנסות כאן ·',
    addAtEnd: 'להוסיף בסוף במקום זאת',
    ranLast: 'רצה אחרונה',
    offset: (value) => `ב-offset ${value}`,
    address: (value) => `בכתובת ${value}`,
    codeAt: (place) => `קוד המכונה ${place}. לחיצה מפרקת אותו לשדות.`,
    insertAbove: 'הוספת שורות חדשות מעל השורה הזו',
    remove: 'מחיקת השורה',
    end: 'סוף התוכנית',
    startBefore: 'בונים הוראה ולוחצים',
    startMiddle: 'כדי להוסיף אותה כשורה, או',
    startLink: 'מתחילים מדוגמה',
    startAfter: '.'
  },
  history: {
    title: 'היסטוריה',
    about: 'על ההיסטוריה',
    intro: 'כל הוראה שמריצים מופיעה כאן. בחירה בהוראה מחזירה לרגע שאחרי שהיא רצה.',
    empty: 'עוד לא רץ כלום',
    executed: (count) => (count === 1 ? 'הוראה אחת רצה' : `${count} הוראות רצו`),
    position: (at, total) => `${at} מתוך ${total}`,
    hidden: (count) =>
      count === 1 ? 'הוראה מוקדמת אחת לא מוצגת.' : `${count} הוראות מוקדמות לא מוצגות.`,
    direct: 'ישירה',
    directHint: 'הורצה מהבונה, לא מהתוכנית'
  },
  builder: {
    title: 'הוראה',
    removeWord: 'הסרת המילה הזו ואלה שאחריה',
    ready: 'מוכנה להרצה',
    input: 'הוראה',
    clear: 'ניקוי ההוראה',
    enterPicks: 'Enter בוחר באפשרות הזו',
    noMatchBefore: 'שום דבר לא מתאים ל-',
    noMatchPress: '. לוחצים על',
    noMatchEdit: 'כדי לערוך, או על',
    noMatchAfter: 'כדי להתחיל מחדש.',
    showChoices: 'הצגת האפשרויות',
    complete: 'ההוראה שלמה. אפשר להריץ אותה עכשיו, או להוסיף אותה לתוכנית בשורה',
    addAt: (line) => `הוספה ב-${line}`,
    runNow: 'הרצה עכשיו',
    keys: {
      move: 'מעבר',
      run: 'הרצה עכשיו',
      add: 'הוספה',
      pick: 'בחירה',
      clear: 'ניקוי'
    }
  },
  cycle: {
    title: 'מחזור',
    about: 'על מחזור ההוראה',
    phases: 'מחזור ההוראה',
    idle: 'ממתין',
    nothingYet: 'עוד לא רץ כלום.',
    x86Intro:
      'כל הוראה עוברת fetch, אחר כך decode ואז execute. הכפתור Fetch שלמטה מעביר שורה מהתוכנית דרך שלושת השלבים, שלב אחרי שלב.'
  },
  changes: {
    none: 'מריצים הוראה כדי לראות מה היא משנה',
    nothing: 'לא שינתה כלום',
    writtenSame: '(נכתב, הערך לא השתנה)'
  },
  operation: {
    flagsOnly: 'רק הדגלים נשמרים',
    into: (destination) => `אל ${destination}`,
    none: 'מריצים הוראה כדי לראות איך התוצאה שלה חושבה.',
    aluUnused: 'ה-ALU לא היה בשימוש.'
  },
  flags: {
    title: 'דגלים',
    value: (flag, value) => `הדגל ${flag} הוא ${value}`,
    unchanged: (flag) => `${flag} לא השתנה`
  },
  memory: {
    title: 'זיכרון',
    about: 'על הזיכרון',
    x86Intro: 'מצביעים על בית, או מריצים הוראה שניגשת לזיכרון, כדי לראות איך הכתובת שלו נוצרת.',
    segment: 'Segment',
    offset: 'Offset',
    offsetInput: 'Offset (הקס)',
    stackTop: 'ראש המחסנית',
    badOffset: (text) => `“${text}” אינו offset בהקס (משתמשים ב-0–9 וב-A–F, למשל 1F0). מוצג 0000.`,
    thisByte: 'הבית הזה',
    lastWrite: 'כתיבה אחרונה',
    lastRead: 'קריאה אחרונה',
    shifted: (segment) => `${segment} מוזז 4 סיביות שמאלה`,
    wraps: 'עובר את 1MB ומתגלגל אל',
    wraps64k: (sum) => `${sum}, מתגלגל ב-64K`,
    showInTable: 'הצגה בטבלה',
    physical: (address, value) => `כתובת פיזית ${address}h = ${value}`,
    blue: 'כחול',
    blueMeans: 'קוד המכונה של התוכנית,',
    amber: 'ענבר',
    amberMeans: 'רגיסטרים של התקנים.',
    goTo: 'מעבר אל',
    places: {
      code: 'קוד',
      data: 'נתונים',
      stack: 'מחסנית',
      devices: 'התקנים',
      zeroPage: 'Zero page',
      vectors: 'וקטורים'
    },
    addressInput: 'כתובת (הקס)',
    addressColumn: 'כתובת',
    badAddress: (text, zero) => `“${text}” אינה כתובת בהקס (משתמשים ב-0–9 וב-A–F). מוצג ${zero}.`,
    unwired: (address) => `${address}: אין כאן שום דבר מחובר`,
    byte: (address, value, region) =>
      `${address} = ${value}${region === 'code' ? ', קוד מכונה' : region === 'device' ? ', התקן' : ''}`
  },
  devices: {
    title: 'התקני I/O',
    about: 'על ההתקנים',
    writes: (place) =>
      place === 'port' ? 'כותבת להתקן דרך פורט,' : 'כותבת להתקן דרך כתובת בזיכרון,',
    reads: 'קוראת ממנו.',
    leds: 'נורות',
    led: (bit, on) => `נורה ${bit} ${on ? 'דולקת' : 'כבויה'}`,
    bit: (bit) => `סיבית ${bit}`,
    switches: 'מתגים',
    switch: (bit) => `מתג ${bit}`,
    display: 'תצוגת 7 מקטעים',
    segments: '7 מקטעים',
    digit: (place, at, value) => `הספרה ב${placeName(place)} ${at} מציגה ${value}`,
    digitTitle: (value, place, at) =>
      `${value}, נכתב ל${placeName(place)} ${at}. סיביות 0 עד 7 מדליקות את a,‏ b,‏ c,‏ d,‏ e,‏ f,‏ g ואת הנקודה.`,
    terminal: 'מסוף',
    terminalEmpty: 'כל בית שנכתב לכאן מודפס כתו.'
  },
  registers: {
    title: 'רגיסטרים',
    changed: 'השתנה בהוראה האחרונה',
    writtenSame: 'נכתב, אותו ערך',
    name: 'רגיסטר',
    hex: 'הקס',
    decimal: 'עשרוני',
    unsigned: 'ללא סימן',
    signed: 'עם סימן',
    binary: 'בינארי',
    both: (unsigned, signed) => `${unsigned} ללא סימן, ${signed} עם סימן`
  },
  encoding: {
    title: 'קוד מכונה',
    fields: 'השדות של ההוראה',
    x86Empty: 'בונים הוראה, או מוסיפים אחת לתוכנית, כדי לראות לאילו בתים היא מתורגמת.'
  },
  diagram: {
    read: 'נקרא',
    written: 'נכתב',
    internalBus: 'האפיק הפנימי',
    biu: 'יחידת ממשק האפיק',
    eu: 'יחידת הביצוע',
    adder: 'מחבר הכתובות',
    address20: 'כתובת של 20 סיביות',
    bus: 'אפיק כתובות / נתונים',
    memory: 'זיכרון',
    ports: 'פורטי I/O',
    wrote: 'כתב',
    readValue: 'קרא',
    to: 'אל',
    from: 'מ-',
    toPort: 'אל פורט',
    fromPort: 'מפורט'
  }
};

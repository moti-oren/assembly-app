import type { ArchitectureId } from '../../architectures';

interface ExampleText {
  name: string;
  description: string;
}

/** The example programs, by architecture and by the id each has in the core. */
export const EXAMPLE_TEXTS: Record<ArchitectureId, Record<string, ExampleText>> = {
  x86: {
    sum: { name: 'סכום 1 עד 10', description: 'LOOP סופרת את CX למטה; בסוף AX הוא 55' },
    max: {
      name: 'המקסימום של AX, BX',
      description: 'CMP וקפיצה מותנית עם סימן; בסוף DX הוא הערך הגדול'
    },
    call: {
      name: 'קריאה לתת-שגרה',
      description: 'CALL דוחפת את שורת החזרה, ו-RET שולפת אותה חזרה אל IP'
    },
    swap: {
      name: 'החלפה דרך המחסנית',
      description: 'PUSH/POP בסדר הפוך מחליפות בין AX ל-BX'
    },
    'fill-copy': {
      name: 'מילוי והעתקה של מחרוזת',
      description: 'REP STOSB ממלאת 8 בתים ב-DS:0000, ו-REP MOVSB מעתיקה אותם אל DS:0010'
    },
    'running-light': {
      name: 'אור רץ',
      description: 'OUT שולחת סיבית 1 בודדת אל הנורות בפורט 10h, מוזזת שמאלה 8 פעמים'
    },
    switches: {
      name: 'מתגים, ספרות ומסוף',
      description: 'IN קוראת את המתגים; OUT מעתיקה אותם אל הנורות ואל ספרה, ואז מדפיסה HI'
    },
    interrupt: {
      name: 'פסיקת תוכנה',
      description: 'מתקינה מטפל בווקטור 21h, ואז INT 21h מדפיסה את AL במסוף פעמיים'
    }
  },
  rv32: {
    sum: {
      name: 'סכום 1 עד 10',
      description: 'אין הוראת LOOP: t0 סופר למטה ו-BNEZ קופצת חזרה עד שהוא 0; בסוף a0 הוא 55'
    },
    max: {
      name: 'המקסימום של a0, a1',
      description: 'אין דגלים: BGE משווה בעצמה בין שני הרגיסטרים; בסוף a2 הוא הערך הגדול'
    },
    call: {
      name: 'קריאה לפונקציה',
      description: 'JAL שומרת את כתובת החזרה ב-ra, לא במחסנית; RET קופצת אליה בחזרה'
    },
    swap: {
      name: 'החלפה דרך המחסנית',
      description: 'אין PUSH או POP: מזיזים את sp בעצמנו, ואז שומרים וטוענים מילים; a0 ו-a1 מתחלפים'
    },
    constants: {
      name: 'בניית קבועים של 32 סיביות',
      description:
        'ל-immediate יש 12 סיביות, ולכן LI הופכת ל-LUI + ADDI. ADDI מרחיבה סימן, ולכן 0x12345FFF דורש LUI 0x12346'
    },
    'fill-copy': {
      name: 'מילוי והעתקה של בתים',
      description:
        'אין הוראות מחרוזת: לולאות של SB ו-LBU ממלאות 8 בתים ב-0x10000, ואז מעתיקות אותם אל 0x10010'
    },
    'running-light': {
      name: 'אור רץ',
      description: 'אין OUT: הנורות הן זיכרון ב-0x10000010, ולכן SB מדליקה אותן, סיבית אחת בכל פעם'
    },
    switches: {
      name: 'מתגים, ספרות ומסוף',
      description:
        'LBU קוראת את המתגים ב-0x10000011; SB מעתיקה אותם אל הנורות ואל ספרה, ואז מדפיסה HI'
    },
    'multiply-divide': {
      name: 'כפל וחילוק',
      description: 'הרחבת M; חילוק באפס לא גורם ל-trap, אלא נותן הכול אחדות (\u200e-1)'
    }
  },
  mos6502: {
    sum: {
      name: 'סכום 1 עד 10',
      description: 'רק A יכול לחבר, ורק זיכרון אליו: X עובר דרך ה-zero page. בסוף A הוא 55'
    },
    'wide-add': {
      name: 'חיבור מספרים של 16 סיביות',
      description:
        'מעבד של 8 סיביות מחבר מילה בית אחרי בית; C מעביר נשא לבית העליון. $1234 + $00FF = $1333'
    },
    multiply: {
      name: 'כפל בהזזות',
      description:
        'אין MUL: מזיזים את המכפיל ימינה, ומוסיפים בכל סיבית 1, 8 פעמים. 6 × 7 = 42 נוחת ב-$01'
    },
    call: {
      name: 'קריאה לתת-שגרה',
      description: 'JSR דוחפת את הכתובת של הבית האחרון שלה; RTS שולפת אותה ומוסיפה 1. בסוף A הוא 14'
    },
    pointer: {
      name: 'מצביע ב-zero page',
      description: '($10),Y: הכתובת היא המצביע ב-$10 וב-$11, ועוד Y. ממלאת 8 בתים ב-$0300'
    },
    'running-light': {
      name: 'אור רץ',
      description: 'אין OUT: הנורות הן זיכרון ב-$D010. ASL מזיזה את הסיבית עד שהיא נופלת החוצה אל C'
    },
    switches: {
      name: 'מתגים, ספרות ומסוף',
      description: 'LDA קוראת את המתגים ב-$D011; STA מעתיקה אותם אל הנורות ואל ספרה, ואז מדפיסה HI'
    },
    decimal: {
      name: 'מצב עשרוני',
      description:
        'כש-D דולק, ADC מחברת ספרות עשרוניות (BCD): $19 + $01 = $20, ו-$99 + $01 = $00 כש-C דולק'
    }
  }
};

/** The comparison tasks, by the id each has in the core. */
export const TASK_TEXTS: Record<string, { name: string; lesson: string }> = {
  sum: {
    name: 'חיבור 1 עד 10',
    lesson:
      'ל-8086 יש LOOP: היא סופרת את CX למטה וקופצת חזרה בהוראה אחת. ב-RISC-V סופרים למטה עם ADDI וקופצים חזרה עם BNE. ב-6502 רק A יכול לחבר, ורק בית מהזיכרון, ולכן X נשמר קודם ב-zero page.'
  },
  'wide-add': {
    name: 'חיבור $1234 ו-$00FF',
    lesson:
      'סכום של 16 סיביות הוא ADD אחת ב-8086 וב-RISC-V, שהרגיסטרים שלהם רחבים 16 ו-32 סיביות. ה-6502 מחבר בית בכל פעם: קודם הבתים התחתונים, ואחר כך העליונים עם הנשא מה-ADC הראשונה. RISC-V צריכה LUI כדי לבנות את $1234, שלא נכנס ב-12 הסיביות של ADDI.'
  },
  multiply: {
    name: 'כפל 6 ב-7',
    lesson:
      'ה-MUL של ה-8086 וה-MUL של RISC-V (מהרחבת M) מכפילות כל אחת בהוראה אחת, אם כי זו של ה-8086 לוקחת בפנים עשרות מחזורי שעון. ל-6502 אין כפל בכלל: הוא מזיז את המכפיל ימינה ומחבר, פעם אחת לכל אחת מ-8 הסיביות שלו.'
  },
  fill: {
    name: 'מילוי 8 בתים ב-$2A',
    lesson:
      'REP STOSB ממלאת את כל השמונה בהוראה אחת שחוזרת על עצמה. RISC-V וה-6502 כותבים את הלולאה במפורש. ה-6502 מחזיק את המונה ואת האינדקס באותו רגיסטר: STA $0300,X שומרת ב-$0300 ועוד X.'
  },
  call: {
    name: 'קריאה לפונקציה שמכפילה את 7',
    lesson:
      'CALL ו-JSR דוחפות את כתובת החזרה למחסנית, בזיכרון. JAL של RISC-V שומרת אותה ברגיסטר, ra, ולכן פונקציה שלא קוראת לשום דבר אחר לא נוגעת בזיכרון בכלל. JSR דוחפת את הכתובת של הבית האחרון שלה, ו-RTS מתקנת אותה בהוספת 1.'
  },
  light: {
    name: 'הדלקת הנורות אחת אחת',
    lesson:
      'ה-8086 מגיע אל הנורות דרך פורט משלהן, עם OUT. ל-RISC-V ול-6502 אין הוראות I/O: הנורות הן כתובת בזיכרון, שכותבים אליה עם SB או STA. ה-6502 לא צריך מונה: אחרי שמונה הזזות ASL דוחפת את הסיבית החוצה אל C, A הופך ל-0, ו-BNE ממשיכה הלאה.'
  }
};

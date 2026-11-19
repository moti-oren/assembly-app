import type { FlagReasonKey } from '@/core/x86/flagReasonTexts';

/** Why a flag holds its value, as Hebrew templates for the core's keys (`{name}` is a hole). */
export const FLAG_REASON_TEXTS: Record<FlagReasonKey, string> = {
  clc: 'CLC מנקה את CF.',
  stc: 'STC מדליקה את CF.',
  cmc: 'CMC הופכת את CF.',
  cld: 'CLD מנקה את DF: הוראות מחרוזת סופרות למעלה.',
  std: 'STD מדליקה את DF: הוראות מחרוזת סופרות למטה.',
  cli: 'CLI מנקה את IF: פסיקות שאפשר לחסום מתעלמים מהן.',
  sti: 'STI מדליקה את IF: פסיקות שאפשר לחסום מותרות.',
  onlyChanges: '{name} משנה רק את {flag}.',

  zero: 'התוצאה {result} היא אפס.',
  notZero: 'התוצאה {result} אינה אפס.',
  negative: 'סיבית {top} של התוצאה {result} היא 1: כמספר עם סימן היא {signed}.',
  notNegative: 'סיבית {top} של התוצאה {result} היא 0: לא שלילית.',
  parityResultEven: 'מספר סיביות ה-1 בתוצאה {byte} הוא {ones}, מספר זוגי.',
  parityResultOdd: 'מספר סיביות ה-1 בתוצאה {byte} הוא {ones}, מספר אי-זוגי.',
  parityLowByteEven: 'רק הבית הנמוך נספר: מספר סיביות ה-1 ב-{byte} הוא {ones}, מספר זוגי.',
  parityLowByteOdd: 'רק הבית הנמוך נספר: מספר סיביות ה-1 ב-{byte} הוא {ones}, מספר אי-זוגי.',

  neverCarry: '{name} אף פעם לא משנה את CF.',
  carryOut: '{sum} = {raw}h צריך יותר מ-{size} סיביות: הנשא מסיבית {top} נכנס ל-CF.',
  noCarryOut: '{sum} = {result} נכנס ב-{size} סיביות, ולכן שום דבר לא נישא החוצה.',
  borrow: '{sum} צריך לווה: כמספרים ללא סימן {a} קטן מ-{b}.',
  noBorrow: '{sum} לא צריך לווה: כמספרים ללא סימן {a} גדול מ-{b} או שווה לו.',
  overflow:
    'כמספרים עם סימן {a} {operator} {b}{carry} = {exact}, מחוץ לטווח {range}: התוצאה {result} נקראת כ-{signed}.',
  noOverflow: 'כמספרים עם סימן {a} {operator} {b}{carry} = {exact}, וזה נכנס בטווח {range}.',
  auxCarry: 'ספרות תחתונות: {a}h {operator} {b}h{carry} = {raw}h, נשא מסיבית 3.',
  noAuxCarry: 'ספרות תחתונות: {a}h {operator} {b}h{carry} = {raw}h, אין נשא מסיבית 3.',
  auxBorrow: 'ספרות תחתונות: {a}h {operator} {b}h{carry} צריך לווה מסיבית 4.',
  noAuxBorrow: 'ספרות תחתונות: {a}h {operator} {b}h{carry} לא צריך לווה מסיבית 4.',
  unchanged: '{name} לא משנה את {flag}.',

  shiftOverflowCount: 'OF מוגדר רק לכמות של 1; כאן הוא שומר על הערך הקודם שלו.',
  signChanged: 'הסיבית העליונה השתנתה מ-{was} ל-{now}: הסימן השתנה.',
  signKept: 'הסיבית העליונה נשארה {now}: הסימן לא השתנה.',
  shrOverflow: 'SHR ב-1 מעתיקה את הסיבית העליונה המקורית ({was}) אל OF.',
  sarOverflow: 'SAR ב-1 תמיד מנקה את OF: היא שומרת על סיבית הסימן.',
  rotateOverflow: 'OF הוא XOR של שתי הסיביות העליונות של התוצאה ({first} ו-{second}).',
  shiftCarryTop: 'CF מקבל את הסיבית האחרונה שנדחפה החוצה מהצד העליון של {original}: {carry}.',
  shiftCarryBottom: 'CF מקבל את הסיבית האחרונה שנדחפה החוצה מהצד התחתון של {original}: {carry}.',
  undefinedKept: '{name} משאירה את {flag} לא מוגדר ב-8086 אמיתי; כאן הוא שומר על הערך הקודם שלו.',
  rotateOnly: 'סיבובים משנים רק את CF ואת OF.',

  productSignedOverflow:
    'המכפלה {product} לא נכנסת ב-{low} כמספר עם סימן, ולכן {high} מחזיק חלק ממנה.',
  productSignedFits: 'המכפלה {product} נכנסת ב-{low} כמספר עם סימן: {high} הוא רק הסימן שלה.',
  productOverflow: 'המכפלה {product} לא נכנסת ב-{low}: {high} אינו אפס.',
  productFits: 'המכפלה {product} נכנסת ב-{low}: {high} הוא אפס.',

  alwaysClears: '{name} תמיד מנקה את {flag}.',
  auxCleared: '{name} משאירה את AF לא מוגדר ב-8086 אמיתי; כאן הוא מנוקה.',

  divideUndefined:
    '{name} משאירה את הדגלים לא מוגדרים ב-8086 אמיתי; כאן הם שומרים על הערכים הקודמים שלהם.',
  repeatZero: 'CX היה 0, ולכן החזרה לא השוותה כלום והדגלים נשארו כמו שהיו.',
  countZero: 'כמות של 0 לא משנה כלום, גם לא את הדגלים.',
  noFlagsChange: '{name} לא משנה את הדגלים.',
  interruptClears: 'כניסה לפסיקה מנקה את {flag}, כדי שהמטפל עצמו לא יופסק.',
  restored: '{name} טוענת את כל הדגלים מהמילה FLAGS שהיא שולפת מהמחסנית.'
};

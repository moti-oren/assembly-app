import type { ArithmeticRequest, ScaleSolution } from '@/core/representation/arithmetic';
import { span, wrap, type Scale } from '@/core/representation/readings';

/** The drawing is square; its lengths are in the units of its viewBox. */
export const WHEEL_SIZE = 240;
const CENTRE = WHEEL_SIZE / 2;
export const WHEEL_RADIUS = 78;
/** The journey runs just inside the ring, so the two do not cover each other. */
const PATH_RADIUS = WHEEL_RADIUS - 13;
/** A journey too short to see at this width is drawn this long, in degrees. */
const SHORTEST = 9;
/** How far from the seam a stretched journey that fits is kept, in degrees. */
const SEAM_GAP = 1;
const STEP = 3;

export interface Point {
  x: number;
  y: number;
}

/** A number written beside the ring. */
export interface WheelMark extends Point {
  label: string;
  anchor: 'start' | 'middle' | 'end';
}

/** Every value of a width on a ring, and one operation as a journey round it. */
export interface Wheel {
  scale: Scale;
  /** Where the scale ends and starts again: the top for unsigned, the bottom for signed. */
  seam: { from: Point; to: Point; crossed: boolean };
  marks: WheelMark[];
  start: Point;
  end: Point;
  /** The journey as an SVG path, and the arrow head at its end. */
  path: string;
  head: string;
  /** True when the journey is drawn longer than it is, because it would not show otherwise. */
  stretched: boolean;
}

/** A point of the ring: 0 degrees is the top, and the angle grows clockwise. */
function at(degrees: number, radius: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: Number((CENTRE + radius * Math.sin(radians)).toFixed(2)),
    y: Number((CENTRE - radius * Math.cos(radians)).toFixed(2))
  };
}

/**
 * Where a row of bits sits on the ring: the same place on both scales. Each value has the middle
 * of its own step, so the top and the bottom of the ring fall between two values.
 */
export function angleOf(bits: number, width: number): number {
  return ((wrap(bits, width) + 0.5) / span(width)) * 360;
}

/** The bits at the point of the ring nearest a point of the drawing. */
export function bitsAt(point: Point, width: number): number {
  const degrees = (Math.atan2(point.x - CENTRE, CENTRE - point.y) * 180) / Math.PI;
  return wrap(Math.floor((((degrees + 360) % 360) / 360) * span(width)), width);
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const raised = (power: number): string =>
  [...String(power)].map((digit) => SUPERSCRIPTS[Number(digit)]).join('');

/**
 * A number beside the ring. Ten digits do not fit there, so the marks of a 32-bit wheel are
 * written as powers of two: `count` × 2^`power`, less `less`.
 */
function text(width: number, count: number, power: number, less = 0): string {
  const value = count * 2 ** power - less;
  if (width < 32) return value.toLocaleString('en-US').replace('-', '−');
  if (value === 0) return '0';
  const size = `${Math.abs(count) === 1 ? '' : `${Math.abs(count)}·`}2${raised(power)}`;
  return `${count < 0 ? '−' : ''}${size}${less ? `−${less}` : ''}`;
}

function mark(degrees: number, label: string): WheelMark {
  const anchor = degrees === 90 ? 'start' : degrees === 270 ? 'end' : 'middle';
  const point = at(degrees, WHEEL_RADIUS + (anchor === 'middle' ? 16 : 9));
  return { ...point, y: point.y + 3, label, anchor };
}

/** The numbers at the four quarters; the seam shows the two it lies between. */
function marksOf(scale: Scale, width: number): WheelMark[] {
  const quarter = width - 2;
  const of = (count: number, power: number, less = 0) => text(width, count, power, less);
  return scale === 'unsigned'
    ? [
        mark(0, `${of(1, width, 1)} | 0`),
        mark(90, of(1, quarter)),
        mark(180, of(1, width - 1)),
        mark(270, of(3, quarter))
      ]
    : [
        mark(0, '0'),
        mark(90, of(1, quarter)),
        // Clockwise, the bottom of the ring runs right to left: the top of the scale is on the right.
        mark(180, `${of(-1, width - 1)} | ${of(1, width - 1, 1)}`),
        mark(270, of(-1, quarter))
      ];
}

function journey(from: number, sweep: number): { path: string; head: string } {
  const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / STEP));
  const points = Array.from({ length: pieces + 1 }, (_, index) =>
    at(from + (sweep * index) / pieces, PATH_RADIUS)
  );
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
  const end = from + sweep;
  // The head points along the ring, the way the journey was going.
  const back = end - Math.sign(sweep) * Math.min(7, Math.abs(sweep) * 0.6);
  const tip = at(end, PATH_RADIUS);
  const inner = at(back, PATH_RADIUS - 5);
  const outer = at(back, PATH_RADIUS + 5);
  return { path, head: `${tip.x},${tip.y} ${inner.x},${inner.y} ${outer.x},${outer.y}` };
}

/**
 * Where a stretched journey starts. One whose answer fits must not be drawn over the seam, since
 * crossing it is what not fitting looks like: it is moved away from the seam as far as it needs.
 */
function stretchedStart(from: number, sweep: number, seamAngle: number): number {
  const fromSeam = (from - seamAngle + 360) % 360;
  const kept =
    sweep < 0 ? Math.max(fromSeam, SEAM_GAP - sweep) : Math.min(fromSeam, 360 - SEAM_GAP - sweep);
  return seamAngle + kept;
}

/**
 * Names an operation apart from A: the wheel draws its journey again when this changes, so a new
 * operation is followed round the ring while A dragged round it is not redrawn at every move.
 */
export function journeyKey(request: ArithmeticRequest): string {
  return `${request.kind} ${request.b} ${request.extra} ${request.width}`;
}

/** One scale's reading of an operation, as a journey round the ring of that scale. */
export function wheelOf(solution: ScaleSolution, width: number): Wheel {
  const { scale } = solution;
  const seamAngle = scale === 'unsigned' ? 0 : 180;
  const steps = solution.exact - solution.a;
  const toScale = (steps / span(width)) * 360;
  const stretched = steps !== 0 && Math.abs(toScale) < SHORTEST;
  const sweep = stretched ? Math.sign(steps) * SHORTEST : toScale;
  const at0 = angleOf(solution.a, width);
  const from = stretched && solution.fits ? stretchedStart(at0, sweep, seamAngle) : at0;
  return {
    scale,
    seam: {
      from: at(seamAngle, WHEEL_RADIUS - 24),
      to: at(seamAngle, WHEEL_RADIUS + 9),
      crossed: !solution.fits
    },
    marks: marksOf(scale, width),
    start: at(from, WHEEL_RADIUS),
    end: at(from + sweep, WHEEL_RADIUS),
    ...(steps === 0 ? { path: '', head: '' } : journey(from, sweep)),
    stretched
  };
}

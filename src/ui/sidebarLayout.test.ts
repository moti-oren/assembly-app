import { describe, expect, it } from 'vitest';
import {
  defaultLayout,
  isDefaultLayout,
  isSidebarKey,
  readLayout,
  resizePair,
  sectionStyle,
  leastHeight
} from './sidebarLayout';

describe('readLayout', () => {
  it('keeps a valid stored layout', () => {
    const layout = readLayout(
      JSON.stringify({ collapsed: ['history'], sizes: { builder: 200, program: 400 } })
    );
    expect(layout.collapsed).toEqual(['history']);
    expect(layout.sizes).toEqual({ builder: 200, program: 400, history: 240, encoding: 240 });
  });

  it('drops unknown panels, repeats and sizes that are not positive numbers', () => {
    const layout = readLayout(
      JSON.stringify({
        collapsed: ['program', 'cpu', 'program', 3],
        sizes: { program: -5, history: 'big', memory: 300, encoding: 120 }
      })
    );
    expect(layout.collapsed).toEqual(['program']);
    expect(layout.sizes).toEqual({ builder: 320, program: 360, history: 240, encoding: 120 });
  });

  it('falls back to the defaults for anything that is not a layout', () => {
    expect(readLayout('not json')).toEqual(defaultLayout());
    expect(readLayout('null')).toEqual(defaultLayout());
    expect(readLayout('[1, 2]')).toEqual(defaultLayout());
  });
});

describe('isDefaultLayout', () => {
  it('is true only with nothing collapsed and the default sizes', () => {
    expect(isDefaultLayout(defaultLayout())).toBe(true);
    expect(isDefaultLayout({ ...defaultLayout(), collapsed: ['builder'] })).toBe(false);
    const resized = defaultLayout();
    resized.sizes.builder = 180;
    expect(isDefaultLayout(resized)).toBe(false);
  });
});

describe('isSidebarKey', () => {
  it('knows the sidebar panels and nothing else', () => {
    expect(isSidebarKey('program')).toBe(true);
    expect(isSidebarKey('memory')).toBe(false);
  });
});

describe('sectionStyle', () => {
  it('folds a collapsed panel to its header', () => {
    expect(sectionStyle('program', true, 300)['--section-flex']).toBe('0 0 auto');
  });

  it('sizes an open panel by its weight, never past its content', () => {
    const open = sectionStyle('program', false, 300);
    expect(open['--section-flex']).toBe('300 1 0px');
    expect(open['--section-max']).toBe('max-content');
  });

  it('keeps the builder tall enough for its input, a row of choices and its buttons', () => {
    expect(sectionStyle('builder', false, 100)['--section-min']).toBe('296px');
    expect(sectionStyle('history', false, 100)['--section-min']).toBe('96px');
  });
});

describe('leastHeight', () => {
  it('keeps as many program lines in sight as there are, up to a handful', () => {
    expect(leastHeight('program')).toBe(96);
    expect(leastHeight('program', 2)).toBe(152);
    expect(leastHeight('program', 6)).toBe(264);
    expect(leastHeight('program', 40)).toBe(264);
    expect(sectionStyle('program', false, 100, 40)['--section-min']).toBe('264px');
  });

  it('gives the other panels their fixed least height', () => {
    expect(leastHeight('history', 40)).toBe(96);
    expect(leastHeight('builder', 40)).toBe(296);
  });
});

describe('resizePair', () => {
  const program = (height: number) => ({ key: 'program' as const, height });
  const history = (height: number) => ({ key: 'history' as const, height });

  it('moves the line and keeps the total', () => {
    expect(resizePair(program(300), history(200), 50)).toEqual([350, 150]);
    expect(resizePair(program(300), history(200), -100)).toEqual([200, 300]);
  });

  it('stops each panel at its own least height', () => {
    expect(resizePair(program(300), history(200), 500)).toEqual([404, 96]);
    expect(resizePair(program(300), history(200), -500)).toEqual([96, 404]);
    expect(resizePair({ key: 'builder', height: 300 }, program(200), -500)).toEqual([296, 204]);
  });

  it('leaves two panels that are already too small as they are', () => {
    expect(resizePair(program(90), history(80), 20)).toEqual([90, 80]);
  });
});

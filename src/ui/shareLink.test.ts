import { describe, expect, it } from 'vitest';
import { MOS6502 } from '@/core/mos6502/architecture';
import { RV32 } from '@/core/rv32/architecture';
import type { ProgramInstruction } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import type { ArchitectureId } from './architectures';
import { decodeShare, encodeShare, isLongLink, isShareHash, replacesProgram } from './shareLink';

const ALL: [ArchitectureId, readonly { program: readonly ProgramInstruction[] }[]][] = [
  ['x86', X86.examples],
  ['rv32', RV32.examples],
  ['mos6502', MOS6502.examples]
];

const first = X86.examples[0]!.program;

describe('a share link', () => {
  it.each(ALL)('carries every example of %s unchanged', async (id, examples) => {
    for (const example of examples) {
      const fragment = await encodeShare(id, example.program);
      expect(await decodeShare(`#${fragment}`)).toEqual({ id, program: example.program });
    }
  });

  it.each(ALL)('carries every example of %s uncompressed too', async (id, examples) => {
    for (const example of examples) {
      const fragment = await encodeShare(id, example.program, false);
      expect(fragment.startsWith('share=0.')).toBe(true);
      expect(await decodeShare(fragment)).toEqual({ id, program: example.program });
    }
  });

  it('is shorter compressed, and safe in an address', async () => {
    const longest = X86.examples.reduce((a, b) => (a.program.length > b.program.length ? a : b));
    const compressed = await encodeShare('x86', longest.program);
    const plain = await encodeShare('x86', longest.program, false);
    expect(compressed.length).toBeLessThan(plain.length);
    expect(compressed).toMatch(/^share=1\.x86\.[A-Za-z0-9_-]+$/);
  });

  it('is told apart from any other fragment', async () => {
    expect(isShareHash('#share=1.x86.abc')).toBe(true);
    expect(isShareHash('#section')).toBe(false);
    expect(isShareHash('')).toBe(false);
    expect(await decodeShare('#section')).toBeNull();
    expect(await decodeShare('')).toBeNull();
  });

  it('made by a newer version says so', async () => {
    const fragment = await encodeShare('x86', first);
    expect(await decodeShare(fragment.replace('share=1.', 'share=9.'))).toBe('newer');
  });

  it('for one CPU is not read as another', async () => {
    const fragment = await encodeShare('rv32', RV32.examples[0]!.program);
    expect(await decodeShare(fragment.replace('.rv32.', '.x86.'))).toBe('invalid');
    expect(await decodeShare(fragment.replace('.rv32.', '.mos6502.'))).toBe('invalid');
  });

  it.each([
    ['no version', 'share=.x86.abc'],
    ['a version that is no number', 'share=v1.x86.abc'],
    ['an unknown CPU', 'share=1.z80.abc'],
    ['no payload', 'share=1.x86.'],
    ['a part too many', 'share=1.x86.abc.def'],
    ['a payload that is not base64', 'share=1.x86.***'],
    ['a payload that is not deflate', 'share=1.x86.AAAAAAAAAAAA'],
    ['an empty program', 'share=0.x86.W10'],
    ['a payload past the limit', `share=0.x86.${'A'.repeat(100_001)}`]
  ])('with %s is dropped', async (_name, fragment) => {
    expect(await decodeShare(fragment)).toBe('invalid');
  });

  it('cut short is dropped', async () => {
    const fragment = await encodeShare('x86', first);
    expect(await decodeShare(fragment.slice(0, -6))).toBe('invalid');
  });

  it('that unpacks to far more than a program is dropped', async () => {
    const bomb = new Blob([new Uint8Array(2_000_000)])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(bomb).arrayBuffer());
    const payload = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await decodeShare(`share=1.x86.${payload}`)).toBe('invalid');
  });

  it('is long past what chat apps keep whole', () => {
    expect(isLongLink('x'.repeat(2000))).toBe(false);
    expect(isLongLink('x'.repeat(2001))).toBe(true);
  });
});

describe('opening a shared program', () => {
  const other = X86.examples[1]!.program;

  it('loses nothing when there is no program, or the same one', () => {
    expect(replacesProgram([], first)).toBe(false);
    expect(
      replacesProgram(
        first,
        first.map((line) => ({ ...line }))
      )
    ).toBe(false);
  });

  it('replaces a program that is another', () => {
    expect(replacesProgram(other, first)).toBe(true);
  });
});

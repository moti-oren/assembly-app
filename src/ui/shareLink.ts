import { MOS6502 } from '@/core/mos6502/architecture';
import type { Instruction as Mos6502Instruction } from '@/core/mos6502/instructions';
import { RV32 } from '@/core/rv32/architecture';
import type { Instruction as Rv32Instruction } from '@/core/rv32/instructions';
import type { ProgramInstruction } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import type { Instruction as X86Instruction } from '@/core/x86/instructions';
import { isArchitectureId, type ArchitectureId } from './architectures';
import { parseProgram, serializeProgram } from './programStorage';

/** A program as a link carries it: the CPU it was written for, and its lines. */
export type SharedProgram =
  | { id: 'x86'; program: X86Instruction[] }
  | { id: 'rv32'; program: Rv32Instruction[] }
  | { id: 'mos6502'; program: Mos6502Instruction[] };

/** Why a share link gave no program: it is damaged, or a newer version of the app made it. */
export type ShareProblem = 'invalid' | 'newer';

/**
 * The link's fragment is `share=<version>.<architecture>.<payload>`. The payload is the program
 * as storage keeps it, in base64url: deflated in version 1, as it is in version 0 (written by a
 * browser that cannot compress). A fragment is never sent to the server.
 */
const PREFIX = 'share=';

/** No program the app can hold comes near these; a link past them is not read at all. */
const PAYLOAD_LIMIT = 100_000;
const JSON_LIMIT = 1_000_000;

/** Past this some chat and mail apps cut a link short. */
const LONG_LINK = 2000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Runs bytes through a (de)compression stream, giving up once the result passes `limit`. */
async function through(
  bytes: Uint8Array,
  transform: GenericTransformStream,
  limit: number
): Promise<Uint8Array> {
  const reader = (
    new Blob([bytes]).stream().pipeThrough(transform) as ReadableStream<Uint8Array>
  ).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new RangeError('The link holds more than a program');
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.length;
  }
  return joined;
}

/** The fragment that carries `program`; `compress` is off only where the browser cannot. */
export async function encodeShare(
  id: ArchitectureId,
  program: readonly ProgramInstruction[],
  compress = typeof CompressionStream !== 'undefined'
): Promise<string> {
  const json = new TextEncoder().encode(serializeProgram(program));
  const bytes = compress
    ? await through(json, new CompressionStream('deflate-raw'), JSON_LIMIT)
    : json;
  return `${PREFIX}${compress ? 1 : 0}.${id}.${toBase64Url(bytes)}`;
}

/** Whether the address's fragment is a share link at all, whatever it holds. */
export function isShareHash(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(PREFIX);
}

/** The program as its own CPU accepts it, or null: a link is no more trusted than storage is. */
function accepted(id: ArchitectureId, raw: string): SharedProgram | null {
  const shared: SharedProgram =
    id === 'x86'
      ? { id, program: parseProgram(raw, X86.isValid) }
      : id === 'rv32'
        ? { id, program: parseProgram(raw, RV32.isValid) }
        : { id, program: parseProgram(raw, MOS6502.isValid) };
  return shared.program.length > 0 ? shared : null;
}

/** Reads a fragment back: its program, why it has none, or null when it is no share link. */
export async function decodeShare(hash: string): Promise<SharedProgram | ShareProblem | null> {
  if (!isShareHash(hash)) return null;
  const parts = hash.replace(/^#/, '').slice(PREFIX.length).split('.');
  const [version = '', id, payload = ''] = parts;
  if (!/^\d+$/.test(version)) return 'invalid';
  if (version !== '0' && version !== '1') return 'newer';
  if (parts.length !== 3 || !isArchitectureId(id)) return 'invalid';
  if (payload.length === 0 || payload.length > PAYLOAD_LIMIT) return 'invalid';
  try {
    const bytes = fromBase64Url(payload);
    const json =
      version === '1'
        ? await through(bytes, new DecompressionStream('deflate-raw'), JSON_LIMIT)
        : bytes;
    return accepted(id, new TextDecoder().decode(json)) ?? 'invalid';
  } catch {
    // Not base64, not deflate, or more than a program: nothing of it is used.
    return 'invalid';
  }
}

export function isLongLink(url: string): boolean {
  return url.length > LONG_LINK;
}

/** Whether opening `shared` would lose a program: there is one, and it is another. */
export function replacesProgram(
  current: readonly ProgramInstruction[],
  shared: readonly ProgramInstruction[]
): boolean {
  return current.length > 0 && serializeProgram(current) !== serializeProgram(shared);
}

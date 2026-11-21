import { onScopeDispose, watch, type ShallowRef } from 'vue';
import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatHex } from '@/core/shared/numbers';
import {
  effectiveAddress,
  operandSize,
  readOperandMemory,
  type Operand
} from '@/core/x86/operands';
import { physicalAddress, readRegister, type CpuState } from '@/core/x86/state';
import { usePreferences } from './usePreferences';

/**
 * How long a value takes to travel between two places. The panels wait this long before they
 * update; useDataFlow hands it to the stylesheet as --flight.
 */
const FLIGHT_MS = 420;

/** Clears `data-flight` even if a packet never lands, e.g. when its animation is dropped. */
const FLIGHT_RESET_MS = 2000;

/** Executions closer together than this (a fast run) skip the flight: packets would pile up. */
const MIN_GAP_MS = 500;

interface Flight {
  from: string | null;
  to: string | null;
  text: string;
}

/** Whether any of a box is drawn inside the window. */
function inSight(box: DOMRect): boolean {
  return (
    box.width > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

function at(location: string): string {
  return `[data-loc="${location}"]`;
}

/**
 * Shows a value travelling from where an instruction read it to where it wrote it. Elements
 * opt in with a `data-loc` attribute: `reg:<name>`, `mem:<physical address>`, `line:<index>`
 * and `builder`.
 */
export function useDataFlow(state: CpuState, history: ShallowRef<ExecutionRecord[]>): void {
  const root = document.documentElement;
  root.style.setProperty('--flight', `${FLIGHT_MS}ms`);
  const layer = document.createElement('div');
  layer.className = 'data-flow-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const { calm } = usePreferences();
  let timer: number | undefined;
  let lastExecution = -Infinity;

  function plan(record: ExecutionRecord): Flight[] {
    const { instruction, before, line, memoryWrites } = record;
    const [first, second] = instruction.operands;
    if (!first) return [];

    // Memory operands are located with the registers as they were when the instruction ran.
    const stateBefore = before;
    const size = operandSize(first) ?? (second && operandSize(second)) ?? 16;

    const locate = (operand: Operand): string | null => {
      if (operand.type === 'reg') return at(`reg:${operand.name}`);
      if (operand.type === 'mem') return at(`mem:${effectiveAddress(stateBefore, operand)}`);
      return null;
    };
    const read = (operand: Operand): string => {
      if (operand.type === 'reg') return formatHex(readRegister(state, operand.name), size);
      if (operand.type === 'mem') {
        return formatHex(readOperandMemory(state, stateBefore, operand, size), size);
      }
      return formatHex(operand.type === 'imm' ? operand.value : operand.target, size);
    };

    const decoded = decode(instruction);
    const [firstRole, secondRole] = decoded.operands.map((operand) => operand.role);
    // The source's value ends up in (or is combined into) the destination. A port number is
    // only an address, and XCHG moves both ways.
    const moves =
      (firstRole === 'destination' && secondRole === 'source' && decoded.port === null) ||
      instruction.mnemonic === 'xchg';
    if (second && moves) {
      // An immediate has no home in the CPU: it comes out of the code that was just run.
      const from = locate(second) ?? at(line === null ? 'builder' : `line:${line}`);
      const to = locate(first);
      if (instruction.mnemonic === 'xchg') {
        return [
          { from, to, text: read(first) },
          { from: to, to: from, text: read(second) }
        ];
      }
      return [{ from, to, text: read(second) }];
    }
    if (decoded.stack === 'push' && memoryWrites.length > 0) {
      return [{ from: locate(first), to: at(`mem:${memoryWrites[0].address}`), text: read(first) }];
    }
    if (decoded.stack === 'pop') {
      const top = physicalAddress(before.registers.ss, before.registers.sp);
      return [{ from: at(`mem:${top}`), to: locate(first), text: read(first) }];
    }
    return [];
  }

  function launch(flights: Flight[]): boolean {
    let launched = false;
    for (const flight of flights) {
      const from = flight.from && document.querySelector(flight.from)?.getBoundingClientRect();
      const to = flight.to && document.querySelector(flight.to)?.getBoundingClientRect();
      // Either end may be out of sight: a memory cell outside the rows on show, a panel of a view
      // a phone is not on, or one scrolled out of its pane.
      if (!from || !to || !inSight(from) || !inSight(to)) continue;

      const x0 = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const x1 = to.left + to.width / 2;
      const y1 = to.top + to.height / 2;
      const position = (x: number, y: number, scale: number): string =>
        `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;

      const packet = document.createElement('span');
      packet.className = 'data-packet';
      packet.textContent = flight.text;
      layer.append(packet);

      const animation = packet.animate(
        [
          { transform: position(x0, y0, 0.9), opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { transform: position((x0 + x1) / 2, (y0 + y1) / 2 - 18, 1.15), offset: 0.5 },
          { opacity: 1, offset: 0.85 },
          { transform: position(x1, y1, 0.85), opacity: 0 }
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' }
      );
      animation.onfinish = animation.oncancel = () => packet.remove();
      launched = true;
    }
    return launched;
  }

  // Sync, so the packets are measured and `data-flight` is set before the panels re-render:
  // the attribute is what makes their own animations wait for the packet to land.
  const stop = watch(
    () => history.value.length,
    (length, previous) => {
      window.clearTimeout(timer);
      const record = history.value.at(-1);
      const single = record !== undefined && length === previous + 1;
      const now = performance.now();
      const unhurried = now - lastExecution >= MIN_GAP_MS;
      lastExecution = now;
      if (single && unhurried && !calm.value && launch(plan(record))) {
        root.dataset.flight = '';
        timer = window.setTimeout(() => delete root.dataset.flight, FLIGHT_RESET_MS);
      } else {
        delete root.dataset.flight;
      }
    },
    { flush: 'sync' }
  );

  onScopeDispose(() => {
    stop();
    window.clearTimeout(timer);
    delete root.dataset.flight;
    root.style.removeProperty('--flight');
    layer.remove();
  });
}

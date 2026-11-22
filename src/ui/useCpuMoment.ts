import { computed, type ComputedRef, type Ref } from 'vue';
import type { AluLink } from '@/core/aluLink';
import { architectureLabel, type ArchitectureId } from './architectures';
import { momentOf, type CpuMoment } from './cpuMoment';
import { usePreferences } from './usePreferences';

/** The part of a CPU the logic topic follows: its timeline, and the way through it. */
interface Timeline<Record> {
  history: Readonly<Ref<readonly Record[]>>;
  future: Readonly<Ref<readonly Record[]>>;
  seek: (position: number) => void;
}

/** A CPU the logic topic can follow, whatever its records are. */
export interface FollowedCpu {
  moment: (cpu: string) => CpuMoment;
  seek: (position: number) => void;
}

/** Makes a CPU followable: how its instructions are written, and where each leads. */
export function followed<Record>(
  cpu: Timeline<Record>,
  format: (record: Record) => string,
  link: (record: Record) => AluLink
): FollowedCpu {
  return {
    moment: (name) =>
      momentOf({ cpu: name, history: cpu.history.value, future: cpu.future.value, format, link }),
    seek: cpu.seek
  };
}

/**
 * The CPU chosen in the header at its last instruction, which is what the logic topic shows the
 * gates of, and the way to move that CPU through its history from there.
 */
export function useCpuMoment(cpus: Record<ArchitectureId, FollowedCpu>): {
  moment: ComputedRef<CpuMoment>;
  seekShown: (position: number) => void;
} {
  const { architecture } = usePreferences();
  const moment = computed(() =>
    cpus[architecture.value].moment(architectureLabel(architecture.value))
  );
  return { moment, seekShown: (position) => cpus[architecture.value].seek(position) };
}

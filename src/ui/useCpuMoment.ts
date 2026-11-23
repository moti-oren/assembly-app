import { computed, type ComputedRef, type Ref } from 'vue';
import { architectureLabel, type ArchitectureId } from './architectures';
import { momentOf, type CpuMoment } from './cpuMoment';
import { usePreferences } from './usePreferences';

/** The part of a CPU another topic follows: its timeline, and the way through it. */
interface Timeline<Record> {
  history: Readonly<Ref<readonly Record[]>>;
  future: Readonly<Ref<readonly Record[]>>;
  seek: (position: number) => void;
}

/** How a topic reads a CPU's records: where each leads, and whether there is something to show. */
export interface TopicLinker<Record, Link> {
  link: (record: Record) => Link;
  shows: (link: Link) => boolean;
}

/** A CPU a topic can follow, whatever its records are. */
export interface FollowedCpu<Link> {
  moment: (cpu: string) => CpuMoment<Link>;
  seek: (position: number) => void;
}

/** Makes a CPU followable: how its instructions are written, and where each leads. */
export function followed<Record, Link>(
  cpu: Timeline<Record>,
  format: (record: Record) => string,
  linker: TopicLinker<Record, Link>
): FollowedCpu<Link> {
  return {
    moment: (name) =>
      momentOf({
        cpu: name,
        history: cpu.history.value,
        future: cpu.future.value,
        format,
        ...linker
      }),
    seek: cpu.seek
  };
}

/**
 * The CPU chosen in the header at its last instruction, which is what another topic shows, and
 * the way to move that CPU through its history from there.
 */
export function useCpuMoment<Link>(cpus: Record<ArchitectureId, FollowedCpu<Link>>): {
  moment: ComputedRef<CpuMoment<Link>>;
  seekShown: (position: number) => void;
} {
  const { architecture } = usePreferences();
  const moment = computed(() =>
    cpus[architecture.value].moment(architectureLabel(architecture.value))
  );
  return { moment, seekShown: (position) => cpus[architecture.value].seek(position) };
}

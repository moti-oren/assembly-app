import { computed, ref, watch } from 'vue';
import {
  checkChallenge,
  givenLines,
  type Challenge,
  type ChallengeInstruction
} from '@/core/shared/challenge';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { CpuState } from '@/core/shared/state';
import { analytics } from './analyticsClient';
import { sound } from './soundEngine';
import { useChallenges } from './useChallenges';
import type { CpuOf } from './useCpu';

/** Loads a challenge's given lines into its CPU, afresh, and makes it the one worked on. */
export function startChallenge<
  Instruction extends ChallengeInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(cpu: CpuOf<Instruction, State, Record>, id: string): void {
  const challenge = cpu.architecture.challenges.find((each) => each.id === id);
  if (!challenge) return;
  cpu.loadProgram(givenLines(challenge), { name: challenge.title, description: challenge.brief });
  useChallenges().start(cpu.architecture.id, id);
  analytics.track({ name: 'challenge-started', architecture: cpu.architecture.id, challenge: id });
}

/**
 * The challenge a CPU's program is for, judged again whenever the program changes. The judging
 * runs the program on a CPU of its own, so the one on show is never touched.
 */
export function useChallenge<
  Instruction extends ChallengeInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(cpu: CpuOf<Instruction, State, Record>) {
  const { architecture } = cpu;
  const challenges = useChallenges();
  const hintShown = ref(false);

  const challenge = computed<Challenge<Instruction, State> | null>(() => {
    const id = challenges.active.value[architecture.id];
    return architecture.challenges.find((each) => each.id === id) ?? null;
  });
  const result = computed(
    () => challenge.value && checkChallenge(architecture, challenge.value, cpu.program.value)
  );
  const given = computed(() => (challenge.value ? givenLines(challenge.value).length : 0));

  watch(
    () => challenge.value?.id,
    () => {
      hintShown.value = false;
    }
  );

  // Another program loaded whole (an example, a task, a shared link) is not for this challenge.
  watch(cpu.programSource, (source) => {
    if (source && challenge.value && source.name !== challenge.value.title) {
      challenges.leave(architecture.id);
    }
  });

  // A solution is remembered with the lines it took, and a shorter one after it too; one that
  // was already there when the page opened counts as well.
  watch(
    () => (result.value?.solved ? result.value.lines : null),
    (lines) => {
      if (lines !== null && challenge.value) challenges.markSolved(challenge.value.id, lines);
    },
    { immediate: true }
  );

  watch(
    () => result.value?.solved ?? false,
    (solved) => {
      if (!solved || !challenge.value) return;
      sound.play('call');
      analytics.track({
        name: 'challenge-solved',
        architecture: architecture.id,
        challenge: challenge.value.id
      });
    }
  );

  function restart(): void {
    if (challenge.value) startChallenge(cpu, challenge.value.id);
  }

  return { challenge, result, given, hintShown, restart };
}

import { computed, ref, watch, type Ref } from 'vue';
import { computedAsync, useClipboard } from '@vueuse/core';
import type { ProgramInstruction } from '@/core/shared/program';
import { analytics } from './analyticsClient';
import type { ArchitectureId } from './architectures';
import { encodeShare, isLongLink } from './shareLink';

/** The program a link is made for. */
export interface ShareSource {
  architecture: ArchitectureId;
  program: readonly ProgramInstruction[];
}

/** The link to the program on show, made while the share dialog is open, and copying it. */
export function useShareLink(source: () => ShareSource, open: Ref<boolean>) {
  const link = computedAsync(async () => {
    if (!open.value) return '';
    const { architecture, program } = source();
    const fragment = await encodeShare(architecture, program);
    return `${location.origin}${location.pathname}#${fragment}`;
  }, '');
  const long = computed(() => isLongLink(link.value));

  const { copy: write, copied } = useClipboard({ copiedDuring: 2000, legacy: true });
  /** The clipboard refused (no permission, an old browser): the link is still there to select. */
  const failed = ref(false);

  async function copy(): Promise<void> {
    if (link.value === '') return;
    try {
      await write(link.value);
      failed.value = false;
      analytics.track({ name: 'link-copied', architecture: source().architecture });
    } catch {
      failed.value = true;
    }
  }

  watch(open, () => {
    failed.value = false;
  });

  return { link, long, copied, failed, copy };
}

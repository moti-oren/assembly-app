import { computed, ref, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { emailProblem, emptyDraft, feedbackPayload, isSendable } from './feedback';
import { modeForWidth } from './layoutMode';
import { usePreferences } from './usePreferences';
import { useTopic } from './useTopic';

/** `incomplete`: Send was pressed on a draft that cannot be sent yet. */
type FeedbackStatus = 'idle' | 'incomplete' | 'sending' | 'sent' | 'failed';

/** The form service the feedback is posted to; it forwards each one to the developer's inbox. */
const ENDPOINT: string | undefined = import.meta.env.VITE_FEEDBACK_ENDPOINT || undefined;

async function post(payload: Record<string, string>): Promise<boolean> {
  if (!ENDPOINT) {
    // Development has no endpoint: the dialog can still be tried, and nothing leaves the page.
    console.info('Feedback (not sent, no endpoint is set):', payload);
    return true;
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      // A request that hangs ends as a failure the form can show, not as "Sending…" for good.
      signal: AbortSignal.timeout(15000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The feedback dialog: whether it is open, what is written in it, and sending it. */
export const useFeedback = createGlobalState(() => {
  const { architecture, isDark } = usePreferences();
  const { topic } = useTopic();

  /** A production build with nowhere to send feedback offers none. */
  const available = import.meta.env.DEV || ENDPOINT !== undefined;
  const open = ref(false);
  /** Turns true the first time it opens, so the dialog's code loads only when it is wanted. */
  const wanted = ref(false);
  const draft = ref(emptyDraft());
  const status = ref<FeedbackStatus>('idle');
  const emailError = computed(() => emailProblem(draft.value));

  watch(open, (isOpen) => {
    if (!isOpen) return;
    wanted.value = true;
    // What was sent is done with; what was not is still there to finish.
    if (status.value === 'sent') draft.value = emptyDraft();
    if (status.value !== 'sending') status.value = 'idle';
  });

  // The reminder has done its work once the draft is being written again.
  watch(
    draft,
    () => {
      if (status.value === 'incomplete') status.value = 'idle';
    },
    { deep: true }
  );

  async function submit(): Promise<void> {
    if (status.value === 'sending') return;
    if (!isSendable(draft.value)) {
      status.value = 'incomplete';
      return;
    }
    status.value = 'sending';
    const payload = feedbackPayload(draft.value, {
      topic: topic.value,
      architecture: architecture.value,
      layout: modeForWidth(window.innerWidth),
      dark: isDark.value,
      version: __APP_VERSION__
    });
    // A filled trap is a script: it is told what a person would be, and nothing is sent.
    const sent = draft.value.trap !== '' || (await post(payload));
    status.value = sent ? 'sent' : 'failed';
  }

  return { available, open, wanted, draft, status, emailError, submit };
});

import { computed, type ComputedRef } from 'vue';
import type { PaletteCommand } from './paletteCommand';
import { TOPIC_CHOICES } from './topics';
import { useFeedback } from './useFeedback';
import { usePreferences } from './usePreferences';
import { useTopic } from './useTopic';

/** The palette commands every topic offers: another topic, the preferences, and feedback. */
export function useAppCommands(): ComputedRef<PaletteCommand[]> {
  const { isDark, soundOn, reduceMotion, systemReducesMotion, toggleTheme } = usePreferences();
  const { topic } = useTopic();
  const feedback = useFeedback();

  return computed<PaletteCommand[]>(() => [
    ...TOPIC_CHOICES.filter((choice) => choice.id !== topic.value).map((choice) => ({
      group: 'Topics',
      label: `Go to ${choice.name}`,
      // The other topic's page takes focus; the palette must not take it back as it closes.
      moves: 'focus' as const,
      run: () => {
        topic.value = choice.id;
      }
    })),
    {
      group: 'Preferences',
      label: isDark.value ? 'Switch to light theme' : 'Switch to dark theme',
      run: toggleTheme
    },
    {
      group: 'Preferences',
      label: soundOn.value ? 'Turn sound off' : 'Turn sound on',
      run: () => {
        soundOn.value = !soundOn.value;
      }
    },
    // While the system asks for less motion, the app's own setting cannot bring it back.
    systemReducesMotion.value
      ? {
          group: 'Preferences',
          label: 'Animations are reduced by the system',
          disabled: true,
          run: () => {}
        }
      : {
          group: 'Preferences',
          label: reduceMotion.value ? 'Use full animations' : 'Reduce animations',
          run: () => {
            reduceMotion.value = !reduceMotion.value;
          }
        },
    ...(feedback.available
      ? [
          {
            group: 'Feedback',
            label: 'Send feedback…',
            // The dialog takes focus; the palette must not take it back as it closes.
            moves: 'focus' as const,
            run: () => {
              feedback.open.value = true;
            }
          }
        ]
      : [])
  ]);
}

import { computed, type ComputedRef } from 'vue';
import { ARCHITECTURE_CHOICES } from './architectures';
import type { PaletteCommand } from './paletteCommand';
import { TOPIC_CHOICES } from './topics';
import { useFeedback } from './useFeedback';
import { usePreferences } from './usePreferences';
import { useSettings } from './useSettings';
import { useTopic } from './useTopic';

/** The palette commands every topic offers: another topic, the preferences, the settings and feedback. */
export function useAppCommands(): ComputedRef<PaletteCommand[]> {
  const {
    architecture,
    theme,
    isDark,
    soundOn,
    analyticsOn,
    autoOpenDevices,
    confirmReset,
    prediction,
    predictStep,
    predictBuilder,
    predictRun,
    reduceMotion,
    systemReducesMotion,
    setTheme,
    toggleTheme
  } = usePreferences();
  const settings = useSettings();
  /** Where prediction mode asks, each with the words of its command. */
  const asksOn = [
    { on: predictStep, what: 'on a program step' },
    { on: predictBuilder, what: 'on an instruction from the builder' },
    { on: predictRun, what: 'during a run' }
  ];
  const { topic } = useTopic();
  const feedback = useFeedback();

  return computed<PaletteCommand[]>(() => [
    ...TOPIC_CHOICES.filter((choice) => choice.id !== topic.value).map((choice) => ({
      group: 'Topics',
      // The word the activity bar shows, so the same topic is called one thing; its long name is
      // still found.
      label: `Go to ${choice.label}`,
      keywords: choice.name,
      // The other topic's page takes focus; the palette must not take it back as it closes.
      moves: 'focus' as const,
      run: () => {
        topic.value = choice.id;
      }
    })),
    // Every topic follows the CPU chosen in the header, so any page can change it.
    ...ARCHITECTURE_CHOICES.filter((choice) => choice.id !== architecture.value).map((choice) => ({
      group: 'CPU',
      label: `Switch to ${choice.label}`,
      keywords: 'architecture processor',
      run: () => {
        architecture.value = choice.id;
      }
    })),
    {
      group: 'Preferences',
      label: isDark.value ? 'Switch to light theme' : 'Switch to dark theme',
      keywords: 'dark mode light mode appearance colours',
      run: toggleTheme
    },
    {
      group: 'Preferences',
      label: 'Follow the system theme',
      keywords: 'dark mode light mode appearance auto',
      current: theme.value === 'auto',
      run: () => setTheme('auto')
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
    {
      group: 'Preferences',
      label: prediction.value ? 'Stop guessing before it runs' : 'Guess before it runs',
      run: () => {
        prediction.value = !prediction.value;
      }
    },
    ...asksOn.map(({ on, what }) => ({
      group: 'Preferences',
      label: on.value ? `Stop asking for a guess ${what}` : `Ask for a guess ${what}`,
      disabled: !prediction.value,
      run: () => {
        on.value = !on.value;
      }
    })),
    {
      group: 'Preferences',
      label: analyticsOn.value ? 'Stop sharing anonymous usage' : 'Share anonymous usage',
      run: () => {
        analyticsOn.value = !analyticsOn.value;
      }
    },
    {
      group: 'Preferences',
      label: autoOpenDevices.value
        ? 'Stop opening the I/O panel by itself'
        : 'Open the I/O panel by itself',
      run: () => {
        autoOpenDevices.value = !autoOpenDevices.value;
      }
    },
    {
      group: 'Preferences',
      label: confirmReset.value ? 'Stop asking before a reset' : 'Ask before a reset',
      run: () => {
        confirmReset.value = !confirmReset.value;
      }
    },
    {
      group: 'Preferences',
      label: 'Open the settings…',
      keywords: 'preferences options help keyboard shortcuts keys',
      // The dialog takes focus; the palette must not take it back as it closes.
      moves: 'focus' as const,
      run: () => {
        settings.open.value = true;
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

/** The sections of the settings, in the order their list shows them. */
export const SETTINGS_SECTIONS = [
  { id: 'general', name: 'General' },
  { id: 'appearance', name: 'Appearance' },
  { id: 'cpu', name: 'CPU' },
  { id: 'running', name: 'Running' },
  { id: 'keyboard', name: 'Keyboard' },
  { id: 'data', name: 'Data' }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

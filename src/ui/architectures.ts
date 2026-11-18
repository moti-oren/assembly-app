/** The architectures the app can show, in the order the switch lists them. */
export const ARCHITECTURE_CHOICES = [
  { id: 'x86', label: '8086', badge: '86' },
  { id: 'rv32', label: 'RISC-V', badge: 'RV' },
  { id: 'mos6502', label: '6502', badge: '65' }
] as const;

export type ArchitectureId = (typeof ARCHITECTURE_CHOICES)[number]['id'];

export function isArchitectureId(value: unknown): value is ArchitectureId {
  return ARCHITECTURE_CHOICES.some((choice) => choice.id === value);
}

export function architectureLabel(id: ArchitectureId): string {
  return ARCHITECTURE_CHOICES.find((choice) => choice.id === id)!.label;
}

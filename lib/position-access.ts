export const SAMPLE_POSITION_ADDRESS = '0x6221a9c005f6e47eb398fd867784cacfdcfff4e7';

export function canViewSamplePosition(address: string | null | undefined): boolean {
  return address?.toLowerCase() === SAMPLE_POSITION_ADDRESS.toLowerCase();
}

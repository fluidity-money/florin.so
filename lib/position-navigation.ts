import type { FlorinPosition } from './florin-positions';

export function positionKey(position: Pick<FlorinPosition, 'troveManager' | 'troveId'>): string {
  return `${position.troveManager.toLowerCase()}:${BigInt(position.troveId)}`;
}

export function managePositionHref(position: FlorinPosition): string {
  return `/position?position=${encodeURIComponent(positionKey(position))}`;
}

// An explicit target must never silently open a different position while indexing.
export function selectPosition(positions: FlorinPosition[], target: string | null): FlorinPosition | undefined {
  return target === null ? positions[0] : positions.find(position => positionKey(position) === target.toLowerCase());
}

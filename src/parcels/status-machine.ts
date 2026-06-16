import { InvalidStatusTransitionError } from '../common/exceptions/invalid-status-transition.error';

export type ParcelStatus =
  | 'registered'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed';

export const PARCEL_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  registered: ['picked_up', 'failed'],
  picked_up: ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  delivered: [],
  failed: ['picked_up'],
};

export function canTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  return PARCEL_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: ParcelStatus, to: ParcelStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

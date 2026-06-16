import { InvalidStatusTransitionError } from '../common/exceptions/invalid-status-transition.error';
import {
  assertValidTransition,
  canTransition,
  PARCEL_TRANSITIONS,
  ParcelStatus,
} from './status-machine';

const ALL_STATUSES: ParcelStatus[] = [
  'registered',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed',
];

const VALID_PAIRS = new Set(
  (Object.entries(PARCEL_TRANSITIONS) as [ParcelStatus, ParcelStatus[]][]).flatMap(
    ([from, targets]) => targets.map((to) => `${from}->${to}`),
  ),
);

function isValid(from: ParcelStatus, to: ParcelStatus): boolean {
  return VALID_PAIRS.has(`${from}->${to}`);
}

// Build the full 5x5 matrix once
const MATRIX: [ParcelStatus, ParcelStatus, boolean][] = ALL_STATUSES.flatMap((from) =>
  ALL_STATUSES.map((to): [ParcelStatus, ParcelStatus, boolean] => [from, to, isValid(from, to)]),
);

describe('StatusMachine', () => {
  describe('canTransition — full 5×5 matrix (25 cases)', () => {
    it.each(MATRIX)('%s -> %s  (expected: %s)', (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    });
  });

  describe('assertValidTransition — valid transitions do not throw', () => {
    const validCases = MATRIX.filter(([, , ok]) => ok);

    it.each(validCases)('%s -> %s', (from, to) => {
      expect(() => assertValidTransition(from, to)).not.toThrow();
    });
  });

  describe('assertValidTransition — invalid transitions throw InvalidStatusTransitionError', () => {
    const invalidCases = MATRIX.filter(([, , ok]) => !ok);

    it.each(invalidCases)('%s -> %s', (from, to) => {
      expect(() => assertValidTransition(from, to)).toThrow(InvalidStatusTransitionError);
      expect(() => assertValidTransition(from, to)).toThrow(`${from} -> ${to}`);
    });

    // Explicitly called out in the assignment brief
    it('rejects registered -> delivered (cannot skip intermediate states)', () => {
      expect(() => assertValidTransition('registered', 'delivered')).toThrow(
        InvalidStatusTransitionError,
      );
      expect(() => assertValidTransition('registered', 'delivered')).toThrow(
        'Invalid status transition: registered -> delivered',
      );
    });
  });

  describe('PARCEL_TRANSITIONS shape', () => {
    it('covers every status as a key', () => {
      expect(Object.keys(PARCEL_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
    });

    it('delivered is a terminal state with no outgoing transitions', () => {
      expect(PARCEL_TRANSITIONS.delivered).toEqual([]);
    });

    it('failed can only recover to picked_up', () => {
      expect(PARCEL_TRANSITIONS.failed).toEqual(['picked_up']);
    });
  });
});

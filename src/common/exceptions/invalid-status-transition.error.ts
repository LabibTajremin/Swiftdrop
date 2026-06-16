import { DomainException } from './domain.exception';

export class InvalidStatusTransitionError extends DomainException {
  constructor(from: string, to: string) {
    super(`Invalid status transition: ${from} -> ${to}`);
  }
}

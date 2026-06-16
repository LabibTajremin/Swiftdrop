import { DomainException } from './domain.exception';

export class ConstraintViolationError extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

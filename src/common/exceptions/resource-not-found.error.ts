import { DomainException } from './domain.exception';

export class ResourceNotFoundError extends DomainException {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
  }
}

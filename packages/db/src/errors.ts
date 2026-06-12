// Also thrown when the referenced row simply does not exist — callers cannot
// distinguish the two, by design.
export class TenantScopeError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found for tenant`);
    this.name = 'TenantScopeError';
  }
}

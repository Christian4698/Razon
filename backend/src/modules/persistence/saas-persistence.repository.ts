import { PostgresSaasRepository } from "./postgres-saas.repository";

export function createPostgresSaasRepository() {
  return new PostgresSaasRepository();
}

export { initializeSaasPersistence, flushSaasPersistence, saasPersistenceStatus } from "./saas-persistence.manager";
export type { SaasPersistenceSnapshot, SaasPersistenceRepository } from "./saas-persistence.types";

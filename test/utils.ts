import { Pool } from "pg"

export function mockConnect(pool: Pool) {
  jest.spyOn(pool, "connect").mockImplementation(() => ({
    release: jest.fn(),
  }))
  return pool
}

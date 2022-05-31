import { Pool } from "pg"

export function mockConnect(pool: Pool) {
  const mock = {
    release: jest.fn(),
  }
  jest.spyOn(pool, "connect").mockImplementation(() => mock)
  return mock
}

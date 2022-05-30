import { test } from "./components"
import { mockConnect } from "./utils"

test("pg component", function ({ components }) {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when starting a database", () => {
    it("should call the connect method on the pool", async () => {
      const { pg } = components
      const pool = pg.getPool()

      mockConnect(pool)
      await pg.start()

      expect(pool.connect).toHaveBeenCalled()
    })
  })

  describe("when querying a database", () => {
    it("should be true", () => {
      expect(true).toBe(true)
    })
  })

  describe("when streaming a query from a database", () => {
    it("should be true", () => {
      expect(true).toBe(true)
    })
  })

  xdescribe("when migrating a database", () => {})

  describe("when stopping a database", () => {
    it("should be true", () => {
      expect(true).toBe(true)
    })
  })
})

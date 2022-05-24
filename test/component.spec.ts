import { test } from "./components"

test("subraph component", function ({ components, stubComponents }) {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when querying a database", () => {
    it("should be true", () => {
      expect(true).toBe(true)
    })
  })
})

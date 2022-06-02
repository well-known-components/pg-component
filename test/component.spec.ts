import { Pool } from "pg"
import SQL from "sql-template-strings"
import { setTimeout } from "timers/promises"
import { createPgComponent, IPgComponent } from "../src"
import { logger, test } from "./components"
import { mockConnect } from "./utils"

jest.mock("timers/promises")

test("pg component", function ({ components }) {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when starting a database", () => {
    describe("and it's connected successfully", () => {
      it("should call the connect method on the pool", async () => {
        const { pg } = components
        const pool = pg.getPool()

        mockConnect(pool)
        await pg.start()

        expect(pool.connect).toHaveBeenCalledTimes(1)
      })

      it("should release the connect client", async () => {
        const { pg } = components
        const pool = pg.getPool()

        const db = mockConnect(pool)
        await pg.start()

        expect(db.release).toHaveBeenCalledTimes(1)
      })
    })

    describe("and the connect fails", () => {
      it("should release the connect client", async () => {
        const { pg } = components
        const errorMessage = "Error message"
        const pool = pg.getPool()

        jest.spyOn(pool, "connect").mockImplementation(async () => {
          throw new Error(errorMessage)
        })

        await expect(pg.start()).rejects.toThrow(errorMessage)
        expect(logger.error).toHaveBeenCalledWith(
          `An error occurred trying to open the database. Error: '${errorMessage}'`
        )
      })
    })
  })

  describe("when querying a database", () => {
    let queryResult: { rows: Record<string, string>[]; rowCount: number }

    beforeEach(() => {
      const { pg } = components
      const pool = pg.getPool()

      const rows = [{ some: "object" }, { other: "thing" }]

      queryResult = {
        rows,
        rowCount: rows.length,
      }

      jest.spyOn(pool, "query").mockImplementationOnce(() => queryResult)
    })

    describe("and the query is a string value", () => {
      const query = "SELECT * FROM table;"

      it("should call the pool query method with it", async () => {
        const { pg } = components
        await pg.query(query)
        expect(pg.getPool().query).toHaveBeenCalledWith(query)
      })

      it("should return the row and the count", async () => {
        const { pg } = components
        const result = await pg.query(query)
        expect(result).toEqual(queryResult)
      })
    })

    describe("and the query is an sql template", () => {
      const query = SQL`SELECT * FROM table;`

      it("should call the pool query method with it", async () => {
        const { pg } = components
        await pg.query(query)
        expect(pg.getPool().query).toHaveBeenCalledWith(query)
      })

      it("should return the row and the count", async () => {
        const { pg } = components
        const result = await pg.query(query)
        expect(result).toEqual(queryResult)
      })
    })

    describe("and a duration timer is supplied", () => {
      const query = SQL`SELECT * FROM table;`
      const queryNameLabel = "query name label"
      let metricEnd: jest.Mock

      beforeEach(() => {
        const { metrics } = components
        metricEnd = jest.fn()
        jest.spyOn(metrics, "startTimer").mockImplementation(() => ({
          end: metricEnd,
        }))
      })

      it("should return the row and the count", async () => {
        const { pg } = components
        const result = await pg.query(query, queryNameLabel)
        expect(result).toEqual(queryResult)
      })

      it("should start the metric timer", async () => {
        const { pg, metrics } = components
        await pg.query(query, queryNameLabel)

        expect(metrics.startTimer).toHaveBeenCalledWith("dcl_db_query_duration_seconds", {
          query: queryNameLabel,
        })
      })

      describe("and the query works", () => {
        it("should end the metric timer with success", async () => {
          const { pg } = components
          await pg.query(query, queryNameLabel)

          expect(metricEnd).toHaveBeenCalledWith({ status: "success" })
        })
      })

      describe("and the query explodes", () => {
        it("should end the metric timer with error", async () => {
          const { pg } = components

          const pool = pg.getPool()
          ;(pool.query as jest.Mock).mockReset().mockImplementation(() => {
            throw new Error("Wrong query")
          })
          try {
            await pg.query(query, queryNameLabel)
          } catch (error) {}

          expect(metricEnd).toHaveBeenCalledWith({ status: "error" })
        })
      })
    })
  })

  describe("when streaming a query from a database", () => {
    it("should be true", () => {
      expect(true).toBe(true)
    })
  })

  describe("when stopping a database", () => {
    let pg: IPgComponent
    let pool: Pool

    beforeEach(async () => {
      const { logs, config, metrics } = components

      pg = await createPgComponent({ logs, config, metrics })
      pool = pg.getPool()
      jest.spyOn(pool, "end")
    })

    describe("and stopping goes right", () => {
      it("should call the pool end method", async () => {
        await pg.stop()
        expect(pool.end).toHaveBeenCalled()
      })
    })

    describe("and it's stopped more than once", () => {
      it("should log an error explaining the situation", async () => {
        await pg.stop()
        await pg.stop()
        await pg.stop()

        expect(logger.error).toHaveBeenCalledWith("Stop called more than once")
        expect(logger.error).toHaveBeenCalledTimes(2)
      })

      it("should call end only once", async () => {
        await pg.stop()
        await pg.stop()
        await pg.stop()

        expect(pool.end).toHaveBeenCalledTimes(1)
      })
    })

    describe("and there're pending queries", () => {
      describe("and the waitingCount is still active before ending", () => {
        const queue = [1, 2]

        beforeEach(() => {
          ;(pool as any)._pendingQueue = queue
          ;(setTimeout as jest.Mock).mockImplementation(async (time: number) => {
            if (time === 200) {
              queue.pop()
            }
          })
        })

        it("should wait 200ms per waiting query", async () => {
          await pg.stop()
          expect(setTimeout).toHaveBeenNthCalledWith(1, 200)
          expect(setTimeout).toHaveBeenNthCalledWith(2, 200)
          expect(setTimeout).toHaveBeenCalledTimes(2)
        })
      })

      describe("and the totalCount is still active before ending", () => {
        let resolve: Function
        const clients = [1, 2, 3]

        beforeEach(() => {
          const promise = new Promise((done) => {
            resolve = done
          })
          ;(pool.end as jest.Mock).mockImplementationOnce(() => promise)
          ;(pool as any)._clients = clients
          ;(setTimeout as jest.Mock).mockImplementation(async (time: number) => {
            if (time === 1000) {
              clients.pop()
              if (clients.length === 0) {
                resolve()
              }
            }
          })
        })

        it("should wait 1000ms after the end for each type of idle count", async () => {
          await pg.stop()

          expect(setTimeout).toHaveBeenNthCalledWith(1, 1000)
          expect(setTimeout).toHaveBeenNthCalledWith(2, 1000)
          expect(setTimeout).toHaveBeenNthCalledWith(3, 1000)
          expect(setTimeout).toHaveBeenCalledTimes(3)
        })
      })
    })
  })
})

import { IBaseComponent, IConfigComponent, ILoggerComponent, IDatabase } from "@well-known-components/interfaces"
import { Client, Pool, PoolConfig } from "pg"
import QueryStream from "pg-query-stream"
import { SQLStatement } from "sql-template-strings"
import { setTimeout } from "timers/promises"
import { runReportingQueryDurationMetric } from "./utils"
import { IPgComponent, IMetricsComponent, QueryStreamWithCallback } from "./types"

export * from "./types"
export * from "./metrics"

export function createTestDatabaseComponent(): IPgComponent {
  return {
    async query() {
      throw new Error("Not implemented")
    },
    async *streamQuery() {
      throw new Error("Not implemented")
    },
    async start() {},
    async stop() {},
  }
}

export async function createPgComponent(
  components: createPgComponent.NeededComponents,
  options?: PoolConfig
): Promise<IPgComponent & IBaseComponent> {
  const { config, logs } = components
  const logger = logs.getLogger("pg-component")

  // Environment
  const [port, host, database, user, password, idleTimeoutMillis, query_timeout] = await Promise.all([
    config.getNumber("PG_COMPONENT_PSQL_PORT"),
    config.getString("PG_COMPONENT_PSQL_HOST"),
    config.getString("PG_COMPONENT_PSQL_DATABASE"),
    config.getString("PG_COMPONENT_PSQL_USER"),
    config.getString("PG_COMPONENT_PSQL_PASSWORD"),
    config.getNumber("PG_COMPONENT_IDLE_TIMEOUT"),
    config.getNumber("PG_COMPONENT_QUERY_TIMEOUT"),
  ])
  const defaultOptions = { port, host, database, user, password, idleTimeoutMillis, query_timeout }

  const STREAM_QUERY_TIMEOUT = await config.getNumber("PG_COMPONENT_STREAM_QUERY_TIMEOUT")
  const GRACE_PERIODS = (await config.getNumber("PG_COMPONENT_GRACE_PERIODS")) || 10

  const finalOptions = { ...defaultOptions, ...options }

  // Config
  const pool: Pool = new Pool(finalOptions)

  // Methods
  async function start() {
    try {
      const db = await pool.connect()
      db.release()
    } catch (error) {
      logger.error("An error occurred trying to open the database. Did you run the migrations?")
      throw error
    }
  }

  async function query<T>(sql: string): Promise<IDatabase.IQueryResult<T>>
  async function query<T>(sql: SQLStatement, durationQueryNameLabel?: string): Promise<IDatabase.IQueryResult<T>>
  async function query<T>(
    sql: string | SQLStatement,
    durationQueryNameLabel?: string
  ): Promise<IDatabase.IQueryResult<T>> {
    const rows = durationQueryNameLabel
      ? await runReportingQueryDurationMetric(components, durationQueryNameLabel, () => pool.query<T>(sql))
      : await pool.query<T>(sql)

    return {
      rows: rows.rows,
      rowCount: rows.rowCount,
    }
  }

  async function* streamQuery<T>(sql: SQLStatement, config?: { batchSize?: number }): AsyncGenerator<T> {
    const client = new Client({
      ...finalOptions,
      query_timeout: STREAM_QUERY_TIMEOUT,
    })
    await client.connect()

    try {
      // https://github.com/brianc/node-postgres/issues/1860
      // Uncaught TypeError: queryCallback is not a function
      // finish - OK, this call is necessary to finish the query when we configure query_timeout due to a bug in pg
      // finish - with error, this call is necessary to finish the query when we configure query_timeout due to a bug in pg
      const stream = new QueryStream(sql.text, sql.values, config) as QueryStreamWithCallback

      stream.callback = function () {
        // noop
      }

      try {
        client.query(stream)

        for await (const row of stream) {
          yield row
        }

        stream.destroy()
        stream.callback(undefined, undefined)
      } catch (err) {
        stream.callback(err, undefined)
        throw err
      }
    } finally {
      await client.end()
    }
  }

  let didStop = false

  async function stop() {
    if (didStop) {
      logger.error("Stop called twice")
      return
    }
    didStop = true

    let gracePeriods = GRACE_PERIODS

    while (gracePeriods > 0 && pool.waitingCount > 0) {
      logger.debug("Draining connections", {
        waitingCount: pool.waitingCount,
        gracePeriods,
      })
      await setTimeout(200)
      gracePeriods -= 1
    }

    const promise = pool.end()
    let finished = false

    promise.finally(() => {
      finished = true
    })

    while (!finished && pool.totalCount | pool.idleCount | pool.waitingCount) {
      if (pool.totalCount) {
        logger.log("Draining connections", {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        })
        await setTimeout(1000)
      }
    }

    await promise
  }

  return {
    query,
    streamQuery,
    start,
    stop,
  }
}

/**
 * @public
 */
export namespace createPgComponent {
  export type NeededComponents = {
    logs: ILoggerComponent
    config: IConfigComponent
    metrics: IMetricsComponent
  }
}

import { Pool } from 'pg'
import SQL from 'sql-template-strings'
import { setTimeout } from 'timers/promises'
import { createPgComponent, IPgComponent, metricDeclarations, Options } from '../src'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { createConsoleLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'

jest.mock('timers/promises')

async function startComponents(components: any) {
  for (const i in components) {
    await components[i].start?.()
  }
}

async function stopComponents(components: any) {
  for (const i in components) {
    await components[i].stop?.()
    delete components[i]
  }
}

export const GRACE_PERIODS = 3

beforeEach(async () => {
  jest.resetAllMocks()
})

async function initComponents(options?: Options) {
  const config = createConfigComponent(process.env, {
    PG_COMPONENT_PSQL_CONNECTION_STRING: 'postgres://postgres:pass1234@127.0.0.1:15432/test',
    PG_COMPONENT_GRACE_PERIODS: GRACE_PERIODS.toString()
  })
  const logs = await createConsoleLogComponent({})
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const pg = await createPgComponent({ logs, config, metrics }, options)

  return { config, logs, metrics, pg }
}

test('should run migrations UP', async () => {
  const components = await initComponents({
    migration: {
      migrationsTable: 'pgmigrations',
      dir: __dirname + '/migrations',
      direction: 'up'
    }
  })

  await startComponents(components)

  await components.pg.query('SELECT * FROM jobs')

  await stopComponents(components)
})

test('should return notices and the client keeps working', async () => {
  const components = await initComponents({
    migration: {
      migrationsTable: 'pgmigrations',
      dir: __dirname + '/migrations',
      direction: 'up'
    }
  })

  await startComponents(components)

  await Promise.all(new Array(100).fill(null).map(async () => {
    const tableName = `inexistenttable_${(Math.random() * 10000).toFixed()}`
    const withNotices = await components.pg.query(`DROP TABLE IF EXISTS ${tableName}`)

    expect(withNotices.notices[0].message).toEqual(`table "${tableName}" does not exist, skipping`)
  }))

  // regular queries keep working
  await components.pg.query(`SELECT * FROM jobs`)

  await stopComponents(components)
})

test('should run migrations DOWN', async () => {
  const components = await initComponents({
    migration: {
      migrationsTable: 'pgmigrations',
      dir: __dirname + '/migrations',
      direction: 'down'
    }
  })

  await startComponents(components)
  await expect(() => components.pg.query('SELECT * FROM jobs')).rejects.toThrow('relation "jobs" does not exist')
  await stopComponents(components)
})

test('streaming works', async () => {
  const components = await initComponents({
    migration: {
      migrationsTable: 'pgmigrations',
      dir: __dirname + '/migrations',
      direction: 'up'
    }
  })

  await startComponents(components)

  await components.pg.query(`INSERT INTO jobs (name) VALUES ('menduz'), ('hugo');`)

  const v: any[] = []

  for await (const elem of components.pg.streamQuery(SQL`SELECT * FROM jobs`)) {
    v.push(elem)
  }

  expect(v).toHaveLength(2)

  await stopComponents(components)
})

xdescribe('when starting a database', () => {
  xdescribe('and migration options are supplied', () => { })

  xdescribe("and it's connected successfully", () => {
    it('should call the connect method on the pool', async () => {
      const { pg } = await initComponents({})
      const pool = pg.getPool()

      await pg.start()

      expect(pool.connect).toHaveBeenCalledTimes(1)
      await stopComponents({ pg })
    })

    xit('should release the connect client', async () => {
      const { pg } = await initComponents({})
      const pool = pg.getPool()

      await pg.start()

      // expect(db.release).toHaveBeenCalledTimes(1)
    })
  })

  xdescribe('and the connect fails', () => {
    it('should release the connect client', async () => {
      const { pg } = await initComponents({})
      const errorMessage = 'Error message'
      const pool = pg.getPool()

      jest.spyOn(pool, 'connect').mockImplementation(async () => {
        throw new Error(errorMessage)
      })

      await expect(pg.start()).rejects.toThrow(errorMessage)
      // expect(logger.error).toHaveBeenCalledWith(
      //  `An error occurred trying to open the database. Error: '${errorMessage}'`
      // )
    })
  })
})

xdescribe('when querying a database', () => {
  let queryResult: { rows: Record<string, string>[]; rowCount: number }

  beforeEach(async () => {
    const { pg } = await initComponents({})
    const pool = pg.getPool()

    const rows = [{ some: 'object' }, { other: 'thing' }]

    queryResult = {
      rows,
      rowCount: rows.length
    }

    jest.spyOn(pool, 'query').mockImplementationOnce(() => queryResult)
  })

  describe('and the query is a string value', () => {
    const query = 'SELECT * FROM table;'

    it('should call the pool query method with it', async () => {
      const { pg } = await initComponents({})
      await pg.query(query)
      expect(pg.getPool().query).toHaveBeenCalledWith(query)
    })

    it('should return the row and the count', async () => {
      const { pg } = await initComponents({})
      const result = await pg.query(query)
      expect(result).toEqual(queryResult)
    })
  })

  describe('and the query is an sql template', () => {
    const query = SQL`SELECT * FROM table;`

    it('should call the pool query method with it', async () => {
      const { pg } = await initComponents({})
      await pg.query(query)
      expect(pg.getPool().query).toHaveBeenCalledWith(query)
    })

    it('should return the row and the count', async () => {
      const { pg } = await initComponents({})
      const result = await pg.query(query)
      expect(result).toEqual(queryResult)
    })
  })

  describe('and a duration timer is supplied', () => {
    const query = SQL`SELECT * FROM table;`
    const queryNameLabel = 'query name label'
    let metricEnd: jest.Mock

    it('should return the row and the count', async () => {
      const { pg } = await initComponents({})
      const result = await pg.query(query, queryNameLabel)
      expect(result).toEqual(queryResult)
    })

    it('should start the metric timer', async () => {
      const { pg, metrics } = await initComponents({})
      await pg.query(query, queryNameLabel)

      expect(metrics.startTimer).toHaveBeenCalledWith('dcl_db_query_duration_seconds', {
        query: queryNameLabel
      })
    })

    describe('and the query works', () => {
      it('should end the metric timer with success', async () => {
        const { pg } = await initComponents({})
        await pg.query(query, queryNameLabel)

        expect(metricEnd).toHaveBeenCalledWith({ status: 'success' })
      })
    })

    describe('and the query explodes', () => {
      it('should end the metric timer with error', async () => {
        const { pg } = await initComponents({})

        const pool = pg.getPool()
          ; (pool.query as jest.Mock).mockReset().mockImplementation(() => {
            throw new Error('Wrong query')
          })
        try {
          await pg.query(query, queryNameLabel)
        } catch (error) { }

        expect(metricEnd).toHaveBeenCalledWith({ status: 'error' })
      })
    })
  })
})

xdescribe('when stopping a database', () => {
  let pg: IPgComponent
  let pool: Pool

  describe('and stopping goes right', () => {
    it('should call the pool end method', async () => {
      await pg.stop()
      expect(pool.end).toHaveBeenCalled()
    })
  })

  describe("and it's stopped more than once", () => {
    it('should log an error explaining the situation', async () => {
      await pg.stop()
      await pg.stop()
      await pg.stop()

      // expect(logger.error).toHaveBeenCalledWith("Stop called more than once")
      // expect(logger.error).toHaveBeenCalledTimes(2)
    })

    it('should call end only once', async () => {
      await pg.stop()
      await pg.stop()
      await pg.stop()

      expect(pool.end).toHaveBeenCalledTimes(1)
    })
  })

  describe("and there're pending queries", () => {
    describe('and the waitingCount is still active before ending', () => {
      const queue = [1, 2]

      beforeEach(() => {
        ; (pool as any)._pendingQueue = queue
          ; (setTimeout as jest.Mock).mockImplementation(async (time: number) => {
            if (time === 200) {
              queue.pop()
            }
          })
      })

      it('should wait 200ms per waiting query', async () => {
        await pg.stop()
        expect(setTimeout).toHaveBeenNthCalledWith(1, 200)
        expect(setTimeout).toHaveBeenNthCalledWith(2, 200)
        expect(setTimeout).toHaveBeenCalledTimes(2)
      })
    })

    describe('and the totalCount is still active before ending', () => {
      let resolve: Function
      const clients = [1, 2, 3]

      beforeEach(() => {
        const promise = new Promise((done) => {
          resolve = done
        })
          ; (pool.end as jest.Mock).mockImplementationOnce(() => promise)
          ; (pool as any)._clients = clients
          ; (setTimeout as jest.Mock).mockImplementation(async (time: number) => {
            if (time === 1000) {
              clients.pop()
              if (clients.length === 0) {
                resolve()
              }
            }
          })
      })

      it('should wait 1000ms after the end for each type of idle count', async () => {
        await pg.stop()

        expect(setTimeout).toHaveBeenNthCalledWith(1, 1000)
        expect(setTimeout).toHaveBeenNthCalledWith(2, 1000)
        expect(setTimeout).toHaveBeenNthCalledWith(3, 1000)
        expect(setTimeout).toHaveBeenCalledTimes(3)
      })
    })
  })
})

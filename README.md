# pg-component

A port used to query [pg](https://www.postgresql.org/).

## API

### Create

To create the component you have the option of:

- Supplying any `PoolConfig` options you want. This are related 1:1 with [node-postgres](https://node-postgres.com/api/pool) implementation, which in turn are all variables [Postgres](https://www.postgresql.org/) supports
- Supplying any `RunnerOption`. This are related 1:1 with [node-pg-migrate](https://github.com/salsita/node-pg-migrate) implementation and will be used for [migrations](#migrations)

```ts
await createPgComponent({ config, logs, metrics } /* optional config here */)

// A possible optional'd look like:
const config = {
  pool: {
    user: "admin",
    password: "admin",
    database: "really_secure",
  },
  migrate: {
    databaseUrl: connectionString,
    dir: __dirname,
    migrationsTable: "pgmigrations",
    ignorePattern: ".*\\.ts",
    direction: "up",
  },
}
```

### Start

You'd normally won't have to call this function, as that is taken care by the [`Lifecycle.run`](https://github.com/well-known-components/interfaces) method. But the method will:

- Try to run [migrations](#migrations) ONLY IF you supplied migration options when creating the component
- Start an internal pool of connections with the database

### Query

You have two options when querying the database, querying directly and streaming a query.

**Direct query**

the API looks like this

```ts
  query<T>(sql: string): Promise<IDatabase.IQueryResult<T>>
  query<T>(sql: SQLStatement, durationQueryNameLabel?: string): Promise<IDatabase.IQueryResult<T>>
```

Using a [template string](https://github.com/felixfbecker/node-sql-template-strings#readme) is recommended, as it mitigates possible SQL injection problems, by using SQL placeholders in the final query when interpolating values

```ts
const id = getIdFromUnreliableSource()

pg.query<TableType>(SQL`SELECT * FROM table WHERE id = ${id}`) // this results in ['SELECT * FROM table WHERE id = $1', id]
```

suppliying a `durationQueryNameLabel` will trigger a metrics increment with that name.

**Streaming a query**

This is only useful if you need to query a large amount of columns and expect to have a hit in performance. The API is similar

```ts
  streamQuery<T = any>(sql: SQLStatement, config?: { batchSize?: number }): AsyncGenerator<T>
```

but it returns a generator. To use it:

```ts
for await (const row of database.streamQuery<TableType>(query, { batchSize: 10000 })) {
  yield row.some_value
}
```

## Migrations

If you want to have migrations for your database, this component uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) as a proxy. For this you'll need to:

- Supply the necessary [runner options](#create) on your component creation. You'd normaly want to use 'up' as a migration direction
- For creating new migrations or any other type of interaction you can use the [node-pg-migrate](https://github.com/salsita/node-pg-migrate) binary. To use we recommend:

**package.json**

```json
"scripts": {
  "migrate": "node-pg-migrate --database-url-var PG_COMPONENT_PSQL_CONNECTION_STRING --envPath .env -j ts --tsconfig tsconfig.json"
}
```

**use**

```bash
$ npm run migrate create create-your-table
```

## Configuration

It supports the following ENV variables:

First everything related with connecting to [Postgres](https://www.postgresql.org/):

- `PG_COMPONENT_PSQL_CONNECTION_STRING`
- `PG_COMPONENT_PSQL_PORT`
- `PG_COMPONENT_PSQL_HOST`
- `PG_COMPONENT_PSQL_DATABASE`
- `PG_COMPONENT_PSQL_USER`
- `PG_COMPONENT_PSQL_PASSWORD`

You'll probably use either the CONNECTION_STRING **or** the other params and not both.

Then the variables related to [Postgres](https://www.postgresql.org/)'s query timeouts:

- `PG_COMPONENT_IDLE_TIMEOUT`
- `PG_COMPONENT_QUERY_TIMEOUT`
- `PG_COMPONENT_STREAM_QUERY_TIMEOUT`

Then the variables related to this component's implementation

- `PG_COMPONENT_GRACE_PERIODS`: how many retries the component we'll give for a gracefull stop of the database. It'll wait `200ms` per each grace period. Defaults to `10`

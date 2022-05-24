import { IBaseComponent, IConfigComponent, ILoggerComponent } from "@well-known-components/interfaces"
import { PoolConfig } from "pg"
import { IPgComponent, IMetricsComponent } from "./types"

export * from "./types"
export * from "./metrics"

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

  return {} as any
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

import { IDatabase, IMetricsComponent as IBaseMetricsComponent } from "@well-known-components/interfaces"
import { Pool } from "pg"
import { SQLStatement } from "sql-template-strings"
import QueryStream from "pg-query-stream"
import { metricDeclarations } from "./metrics"

export type QueryStreamWithCallback = QueryStream & { callback: Function }

/**
 * @public
 */
export interface IPgComponent extends IDatabase {
  start(): Promise<void>

  query<T>(sql: string): Promise<IDatabase.IQueryResult<T>>
  query<T>(sql: SQLStatement, durationQueryNameLabel?: string): Promise<IDatabase.IQueryResult<T>>
  streamQuery<T = any>(sql: SQLStatement, config?: { batchSize?: number }): AsyncGenerator<T>
  getPool(): Pool

  stop(): Promise<void>
}

/**
 * @public
 */
export namespace IPgComponent {
  /**
   * @public
   */
  export type Composable = {
    pg: IPgComponent
  }
}

/**
 * @public
 */
export type IMetricsComponent = IBaseMetricsComponent<keyof typeof metricDeclarations>

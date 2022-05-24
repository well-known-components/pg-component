import { IDatabase, IMetricsComponent as IBaseMetricsComponent } from "@well-known-components/interfaces"
import { SQLStatement } from "sql-template-strings"
import QueryStream from "pg-query-stream"
import { metricDeclarations } from "./metrics"

export type QueryStreamWithCallback = QueryStream & { callback: Function }

/**
 * @public
 */
export interface IPgComponent extends IDatabase {
  query<T>(sql: string): Promise<IDatabase.IQueryResult<T>>
  query<T>(sql: SQLStatement, durationQueryNameLabel?: string): Promise<IDatabase.IQueryResult<T>>
  streamQuery<T = any>(sql: SQLStatement, config?: { batchSize?: number }): AsyncGenerator<T>

  start(): Promise<void>
  stop(): Promise<void>
}

/**
 * @public
 */
export namespace ISubgraphComponent {
  /**
   * @public
   */
  export type Composable = {
    subgraph: IPgComponent
  }
}

/**
 * @public
 */
export type IMetricsComponent = IBaseMetricsComponent<keyof typeof metricDeclarations>

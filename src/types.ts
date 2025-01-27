import { IDatabase, IMetricsComponent as IBaseMetricsComponent } from '@well-known-components/interfaces'
import { Pool, PoolConfig } from 'pg'
import { RunnerOption } from 'node-pg-migrate'
import { SQLStatement } from 'sql-template-strings'
import QueryStream from 'pg-query-stream'
import { metricDeclarations } from './metrics'

/**
 * @internal
 */
export type QueryStreamWithCallback = QueryStream & { callback: Function }

/**
 * @public
 */
export type Options = Partial<{ pool: PoolConfig; migration: Omit<RunnerOption, 'databaseUrl' | 'dbClient'> }>

/**
 * @public
 */
export interface IPgComponent extends IDatabase {
  start(): Promise<void>

  query<T extends Record<string, any>>(sql: string): Promise<IDatabase.IQueryResult<T>>
  query<T extends Record<string, any>>(
    sql: SQLStatement,
    durationQueryNameLabel?: string
  ): Promise<IDatabase.IQueryResult<T>>
  streamQuery<T = any>(sql: SQLStatement, config?: { batchSize?: number }): AsyncGenerator<T>

  /**
   * @internal
   */
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

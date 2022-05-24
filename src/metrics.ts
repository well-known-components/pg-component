import { IMetricsComponent } from "@well-known-components/interfaces"

/**
 * Metrics declarations, needed for your IMetricsComponent
 * @public
 */
export const metricDeclarations: IMetricsComponent.MetricsRecordDefinition<string> = {
  dcl_db_query_duration_seconds: {
    help: "Histogram of query duration to the database in seconds per query",
    type: IMetricsComponent.HistogramType,
    labelNames: ["query", "status"], // status=(success|error)
  },
}

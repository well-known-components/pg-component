import { IMetricsComponent } from "./types"

export async function runReportingQueryDurationMetric<T>(
  components: { metrics: IMetricsComponent },
  queryNameLabel: string,
  functionToRun: () => Promise<T>
): Promise<T> {
  const { metrics } = components

  const { end: endTimer } = metrics.startTimer("dcl_db_query_duration_seconds", {
    query: queryNameLabel,
  })
  try {
    const res = await functionToRun()
    endTimer({ status: "success" })
    return res
  } catch (err) {
    endTimer({ status: "error" })
    throw err
  }
}

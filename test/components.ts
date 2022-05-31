// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { ILoggerComponent } from "@well-known-components/interfaces"
import { createRunner } from "@well-known-components/test-helpers"
import { createConfigComponent } from "@well-known-components/env-config-provider"
import { createMetricsComponent } from "@well-known-components/metrics"
import { IPgComponent } from "../src/types"
import { createPgComponent, metricDeclarations } from "../src"
import { mockConnect } from "./utils"

export type GlobalContext = { components: IPgComponent.Composable }

export type TestComponents = createPgComponent.NeededComponents & IPgComponent.Composable

export const SUBGRAPH_URL = "https://mock-subgraph.url.com"
export const GRACE_PERIODS = 3

export const logger = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}
function createTestConsoleLogComponent(): ILoggerComponent {
  return {
    getLogger: () => logger,
  }
}

/**
 * Behaves like Jest "describe" function, used to describe a test for a
 * use case, it creates a whole new program and components to run an
 * isolated test.
 *
 * State is persistent within the steps of the test.
 */
export const test = createRunner<TestComponents>({
  async main({ startComponents }) {
    await startComponents()
  },
  async initComponents(): Promise<TestComponents> {
    const config = createConfigComponent(process.env, {
      PG_COMPONENT_GRACE_PERIODS: GRACE_PERIODS.toString(),
    })

    const logs = createTestConsoleLogComponent()
    const metrics = await createMetricsComponent(metricDeclarations, { config })

    const pg = await createPgComponent({ config, logs, metrics })

    const pool = pg.getPool()
    mockConnect(pool)

    return {
      config,
      logs,
      metrics,
      pg,
    }
  },
})

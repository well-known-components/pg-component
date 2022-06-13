#!/usr/bin/env ts-node

import * as path from "path"
import { spawn } from "child_process"

enum Method {
  MIGRATE = "migrate",
}

export const DEFAULT_SPAWN_ARGS = [
  "--database-url-var",
  "PG_COMPONENT_PSQL_CONNECTION_STRING",
  "--migration-file-language",
  "ts",
  "--envPath",
  ".env",
  "--tsconfig",
  "tsconfig.json",
  "--migrations-dir",
  "./migrations",
  "--ignore-pattern",
  "\\..*|.*migrate(.ts)?",
]

export function migrate(commandArguments: string[]) {
  const spawnArgs = [...DEFAULT_SPAWN_ARGS, ...commandArguments]

  console.log("Running command:")
  console.dir(`node-pg-migrate ${spawnArgs.join(" ")}`)

  const child = spawn(path.resolve(__dirname, "node_modules", "bin", "node-pg-migrate"), spawnArgs)

  child.stdout.on("data", (data: any) => {
    console.log(data.toString())
  })

  child.stderr.on("data", (data: any) => {
    console.log(data.toString())
  })

  child.on("error", (error: Error) => {
    console.log(error.message)
  })

  child.on("close", (code: number, signal: string) => {
    console.log(`child process exited with code: ${code} and signal: ${signal}`)
  })

  return child
}

if (require.main === module) {
  const method = process.argv[2] || ""

  switch (method) {
    case Method.MIGRATE:
      migrate(process.argv.slice(3))
      break
    default:
      console.error(`Unkown method "${method}". Options: ${Object.values(Method)}`)
  }
}

import { ChildProcess, spawn } from "child_process"
import { EventEmitter } from "stream"
import { DEFAULT_SPAWN_ARGS, migrate } from "../src/exec"

jest.mock("child_process")

describe("migrate", () => {
  let dirname: string
  let childProcess: ChildProcess

  beforeEach(() => {
    // replace the current dirname with the path where the migrate was run
    dirname = __dirname.replace(/\/test$/, "")

    // We're constructing a barebones child process. If you ever need more control over this, a better implementation will be required
    childProcess = new EventEmitter() as any
    childProcess.stdout = new EventEmitter() as any
    childProcess.stderr = new EventEmitter() as any

    jest.spyOn(childProcess, "on")
    jest.spyOn(childProcess.stdout, "on")
    jest.spyOn(childProcess.stderr, "on")

    jest.spyOn(console, "log")
    ;(spawn as jest.Mock).mockReturnValueOnce(childProcess)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it("should spawn a local version of node-pg-migrate", () => {
    migrate([])
    expect(spawn).toHaveBeenCalledWith(dirname + "/node_modules/node-pg-migrate/bin", DEFAULT_SPAWN_ARGS)
  })

  it("should spawn a appending the supplied arguments", () => {
    migrate(["--some", "arg"])
    expect(spawn).toHaveBeenCalledWith(dirname + "/node_modules/node-pg-migrate/bin", [
      ...DEFAULT_SPAWN_ARGS,
      "--some",
      "arg",
    ])
  })

  it("should append a handler for global errors", () => {
    migrate([])
    expect(childProcess.on).toHaveBeenCalledWith("error", expect.any(Function))

    const message = "some data"
    childProcess.emit("error", new Error(message))

    expect(console.log).toHaveBeenCalledWith(message)
  })

  it("should append a handler for a global close", () => {
    migrate([])
    expect(childProcess.on).toHaveBeenCalledWith("close", expect.any(Function))

    const code = "A_CODE"
    const signal = "SOME_SIGNAL"
    childProcess.emit("close", code, signal)

    expect(console.log).toHaveBeenCalledWith("child process exited with code: A_CODE and signal: SOME_SIGNAL")
  })

  it("should append a handler for stdout", () => {
    migrate([])
    expect(childProcess.stdout.on).toHaveBeenCalledWith("data", expect.any(Function))

    const message = "some stout data"
    childProcess.stdout.emit("data", message)

    expect(console.log).toHaveBeenCalledWith(message)
  })

  it("should append a handler for stderr", () => {
    migrate([])
    expect(childProcess.stderr.on).toHaveBeenCalledWith("data", expect.any(Function))

    const message = "some stderr data"
    childProcess.stderr.emit("data", message)

    expect(console.log).toHaveBeenCalledWith(message)
  })
})

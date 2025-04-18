import {Plugin} from "#app/app"
import * as Component from "#component"
import * as Range from "#app/range"
import * as System from "#app/system"
import * as Timestep from "../time_step/plugin.ts"
import * as StepBuffer from "#step_buffer"

export class Command<T extends Component.Ref> {
  readonly origin: number | undefined
  readonly data
  readonly step
  readonly ref

  constructor(ref: T, data: Component.ValueOf<T>, step: number) {
    this.ref = ref
    this.data = data
    this.step = step
  }
}

export class Commands {
  #buffers_by_command

  constructor() {
    this.#buffers_by_command = new Map<number, StepBuffer.t>()
  }

  #get_buffer(command_id: number): StepBuffer.t {
    let buffer = this.#buffers_by_command.get(command_id)
    if (buffer === undefined) {
      buffer = StepBuffer.make()
      this.#buffers_by_command.set(command_id, buffer)
    }
    return buffer
  }

  insert(command: Command<Component.Ref>, step: number) {
    let buffer = this.#get_buffer(command.ref.id)
    buffer.insert(step, command)
  }

  drain_to(step: number) {
    this.#buffers_by_command.forEach(buffer => {
      buffer.drain_to(step)
    })
  }
}

export type t = Commands

export let make = () => {
  return new Commands()
}

export let res = Component.ref<t>()

let drain_commands: System.Fn = world => {
  let commands = world.get_resource(res)
  let timestep = world.get_resource(Timestep.res)
  let step = timestep.step()
  commands.drain_to(step)
}

export let read = Range.make(
  System.before(drain_commands),
  System.when(Timestep.logical),
)

export let write = Range.make(
  System.before(read),
  System.after(Timestep.advance),
  System.when(Timestep.logical),
)

export let plugin: Plugin = app => {
  app
    .add_resource(res, make())
    .add_system(drain_commands, System.when(Timestep.logical))
}

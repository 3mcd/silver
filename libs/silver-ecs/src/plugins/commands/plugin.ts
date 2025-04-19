import {Plugin} from "#app/app"
import * as Component from "#component"
import * as Range from "#app/range"
import * as System from "#app/system"
import * as Timestep from "../time_step/plugin.ts"
import * as StepBuffer from "#step_buffer"
import * as Entity from "#entity"

export class Command<U = unknown> {
  readonly origin: number | undefined
  readonly data
  readonly step
  readonly ref

  constructor(ref: Component.Ref<U>, data: U, step: number) {
    this.ref = ref
    this.data = data
    this.step = step
  }
}

export let Despawn = Component.ref<Entity.t>()

export class Commands {
  #buffers_by_command_id

  constructor() {
    this.#buffers_by_command_id = new Map<number, StepBuffer.t<Command>>()
  }

  #get_buffer(command_id: number): StepBuffer.t {
    let buffer = this.#buffers_by_command_id.get(command_id)
    if (buffer === undefined) {
      buffer = StepBuffer.make()
      this.#buffers_by_command_id.set(command_id, buffer)
    }
    return buffer
  }

  insert(command: Command, step = command.step) {
    let buffer = this.#get_buffer(command.ref.id)
    buffer.insert(step, command)
  }

  drain_to(step: number) {
    this.#buffers_by_command_id.forEach(buffer => {
      buffer.drain_to(step)
    })
  }

  read<U>(
    command: Component.Ref<U>,
    step: number,
    iteratee: (value: Command<U>, step: number) => void,
  ) {
    let buffer = this.#get_buffer(command.id) as StepBuffer.t<Command<U>>
    buffer.read_to(step, iteratee)
  }
}

export type t = Commands

export let make = () => {
  return new Commands()
}

export let make_command = <U>(
  ref: Component.Ref<U>,
  data: U,
  step: number,
): Command<U> => {
  return new Command(ref, data, step)
}

export let despawn = <U>(entity: Entity.t, step: number): Command<Entity.t> => {
  return make_command(Despawn, entity, step)
}

export let res = Component.ref<t>()

let drain_commands: System.Fn = world => {
  let commands = world.get_resource(res)
  let timestep = world.get_resource(Timestep.res)
  let step = timestep.step()
  commands.drain_to(step)
}

let despawn_entities: System.Fn = world => {
  let timestep = world.get_resource(Timestep.res)
  let commands = world.get_resource(res)
  let step = timestep.step()
  commands.read(Despawn, step, command => {
    world.despawn(command.data)
  })
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
    .add_system(despawn_entities, System.when(read))
}

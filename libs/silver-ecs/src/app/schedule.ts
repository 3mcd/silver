import * as World from "../world"
import * as Range from "./range"
import * as System from "./system"
import * as SystemGraph from "./system_graph"

class Schedule {
  graph = SystemGraph.make<System.T>()
  stale = true
  system_runs = [] as number[]
  systems = [] as System.T[]
  explicit = new Set<Function>()
}

export type T = Schedule

export let make = () => {
  return new Schedule()
}

export let add_system = (schedule: Schedule, system: System.T | System.Fn) => {
  if (!System.is_system(system)) {
    system = System.make(system)
  }
  // ensure system exists in graph
  SystemGraph.edges(schedule.graph, system)
  // register system dependencies
  system.before.forEach(fn => {
    SystemGraph.add_edge(schedule.graph, system, System.make(fn))
  })
  system.after.forEach(fn => {
    SystemGraph.add_edge(schedule.graph, System.make(fn), system)
  })
  // mark schedule stale to be rebuilt on next `run`
  schedule.stale = true
  schedule.explicit.add(system.fn)
}

export let remove_system = (schedule: Schedule, system: System.Fn) => {
  SystemGraph.remove(schedule.graph, System.make(system))
  schedule.stale = true
}

export let run = (schedule: Schedule, world: World.T) => {
  // rebuild system schedule when stale
  if (schedule.stale) {
    schedule.systems = SystemGraph.build(schedule.graph)
      .filter(s => !Range.is_anchor(s.fn))
      .filter(s => schedule.explicit.has(s.fn))
    schedule.stale = false
  }
  // try to execute each system once
  let total_runs_remaining = 0
  system_loop: for (let i = 0; i < schedule.systems.length; i++) {
    let system = schedule.systems[i]
    let runs = 0
    for (let j = 0; j < system.when.length; j++) {
      let criteria = system.when[j]
      let criteria_res = criteria(world)
      if (!criteria_res) {
        continue system_loop
      }
      if (typeof criteria_res === "number") {
        runs = Math.max(runs, criteria_res)
      }
    }
    if (runs > 1) {
      total_runs_remaining += schedule.system_runs[i] = runs - 1
    }
    system.fn(world)
  }
  // execute additional system runs
  while (total_runs_remaining > 0) {
    system_loop: for (let i = 0; i < schedule.systems.length; i++) {
      let system = schedule.systems[i]
      let runs = schedule.system_runs[i]
      if (runs !== undefined && runs > 0) {
        --total_runs_remaining
        --schedule.system_runs[i]
        for (let j = 0; j < system.when.length; j++) {
          let criteria = system.when[j]
          let criteria_res = criteria(world)
          if (!criteria_res) {
            continue system_loop
          }
        }
        system.fn(world)
      }
    }
  }
}

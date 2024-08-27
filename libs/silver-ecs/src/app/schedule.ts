import * as World from "../world"
import * as SystemGraph from "./system_graph"
import * as System from "./system"
import * as Range from "./range"

class Schedule {
  graph_ = SystemGraph.make<System.T>()
  stale_ = true
  system_runs = [] as number[]
  systems = [] as System.T[]
  explicitly_added_system_fns = new Set<Function>()
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
  SystemGraph.edges(schedule.graph_, system)
  // register system dependencies
  system.before_.forEach(fn => {
    SystemGraph.add_edge(schedule.graph_, system, System.make(fn))
  })
  system.after_.forEach(fn => {
    SystemGraph.add_edge(schedule.graph_, System.make(fn), system)
  })
  // mark schedule stale to be rebuilt on next `run`
  schedule.stale_ = true

  schedule.explicitly_added_system_fns.add(system.fn_)
}

export let remove_system = (schedule: Schedule, system: System.Fn) => {
  SystemGraph.remove(schedule.graph_, System.make(system))
  schedule.stale_ = true
}

export let run = (schedule: Schedule, world: World.T) => {
  // rebuild system schedule when stale
  if (schedule.stale_) {
    schedule.systems = SystemGraph.build(schedule.graph_)
      .filter(s => !Range.is_anchor(s.fn_))
      .filter(s => schedule.explicitly_added_system_fns.has(s.fn_))
    schedule.stale_ = false
  }
  // try to execute each system once
  let runsRemaining = 0
  systemLoop: for (let i = 0; i < schedule.systems.length; i++) {
    let system = schedule.systems[i]
    let runs = 0
    for (let j = 0; j < system.when_.length; j++) {
      let criteria = system.when_[j]
      let criteriaResult = criteria(world)
      if (!criteriaResult) {
        continue systemLoop
      }
      if (typeof criteriaResult === "number") {
        runs = Math.max(runs, criteriaResult)
      }
    }
    if (runs > 1) {
      runsRemaining += schedule.system_runs[i] = runs - 1
    }
    system.fn_(world)
  }
  // execute additional system runs
  while (runsRemaining > 0) {
    systemLoop: for (let i = 0; i < schedule.systems.length; i++) {
      let system = schedule.systems[i]
      let runs = schedule.system_runs[i]
      if (runs !== undefined && runs > 0) {
        --runsRemaining
        --schedule.system_runs[i]
        for (let j = 0; j < system.when_.length; j++) {
          let criteria = system.when_[j]
          let criteriaResult = criteria(world)
          if (!criteriaResult) {
            continue systemLoop
          }
        }
        system.fn_(world)
      }
    }
  }
}

import * as ecs from "silver-ecs/dev"

const world = ecs.make()

// Teams
const Team = ecs.relation()
const team_a = world.spawn()
const team_b = world.spawn()
const team_c = world.spawn()
world.spawn(ecs.type(Team, Team), team_a, team_b)
world.spawn(ecs.type(Team, Team, Team), team_a, team_b, team_c)

const teams: ecs.System = world => {
  const spies = ecs.query(world, ecs.type(Team, Team))
  return () => {
    spies.each(team_a, team_b, spy => {
      console.log(`spy ${spy} is on teams ${team_a} and ${team_b}`)
    })
  }
}

// Family
const Mother = ecs.relation()
const Father = ecs.relation()
const Child = ecs.type(Mother, Father)
const mom = world.spawn()
const dad = world.spawn()
world.spawn(Child, mom, dad)

const family: ecs.System = world => {
  const kids = ecs.query(world, Child, ecs.In())
  return () => {
    kids.each(mom, dad, kid => {
      console.log(`${kid} was born`)
    })
  }
}

// Run
world.step()
ecs.run(world, teams)
ecs.run(world, family)

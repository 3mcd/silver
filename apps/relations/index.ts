import * as ecs from "silver-ecs/dev"

const world = ecs.make()

// Teams
const Team = ecs.relation()
const teamA = world.spawn()
const teamB = world.spawn()
const teamC = world.spawn()
world.spawn(ecs.type(Team, Team), teamA, teamB)
world.spawn(ecs.type(Team, Team, Team), teamA, teamB, teamC)

const teams: ecs.System = world => {
  const spies = ecs.query(world, ecs.type(Team, Team))
  return () => {
    spies.each(teamA, teamB, spy => {
      console.log(`spy ${spy} is on teams ${teamA} and ${teamB}`)
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

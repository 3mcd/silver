import {In, System, make, query, relation, run, type} from "silver-ecs"

const world = make()

// Teams
const Team = relation()
const teamA = world.spawn()
const teamB = world.spawn()
const teamC = world.spawn()
world.spawn(type(Team, Team), teamA, teamB)
world.spawn(type(Team, Team, Team), teamA, teamB, teamC)

const teams: System = world => {
  const spies = query(world, type(Team, Team))
  return () => {
    spies.each(teamA, teamB, spy => {
      console.log(`spy ${spy} is on teams ${teamA} and ${teamB}`)
    })
  }
}

// Family
const Mother = relation()
const Father = relation()
const Child = type(Mother, Father)
const mom = world.spawn()
const dad = world.spawn()
world.spawn(Child, mom, dad)

const family: System = world => {
  const kids = query(world, Child, In())
  return () => {
    kids.each(mom, dad, kid => {
      console.log(`${kid} was born`)
    })
  }
}

// Run
world.step()
run(world, teams)
run(world, family)

import {test, expect} from "vitest"
import * as Entity from "./entity.ts"
import * as EntityRegistry from "./entity_registry.ts"
import * as Buffer from "./buffer.ts"

test("free entities", () => {
  let registry = EntityRegistry.make()
  let alive: Entity.t[] = []
  for (let i = 0; i < 10; i++) {
    alive.push(registry.alloc(1))
  }
  let e0 = registry.alloc(1)
  for (let i = 0; i < 3; i++) {
    alive.push(registry.alloc(1))
  }
  expect(registry.is_alive(e0)).toBe(true)
  registry.free(e0)
  expect(registry.is_alive(e0)).toBe(false)
  let e1 = registry.alloc(1)
  for (let i = 0; i < 5; i++) {
    alive.push(registry.alloc(1))
  }
  expect(registry.is_alive(e1)).toBe(true)
  registry.free(e1)
  expect(registry.is_alive(e1)).toBe(false)
  for (let i = 0; i < alive.length; i++) {
    expect(registry.is_alive(alive[i])).toBe(true)
  }
})

test("check", () => {
  let registry = EntityRegistry.make()
  let e0 = registry.alloc(1)
  let e1 = registry.alloc(1)
  registry.free(e0)
  expect(() => registry.check(e0)).toThrow()
  expect(() => registry.check(e1)).not.toThrow()
})

test("encode/decode", () => {
  let registry_a = EntityRegistry.make()
  registry_a.alloc(1)
  registry_a.alloc(1)
  let buffer = Buffer.make(0, 100)
  EntityRegistry.encode(registry_a, buffer)
  let registry_b = EntityRegistry.decode(buffer)
  expect(registry_a).toEqual(registry_b)
})

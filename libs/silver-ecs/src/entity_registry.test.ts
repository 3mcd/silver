import {test, expect} from "vitest"
import * as Entity from "./entity"
import * as EntityRegistry from "./entity_registry"
import * as Buffer from "./buffer"

test("free entities", () => {
  let registry = EntityRegistry.make()
  let alive: Entity.T[] = []
  for (let i = 0; i < 10; i++) {
    alive.push(EntityRegistry.alloc(registry, 1))
  }
  let e0 = EntityRegistry.alloc(registry, 1)
  for (let i = 0; i < 3; i++) {
    alive.push(EntityRegistry.alloc(registry, 1))
  }
  expect(EntityRegistry.is_alive(registry, e0)).toBe(true)
  EntityRegistry.free(registry, e0)
  expect(EntityRegistry.is_alive(registry, e0)).toBe(false)
  let e1 = EntityRegistry.alloc(registry, 1)
  for (let i = 0; i < 5; i++) {
    alive.push(EntityRegistry.alloc(registry, 1))
  }
  expect(EntityRegistry.is_alive(registry, e1)).toBe(true)
  EntityRegistry.free(registry, e1)
  expect(EntityRegistry.is_alive(registry, e1)).toBe(false)
  for (let i = 0; i < alive.length; i++) {
    expect(EntityRegistry.is_alive(registry, alive[i])).toBe(true)
  }
})

test("check", () => {
  let registry = EntityRegistry.make()
  let e0 = EntityRegistry.alloc(registry, 1)
  let e1 = EntityRegistry.alloc(registry, 1)
  EntityRegistry.free(registry, e0)
  expect(() => EntityRegistry.check(registry, e0)).toThrow()
  expect(() => EntityRegistry.check(registry, e1)).not.toThrow()
})

test("encode/decode", () => {
  let registry_a = EntityRegistry.make()
  EntityRegistry.alloc(registry_a, 1)
  EntityRegistry.alloc(registry_a, 1)
  let buffer = Buffer.make(0, 100)
  EntityRegistry.encode(registry_a, buffer)
  let registry_b = EntityRegistry.decode(buffer)
  expect(registry_a).toEqual(registry_b)
})

import * as ecs from "silver-ecs"
import * as lib from "silver-lib"
import * as three from "three"
import {Instanced, Mesh} from "./schema"
import CameraControls from "camera-controls"

CameraControls.install({THREE: three})

export let scene_system: ecs.System = world => {
  let clock = new three.Clock()
  let scene = new three.Scene()
  let camera = new three.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  )
  camera.position.z = 5
  let renderer = new three.WebGLRenderer()
  let camera_controls = new CameraControls(camera, renderer.domElement)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)
  let ambient_light = new three.AmbientLight(0x404040)
  // White directional light at half intensity shining from the top.
  let directional_light = new three.DirectionalLight(0xffffff, 0.5)
  directional_light.position.set(0, 1, 5)
  scene.add(directional_light)
  scene.add(ambient_light)

  let meshes = ecs.query(world, Mesh, ecs.In())
  let meshes_moved = ecs.query(
    world,
    lib.Position,
    ecs.Is(Mesh),
    ecs.Changed(lib.Position),
  )
  let meshes_rotated = ecs.query(
    world,
    lib.Rotation,
    ecs.Is(Mesh),
    ecs.Changed(lib.Rotation),
  )
  let meshes_by_entity = new Map<ecs.Entity, three.Mesh>()
  return () => {
    renderer.render(scene, camera)
    meshes.each((entity, geometry, material, position, rotation) => {
      let mesh: three.Mesh
      if (world.has(entity, Instanced)) {
        mesh = new three.InstancedMesh(geometry, material, 1_000)
      } else {
        mesh = new three.Mesh(geometry, material)
      }
      mesh.position.set(position.x, position.y, position.z)
      mesh.rotation.set(rotation.x, rotation.y, rotation.z)
      meshes_by_entity.set(entity, mesh)
      scene.add(mesh)
    })
    meshes_moved.each((entity, position) => {
      let mesh = meshes_by_entity.get(entity)
      if (mesh) {
        mesh.position.set(position.x, position.y, position.z)
      }
    })
    meshes_rotated.each((entity, rotation) => {
      let mesh = meshes_by_entity.get(entity)
      if (mesh) {
        mesh.rotation.set(rotation.x, rotation.y, rotation.z)
      }
    })
    let delta = clock.getDelta()
    let camera_controls_updated = camera_controls.update(delta)
    if (camera_controls_updated) {
      renderer.render(scene, camera)
    }
  }
}

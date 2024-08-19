import CameraControls from "camera-controls"
import * as S from "silver-ecs"
import {
  Assert,
  DebugHighlighted,
  DebugSelected,
  Position,
  Rotation,
  Scale,
  Transform,
} from "silver-lib"
import * as three from "three"
import {highlightedMaterial, selectedMaterial} from "./materials"
import {
  ThreeCamera,
  CastsShadow,
  InstanceCount,
  InstanceOf,
  Instanced,
  IsInstance,
  ThreeLight,
  Mesh,
  ReceivesShadow,
} from "./schema"

CameraControls.install({
  THREE: {
    Vector2: three.Vector2,
    Vector3: three.Vector3,
    Vector4: three.Vector4,
    Quaternion: three.Quaternion,
    Matrix4: three.Matrix4,
    Spherical: three.Spherical,
    Box3: three.Box3,
    Sphere: three.Sphere,
    Raycaster: three.Raycaster,
  },
})

let makeRenderer = () => {
  let renderer = new three.WebGLRenderer({
    antialias: true,
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)
  return renderer
}

let renderer = makeRenderer()
renderer.toneMapping = three.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.5
renderer.shadowMap.enabled = true
renderer.shadowMap.type = three.PCFSoftShadowMap

let scene = new three.Scene()

let objectInstances = S.SparseMap.make<S.SparseSet.T<S.Entity>>()
let objectsByEntity = S.SparseMap.make<three.Object3D>()
let entitiesByObject = new WeakMap<three.Object3D, S.Entity>()

export let threeSystem: S.System = world => {
  return () => {
    S.run(world, objectsSystem)
    S.run(world, scaleSystem)
    S.run(world, lightsSystem)
    S.run(world, instanceSystem)
    S.run(world, cameraSystem)
    S.run(world, debugSystem)
  }
}

export let objectsSystem: S.System = world => {
  let meshesIn = S.query(world, Mesh, S.In(), S.Not(InstanceCount))
  let meshesOut = S.query(world, Mesh, S.Out(), S.Not(InstanceCount))
  let transforms = S.query(world, Transform, S.Not(InstanceOf))

  return () => {
    meshesIn.each((entity, geometry, material) => {
      let mesh = new three.Mesh(geometry, material)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      S.SparseMap.set(objectsByEntity, entity, mesh)
      entitiesByObject.set(mesh, entity)
      scene.add(mesh)
    })
    meshesOut.each(entity => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (mesh) {
        scene.remove(mesh)
        S.SparseMap.delete(objectsByEntity, entity)
        entitiesByObject.delete(mesh)
      }
    })
    transforms.each((entity, position, rotation) => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (mesh) {
        mesh.position.set(position.x, position.y, position.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
    })
  }
}

export let scaleSystem: S.System = world => {
  let scaledIn = S.query(world, Scale, S.In())
  return () => {
    scaledIn.each((entity, scale) => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (mesh) {
        mesh.scale.set(scale.x, scale.y, scale.z)
      }
    })
  }
}

export let lightsSystem: S.System = world => {
  let lightsIn = S.query(world, ThreeLight, S.In())
  let lightsOut = S.query(world, ThreeLight, S.Out())
  return () => {
    lightsIn.each((entity, light) => {
      S.SparseMap.set(objectsByEntity, entity, light)
      entitiesByObject.set(light, entity)
      scene.add(light)
    })
    lightsOut.each(entity => {
      let light = S.SparseMap.get(objectsByEntity, entity)
      if (light) {
        scene.remove(light)
        S.SparseMap.delete(objectsByEntity, entity)
        entitiesByObject.delete(light)
      }
    })
  }
}

export let instanceSystem: S.System = world => {
  let instanced = S.query(world, Instanced)
  let instancedIn = S.query(world, Instanced, S.In())
  let instancesIn = S.query(world, S.type(Transform, IsInstance), S.In())
  let instances = S.query(world, S.type(Transform, InstanceOf))
  let proxy = new three.Object3D()
  let updateInstance = (
    mesh: three.InstancedMesh,
    index: number,
    position: Position,
    rotation: Rotation,
    scale?: Scale,
  ) => {
    proxy.position.set(position.x, position.y, position.z)
    proxy.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    if (scale) {
      proxy.scale.set(scale.x, scale.y, scale.z)
    }
    proxy.updateMatrix()
    mesh.setMatrixAt(index, proxy.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }
  return () => {
    instancedIn.each((entity, geometry, material, count) => {
      // Create a new InstancedMesh for each `Instanced` entity and add it to the scene.
      let mesh = new three.InstancedMesh(geometry, material, count)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      S.SparseMap.set(objectsByEntity, entity, mesh)
      entitiesByObject.set(mesh, entity)
      scene.add(mesh)
      // Create an instance list used to track the index of each instance.
      if (!S.SparseMap.has(objectInstances, entity)) {
        S.SparseMap.set(objectInstances, entity, S.SparseSet.make())
      }
    })
    instancesIn.each((entity, position, rotation) => {
      let instanceOf = Assert.value(
        world.get_exclusive_relative(entity, InstanceOf),
      )
      let instances = Assert.value(S.SparseMap.get(objectInstances, instanceOf))
      let mesh = Assert.value(
        S.SparseMap.get(objectsByEntity, instanceOf),
      ) as three.InstancedMesh
      updateInstance(
        mesh,
        S.SparseSet.add(instances, entity),
        position,
        rotation,
        world.get(entity, Scale),
      )
    })
    instanced.each(entity => {
      let mesh = S.SparseMap.get(objectsByEntity, entity) as three.InstancedMesh
      let meshInstances = Assert.value(S.SparseMap.get(objectInstances, entity))
      instances.each(entity, (instance, position, rotation) => {
        updateInstance(
          mesh,
          S.SparseSet.index_of(meshInstances, instance),
          position,
          rotation,
          world.get(instance, Scale),
        )
      })
    })
  }
}

let toggleSelected = (world: S.World, entity: S.Entity) => {
  if (world.has(entity, DebugSelected)) {
    world.remove(entity, DebugSelected)
  } else {
    world.add(entity, DebugSelected)
  }
}

let camera: three.PerspectiveCamera | three.OrthographicCamera
let cameraControls: CameraControls

export let cameraSystem: S.System = world => {
  let clock = new three.Clock()
  let camerasIn = S.query(world, ThreeCamera, S.In())
  let raycaster = new three.Raycaster()
  raycaster.layers.set(0)
  renderer.domElement.addEventListener("click", event => {
    if (!event.ctrlKey) {
      return
    }
    let mouse = new three.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    let intersects = raycaster.intersectObjects(scene.children)
    if (intersects.length > 0) {
      let entity = entitiesByObject.get(intersects[0].object)
      if (entity !== undefined) {
        if (world.has(entity, InstanceCount)) {
          let instances = S.SparseMap.get(objectInstances, entity)!
          let instancedMesh = S.SparseMap.get(objectsByEntity, entity)!
          let instanceIntersects = raycaster.intersectObject(instancedMesh)
          if (instanceIntersects.length > 0) {
            let instance = S.SparseSet.at(
              instances,
              instanceIntersects[0].instanceId!,
            )
            toggleSelected(world, instance)
          }
        } else {
          toggleSelected(world, entity)
        }
      }
    }
  })
  return () => {
    camerasIn.each((entity, _camera) => {
      camera = _camera
      if (world.has(entity, Position)) {
        let position = world.get(entity, Position)
        camera.position.set(position.x, position.y, position.z)
      }
      if (world.has(entity, Rotation)) {
        let rotation = world.get(entity, Rotation)
        camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
      camera.layers.enable(0)
      camera.layers.enable(1)
      cameraControls = new CameraControls(camera, renderer.domElement)
    })
    if (camera) {
      let delta = clock.getDelta()
      cameraControls?.update(delta)
      renderer.render(scene, camera)
    }
  }
}

export let debugSystem: S.System = world => {
  let highlighted = S.query(world, S.type(Position, DebugHighlighted))
  let highlightedIn = S.query(world, DebugHighlighted, S.In())
  let highlightedOut = S.query(world, DebugHighlighted, S.Out())
  let selectedIn = S.query(world, DebugSelected, S.In())
  let selectedOut = S.query(world, DebugSelected, S.Out())
  return () => {
    highlightedOut.each(entity => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      mesh.remove(
        mesh.children.find(child => child.name === "silver_debug_highlighted")!,
      )
    })
    highlightedIn.each(entity => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      let highlightedGeometry = (mesh as three.Mesh).geometry
      let highlighted = new three.Mesh(highlightedGeometry, highlightedMaterial)
      highlighted.name = "silver_debug_highlighted"
      highlighted.layers.set(1)
      mesh.add(highlighted)
    })
    highlighted.each((_, position) => {
      cameraControls?.setTarget(position.x, position.y, position.z, true)
    })
    selectedIn.each(entity => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      let selectedGeometry = (mesh as three.Mesh).geometry
      let selected = new three.Mesh(selectedGeometry, selectedMaterial)
      selected.name = "silver_debug_selected"
      selected.layers.set(1)
      mesh.add(selected)
    })
    selectedOut.each(entity => {
      let mesh = S.SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      mesh.remove(
        mesh.children.find(child => child.name === "silver_debug_selected")!,
      )
    })
  }
}

import CameraControls from "camera-controls"
import {
  Changed,
  Entity,
  In,
  Not,
  Out,
  SparseMap,
  SparseSet,
  System,
  World,
  query,
  run,
  type,
} from "silver-ecs"
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

let objectInstances = SparseMap.make<SparseSet.T<Entity>>()
let objectsByEntity = SparseMap.make<three.Object3D>()
let entitiesByObject = new WeakMap<three.Object3D, Entity>()

export let threeSystem: System = world => {
  return () => {
    run(world, objectsSystem)
    run(world, scaleSystem)
    run(world, lightsSystem)
    run(world, instanceSystem)
    run(world, cameraSystem)
    run(world, debugSystem)
  }
}

export let objectsSystem: System = world => {
  let meshesIn = query(world, Mesh, In(), Not(InstanceCount))
  let objects = query(world, Transform, Not(InstanceOf))

  return () => {
    meshesIn.each((entity, geometry, material) => {
      let mesh = new three.Mesh(geometry, material)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      SparseMap.set(objectsByEntity, entity, mesh)
      entitiesByObject.set(mesh, entity)
      scene.add(mesh)
    })
    objects.each((entity, position, rotation) => {
      let mesh = SparseMap.get(objectsByEntity, entity)
      if (mesh) {
        mesh.position.set(position.x, position.y, position.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
    })
  }
}

export let scaleSystem: System = world => {
  let scaledIn = query(world, Scale, In())
  return () => {
    scaledIn.each((entity, scale) => {
      let mesh = SparseMap.get(objectsByEntity, entity)
      if (mesh) {
        mesh.scale.set(scale.x, scale.y, scale.z)
      }
    })
  }
}

export let lightsSystem: System = world => {
  let lightsIn = query(world, ThreeLight, In())
  return () => {
    lightsIn.each((entity, light) => {
      SparseMap.set(objectsByEntity, entity, light)
      entitiesByObject.set(light, entity)
      scene.add(light)
    })
  }
}

export let instanceSystem: System = world => {
  let instanced = query(world, Instanced)
  let instancedIn = query(world, Instanced, In())
  let instancesIn = query(world, type(Transform, IsInstance), In())
  let instances = query(world, type(Transform, InstanceOf))
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
      SparseMap.set(objectsByEntity, entity, mesh)
      entitiesByObject.set(mesh, entity)
      scene.add(mesh)
      // Create an instance list used to track the index of each instance.
      if (!SparseMap.has(objectInstances, entity)) {
        SparseMap.set(objectInstances, entity, SparseSet.make())
      }
    })
    instancesIn.each((entity, position, rotation) => {
      let instanceOf = world.getExclusiveRelative(entity, InstanceOf)
      let instances = Assert.exists(SparseMap.get(objectInstances, instanceOf))
      let mesh = Assert.exists(
        SparseMap.get(objectsByEntity, instanceOf),
      ) as three.InstancedMesh
      updateInstance(
        mesh,
        SparseSet.add(instances, entity),
        position,
        rotation,
        world.get(entity, Scale),
      )
    })
    instanced.each(entity => {
      let mesh = SparseMap.get(objectsByEntity, entity) as three.InstancedMesh
      let meshInstances = Assert.exists(SparseMap.get(objectInstances, entity))
      instances.each(entity, (instance, position, rotation) => {
        updateInstance(
          mesh,
          SparseSet.indexOf(meshInstances, instance),
          position,
          rotation,
          world.get(instance, Scale),
        )
      })
    })
  }
}

let toggleSelected = (world: World, entity: Entity) => {
  if (world.has(entity, DebugSelected)) {
    world.remove(entity, DebugSelected)
  } else {
    world.add(entity, DebugSelected)
  }
}

let camera: three.PerspectiveCamera | three.OrthographicCamera
let cameraControls: CameraControls

export let cameraSystem: System = world => {
  let clock = new three.Clock()
  let camerasIn = query(world, ThreeCamera, In())
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
          let instances = SparseMap.get(objectInstances, entity)!
          let instancedMesh = SparseMap.get(objectsByEntity, entity)!
          let instanceIntersects = raycaster.intersectObject(instancedMesh)
          if (instanceIntersects.length > 0) {
            let instance = SparseSet.at(
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

export let debugSystem: System = world => {
  let highlightedTimer: NodeJS.Timeout | number | undefined
  let highlightedIn = query(world, type(Position, DebugHighlighted), In())
  let highlightedOut = query(world, DebugHighlighted, Out())
  let selectedIn = query(world, type(Position, DebugSelected), In())
  let selectedOut = query(world, DebugSelected, Out())
  return () => {
    highlightedOut.each(entity => {
      let mesh = SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      mesh.remove(
        mesh.children.find(child => child.name === "silver_debug_highlighted")!,
      )
    })
    highlightedIn.each((entity, position) => {
      if (highlightedTimer !== undefined) {
        clearTimeout(highlightedTimer as NodeJS.Timeout)
      }
      highlightedTimer = setTimeout(() => {
        if (world.has(entity, DebugHighlighted)) {
          cameraControls?.setLookAt(
            camera.position.x,
            camera.position.y,
            camera.position.z,
            position.x,
            position.y,
            position.z,
            true,
          )
        }
        highlightedTimer = undefined
      }, 1000)
      let mesh = SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      let highlightedGeometry = (mesh as three.Mesh).geometry
      let highlighted = new three.Mesh(highlightedGeometry, highlightedMaterial)
      highlighted.name = "silver_debug_highlighted"
      highlighted.layers.set(1)
      mesh.add(highlighted)
    })
    selectedIn.each((entity, position) => {
      let mesh = SparseMap.get(objectsByEntity, entity)
      cameraControls?.setLookAt(
        camera.position.x,
        camera.position.y,
        camera.position.z,
        position.x,
        position.y,
        position.z,
        true,
      )
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
      let mesh = SparseMap.get(objectsByEntity, entity)
      if (!mesh) {
        return
      }
      mesh.remove(
        mesh.children.find(child => child.name === "silver_debug_selected")!,
      )
    })
  }
}

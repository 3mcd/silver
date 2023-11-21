import CameraControls from "camera-controls"
import {
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
import * as three from "three"
import {
  Camera,
  CastsShadow,
  InstanceCount,
  InstanceOf,
  Instanced,
  IsInstance,
  Light,
  Mesh,
  ReceivesShadow,
} from "./schema"
import {
  DebugHighlighted,
  DebugSelected,
  Position,
  Rotation,
  Scale,
  Transform,
} from "silver-lib"
import {highlighted_material, selected_material} from "./materials"

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

let make_renderer = () => {
  let renderer = new three.WebGLRenderer({
    antialias: true,
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)
  return renderer
}

let renderer = make_renderer()
renderer.toneMapping = three.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.5
renderer.shadowMap.enabled = true
renderer.shadowMap.type = three.PCFSoftShadowMap

let scene = new three.Scene()

let object_instances = SparseMap.make<SparseSet.T<Entity>>()
let objects_by_entity = SparseMap.make<three.Object3D>()
let entities_by_object = new WeakMap<three.Object3D, Entity>()

export let threeSystem: System = world => {
  return () => {
    run(world, mesh_system)
    run(world, scale_system)
    run(world, lights_system)
    run(world, instance_system)
    run(world, camera_system)
    run(world, debug_system)
  }
}

export let mesh_system: System = world => {
  let meshes_in = query(world, Mesh, In(), Not(InstanceCount))
  let transforms = query(world, Transform, Not(InstanceOf))

  return () => {
    meshes_in.each((entity, geometry, material) => {
      let mesh = new three.Mesh(geometry, material)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      SparseMap.set(objects_by_entity, entity, mesh)
      entities_by_object.set(mesh, entity)
      scene.add(mesh)
    })

    transforms.each((entity, position, rotation) => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (mesh) {
        mesh.position.set(position.x, position.y, position.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
    })
  }
}

export let scale_system: System = world => {
  let scaled_in = query(world, Scale, In())
  return () => {
    scaled_in.each((entity, scale) => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (mesh) {
        mesh.scale.set(scale.x, scale.y, scale.z)
      }
    })
  }
}

export let lights_system: System = world => {
  let lights_in = query(world, Light, In())
  return () => {
    lights_in.each((entity, light) => {
      SparseMap.set(objects_by_entity, entity, light)
      entities_by_object.set(light, entity)
      scene.add(light)
    })
  }
}

export let instance_system: System = world => {
  let instanced = query(world, Instanced)
  let instanced_in = query(world, Instanced, In())
  let instances_in = query(world, type(IsInstance, Transform), In())
  let instances_w_transforms = query(
    world,
    type(InstanceOf, Position, Rotation),
  )
  const proxy = new three.Object3D()
  return () => {
    instanced_in.each((entity, geometry, material, count) => {
      // Create a new InstancedMesh for each `Instanced` entity and add it to the scene.
      let mesh = new three.InstancedMesh(geometry, material, count)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      SparseMap.set(objects_by_entity, entity, mesh)
      entities_by_object.set(mesh, entity)
      scene.add(mesh)
      // Create an instance list used to track the index of each instance.
      if (!SparseMap.has(object_instances, entity)) {
        SparseMap.set(object_instances, entity, SparseSet.make())
      }
    })

    instances_in.each((entity, position, rotation) => {
      const proxy = new three.Object3D()
      let instance_of = world.getExclusiveRelative(entity, InstanceOf)
      let instances = SparseMap.get(object_instances, instance_of)
      proxy.position.set(position.x, position.y, position.z)
      proxy.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      if (world.has(entity, Scale)) {
        let scale = world.get(entity, Scale)
        proxy.scale.set(scale.x, scale.y, scale.z)
      }
      proxy.updateMatrix()
      let mesh = SparseMap.get(objects_by_entity, instance_of) as
        | three.InstancedMesh
        | undefined
      if (instances) {
        let index = SparseSet.add(instances, entity)
        if (mesh) {
          mesh.setMatrixAt(index, proxy.matrix)
          mesh.setColorAt(index, new three.Color(0xffffff))
        }
      }
    })

    instanced.each(instance_of => {
      const instance_set = SparseMap.get(object_instances, instance_of)
      if (instance_set === undefined) {
        return
      }
      let mesh = SparseMap.get(
        objects_by_entity,
        instance_of,
      ) as three.InstancedMesh
      instances_w_transforms.each(
        instance_of,
        (instance, position, rotation) => {
          proxy.position.set(position.x, position.y, position.z)
          proxy.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
          if (world.has(instance, Scale)) {
            let scale = world.get(instance, Scale)
            proxy.scale.set(scale.x, scale.y, scale.z)
          }
          proxy.updateMatrix()
          mesh.setMatrixAt(
            SparseSet.index_of(instance_set, instance),
            proxy.matrix,
          )
          mesh.instanceMatrix.needsUpdate = true
        },
      )
    })
  }
}

let toggle_selected = (world: World, entity: Entity) => {
  if (world.has(entity, DebugSelected)) {
    world.remove(entity, DebugSelected)
  } else {
    world.add(entity, DebugSelected)
  }
}

export let camera_system: System = world => {
  let clock = new three.Clock()
  let camera: three.PerspectiveCamera | three.OrthographicCamera
  let camera_controls: CameraControls
  let cameras_in = query(world, Camera, In())

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
      let entity = entities_by_object.get(intersects[0].object)
      if (entity !== undefined) {
        if (world.has(entity, InstanceCount)) {
          let instanced_mesh = SparseMap.get(objects_by_entity, entity)!
          let instances = SparseMap.get(object_instances, entity)!
          let instance_intersects = raycaster.intersectObject(instanced_mesh)
          if (instance_intersects.length > 0) {
            let instance = SparseSet.at(
              instances,
              instance_intersects[0].instanceId!,
            )
            toggle_selected(world, instance)
          }
        } else {
          toggle_selected(world, entity)
        }
      }
    }
  })

  return () => {
    cameras_in.each((entity, _camera) => {
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
      camera_controls = new CameraControls(camera, renderer.domElement)
    })
    if (camera) {
      let delta = clock.getDelta()
      camera_controls?.update(delta)
      renderer.render(scene, camera)
    }
  }
}

export let debug_system: System = world => {
  let highlighted_in = query(world, DebugHighlighted, In(), Not(IsInstance))
  let highlighted_out = query(world, DebugHighlighted, Out(), Not(IsInstance))
  let selected_in = query(world, DebugSelected, In(), Not(IsInstance))
  let selected_out = query(world, DebugSelected, Out(), Not(IsInstance))
  let selected_instances_in = query(
    world,
    type(DebugSelected, IsInstance),
    In(),
  )
  let selected_instances_out = query(
    world,
    type(DebugSelected, IsInstance),
    Out(),
  )
  let debug_color = new three.Color(0x00ff00)
  return () => {
    highlighted_in.each(entity => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (!mesh) {
        return
      }
      let highlighted_geometry = (mesh as three.Mesh).geometry
      let highlighted = new three.Mesh(
        highlighted_geometry,
        highlighted_material,
      )
      highlighted.name = "silver_debug_highlighted"
      highlighted.layers.set(1)
      mesh.add(highlighted)
    })
    highlighted_out.each(entity => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (!mesh) {
        return
      }
      mesh.remove(
        mesh.children.find(child => child.name === "silver_debug_highlighted")!,
      )
    })
    selected_in.each(entity => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (!mesh) {
        return
      }
      let selected_geometry = (mesh as three.Mesh).geometry
      let selected = new three.Mesh(selected_geometry, selected_material)
      selected.name = "silver_debug_selected"
      selected.layers.set(1)
      mesh.add(selected)
      console.log("selected", entity)
    })
    selected_out.each(entity => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (!mesh) {
        return
      }
      mesh.remove(
        mesh.children.find(child => child.name === "silver_debug_selected")!,
      )
      console.log("deselected", entity)
    })
    selected_instances_in.each(entity => {
      let instance_of = world.getExclusiveRelative(entity, InstanceOf)
      let instances = SparseMap.get(object_instances, instance_of)
      if (instances) {
        let index = SparseSet.index_of(instances, entity)
        let mesh = SparseMap.get(objects_by_entity, instance_of) as
          | three.InstancedMesh
          | undefined
        if (mesh?.isInstancedMesh) {
          mesh.setColorAt(index, debug_color)
          mesh.instanceColor!.needsUpdate = true
        }
      }
    })
    selected_instances_out.each(entity => {
      let instance_of = world.getExclusiveRelative(entity, InstanceOf)
      let instances = SparseMap.get(object_instances, instance_of)
      if (instances) {
        let index = SparseSet.index_of(instances, entity)
        let mesh = SparseMap.get(objects_by_entity, instance_of) as
          | three.InstancedMesh
          | undefined
        if (mesh?.isInstancedMesh) {
          mesh.setColorAt(
            index,
            (mesh.material as three.MeshStandardMaterial).color,
          )
          mesh.instanceColor!.needsUpdate = true
        }
      }
    })
  }
}

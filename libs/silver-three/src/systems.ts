import CameraControls from "camera-controls"
import {
  In,
  Not,
  SparseMap,
  SparseSet,
  System,
  query,
  run,
  type,
} from "silver-ecs"
import * as three from "three"
import {
  Camera,
  CastsShadow,
  InstanceOf,
  Instanced,
  IsInstance,
  Light,
  Mesh,
  ReceivesShadow,
} from "./schema"
import {Position, Rotation, Scale, Transform} from "silver-lib"

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

const temp_position = new three.Vector3()
const temp_matrix4 = new three.Matrix4()
const temp_rotation = new three.Quaternion()

let renderer = make_renderer()
renderer.toneMapping = three.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.5
renderer.shadowMap.enabled = true
renderer.shadowMap.type = three.PCFSoftShadowMap

let scene = new three.Scene()

let object_instances = SparseMap.make<SparseSet.T>()
let objects_by_entity = SparseMap.make<three.Object3D>()

export let threeSystem: System = world => {
  return () => {
    run(world, mesh_system)
    run(world, scale_system)
    run(world, lights_system)
    run(world, instance_system)
    run(world, camera_system)
  }
}

export let mesh_system: System = world => {
  let meshes_in = query(world, Mesh, In(), Not(Instanced))
  let transforms = query(world, type(Position, Rotation), Not(InstanceOf))

  return () => {
    meshes_in.each((entity, geometry, material) => {
      let mesh = new three.Mesh(geometry, material)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      SparseMap.set(objects_by_entity, entity, mesh)
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
  let scaled_in = query(world, type(Scale), In())
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
      scene.add(light)
    })
  }
}

export let instance_system: System = world => {
  let instanced = query(world, type(Instanced))
  let instanced_in = query(world, type(Instanced), In())
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
          mesh.instanceMatrix.needsUpdate = true
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
          // temp_position.set(position.x, position.y, position.z)
          // temp_rotation.set(rotation.x, rotation.y, rotation.z, rotation.w)
          // temp_matrix4.makeRotationFromQuaternion(temp_rotation)
          // temp_matrix4.setPosition(position.x, position.y, position.z)
          // mesh.setMatrixAt(
          //   SparseSet.index_of(instance_set, instance),
          //   temp_matrix4,
          // )
        },
      )
      mesh.instanceMatrix.needsUpdate = true
    })
  }
}

export let camera_system: System = world => {
  let clock = new three.Clock()
  let camera: three.PerspectiveCamera | three.OrthographicCamera
  let camera_controls: CameraControls
  let cameras_in = query(world, Camera, In())
  return () => {
    cameras_in.each((entity, c) => {
      camera = c
      if (world.has(entity, Position)) {
        let position = world.get(entity, Position)
        camera.position.set(position.x, position.y, position.z)
      }
      if (world.has(entity, Rotation)) {
        let rotation = world.get(entity, Rotation)
        camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
      camera_controls = new CameraControls(camera, renderer.domElement)
    })
    if (camera) {
      let delta = clock.getDelta()
      camera_controls?.update(delta)
      renderer.render(scene, camera)
    }
  }
}

import CameraControls from "camera-controls"
import {In, Not, SparseMap, SparseSet, System, query, type} from "silver-ecs"
import * as three from "three"
import {
  Camera,
  CastsShadow,
  InstanceOf,
  InstancedMesh,
  IsInstance,
  Light,
  Mesh,
  Object3D,
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
const temp_rotation = new three.Euler()

export let threeSystem: System = world => {
  let clock = new three.Clock()
  let scene = new three.Scene()
  let renderer = make_renderer()
  let camera: three.PerspectiveCamera | three.OrthographicCamera
  let camera_controls: CameraControls
  let instance_index = SparseMap.make<SparseSet.T>()
  let instanced = query(world, type(InstancedMesh))
  let instanced_in = query(world, type(InstancedMesh), In())
  let instances_in = query(world, type(IsInstance, Object3D), In())
  let instances = query(world, type(Object3D, InstanceOf))
  let objects = query(world, Object3D, Not(InstanceOf))
  let cameras_in = query(world, Camera, In())
  let lights_in = query(world, Light, In())
  let meshes_in = query(world, Mesh, In(), Not(InstancedMesh))
  let objects_by_entity = SparseMap.make<three.Object3D>()

  renderer.toneMapping = three.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.5
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = three.PCFSoftShadowMap

  return () => {
    instanced_in.each(
      (entity, geometry, material, position, rotation, scale, count) => {
        // Create a new InstancedMesh for each `Instanced` entity and add it to the scene.
        let mesh = new three.InstancedMesh(geometry, material, count)
        mesh.castShadow = world.has(entity, CastsShadow)
        mesh.receiveShadow = world.has(entity, ReceivesShadow)
        mesh.position.set(position.x, position.y, position.z)
        mesh.rotation.set(rotation.x, rotation.y, rotation.z)
        mesh.scale.setScalar(scale)
        SparseMap.set(objects_by_entity, entity, mesh)
        scene.add(mesh)
        // Create an instance list used to track the index of each instance.
        if (!SparseMap.has(instance_index, entity)) {
          SparseMap.set(instance_index, entity, SparseSet.make())
        }
      },
    )

    instances_in.each(entity => {
      const instance_of = world.getExclusiveRelative(entity, InstanceOf)
      const instances = SparseMap.get(instance_index, instance_of)
      if (instances) {
        SparseSet.add(instances, entity)
      }
    })

    cameras_in.each((_, _camera, position, rotation) => {
      camera = _camera
      camera.position.set(position.x, position.y, position.z)
      camera.rotation.set(rotation.x, rotation.y, rotation.z)
      camera_controls = new CameraControls(camera, renderer.domElement)
    })

    lights_in.each((entity, light, position, rotation) => {
      light.position.set(position.x, position.y, position.z)
      light.rotation.set(rotation.x, rotation.y, rotation.z)
      SparseMap.set(objects_by_entity, entity, light)
      scene.add(light)
    })

    meshes_in.each((entity, geometry, material, position, rotation, scale) => {
      let mesh = new three.Mesh(geometry, material)
      mesh.castShadow = world.has(entity, CastsShadow)
      mesh.receiveShadow = world.has(entity, ReceivesShadow)
      mesh.position.set(position.x, position.y, position.z)
      mesh.rotation.set(rotation.x, rotation.y, rotation.z)
      mesh.scale.setScalar(scale)
      SparseMap.set(objects_by_entity, entity, mesh)
      scene.add(mesh)
    })

    instanced.each(instance_of => {
      const instance_set = SparseMap.get(instance_index, instance_of)
      if (instance_set === undefined) {
        return
      }
      let mesh = SparseMap.get(
        objects_by_entity,
        instance_of,
      ) as three.InstancedMesh
      instances.each(instance_of, (instance, position, rotation) => {
        temp_position.set(position.x, position.y, position.z)
        temp_rotation.set(rotation.x, rotation.y, rotation.z)
        temp_matrix4.makeRotationFromEuler(temp_rotation)
        temp_matrix4.setPosition(position.x, position.y, position.z)
        mesh.setMatrixAt(
          SparseSet.index_of(instance_set, instance),
          temp_matrix4,
        )
      })
      mesh.instanceMatrix.needsUpdate = true
    })

    objects.each((entity, position, rotation) => {
      let mesh = SparseMap.get(objects_by_entity, entity)
      if (mesh) {
        mesh.position.set(position.x, position.y, position.z)
        mesh.rotation.set(rotation.x, rotation.y, rotation.z)
      }
    })

    if (camera) {
      let delta = clock.getDelta()
      camera_controls?.update(delta)
      renderer.render(scene, camera)
    }
  }
}

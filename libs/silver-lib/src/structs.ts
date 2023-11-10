export class Vector3 {
  x
  y
  z
  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }
}
export class Position extends Vector3 {}
export class Velocity extends Vector3 {}
export class Rotation extends Vector3 {}

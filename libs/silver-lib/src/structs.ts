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
export class Quaternion {
  x
  y
  z
  w
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }
}

export class Position extends Vector3 {}
export class Velocity extends Vector3 {}
export class AngularVelocity extends Vector3 {}
export class Rotation extends Quaternion {}

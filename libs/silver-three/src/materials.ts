import {BackSide, ShaderMaterial} from "three"

export let selectedMaterial = new ShaderMaterial({
  vertexShader: `uniform float size;
  void main() {
    vec3 transformed = position + normal * size/100.;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.);
  }`,
  fragmentShader: `uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.);
  }`,
  uniforms: {
    size: {value: 10},
    color: {value: [0, 1, 0]},
  },
  depthWrite: true,
  side: BackSide,
})

export let highlightedMaterial = new ShaderMaterial({
  vertexShader: `uniform float size;
  void main() {
    vec3 transformed = position + normal * size/100.;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.);
  }`,
  fragmentShader: `uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.);
  }`,
  uniforms: {
    size: {value: 10},
    color: {value: [1, 1, 1]},
  },
  depthWrite: true,
  side: BackSide,
})

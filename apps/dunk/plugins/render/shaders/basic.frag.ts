export let basic_frag = /* glsl */ `
precision highp float;

varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`

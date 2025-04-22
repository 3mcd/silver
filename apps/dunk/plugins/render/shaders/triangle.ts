export let frag = /* glsl */ `
precision mediump float;
uniform vec4 u_color;

void main() {
  gl_FragColor = u_color;
}
`

export let vert = /* glsl */ `
precision mediump float;
attribute vec2 a_position;

uniform vec2 u_offset;
uniform float u_viewport_w;
uniform float u_viewport_h;

void main() {
  float r = (u_viewport_w) / (u_viewport_h);
  gl_Position = vec4(a_position.xy * vec2(0.1, 0.1) * vec2(1.0, r) + u_offset, 0, 1);
}
`

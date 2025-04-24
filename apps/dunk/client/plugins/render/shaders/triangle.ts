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
uniform mat4 projection;
uniform mat4 view;

void main() {
  gl_Position = projection * view * vec4(a_position.xy + u_offset, 0, 1);
}
`

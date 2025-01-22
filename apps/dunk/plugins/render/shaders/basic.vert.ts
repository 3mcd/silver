export let basic_vert = /* glsl */ `
attribute vec3 a_position;
attribute vec3 a_normal;

uniform mat4 u_projection_matrix;
uniform mat4 u_view_matrix;

varying vec3 v_normal;
varying vec4 v_color;

void main () {
  v_normal = a_normal;
  v_color = vec4(a_normal * 0.5 + 0.5, 1.0);

  gl_Position = u_projection_matrix * u_view_matrix * vec4(a_position, 1.0);
}
`

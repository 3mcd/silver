precision mediump float;
attribute vec3 a_position;

uniform vec3 u_offset;
uniform mat4 u_camera_projection;
uniform mat4 u_camera_view;

void main(){
  gl_Position=u_camera_projection*u_camera_view*vec4(a_position.xyz+u_offset,1);
}

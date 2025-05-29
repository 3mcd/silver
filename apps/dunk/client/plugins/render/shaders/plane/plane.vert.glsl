precision highp float;
uniform mat4 u_camera_projection;
uniform mat4 u_camera_view;
uniform vec3 u_offset;
uniform float u_tile_size;

attribute vec2 a_position;

varying vec2 uv;

void main(){
  uv=a_position*u_tile_size;
  gl_Position=u_camera_projection*u_camera_view*vec4(vec3(100.*a_position.x,0,100.*a_position.y)+u_offset,1);
}
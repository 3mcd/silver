precision highp float;

varying vec2 uv;

void main(){
  vec2 p_tile=step(.5,fract(uv));
  gl_FragColor=vec4(abs(p_tile.x-p_tile.y)*vec3(.2,.2,.2),1);
}
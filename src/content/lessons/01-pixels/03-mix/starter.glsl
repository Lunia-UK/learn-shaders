vec3 color(vec2 uv) {
  vec3 a = vec3(1.00, 0.45, 0.20);
  vec3 b = vec3(0.20, 0.30, 0.80);
  float t = uv.x;
  return mix(a, b, t);
}

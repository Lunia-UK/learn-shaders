vec3 color(vec2 uv) {
  vec2 center = vec2(0.50, 0.50);
  float d = distance(uv, center);
  float circle = 1.0 - smoothstep(0.20, 0.22, d);
  return vec3(circle);
}

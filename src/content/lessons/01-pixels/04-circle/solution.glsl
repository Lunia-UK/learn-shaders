vec3 color(vec2 uv) {
  float d = distance(uv, vec2(0.35, 0.60));
  return vec3(1.0 - smoothstep(0.15, 0.40, d));
}

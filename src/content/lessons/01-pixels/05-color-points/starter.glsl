vec3 color(vec2 uv) {
  vec2 p1 = vec2(0.30, 0.30);
  vec2 p2 = vec2(0.70, 0.70);
  vec3 c1 = vec3(1.00, 0.30, 0.45);
  vec3 c2 = vec3(0.20, 0.50, 1.00);
  float w1 = exp(-distance(uv, p1) * 4.00);
  float w2 = exp(-distance(uv, p2) * 4.00);
  return (c1 * w1 + c2 * w2) / (w1 + w2);
}

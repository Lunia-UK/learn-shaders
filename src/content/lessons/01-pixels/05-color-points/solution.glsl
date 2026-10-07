vec3 color(vec2 uv) {
  vec2 p1 = vec2(0.20, 0.75);
  vec2 p2 = vec2(0.80, 0.30);
  float w1 = exp(-distance(uv, p1) * 8.00);
  float w2 = exp(-distance(uv, p2) * 8.00);
  return (vec3(1.00, 0.30, 0.45) * w1 + vec3(0.20, 0.50, 1.00) * w2) / (w1 + w2);
}

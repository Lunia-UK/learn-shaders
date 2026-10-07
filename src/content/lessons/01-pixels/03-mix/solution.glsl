vec3 color(vec2 uv) {
  return mix(vec3(1.00, 0.45, 0.20), vec3(0.55, 0.15, 0.75), uv.y);
}

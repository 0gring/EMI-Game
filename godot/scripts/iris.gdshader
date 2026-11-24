// The screen change: a pink-to-lilac curtain closes in a circle onto the spot
// she touched, a ring of soft sparkle riding its edge, and opens again.
shader_type canvas_item;

uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform vec2 center = vec2(0.5);
uniform float aspect = 1.777;
uniform float time = 0.0;

void fragment() {
	vec2 p = (UV - center) * vec2(aspect, 1.0);
	float far = length(max(abs(center), abs(1.0 - center)) * vec2(aspect, 1.0)) * 1.05;
	float r = (1.0 - progress) * far;
	float d = length(p);
	vec3 a = vec3(1.0, 0.72, 0.87);
	vec3 b = vec3(0.86, 0.68, 1.0);
	vec3 col = mix(a, b, clamp(UV.y + 0.2 * sin(UV.x * 6.0 + time), 0.0, 1.0));
	// sparkles on the rim
	float ang = atan(p.y, p.x);
	float stars = pow(max(0.0, sin(ang * 18.0 + time * 4.0)), 24.0);
	float rim = smoothstep(0.035, 0.0, abs(d - r)) * (0.5 + stars);
	float inside = step(d, r);
	float alpha = (1.0 - inside);
	if (progress >= 0.999) alpha = 1.0;
	col += rim * vec3(1.0, 0.95, 0.8);
	COLOR = vec4(col, max(alpha, rim * step(0.001, r)));
}

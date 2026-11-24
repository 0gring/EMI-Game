// The painted world behind every scene: sky, sun, light rays and layered hills
// that breathe gently, all in one full-screen pass.
shader_type canvas_item;

uniform vec4 sky_top : source_color = vec4(0.36, 0.68, 1.0, 1.0);
uniform vec4 sky_mid : source_color = vec4(0.62, 0.84, 1.0, 1.0);
uniform vec4 sky_low : source_color = vec4(1.0, 0.86, 0.93, 1.0);
uniform vec2 sun = vec2(0.82, 0.16);
uniform float horizon = 0.56;
uniform vec4 hill_far : source_color = vec4(0.62, 0.82, 0.86, 1.0);
uniform vec4 hill_mid : source_color = vec4(0.55, 0.85, 0.48, 1.0);
uniform vec4 hill_near : source_color = vec4(0.44, 0.80, 0.36, 1.0);
uniform vec4 ground : source_color = vec4(0.47, 0.83, 0.37, 1.0);
uniform float aspect = 1.777;
uniform float rays = 1.0;

float hill(float x, float base, float a1, float f1, float a2, float f2, float ph) {
	return base - a1 * sin(x * f1 + ph) - a2 * sin(x * f2 + ph * 1.7);
}

// One hill layer: soft gradient body, a bright rim along the crest.
vec4 layer(vec3 col, vec2 uv, float h, float rim_amt) {
	float inside = smoothstep(h - 0.0025, h + 0.0025, uv.y);
	float depth = clamp((uv.y - h) * 4.0, 0.0, 1.0);
	vec3 c = mix(col * 1.12, col * 0.86, depth);
	float rim = smoothstep(0.018, 0.0, uv.y - h) * inside * rim_amt;
	c += vec3(1.0, 0.98, 0.85) * rim * 0.35;
	return vec4(c, inside);
}

void fragment() {
	vec2 uv = UV;
	float t = TIME;
	// sky
	vec3 col = mix(sky_top.rgb, sky_mid.rgb, smoothstep(0.0, horizon * 0.6, uv.y));
	col = mix(col, sky_low.rgb, smoothstep(horizon * 0.45, horizon, uv.y));
	// sun glow and disc
	vec2 d = (uv - sun) * vec2(aspect, 1.0);
	float r = length(d);
	col += vec3(1.0, 0.92, 0.7) * (0.55 * exp(-r * 5.0) + 0.25 * exp(-r * 1.6));
	col = mix(col, vec3(1.0, 0.97, 0.8), smoothstep(0.075, 0.068, r));
	// light rays fanning out of the sun, slowly turning
	float ang = atan(d.y, d.x);
	float ray = pow(max(0.0, sin(ang * 9.0 + t * 0.12)), 6.0) * 0.5 + pow(max(0.0, sin(ang * 5.0 - t * 0.08 + 1.3)), 8.0) * 0.5;
	col += vec3(1.0, 0.95, 0.8) * ray * exp(-r * 1.4) * 0.22 * rays;
	// hills, far to near, breathing a little
	float x = uv.x * aspect;
	vec4 L;
	L = layer(hill_far.rgb, uv, hill(x, horizon - 0.07, 0.035, 2.1, 0.02, 5.3, 0.4 + sin(t * 0.05) * 0.05), 0.6);
	col = mix(col, L.rgb, L.a * 0.95);
	L = layer(hill_mid.rgb, uv, hill(x, horizon - 0.01, 0.03, 3.1, 0.015, 7.7, 2.1), 1.0);
	col = mix(col, L.rgb, L.a);
	L = layer(hill_near.rgb, uv, hill(x, horizon + 0.06, 0.025, 1.7, 0.012, 6.1, 4.0), 1.0);
	col = mix(col, L.rgb, L.a);
	// meadow: soft mown stripes and a warm light from the sun side
	float g = smoothstep(horizon + 0.13, horizon + 0.135, uv.y + 0.01 * sin(x * 3.0));
	vec3 m = mix(ground.rgb * 1.08, ground.rgb * 0.82, (uv.y - horizon) * 1.6);
	m *= 1.0 + 0.05 * sin((uv.x * 14.0 + uv.y * 30.0));
	m += vec3(1.0, 0.95, 0.7) * 0.12 * (1.0 - abs(uv.x - sun.x));
	col = mix(col, m, g);
	// gentle vignette to hold the eye in the middle
	float v = length((uv - vec2(0.5)) * vec2(1.0, 0.8));
	col *= 1.0 - smoothstep(0.55, 0.95, v) * 0.18;
	COLOR = vec4(col, 1.0);
}

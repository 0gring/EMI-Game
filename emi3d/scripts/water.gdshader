shader_type spatial;
// The sea round the island and the pond's water: gentle waves, turquoise
// in the shallows going deep blue, a white rim of foam where it meets the
// shore, and sparkles. `shore` is an ellipse (centre xz, radii) in world space.
render_mode cull_disabled, specular_disabled;

uniform vec3 shallow : source_color = vec3(0.42, 0.88, 0.86);
uniform vec3 deep : source_color = vec3(0.18, 0.55, 0.86);
uniform vec4 shore = vec4(0.0, 0.0, 17.0, 15.0);
uniform float fade = 14.0;      // how far out the shallows reach
uniform float wave = 0.08;
uniform float foam_w = 0.9;

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += (sin(wpos.x * 0.6 + TIME * 1.1) + sin(wpos.z * 0.8 + TIME * 0.9)) * wave;
}

void fragment() {
	vec2 q = (wpos.xz - shore.xy) / shore.zw;
	float r = length(q);                       // 1 at the shore
	float out_m = abs(r - 1.0) * min(shore.z, shore.w);   // metres from the shore, roughly (either side)
	float t = clamp(out_m / fade, 0.0, 1.0);
	vec3 c = mix(shallow, deep, t);
	// foam: a soft band at the shore that breathes
	float f = 1.0 - smoothstep(0.0, foam_w + 0.25 * sin(TIME * 1.3 + atan(q.y, q.x) * 6.0), out_m);
	c = mix(c, vec3(1.0), f * 0.85);
	// little sparkles
	float s = sin(wpos.x * 3.1 + TIME * 2.0) * sin(wpos.z * 2.7 - TIME * 1.7);
	c += vec3(smoothstep(0.92, 1.0, s)) * 0.35 * (1.0 - t * 0.5);
	ALBEDO = c;
	ROUGHNESS = 0.3;
	EMISSION = c * 0.25;
}

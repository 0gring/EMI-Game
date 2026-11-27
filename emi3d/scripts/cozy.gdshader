shader_type spatial;
// The garden's look: colours from the model's vertices, soft two-tone
// shading (lit side and a warm-tinted shade, a smooth step between them),
// a light rim on the edges facing away, and a little sky light from above.
render_mode cull_back;

uniform vec3 shade_tint : source_color = vec3(0.78, 0.74, 0.92);
uniform float rim_amount = 0.18;
uniform float sway = 0.0;          // leaves and grass move in the wind (0 for still things)
uniform float sway_height = 1.0;   // metres above the object's base where the sway is full

varying vec3 world_pos;

void vertex() {
	if (sway > 0.0) {
		vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
		float k = clamp(VERTEX.y / sway_height, 0.0, 1.0);
		k *= k;
		VERTEX.x += sin(TIME * 1.7 + wp.x * 0.7 + wp.z * 0.4) * sway * k;
		VERTEX.z += cos(TIME * 1.3 + wp.z * 0.6) * sway * 0.6 * k;
	}
}

void fragment() {
	// glTF stores linear colours; Godot hands them to the shader linearized once more
	ALBEDO = pow(COLOR.rgb, vec3(1.0 / 2.2));
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
	float rim = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	EMISSION = ALBEDO * smoothstep(0.55, 1.0, rim) * rim_amount;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float lit = smoothstep(-0.05, 0.25, ndl) * ATTENUATION;
	vec3 shade = ALBEDO * shade_tint * 0.55;
	DIFFUSE_LIGHT += mix(shade, ALBEDO, lit) * LIGHT_COLOR / PI;
}

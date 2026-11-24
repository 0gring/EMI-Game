// The rare rainbow balloon: bands of colour sweep slowly across it, the
// balloon's own shading kept underneath.
shader_type canvas_item;

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
	float k = UV.y * 3.0 - UV.x * 1.2 + TIME * 0.6;
	vec3 rb = 0.55 + 0.45 * cos(6.2831 * (k + vec3(0.0, 0.33, 0.67)));
	COLOR = vec4(rb * tex.rgb * 1.08, tex.a);
}

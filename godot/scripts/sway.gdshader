// Wind: the top of a sprite sways while its base stays planted. Each sprite
// gets its own phase from where it stands, so a meadow ripples rather than
// waving in unison.
shader_type canvas_item;

uniform float amount = 6.0;
uniform float speed = 1.6;

void vertex() {
	float phase = MODEL_MATRIX[3].x * 0.013 + MODEL_MATRIX[3].y * 0.007;
	float k = 1.0 - UV.y;
	VERTEX.x += sin(TIME * speed + phase) * amount * k * k;
}

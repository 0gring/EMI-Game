class_name Puppet
extends Creature
## A character assembled from painted pieces (PNG cut-outs of generated art
## sheets, see tools/cutout.py) instead of the drawn SVG parts.
##
## It builds the same named parts the Creature rig animates - body, head,
## ears, arms, tail, eyes, happy eyes, cheeks, mouths - so every bit of life
## in Creature (breathing, blinking, eyes and head following her finger, ears
## and tail on springs, squash and stretch, talking, laughing) works unchanged.
##
## Geometry is in the same design units as Creature: 1000 units tall, origin
## between the feet, body pivot 60 units up, head centre 620 units above that.

@export var kit := "luli"

func png(name: String) -> Texture2D:
	return load("res://art/%s/%s.png" % [kit, name])

## A painted piece scaled so its height is `h` design units, placed with its
## anchor (0..1 inside the picture: 0.5,0.5 is the centre, 0.5,0 the top
## middle) at `pos`.
func piece(name: String, parent: Node, pos: Vector2, h: float, anchor := Vector2(0.5, 0.5), flip := false) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = png(name)
	var size := s.texture.get_size()
	var k := h * u / size.y
	s.scale = Vector2(-k if flip else k, k)
	s.offset = (Vector2(0.5, 0.5) - anchor) * size
	s.position = pos * u
	parent.add_child(s)
	return s

func build() -> void:
	for c in get_children():
		c.queue_free()
	parts.clear()
	u = height / 1000.0
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS

	var shadow := spr("glow", self, Vector2(0, 0), 2.2, Color(0.2, 0.1, 0.3, 0.28))
	shadow.scale.y *= 0.28
	parts["shadow"] = shadow
	root = Node2D.new()
	add_child(root)
	body_pivot = Node2D.new()
	body_pivot.position = Vector2(0, -60) * u
	root.add_child(body_pivot)

	# behind the body: the tail, swishing from its root
	parts["tail"] = piece("tail", body_pivot, Vector2(150, -170), 330, Vector2(0.15, 0.25))

	# legs hang from the hips, body over them, arms from the shoulders
	parts["leg_l"] = piece("leg_l", body_pivot, Vector2(-95, -210), 270, Vector2(0.5, 0.05))
	parts["leg_r"] = piece("leg_r", body_pivot, Vector2(95, -210), 270, Vector2(0.5, 0.05))
	parts["body"] = piece("body", body_pivot, Vector2(0, -215), 470)
	parts["belly"] = Node2D.new()      # the painted body already has its belly
	body_pivot.add_child(parts["belly"])
	parts["arm_l"] = piece("arm_l", body_pivot, Vector2(-160, -400), 290, Vector2(0.5, 0.06))
	parts["arm_r"] = piece("arm_r", body_pivot, Vector2(160, -400), 290, Vector2(0.5, 0.06))
	for a in ["arm_l", "arm_r"]:
		parts[a].set_meta("rest", 0.12)

	head = Node2D.new()
	head.position = Vector2(0, -620) * u
	body_pivot.add_child(head)

	# the mane frames the face from behind, ears stand behind it
	parts["mane_back"] = piece("mane", head, Vector2(0, -70), 880)
	for side in [-1, 1]:
		var pivot := Node2D.new()
		pivot.position = Vector2(side * 225, -260) * u
		head.add_child(pivot)
		piece("ear_l" if side < 0 else "ear_r", pivot, Vector2.ZERO, 250, Vector2(0.5, 0.92))
		parts["ear_l" if side < 0 else "ear_r"] = pivot

	parts["head"] = piece("head", head, Vector2(0, 0), 730)
	# a curl falling over the forehead, in front of the head
	var fore := piece("lock_s", head, Vector2(-70, -300), 190)
	fore.rotation = -0.3
	parts["forelock"] = fore
	parts["horn"] = piece("horn", head, Vector2(25, -300), 230, Vector2(0.5, 0.95))
	parts["horn"].rotation = 0.08

	# face: painted eyes (the right one mirrored so the lashes sit outside)
	for side in [-1, 1]:
		var key := "l" if side < 0 else "r"
		var e := piece("eye", head, Vector2(side * 150, -70), 190, Vector2(0.5, 0.5), side > 0)
		e.set_meta("s", absf(e.scale.x))
		e.set_meta("flip", -1.0 if side > 0 else 1.0)
		parts["eye_" + key] = e
		var hp := piece("eye_happy", head, Vector2(side * 150, -80), 90, Vector2(0.5, 0.5), side > 0)
		parts["happy_" + key] = hp
		var ck := spr("cheek", head, Vector2(side * 225, 40), 0.42)
		parts["cheek_" + key] = ck
	# mouths: the painted tongue-out one, drawn ones for the rest
	var mouths := {}
	for m in ["smile", "open", "o", "grin"]:
		mouths[m] = spr("mouth_" + m, head, Vector2(0, 250), 0.5)
	mouths["tongue"] = piece("mouth_tongue", head, Vector2(0, 255), 110)
	parts["mouths"] = mouths
	set_mouth("smile")

## Luli's voice is her own little harp chime, whatever `species` says.
func voice() -> void:
	for v in VOICES["unicorn"]:
		var delay: float = v[4] if v.size() > 4 else 0.0
		Game.note(v[0], v[1], 0.55, delay)

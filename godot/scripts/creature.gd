class_name Creature
extends Node2D
## A character built from separate parts, every one of them alive.
##
## Nothing in here is a canned animation. Each frame the rig breathes, blinks,
## turns its eyes and head toward the nearest finger, lets its ears and tail
## lag behind the head on springs, and squashes and stretches whenever it is
## poked, lands, laughs or talks. Emotions swap the eyes and mouth.
##
## The origin is between the feet; `height` is the character's height in pixels.

const SPECIES := {
	"unicorn": {"color": "#f6ecff", "light": "#ffffff", "ears": "pointy", "tail": "rainbow", "nose": "", "horn": true, "mane": true},
	"bunny": {"color": "#f3e6ee", "light": "#ffffff", "ears": "long", "tail": "puff", "nose": "nose"},
	"cat": {"color": "#ffb347", "light": "#fff1dc", "ears": "pointy", "tail": "long", "nose": "nose", "whiskers": true},
	"dog": {"color": "#c98a55", "light": "#fbe8d4", "ears": "floppy", "tail": "long", "nose": "nose"},
	"bear": {"color": "#a8744c", "light": "#f0d6b8", "ears": "round", "tail": "puff", "nose": "nose"},
	"pig": {"color": "#ffb0c8", "light": "#ffd9e5", "ears": "pig", "tail": "curl", "nose": "nose_pig"},
	"fox": {"color": "#ff8a3d", "light": "#fff6ec", "ears": "pointy", "tail": "long", "nose": "nose", "whiskers": true},
	"panda": {"color": "#f4f4f4", "light": "#ffffff", "ears": "round", "tail": "puff", "nose": "nose", "patches": true, "dark": "#3a3640"},
	"mouse": {"color": "#c6c0d6", "light": "#f3eff9", "ears": "round", "tail": "long", "nose": "nose", "big_ears": true, "whiskers": true},
	"frog": {"color": "#7ed957", "light": "#d8f7b8", "ears": "", "tail": "", "nose": "", "frog": true},
}

const NAMES := {"unicorn": "לולי", "bunny": "ארנב", "cat": "חתול", "dog": "כלב", "bear": "דוב",
	"pig": "חזיר", "fox": "שועל", "panda": "פנדה", "mouse": "עכבר", "frog": "צפרדע"}

# What each one says, as an instrument bent into a voice (see Creature.voice).
const VOICES := {
	"cat": [["flute", "A5", 0.5, [[0, 0.86], [0.12, 1.1], [0.45, 0.72]]]],
	"dog": [["piano", "C4", 0.22, [[0, 1.2], [0.16, 0.85]]], ["piano", "C4", 0.26, [[0, 1.1], [0.2, 0.8]], 0.24]],
	"bunny": [["xylophone", "G6", 0.2, []], ["xylophone", "C7", 0.2, [], 0.09], ["xylophone", "E7", 0.2, [], 0.18]],
	"bear": [["piano", "C3", 0.8, [[0, 0.6], [0.4, 0.7], [0.8, 0.5]]]],
	"pig": [["piano", "D4", 0.14, [[0, 0.7], [0.12, 1.0]]], ["piano", "D4", 0.16, [[0, 0.72], [0.13, 1.05]], 0.18]],
	"fox": [["flute", "E6", 0.3, [[0, 0.9], [0.1, 1.3], [0.3, 0.9]]]],
	"panda": [["flute", "C5", 0.4, [[0, 1.0], [0.4, 1.25]]]],
	"mouse": [["xylophone", "E7", 0.12, []], ["xylophone", "E7", 0.12, [], 0.12]],
	"frog": [["piano", "E3", 0.12, [[0, 0.8], [0.09, 1.15]]], ["piano", "E3", 0.14, [[0, 0.8], [0.1, 1.2]], 0.2]],
	"unicorn": [["harp", "C6", 0.3, []], ["harp", "E6", 0.3, [], 0.08], ["harp", "G6", 0.3, [], 0.16]],
}

@export var species := "bunny"
@export var height := 400.0

var u := 0.4            # pixels per design unit (1000 units = full height)
var t := 0.0
var seed_ := randf() * 10.0

# springs: value, velocity
var squash := 0.0
var squash_v := 0.0
var hop := 0.0          # vertical offset, negative is up
var hop_v := 0.0
var lean := 0.0
var lean_v := 0.0
var ear_l := 0.0
var ear_l_v := 0.0
var ear_r := 0.0
var ear_r_v := 0.0
var head_prev := Vector2.ZERO

var look := Vector2.ZERO
var look_target := Vector2.ZERO
var blink_t := randf_range(0.5, 4.0)
var blink := 0.0
var emotion := "idle"       # idle, happy, surprised, giggle, talk
var emotion_t := 0.0
var talk_t := 0.0
var mouth_flip := 0.0
var wiggle := 0.0
var dance := 0.0

# parts
var root: Node2D
var body_pivot: Node2D
var head: Node2D
var parts := {}

func _ready() -> void:
	build()

func tex(name: String) -> Texture2D:
	return load("res://art/%s.svg" % name)

func spr(name: String, parent: Node, pos: Vector2, scl: float, col := Color.WHITE, z := 0) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tex(name)
	s.position = pos * u
	s.scale = Vector2.ONE * scl * u
	s.modulate = col
	s.z_index = z
	parent.add_child(s)
	return s

func build() -> void:
	for c in get_children():
		c.queue_free()
	parts.clear()
	u = height / 1000.0
	# a species with painted art is built from it instead (see painted.gd)
	if Painted.KITS.has(species):
		_build_painted(Painted.KITS[species])
		return
	var sp: Dictionary = SPECIES.get(species, SPECIES["bunny"])
	var col := Color(sp["color"])
	var light := Color(sp["light"])

	var shadow := spr("glow", self, Vector2(0, 0), 2.2, Color(0.2, 0.1, 0.3, 0.28))
	shadow.scale.y *= 0.28
	parts["shadow"] = shadow

	root = Node2D.new()
	add_child(root)
	body_pivot = Node2D.new()
	body_pivot.position = Vector2(0, -60) * u
	root.add_child(body_pivot)

	# behind the body: tail
	match sp["tail"]:
		"puff":
			parts["tail"] = spr("tail_puff", body_pivot, Vector2(170, -150), 0.75, col)
		"long":
			parts["tail"] = spr("tail_long", body_pivot, Vector2(200, -200), 1.15, col)
		"curl":
			parts["tail"] = spr("tail_curl", body_pivot, Vector2(190, -220), 1.0, col)
		"rainbow":
			parts["tail"] = spr("tail_rainbow", body_pivot, Vector2(200, -230), 1.3)

	# legs, then body, then arms in front
	parts["leg_l"] = spr("leg", body_pivot, Vector2(-120, -90), 0.85, col)
	parts["leg_r"] = spr("leg", body_pivot, Vector2(120, -90), 0.85, col)
	parts["body"] = spr("body", body_pivot, Vector2(0, -270), 1.4, col)
	parts["belly"] = spr("belly", body_pivot, Vector2(0, -250), 0.95, light)
	parts["arm_l"] = spr("arm", body_pivot, Vector2(-200, -360), 0.95, col)
	parts["arm_r"] = spr("arm", body_pivot, Vector2(200, -360), 0.95, col)
	parts["arm_l"].rotation = 0.35
	parts["arm_r"].rotation = -0.35

	head = Node2D.new()
	head.position = Vector2(0, -620) * u
	body_pivot.add_child(head)
	var hs := 1.9

	# ears behind the head
	if sp["ears"] != "":
		var et: String = sp["ears"]
		var es := 1.25 if et != "long" else 1.35
		if sp.get("big_ears", false):
			es = 2.1
		var ex := 250.0 if et != "floppy" else 330.0
		var ey := -260.0 if et != "floppy" else -150.0
		for side in [-1, 1]:
			var pivot := Node2D.new()
			pivot.position = Vector2(side * ex, ey) * u
			pivot.rotation = side * (0.35 if et != "floppy" else 0.1)
			head.add_child(pivot)
			# floppy ears hang in front of the head, the rest stand behind it
			if et == "floppy":
				pivot.z_index = 1
			var ear := spr("ear_" + et, pivot, Vector2(0, -40 if et != "floppy" else 30), es, col)
			if et == "floppy" and side > 0:
				ear.scale.x *= -1
			spr("ear_%s_in" % et, ear, Vector2.ZERO, 1.0 / u, Color(1, 1, 1, 0.95)).scale = Vector2.ONE
			parts["ear_l" if side < 0 else "ear_r"] = pivot

	if sp.get("mane", false):
		# a rainbow mane tucked behind the head, peeking out over the top and
		# down one side
		var spots := [Vector2(-60, -300), Vector2(-210, -250), Vector2(-320, -140), Vector2(-370, 10),
			Vector2(-360, 150), Vector2(80, -310)]
		for i in spots.size():
			var m := spr("mane_%d" % (i % 4), head, spots[i], 0.95)
			m.rotation = -0.5 - i * 0.4
			parts["mane_%d" % i] = m

	parts["head"] = spr("head", head, Vector2.ZERO, hs, col)

	if sp.get("frog", false):
		# frogs wear their eyes on top of the head
		for side in [-1, 1]:
			spr("head", head, Vector2(side * 200, -300), 0.55, col)

	if sp.get("patches", false):
		for side in [-1, 1]:
			var p := spr("eye_patch", head, Vector2(side * 160, -10), 0.62, Color(sp["dark"]))
			p.rotation = side * -0.5
		for k in ["ear_l", "ear_r"]:
			if parts.has(k):
				(parts[k].get_child(0) as Sprite2D).modulate = Color(sp["dark"])
		parts["arm_l"].modulate = Color(sp["dark"])
		parts["arm_r"].modulate = Color(sp["dark"])
		parts["leg_l"].modulate = Color(sp["dark"])
		parts["leg_r"].modulate = Color(sp["dark"])

	if sp["nose"] != "" or species == "unicorn":
		parts["muzzle"] = spr("muzzle", head, Vector2(0, 175), 1.05, light)
	if sp.get("whiskers", false):
		for side in [-1, 1]:
			var w := spr("whisker", head, Vector2(side * 230, 170), 0.8)
			w.scale.x *= -side
	var ey := -300.0 if sp.get("frog", false) else -10.0
	var ex := 200.0 if sp.get("frog", false) else 150.0
	parts["eye_l"] = spr("eye", head, Vector2(-ex, ey), 0.5)
	parts["eye_r"] = spr("eye", head, Vector2(ex, ey), 0.5)
	parts["happy_l"] = spr("eye_happy", head, Vector2(-ex, ey), 0.5)
	parts["happy_r"] = spr("eye_happy", head, Vector2(ex, ey), 0.5)
	parts["cheek_l"] = spr("cheek", head, Vector2(-260, 130), 0.45)
	parts["cheek_r"] = spr("cheek", head, Vector2(260, 130), 0.45)
	if sp["nose"] != "":
		parts["nose"] = spr(sp["nose"], head, Vector2(0, 120 if sp["nose"] == "nose" else 140), 0.42 if sp["nose"] == "nose" else 0.6)
	var mouths := {}
	for m in ["smile", "open", "o", "grin", "tongue"]:
		mouths[m] = spr("mouth_" + m, head, Vector2(0, 230 if not sp.get("frog", false) else 120), 0.6 if not sp.get("frog", false) else 0.9)
	parts["mouths"] = mouths
	if sp.get("horn", false):
		parts["horn"] = spr("horn", head, Vector2(20, -330), 0.9)
		parts["horn"].rotation = 0.1
	set_mouth("smile")

# --- painted characters ---------------------------------------------------------

## A painted piece (art/<kit>/<name>.png) scaled so its height is `h` design
## units, with its anchor (0..1 inside the picture) at `pos`.
func piece(kit: String, name: String, parent: Node, pos: Vector2, h: float, anchor := Vector2(0.5, 0.5), flip := false) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = load("res://art/%s/%s.png" % [kit, name])
	var size := s.texture.get_size()
	var k := h * u / size.y
	s.scale = Vector2(-k if flip else k, k)
	s.offset = (Vector2(0.5, 0.5) - anchor) * size
	s.position = pos * u
	parent.add_child(s)
	return s

func _has(kit: String, name: String) -> bool:
	return ResourceLoader.exists("res://art/%s/%s.png" % [kit, name])

## Builds the same named parts the drawn rig has, from painted pieces, so all
## the life in _pose and _face works unchanged.
func _build_painted(cfg: Dictionary) -> void:
	var kit: String = cfg["kit"]
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var shadow := spr("glow", self, Vector2(0, 0), 2.2, Color(0.2, 0.1, 0.3, 0.28))
	shadow.scale.y *= 0.28
	parts["shadow"] = shadow
	root = Node2D.new()
	add_child(root)
	body_pivot = Node2D.new()
	body_pivot.position = Vector2(0, -60) * u
	root.add_child(body_pivot)

	if cfg.has("tail") and _has(kit, "tail"):
		var tl: Dictionary = cfg["tail"]
		parts["tail"] = piece(kit, "tail", body_pivot, tl["pos"], tl["h"], tl["anchor"])
	parts["leg_l"] = piece(kit, "leg_l", body_pivot, Vector2(-95, -210), 270, Vector2(0.5, 0.05))
	parts["leg_r"] = piece(kit, "leg_r", body_pivot, Vector2(95, -210), 270, Vector2(0.5, 0.05))
	parts["body"] = piece(kit, "body", body_pivot, Vector2(0, -215), 470)
	parts["body"].set_meta("base", parts["body"].scale)
	parts["belly"] = Node2D.new()      # painted bodies carry their own belly
	body_pivot.add_child(parts["belly"])
	parts["arm_l"] = piece(kit, "arm_l", body_pivot, Vector2(-160, -400), 290, Vector2(0.5, 0.06))
	parts["arm_r"] = piece(kit, "arm_r", body_pivot, Vector2(160, -400), 290, Vector2(0.5, 0.06))
	for a in ["arm_l", "arm_r"]:
		parts[a].set_meta("rest", cfg.get("arm_rest", 0.12))

	head = Node2D.new()
	head.position = Vector2(0, -620) * u
	body_pivot.add_child(head)
	for e in cfg.get("behind_head", []):
		var p := piece(kit, e[0], head, e[1], e[2], e[3])
		p.rotation = e[4]
	if cfg.has("ears"):
		var ec: Dictionary = cfg["ears"]
		for side in [-1, 1]:
			var pivot := Node2D.new()
			pivot.position = Vector2(side * float(ec["x"]), ec["y"]) * u
			head.add_child(pivot)
			var an: Vector2 = ec["anchor"]
			if side > 0:
				an.x = 1.0 - an.x
			piece(kit, "ear_l" if side < 0 else "ear_r", pivot, Vector2.ZERO, ec["h"], an)
			parts["ear_l" if side < 0 else "ear_r"] = pivot
	parts["head"] = piece(kit, "head", head, Vector2(0, cfg.get("head_y", 0)), cfg["head_h"])
	for e in cfg.get("over_head", []):
		var p := piece(kit, e[0], head, e[1], e[2], e[3])
		p.rotation = e[4]

	var ey: Dictionary = cfg["eyes"]
	# eyes can come from another painted animal while this one has no face sheet
	var ek: String = cfg.get("eye_kit", kit)
	for side in [-1, 1]:
		var key := "l" if side < 0 else "r"
		# the right eye is mirrored so painted lashes sit on the outside
		var e := piece(ek, "eye", head, Vector2(side * float(ey["x"]), ey["y"]), ey["h"], Vector2(0.5, 0.5), side > 0)
		e.set_meta("s", absf(e.scale.x))
		e.set_meta("flip", -1.0 if side > 0 else 1.0)
		parts["eye_" + key] = e
		if _has(ek, "eye_happy"):
			parts["happy_" + key] = piece(ek, "eye_happy", head, Vector2(side * float(ey["x"]), ey.get("happy_y", ey["y"])), ey["happy_h"], Vector2(0.5, 0.5), side > 0)
		else:
			parts["happy_" + key] = spr("eye_happy", head, Vector2(side * float(ey["x"]), ey["y"]), 0.4)
		var ck: Dictionary = cfg["cheeks"]
		parts["cheek_" + key] = spr("cheek", head, Vector2(side * float(ck["x"]), ck["y"]), 0.42)

	var mc: Dictionary = cfg["mouth"]
	var mouths := {}
	for m in ["smile", "open", "o", "grin", "tongue"]:
		if m == "smile" and mc.has("idle"):
			mouths[m] = Node2D.new()          # the painted face's own smile
			head.add_child(mouths[m])
		elif _has(kit, "mouth_" + m):
			mouths[m] = piece(kit, "mouth_" + m, head, Vector2(0, mc["y"]), mc["h"])
		else:
			mouths[m] = spr("mouth_" + m, head, Vector2(0, mc["y"]), 0.45 * float(mc["h"]) / 110.0)
	parts["mouths"] = mouths
	set_mouth("smile")

func set_mouth(m: String) -> void:
	var mouths: Dictionary = parts.get("mouths", {})
	for k in mouths:
		mouths[k].visible = (k == m)

# --- what scenes call ----------------------------------------------------------

## A happy poke: squash, bounce, giggle.
func poke() -> void:
	squash_v -= 9.0
	jump(0.6)
	feel("giggle", 0.9)
	voice()

func jump(power := 1.0) -> void:
	hop_v = -1400.0 * power * u
	squash_v += 6.0 * power

func feel(e: String, secs := 1.2) -> void:
	emotion = e
	emotion_t = secs
	if e == "giggle":
		wiggle = 1.0

func celebrate() -> void:
	feel("happy", 2.2)
	jump(1.2)
	dance = 2.2

func talk(secs: float) -> void:
	talk_t = secs

func look_at_point(p: Vector2) -> void:
	look_target = (p - global_position - Vector2(0, -height * 0.65)).normalized() * clampf((p - global_position).length() / 600.0, 0.0, 1.0)

## Plays this animal's sound.
func voice() -> void:
	for v in VOICES.get(species, []):
		var delay: float = v[4] if v.size() > 4 else 0.0
		Game.note(v[0], v[1], 0.55, delay)

# --- the living part -----------------------------------------------------------------

static func spring(x: float, v: float, target: float, k: float, d: float, dt: float) -> Vector2:
	var a := (target - x) * k - v * d
	v += a * dt
	x += v * dt
	return Vector2(x, v)

func _process(dt: float) -> void:
	dt = minf(dt, 1.0 / 30.0)
	t += dt
	# springs, sub-stepped for stability
	var steps := 2
	var h := dt / steps
	for i in steps:
		var r := spring(squash, squash_v, 0.0, 260.0, 9.0, h)
		squash = r.x
		squash_v = r.y
		hop_v += 5200.0 * u * h
		hop += hop_v * h
		if hop > 0.0:
			if hop_v > 300.0 * u:
				squash_v += hop_v / (900.0 * u)     # land with a squash
			hop = 0.0
			hop_v = 0.0

	# pick the nearest finger to look at, else drift gently
	var vp := get_viewport()
	var target := Vector2(sin(t * 0.5 + seed_) * 0.3, cos(t * 0.37 + seed_) * 0.15)
	if Game.last_touch.size() > 0:
		var best: Vector2 = Game.last_touch.values()[0]
		look_at_point(best)
		target = look_target
	look = look.lerp(target, minf(1.0, dt * 6.0))

	# blink
	blink_t -= dt
	if blink_t <= 0.0:
		blink = 1.0
		blink_t = randf_range(2.0, 4.5)
	blink = maxf(0.0, blink - dt * 7.0)

	emotion_t -= dt
	if emotion_t <= 0.0 and emotion != "idle":
		emotion = "idle"
	talk_t -= dt
	wiggle = maxf(0.0, wiggle - dt * 1.1)
	dance = maxf(0.0, dance - dt)

	_pose(dt)
	_face(dt)

func _pose(dt: float) -> void:
	var breath := sin(t * 2.4 + seed_) * 0.025
	var s := squash + breath
	var dance_k := minf(1.0, dance)
	root.position.y = hop
	root.rotation = sin(t * 14.0) * 0.08 * wiggle + sin(t * 8.0) * 0.12 * dance_k
	body_pivot.scale = Vector2(1.0 + s * 0.5, 1.0 - s * 0.5)
	if dance_k > 0.0 and hop >= 0.0 and fmod(t, 0.55) < dt:
		jump(0.5)
	# head follows the look, with a little bob
	head.position = Vector2(look.x * 40.0, -620.0 + look.y * 20.0 + sin(t * 2.4 + seed_) * 6.0) * u
	head.rotation = look.x * 0.12 + sin(t * 1.3 + seed_) * 0.03 + sin(t * 16.0) * 0.06 * wiggle

	# ears trail the head's motion on springs
	var hp := head.global_position
	var vel := (hp - head_prev) / maxf(dt, 0.001)
	head_prev = hp
	var push := clampf(-vel.y / 900.0 + -vel.x / 1400.0, -0.7, 0.7)
	var r := spring(ear_l, ear_l_v, push + sin(t * 1.7 + seed_) * 0.05, 120.0, 6.0, dt)
	ear_l = r.x
	ear_l_v = r.y
	r = spring(ear_r, ear_r_v, -push + sin(t * 1.9 + seed_) * 0.05, 120.0, 6.0, dt)
	ear_r = r.x
	ear_r_v = r.y
	var sp: Dictionary = SPECIES.get(species, {})
	var base := 0.35 if sp.get("ears", "") != "floppy" else 0.1
	if parts.has("ear_l"):
		parts["ear_l"].rotation = -base + ear_l
	if parts.has("ear_r"):
		parts["ear_r"].rotation = base + ear_r
	if parts.has("tail"):
		parts["tail"].rotation = sin(t * (9.0 if emotion == "happy" else 3.0)) * (0.3 if emotion == "happy" else 0.1)
	# arms swing, wave when happy
	var wave := 1.0 if emotion == "happy" else 0.0
	var rest: float = parts["arm_l"].get_meta("rest", 0.35)
	parts["arm_l"].rotation = rest + sin(t * 2.0 + seed_) * 0.05 - wave * (1.6 + sin(t * 12.0) * 0.4)
	parts["arm_r"].rotation = -rest - sin(t * 2.0 + seed_) * 0.05 + wave * (1.6 + sin(t * 12.0 + 1.0) * 0.4)
	parts["shadow"].scale.x = 2.2 * u * (1.0 + hop / (height * 0.8))
	parts["shadow"].modulate.a = 0.28 * (1.0 + hop / height)

func _face(_dt: float) -> void:
	var happy := emotion == "happy" or emotion == "giggle"
	for side in ["l", "r"]:
		var e: Sprite2D = parts["eye_" + side]
		var hpy: Sprite2D = parts["happy_" + side]
		e.visible = not happy
		hpy.visible = happy
		# a rig built from painted pieces stores each eye's own size
		var sx: float = e.get_meta("s", 0.5 * u)
		var sy := sx * (1.0 - blink * 0.9)
		if emotion == "surprised":
			sx *= 1.2
			sy *= 1.2
		# a mirrored eye (painted lashes on the outside) keeps its mirroring
		var flip: float = e.get_meta("flip", 1.0)
		e.scale = Vector2(sx * flip, sy)
		e.offset = look * e.texture.get_width() * 0.08 * Vector2(flip, 1.0)
	var m := "smile"
	if talk_t > 0.0:
		mouth_flip += get_process_delta_time()
		m = ["open", "o", "smile", "open"][int(mouth_flip * 9.0) % 4]
	elif emotion == "happy":
		m = "grin"
	elif emotion == "giggle":
		m = "tongue" if wiggle > 0.5 else "grin"
	elif emotion == "surprised":
		m = "o"
	set_mouth(m)
	var ck := 0.75 + (0.25 if happy else 0.0)
	parts["cheek_l"].modulate.a = ck
	parts["cheek_r"].modulate.a = ck

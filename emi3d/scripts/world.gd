class_name World
extends Node2D
## The living backdrop shared by every scene: the painted sky-and-hills shader,
## clouds that drift, trees, bushes, flowers and grass that sway in the wind,
## butterflies that wander, and motes of light floating up.
##
## Scenes pick a mood (colours) and keep the middle of the meadow clear for
## their own play by passing `keep_clear` rects.

const SWAY := preload("res://scripts/sway.gdshader")

var size := Vector2(1920, 1080)
var horizon := 0.56
var bg: ColorRect
var clouds: Array[Sprite2D] = []
var flies: Array = []
var motes: Array = []
var t := 0.0

## Drawn art by name, or its painted replacement (art/p, see tools/make_props.py)
## when there is one: same canvas, so callers keep their scales and offsets.
static func tex(name: String) -> Texture2D:
	var p := "res://art/p/%s.png" % name
	if ResourceLoader.exists(p):
		return load(p)
	return load("res://art/%s.svg" % name)

func setup(mood := {}, keep_clear: Array[Rect2] = [], density := 1.0) -> void:
	size = get_viewport_rect().size
	horizon = mood.get("horizon", 0.56)
	bg = ColorRect.new()
	bg.size = size
	var mat := ShaderMaterial.new()
	mat.shader = load("res://scripts/world.gdshader")
	mat.set_shader_parameter("aspect", size.x / size.y)
	mat.set_shader_parameter("horizon", horizon)
	for k in mood:
		if k != "horizon":
			mat.set_shader_parameter(k, mood[k])
	bg.material = mat
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	# Painted backdrop (generated art, see tools/make_bg.py) over the shader:
	# a sky with its own sun and clouds, and rolling hills from the horizon down.
	var painted := ResourceLoader.exists("res://art/bg/sky.jpg") and ResourceLoader.exists("res://art/bg/hills.png")
	if painted:
		var sky := Sprite2D.new()
		sky.texture = load("res://art/bg/sky.jpg")
		sky.centered = false
		var ss := maxf(size.x / sky.texture.get_width(), size.y / sky.texture.get_height())
		sky.scale = Vector2(ss, ss)
		add_child(sky)
		# the painted sun breathes a little light
		var sun := Sprite2D.new()
		sun.texture = tex("glow")
		sun.position = Vector2(0.775, 0.37) * sky.texture.get_size() * ss
		sun.scale = Vector2.ONE * size.y / 300.0
		sun.modulate = Color(1, 0.95, 0.8, 0.35)
		sun.set_meta("sun", true)
		add_child(sun)
		var hills := Sprite2D.new()
		hills.texture = load("res://art/bg/hills.png")
		hills.centered = false
		var hy0 := horizon * size.y - size.y * 0.04
		var hs := maxf(size.x / hills.texture.get_width(), (size.y - hy0) / hills.texture.get_height())
		hills.scale = Vector2(hs, hs)
		hills.position = Vector2((size.x - hills.texture.get_width() * hs) / 2.0, hy0)
		add_child(hills)

	for i in (0 if painted else 4):
		var c := Sprite2D.new()
		c.texture = tex("cloud")
		var s := randf_range(0.45, 0.8)
		c.scale = Vector2(s, s * 0.9)
		c.position = Vector2(randf() * size.x, randf_range(0.07, 0.3) * size.y)
		c.modulate = Color(1, 1, 1, randf_range(0.8, 0.95))
		add_child(c)
		clouds.append(c)

	var hy := horizon * size.y
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	# trees stand on the hills at the sides, nearer ones bigger
	var tree_spots := [Vector2(0.06, 0.0), Vector2(0.17, 0.03), Vector2(0.86, 0.01), Vector2(0.95, 0.05), Vector2(0.3, -0.03), Vector2(0.72, -0.02)]
	for i in int(tree_spots.size() * density):
		var p: Vector2 = tree_spots[i]
		var pos := Vector2(p.x * size.x, hy + p.y * size.y + 40)
		if _blocked(pos, keep_clear):
			continue
		var tr := _swayer("tree_blossom" if painted and i % 2 == 1 else "tree", pos, 0.55 + p.y * 3.0, 3.0, 0.9)
		tr.offset = Vector2(0, -210)
	for i in int(7 * density):
		var pos := Vector2(rng.randf_range(0.02, 0.98) * size.x, hy + rng.randf_range(0.1, 0.2) * size.y)
		if _blocked(pos, keep_clear):
			continue
		var b := _swayer("bush", pos, rng.randf_range(0.32, 0.45), 2.0, 1.2)
		b.offset = Vector2(0, -150)
	# the near meadow: long grass and wildflowers along the bottom
	if painted and ResourceLoader.exists("res://art/bg/meadow.png"):
		var mead := Sprite2D.new()
		mead.texture = load("res://art/bg/meadow.png")
		mead.centered = false
		var ms := maxf(size.x / mead.texture.get_width(), size.y * 0.36 / mead.texture.get_height())
		mead.scale = Vector2(ms, ms)
		mead.position = Vector2((size.x - mead.texture.get_width() * ms) / 2.0, size.y - mead.texture.get_height() * ms)
		add_child(mead)
	if painted:
		# painted clumps of flowers, mushrooms and a mossy rock along the meadow
		var deco := [["clump_a", 0.3], ["shroom_red", 0.32], ["clump_b", 0.3], ["rock", 0.32], ["shroom_brown", 0.28], ["clump_a", 0.26], ["clump_b", 0.28]]
		var dx := [0.04, 0.13, 0.27, 0.93, 0.83, 0.62, 0.45]
		for i in int(deco.size() * density):
			var pos := Vector2(dx[i] * size.x, hy + rng.randf_range(0.22, 0.4) * size.y)
			if _blocked(pos, keep_clear):
				continue
			var d := _swayer(deco[i][0], pos, deco[i][1] * (0.7 + (pos.y - hy) / size.y), 2.0 if deco[i][0].begins_with("clump") else 0.0, 1.5)
			d.offset = Vector2(0, -256 if d.texture.get_height() > 300 else -128)
	var fl := ["flower_pink", "flower_yellow", "flower_white", "flower_blue"]
	for i in int((0 if painted else 34) * density):
		var pos := Vector2(rng.randf() * size.x, hy + rng.randf_range(0.17, 0.46) * size.y)
		if _blocked(pos, keep_clear):
			continue
		var f := _swayer(fl[i % fl.size()], pos, rng.randf_range(0.28, 0.42) * (0.6 + (pos.y - hy) / size.y), 7.0, 2.0)
		f.offset = Vector2(0, -100)
	for i in int((0 if painted else 26) * density):
		var pos := Vector2(rng.randf() * size.x, size.y - rng.randf_range(0.0, 0.09) * size.y)
		var g := _swayer("grass", pos, rng.randf_range(0.6, 0.9), 9.0, 2.2)
		g.offset = Vector2(0, -100)
		g.z_index = 5
	for i in 3:
		flies.append(_butterfly())
	for i in 16:
		var m := Sprite2D.new()
		m.texture = tex("glow")
		m.scale = Vector2.ONE * randf_range(0.05, 0.1)
		m.modulate = Color(1, 0.97, 0.8, 0.0)
		m.position = Vector2(randf() * size.x, randf() * size.y)
		m.set_meta("ph", randf() * 10.0)
		m.set_meta("v", randf_range(12.0, 30.0))
		m.z_index = 6
		add_child(m)
		motes.append(m)

func _blocked(p: Vector2, rects: Array[Rect2]) -> bool:
	for r in rects:
		if r.has_point(p):
			return true
	return false

func _swayer(name: String, pos: Vector2, scl: float, amount: float, speed: float) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tex(name)
	s.position = pos
	s.scale = Vector2(scl, scl)
	var m := ShaderMaterial.new()
	m.shader = SWAY
	m.set_shader_parameter("amount", amount)
	m.set_shader_parameter("speed", speed)
	s.material = m
	add_child(s)
	return s

func _butterfly() -> Node2D:
	var b := Node2D.new()
	var col: Color = [Color("#ff85c8"), Color("#ffd84a"), Color("#8fc8ff"), Color("#c9a4ff")].pick_random()
	for side in [-1, 1]:
		var w := Sprite2D.new()
		w.texture = tex("butterfly_wing")
		w.offset = Vector2(100, -10)
		w.scale = Vector2(side * 0.12, 0.12)
		w.modulate = col
		b.add_child(w)
	var body := Sprite2D.new()
	body.texture = tex("glow")
	body.modulate = Color("#4a3b52")
	body.scale = Vector2(0.05, 0.16)
	b.add_child(body)
	b.position = Vector2(randf() * size.x, randf_range(0.5, 0.8) * size.y)
	b.set_meta("ph", randf() * 10.0)
	b.set_meta("home", b.position)
	b.z_index = 4
	add_child(b)
	return b

func _process(dt: float) -> void:
	t += dt
	for c in clouds:
		c.position.x += dt * 14.0 * c.scale.x
		if c.position.x > size.x + 300:
			c.position.x = -300
	for b in flies:
		var ph: float = b.get_meta("ph")
		var home: Vector2 = b.get_meta("home")
		var p := home + Vector2(sin(t * 0.37 + ph) * 420.0, sin(t * 0.61 + ph * 2.0) * 120.0 + sin(t * 3.1 + ph) * 18.0)
		b.position = Vector2(clampf(p.x, 40, size.x - 40), p.y)
		var flap := absf(sin(t * 14.0 + ph))
		for i in 2:
			var w: Sprite2D = b.get_child(i)
			w.scale.x = (-1 if i == 0 else 1) * 0.12 * (0.25 + flap * 0.75)
	for c in get_children():
		if c is Sprite2D and c.has_meta("sun"):
			c.modulate.a = 0.3 + 0.12 * sin(t * 1.3)
	for m in motes:
		var ph: float = m.get_meta("ph")
		m.position.y -= dt * float(m.get_meta("v"))
		m.position.x += sin(t + ph) * dt * 10.0
		m.modulate.a = 0.25 + 0.25 * sin(t * 1.7 + ph)
		if m.position.y < -20:
			m.position.y = size.y + 20
			m.position.x = randf() * size.x

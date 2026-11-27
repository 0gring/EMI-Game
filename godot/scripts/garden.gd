extends Activity
## The magic garden: plant, water, watch it grow.
##
## Touch bare soil and a seed drops in with a plop. Touch a planted bed and a
## watering can tips over it, and the plant springs up a stage - seed, sprout,
## bud, flower - with a big squash and stretch. The rain cloud with a face waters
## every bed at once; the sun laughs when it is tickled. Each flower that opens
## is named with its colour and brings a butterfly or a bee.
##
## Surprises: a bunny hops in to nibble a carrot that grows at the edge of the
## garden, and a frog leaps out of the puddle the rain leaves behind.
##
## A garden in full bloom gets a rainbow and fireworks; then the flowers are
## picked into a bouquet for Luli and fresh beds are dug. More beds and more
## kinds of flower with each level, up to glowing star-flowers.

const BEDS := [3, 4, 5, 6]
const KINDS := [["daisy", "tulip"], ["daisy", "tulip", "sunflower"], ["daisy", "tulip", "sunflower", "rose"],
	["tulip", "sunflower", "rose", "daisy", "magic"]]
const COLORS := [
	{"c": "#ff4d5e", "one": "אדום"}, {"c": "#ff85c8", "one": "ורוד"}, {"c": "#b07aff", "one": "סגול"},
	{"c": "#ff9a1f", "one": "כתום"}, {"c": "#5aa8ff", "one": "כחול"}, {"c": "#ffffff", "one": "לבן"},
]

var beds: Array[Bed] = []
var visitors: Array[Visitor] = []
var ground_y := 900.0
var plant_h := 360.0
var spacing := 300.0
var cloud: Node2D
var cloud_home := Vector2.ZERO
var sun_node: Node2D
var rainbow: Rainbow
var garden_n := 0
var complete := false
var raining := false
var rained_this_garden := false
var bunny_done := false
var puddle: Sprite2D

func mood() -> Dictionary:
	return {"horizon": 0.5, "sun": Vector2(0.76, 0.17)}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.14, size.y * 0.44, size.x * 0.86, size.y * 0.56)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.075, size.y * 0.97)

func bubble_spot() -> Vector2:
	return Vector2(size.x * 0.44, size.y * 0.07)

func build() -> void:
	hue = Color("#f2b81f")
	goals = [1, 2, 2, 2]
	ground_y = size.y * 0.86
	plant_h = size.y * 0.38
	rainbow = Rainbow.new()
	rainbow.z_index = 1
	add_child(rainbow)
	_build_sun()
	_build_cloud()

func _ready() -> void:
	id = "garden"
	super._ready()
	new_garden(true)
	Shot.maybe(self)

# --- the beds ----------------------------------------------------------------------------

class Bed extends Node2D:
	var stage := 0
	var kind := "daisy"
	var col: Dictionary = {}
	var w := 240.0
	var h := 360.0
	var t := randf() * 10.0
	var squash := 0.0
	var squash_v := 0.0
	var bloom := 0.0
	var busy := false
	var plant: Node2D
	var head: Node2D
	var parts := {}

	func _spr(name: String, parent: Node, pos := Vector2.ZERO, scl := 1.0, off := Vector2.ZERO) -> Sprite2D:
		var s := Sprite2D.new()
		s.texture = World.tex(name)
		s.position = pos
		s.scale = Vector2.ONE * scl
		s.offset = off
		parent.add_child(s)
		return s

	func setup(width: float, height: float, k: String, c: Dictionary) -> void:
		w = width
		h = height
		kind = k
		col = c
		parts["soil"] = _spr("garden_soil", self, Vector2(0, 8), w / 450.0, Vector2(0, -22))
		plant = Node2D.new()
		add_child(plant)
		parts["mound"] = _spr("garden_mound", plant, Vector2.ZERO, w / 640.0, Vector2(0, -72))
		parts["seed"] = _spr("garden_seed", plant, Vector2(0, -w * 0.12), w / 900.0)
		parts["sprout"] = _spr("garden_sprout", plant, Vector2.ZERO, w / 380.0, Vector2(0, -122))
		var ss := h / 470.0
		parts["stem"] = _spr("garden_stem", plant, Vector2.ZERO, ss, Vector2(0, -250))
		head = Node2D.new()
		head.position = Vector2(0, -466.0 * ss)
		plant.add_child(head)
		parts["sepal"] = _spr("garden_sepal", head, Vector2(0, 10), w / 520.0, Vector2(0, -60))
		parts["bud"] = _spr("garden_bud", head, Vector2.ZERO, w / 520.0, Vector2(0, -110))
		var fl := _spr("garden_" + kind, head, Vector2.ZERO, w * (0.86 if kind != "magic" else 0.95) / 480.0)
		parts["flower"] = fl
		if kind != "sunflower" and kind != "magic":
			fl.modulate = Color(col["c"])
			parts["bud"].modulate = Color(col["c"])
		if kind == "daisy":
			parts["center"] = _spr("garden_daisy_c", head, Vector2.ZERO, w * 0.3 / 150.0)
		set_stage(0, false)

	func flower_color_name() -> String:
		if kind == "sunflower":
			return "צהוב"
		if kind == "magic":
			return "קסום"
		return col["one"]

	func flower_tint() -> Color:
		if kind == "sunflower":
			return Color("#ffc61a")
		if kind == "magic":
			return Color("#ff9ee0")
		return Color(col["c"])

	## Shows the parts for `s`; `animate` springs the new part in.
	func set_stage(s: int, animate := true) -> void:
		stage = s
		parts["mound"].visible = s >= 1
		parts["seed"].visible = s == 1
		parts["sprout"].visible = s == 2
		parts["stem"].visible = s >= 3
		parts["sepal"].visible = s == 3
		parts["bud"].visible = s == 3
		parts["flower"].visible = s >= 4
		if parts.has("center"):
			parts["center"].visible = s >= 4
		if not animate:
			plant.scale = Vector2.ONE
			return
		squash_v -= 14.0
		if s == 2:
			_pop_in(parts["sprout"], w / 380.0)
		elif s == 3:
			plant.scale = Vector2(1.0, 0.35)
			var tw := plant.create_tween()
			tw.tween_property(plant, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
			_pop_in(parts["bud"], w / 520.0)
		elif s == 4:
			parts["flower"].rotation = -1.2
			_pop_in(parts["flower"], parts["flower"].scale.x, 0.9)
			var tw: Tween = parts["flower"].create_tween()
			tw.tween_property(parts["flower"], "rotation", 0.0, 0.9).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
			if parts.has("center"):
				_pop_in(parts["center"], w * 0.3 / 150.0, 0.6)

	func _pop_in(s: Sprite2D, target: float, secs := 0.6) -> void:
		s.scale = Vector2.ONE * target * 0.05
		var tw := s.create_tween()
		tw.tween_property(s, "scale", Vector2.ONE * target, secs).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)

	func head_global() -> Vector2:
		if stage >= 3:
			return head.global_position
		return global_position + Vector2(0, -w * 0.25)

	func _process(dt: float) -> void:
		t += dt
		# sub-stepped: one long frame on a busy tablet must not blow the spring up
		var left := minf(dt, 0.1)
		while left > 0.0:
			var h := minf(left, 1.0 / 120.0)
			var a := (0.0 - squash) * 240.0 - squash_v * 8.0
			squash_v += a * h
			squash += squash_v * h
			left -= h
		squash = clampf(squash, -0.6, 0.6)
		var base := plant.scale.y if plant.scale.y < 0.99 else 1.0
		if base >= 0.99:
			plant.scale = Vector2(1.0 + squash * 0.45, 1.0 - squash * 0.45)
		plant.rotation = sin(t * 1.4) * 0.03 + squash * 0.05
		head.rotation = sin(t * 1.9 + 1.0) * 0.06
		if stage >= 4 and kind == "magic":
			parts["flower"].rotation += dt * 0.6

# --- visitors: butterflies and bees round each open flower --------------------------------

class Visitor extends Node2D:
	var bed: Bed
	var bee := false
	var t := randf() * 10.0
	var ph := randf() * TAU
	var r := 110.0
	var wings: Array[Sprite2D] = []
	var body: Sprite2D

	func setup(b: Bed, is_bee: bool, col: Color, size_px: float) -> void:
		bed = b
		bee = is_bee
		r = size_px * 0.9
		if bee:
			body = Sprite2D.new()
			body.texture = World.tex("garden_bee")
			body.scale = Vector2.ONE * size_px / 220.0
			add_child(body)
		else:
			for side in [-1, 1]:
				var wg := Sprite2D.new()
				wg.texture = World.tex("butterfly_wing")
				wg.offset = Vector2(100, -10)
				wg.modulate = col
				wg.scale = Vector2(side, 1) * size_px / 520.0
				add_child(wg)
				wings.append(wg)
			body = Sprite2D.new()
			body.texture = World.tex("glow")
			body.modulate = Color("#4a3b52")
			body.scale = Vector2(0.04, 0.13) * size_px / 70.0
			add_child(body)

	func _process(dt: float) -> void:
		t += dt
		var c := bed.head_global() + Vector2(cos(t * 1.2 + ph) * r, sin(t * 2.1 + ph) * r * 0.45 - r * 0.5)
		position = position.lerp(c, minf(1.0, dt * 2.0))
		if bee:
			body.rotation = sin(t * 9.0) * 0.12
			body.scale.x = absf(body.scale.x) * (-1.0 if cos(t * 1.2 + ph) > 0.0 else 1.0)
		else:
			var flap := absf(sin(t * 13.0 + ph))
			for i in wings.size():
				var s := absf(wings[i].scale.y)
				wings[i].scale.x = (-1 if i == 0 else 1) * s * (0.25 + flap * 0.75)

# --- the sky's two friends --------------------------------------------------------------------

func _face(parent: Node2D, sc: float, eye_y: float, mouth_y: float) -> Dictionary:
	var f := {}
	for side in [-1, 1]:
		var e := Sprite2D.new()
		e.texture = World.tex("eye")
		e.position = Vector2(side * 70, eye_y) * sc
		e.scale = Vector2.ONE * 0.24 * sc
		parent.add_child(e)
		f["eye%d" % side] = e
		var hp := Sprite2D.new()
		hp.texture = World.tex("eye_happy")
		hp.position = e.position
		hp.scale = e.scale
		hp.visible = false
		parent.add_child(hp)
		f["happy%d" % side] = hp
		var ck := Sprite2D.new()
		ck.texture = World.tex("cheek")
		ck.position = Vector2(side * 110, eye_y + 60) * sc
		ck.scale = Vector2.ONE * 0.26 * sc
		parent.add_child(ck)
	for k in ["smile", "grin", "o"]:
		var m := Sprite2D.new()
		m.texture = World.tex("mouth_%s" % k)
		m.position = Vector2(0, mouth_y) * sc
		m.scale = Vector2.ONE * 0.36 * sc
		m.visible = k == "smile"
		parent.add_child(m)
		f[k] = m
	return f

func _set_face(f: Dictionary, mood_name: String) -> void:
	var happy := mood_name == "grin"
	for side in [-1, 1]:
		f["eye%d" % side].visible = not happy
		f["happy%d" % side].visible = happy
	for k in ["smile", "grin", "o"]:
		f[k].visible = k == mood_name

func _build_sun() -> void:
	sun_node = Node2D.new()
	sun_node.position = Vector2(size.x * 0.76, size.y * 0.17)
	sun_node.z_index = 3
	add_child(sun_node)
	var body := Sprite2D.new()
	body.texture = World.tex("garden_sun")
	body.scale = Vector2.ONE * size.y * 0.27 / 512.0
	sun_node.add_child(body)
	sun_node.set_meta("body", body)
	var face_root := Node2D.new()
	sun_node.add_child(face_root)
	sun_node.set_meta("face", _face(face_root, size.y * 0.27 / 512.0, -20, 60))
	sun_node.set_meta("laugh", 0.0)

func _build_cloud() -> void:
	cloud = Node2D.new()
	cloud_home = Vector2(size.x * 0.33, size.y * 0.17)
	cloud.position = cloud_home
	cloud.z_index = 4
	add_child(cloud)
	var body := Sprite2D.new()
	body.texture = World.tex("cloud")
	body.scale = Vector2(1.0, 0.92) * size.y / 1080.0
	cloud.add_child(body)
	cloud.set_meta("body", body)
	var face_root := Node2D.new()
	face_root.position = Vector2(0, -10) * size.y / 1080.0
	cloud.add_child(face_root)
	cloud.set_meta("face", _face(face_root, 0.85 * size.y / 1080.0, -20, 45))

# --- a new garden ------------------------------------------------------------------------------

func new_garden(first := false) -> void:
	for b in beds:
		b.queue_free()
	beds.clear()
	for v in visitors:
		v.queue_free()
	visitors.clear()
	complete = false
	rained_this_garden = false
	bunny_done = false
	garden_n += 1
	var n: int = BEDS[level - 1]
	var left := size.x * 0.19
	var right := size.x * 0.96
	spacing = (right - left) / n
	var bw := minf(spacing * 0.86, size.y * 0.33)
	var kinds: Array = KINDS[level - 1]
	var cols := COLORS.duplicate()
	cols.shuffle()
	for i in n:
		var b := Bed.new()
		b.position = Vector2(right - spacing * (i + 0.5), ground_y)
		b.z_index = 2
		add_child(b)
		var k: String = kinds[i % kinds.size()] if i < kinds.size() else kinds.pick_random()
		b.setup(bw, plant_h, k, cols[i % cols.size()])
		beds.append(b)
		# dug fresh: each bed springs up out of the ground in turn
		b.scale = Vector2(1.4, 0.05)
		var tw := b.create_tween()
		tw.tween_interval(0.15 * i + 0.2)
		tw.tween_callback(func():
			Game.play("drop", 0.4, 0.8 + i * 0.05)
			_dirt(b.global_position))
		tw.tween_property(b, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	if first:
		get_tree().create_timer(0.8).timeout.connect(func(): say("בואי נשתול פרחים!"))
	elif garden_n > 1:
		say("עוד גינה!")

func _dirt(pos: Vector2) -> void:
	var p := CPUParticles2D.new()
	p.texture = World.tex("glow")
	p.position = pos + Vector2(0, -10)
	p.amount = 16
	p.lifetime = 0.7
	p.one_shot = true
	p.explosiveness = 1.0
	p.direction = Vector2.UP
	p.spread = 60.0
	p.initial_velocity_min = 200.0
	p.initial_velocity_max = 420.0
	p.gravity = Vector2(0, 1300)
	p.scale_amount_min = 0.06
	p.scale_amount_max = 0.12
	p.color = Color("#8a5a32")
	p.local_coords = false
	fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)

## Water drops pouring from `pos`, falling about `fall` pixels.
func _drops(pos: Vector2, spread_w: float, amount: int, secs: float, fall: float) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.texture = World.tex("glow")
	p.position = pos
	p.amount = amount
	p.lifetime = clampf(sqrt(2.0 * fall / 2200.0), 0.3, 1.2)
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(spread_w / 2.0, 6)
	p.direction = Vector2.DOWN
	p.spread = 6.0
	p.initial_velocity_min = 120.0
	p.initial_velocity_max = 220.0
	p.gravity = Vector2(0, 2200)
	p.scale_amount_min = 0.07
	p.scale_amount_max = 0.11
	p.color = Color("#6fc4ff")
	p.local_coords = false
	fx.add_child(p)
	p.emitting = true
	# the scene may be gone by the time these fire
	get_tree().create_timer(secs).timeout.connect(func():
		if is_instance_valid(p):
			p.emitting = false)
	get_tree().create_timer(secs + p.lifetime + 0.2).timeout.connect(func():
		if is_instance_valid(p):
			p.queue_free())
	return p

# --- touches -------------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	if p.distance_to(sun_node.position) < size.y * 0.13:
		_tickle_sun()
		return
	if p.distance_to(cloud.position) < size.y * 0.13 and not raining:
		_rain()
		return
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("בואי נשתול פרחים!" if not complete else "איזו גינה יפה!")
		return
	for b in beds:
		var top := b.position.y - (plant_h + b.w * 0.5 if b.stage >= 3 else b.w * 0.6)
		if absf(p.x - b.position.x) < spacing * 0.5 and p.y > top and p.y < b.position.y + b.w * 0.35:
			_tend(b)
			return
	Game.note("harp", ["C6", "D6", "E6", "G6", "A6"].pick_random(), 0.3)

func _tend(b: Bed) -> void:
	if complete:
		b.squash_v -= 10.0
		return
	if b.stage == 0:
		_plant(b)
	elif b.stage >= 4:
		b.squash_v -= 12.0
		Fx.burst(fx, b.head_global(), [b.flower_tint(), Color.WHITE], 14, 0.5)
		Game.note("harp", ["C6", "E6", "G6", "A6"].pick_random(), 0.45)
		say("פרח %s!" % b.flower_color_name())
	elif not b.busy:
		_water(b)

func _plant(b: Bed) -> void:
	b.busy = true
	b.stage = 1
	var seed: Sprite2D = b.parts["seed"]
	b.parts["mound"].visible = true
	seed.visible = true
	var land := seed.position
	seed.position = land + Vector2(0, -size.y * 0.35)
	seed.rotation = -2.0
	var tw := seed.create_tween()
	tw.set_parallel(true)
	tw.tween_property(seed, "position", land, 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_property(seed, "rotation", 0.0, 0.45)
	tw.chain().tween_callback(func():
		b.set_stage(1)
		b.busy = false
		_dirt(b.global_position)
		Game.play("drop", 0.7, 0.9)
		Game.slide("xylophone", "C6", [[0, 1.2], [0.12, 0.8]], 0.4))

func _water(b: Bed) -> void:
	b.busy = true
	var can := Sprite2D.new()
	can.texture = World.tex("garden_can")
	var cs := b.w * 0.75 / 512.0
	can.scale = Vector2.ONE * cs
	var top := b.head_global()
	can.position = top + Vector2(b.w * 0.75, -b.w * 0.4)
	can.z_index = 9
	can.modulate.a = 0.0
	add_child(can)
	var tw := can.create_tween()
	tw.tween_property(can, "modulate:a", 1.0, 0.12)
	tw.tween_property(can, "rotation", -0.75, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		var spout := can.position + Vector2(-250, -60).rotated(-0.75) * cs
		_drops(spout, b.w * 0.15, 40, 0.55, b.position.y - spout.y)
		Game.slide("flute", "G5", [[0, 1.0], [0.2, 1.08], [0.4, 0.98], [0.6, 1.05]], 0.25))
	tw.tween_interval(0.6)
	tw.tween_callback(func():
		_grow(b)
		b.busy = false)
	tw.tween_property(can, "rotation", 0.0, 0.2)
	tw.tween_property(can, "modulate:a", 0.0, 0.2)
	tw.tween_callback(can.queue_free)

## One stage up, with all the fuss.
func _grow(b: Bed) -> void:
	if b.stage >= 4 or complete:
		return
	if b.stage == 0:
		b.set_stage(1)
		_dirt(b.global_position)
		return
	b.set_stage(b.stage + 1)
	Game.note("harp", ["C5", "C5", "E5", "G5", "C6"][b.stage], 0.55)
	Game.play("expand", 0.35)
	Fx.burst(fx, b.head_global(), [Color("#9be86a"), Color.WHITE], 10, 0.35)
	if b.stage == 4:
		_bloomed(b)

func _bloomed(b: Bed) -> void:
	var at := b.head_global()
	Fx.burst(fx, at, [b.flower_tint(), Color.WHITE, Color("#ffd84a")], 30, 0.8)
	Game.play("chime", 0.6)
	Game.arp("xylophone", ["G5", "C6", "E6", "G6"], 0.05, 0.45)
	say("פרח %s!" % b.flower_color_name())
	luli.feel("happy", 1.0)
	luli.jump(0.5)
	var v := Visitor.new()
	var bee := visitors.size() % 3 == 2
	v.setup(b, bee, b.flower_tint().lightened(0.2) if not bee else Color.WHITE, size.y * 0.075)
	v.position = Vector2(size.x + 80 if randf() < 0.5 else -80, randf_range(0.2, 0.5) * size.y)
	v.z_index = 8
	add_child(v)
	visitors.append(v)
	var open := beds.filter(func(x): return x.stage >= 4).size()
	if open >= 2 and not bunny_done and garden_n % 2 == 1:
		bunny_done = true
		get_tree().create_timer(1.2).timeout.connect(_bunny)
	if beds.all(func(x): return x.stage >= 4):
		get_tree().create_timer(0.9).timeout.connect(_complete)

func _rain() -> void:
	raining = true
	var f: Dictionary = cloud.get_meta("face")
	_set_face(f, "o")
	var body: Sprite2D = cloud.get_meta("body")
	var bs := body.scale
	var mid := Vector2((beds[0].position.x + beds[-1].position.x) / 2.0, cloud_home.y)
	var span := absf(beds[0].position.x - beds[-1].position.x) + spacing
	say("גשם!")
	Game.play("swipe", 0.5, 0.7)
	var tw := create_tween()
	tw.tween_property(cloud, "position", mid, 0.6).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(body, "scale", bs * Vector2(1.25, 1.1), 0.6)
	tw.parallel().tween_property(body, "modulate", Color("#c4d2ee"), 0.6)
	tw.tween_callback(func():
		_set_face(f, "grin")
		_drops(cloud.position + Vector2(0, size.y * 0.05), span, 260, 1.6, ground_y - cloud.position.y)
		Game.slide("flute", "C6", [[0, 1.0], [0.4, 0.9], [0.8, 1.0], [1.2, 0.85], [1.6, 0.8]], 0.25)
		Game.arp("harp", ["C6", "A5", "G5", "E5", "D5", "C5"], 0.12, 0.35)
		for i in beds.size():
			get_tree().create_timer(0.5 + i * 0.12).timeout.connect(_grow.bind(beds[i])))
	tw.tween_interval(1.9)
	tw.tween_property(cloud, "position", cloud_home, 0.8).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(body, "scale", bs, 0.8)
	tw.parallel().tween_property(body, "modulate", Color.WHITE, 0.8)
	tw.tween_callback(func():
		_set_face(f, "smile")
		raining = false
		if not rained_this_garden:
			rained_this_garden = true
			_frog())

func _tickle_sun() -> void:
	var f: Dictionary = sun_node.get_meta("face")
	_set_face(f, "grin")
	var body: Sprite2D = sun_node.get_meta("body")
	var tw := create_tween()
	tw.tween_property(body, "rotation", body.rotation + TAU, 1.0).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(sun_node, "scale", Vector2(1.18, 0.86), 0.1)
	tw.tween_property(sun_node, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tw.tween_interval(0.6)
	tw.tween_callback(func(): _set_face(f, "smile"))
	Fx.burst(fx, sun_node.position, [Color("#ffd84a"), Color.WHITE, Color("#ffb52a")], 26, 0.8)
	Game.arp("xylophone", ["E7", "C7", "A6", "G6", "E6"], 0.05, 0.4)
	Game.slide("flute", "A5", [[0, 1.1], [0.1, 0.92], [0.2, 1.12], [0.3, 0.92], [0.45, 1.05]], 0.35)
	say("שמש!")

# --- surprises -------------------------------------------------------------------------------------

func _bunny() -> void:
	if complete:
		return
	var carrot := Sprite2D.new()
	carrot.texture = World.tex("food_carrot")
	var spot := Vector2(size.x * 0.22, size.y * 0.975)
	carrot.position = spot
	carrot.scale = Vector2.ZERO
	carrot.rotation = 0.5
	carrot.z_index = 6
	add_child(carrot)
	var cs := size.y * 0.16 / 512.0
	var tw := carrot.create_tween()
	tw.tween_property(carrot, "scale", Vector2.ONE * cs, 0.5).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	Game.play("pop", 0.6, 1.3)
	var bunny := Creature.new()
	bunny.species = "bunny"
	bunny.height = size.y * 0.24
	bunny.position = Vector2(size.x + 200, spot.y + size.y * 0.02)
	bunny.z_index = 7
	add_child(bunny)
	var bt := create_tween()
	bt.tween_interval(0.6)
	for k in 3:
		bt.tween_callback(bunny.jump.bind(0.6))
		bt.tween_property(bunny, "position:x", size.x + 200.0 - (size.x + 200.0 - spot.x - size.x * 0.07) * (k + 1) / 3.0, 0.45)
	bt.tween_callback(func():
		bunny.voice()
		say("הארנב אוכל גזר!"))
	for k in 3:
		bt.tween_interval(0.45)
		bt.tween_callback(func():
			bunny.talk(0.3)
			bunny.squash_v -= 8.0
			carrot.scale *= 0.7
			Game.play("pop", 0.5, 0.6 + k * 0.15)
			Fx.burst(fx, carrot.position, [Color("#ff8a1f"), Color("#7fd157")], 8, 0.3))
	bt.tween_callback(func():
		carrot.queue_free()
		bunny.celebrate()
		Fx.hearts(fx, bunny.position + Vector2(0, -bunny.height), 5))
	bt.tween_interval(1.6)
	for k in 3:
		bt.tween_callback(bunny.jump.bind(0.6))
		bt.tween_property(bunny, "position:x", spot.x + size.x * 0.07 + 420.0 * (k + 1), 0.3)
	bt.tween_callback(bunny.queue_free)

func _frog() -> void:
	if complete:
		return
	if puddle == null:
		puddle = Sprite2D.new()
		puddle.texture = World.tex("garden_puddle")
		puddle.z_index = 3
		add_child(puddle)
	puddle.position = Vector2(size.x * 0.58, size.y * 0.965)
	puddle.scale = Vector2.ZERO
	puddle.modulate.a = 1.0
	var ps := size.y * 0.22 / 512.0
	var tw := create_tween()
	tw.tween_property(puddle, "scale", Vector2.ONE * ps, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var frog := Creature.new()
	frog.species = "frog"
	frog.height = size.y * 0.18
	frog.position = puddle.position + Vector2(0, size.y * 0.06)
	frog.z_index = 7
	frog.modulate.a = 0.0
	add_child(frog)
	tw.tween_interval(0.5)
	tw.tween_callback(func():
		frog.modulate.a = 1.0
		frog.position.y -= size.y * 0.04
		frog.jump(1.3)
		_drops(puddle.position + Vector2(0, -size.y * 0.06), size.y * 0.1, 18, 0.15, size.y * 0.05)
		Game.play("drop", 0.7, 1.2)
		frog.voice()
		say("צפרדע!"))
	tw.tween_interval(1.4)
	tw.tween_callback(func(): frog.celebrate())
	tw.tween_interval(1.4)
	for k in 4:
		tw.tween_callback(frog.jump.bind(0.8))
		tw.tween_property(frog, "position:x", size.x * 0.58 + 300.0 * (k + 1), 0.3)
	tw.tween_callback(frog.queue_free)
	tw.tween_property(puddle, "modulate:a", 0.0, 1.0)

# --- a garden in full bloom ------------------------------------------------------------------------

class Rainbow extends Node2D:
	var k := 0.0
	var center := Vector2.ZERO
	var radius := 600.0
	const BANDS := ["#ff4d5e", "#ff9a1f", "#ffd23d", "#5fcf5f", "#4fa8ff", "#a774ff"]
	func _draw() -> void:
		if k <= 0.001:
			return
		var w := radius * 0.055
		for i in BANDS.size():
			var r := radius - i * w
			draw_arc(center, r, PI, PI + PI * minf(1.0, k), 96, Color(BANDS[i], 0.78 * minf(1.0, k * 1.5)), w + 1.0, true)

func _complete() -> void:
	if complete:
		return
	complete = true
	rainbow.center = Vector2((beds[0].position.x + beds[-1].position.x) / 2.0, ground_y)
	rainbow.radius = size.y * 0.62
	var tw := create_tween()
	tw.tween_property(rainbow, "k", 1.0, 1.4).set_trans(Tween.TRANS_SINE)
	reward(Vector2(rainbow.center.x, size.y * 0.45), 3, true)
	say("איזו גינה יפה!")
	score(1)
	for b in beds:
		b.squash_v -= 12.0
	get_tree().create_timer(4.0).timeout.connect(_bouquet)

func _bouquet() -> void:
	var at := Vector2(size.x * 0.55, size.y * 0.56)
	var wrap := Sprite2D.new()
	wrap.texture = World.tex("garden_wrap")
	var ws := size.y * 0.3 / 512.0
	wrap.scale = Vector2.ZERO
	wrap.position = at + Vector2(0, size.y * 0.1)
	wrap.z_index = 12
	add_child(wrap)
	var tw := wrap.create_tween()
	tw.tween_property(wrap, "scale", Vector2.ONE * ws, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var picked: Array[Sprite2D] = []
	for i in beds.size():
		var b := beds[i]
		var src: Sprite2D = b.parts["flower"]
		var f := Sprite2D.new()
		f.texture = src.texture
		f.modulate = src.modulate
		f.global_position = b.head_global()
		f.scale = src.global_scale * 0.9
		f.z_index = 11
		add_child(f)
		picked.append(f)
		src.visible = false
		if b.parts.has("center"):
			b.parts["center"].visible = false
		b.parts["stem"].visible = false
		var spot := at + Vector2((i - (beds.size() - 1) / 2.0) * size.y * 0.06, -size.y * 0.02 - absf(i - (beds.size() - 1) / 2.0) * -size.y * 0.015)
		var ft := f.create_tween()
		ft.tween_interval(0.1 * i)
		ft.tween_property(f, "position", spot, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		ft.parallel().tween_property(f, "scale", f.scale * 0.75, 0.6)
	for v in visitors:
		var vt := v.create_tween()
		vt.tween_property(v, "position", Vector2(size.x + 200, -100), 1.4).set_trans(Tween.TRANS_SINE)
	var bt := create_tween()
	bt.tween_interval(0.9 + 0.1 * beds.size())
	bt.tween_callback(func():
		say("זר פרחים בשבילך!")
		Fx.hearts(fx, at, 10)
		Fx.burst(fx, at, Fx.RAINBOW, 36, 1.0)
		Game.play("bonus", 0.8)
		luli.celebrate())
	bt.tween_interval(2.2)
	# the bouquet floats over to Luli
	bt.tween_callback(func():
		var dest := luli.position + Vector2(luli.height * 0.25, -luli.height * 0.5)
		for f in picked + [wrap]:
			var t2: Tween = f.create_tween()
			t2.set_parallel(true)
			t2.tween_property(f, "position", dest + (f.position - at) * 0.4, 0.8).set_trans(Tween.TRANS_SINE)
			t2.tween_property(f, "scale", f.scale * 0.4, 0.8)
			t2.chain().tween_property(f, "modulate:a", 0.0, 0.3)
			t2.chain().tween_callback(f.queue_free))
	bt.tween_interval(1.4)
	bt.tween_callback(func():
		var rt := create_tween()
		rt.tween_property(rainbow, "k", 0.0, 0.6)
		new_garden())

func _process(dt: float) -> void:
	super._process(dt)
	rainbow.queue_redraw()
	var tt := Time.get_ticks_msec() / 1000.0
	sun_node.rotation = sin(tt * 0.8) * 0.05
	if not raining:
		cloud.position.y = cloud_home.y + sin(tt * 1.1) * 8.0
	# after a few idle seconds the next thing to touch wiggles
	if idle > 4.0 and not complete and fmod(idle, 2.0) < dt:
		for b in beds:
			if b.stage < 4:
				b.squash_v -= 9.0
				break

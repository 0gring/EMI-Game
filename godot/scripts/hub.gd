extends Activity
## The meadow: Luli in the middle, and each game is a thing in the world you
## can touch - a bunch of balloons tugging at its strings, a picnic blanket
## where a hungry bunny waits. Touching one makes Luli say where you are going
## and the iris closes onto it.

var portals := []
var greeted := false

func mood() -> Dictionary:
	return {"horizon": 0.52}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.12, size.y * 0.35, size.x * 0.3, size.y * 0.6),
		Rect2(size.x * 0.56, size.y * 0.55, size.x * 0.35, size.y * 0.42),
		Rect2(size.x * 0.38, size.y * 0.55, size.x * 0.24, size.y * 0.45)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.5, size.y * 0.93)

func build() -> void:
	_title()
	portals.append(_balloon_portal(Vector2(size.x * 0.25, size.y * 0.5)))
	portals.append(_picnic_portal(Vector2(size.x * 0.76, size.y * 0.8)))

func _ready() -> void:
	super._ready()
	luli.height = size.y * 0.38
	luli.build()
	get_tree().create_timer(0.8).timeout.connect(func():
		luli.celebrate()
		say("שלום אמי! בואי נשחק!"))
	Shot.maybe(self)

func _title() -> void:
	var l := Label.new()
	l.text = "האי הקסום של אמי"
	l.add_theme_font_size_override("font_size", 96)
	l.add_theme_color_override("font_color", Color("#a245d9"))
	l.add_theme_color_override("font_outline_color", Color.WHITE)
	l.add_theme_constant_override("outline_size", 30)
	l.add_theme_color_override("font_shadow_color", Color(0.4, 0.2, 0.6, 0.3))
	l.add_theme_constant_override("shadow_offset_y", 8)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(size.x, 140)
	l.position = Vector2(0, size.y * 0.06)
	l.pivot_offset = l.size / 2
	l.z_index = 9
	add_child(l)
	l.scale = Vector2(0.2, 0.2)
	var tw := create_tween()
	tw.tween_property(l, "scale", Vector2.ONE, 0.9).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	var bob := create_tween().set_loops()
	bob.tween_property(l, "rotation", 0.02, 1.6).set_trans(Tween.TRANS_SINE)
	bob.tween_property(l, "rotation", -0.02, 1.6).set_trans(Tween.TRANS_SINE)

func _sign(parent: Node2D, text: String, pos: Vector2, col: Color) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 64)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color.WHITE)
	l.add_theme_constant_override("outline_size", 22)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(500, 90)
	l.position = pos - Vector2(250, 0)
	l.z_index = 10
	parent.add_child(l)

# --- the balloon bunch ------------------------------------------------------------------

class BalloonBunch extends Node2D:
	var t := randf() * 5.0
	var balloons := []
	const COLS := ["#ff4d5e", "#ffd23d", "#4fa8ff", "#5fcf5f", "#a774ff", "#ff85c8"]
	const SPOTS := [Vector2(-120, -330), Vector2(0, -400), Vector2(120, -340), Vector2(-60, -230), Vector2(70, -240), Vector2(-180, -210)]
	func _ready() -> void:
		var glow := Sprite2D.new()
		glow.texture = load("res://art/glow.svg")
		glow.scale = Vector2(2.6, 2.6)
		glow.position = Vector2(0, -300)
		glow.modulate = Color(1, 0.95, 0.8, 0.5)
		glow.name = "glow"
		add_child(glow)
		for i in SPOTS.size():
			var b := Sprite2D.new()
			b.texture = load("res://art/balloon.svg")
			b.modulate = Color(COLS[i])
			b.scale = Vector2(0.34, 0.34)
			b.position = SPOTS[i]
			add_child(b)
			balloons.append(b)
	func _process(dt: float) -> void:
		t += dt
		for i in balloons.size():
			var b: Sprite2D = balloons[i]
			b.position = SPOTS[i] + Vector2(sin(t * 1.3 + i) * 10.0, sin(t * 1.7 + i * 2.0) * 14.0)
			b.rotation = sin(t * 1.1 + i) * 0.08
		(get_node("glow") as Sprite2D).modulate.a = 0.35 + 0.2 * sin(t * 2.0)
		queue_redraw()
	func _draw() -> void:
		for b in balloons:
			var top: Vector2 = b.position + Vector2(0, 80)
			draw_polyline(PackedVector2Array([top, top.lerp(Vector2.ZERO, 0.5) + Vector2(sin(t * 2.0) * 12.0, 0), Vector2.ZERO]), Color(1, 1, 1, 0.9), 3.0, true)
		draw_circle(Vector2.ZERO, 12, Color("#ff5fa2"))

func _balloon_portal(pos: Vector2) -> Dictionary:
	var n := BalloonBunch.new()
	n.position = pos + Vector2(0, 160)
	n.z_index = 3
	add_child(n)
	_sign(n, "בלונים", Vector2(0, 10), Color("#e0364f"))
	return {"node": n, "pos": pos + Vector2(0, -80), "r": 300.0, "scene": "res://scenes/colorpop.tscn", "say": "בואי נפוצץ בלונים!"}

# --- the picnic ----------------------------------------------------------------------------

class Picnic extends Node2D:
	func _draw() -> void:
		# a gingham blanket in perspective
		var w := 520.0
		var h := 190.0
		var pts := PackedVector2Array([Vector2(-w * 0.42, -h), Vector2(w * 0.42, -h), Vector2(w * 0.5, 0), Vector2(-w * 0.5, 0)])
		draw_colored_polygon(PackedVector2Array([pts[0] + Vector2(0, 14), pts[1] + Vector2(0, 14), pts[2] + Vector2(0, 14), pts[3] + Vector2(0, 14)]), Color(0.2, 0.4, 0.1, 0.25))
		draw_colored_polygon(pts, Color("#fff4f6"))
		var n := 8
		for i in n:
			if i % 2 == 0:
				var a := float(i) / n
				var b := float(i + 1) / n
				draw_colored_polygon(PackedVector2Array([pts[0].lerp(pts[1], a), pts[0].lerp(pts[1], b), pts[3].lerp(pts[2], b), pts[3].lerp(pts[2], a)]), Color(1, 0.36, 0.5, 0.45))
		for j in 4:
			if j % 2 == 0:
				var a := float(j) / 4
				var b := float(j + 1) / 4
				draw_colored_polygon(PackedVector2Array([pts[0].lerp(pts[3], a), pts[1].lerp(pts[2], a), pts[1].lerp(pts[2], b), pts[0].lerp(pts[3], b)]), Color(1, 0.36, 0.5, 0.35))

func _picnic_portal(pos: Vector2) -> Dictionary:
	var n := Picnic.new()
	n.position = pos
	n.z_index = 3
	add_child(n)
	var basket := Sprite2D.new()
	basket.texture = World.tex("basket")
	basket.scale = Vector2(0.42, 0.42)
	basket.position = Vector2(110, -130)
	n.add_child(basket)
	var bunny := Creature.new()
	bunny.species = "bunny"
	bunny.height = 230
	bunny.position = Vector2(-110, -60)
	n.add_child(bunny)
	_sign(n, "חיות רעבות", Vector2(0, 10), Color("#2f9e5c"))
	return {"node": n, "pos": pos + Vector2(0, -110), "r": 290.0, "scene": "res://scenes/feed.tscn", "say": "החיות רעבות! בואי נאכיל אותן!", "critter": bunny}

# --- input -------------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	for pt in portals:
		if p.distance_to(pt["pos"]) < pt["r"]:
			_go(pt)
			return
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say(["היי! זה מדגדג!", "אני לולי!", "בואי נשחק!", "איזה כיף!"].pick_random())
		return
	Game.note("harp", ["C6", "D6", "E6", "G6", "A6"].pick_random(), 0.35)

func _go(pt: Dictionary) -> void:
	var node: Node2D = pt["node"]
	var tw := create_tween()
	tw.tween_property(node, "scale", Vector2(1.15, 0.9), 0.08)
	tw.tween_property(node, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	if pt.has("critter"):
		(pt["critter"] as Creature).poke()
	Fx.burst(fx, pt["pos"], Fx.RAINBOW, 30, 1.0)
	Game.play("open", 0.8)
	luli.celebrate()
	say(pt["say"])
	get_tree().create_timer(1.1).timeout.connect(func(): Game.go(pt["scene"], pt["pos"]))

func _process(dt: float) -> void:
	super._process(dt)
	# an idle portal pulses to suggest itself
	if idle > 4.0:
		var k := int(idle / 3.0) % portals.size()
		var node: Node2D = portals[k]["node"]
		node.scale = Vector2.ONE * (1.0 + 0.04 * sin(idle * 7.0))

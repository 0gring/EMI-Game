extends Activity
## The meadow with all seven places on it. Each game is a thing in the world
## you can touch - a bunch of balloons tugging at its strings, a picnic where a
## hungry bunny waits, a birthday cake, a puzzle, a deck of cards, an easel, a
## flower bed - standing in two rows, the far row smaller, with Luli in the
## middle. A sign under each says what it is, and stars show how far she has
## taken it. Touching one makes Luli say where you are going and the iris
## closes onto it.

# id, sign, what Luli says, where it stands (fractions of the screen; y is
# where its base touches the ground), size, sign colour
const PLACES := [
	{"id": "colorpop", "sign": "בלונים", "say": "בואי נפוצץ בלונים!", "at": Vector2(0.11, 0.56), "h": 0.33, "col": "#e0364f"},
	{"id": "memory", "sign": "זיכרון", "say": "בואי נשחק בזיכרון!", "at": Vector2(0.35, 0.54), "h": 0.2, "col": "#6a54e0"},
	{"id": "coloring", "sign": "צביעה", "say": "בואי נצבע!", "at": Vector2(0.62, 0.54), "h": 0.21, "col": "#2f7ed6"},
	{"id": "garden", "sign": "גינה", "say": "בואי נשתול פרחים!", "at": Vector2(0.89, 0.56), "h": 0.22, "col": "#c98a10"},
	{"id": "puzzle", "sign": "פאזל", "say": "בואי נרכיב פאזל!", "at": Vector2(0.13, 0.84), "h": 0.25, "col": "#e0701a"},
	{"id": "cake", "sign": "עוגה", "say": "בואי נאפה עוגה!", "at": Vector2(0.33, 0.84), "h": 0.26, "col": "#d93d7f"},
	{"id": "feed", "sign": "חיות רעבות", "say": "החיות רעבות! בואי נאכיל אותן!", "at": Vector2(0.83, 0.84), "h": 0.26, "col": "#2f9e5c"},
]

var portals := []

func mood() -> Dictionary:
	return {"horizon": 0.46}

# The meadow is busy enough with seven places: keep trees and bushes to the
# far edges and off the rows.
func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.04, size.y * 0.25, size.x * 0.92, size.y * 0.75)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.55, size.y * 0.97)

func build() -> void:
	_title()
	# a place appears only once its activity exists, so the meadow never
	# offers a door that leads nowhere
	for p in PLACES:
		if ResourceLoader.exists("res://scenes/%s.tscn" % p["id"]):
			portals.append(_portal(p))

func _ready() -> void:
	super._ready()
	luli.height = size.y * 0.27
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


func _sign(parent: Node2D, text: String, pos: Vector2, col: Color, id: String) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 50)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color.WHITE)
	l.add_theme_constant_override("outline_size", 18)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(420, 70)
	l.position = pos - Vector2(210, 0)
	l.z_index = 10
	parent.add_child(l)
	# how far she has taken this place: one gold star per level reached
	var lv := Game.level_of(id)
	for k in 4:
		var st := Sprite2D.new()
		st.texture = load("res://art/star5.svg")
		st.scale = Vector2(0.11, 0.11)
		st.position = pos + Vector2((1.5 - k) * 32.0, 86)
		st.modulate = Color("#ffcf2a") if k < lv else Color(1, 1, 1, 0.75)
		st.z_index = 10
		parent.add_child(st)

func _portal(p: Dictionary) -> Dictionary:
	var at: Vector2 = p["at"]
	var base := Vector2(at.x * size.x, at.y * size.y)
	var h: float = p["h"] * size.y
	var id: String = p["id"]
	var node: Node2D
	var critter: Creature = null
	match id:
		"colorpop":
			node = BalloonBunch.new()
			node.scale = Vector2.ONE * h / 470.0
		"feed":
			var pic := Picnic.new()
			pic.scale = Vector2.ONE * h / 320.0
			node = pic
			var basket := Sprite2D.new()
			basket.texture = World.tex("basket")
			basket.scale = Vector2(0.42, 0.42)
			basket.position = Vector2(110, -130)
			pic.add_child(basket)
			critter = Creature.new()
			critter.species = "bunny"
			critter.height = 230
			critter.position = Vector2(-110, -60)
			pic.add_child(critter)
		_:
			node = PortalArt.new()
			(node as PortalArt).setup(id, h)
	node.position = base
	node.z_index = 3 if at.y < 0.8 else 6
	add_child(node)
	var sign_at := base + Vector2(0, 4)
	var holder := Node2D.new()
	holder.z_index = node.z_index + 1
	add_child(holder)
	_sign(holder, p["sign"], sign_at, Color(p["col"]), id)
	var d := {"node": node, "pos": base + Vector2(0, -h * 0.45), "r": h * 0.62,
		"scene": "res://scenes/%s.tscn" % id, "say": p["say"]}
	if critter:
		d["critter"] = critter
	return d

## A place drawn by its own activity's art (art/<id>_portal.svg): stands on
## its base, sways a little, glows softly. Falls back to a glowing star while
## that art does not exist yet.
class PortalArt extends Node2D:
	var t := randf() * 5.0
	var spr: Sprite2D
	var glow: Sprite2D
	func setup(id: String, h: float) -> void:
		glow = Sprite2D.new()
		glow.texture = load("res://art/glow.svg")
		glow.scale = Vector2.ONE * h / 160.0
		glow.position = Vector2(0, -h * 0.5)
		glow.modulate = Color(1, 0.96, 0.8, 0.45)
		add_child(glow)
		spr = Sprite2D.new()
		var path := "res://art/%s_portal.svg" % id
		spr.texture = load(path) if ResourceLoader.exists(path) else load("res://art/star5.svg")
		var k := h / 512.0
		spr.scale = Vector2(k, k)
		spr.offset = Vector2(0, -256)
		add_child(spr)
	func _process(dt: float) -> void:
		t += dt
		spr.rotation = sin(t * 1.3) * 0.025
		spr.scale.y = spr.scale.x * (1.0 + sin(t * 2.2) * 0.015)
		glow.modulate.a = 0.3 + 0.15 * sin(t * 2.0)

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

# --- input -------------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	# nearest place within reach, so neighbours never steal each other's taps
	var best = null
	var best_d := INF
	for pt in portals:
		var d: float = p.distance_to(pt["pos"])
		if d < pt["r"] and d < best_d:
			best = pt
			best_d = d
	if best:
		_go(best)
		return
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say(["היי! זה מדגדג!", "אני לולי!", "בואי נשחק!", "איזה כיף!"].pick_random())
		return
	Game.note("harp", ["C6", "D6", "E6", "G6", "A6"].pick_random(), 0.35)

func _go(pt: Dictionary) -> void:
	var node: Node2D = pt["node"]
	var base: float = node.get_meta("base_scale", node.scale.x)
	node.set_meta("base_scale", base)
	var tw := create_tween()
	tw.tween_property(node, "scale", Vector2(base * 1.15, base * 0.9), 0.08)
	tw.tween_property(node, "scale", Vector2.ONE * base, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	if pt.has("critter"):
		(pt["critter"] as Creature).poke()
	Fx.burst(fx, pt["pos"], Fx.RAINBOW, 30, 1.0)
	Game.play("open", 0.8)
	luli.celebrate()
	say(pt["say"])
	get_tree().create_timer(1.1).timeout.connect(func(): Game.go(pt["scene"], pt["pos"]))

func _process(dt: float) -> void:
	super._process(dt)
	# an idle place pulses to suggest itself, a different one every few seconds
	if idle > 4.0:
		var k := int(idle / 3.0) % portals.size()
		var node: Node2D = portals[k]["node"]
		var base: float = node.get_meta("base_scale", node.scale.x)
		node.set_meta("base_scale", base)
		node.scale = Vector2.ONE * base * (1.0 + 0.05 * sin(idle * 7.0))

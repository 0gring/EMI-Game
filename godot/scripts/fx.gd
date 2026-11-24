class_name Fx
extends RefCounted
## Particle effects: touch sparkles, the rainbow finger trail, bursts, confetti
## and fireworks. Each effect is a one-shot CPUParticles2D that frees itself.

const GLOW := preload("res://art/glow.svg")
const STAR := preload("res://art/star4.svg")
const STAR5 := preload("res://art/star5.svg")
const CONF := preload("res://art/confetti.svg")
const HEART := preload("res://art/heart.svg")

const RAINBOW := [Color("#ff3d6e"), Color("#ff8a1f"), Color("#ffc61a"), Color("#3fcf4f"),
	Color("#1fb0ff"), Color("#5a6cff"), Color("#b45cff"), Color("#ff4fc0")]

static var _add_mat: CanvasItemMaterial

static func _additive() -> CanvasItemMaterial:
	if _add_mat == null:
		_add_mat = CanvasItemMaterial.new()
		_add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return _add_mat

static func _fade_ramp(c: Color) -> Gradient:
	var g := Gradient.new()
	g.set_color(0, c)
	g.set_color(1, Color(c, 0.0))
	g.add_point(0.7, c)
	return g

static func _scale_curve(a := 1.0, b := 0.2) -> Curve:
	var c := Curve.new()
	c.add_point(Vector2(0, a))
	c.add_point(Vector2(1, b))
	return c

static func _make(parent: Node, pos: Vector2, tex: Texture2D, amount: int, life: float) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.position = pos
	p.texture = tex
	p.amount = maxi(1, amount)
	p.lifetime = life
	p.one_shot = true
	p.explosiveness = 1.0
	p.local_coords = false
	parent.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)
	return p

## A small ring of stars where a finger lands.
static func ring_burst(parent: Node, pos: Vector2) -> void:
	var p := _make(parent, pos, STAR, 10, 0.55)
	p.direction = Vector2.UP
	p.spread = 180.0
	p.initial_velocity_min = 220.0
	p.initial_velocity_max = 380.0
	p.damping_min = 400.0
	p.damping_max = 600.0
	p.scale_amount_min = 0.12
	p.scale_amount_max = 0.2
	p.scale_amount_curve = _scale_curve(1.0, 0.0)
	p.angular_velocity_min = -200.0
	p.angular_velocity_max = 200.0
	p.color_ramp = _fade_ramp(Color(1, 1, 0.85))
	p.color_initial_ramp = _rainbow_ramp()

static func _rainbow_ramp() -> Gradient:
	var g := Gradient.new()
	var offs := PackedFloat32Array()
	for i in RAINBOW.size():
		offs.append(float(i) / (RAINBOW.size() - 1))
	g.offsets = offs
	g.colors = PackedColorArray(RAINBOW)
	return g

## One glowing dot of the rainbow trail behind a dragging finger.
static func trail_spark(parent: Node, pos: Vector2, col: Color) -> void:
	var p := _make(parent, pos, GLOW, 2, 0.9)
	p.direction = Vector2.UP
	p.spread = 180.0
	p.initial_velocity_min = 10.0
	p.initial_velocity_max = 50.0
	p.gravity = Vector2(0, 60)
	p.scale_amount_min = 0.22
	p.scale_amount_max = 0.34
	p.scale_amount_curve = _scale_curve(1.0, 0.0)
	p.color_ramp = _fade_ramp(col)
	if randf() < 0.3:
		var s := _make(parent, pos, STAR, 1, 0.7)
		s.scale_amount_min = 0.1
		s.scale_amount_max = 0.16
		s.scale_amount_curve = _scale_curve(1.0, 0.0)
		s.angular_velocity_min = 180.0
		s.angular_velocity_max = 360.0

## A round burst of glowing stars - the reward for a small success.
static func burst(parent: Node, pos: Vector2, colors: Array = RAINBOW, amount := 30, power := 1.0) -> void:
	for c in colors.slice(0, 4):
		var p := _make(parent, pos, GLOW, amount / mini(4, colors.size()), 1.0)
		p.direction = Vector2.UP
		p.spread = 180.0
		p.initial_velocity_min = 250.0 * power
		p.initial_velocity_max = 650.0 * power
		p.damping_min = 300.0 * power
		p.damping_max = 500.0 * power
		p.gravity = Vector2(0, 300)
		p.scale_amount_min = 0.18
		p.scale_amount_max = 0.32
		p.scale_amount_curve = _scale_curve(1.0, 0.0)
		p.color_ramp = _fade_ramp(c)
	var s := _make(parent, pos, STAR, amount / 3, 0.9)
	s.direction = Vector2.UP
	s.spread = 180.0
	s.initial_velocity_min = 200.0 * power
	s.initial_velocity_max = 520.0 * power
	s.damping_min = 300.0
	s.damping_max = 450.0
	s.scale_amount_min = 0.12
	s.scale_amount_max = 0.22
	s.scale_amount_curve = _scale_curve(1.0, 0.0)
	s.angular_velocity_min = -300.0
	s.angular_velocity_max = 300.0
	var flash := _make(parent, pos, GLOW, 1, 0.35)
	flash.scale_amount_min = 2.6 * power
	flash.scale_amount_max = 2.6 * power
	flash.scale_amount_curve = _scale_curve(0.4, 1.0)
	flash.color_ramp = _fade_ramp(Color(1, 1, 1, 0.7))
	flash.material = _additive()

static func confetti(parent: Node, pos: Vector2, colors: Array = RAINBOW, amount := 40, power := 1.0) -> void:
	for c in colors.slice(0, 5):
		var p := _make(parent, pos, CONF, amount / mini(5, colors.size()), 2.0)
		p.direction = Vector2.UP
		p.spread = 70.0
		p.initial_velocity_min = 500.0 * power
		p.initial_velocity_max = 1100.0 * power
		p.damping_min = 250.0
		p.damping_max = 400.0
		p.gravity = Vector2(0, 900)
		p.scale_amount_min = 0.07
		p.scale_amount_max = 0.12
		p.angle_min = 0.0
		p.angle_max = 360.0
		p.angular_velocity_min = -720.0
		p.angular_velocity_max = 720.0
		p.color = c
		p.color_ramp = _fade_ramp(c)

static func hearts(parent: Node, pos: Vector2, amount := 6) -> void:
	var p := _make(parent, pos, HEART, amount, 1.6)
	p.explosiveness = 0.6
	p.direction = Vector2.UP
	p.spread = 35.0
	p.initial_velocity_min = 180.0
	p.initial_velocity_max = 320.0
	p.gravity = Vector2(0, -40)
	p.scale_amount_min = 0.14
	p.scale_amount_max = 0.24
	p.color_ramp = _fade_ramp(Color("#ff5f9e"))

## `count` rockets climbing from the bottom and bursting into colour.
static func fireworks(parent: Node, count := 5) -> void:
	var vs := parent.get_viewport().get_visible_rect().size
	for i in count:
		var rocket := Sprite2D.new()
		rocket.texture = GLOW
		rocket.scale = Vector2(0.25, 0.25)
		rocket.modulate = Color("#ffd27a")
		rocket.position = Vector2(randf_range(0.15, 0.85) * vs.x, vs.y + 30)
		parent.add_child(rocket)
		var top := Vector2(rocket.position.x + randf_range(-80, 80), randf_range(0.12, 0.4) * vs.y)
		var tw := rocket.create_tween()
		tw.tween_interval(i * 0.28)
		tw.tween_property(rocket, "position", top, 0.75).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		var cols := [RAINBOW.pick_random(), RAINBOW.pick_random(), Color.WHITE]
		tw.tween_callback(func():
			burst(parent, rocket.position, cols, 54, 1.5)
			Game.play("pop", 0.5, 0.55)
			Game.note("xylophone", ["C6", "E6", "G6", "A6", "C7"].pick_random(), 0.35)
			rocket.queue_free())
		var trail := CPUParticles2D.new()
		trail.texture = GLOW
		trail.amount = 30
		trail.lifetime = 0.4
		trail.scale_amount_min = 0.1
		trail.scale_amount_max = 0.16
		trail.scale_amount_curve = _scale_curve(1.0, 0.0)
		trail.color_ramp = _fade_ramp(Color("#ffd27a"))
		trail.local_coords = false
		trail.gravity = Vector2(0, 200)
		rocket.add_child(trail)

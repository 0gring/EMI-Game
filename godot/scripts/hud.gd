class_name Hud
extends CanvasLayer
## The only chrome on screen: a home button you have to hold for half a second
## (a palm landing on it must not end her game), a speaker button, the star
## counter, and a slim four-part level bar along the top edge.

signal home

const HOLD := 0.5
var show_home := true
var hue := Color("#ff5fa2")
var level := 1
var progress := 0.0
var r := 46.0
var hold := -1.0
var hold_id := -1
var press_home := 0.0
var press_mute := 0.0
var star_pop := 1.0
var star_label: Label
var draw_node: Node2D
var size := Vector2(1920, 1080)

func _ready() -> void:
	layer = 50
	draw_node = Node2D.new()
	draw_node.draw.connect(_draw_hud)
	add_child(draw_node)
	star_label = Label.new()
	star_label.add_theme_font_size_override("font_size", 46)
	star_label.add_theme_color_override("font_color", Color("#4a3560"))
	star_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	star_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(star_label)

func _home_pos() -> Vector2:
	return Vector2(r * 1.6, r * 1.6)

func _mute_pos() -> Vector2:
	return Vector2(size.x - r * 1.6, r * 1.6)

func _star_pos() -> Vector2:
	return Vector2(size.x - r * 4.6, r * 1.6)

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if show_home and event.position.distance_to(_home_pos()) < r * 1.3:
				hold = 0.0
				hold_id = event.index
				get_viewport().set_input_as_handled()
			elif event.position.distance_to(_mute_pos()) < r * 1.3:
				Game.set_muted(not Game.muted)
				press_mute = 1.0
				if not Game.muted:
					Game.play("toggle-on")
				get_viewport().set_input_as_handled()
		elif event.index == hold_id:
			hold = -1.0
			hold_id = -1

## A star flies from `from` to the counter, which pops when it lands.
func fly_star(from: Vector2) -> void:
	var s := Sprite2D.new()
	s.texture = load("res://art/star5.svg")
	s.modulate = Color("#ffd23d")
	s.scale = Vector2(0.35, 0.35)
	s.position = from
	add_child(s)
	var mid := from.lerp(_star_pos(), 0.5) + Vector2(0, -260)
	var tw := s.create_tween()
	tw.set_parallel(true)
	tw.tween_method(func(k: float):
		var a := from.lerp(mid, k)
		var b := mid.lerp(_star_pos(), k)
		s.position = a.lerp(b, k)
		s.rotation = k * TAU, 0.0, 1.0, 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_property(s, "scale", Vector2(0.2, 0.2), 0.7)
	tw.chain().tween_callback(func():
		star_pop = 1.6
		s.queue_free())

func _process(dt: float) -> void:
	size = get_viewport().get_visible_rect().size
	r = clampf(size.y * 0.045, 34.0, 60.0)
	if hold >= 0.0:
		hold += dt
		if hold >= HOLD:
			hold = -1.0
			hold_id = -1
			Game.play("back")
			home.emit()
	press_mute = maxf(0.0, press_mute - dt * 5.0)
	star_pop = move_toward(star_pop, 1.0, dt * 3.0)
	star_label.text = str(Game.stars)
	star_label.position = _star_pos() + Vector2(-10, -r * 0.62)
	star_label.size = Vector2(r * 2.2, r * 1.24)
	draw_node.queue_redraw()

func _button(c: Vector2, pressed: float) -> void:
	var rr := r * (1.0 - pressed * 0.1)
	draw_node.draw_circle(c + Vector2(0, rr * 0.12), rr, Color(0.25, 0.15, 0.4, 0.22))
	draw_node.draw_circle(c, rr, Color(1, 1, 1, 0.95))
	draw_node.draw_arc(c, rr * 0.94, 0, TAU, 48, Color(0.5, 0.4, 0.7, 0.18), rr * 0.08, true)

func _draw_hud() -> void:
	var dn := draw_node
	var ink := Color("#5b4bd6")
	# level bar
	var h := maxf(6.0, size.y * 0.009)
	var gap := 6.0
	var w := (size.x - gap * 5) / 4.0
	for i in 4:
		var x := gap + i * (w + gap)
		dn.draw_rect(Rect2(x, gap, w, h), Color(1, 1, 1, 0.45))
		var fill := 1.0 if i + 1 < level else (progress if i + 1 == level else 0.0)
		if fill > 0.001:
			dn.draw_rect(Rect2(x, gap, maxf(h, w * fill), h), hue if i + 1 == level else hue.lightened(0.25))
	# home
	if show_home:
		var c := _home_pos()
		var pr := 0.4 if hold >= 0.0 else 0.0
		_button(c, pr)
		var s := r * 0.5
		dn.draw_colored_polygon(PackedVector2Array([c + Vector2(-s, -s * 0.05), c + Vector2(0, -s * 0.95), c + Vector2(s, -s * 0.05)]), ink)
		dn.draw_rect(Rect2(c + Vector2(-s * 0.7, -s * 0.1), Vector2(s * 1.4, s * 0.95)), ink)
		dn.draw_rect(Rect2(c + Vector2(-s * 0.18, s * 0.3), Vector2(s * 0.36, s * 0.55)), Color.WHITE)
		if hold >= 0.0:
			dn.draw_arc(c, r * 1.12, -PI / 2, -PI / 2 + TAU * clampf(hold / HOLD, 0, 1), 48, Color("#ff5fa2"), r * 0.16, true)
	# speaker
	var m := _mute_pos()
	_button(m, press_mute)
	var k := r * 0.42
	dn.draw_colored_polygon(PackedVector2Array([m + Vector2(-k * 0.9, -k * 0.35), m + Vector2(-k * 0.35, -k * 0.35),
		m + Vector2(k * 0.25, -k * 0.85), m + Vector2(k * 0.25, k * 0.85), m + Vector2(-k * 0.35, k * 0.35), m + Vector2(-k * 0.9, k * 0.35)]), ink)
	if Game.muted:
		dn.draw_line(m + Vector2(-k, -k), m + Vector2(k, k), Color("#ff4d6d"), k * 0.3, true)
	else:
		dn.draw_arc(m + Vector2(k * 0.3, 0), k * 0.5, -0.9, 0.9, 16, ink, k * 0.18, true)
		dn.draw_arc(m + Vector2(k * 0.3, 0), k * 0.85, -0.9, 0.9, 16, ink, k * 0.18, true)
	# star counter
	var sc := _star_pos()
	dn.draw_rect(Rect2(sc + Vector2(-r * 1.25, -r * 0.62), Vector2(r * 3.3, r * 1.24)), Color(1, 1, 1, 0.7))
	var st: Texture2D = load("res://art/star5.svg")
	var ss := r * 1.05 * star_pop
	dn.draw_texture_rect(st, Rect2(sc + Vector2(-r * 0.75 - ss / 2, -ss / 2), Vector2(ss, ss)), false, Color("#ffcf2a"))

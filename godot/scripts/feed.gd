extends Activity
## Hungry animals: counting by feeding.
##
## An animal hops in and asks for a number of its favourite food - the number
## and that many empty plates float in a thought bubble. Each food she touches
## flies in an arc into its open mouth, is counted out loud, fills a plate, and
## makes its tummy a little rounder. When it is full it gives a big burp,
## says "סליחה!", does a happy dance and hops off; the next one hops in.
##
## Nothing can go wrong: once full, it pats its tummy and the food stays put.

const DINERS := [
	{"s": "bunny", "food": "carrot"}, {"s": "dog", "food": "bone"}, {"s": "cat", "food": "fish"},
	{"s": "bear", "food": "apple"}, {"s": "pig", "food": "strawberry"}, {"s": "mouse", "food": "cheese"},
	{"s": "panda", "food": "cookie"}, {"s": "fox", "food": "grapes"}, {"s": "frog", "food": "banana"},
]
const NUMBERS := ["אפס", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר"]
const TUNING := [[1, 3], [2, 5], [3, 7], [4, 10]]

var deck := []
var round_i := 0
var diner: Creature
var food := ""
var want := 0
var fed := 0
var full := false
var plates: Array[Sprite2D] = []
var foods: Array[Sprite2D] = []
var thought: Node2D
var big_num: Label
var tummy := 1.0
var seat := Vector2.ZERO

func mood() -> Dictionary:
	return {"horizon": 0.5, "sky_top": Color("#62b8ff"), "sky_low": Color("#fff1d6")}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.12, size.y * 0.35, size.x * 0.85, size.y * 0.65)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.07, size.y * 0.97)

# The bubble goes above the blanket, where it covers nobody's face.
func bubble_spot() -> Vector2:
	return Vector2(size.x * 0.52, size.y * 0.2)

func build() -> void:
	hue = Color("#3fbf5f")
	goals = [3, 3, 4, 4]
	seat = Vector2(size.x * 0.3, size.y * 0.86)
	var blanket := Blanket.new()
	blanket.position = Vector2(size.x * 0.72, size.y * 0.66)
	blanket.w = size.x * 0.44
	blanket.h = size.y * 0.5
	blanket.z_index = 2
	add_child(blanket)
	thought = Node2D.new()
	thought.z_index = 10
	thought.draw.connect(_draw_thought)
	add_child(thought)
	big_num = Label.new()
	big_num.add_theme_font_size_override("font_size", 230)
	big_num.add_theme_color_override("font_color", Color("#ff7a1f"))
	big_num.add_theme_color_override("font_outline_color", Color.WHITE)
	big_num.add_theme_constant_override("outline_size", 40)
	big_num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	big_num.size = Vector2(300, 300)
	big_num.pivot_offset = Vector2(150, 150)
	big_num.z_index = 15
	big_num.modulate.a = 0.0
	add_child(big_num)

func _ready() -> void:
	id = "feed"
	super._ready()
	deck = DINERS.duplicate()
	deck.shuffle()
	next_diner()
	Shot.maybe(self)

class Blanket extends Node2D:
	var w := 800.0
	var h := 500.0
	func _draw() -> void:
		var pts := PackedVector2Array([Vector2(-w * 0.44, -h / 2), Vector2(w * 0.44, -h / 2), Vector2(w / 2, h / 2), Vector2(-w / 2, h / 2)])
		var sh := PackedVector2Array()
		for p in pts:
			sh.append(p + Vector2(0, 16))
		draw_colored_polygon(sh, Color(0.15, 0.35, 0.1, 0.22))
		draw_colored_polygon(pts, Color("#fff6f8"))
		for i in 10:
			if i % 2 == 0:
				var a := i / 10.0
				var b := (i + 1) / 10.0
				draw_colored_polygon(PackedVector2Array([pts[0].lerp(pts[1], a), pts[0].lerp(pts[1], b), pts[3].lerp(pts[2], b), pts[3].lerp(pts[2], a)]), Color(1, 0.4, 0.55, 0.4))
		for j in 6:
			if j % 2 == 0:
				var a := j / 6.0
				var b := (j + 1) / 6.0
				draw_colored_polygon(PackedVector2Array([pts[0].lerp(pts[3], a), pts[1].lerp(pts[2], a), pts[1].lerp(pts[2], b), pts[0].lerp(pts[3], b)]), Color(1, 0.4, 0.55, 0.3))

func next_diner() -> void:
	var lv: Array = TUNING[level - 1]
	var d: Dictionary = deck[round_i % deck.size()]
	round_i += 1
	food = d["food"]
	var w := randi_range(lv[0], lv[1])
	if w == want:
		w = clampi(w + 1, lv[0], lv[1])
	want = w
	fed = 0
	full = false
	tummy = 1.0
	if diner:
		diner.queue_free()
	diner = Creature.new()
	diner.species = d["s"]
	diner.height = size.y * 0.42
	diner.position = Vector2(-300, seat.y)
	diner.z_index = 5
	add_child(diner)
	# hop in
	var tw := create_tween()
	for k in 4:
		tw.tween_callback(diner.jump.bind(0.7))
		tw.tween_property(diner, "position:x", -300 + (seat.x + 300) * (k + 1) / 4.0, 0.3)
	tw.tween_callback(func():
		diner.voice()
		diner.feel("surprised", 0.6)
		var t2 := create_tween()
		t2.tween_property(thought, "modulate:a", 1.0, 0.3)
		say("%s רעב! %s, בבקשה!" % [Creature.NAMES[diner.species], NUMBERS[want]]))
	thought.modulate.a = 0.0
	_lay_food()

func _lay_food() -> void:
	for f in foods:
		f.queue_free()
	foods.clear()
	for p in plates:
		p.queue_free()
	plates.clear()
	var n := mini(12, want + 3)
	var cols := 4 if n > 6 else 3
	var rows := ceili(float(n) / cols)
	var cx := size.x * 0.72
	var top := size.y * 0.47
	var cw := size.x * 0.4 / cols
	var rh := size.y * 0.4 / rows
	for i in n:
		var f := Sprite2D.new()
		f.texture = World.tex("food_%s" % food)
		var r := i / cols
		var c := i % cols
		var in_row := mini(cols, n - r * cols)
		f.position = Vector2(cx + ((in_row - 1) / 2.0 - c) * cw, top + (r + 0.5) * rh)
		f.scale = Vector2.ZERO
		f.rotation = randf_range(-0.3, 0.3)
		f.z_index = 6
		f.set_meta("base", minf(cw, rh) / 512.0 * 0.95)
		add_child(f)
		foods.append(f)
		var tw := f.create_tween()
		tw.tween_interval(0.5 + i * 0.06)
		tw.tween_property(f, "scale", Vector2.ONE * float(f.get_meta("base")), 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	for i in want:
		var p := Sprite2D.new()
		p.texture = World.tex("plate")
		p.scale = Vector2.ONE * 0.2
		p.z_index = 11
		add_child(p)
		plates.append(p)
	_place_plates()

func _thought_rect() -> Rect2:
	var per := mini(want, 5)
	var w := 270.0 + per * 112.0
	var h := 170.0 if want <= 5 else 270.0
	var c := Vector2(seat.x + 60, size.y * 0.2)
	return Rect2(c - Vector2(w, h) / 2, Vector2(w, h))

func _place_plates() -> void:
	var r := _thought_rect()
	var per := mini(want, 5)
	for i in plates.size():
		var row := i / 5
		var in_row := per if row == 0 else want - 5
		var col := i % 5
		plates[i].position = Vector2(r.position.x + 110 + (r.size.x - 130) / 2.0 + ((in_row - 1) / 2.0 - col) * 112.0,
			r.position.y + r.size.y / 2.0 + (row - (0.5 if want > 5 else 0.0)) * 110.0)
		plates[i].modulate.a = thought.modulate.a

func _draw_thought() -> void:
	var r := _thought_rect()
	var t := thought
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.97)
	sb.set_corner_radius_all(70)
	sb.shadow_color = Color(0.3, 0.15, 0.4, 0.18)
	sb.shadow_size = 14
	sb.shadow_offset = Vector2(0, 8)
	t.draw_style_box(sb, r)
	# the little circles of a thought bubble, down to the animal
	var head := diner.position + Vector2(0, -diner.height * 0.95) if diner else Vector2.ZERO
	for i in 3:
		var p := r.position + Vector2(r.size.x * 0.35, r.size.y).lerp(head, 0.25 + i * 0.22)
		t.draw_circle(p, 26 - i * 6, Color(1, 1, 1, 0.97))
	var font := ThemeDB.fallback_font if not get_tree().root.theme else get_tree().root.theme.default_font
	t.draw_string_outline(font, r.position + Vector2(30, r.size.y / 2 + 50), str(want), HORIZONTAL_ALIGNMENT_LEFT, -1, 150, 18, Color.WHITE)
	t.draw_string(font, r.position + Vector2(30, r.size.y / 2 + 50), str(want), HORIZONTAL_ALIGNMENT_LEFT, -1, 150, Color("#2f9e5c"))

# --- feeding -----------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	for f in foods:
		if f.visible and f.scale.x > 0.05 and p.distance_to(f.position) < 512.0 * float(f.get_meta("base")) * 0.55:
			_give(f)
			return
	if diner and p.distance_to(diner.position + Vector2(0, -diner.height * 0.5)) < diner.height * 0.5:
		diner.poke()
		say(Creature.NAMES[diner.species])
		return
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("%s, בבקשה!" % NUMBERS[want])

func _give(f: Sprite2D) -> void:
	if full or thought.modulate.a < 0.9:
		var tw := f.create_tween()
		tw.tween_property(f, "rotation", f.rotation + 0.4, 0.08)
		tw.tween_property(f, "rotation", f.rotation, 0.25).set_trans(Tween.TRANS_ELASTIC)
		if full:
			diner.feel("happy", 0.8)
			say("אני מלא!")
		return
	fed += 1
	var n := fed
	if fed >= want:
		full = true
	foods.erase(f)
	Game.play("swipe", 0.5, 1.3)
	diner.feel("surprised", 0.7)     # mouth opens as the food comes
	var from := f.position
	var mouth := diner.position + Vector2(0, -diner.height * 0.58)
	var mid := from.lerp(mouth, 0.5) + Vector2(0, -size.y * 0.25)
	var tw := f.create_tween()
	tw.set_parallel(true)
	tw.tween_method(func(k: float):
		var a := from.lerp(mid, k)
		var b := mid.lerp(mouth, k)
		f.position = a.lerp(b, k), 0.0, 1.0, 0.55).set_trans(Tween.TRANS_SINE)
	tw.tween_property(f, "rotation", f.rotation + TAU, 0.55)
	tw.tween_property(f, "scale", f.scale * 0.4, 0.55)
	tw.chain().tween_callback(func():
		f.queue_free()
		_eat(n))

func _eat(n: int) -> void:
	diner.squash_v += 10.0
	diner.feel("happy", 0.6)
	tummy += 0.06
	# grow from the body's own size, drawn or painted
	var body: Node2D = diner.parts["body"]
	var base: Vector2 = body.get_meta("base", Vector2.ONE * 1.4 * diner.u)
	body.set_meta("base", base)
	body.scale = base * tummy
	var belly: Node2D = diner.parts["belly"]
	var bbase: Vector2 = belly.get_meta("base", belly.scale)
	belly.set_meta("base", bbase)
	belly.scale = bbase * tummy
	Game.play("pop", 0.7, 0.8)
	Game.note("xylophone", ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6", "D6", "E6"][n - 1], 0.6)
	var pl := plates[n - 1]
	var plate_food := Sprite2D.new()
	plate_food.texture = World.tex("food_%s" % food)
	plate_food.scale = Vector2.ZERO
	pl.add_child(plate_food)
	var tw := plate_food.create_tween()
	tw.tween_property(plate_food, "scale", Vector2(0.95, 0.95), 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Fx.burst(fx, pl.position, [Color("#ffd84a"), Color.WHITE, Color("#7fd157")], 16, 0.4)
	say(NUMBERS[n])
	# the count, big and bright, beside the animal
	big_num.text = str(n)
	big_num.position = diner.position + Vector2(diner.height * 0.55, -diner.height * 1.15)
	big_num.scale = Vector2(0.3, 0.3)
	big_num.modulate.a = 1.0
	var t2 := create_tween()
	t2.tween_property(big_num, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t2.tween_interval(0.5)
	t2.tween_property(big_num, "modulate:a", 0.0, 0.3)
	if n >= want:
		get_tree().create_timer(1.1).timeout.connect(_burp)

func _burp() -> void:
	# the funniest moment in the game
	diner.feel("surprised", 0.5)
	diner.squash_v -= 16.0
	Game.slide("piano", "C3", [[0, 0.7], [0.15, 0.55], [0.4, 0.45]], 0.9)
	Fx.burst(fx, diner.position + Vector2(0, -diner.height * 0.6), [Color(0.9, 0.95, 1.0), Color.WHITE], 14, 0.5)
	get_tree().create_timer(0.7).timeout.connect(func():
		say("סליחה! %s! תודה!" % NUMBERS[want])
		diner.celebrate()
		Fx.hearts(fx, diner.position + Vector2(0, -diner.height), 8)
		reward(diner.position + Vector2(0, -diner.height * 0.6), 1, want >= 5)
		score(1))
	get_tree().create_timer(3.4).timeout.connect(_leave)

func _leave() -> void:
	var tw := create_tween()
	tw.tween_property(thought, "modulate:a", 0.0, 0.3)
	for k in 4:
		tw.tween_callback(diner.jump.bind(0.7))
		tw.tween_property(diner, "position:x", diner.position.x - (seat.x + 400) * (k + 1) / 4.0, 0.28)
	tw.tween_callback(next_diner)

func _process(dt: float) -> void:
	super._process(dt)
	thought.queue_redraw()
	_place_plates()
	# the food waiting on the blanket breathes, and wiggles when she is idle
	var tt := Time.get_ticks_msec() / 1000.0
	for i in foods.size():
		var f := foods[i]
		if idle > 3.0:
			f.rotation = sin(tt * 9.0 + i) * 0.12
		f.position.y += sin(tt * 2.0 + i) * 0.15

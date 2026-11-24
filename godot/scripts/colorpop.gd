extends Activity
## Colour balloons, the funny one.
##
## Luli calls a colour and balloons with faces float up, each looking around
## and blinking. Popping the right colour is never the same twice:
##   * it bursts in its own confetti and an animal parachutes out, lands, does
##     a little dance and makes its noise
##   * or it lets go and zooms round the screen blowing a raspberry
##   * or it was carrying a present that falls and bursts into stars
## A balloon of another colour giggles, sticks its tongue out, says its own
## colour and shoots off. Now and then a giant balloon swells with each tap
## until it bursts into a shower of animals, and a rare rainbow balloon pops
## every balloon in the sky at once.

const COLORS := [
	{"c": "#ff4d5e", "many": "אדומים", "one": "אדום"},
	{"c": "#ffd23d", "many": "צהובים", "one": "צהוב"},
	{"c": "#4fa8ff", "many": "כחולים", "one": "כחול"},
	{"c": "#5fcf5f", "many": "ירוקים", "one": "ירוק"},
	{"c": "#a774ff", "many": "סגולים", "one": "סגול"},
	{"c": "#ff9a1f", "many": "כתומים", "one": "כתום"},
	{"c": "#ff85c8", "many": "ורודים", "one": "ורוד"},
]
const TUNING := [
	{"colors": 2, "max": 5, "need": 5, "speed": 1.0, "giant": 0.0, "rainbow": 0.0},
	{"colors": 3, "max": 6, "need": 6, "speed": 1.1, "giant": 0.07, "rainbow": 0.03},
	{"colors": 4, "max": 7, "need": 7, "speed": 1.2, "giant": 0.09, "rainbow": 0.04},
	{"colors": 5, "max": 8, "need": 8, "speed": 1.3, "giant": 0.1, "rainbow": 0.05},
]
const FLYERS := ["cat", "dog", "pig", "bunny", "bear", "fox", "panda", "mouse", "frog"]

var tune: Dictionary
var palette := []
var target: Dictionary = {}
var popped := 0
var round_done := false
var balloons: Array[Balloon] = []
var spawn_t := 0.0
var banner_node: Node2D
var br := 110.0

func mood() -> Dictionary:
	return {"horizon": 0.66, "sky_top": Color("#4aa8ff"), "sky_low": Color("#ffe0f0")}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.15, 0, size.x * 0.7, size.y)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.08, size.y * 0.97)

func build() -> void:
	id = "colorpop"
	hue = Color("#ff4d5e")
	goals = [2, 2, 3, 3]
	level = Game.level_of(id)
	br = size.y * 0.1
	banner_node = Node2D.new()
	banner_node.z_index = 12
	banner_node.draw.connect(_draw_banner)
	add_child(banner_node)

func _ready() -> void:
	id = "colorpop"
	super._ready()
	new_round(true)
	Shot.maybe(self)

func new_round(first := false) -> void:
	tune = TUNING[level - 1]
	var prev := target
	palette = COLORS.duplicate()
	palette.shuffle()
	palette = palette.slice(0, tune["colors"])
	target = palette[0] if palette[0] != prev else palette[1]
	popped = 0
	round_done = false
	get_tree().create_timer(0.8 if first else 0.3).timeout.connect(func():
		say("בלונים %s!" % target["many"])
		luli.jump(0.6))

func on_level_up() -> void:
	tune = TUNING[level - 1]

# --- balloons ---------------------------------------------------------------------------

class Balloon extends Node2D:
	var col: Dictionary
	var r := 100.0
	var state := "rise"       # rise, tickle, zoom, gone
	var vy := -100.0
	var t := 0.0
	var ph := randf() * 10.0
	var giant := false
	var rainbow := false
	var present := false
	var taps := 0
	var grow := 1.0
	var squash := 0.0
	var squash_v := 0.0
	var ang := 0.0
	var spin := 0.0
	var body: Sprite2D
	var eyes: Array[Sprite2D] = []
	var happy: Array[Sprite2D] = []
	var mouths := {}
	var look := Vector2.ZERO
	var blink := 0.0
	var blink_t := randf_range(1.0, 4.0)
	var box: Sprite2D

	func setup(c: Dictionary, radius: float) -> void:
		col = c
		r = radius
		body = Sprite2D.new()
		body.texture = load("res://art/balloon.svg")
		body.modulate = Color(c["c"]) if not rainbow else Color.WHITE
		body.scale = Vector2.ONE * r / 190.0
		add_child(body)
		if rainbow:
			var m := ShaderMaterial.new()
			m.shader = load("res://scripts/rainbow.gdshader")
			body.material = m
		var fs := r / 190.0
		for side in [-1, 1]:
			var e := Sprite2D.new()
			e.texture = load("res://art/eye.svg")
			e.position = Vector2(side * 52, -40) * fs
			e.scale = Vector2.ONE * 0.2 * fs
			add_child(e)
			eyes.append(e)
			var h := Sprite2D.new()
			h.texture = load("res://art/eye_happy.svg")
			h.position = e.position
			h.scale = e.scale
			h.visible = false
			add_child(h)
			happy.append(h)
			var ck := Sprite2D.new()
			ck.texture = load("res://art/cheek.svg")
			ck.position = Vector2(side * 95, 20) * fs
			ck.scale = Vector2.ONE * 0.22 * fs
			add_child(ck)
		for k in ["smile", "open", "o", "tongue", "grin"]:
			var m := Sprite2D.new()
			m.texture = load("res://art/mouth_%s.svg" % k)
			m.position = Vector2(0, 40) * fs
			m.scale = Vector2.ONE * 0.28 * fs
			m.visible = k == "smile"
			add_child(m)
			mouths[k] = m
		if present:
			box = Sprite2D.new()
			box.texture = load("res://art/present.svg")
			box.scale = Vector2.ONE * 0.22 * fs
			box.position = Vector2(0, 330) * fs
			add_child(box)

	func mouth(k: String) -> void:
		for m in mouths:
			mouths[m].visible = m == k

	func _process(dt: float) -> void:
		t += dt
		var a := (0.0 - squash) * 260.0 - squash_v * 9.0
		squash_v += a * dt
		squash += squash_v * dt
		var s := squash + sin(t * 2.2 + ph) * 0.02
		scale = Vector2(1.0 + s * 0.5, 1.0 - s * 0.5) * grow
		blink_t -= dt
		if blink_t <= 0.0:
			blink = 1.0
			blink_t = randf_range(2.0, 4.5)
		blink = maxf(0.0, blink - dt * 7.0)
		if Game.last_touch.size() > 0:
			var p: Vector2 = Game.last_touch.values()[0]
			look = look.lerp(((p - global_position) / 500.0).limit_length(1.0), dt * 6.0)
		for e in eyes:
			e.offset = look * 40.0
			e.scale.y = e.scale.x * (1.0 - blink * 0.9)
		queue_redraw()

	func _draw() -> void:
		if state == "zoom":
			return
		var top := Vector2(0, r * 1.18)
		var pts := PackedVector2Array()
		for i in 9:
			var k := i / 8.0
			pts.append(top + Vector2(sin(t * 2.4 + k * 4.0 + ph) * 16.0 * k, k * r * 1.6))
		draw_polyline(pts, Color(1, 1, 1, 0.85), 3.0, true)

func spawn() -> void:
	var b := Balloon.new()
	var want := 0
	for x in balloons:
		if x.state == "rise" and x.col == target:
			want += 1
	var others := palette.filter(func(p): return p != target)
	var c: Dictionary = target if want < 1 else (others.pick_random() if want >= 3 or randf() > 0.42 else target)
	b.giant = not round_done and c == target and randf() < tune["giant"] and not balloons.any(func(x): return x.giant)
	b.rainbow = not b.giant and randf() < tune["rainbow"]
	b.present = not b.giant and not b.rainbow and c == target and randf() < 0.18
	b.setup(c, br * (1.9 if b.giant else randf_range(0.92, 1.08)))
	b.position = Vector2(randf_range(0.2, 0.92) * size.x, size.y + b.r * 1.5)
	b.vy = -size.y * randf_range(0.075, 0.1) * tune["speed"] * (0.6 if b.giant else 1.0)
	b.z_index = 6
	add_child(b)
	balloons.append(b)

func _process(dt: float) -> void:
	super._process(dt)
	var live := balloons.filter(func(b): return b.state == "rise").size()
	spawn_t -= dt
	if not round_done and live < tune["max"] and spawn_t <= 0.0:
		spawn()
		spawn_t = randf_range(0.5, 1.0) / tune["speed"]
	for b in balloons:
		match b.state:
			"rise":
				b.position.y += b.vy * dt
				b.position.x += sin(b.t * 0.9 + b.ph) * 22.0 * dt
				b.rotation = sin(b.t * 1.2 + b.ph) * 0.08
				if b.position.y < -b.r * 3.0:
					b.state = "gone"
			"tickle":
				b.rotation = sin(b.t * 30.0) * 0.18 * maxf(0.0, 1.0 - b.t)
				if b.t > 0.9:
					b.position.y -= size.y * 1.3 * dt * minf(1.0, (b.t - 0.9) * 3.0)
				if b.position.y < -b.r * 3.0:
					b.state = "gone"
			"zoom":
				b.ang += b.spin * dt * (0.6 + sin(b.t * 7.0) * 0.6)
				var sp := size.y * 1.5 * maxf(0.25, 1.0 - b.t / 1.6)
				b.position += Vector2(cos(b.ang), sin(b.ang)) * sp * dt
				if b.position.x < b.r or b.position.x > size.x - b.r:
					b.ang = PI - b.ang
					b.position.x = clampf(b.position.x, b.r, size.x - b.r)
				if b.position.y < b.r or b.position.y > size.y - b.r:
					b.ang = -b.ang
					b.position.y = clampf(b.position.y, b.r, size.y - b.r)
				b.rotation = b.ang + PI / 2.0
				b.grow = maxf(0.25, 1.0 - b.t / 1.5)
				if randf() < 0.5:
					Fx.trail_spark(fx, b.position, Color(b.col["c"]).lightened(0.4))
				if b.t > 1.5:
					b.state = "gone"
					Fx.burst(fx, b.position, [Color(b.col["c"]), Color.WHITE], 12, 0.5)
					Game.play("pop", 0.5, 1.5)
	for b in balloons.filter(func(x): return x.state == "gone"):
		balloons.erase(b)
		b.queue_free()
	banner_node.queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("בלונים %s!" % target["many"])
		return
	var hit: Balloon = null
	for i in range(balloons.size() - 1, -1, -1):
		var b := balloons[i]
		if b.state == "rise" and p.distance_to(b.position) < b.r * b.grow * 1.25:
			hit = b
			break
	if hit == null:
		Game.note("xylophone", ["C6", "D6", "E6", "G6", "A6"].pick_random(), 0.25)
		return
	if hit.rainbow:
		_rainbow_pop(hit)
	elif hit.col != target or round_done:
		_tickle(hit)
	elif hit.giant:
		hit.taps += 1
		hit.grow = 1.0 + hit.taps * 0.2
		hit.squash_v -= 12.0
		hit.mouth("o")
		Game.slide("flute", ["C5", "E5", "G5"][mini(hit.taps - 1, 2)], [[0, 0.8], [0.3, 1.15]], 0.5)
		Game.speak(["אחת", "שתיים", "שלוש"][mini(hit.taps - 1, 2)])
		if hit.taps >= 3:
			_pop(hit, true)
	elif hit.present:
		_pop(hit, false)
	elif randf() < 0.3:
		_deflate(hit)
	else:
		_pop(hit, false)

# --- what a balloon can do ------------------------------------------------------------------

func _tickle(b: Balloon) -> void:
	b.state = "tickle"
	b.t = 0.0
	b.squash_v -= 14.0
	b.mouth("tongue")
	for h in b.happy:
		h.visible = true
	for e in b.eyes:
		e.visible = false
	Game.arp("xylophone", ["E7", "C7", "A6", "G6", "E6", "C6"], 0.045, 0.4)
	Game.slide("flute", "A5", [[0, 1.1], [0.08, 0.92], [0.16, 1.12], [0.24, 0.92], [0.32, 1.1], [0.45, 0.88]], 0.4)
	say("אני %s!" % b.col["one"])
	luli.feel("giggle", 1.0)

func _pop(b: Balloon, big: bool) -> void:
	b.state = "gone"
	var c := Color(b.col["c"])
	Game.play("pop", 0.95)
	Fx.confetti(fx, b.position, [c, c.lightened(0.4), Color.WHITE], 60 if big else 26, 1.2 if big else 0.7)
	Fx.burst(fx, b.position, [c, Color.WHITE, Color("#ffd84a")], 40 if big else 18, 1.2 if big else 0.6)
	if b.present:
		_present(b.position + Vector2(0, b.r * 1.7))
	else:
		var n := 4 if big else 1
		for i in n:
			_parachute(b.position + Vector2((i - (n - 1) / 2.0) * b.r * 0.9, 0), c)
	_score(b, 2 if big else 1, big)

func _deflate(b: Balloon) -> void:
	b.state = "zoom"
	b.t = 0.0
	b.ang = randf() * TAU
	b.spin = 9.0 if randf() < 0.5 else -9.0
	b.mouth("o")
	Game.slide("flute", "E5", [[0, 1.3], [0.1, 1.0], [0.2, 1.25], [0.3, 0.95], [0.4, 1.2], [0.5, 0.9], [0.6, 1.1], [0.75, 0.8], [0.9, 0.95], [1.1, 0.6], [1.3, 0.5]], 0.55)
	_score(b, 1, false)

func _rainbow_pop(b: Balloon) -> void:
	b.state = "gone"
	Fx.burst(fx, b.position, Fx.RAINBOW, 60, 1.5)
	Fx.confetti(fx, b.position, Fx.RAINBOW, 60, 1.2)
	Game.arp("harp", ["C5", "E5", "G5", "C6", "E6", "G6", "C7"], 0.05, 0.6)
	say("בלון קשת! וואו!")
	var k := 0
	for x in balloons:
		if x.state == "rise":
			k += 1
			get_tree().create_timer(k * 0.12).timeout.connect(func():
				if x.state != "rise":
					return
				x.state = "gone"
				Game.play("pop", 0.6, 1.2)
				Fx.confetti(fx, x.position, [Color(x.col["c"]), Color.WHITE], 18, 0.6))
	_score(b, 2, true)

func _present(pos: Vector2) -> void:
	var box := Sprite2D.new()
	box.texture = load("res://art/present.svg")
	box.scale = Vector2(0.3, 0.3)
	box.position = pos
	box.z_index = 9
	add_child(box)
	var ground := size.y * 0.86
	var tw := box.create_tween()
	tw.tween_property(box, "position:y", ground, 0.6).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_property(box, "scale", Vector2(0.4, 0.22), 0.12)
	tw.tween_property(box, "scale", Vector2(0.26, 0.4), 0.12)
	tw.tween_callback(func():
		Fx.burst(fx, box.position, [Color("#ffd84a"), Color.WHITE, Color("#ff85c8")], 50, 1.3)
		Fx.confetti(fx, box.position, Fx.RAINBOW, 40, 1.1)
		Fx.hearts(fx, box.position, 6)
		Game.play("bonus", 0.8)
		Game.arp("xylophone", ["G6", "C7", "E7", "G7"], 0.05, 0.5)
		hud.fly_star(box.position)
		Game.add_stars(1)
		box.queue_free())

func _parachute(pos: Vector2, c: Color) -> void:
	var chute := Parachute.new()
	chute.color = c
	chute.position = pos
	chute.ground = size.y * 0.9
	chute.z_index = 7
	add_child(chute)
	var who := Creature.new()
	who.species = FLYERS.pick_random()
	who.height = size.y * 0.17
	chute.add_child(who)
	chute.critter = who
	get_tree().create_timer(0.3).timeout.connect(who.voice)

class Parachute extends Node2D:
	var color := Color.RED
	var critter: Creature
	var ground := 900.0
	var t := 0.0
	var landed := -1.0
	var x0 := 0.0
	func _ready() -> void:
		x0 = position.x
	func _process(dt: float) -> void:
		t += dt
		if landed < 0.0:
			position.y += dt * 170.0
			position.x = x0 + sin(t * 2.0) * 50.0
			rotation = sin(t * 2.0 + 0.6) * 0.12
			if position.y >= ground:
				landed = 0.0
				rotation = 0.0
				critter.celebrate()
				critter.voice()
				Game.play("boing", 0.5)
		else:
			landed += dt
			if landed > 2.2:
				modulate.a = maxf(0.0, 1.0 - (landed - 2.2) * 2.0)
				position.x += dt * 400.0 * (1.0 if x0 > 900 else -1.0)
			if landed > 2.8:
				queue_free()
		queue_redraw()
	func _draw() -> void:
		if landed >= 0.0:
			return
		var h := critter.height if critter else 160.0
		var top := Vector2(0, -h * 1.55)
		var w := h * 0.95
		var pts := PackedVector2Array()
		for i in 25:
			var a := PI + PI * i / 24.0
			pts.append(top + Vector2(cos(a) * w, sin(a) * w * 0.7))
		var poly := pts
		draw_colored_polygon(poly, color)
		for i in 3:
			var a := PI + PI * (i + 1) / 4.0
			draw_line(top + Vector2(cos(a) * w * 0.98, sin(a) * w * 0.68), top + Vector2(cos(a) * w * 0.9, 0), color.lightened(0.35), w * 0.07)
		draw_circle(top + Vector2(-w * 0.35, -w * 0.4), w * 0.12, Color(1, 1, 1, 0.35))
		for sx in [-1.0, -0.4, 0.4, 1.0]:
			draw_line(top + Vector2(sx * w * 0.95, 0), Vector2(sx * h * 0.18, -h * 0.62), Color(0.35, 0.25, 0.4, 0.6), 2.5, true)

func _score(b: Balloon, n: int, big: bool) -> void:
	popped += n
	luli.feel("happy", 0.8)
	if popped >= tune["need"] and not round_done:
		round_done = true
		get_tree().create_timer(0.4).timeout.connect(func():
			var k := 0
			for x in balloons:
				if x.state == "rise":
					k += 1
					get_tree().create_timer(k * 0.12).timeout.connect(func():
						if x.state == "rise":
							x.state = "gone"
							Game.play("pop", 0.6)
							Fx.confetti(fx, x.position, [Color(x.col["c"]), Color.WHITE], 16, 0.5))
			reward(Vector2(size.x / 2, size.y * 0.4), 2, true)
			say("כל הכבוד!")
			score(1))
		get_tree().create_timer(3.6).timeout.connect(new_round)
	elif big:
		reward(b.position, 1, false, [Color(b.col["c"]), Color.WHITE])

# --- the banner: which colour, and how many so far -------------------------------------------

func _draw_banner() -> void:
	if target.is_empty():
		return
	var n: int = tune["need"]
	var dot := 20.0
	var w := 220.0 + n * dot * 2.8
	var h := 130.0
	var c := Vector2(size.x / 2, 125)
	var rect := Rect2(c - Vector2(w, h) / 2, Vector2(w, h))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.93)
	sb.set_corner_radius_all(65)
	sb.shadow_color = Color(0.3, 0.15, 0.4, 0.18)
	sb.shadow_size = 12
	sb.shadow_offset = Vector2(0, 8)
	banner_node.draw_style_box(sb, rect)
	var bal: Texture2D = load("res://art/balloon.svg")
	var bs := 120.0
	var bc := Vector2(rect.end.x - 80, c.y + sin(Time.get_ticks_msec() / 400.0) * 6.0)
	banner_node.draw_texture_rect(bal, Rect2(bc - Vector2(bs, bs) / 2, Vector2(bs, bs)), false, Color(target["c"]))
	for i in n:
		var x := rect.end.x - 170 - i * dot * 2.8
		var filled := i < popped
		banner_node.draw_circle(Vector2(x, c.y), dot * (1.15 if filled else 0.9), Color(target["c"]) if filled else Color(0.5, 0.45, 0.65, 0.2))
		if filled:
			banner_node.draw_circle(Vector2(x - dot * 0.35, c.y - dot * 0.35), dot * 0.3, Color(1, 1, 1, 0.6))

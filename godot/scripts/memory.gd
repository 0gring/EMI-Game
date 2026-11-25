extends Activity
## Memory: find the pairs.
##
## Big glossy cards on the meadow. Every board opens with a peek - all the
## cards turn face up for a moment and then turn back together - because a
## three year old remembers far better once she has seen the whole board.
##
## Each card holds a live animal. Turning one makes it pop up and make its
## noise while Luli says its name. A pair: both animals jump out of their
## cards, run to each other, hug and dance, then hop home and the cards glow.
## Not a pair: the two animals blow a raspberry and the cards turn back on
## their own - and touching a third card turns them back at once, so she never
## waits. A finished board sends every animal out for a parade with fireworks.

const POOL := ["cat", "dog", "bunny", "bear", "pig", "fox", "panda", "mouse", "frog"]
const PASTEL := {
	"cat": "#ffe7c4", "dog": "#ffe3d0", "bunny": "#ffe3f0", "bear": "#f3e2cf", "pig": "#ffe0ea",
	"fox": "#ffe6d2", "panda": "#e4f3ff", "mouse": "#ece6ff", "frog": "#e2f8d6",
}
# More cards each level; the peek stays generous.
const TUNING := [
	{"pairs": 2, "peek": 2.3},
	{"pairs": 3, "peek": 2.3},
	{"pairs": 4, "peek": 2.0},
	{"pairs": 6, "peek": 1.9},
]

var tune: Dictionary
var cards: Array[Card] = []
var open: Array[Card] = []
var locked := true
var mismatch_token := 0
var board_done := false
var card_w := 200.0
var card_h := 260.0
var first_board := true
var actors: Array[Creature] = []

func mood() -> Dictionary:
	return {"horizon": 0.46, "sky_top": Color("#7a8cff"), "sky_mid": Color("#b9c4ff"), "sky_low": Color("#ffe3f3"),
		"hill_far": Color("#b8b4ec"), "hill_mid": Color("#9ad8a0"), "hill_near": Color("#7fcf6f")}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.12, 0, size.x * 0.88, size.y)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.075, size.y * 0.97)

func bubble_spot() -> Vector2:
	return luli.position + Vector2(-luli.height * 0.25, -luli.height * 1.45)

func build() -> void:
	hue = Color("#8f7cff")
	goals = [2, 2, 2, 2]

func _ready() -> void:
	id = "memory"
	super._ready()
	new_board()
	Shot.maybe(self)

func on_level_up() -> void:
	pass     # the next board picks up the new size

# --- a card --------------------------------------------------------------------------------

class Card extends Node2D:
	var sp := "cat"
	var w := 200.0
	var h := 260.0
	var turn := 0.0          # 0 back, 1 face
	var up := false
	var matched := false
	var out := false         # its animal is out of the card, dancing
	var pop := 0.0
	var t := randf() * 10.0
	var wob := 0.0
	var content: Node2D
	var back: Sprite2D
	var face: Node2D
	var critter: Creature
	var glow: Sprite2D
	var shade: Sprite2D
	var tw: Tween

	func setup(species: String, cw: float, ch: float) -> void:
		sp = species
		w = cw
		h = ch
		var s := w / 360.0
		shade = Sprite2D.new()
		shade.texture = load("res://art/glow.svg")
		shade.modulate = Color(0.2, 0.1, 0.4, 0.0)
		shade.scale = Vector2(w / 160.0, h / 900.0)
		shade.position = Vector2(0, h * 0.5)
		add_child(shade)
		glow = Sprite2D.new()
		glow.texture = load("res://art/memory_glow.svg")
		glow.scale = Vector2.ONE * s
		glow.modulate.a = 0.0
		add_child(glow)
		content = Node2D.new()
		add_child(content)
		back = Sprite2D.new()
		back.texture = load("res://art/memory_back.svg")
		back.scale = Vector2.ONE * s
		content.add_child(back)
		face = Node2D.new()
		content.add_child(face)
		var f := Sprite2D.new()
		f.texture = load("res://art/memory_face.svg")
		f.scale = Vector2.ONE * s
		face.add_child(f)
		var win := Sprite2D.new()
		win.texture = load("res://art/memory_window.svg")
		win.scale = Vector2.ONE * s
		win.modulate = Color(PASTEL.get(sp, "#ffffff"))
		face.add_child(win)
		critter = Creature.new()
		critter.species = sp
		critter.height = h * 0.62
		critter.position = Vector2(0, h * 0.36)
		face.add_child(critter)
		face.visible = false

	func flip(to_up: bool, secs := 0.42) -> void:
		up = to_up
		if tw:
			tw.kill()
		tw = create_tween()
		tw.tween_property(self, "turn", 1.0 if to_up else 0.0, secs).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

	func _process(dt: float) -> void:
		t += dt
		wob = maxf(0.0, wob - dt * 2.0)
		var sx := absf(cos(turn * PI))
		var lift := sin(turn * PI)
		var p := ease(clampf(pop, 0.0, 1.0), 0.4) if pop < 1.0 else 1.0
		content.scale = Vector2(maxf(0.03, sx), 1.0) * (1.0 + lift * 0.07) * p
		content.position.y = -lift * h * 0.1
		content.rotation = sin(t * 18.0) * 0.06 * wob
		face.visible = turn > 0.5
		back.visible = not face.visible
		critter.visible = not out
		shade.modulate.a = lift * 0.35
		shade.scale.x = w / 160.0 * (0.8 + lift * 0.3)
		if matched:
			glow.modulate.a = 0.55 + 0.3 * sin(t * 3.0)
			glow.scale = Vector2.ONE * w / 360.0 * (1.0 + 0.03 * sin(t * 3.0))

	func hit(p: Vector2) -> bool:
		var d := p - global_position
		return absf(d.x) < w * 0.55 and absf(d.y) < h * 0.55

# --- boards ----------------------------------------------------------------------------------

func new_board() -> void:
	for c in cards:
		c.queue_free()
	cards.clear()
	open.clear()
	board_done = false
	locked = true
	mismatch_token += 1
	tune = TUNING[level - 1]
	var kinds := POOL.duplicate()
	kinds.shuffle()
	kinds = kinds.slice(0, tune["pairs"])
	var deck: Array = kinds + kinds
	deck.shuffle()
	var spots := _layout(deck.size())
	for i in deck.size():
		var c := Card.new()
		c.setup(deck[i], card_w, card_h)
		c.position = spots[i]
		c.z_index = 4
		add_child(c)
		cards.append(c)
		var tw := c.create_tween()
		tw.tween_interval(0.08 * i)
		tw.tween_property(c, "pop", 1.0, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		get_tree().create_timer(0.08 * i).timeout.connect(Game.note.bind("xylophone", ["C6", "D6", "E6", "G6", "A6", "C7"][i % 6], 0.3))
	var dealt := 0.08 * deck.size() + 0.5
	if first_board:
		get_tree().create_timer(0.6).timeout.connect(say.bind("בואי נמצא זוגות!"))
	# the peek: every card up, a look, every card down
	get_tree().create_timer(dealt).timeout.connect(func():
		for i in cards.size():
			get_tree().create_timer(i * 0.05).timeout.connect(cards[i].flip.bind(true))
		Game.play("swipe", 0.6)
		if not first_board:
			say("תסתכלי טוב!"))
	get_tree().create_timer(dealt + 0.6 + tune["peek"] + (1.4 if first_board else 0.0)).timeout.connect(func():
		for c in cards:
			c.flip(false)
		Game.play("swipe", 0.6, 0.85)
		locked = false
		first_board = false
		say("איפה הזוג?"))

## Picks the grid that makes the biggest cards in the space beside Luli.
func _layout(n: int) -> Array[Vector2]:
	var area := Rect2(size.x * 0.16, 140.0, size.x * 0.8, size.y - 170.0)
	var aspect := 360.0 / 470.0
	var best_cols := 1
	var best_w := 0.0
	for cols in range(1, n + 1):
		var rows := ceili(float(n) / cols)
		if cols * rows - n >= cols:
			continue
		var cw := minf(area.size.x / cols, area.size.y / rows * aspect)
		if cw > best_w:
			best_w = cw
			best_cols = cols
	var cols := best_cols
	var rows := ceili(float(n) / cols)
	card_w = minf(best_w * 0.86, 400.0)
	card_h = card_w / aspect
	var gx := best_w
	var gy := best_w / aspect
	var out: Array[Vector2] = []
	var top := area.position.y + area.size.y / 2.0 - (rows - 1) * gy / 2.0
	for i in n:
		var r := i / cols
		var in_row := mini(cols, n - r * cols)
		var c := i % cols
		# right to left, and a short last row is centred
		out.append(Vector2(area.get_center().x + ((in_row - 1) / 2.0 - c) * gx, top + r * gy))
	return out

# --- touching -------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("איפה הזוג?")
		return
	var c: Card = null
	for k in cards:
		if k.hit(p):
			c = k
			break
	if c == null:
		Game.note("harp", ["C6", "D6", "E6", "G6", "A6"].pick_random(), 0.3)
		return
	if locked or board_done:
		c.wob = 1.0
		if c.up:
			c.critter.poke()
		return
	if c.up or c.matched:
		# an open card just plays: the animal giggles and says hello
		c.wob = 1.0
		c.critter.poke()
		say(Creature.NAMES[c.sp])
		return
	# a third card while a mismatch is still showing: those two go back now
	if open.size() >= 2:
		mismatch_token += 1
		for k in open:
			if not k.matched:
				k.flip(false)
		open.clear()
	turn_up(c)

func turn_up(c: Card) -> void:
	c.flip(true)
	open.append(c)
	Game.play("swipe", 0.6, 1.15)
	get_tree().create_timer(0.3).timeout.connect(func():
		c.critter.jump(0.8)
		c.critter.feel("happy", 0.8)
		c.critter.voice())
	say(Creature.NAMES[c.sp])
	if open.size() < 2:
		return
	var a: Card = open[0]
	var b: Card = open[1]
	if a.sp == b.sp:
		open.clear()
		a.matched = true
		b.matched = true
		get_tree().create_timer(0.55).timeout.connect(_match.bind(a, b))
	else:
		var token := mismatch_token
		get_tree().create_timer(0.75).timeout.connect(func():
			if token != mismatch_token:
				return
			# the two animals blow a raspberry at each other
			for k in [a, b]:
				k.critter.feel("giggle", 0.9)
				k.wob = 0.8
			Game.slide("flute", "E5", [[0, 1.2], [0.08, 0.9], [0.16, 1.15], [0.24, 0.88], [0.34, 1.1], [0.5, 0.7]], 0.4))
		get_tree().create_timer(1.9).timeout.connect(func():
			if token != mismatch_token:
				return
			a.flip(false)
			b.flip(false)
			open.clear()
			Game.play("swipe", 0.4, 0.85))

# --- a pair: out they come ----------------------------------------------------------------------

func _actor(c: Card) -> Creature:
	var a := Creature.new()
	a.species = c.sp
	a.height = card_h * 0.62
	a.position = c.global_position + Vector2(0, card_h * 0.36 - card_h * 0.1)
	a.z_index = 15
	add_child(a)
	actors.append(a)
	c.out = true
	return a

## Moves a creature to `to` in a few hops.
func _hop(a: Creature, to: Vector2, hops := 3, secs := 0.6) -> Tween:
	var tw := a.create_tween()
	var from := a.position
	for k in hops:
		tw.tween_callback(a.jump.bind(0.55))
		tw.tween_property(a, "position", from.lerp(to, float(k + 1) / hops), secs / hops)
	return tw

func _match(a: Card, b: Card) -> void:
	var mid := (a.global_position + b.global_position) / 2.0
	mid.y = clampf(mid.y, size.y * 0.35, size.y * 0.75)
	var gap := card_h * 0.24
	var left := a if a.global_position.x < b.global_position.x else b
	var right := b if left == a else a
	var la := _actor(left)
	var ra := _actor(right)
	Game.play("boing", 0.6)
	_hop(la, mid + Vector2(-gap, card_h * 0.3))
	_hop(ra, mid + Vector2(gap, card_h * 0.3)).finished.connect(func():
		la.celebrate()
		ra.celebrate()
		la.voice()
		Fx.hearts(fx, mid + Vector2(0, -card_h * 0.2), 8)
		say("זוג! יופי!")
		reward(mid, 1, false, [Color(PASTEL[a.sp]).darkened(0.25), Color("#ffd84a"), Color.WHITE]))
	get_tree().create_timer(2.6).timeout.connect(func():
		for pair in [[la, left], [ra, right]]:
			var actor: Creature = pair[0]
			var card: Card = pair[1]
			_hop(actor, card.global_position + Vector2(0, card_h * 0.26), 2, 0.4).finished.connect(func():
				# if the parade has begun, the card's animal is out marching
				if not board_done:
					card.out = false
					card.critter.celebrate()
				actors.erase(actor)
				actor.queue_free())
		if cards.all(func(k): return k.matched):
			get_tree().create_timer(0.6).timeout.connect(_finish))

func _finish() -> void:
	if board_done:
		return
	board_done = true
	# every animal out for a parade along the front of the meadow
	var n := cards.size()
	var parade: Array[Creature] = []
	for i in n:
		var c := cards[i]
		var a := _actor(c)
		parade.append(a)
		var x := size.x * 0.2 + size.x * 0.72 * (i + 0.5) / n
		_hop(a, Vector2(x, size.y * 0.93), 3, 0.7)
	get_tree().create_timer(0.8).timeout.connect(func():
		for a in parade:
			a.celebrate()
		say("כל הכבוד! מצאת הכול!")
		reward(Vector2(size.x * 0.55, size.y * 0.45), 2, true)
		score(1))
	get_tree().create_timer(1.6).timeout.connect(func():
		for i in parade.size():
			get_tree().create_timer(i * 0.15).timeout.connect(parade[i].voice))
	get_tree().create_timer(5.2).timeout.connect(func():
		for a in parade:
			var tw := a.create_tween()
			tw.tween_property(a, "modulate:a", 0.0, 0.4)
			tw.tween_callback(func():
				actors.erase(a)
				a.queue_free())
		for c in cards:
			var tw := c.create_tween()
			tw.tween_property(c, "pop", 0.0, 0.3)
		get_tree().create_timer(0.5).timeout.connect(new_board))

func _process(dt: float) -> void:
	super._process(dt)
	# after a while with nothing touched, one face-down card wiggles to suggest itself
	if not locked and idle > 5.0 and fmod(idle, 2.5) < dt:
		var down := cards.filter(func(k): return not k.up and not k.matched)
		if not down.is_empty():
			(down.pick_random() as Card).wob = 1.0

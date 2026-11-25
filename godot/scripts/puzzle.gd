extends Activity
## Jigsaw puzzles that come alive.
##
## Each puzzle is a little painted world - a meadow at noon, a sunset, a night
## of stars, a candy-pink valley - with one or two animal friends in it,
## rendered once off-screen and cut into real jigsaw pieces. It is shown whole
## for a moment, then bursts apart and the pieces fly into the tray, bobbing.
##
## Drag a piece and it lifts; drop it anywhere near its place in the frame and
## it snaps in with a click, a sparkle and a rising note. Dropped anywhere else
## it simply stays there - nothing can go wrong. After a few quiet seconds the
## next place glows. When the last piece goes in, the picture comes alive: the
## painted animals turn into the real, moving friends, who jump, dance and say
## hello; Luli names them and fireworks go up. Both hands work at once.

const GRIDS := [Vector2i(2, 2), Vector2i(3, 2), Vector2i(3, 3), Vector2i(4, 3)]
const FRIENDS := ["bunny", "cat", "dog", "bear", "pig", "fox", "panda", "mouse", "frog"]
const NOTES := ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6", "G6", "A6", "C7", "D7"]

## The painted worlds a puzzle can be set in, as World shader moods.
const MOODS := [
	{},
	{"sky_top": Color("#ff9a8a"), "sky_mid": Color("#ffc48a"), "sky_low": Color("#ffe6b0"),
		"hill_far": Color("#d79ab8"), "hill_mid": Color("#b8c46a"), "hill_near": Color("#8fb850"), "sun": Vector2(0.5, 0.42)},
	{"sky_top": Color("#141a4a"), "sky_mid": Color("#2f3a8a"), "sky_low": Color("#7a5ab0"),
		"hill_far": Color("#3a4a8a"), "hill_mid": Color("#2f6a5a"), "hill_near": Color("#2a5a48"),
		"ground": Color("#356a4a"), "sun": Vector2(0.8, 0.18), "rays": 0.0},
	{"sky_top": Color("#c9a4ff"), "sky_mid": Color("#ffc4e6"), "sky_low": Color("#fff0f8"),
		"hill_far": Color("#e6b0ff"), "hill_mid": Color("#ff9ecf"), "hill_near": Color("#ffb0d8"), "ground": Color("#9fe08a")},
]

var grid := Vector2i(2, 2)
var board := Rect2()          # where the picture sits, in screen pixels
var tray := Rect2()           # where loose pieces wait
var cell := Vector2.ZERO
var tray_scale := 1.0
var pieces: Array[Piece] = []
var held := {}                # touch index -> Piece
var picture: Texture2D        # the whole picture
var backdrop: Texture2D       # the same picture without the animals
var friends := []             # [{species, pos (in picture), height}]
var live: Array[Creature] = []
var ghost: Sprite2D
var frame_node: Node2D
var slot_lines: Node2D
var alive_bg: Sprite2D
var hint: Sprite2D
var ready_to_play := false
var complete := false
var round_i := 0
var moods_left := []
var friends_left := []

func mood() -> Dictionary:
	return {"horizon": 0.6, "sky_low": Color("#ffe8d0")}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.1, size.y * 0.08, size.x * 0.9, size.y * 0.9)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.07, size.y * 0.97)

func bubble_spot() -> Vector2:
	return Vector2(size.x * 0.14, size.y * 0.06)

func build() -> void:
	hue = Color("#ff9a1f")
	goals = [2, 2, 2, 2]
	_layout()
	frame_node = Node2D.new()
	frame_node.z_index = 6
	frame_node.draw.connect(_draw_frame)
	add_child(frame_node)
	ghost = Sprite2D.new()
	ghost.centered = false
	ghost.position = board.position
	ghost.modulate = Color(1, 1, 1, 0.22)
	ghost.z_index = 7
	add_child(ghost)
	slot_lines = Node2D.new()
	slot_lines.z_index = 7
	add_child(slot_lines)
	hint = Sprite2D.new()
	hint.texture = load("res://art/glow.svg")
	hint.modulate = Color(1, 0.95, 0.6, 0.0)
	hint.z_index = 7
	add_child(hint)
	alive_bg = Sprite2D.new()
	alive_bg.centered = false
	alive_bg.position = board.position
	alive_bg.z_index = 10
	alive_bg.modulate.a = 0.0
	add_child(alive_bg)

func _ready() -> void:
	id = "puzzle"
	super._ready()
	get_tree().create_timer(0.6).timeout.connect(func(): say("בואי נרכיב פאזל!"))
	new_puzzle()
	Shot.maybe(self)

## Layers: the meadow's foreground grass is z 5, so the whole puzzle sits
## above it - frame 6, ghost 7, placed pieces 8, loose 9, carried 12, the
## picture come alive 10-11.
##
## Board on the right (Hebrew reads from the right, so the eye starts there),
## tray of loose pieces on the left, clear of Luli in the bottom corner.
func _layout() -> void:
	var top := size.y * 0.13
	var avail := Rect2(size.x * 0.5, top, size.x * 0.47, size.y * 0.8)
	var aspect := 4.0 / 3.0
	var w := minf(avail.size.x, avail.size.y * aspect)
	var h := w / aspect
	board = Rect2(avail.position + (avail.size - Vector2(w, h)) / 2.0, Vector2(w, h)).abs()
	board.position = board.position.round()
	board.size = board.size.round()
	tray = Rect2(size.x * 0.13, top + size.y * 0.04, board.position.x - size.x * 0.13 - size.x * 0.04, size.y * 0.74)

# --- making a puzzle ------------------------------------------------------------------

func new_puzzle() -> void:
	ready_to_play = false
	complete = false
	grid = GRIDS[level - 1]
	for p in pieces:
		p.queue_free()
	pieces.clear()
	held.clear()
	for c in live:
		c.queue_free()
	live.clear()
	for l in slot_lines.get_children():
		l.queue_free()
	alive_bg.modulate.a = 0.0
	cell = Vector2(board.size.x / grid.x, board.size.y / grid.y)
	await _paint_picture()
	ghost.texture = picture
	alive_bg.texture = backdrop
	_cut_pieces()
	# show it whole for a moment, so she sees what she is making
	for p in pieces:
		p.position = p.home
		p.scale = Vector2.ONE
		p.z_index = 8
		p.set_outline(0.0)
	await get_tree().create_timer(1.3).timeout
	if not is_inside_tree():
		return
	Game.play("swipe", 0.7)
	Game.arp("harp", ["G6", "E6", "C6", "G5"], 0.05, 0.4)
	Fx.burst(fx, board.get_center(), Fx.RAINBOW, 24, 0.9)
	var order := pieces.duplicate()
	order.shuffle()
	var n := order.size()
	var cols := maxi(1, int(ceil(sqrt(n * tray.size.x / tray.size.y))))
	var rows := int(ceil(float(n) / cols))
	var tc := Vector2(tray.size.x / cols, tray.size.y / rows)
	# big enough to grab: neighbours may overlap a little, a tiny piece is worse
	tray_scale = clampf(minf(tc.x / (cell.x * 1.12), tc.y / (cell.y * 1.12)), 0.45, 0.9)
	for i in n:
		var p: Piece = order[i]
		var spot := tray.position + Vector2((i % cols + 0.5) * tc.x, (i / cols + 0.5) * tc.y)
		spot += Vector2(randf_range(-0.1, 0.1) * tc.x, randf_range(-0.08, 0.08) * tc.y)
		p.rest = spot
		p.tilt = randf_range(-0.22, 0.22)
		p.z_index = 9
		var tw := p.create_tween().set_parallel(true)
		tw.tween_property(p, "position", spot, 0.55).set_delay(i * 0.04).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_property(p, "scale", Vector2.ONE * tray_scale, 0.55).set_delay(i * 0.04)
		tw.tween_property(p, "rotation", p.tilt, 0.55).set_delay(i * 0.04)
		tw.tween_method(p.set_outline, 0.0, 1.0, 0.3).set_delay(i * 0.04)
		var line := Line2D.new()
		line.points = p.outline_points()
		line.closed = true
		line.width = 3.0
		line.default_color = Color(0.45, 0.28, 0.12, 0.35)
		line.position = p.home
		slot_lines.add_child(line)
	await get_tree().create_timer(0.7 + n * 0.04).timeout
	ready_to_play = true

## Paints this puzzle's little world - sky, hills, trees, flowers and one or
## two animal friends - in an off-screen viewport, and keeps two pictures of
## it: with the friends, to cut up, and without, for when they come alive.
func _paint_picture() -> void:
	if moods_left.is_empty():
		moods_left = range(MOODS.size())
		moods_left.shuffle()
	if friends_left.size() < 2:
		friends_left = FRIENDS.duplicate()
		friends_left.shuffle()
	var m: Dictionary = MOODS[moods_left.pop_back()].duplicate()
	m["horizon"] = 0.5
	var vp := SubViewport.new()
	vp.size = Vector2i(board.size)
	vp.transparent_bg = false
	vp.msaa_2d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var w := World.new()
	vp.add_child(w)
	w.setup(m, [Rect2(board.size.x * 0.12, board.size.y * 0.3, board.size.x * 0.76, board.size.y * 0.7)], 0.7)
	if m.get("rays", 1.0) == 0.0:
		# a night picture gets stars and a moon instead of a sun
		for i in 26:
			var s := Sprite2D.new()
			s.texture = load("res://art/star4.svg")
			s.position = Vector2(randf() * board.size.x, randf_range(0.02, 0.4) * board.size.y)
			s.scale = Vector2.ONE * randf_range(0.04, 0.1)
			s.modulate = Color(1, 1, 0.85, randf_range(0.6, 1.0))
			w.add_child(s)
	var count := 1 if grid.x * grid.y <= 4 else 2
	friends.clear()
	var crs: Array[Creature] = []
	for i in count:
		var c := Creature.new()
		c.species = friends_left.pop_back()
		c.height = board.size.y * (0.62 if count == 1 else 0.52)
		var fx_ := 0.5 if count == 1 else (0.3 if i == 0 else 0.7)
		c.position = Vector2(board.size.x * fx_, board.size.y * 0.93)
		c.z_index = 8
		c.visible = false
		vp.add_child(c)
		crs.append(c)
		friends.append({"species": c.species, "pos": c.position, "height": c.height})
	# let the world settle, then photograph it without and with the friends
	await _frames(4)
	backdrop = _grab(vp, Color("#bfe6ff"))
	for c in crs:
		c.visible = true
		c.feel("happy", 9.0)
	await _frames(3)
	picture = _grab(vp, Color("#ffd0a0"))
	vp.queue_free()

## Waits for `n` frames to be drawn. Without a renderer (headless play-test)
## nothing is drawn, so it waits for processed frames instead.
func _frames(n: int) -> void:
	for i in n:
		if DisplayServer.get_name() == "headless":
			await get_tree().process_frame
		else:
			await RenderingServer.frame_post_draw

## A still of the viewport. Without a real renderer (the headless play-test)
## there is no image to read, so a plain card stands in.
func _grab(vp: SubViewport, fallback: Color) -> Texture2D:
	var img: Image = null
	if DisplayServer.get_name() != "headless":
		img = vp.get_texture().get_image()
	if img == null or img.is_empty():
		img = Image.create(int(board.size.x), int(board.size.y), false, Image.FORMAT_RGBA8)
		img.fill(fallback)
	return ImageTexture.create_from_image(img)

func _cut_pieces() -> void:
	var H := []
	var V := []
	for r in grid.y:
		var hr := []
		var vr := []
		for c in grid.x:
			hr.append(1 if randf() < 0.5 else -1)
			vr.append(1 if randf() < 0.5 else -1)
		H.append(hr)
		V.append(vr)
	var k := 0
	for r in grid.y:
		for c in grid.x:
			var tabs := [
				0 if r == 0 else -H[r - 1][c],
				0 if c == grid.x - 1 else V[r][c],
				0 if r == grid.y - 1 else H[r][c],
				0 if c == 0 else -V[r][c - 1],
			]
			var p := Piece.new()
			p.setup(picture, cell, Vector2(c, r) * cell + cell / 2.0, tabs)
			p.home = board.position + Vector2(c, r) * cell + cell / 2.0
			p.note = NOTES[k % NOTES.size()]
			k += 1
			add_child(p)
			pieces.append(p)

# --- a piece ------------------------------------------------------------------------

class Piece extends Node2D:
	var home := Vector2.ZERO
	var rest := Vector2.ZERO
	var placed := false
	var lifted := false
	var touch := -1
	var grab := Vector2.ZERO
	var tilt := 0.0
	var note := "C5"
	var half := Vector2.ZERO
	var t := randf() * 10.0
	var image: Polygon2D
	var shade: Polygon2D
	var dark: Line2D
	var light: Line2D
	var pts := PackedVector2Array()

	## Builds the piece's outline - straight edges with round jigsaw tabs and
	## holes - and fills it with its part of the picture.
	func setup(tex: Texture2D, cell: Vector2, centre: Vector2, tabs: Array) -> void:
		half = cell / 2.0
		var s := minf(cell.x, cell.y)
		var c := [Vector2(-half.x, -half.y), Vector2(half.x, -half.y), Vector2(half.x, half.y), Vector2(-half.x, half.y)]
		for i in 4:
			_edge(c[i], c[(i + 1) % 4], tabs[i], s)
		var uv := PackedVector2Array()
		for p in pts:
			uv.append(p + centre)
		shade = Polygon2D.new()
		shade.polygon = pts
		shade.color = Color(0.2, 0.1, 0.05, 0.28)
		shade.position = Vector2(s * 0.03, s * 0.05)
		shade.antialiased = true
		add_child(shade)
		image = Polygon2D.new()
		image.polygon = pts
		image.uv = uv
		image.texture = tex
		image.antialiased = true
		add_child(image)
		# a soft bevel: dark rim, and a light edge catching the light above-left
		dark = Line2D.new()
		dark.points = pts
		dark.closed = true
		dark.width = maxf(2.0, s * 0.02)
		dark.default_color = Color(0.35, 0.2, 0.08, 0.55)
		dark.antialiased = true
		add_child(dark)
		light = Line2D.new()
		light.points = pts
		light.closed = true
		light.width = maxf(1.5, s * 0.012)
		light.default_color = Color(1, 1, 1, 0.55)
		light.position = Vector2(-1.5, -1.5)
		light.antialiased = true
		add_child(light)

	func _edge(a: Vector2, b: Vector2, d: int, s: float) -> void:
		pts.append(a)
		if d == 0:
			return
		var L := a.distance_to(b)
		var u := (b - a) / L
		var n := Vector2(u.y, -u.x)    # outward, walking clockwise
		var P := func(al: float, bn: float) -> Vector2:
			return a + u * (L / 2.0 + (al - 0.5) * s) + n * bn * s * d
		var segs := [
			[P.call(0.36, 0.0), P.call(0.42, 0.06), P.call(0.28, 0.26), P.call(0.5, 0.27)],
			[P.call(0.5, 0.27), P.call(0.72, 0.26), P.call(0.58, 0.06), P.call(0.64, 0.0)],
		]
		pts.append(segs[0][0])
		for sg in segs:
			for i in range(1, 11):
				var k := i / 10.0
				var q: Vector2 = sg[0].bezier_interpolate(sg[1], sg[2], sg[3], k)
				pts.append(q)

	func outline_points() -> PackedVector2Array:
		return pts

	func set_outline(a: float) -> void:
		dark.modulate.a = a
		light.modulate.a = a
		shade.modulate.a = a

	func hit(p: Vector2) -> bool:
		var d := (p - position).rotated(-rotation) / scale.x
		return absf(d.x) < half.x * 1.15 and absf(d.y) < half.y * 1.15

	func _process(dt: float) -> void:
		t += dt
		if lifted:
			shade.position = Vector2(half.x, half.y) * 0.12
			shade.color.a = 0.32
		elif not placed:
			shade.position = Vector2(half.x, half.y) * 0.05
			shade.color.a = 0.25

# --- touch ------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_press(event.index, event.position)
		else:
			_release(event.index, event.position)
	elif event is InputEventScreenDrag:
		var p: Piece = held.get(event.index)
		if p:
			p.position = event.position + p.grab
			_check_hover(p)

func _press(idx: int, pos: Vector2) -> void:
	if not ready_to_play:
		return
	if complete:
		for c in live:
			if pos.distance_to(c.position + Vector2(0, -c.height * 0.5)) < c.height * 0.55:
				c.poke()
				say(Creature.NAMES[c.species] + "!")
				return
		Fx.burst(fx, pos, Fx.RAINBOW, 12, 0.5)
		return
	# topmost loose piece under the finger
	var best: Piece = null
	for p in pieces:
		if not p.placed and not p.lifted and p.hit(pos):
			if best == null or p.z_index >= best.z_index:
				best = p
	if best:
		_lift(best, idx, pos)
		return
	for p in pieces:
		if p.placed and p.hit(pos):
			_wiggle(p)
			Game.note("xylophone", p.note, 0.4)
			return
	if pos.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("בואי נרכיב פאזל!")

func _lift(p: Piece, idx: int, pos: Vector2) -> void:
	held[idx] = p
	p.lifted = true
	p.touch = idx
	p.grab = p.position - pos
	p.z_index = 12
	var tw := p.create_tween().set_parallel(true)
	tw.tween_property(p, "scale", Vector2.ONE * 1.08, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(p, "rotation", 0.0, 0.18)
	# the hold point shrinks with the piece's growth, so keep it under the finger
	p.grab *= 1.08 / maxf(0.01, p.scale.x)
	Game.play("grab", 0.6)

func _release(idx: int, pos: Vector2) -> void:
	var p: Piece = held.get(idx)
	if p == null:
		return
	held.erase(idx)
	p.lifted = false
	p.touch = -1
	# very forgiving: anywhere within most of a piece of its place counts
	if p.position.distance_to(p.home) < maxf(cell.x, cell.y) * 0.75:
		_snap(p)
	else:
		p.rest = p.position
		p.z_index = 9
		p.tilt = randf_range(-0.1, 0.1)
		var tw := p.create_tween().set_parallel(true)
		tw.tween_property(p, "scale", Vector2.ONE * tray_scale, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_property(p, "rotation", p.tilt, 0.25)
		Game.play("drop", 0.5)

func _check_hover(_p: Piece) -> void:
	pass

func _snap(p: Piece) -> void:
	p.placed = true
	p.z_index = 8
	var tw := p.create_tween()
	tw.set_parallel(true)
	tw.tween_property(p, "position", p.home, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(p, "rotation", 0.0, 0.16)
	tw.tween_property(p, "scale", Vector2(1.12, 0.9), 0.1)
	tw.chain().tween_property(p, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_method(p.set_outline, 1.0, 0.25, 0.4)
	var n := pieces.filter(func(x): return x.placed).size()
	Game.play("snap", 0.85)
	Game.note("xylophone", NOTES[mini(n - 1, NOTES.size() - 1)], 0.6)
	Fx.burst(fx, p.home, [Color("#ffd84a"), Color.WHITE, hue], 16, 0.5)
	luli.feel("happy", 0.6)
	if randf() < 0.3 and n < pieces.size():
		say("יופי!")
	if n == pieces.size():
		_finish()

func _wiggle(p: Piece) -> void:
	var tw := p.create_tween()
	tw.tween_property(p, "rotation", 0.08, 0.06)
	tw.tween_property(p, "rotation", -0.08, 0.08)
	tw.tween_property(p, "rotation", 0.0, 0.2).set_trans(Tween.TRANS_ELASTIC)

# --- the picture comes alive ------------------------------------------------------------------

func _finish() -> void:
	complete = true
	await get_tree().create_timer(0.45).timeout
	if not is_inside_tree():
		return
	Game.play("chime", 0.8)
	Game.arp("harp", ["C5", "E5", "G5", "C6", "E6", "G6"], 0.06, 0.5)
	# the painted world without its friends fades in over the pieces, and the
	# real friends appear exactly where their pictures were
	for f in friends:
		var c := Creature.new()
		c.species = f["species"]
		c.height = f["height"]
		c.position = board.position + f["pos"]
		c.z_index = 11
		c.modulate.a = 0.0
		add_child(c)
		c.feel("happy", 3.0)
		live.append(c)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(alive_bg, "modulate:a", 1.0, 0.5)
	for c in live:
		tw.tween_property(c, "modulate:a", 1.0, 0.5)
	await tw.finished
	if not is_inside_tree():
		return
	for p in pieces:
		p.visible = false
	for l in slot_lines.get_children():
		l.visible = false
	for i in live.size():
		var c: Creature = live[i]
		get_tree().create_timer(0.15 + i * 0.5).timeout.connect(func():
			c.celebrate()
			c.voice())
	say("התמונה התעוררה!")
	get_tree().create_timer(1.6).timeout.connect(func():
		if is_inside_tree():
			say(" ".join(live.map(func(c): return Creature.NAMES[c.species] + "!"))))
	reward(board.get_center(), 2, true)
	score(1)
	await get_tree().create_timer(5.2).timeout
	if not is_inside_tree():
		return
	# everything gently away, and the next picture
	var out := create_tween().set_parallel(true)
	out.tween_property(alive_bg, "modulate:a", 0.0, 0.4)
	for c in live:
		out.tween_property(c, "modulate:a", 0.0, 0.4)
	await out.finished
	if is_inside_tree():
		new_puzzle()

# --- frame -----------------------------------------------------------------------------------

func _draw_frame() -> void:
	var pad := maxf(18.0, board.size.x * 0.035)
	var outer := board.grow(pad)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color("#c98a50")
	sb.set_corner_radius_all(int(pad * 1.2))
	sb.border_color = Color("#9a5e2c")
	sb.set_border_width_all(int(pad * 0.25))
	sb.shadow_color = Color(0.3, 0.15, 0.05, 0.3)
	sb.shadow_size = 18
	sb.shadow_offset = Vector2(0, 10)
	frame_node.draw_style_box(sb, outer)
	# wood grain
	for i in 7:
		var y := outer.position.y + pad * 0.5 + i * (outer.size.y - pad) / 6.0
		frame_node.draw_line(Vector2(outer.position.x + pad * 0.3, y), Vector2(outer.position.x + pad * 0.75, y + pad * 0.3), Color(0.5, 0.28, 0.1, 0.25), 3.0)
		frame_node.draw_line(Vector2(outer.end.x - pad * 0.75, y), Vector2(outer.end.x - pad * 0.3, y + pad * 0.3), Color(0.5, 0.28, 0.1, 0.25), 3.0)
	frame_node.draw_rect(board, Color("#fff6e8"))
	frame_node.draw_rect(Rect2(board.position, Vector2(board.size.x, 6)), Color(0.4, 0.2, 0.05, 0.25))

func _process(dt: float) -> void:
	super._process(dt)
	var tt := Time.get_ticks_msec() / 1000.0
	for p in pieces:
		if not p.placed and not p.lifted and ready_to_play and not complete:
			p.position = p.rest + Vector2(0, sin(tt * 2.0 + p.t) * 4.0)
	# a quiet moment: the next empty place glows, its piece wiggles
	var next: Piece = null
	if ready_to_play and not complete and idle > 5.0:
		for p in pieces:
			if not p.placed and not p.lifted:
				next = p
				break
	if next:
		hint.position = next.home
		hint.scale = Vector2.ONE * maxf(cell.x, cell.y) / 200.0
		hint.modulate.a = 0.45 + 0.3 * sin(tt * 5.0)
		next.rotation = next.tilt + sin(tt * 12.0) * 0.06
	else:
		hint.modulate.a = move_toward(hint.modulate.a, 0.0, dt * 3.0)

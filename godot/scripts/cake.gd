extends Activity
## The bakery: build a birthday cake from scratch.
##
##   1. pick a sponge - the tiers drop onto the stand one by one and squash
##   2. pick an icing - it pours from a bowl and runs down the sides in drips
##   3. decorate - tap a topping and it hops onto a free spot, or drag it to
##      exactly the spot she wants; the sprinkle shaker showers the whole cake
##   4. three candles light one by one; touching a flame blows it out
##   5. Happy Birthday plays, the guests cheer, fireworks
##
## Two animal guests sit at the table and react to everything. Surprises: a
## guest sneaks a lick of icing, the cake wobbles like jelly when poked, and
## from level three one trick candle lights itself again.
##
## Any sponge, any icing, any topping anywhere is a beautiful cake: nothing in
## here can go wrong.

const SPONGES := [
	{"c": "#f5d08a", "name": "וניל"},
	{"c": "#8a5a3c", "name": "שוקולד"},
	{"c": "#ff9fbf", "name": "תות"},
]
const ICINGS := [
	{"c": "#ffffff", "name": "לבן"},
	{"c": "#ff8ac4", "name": "ורוד"},
	{"c": "#7a4a30", "name": "שוקולד"},
	{"c": "#9fdcff", "name": "תכלת"},
	{"c": "#c6a4ff", "name": "סגול"},
	{"c": "#b8f08a", "name": "ירוק"},
]
const TOPPINGS := [
	{"tex": "food_strawberry", "name": "תות", "size": 1.0},
	{"tex": "cake_cherry", "name": "דובדבן", "size": 1.0},
	{"tex": "cake_heart", "name": "לב", "size": 0.9},
	{"tex": "cake_star", "name": "כוכב", "size": 0.95},
	{"tex": "cake_candy", "name": "סוכרייה", "size": 0.85},
	{"tex": "cake_macaron", "name": "מקרון", "size": 0.95},
	{"tex": "food_cookie", "name": "עוגייה", "size": 0.85},
]
const SPRINKLE_COLS := ["#ff4d5e", "#ffd23d", "#4fa8ff", "#5fcf5f", "#a774ff", "#ff9a1f", "#ffffff"]
const CANDLE_COLS := ["#9fd8ff", "#ffd84a", "#c9a4ff"]
# tiers on the cake, toppings on the tray, toppings to place before candles
const TUNING := [
	{"tiers": 1, "kinds": 4, "need": 4},
	{"tiers": 2, "kinds": 5, "need": 6},
	{"tiers": 2, "kinds": 6, "need": 8},
	{"tiers": 3, "kinds": 7, "need": 10},
]
const TIER_W := [1.0, 0.78, 0.58]
# Happy Birthday in C: [note, beats]
const SONG := [
	["G4", 0.75], ["G4", 0.25], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
	["G4", 0.75], ["G4", 0.25], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
	["G4", 0.75], ["G4", 0.25], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 2],
	["F5", 0.75], ["F5", 0.25], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 3],
]

var tune: Dictionary
var state := "sponge"      # sponge, wait, icing, pour, decorate, candles, blow, party
var sponge := Color.WHITE
var icing := Color.WHITE
var W := 500.0
var table_y := 800.0
var cake_root: Node2D
var stand: Sprite2D
var tiers: Array = []        # {node, body, icing, filling, sy, w, base, top, wob, wob_v}
var spots: Array = []        # free spots: {tier, pos}
var placed := 0
var licked := false
var trick_used := false
var buttons: Array = []      # {node, pos, r, kind, data}
var tray: Node2D
var drag := {}               # pointer index -> {data, ghost, moved}
var candles: Array = []      # {node, flame, lit, trick}
var guests: Array[Creature] = []
var table: Node2D

func mood() -> Dictionary:
	return {"horizon": 0.5, "sky_top": Color("#7cc0ff"), "sky_low": Color("#ffe3f1"),
		"ground": Color("#8fd46a")}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.14, size.y * 0.25, size.x * 0.72, size.y * 0.75)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.075, size.y * 0.99)

func bubble_spot() -> Vector2:
	return Vector2(size.x * 0.06, size.y * 0.15)

func _ready() -> void:
	id = "cake"
	hue = Color("#ff5fa2")
	goals = [1, 2, 2, 2]
	super._ready()
	tune = TUNING[level - 1]
	new_cake(true)
	Shot.maybe(self)

func on_level_up() -> void:
	pass    # the next cake reads the new level in new_cake()

func build() -> void:
	W = minf(size.x * 0.34, size.y * 0.66)
	table_y = size.y * 0.74
	table = Table.new()
	table.y0 = table_y
	table.w = size.x
	table.h = size.y
	table.z_index = 6
	add_child(table)
	cake_root = Node2D.new()
	cake_root.z_index = 7
	add_child(cake_root)
	stand = Sprite2D.new()
	stand.texture = World.tex("cake_stand")
	stand.centered = false
	add_child(stand)
	stand.z_index = 7
	tray = Node2D.new()
	tray.z_index = 12
	tray.draw.connect(_draw_tray)
	add_child(tray)
	_place_stand()

func _place_stand() -> void:
	var ss := W * 1.22 / 484.0
	var sy := ss * 0.5     # a low pedestal: the cake is the star, not the stand
	stand.scale = Vector2(ss, sy)
	# the stand's foot rests on the table, the cake sits on its plate
	var plate_y := table_y + size.y * 0.05 - (282.0 - 62.0) * sy
	stand.position = Vector2(size.x / 2 - 256.0 * ss, plate_y - 62.0 * sy)
	cake_root.position = Vector2(size.x / 2, plate_y)

# --- the table and the guests ---------------------------------------------------------

class Table extends Node2D:
	var y0 := 800.0
	var w := 1920.0
	var h := 1080.0
	func _draw() -> void:
		# a party tablecloth: scalloped edge, polka dots
		var top := PackedVector2Array([Vector2(0, h), Vector2(0, y0)])
		var n := int(w / 70.0) + 1
		for i in n + 1:
			var x := i * w / n
			top.append(Vector2(x - w / n / 2, y0 + 26))
			top.append(Vector2(x, y0))
		top.append(Vector2(w, h))
		draw_colored_polygon(PackedVector2Array([Vector2(0, y0 - 6), Vector2(w, y0 - 6), Vector2(w, h), Vector2(0, h)]), Color(0.45, 0.2, 0.35, 0.18))
		draw_rect(Rect2(0, y0 - 18, w, 24), Color("#fff4f8"))
		draw_colored_polygon(top, Color("#ff9ac6"))
		for j in 4:
			for i in n:
				var x := (i + (0.5 if j % 2 else 0.0)) * w / n
				var y := y0 + 60 + j * 70
				if y < h:
					draw_circle(Vector2(x, y), 12, Color(1, 1, 1, 0.55))
		draw_rect(Rect2(0, y0 - 18, w, 6), Color(1, 1, 1, 0.9))

func _seat_guests() -> void:
	for g in guests:
		g.queue_free()
	guests.clear()
	var kinds := ["bunny", "cat", "dog", "bear", "pig", "fox", "panda", "mouse", "frog"]
	kinds.shuffle()
	for i in 2:
		var g := Creature.new()
		g.species = kinds[i]
		g.height = size.y * 0.33
		g.position = Vector2(size.x * (0.2 if i == 0 else 0.8), table_y + size.y * 0.1)
		g.z_index = 2      # behind the tablecloth: they sit at the table
		add_child(g)
		guests.append(g)

func _cheer(big := false) -> void:
	for g in guests:
		if big:
			g.celebrate()
		else:
			g.feel("happy", 0.9)
			g.jump(0.45)
	if randf() < 0.35:
		guests.pick_random().voice()

# --- rounds --------------------------------------------------------------------------------

func new_cake(first := false) -> void:
	tune = TUNING[level - 1]
	for t in tiers:
		t["node"].queue_free()
	tiers.clear()
	spots.clear()
	for c in candles:
		c["node"].queue_free()
	candles.clear()
	placed = 0
	licked = false
	trick_used = false
	if first or guests.is_empty():
		_seat_guests()
	_set_state("sponge")
	get_tree().create_timer(0.7 if first else 0.2).timeout.connect(func(): say("איזו עוגה נאפה?"))

func _set_state(s: String) -> void:
	state = s
	_build_buttons()

func _build_buttons() -> void:
	for b in buttons:
		b["node"].queue_free()
	buttons.clear()
	var items := []
	match state:
		"sponge":
			for sp in SPONGES:
				items.append({"kind": "sponge", "data": sp, "tex": "cake_slice", "tint": Color(sp["c"]), "scale": 1.0})
		"icing":
			for ic in ICINGS:
				items.append({"kind": "icing", "data": ic, "tex": "cake_bowl", "tint": Color(ic["c"]), "scale": 1.0})
		"decorate":
			for i in tune["kinds"]:
				var tp: Dictionary = TOPPINGS[i]
				items.append({"kind": "top", "data": tp, "tex": tp["tex"], "tint": Color.WHITE, "scale": tp["size"]})
			items.append({"kind": "shaker", "data": {"name": "סוכריות"}, "tex": "cake_shaker", "tint": Color.WHITE, "scale": 1.0})
	var n := items.size()
	if n == 0:
		return
	var r := clampf(minf(size.y * 0.075, size.x * 0.9 / n / 2.5), 40.0, 95.0)
	var gap := minf(r * 2.55, size.x * 0.88 / n)
	for i in n:
		var it: Dictionary = items[i]
		var node := Node2D.new()
		# right to left, the way she reads
		node.position = Vector2(size.x / 2 + ((n - 1) / 2.0 - i) * gap, size.y * 0.9)
		node.scale = Vector2.ZERO
		node.z_index = 13
		add_child(node)
		_icon(node, it, r)
		var tw := node.create_tween()
		tw.tween_interval(0.05 * i)
		tw.tween_property(node, "scale", Vector2.ONE, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		buttons.append({"node": node, "pos": node.position, "r": r, "kind": it["kind"], "data": it["data"]})

func _icon(node: Node2D, it: Dictionary, r: float) -> void:
	if it["kind"] == "icing":
		var bowl := Sprite2D.new()
		bowl.texture = World.tex("cake_bowl")
		bowl.scale = Vector2.ONE * r * 2.3 / 512.0
		bowl.position = Vector2(0, -r * 0.1)
		var cream := Sprite2D.new()
		cream.texture = World.tex("cake_cream")
		cream.modulate = it["tint"]
		cream.scale = Vector2.ONE * r * 1.7 / 512.0
		cream.position = Vector2(0, -r * 0.55)
		node.add_child(cream)
		node.add_child(bowl)
		return
	var s := Sprite2D.new()
	s.texture = World.tex(it["tex"])
	s.modulate = it["tint"]
	s.scale = Vector2.ONE * r * 1.75 / 512.0 * float(it["scale"])
	node.add_child(s)

func _draw_tray() -> void:
	if buttons.is_empty():
		return
	var first: Dictionary = buttons[0]
	var last: Dictionary = buttons[buttons.size() - 1]
	var r: float = first["r"]
	var rect := Rect2(Vector2(last["pos"].x - r * 1.25, first["pos"].y - r * 1.2), Vector2(first["pos"].x - last["pos"].x + r * 2.5, r * 2.4))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.82)
	sb.set_corner_radius_all(int(r * 1.1))
	sb.shadow_color = Color(0.35, 0.15, 0.3, 0.2)
	sb.shadow_size = 12
	sb.shadow_offset = Vector2(0, 6)
	tray.draw_style_box(sb, rect)
	var pulse := sin(Time.get_ticks_msec() / 160.0) * 0.5 + 0.5
	for b in buttons:
		var a := 0.55 if idle < 3.0 else 0.55 + pulse * 0.4
		tray.draw_circle(b["pos"], r * 1.02, Color(1, 0.93, 0.97, a))

# --- building the cake ------------------------------------------------------------------------

func _tier_geom(i: int) -> Dictionary:
	var w: float = W * TIER_W[i]
	var sx := w / 480.0
	var sy := sx * 0.72
	var base := 0.0
	for k in i:
		var pw: float = W * TIER_W[k]
		base -= 214.0 * (pw / 480.0 * 0.72)
	return {"w": w, "sx": sx, "sy": sy, "base": base, "top": base - 230.0 * sy}

func _add_tier(i: int) -> void:
	var g := _tier_geom(i)
	var node := Node2D.new()
	node.position = Vector2(0, g["base"])
	cake_root.add_child(node)
	var mk := func(tex: String, col: Color) -> Sprite2D:
		var s := Sprite2D.new()
		s.texture = World.tex(tex)
		s.centered = false
		s.position = Vector2(-256.0 * g["sx"], -300.0 * g["sy"])
		s.scale = Vector2(g["sx"], g["sy"])
		s.modulate = col
		node.add_child(s)
		return s
	var body: Sprite2D = mk.call("cake_tier", sponge)
	var filling: Sprite2D = mk.call("cake_filling", Color.WHITE)
	var ice: Sprite2D = mk.call("cake_icing", Color.WHITE)
	ice.visible = false
	ice.region_enabled = true
	ice.region_rect = Rect2(0, 0, 512, 1)
	var t := {"node": node, "body": body, "icing": ice, "filling": filling, "wob": 0.0, "wob_v": 0.0}
	t.merge(g)
	tiers.append(t)
	# drop in from above, land with a squash
	node.position.y = g["base"] - size.y
	var tw := node.create_tween()
	tw.tween_property(node, "position:y", g["base"], 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_callback(func():
		t["wob_v"] = 9.0
		Game.play("drop", 0.8, 0.9)
		Game.note("xylophone", ["C5", "E5", "G5"][i], 0.5)
		Fx.burst(fx, cake_root.position + Vector2(0, g["base"]), [Color.WHITE, sponge.lightened(0.3)], 12, 0.4)
		for gst in guests:
			gst.feel("surprised", 0.5))
	# free spots for toppings on the front of this tier
	var per: int = [4, 3, 3][i]
	for k in per:
		var fx_ := (float(k) + 0.5) / per * 2.0 - 1.0
		spots.append({"tier": i, "pos": Vector2(fx_ * g["w"] * 0.36, -150.0 * g["sy"] + absf(fx_) * 14.0)})
	if i == tune["tiers"] - 1:
		# and a ring on top of the top tier, round where the candles will go
		for fx2 in [-0.36, 0.36]:
			spots.append({"tier": i, "pos": Vector2(fx2 * g["w"], -230.0 * g["sy"] + 6.0)})

func _pick_sponge(sp: Dictionary) -> void:
	sponge = Color(sp["c"])
	say(sp["name"])
	Game.play("open", 0.7)
	_set_state("wait")
	for i in tune["tiers"]:
		get_tree().create_timer(0.35 + i * 0.5).timeout.connect(_add_tier.bind(i))
	get_tree().create_timer(0.6 + tune["tiers"] * 0.5 + 0.5).timeout.connect(func():
		_set_state("icing")
		say("איזה קרם?"))

func _pick_icing(ic: Dictionary) -> void:
	icing = Color(ic["c"])
	say(ic["name"])
	_set_state("pour")
	# a big bowl tips over the cake and the cream runs down, top tier first
	var top: Dictionary = tiers[tiers.size() - 1]
	var bowl := Node2D.new()
	bowl.z_index = 9
	var bs := W * 0.5 / 512.0
	var cream := Sprite2D.new()
	cream.texture = World.tex("cake_cream")
	cream.modulate = icing
	cream.scale = Vector2.ONE * bs * 0.8
	cream.position = Vector2(0, -60)
	bowl.add_child(cream)
	var b := Sprite2D.new()
	b.texture = World.tex("cake_bowl")
	b.scale = Vector2.ONE * bs
	bowl.add_child(b)
	bowl.position = cake_root.position + Vector2(W * 0.35, top["top"] - W * 0.55 - size.y * 0.5)
	add_child(bowl)
	var stream := Line2D.new()
	stream.width = W * 0.07
	stream.default_color = icing
	stream.begin_cap_mode = Line2D.LINE_CAP_ROUND
	stream.end_cap_mode = Line2D.LINE_CAP_ROUND
	stream.z_index = 8
	stream.visible = false
	add_child(stream)
	var lip := cake_root.position + Vector2(W * 0.12, top["top"] - W * 0.42)
	var tw := create_tween()
	tw.tween_property(bowl, "position", cake_root.position + Vector2(W * 0.3, top["top"] - W * 0.42), 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(bowl, "rotation", -1.9, 0.35)
	tw.tween_callback(func():
		stream.visible = true
		stream.points = PackedVector2Array([lip, cake_root.position + Vector2(0, top["top"])])
		Game.slide("flute", "C6", [[0, 1.2], [0.6, 0.8], [1.2, 0.7]], 0.35))
	var order := range(tiers.size())
	order.reverse()
	for i in order:
		var t: Dictionary = tiers[i]
		tw.tween_callback(func():
			t["icing"].visible = true
			t["icing"].modulate = icing
			t["wob_v"] = 4.0)
		tw.tween_method(func(v: float): t["icing"].region_rect = Rect2(0, 0, 512, maxf(1.0, v * 320.0)), 0.0, 1.0, 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func(): stream.queue_free())
	tw.tween_property(bowl, "rotation", 0.0, 0.25)
	tw.tween_property(bowl, "position:y", -size.y * 0.5, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.tween_callback(func():
		bowl.queue_free()
		Fx.burst(fx, cake_root.position + Vector2(0, tiers[0]["base"] - 120), [icing, Color.WHITE], 20, 0.6)
		Game.play("chime", 0.6)
		_cheer()
		_set_state("decorate")
		say("עכשיו מקשטים!"))

# --- toppings ---------------------------------------------------------------------------------

func _free_spot(near := Vector2.INF) -> Dictionary:
	if spots.is_empty():
		return {}
	var best: Dictionary = spots[randi() % spots.size()]
	if near != Vector2.INF:
		var bd := INF
		for sp in spots:
			var gp: Vector2 = cake_root.position + tiers[sp["tier"]]["node"].position + sp["pos"]
			var d := gp.distance_to(near)
			if d < bd:
				bd = d
				best = sp
	return best

## Where on the cake a dropped topping lands, or {} when it was dropped off it.
func _cake_hit(p: Vector2) -> Dictionary:
	for i in range(tiers.size() - 1, -1, -1):
		var t: Dictionary = tiers[i]
		var local: Vector2 = p - cake_root.position - t["node"].position
		if absf(local.x) < t["w"] * 0.5 and local.y < 10.0 and local.y > -250.0 * t["sy"]:
			return {"tier": i, "pos": local}
	return {}

func _place(tp: Dictionary, from: Vector2, target: Dictionary) -> void:
	if target.is_empty():
		target = _free_spot()
		if target.is_empty():
			# every spot taken: pile it on top
			var top: Dictionary = tiers[tiers.size() - 1]
			target = {"tier": tiers.size() - 1, "pos": Vector2(randf_range(-0.3, 0.3) * top["w"], -230.0 * top["sy"])}
	spots.erase(target)
	var t: Dictionary = tiers[target["tier"]]
	var s := Sprite2D.new()
	s.texture = World.tex(tp["tex"])
	var final := Vector2.ONE * W * 0.16 / 512.0 * 2.0 * float(tp["size"])
	s.scale = final * 1.3
	s.z_index = 9
	s.global_position = from
	add_child(s)
	var dest: Vector2 = cake_root.position + t["node"].position + target["pos"]
	var mid := from.lerp(dest, 0.5) + Vector2(0, -size.y * 0.22)
	var tw := s.create_tween()
	tw.tween_method(func(k: float):
		s.position = from.lerp(mid, k).lerp(mid.lerp(dest, k), k)
		s.rotation = k * TAU, 0.0, 1.0, 0.5).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(s, "scale", final, 0.5)
	tw.tween_callback(func():
		# stick it to the tier, so it wobbles with the cake
		s.reparent(t["node"])
		s.position = target["pos"]
		s.rotation = randf_range(-0.25, 0.25)
		s.scale = final * Vector2(1.3, 0.7)
		var t2 := s.create_tween()
		t2.tween_property(s, "scale", final, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
		t["wob_v"] = 5.0
		Game.play("pop", 0.7)
		Game.note("xylophone", ["C6", "D6", "E6", "G6", "A6", "C7"][placed % 6], 0.5)
		Fx.burst(fx, s.global_position, [Color.WHITE, Color("#ffd84a"), Color("#ff85c8")], 12, 0.35)
		_topping_done(tp))

func _shake() -> void:
	var shaker := Sprite2D.new()
	shaker.texture = World.tex("cake_shaker")
	shaker.scale = Vector2.ONE * W * 0.35 / 512.0
	shaker.z_index = 9
	var top: Dictionary = tiers[tiers.size() - 1]
	shaker.position = cake_root.position + Vector2(0, top["top"] - W * 0.5)
	shaker.rotation = PI
	add_child(shaker)
	var tw := shaker.create_tween()
	for k in 5:
		tw.tween_property(shaker, "position:x", cake_root.position.x + (W * 0.25 if k % 2 == 0 else -W * 0.25), 0.14)
		tw.tween_callback(_sprinkle_burst)
	tw.tween_property(shaker, "modulate:a", 0.0, 0.2)
	tw.tween_callback(func():
		shaker.queue_free()
		_topping_done({"name": "סוכריות"}))
	Game.play("chime", 0.6)
	Game.arp("xylophone", ["E6", "G6", "C7", "E7"], 0.05, 0.4)

func _sprinkle_burst() -> void:
	Game.play("tap", 0.4, 1.4)
	for k in 6:
		var t: Dictionary = tiers[randi() % tiers.size()]
		var s := Sprite2D.new()
		s.texture = World.tex("cake_sprinkle")
		s.modulate = Color(SPRINKLE_COLS.pick_random())
		s.scale = Vector2.ONE * W * 0.05 / 256.0 * 2.0
		s.rotation = randf() * TAU
		t["node"].add_child(s)
		var dest := Vector2(randf_range(-0.44, 0.44) * t["w"], randf_range(-225.0, -110.0) * t["sy"])
		s.position = dest + Vector2(0, -size.y * 0.25)
		s.modulate.a = 0.0
		var tw := s.create_tween()
		tw.tween_property(s, "modulate:a", 1.0, 0.05)
		tw.parallel().tween_property(s, "position", dest, 0.35).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)

func _topping_done(tp: Dictionary) -> void:
	placed += 1
	say(tp["name"])
	_cheer()
	if placed == 2 and not licked:
		licked = true
		_lick()
	if placed >= tune["need"] and state == "decorate":
		_set_state("wait")
		reward(cake_root.position + Vector2(0, tiers[tiers.size() - 1]["top"]), 1)
		get_tree().create_timer(1.0).timeout.connect(_light_candles)

## The funny one: a guest leans over and sneaks a lick of the icing.
func _lick() -> void:
	var g: Creature = guests.pick_random()
	var home := g.position
	var toward := Vector2(cake_root.position.x + (-W * 0.35 if home.x < cake_root.position.x else W * 0.35), home.y - size.y * 0.05)
	var tw := create_tween()
	tw.tween_interval(0.8)
	tw.tween_property(g, "position", toward, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		g.feel("giggle", 1.2)
		Game.slide("flute", "G5", [[0, 1.0], [0.12, 1.2], [0.24, 1.0], [0.36, 1.25]], 0.4)
		tiers[0]["wob_v"] = 6.0)
	tw.tween_interval(0.7)
	tw.tween_callback(func():
		luli.feel("giggle", 1.0)
		say("היי! לא ללקק!"))
	tw.tween_property(g, "position", home, 0.45).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func(): g.feel("happy", 1.0))

# --- candles ------------------------------------------------------------------------------------

func _light_candles() -> void:
	var top: Dictionary = tiers[tiers.size() - 1]
	var trick := level >= 3
	var trick_i := randi() % 3
	for i in 3:
		var node := Node2D.new()
		node.position = Vector2((i - 1) * top["w"] * 0.22, -230.0 * top["sy"] + 4.0)
		node.z_index = 3
		top["node"].add_child(node)
		var cs := W * 0.3 / 512.0
		var candle := Sprite2D.new()
		candle.texture = World.tex("cake_candle")
		candle.modulate = Color(CANDLE_COLS[i]).lightened(0.4)
		candle.scale = Vector2(cs, cs)
		candle.offset = Vector2(0, -215)
		node.add_child(candle)
		var glow := Sprite2D.new()
		glow.texture = World.tex("glow")
		glow.modulate = Color(1, 0.85, 0.4, 0.0)
		glow.scale = Vector2.ONE * cs * 3.2
		glow.position = Vector2(0, -400.0 * cs)
		node.add_child(glow)
		var flame := Sprite2D.new()
		flame.texture = World.tex("cake_flame")
		flame.scale = Vector2.ZERO
		flame.position = Vector2(0, -395.0 * cs)
		flame.offset = Vector2(0, -150)
		node.add_child(flame)
		node.scale = Vector2(1, 0)
		var c := {"node": node, "flame": flame, "glow": glow, "lit": false, "trick": trick and i == trick_i, "cs": cs}
		candles.append(c)
		var tw := node.create_tween()
		tw.tween_interval(0.35 * i)
		tw.tween_property(node, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_interval(0.5)
		tw.tween_callback(_ignite.bind(c))
	get_tree().create_timer(2.4).timeout.connect(func():
		_set_state("blow")
		say("לנשוף על הנרות!"))

func _ignite(c: Dictionary) -> void:
	c["lit"] = true
	var flame: Sprite2D = c["flame"]
	var tw := flame.create_tween()
	flame.scale = Vector2.ZERO
	tw.tween_property(flame, "scale", Vector2.ONE * c["cs"] * 0.55, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	c["glow"].modulate.a = 0.7
	Game.play("plink", 0.6)
	Game.note("harp", ["G5", "C6", "E6"].pick_random(), 0.45)

func _flame_pos(c: Dictionary) -> Vector2:
	return c["flame"].global_position + Vector2(0, -c["cs"] * 0.55 * 150.0)

func _blow(c: Dictionary) -> void:
	c["lit"] = false
	var flame: Sprite2D = c["flame"]
	var p := _flame_pos(c)
	var tw := flame.create_tween()
	tw.tween_property(flame, "scale", Vector2(flame.scale.x * 1.6, 0.0), 0.15)
	c["glow"].modulate.a = 0.0
	Game.play("swipe", 0.8, 0.8)
	_smoke(p)
	if c["trick"] and not trick_used:
		# a trick candle: it lights itself again, once
		trick_used = true
		get_tree().create_timer(0.9).timeout.connect(func():
			_ignite(c)
			Fx.burst(fx, _flame_pos(c), [Color("#ffd84a"), Color.WHITE], 14, 0.4)
			luli.feel("giggle", 1.2)
			say("הנר נדלק שוב!"))
		return
	if candles.all(func(k): return not k["lit"]):
		_party()

func _smoke(p: Vector2) -> void:
	for k in 5:
		var s := Sprite2D.new()
		s.texture = World.tex("glow")
		s.modulate = Color(0.85, 0.85, 0.92, 0.75)
		s.scale = Vector2.ONE * 0.12
		s.position = p
		s.z_index = 10
		add_child(s)
		var tw := s.create_tween()
		tw.set_parallel(true)
		tw.tween_property(s, "position", p + Vector2(randf_range(-40, 40) + sin(k) * 20, -randf_range(90, 160)), 1.2).set_delay(k * 0.08)
		tw.tween_property(s, "scale", Vector2.ONE * 0.4, 1.2).set_delay(k * 0.08)
		tw.tween_property(s, "modulate:a", 0.0, 1.2).set_delay(k * 0.08)
		tw.chain().tween_callback(s.queue_free)

func _party() -> void:
	_set_state("party")
	var top: Dictionary = tiers[tiers.size() - 1]
	var p := cake_root.position + Vector2(0, top["top"])
	reward(p, 3, true)
	_cheer(true)
	say("יום הולדת שמח!")
	score(1)
	# Happy Birthday, played on piano with a xylophone doubling the tune
	var beat := 0.42
	var at := 1.4
	for n in SONG:
		Game.note("piano", n[0], 0.55, at)
		Game.note("xylophone", n[0], 0.25, at)
		at += float(n[1]) * beat
	Game.duck(at + 0.5)
	for i in 4:
		get_tree().create_timer(1.2 + i * 2.0).timeout.connect(func():
			Fx.fireworks(fx, 2)
			_cheer(true))
	get_tree().create_timer(at + 1.2).timeout.connect(_next_cake)

func _next_cake() -> void:
	# the cake slides off to the side and a fresh stand is ready
	var tw := create_tween()
	tw.tween_property(cake_root, "position:x", size.x + W, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.tween_callback(func():
		cake_root.position.x = size.x / 2
		new_cake()
		say("עוד עוגה?"))

# --- input ---------------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_down(event.index, event.position)
		else:
			_up(event.index, event.position)
	elif event is InputEventScreenDrag and drag.has(event.index):
		var d: Dictionary = drag[event.index]
		d["moved"] = float(d["moved"]) + event.relative.length()
		if d["ghost"]:
			d["ghost"].position = event.position + Vector2(0, -40)

func _down(idx: int, p: Vector2) -> void:
	for b in buttons:
		if p.distance_to(b["pos"]) < b["r"] * 1.2:
			var node: Node2D = b["node"]
			var tw := node.create_tween()
			tw.tween_property(node, "scale", Vector2(1.2, 0.85), 0.07)
			tw.tween_property(node, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
			Game.play("tap", 0.6)
			match b["kind"]:
				"sponge":
					if state == "sponge":
						_pick_sponge(b["data"])
				"icing":
					if state == "icing":
						_pick_icing(b["data"])
				"shaker":
					if state == "decorate":
						_shake()
				"top":
					if state == "decorate":
						var ghost := Sprite2D.new()
						ghost.texture = World.tex(b["data"]["tex"])
						ghost.scale = Vector2.ONE * W * 0.13 / 512.0 * 2.6 * float(b["data"]["size"])
						ghost.position = p + Vector2(0, -40)
						ghost.z_index = 15
						ghost.visible = false
						add_child(ghost)
						drag[idx] = {"data": b["data"], "ghost": ghost, "moved": 0.0, "from": b["pos"]}
			return
	if state == "blow":
		var best = null
		var bd := INF
		for c in candles:
			if c["lit"]:
				var d := p.distance_to(_flame_pos(c))
				if d < bd:
					bd = d
					best = c
		# anywhere near the top of the cake counts as a puff, so she never gets stuck
		if best != null and bd < size.y * 0.2:
			_blow(best)
			return
	if not _cake_hit(p).is_empty() or p.distance_to(cake_root.position + Vector2(0, -W * 0.2)) < W * 0.5:
		_wobble()
		return
	for g in guests:
		if p.distance_to(g.position + Vector2(0, -g.height * 0.6)) < g.height * 0.45:
			g.poke()
			say(Creature.NAMES[g.species])
			return
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("איזו עוגה יפה!")

func _up(idx: int, p: Vector2) -> void:
	if not drag.has(idx):
		return
	var d: Dictionary = drag[idx]
	drag.erase(idx)
	var ghost: Sprite2D = d["ghost"]
	if state != "decorate":
		ghost.queue_free()
		return
	# a short tap sends it to a free spot; a drop on the cake puts it right there
	var target := {}
	var from: Vector2 = d["from"]
	if float(d["moved"]) > 24.0:
		target = _cake_hit(p)
		from = ghost.position
	ghost.queue_free()
	_place(d["data"], from, target)

func _wobble() -> void:
	# jelly: each tier wobbles a moment after the one below it
	for i in tiers.size():
		var t: Dictionary = tiers[i]
		get_tree().create_timer(i * 0.07).timeout.connect(func(): t["wob_v"] = 11.0)
	Game.play("boing", 0.6)
	Game.slide("flute", "E5", [[0, 1.0], [0.1, 1.15], [0.2, 0.95], [0.3, 1.1], [0.4, 1.0]], 0.3)
	for g in guests:
		g.feel("giggle", 0.8)

func _process(dt: float) -> void:
	super._process(dt)
	# The jelly wobble is a stiff spring: integrated in small steps so a slow
	# frame on a cheap tablet cannot blow it up, and clamped for good measure.
	var steps := ceili(dt / (1.0 / 120.0))
	for t in tiers:
		for k in steps:
			var r := Creature.spring(t["wob"], t["wob_v"], 0.0, 160.0, 5.0, dt / steps)
			t["wob"] = clampf(r.x, -1.5, 1.5)
			t["wob_v"] = r.y
		var n: Node2D = t["node"]
		var w: float = t["wob"] * 0.05
		n.scale = Vector2(1.0 + w, 1.0 - w)
		n.skew = t["wob"] * 0.04
	for d in drag.values():
		if d["ghost"] and float(d["moved"]) > 24.0:
			d["ghost"].visible = true
	for c in candles:
		if c["lit"]:
			var f: Sprite2D = c["flame"]
			var tt := Time.get_ticks_msec() / 1000.0
			var k: float = 0.55 * float(c["cs"])
			f.scale = Vector2(k * (1.0 + sin(tt * 17.0 + f.position.x) * 0.06), k * (1.0 + sin(tt * 11.0) * 0.09))
			f.rotation = sin(tt * 5.0 + f.position.x) * 0.08
			c["glow"].modulate.a = 0.55 + sin(tt * 13.0) * 0.12
	tray.queue_redraw()

extends Station
## The pond. The cat would love some fish: fish leap out of the water in
## arcs, Emi taps one in the air and it flies into the basket. Missed fish
## splash back. Sometimes the frog leaps instead: tap it and it lands on
## Luli's head; miss it and it belly-flops. From level two only the orange
## fish count; a blue one wriggles free ("slippery!").

const COUNT := ["אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש"]

var pond_c := Vector3.ZERO
var rx := 3.0
var rz := 2.5
var cat: Actor
var frog: Actor
var lily: Node3D
var basket: Node3D
var need := 3
var got := 0
var jump_t := 0.0
var jumpers: Array = []        # {node, kind, a, b, t, secs, tap}
var only_orange := false
var in_basket: Array[Node3D] = []
var slow_next := false

func setup() -> void:
	id = "pond3d"
	title = "בואי נדוג דגים לחתול!"
	icon = "res://ui/fish.png"
	var pond: Dictionary = garden.layout["pond"]
	var pp: Array = pond["pos"]
	pond_c = Vector3(pp[0], pp[1], pp[2])
	rx = float(pond["r"])
	rz = float(pond["rz"])
	spot = pond_c
	stand = pond_c + Vector3(-1.2, 0, rz + 1.0)
	stand.y = garden.ground_y(stand.x, stand.z)
	var cp := Vector2(pond_c.x + rx + 0.9, pond_c.z + 1.2)
	cat = friend("cat", cp, 1.1)
	var bp := Vector3(pond_c.x + rx + 0.4, 0, pond_c.z + 2.2)
	bp.y = garden.ground_y(bp.x, bp.z)
	basket = place_model("basket", bp, -0.4, 1.0)
	lily = place_model("lily", pond_c + Vector3(-0.9, 0.03, -0.6), 0.5, 1.2)
	place_model("lily", pond_c + Vector3(1.2, 0.03, 0.5), 2.0, 0.8)
	frog = friend("frog", Vector2(lily.global_position.x, lily.global_position.z), 0.75)
	frog.global_position.y = pond_c.y + 0.06
	# a dome over the water only, so taps on the grass round it still walk
	start_on(pond_c - Vector3(0, 0.8, 0), minf(rx, rz) * 0.85)

func marker_height() -> float:
	return 2.6

func play() -> void:
	need = [3, 4, 5, 5][level - 1]
	only_orange = level >= 2
	got = 0
	cat.feel("sad", 2.0)
	say("החתול רוצה %s דגים%s! תפסי דג כשהוא קופץ!" % [COUNT[need - 1], " כתומים" if only_orange else ""])
	jump_t = -1.5

func tick(dt: float) -> void:
	if not active:
		return
	jump_t += dt
	var gap: float = [2.0, 1.7, 1.4, 1.2][level - 1]
	if _playing and got < need and jump_t > gap and jumpers.size() < 2:
		jump_t = randf_range(-0.3, 0.3)
		_leap("frog" if randf() < 0.15 and not _frog_busy() else ("fish_blue" if only_orange and randf() < 0.4 else ("fish_orange" if randf() < 0.75 or only_orange else "fish_blue")))
	for j in jumpers.duplicate():
		j["t"] += dt / float(j["secs"])
		var k: float = j["t"]
		var n: Node3D = j["node"]
		var a: Vector3 = j["a"]
		var b: Vector3 = j["b"]
		var h: float = j["h"]
		var p := a.lerp(b, k) + Vector3(0, sin(k * PI) * h, 0)
		if j["kind"] != "frog":
			var v := (b - a) + Vector3(0, cos(k * PI) * PI * h, 0)
			n.global_position = p
			n.rotation = Vector3(0, 0, atan2(v.x, -v.y))
		else:
			n.global_position = p
		if j["tap"]:
			j["tap"].global_position = p + Vector3(0, 0.1, 0)
		if k >= 1.0:
			jumpers.erase(j)
			if j["tap"]:
				garden.remove_tap(j["tap"])
			_splash(n.global_position, j["kind"] == "frog")
			if j["kind"] == "frog":
				_frog_home()
			else:
				n.queue_free()

func _frog_busy() -> bool:
	return jumpers.any(func(j): return j["kind"] == "frog") or frog.get_meta("on_head", false)

func _leap(kind: String) -> void:
	var ang := randf() * TAU
	var a := pond_c + Vector3(cos(ang) * rx * 0.45, -0.05, sin(ang) * rz * 0.45)
	var b := pond_c + Vector3(cos(ang + PI * 0.8) * rx * 0.5, -0.05, sin(ang + PI * 0.8) * rz * 0.5)
	var n: Node3D
	if kind == "frog":
		n = frog
		a = frog.global_position
		Game.play("boing")
	else:
		n = place_model(kind, a, 0.0, 2.4)
		_splash(a, false, 0.5)
	var secs := randf_range(1.5, 1.8) - level * 0.08
	var j := {"node": n, "kind": kind, "a": a, "b": b, "t": 0.0, "secs": secs, "h": randf_range(1.5, 2.1), "tap": null}
	if slow_next and kind != "frog" and not (only_orange and kind == "fish_blue"):
		# a hint: this fish leaps slowly with a star over it
		slow_next = false
		j["secs"] = secs * 2.2
		j["hint"] = true
		point_at(a + Vector3(0, 0.9, 0), j["secs"])
	j["tap"] = garden.add_tap(a, 0.85 if kind != "frog" else 0.8, _catch.bind(j))
	jumpers.append(j)

func _splash(at: Vector3, big: bool, vol := 0.8) -> void:
	Game.play("drop", vol, 0.7 if big else 1.1)
	Fx.burst(Game.fx, garden.screen_of(at), [Color("#ffffff"), Color("#9fe6ff"), Color("#5fc8ff")], 30 if big else 14, 0.9 if big else 0.5)
	if big:
		say("פלופ! הצפרדע עשתה בטן-בטן!")
		garden.luli.feel("giggle", 1.5)

func _catch(j: Dictionary) -> void:
	if not active or not jumpers.has(j):
		return
	jumpers.erase(j)
	garden.remove_tap(j["tap"])
	j["tap"] = null
	var n: Node3D = j["node"]
	var kind: String = j["kind"]
	if kind == "frog":
		_frog_on_head()
		return
	if only_orange and kind == "fish_blue":
		Game.play("nope")
		say("חלקלק! רק כתומים!")
		var p := n.global_position
		var tw := fly(n, p, pond_c + Vector3(randf_range(-1, 1), -0.1, randf_range(-0.6, 0.6)), 0.6, 0.6, 10.0)
		await tw.finished
		_splash(n.global_position, false)
		n.queue_free()
		return
	got += 1
	progress()
	var c := got
	Game.note("xylophone", 64 + [0, 2, 4, 5, 7, 9][mini(c - 1, 5)])
	say(COUNT[mini(c - 1, COUNT.size() - 1)] + "!")
	var into := basket.global_position + Vector3(randf_range(-0.12, 0.12), 0.3, randf_range(-0.08, 0.08))
	var tw2 := fly(n, n.global_position, into, 0.55, 1.0, 6.0)
	await tw2.finished
	n.rotation = Vector3(0, 0, PI / 2)
	in_basket.append(n)
	if c == need:
		_cat_eats()

## Stuck: the next good fish leaps slowly, with a star over it.
func help() -> void:
	slow_next = true
	jump_t = 99.0
	say("נגעי בדג כשהוא באוויר!")

## Still stuck: a fish leaps right into the basket by itself.
func rescue() -> void:
	var a := pond_c + Vector3(0.5, -0.05, 0.3)
	var n := place_model("fish_orange", a, 0.0, 2.4)
	_splash(a, false, 0.5)
	say("דג אחד קפץ לבד לסל!")
	got += 1
	progress()
	var c := got
	var my := run
	var into := basket.global_position + Vector3(randf_range(-0.12, 0.12), 0.3, randf_range(-0.08, 0.08))
	await fly(n, a, into, 1.0, 1.8, 6.0).finished
	if not alive(my):
		n.queue_free()
		return
	n.rotation = Vector3(0, 0, PI / 2)
	in_basket.append(n)
	if c == need:
		_cat_eats()

func cleanup() -> void:
	slow_next = false
	for j in jumpers:
		if j["tap"]:
			garden.remove_tap(j["tap"])
		if j["kind"] != "frog":
			j["node"].queue_free()
	jumpers.clear()
	frog.global_position = lily.global_position + Vector3(0, 0.06, 0)
	frog.set_meta("on_head", false)
	for f in in_basket:
		f.queue_free()
	in_basket.clear()

func _frog_on_head() -> void:
	frog.set_meta("on_head", true)
	Game.play("boing")
	var l: Actor = garden.luli
	var tw := fly(frog, frog.global_position, l.global_position + Vector3(0, l.tall * 0.92, 0), 0.5, 0.8, 0.0)
	await tw.finished
	say("קוואק! הצפרדע על הראש של לולי!")
	l.feel("surprised", 1.5)
	garden.luli.jump(0.6)
	for k in 6:
		frog.global_position = l.global_position + Vector3(0, l.tall * 0.92, 0.05)
		await wait(0.3)
	l.feel("giggle", 1.5)
	await _frog_home()
	frog.set_meta("on_head", false)

func _frog_home() -> void:
	var home := lily.global_position + Vector3(0, 0.06, 0)
	var tw := fly(frog, frog.global_position, home, 0.6, 1.0, 0.0)
	await tw.finished
	frog.jump(0.6)

func _cat_eats() -> void:
	for j in jumpers.duplicate():
		if j["tap"]:
			garden.remove_tap(j["tap"])
		if j["kind"] != "frog":
			j["node"].queue_free()
		else:
			_frog_home()
	jumpers.clear()
	var my := run
	await wait(0.6)
	if not alive(my):
		return
	cat.walk_to(basket.global_position + Vector3(0.5, 0, 0.2))
	await arrive(cat)
	say("מיאו! תודה! החתול אוכל דגים!")
	Game.slide("flute", 76, [[0, 1.0], [0.25, 1.15], [0.5, 0.85]], 0.5)
	for k in 3:
		cat.jump(0.5)
		Game.play("pop", 0.6, 1.0 + k * 0.1)
		await wait(0.3)
	for f in in_basket:
		f.queue_free()
	in_basket.clear()
	cat.feel("happy", 2.5)
	await finish()
	cat.walk_to(Vector3(pond_c.x + rx + 0.9, 0, pond_c.z + 1.2))

extends Station
## The apple tree. The bear is hungry: shake the tree, apples tumble down
## (one sometimes bonks the bear on the head), tap them into the basket and
## count them out loud. From level two some apples are green and sour, and
## only the red ones go in the basket.

const COUNT := ["אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש"]

var tree: Node3D
var basket: Node3D
var bear: Actor
var crown := Vector3.ZERO
var crown_r := 1.6
var hanging: Array = []      # [Node3D, red: bool]
var fallen: Array = []       # [Node3D, red, Area3D]
var in_basket: Array[Node3D] = []
var need := 3
var got := 0
var tree_tap: Area3D
var shaking := false
var want_red := false

func setup() -> void:
	id = "apples3d"
	title = "בואי נקטוף תפוחים לדוב!"
	icon = "res://ui/apple.png"
	tree = garden.props["tree_apple"]
	var info: Dictionary = garden.layout["tree_apple"]
	var s := tree.scale.x
	crown = tree.global_position + Vector3(0, float(info["crown_y"]) * s * 0.95, 0)
	crown_r = float(info["crown_r"]) * s
	spot = tree.global_position + Vector3(1.6, 0, 2.2)
	stand = spot + Vector3(1.6, 0, 0.6)
	stand.y = garden.ground_y(stand.x, stand.z)
	var bp := tree.global_position + Vector3(2.4, 0, 1.6)
	basket = place_model("basket", Vector3(bp.x, garden.ground_y(bp.x, bp.z), bp.z), 0.3, 1.1)
	bear = friend("bear", Vector2(tree.global_position.x - 0.2, tree.global_position.z + 2.6), 1.25)
	_grow_apples(5)
	start_on(crown, crown_r)

func cam_point() -> Vector3:
	return tree.global_position.lerp(spot, 0.5) + Vector3(0, 1.7, 0)

func cam_offset() -> Vector3:
	return Vector3(0, 2.6, 8.8)

func marker_height() -> float:
	return crown.y - spot.y + crown_r + 0.6

func _grow_apples(n: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	for i in n:
		var red := not want_red or rng.randf() < 0.6
		var a := place_model("apple" if red else "apple_green", Vector3.ZERO, rng.randf() * TAU, 1.4)
		# on the front of the crown, toward the camera
		var th := rng.randf_range(-1.2, 1.2)
		var ph := rng.randf_range(-0.5, 0.6)
		var dir := Vector3(sin(th) * cos(ph), sin(ph), cos(th) * cos(ph)).normalized()
		a.global_position = crown + dir * crown_r * 1.02 - Vector3(0, 0.15, 0)
		a.scale = Vector3.ONE * 0.01
		a.create_tween().tween_property(a, "scale", Vector3.ONE * 1.9, 0.4).set_delay(i * 0.12).set_trans(Tween.TRANS_BACK)
		hanging.append([a, red])

func play() -> void:
	need = [3, 3, 4, 5][level - 1]
	want_red = level >= 2
	got = 0
	for h in hanging:
		h[0].queue_free()
	hanging.clear()
	_grow_apples(need + 2 + (2 if want_red else 0))
	if want_red:
		# make sure enough of them are red
		var reds := hanging.filter(func(h): return h[1]).size()
		var i := 0
		while reds < need + 1 and i < hanging.size():
			if not hanging[i][1]:
				var old: Node3D = hanging[i][0]
				var a := place_model("apple", old.global_position, old.rotation.y, 1.9)
				old.queue_free()
				hanging[i] = [a, true]
				reds += 1
			i += 1
	tree_tap = garden.add_tap(crown, crown_r, _shake)
	bear.feel("sad", 2.0)
	say("הדוב רעב! תני לו %s תפוחים%s. נערי את העץ!" % [COUNT[need - 1], " אדומים" if want_red else ""])

func _reds_left() -> int:
	return hanging.filter(func(h): return h[1]).size() + fallen.filter(func(e): return e[1]).size()

func _shake() -> void:
	if not active or shaking:
		return
	# never run out: if the red apples left are too few, new ones grow
	if _reds_left() < need - got:
		var keep := want_red
		want_red = false
		_grow_apples(need - got - _reds_left() + 1)
		want_red = keep
		await wait(0.5)
	if hanging.is_empty():
		return
	progress()
	shaking = true
	Game.play("swipe")
	var tw := tree.create_tween()
	for k in 6:
		tw.tween_property(tree, "rotation:z", 0.08 * (1 if k % 2 == 0 else -1) * (1.0 - k / 6.0), 0.07)
	tw.tween_property(tree, "rotation:z", 0.0, 0.1)
	await wait(0.25)
	var n := mini(2 + randi() % 2, hanging.size())
	for i in n:
		var h: Array = hanging.pop_back()
		_drop(h[0], h[1], i == 0 and randf() < 0.35)
		await wait(0.18)
	shaking = false

func _drop(a: Node3D, red: bool, bonk: bool) -> void:
	var my := run
	var from := a.global_position
	var head := bear.global_position + Vector3(0, bear.tall * 0.95, 0)
	if bonk:
		# straight onto the bear's head, and off again
		var tw := fly(a, from, head, 0.45, 0.2, 3.0)
		await tw.finished
		Game.play("boing")
		bear.feel("surprised", 1.5)
		bear.jump(0.8)
		say("אוי! על הראש של הדוב!")
		garden.luli.feel("giggle", 1.5)
		from = head
	var land := tree.global_position + Vector3(randf_range(-0.3, 2.4), 0, randf_range(1.2, 2.6))
	land.y = garden.ground_y(land.x, land.z) + 0.02
	var tw2 := fly(a, from, land, 0.5, 0.3, 5.0)
	await tw2.finished
	if not alive(my):
		a.queue_free()
		return
	Game.play("drop")
	# a little bounce
	var b := a.create_tween()
	b.tween_property(a, "position:y", land.y + 0.25, 0.12).set_ease(Tween.EASE_OUT)
	b.tween_property(a, "position:y", land.y, 0.14).set_ease(Tween.EASE_IN)
	var entry := [a, red, null]
	entry[2] = garden.add_tap(land + Vector3(0, 0.15, 0), 0.6, _pick.bind(entry))
	fallen.append(entry)

func _pick(entry: Array) -> void:
	if not active or not fallen.has(entry):
		return
	var a: Node3D = entry[0]
	if want_red and not entry[1]:
		# a sour green one: the bear pulls a face, the apple hops away
		Game.play("nope")
		bear.feel("giggle", 1.5)
		say("פיכס! ירוק וחמוץ! רק אדומים!")
		var p := a.global_position
		var away := p + Vector3(randf_range(-0.8, 0.8), 0, randf_range(0.2, 0.7))
		away.y = garden.ground_y(away.x, away.z) + 0.02
		fly(a, p, away, 0.4, 0.6, 8.0)
		garden.remove_tap(entry[2])
		entry[2] = garden.add_tap(away + Vector3(0, 0.15, 0), 0.6, _pick.bind(entry))
		return
	fallen.erase(entry)
	garden.remove_tap(entry[2])
	progress()
	var into := basket.global_position + Vector3(randf_range(-0.15, 0.15), 0.35, randf_range(-0.1, 0.1))
	var tw := fly(a, a.global_position, into, 0.5, 1.0, 4.0)
	got += 1
	var n := got
	Game.note("xylophone", 60 + [0, 2, 4, 5, 7, 9][mini(n - 1, 5)])
	say(COUNT[mini(n - 1, COUNT.size() - 1)] + "!")
	await tw.finished
	in_basket.append(a)
	if n == need:
		_eat()

## Stuck: show what to tap - an apple on the grass, or else the tree.
func help() -> void:
	var good := fallen.filter(func(e): return e[1] or not want_red)
	if not good.is_empty():
		var a: Node3D = good[0][0]
		point_at(a.global_position + Vector3(0, 0.9, 0), 6.0)
		a.create_tween().tween_property(a, "position:y", a.position.y + 0.3, 0.15).set_trans(Tween.TRANS_SINE)
		say("נגעי בתפוח%s!" % (" האדום" if want_red else ""))
	else:
		point_at(crown + Vector3(0, crown_r + 0.4, 0), 6.0)
		var tw := tree.create_tween()
		tw.tween_property(tree, "rotation:z", 0.05, 0.1)
		tw.tween_property(tree, "rotation:z", -0.05, 0.1)
		tw.tween_property(tree, "rotation:z", 0.0, 0.1)
		say("נגעי בעץ, והתפוחים ייפלו!")

## Still stuck: an apple hops into the basket by itself, or the tree shakes.
func rescue() -> void:
	var good := fallen.filter(func(e): return e[1] or not want_red)
	if not good.is_empty():
		say("התפוח קפץ לבד לסל!")
		_pick(good[0])
	else:
		_shake()

func cleanup() -> void:
	shaking = false
	if tree_tap:
		garden.remove_tap(tree_tap)
		tree_tap = null
	for e in fallen:
		garden.remove_tap(e[2])
		e[0].queue_free()
	fallen.clear()
	for a in in_basket:
		a.queue_free()
	in_basket.clear()
	tree.rotation.z = 0.0

func _eat() -> void:
	var my := run
	garden.remove_tap(tree_tap)
	tree_tap = null
	for e in fallen:
		garden.remove_tap(e[2])
		e[0].queue_free()
	fallen.clear()
	await wait(0.8)
	if not alive(my):
		return
	bear.walk_to(basket.global_position + Vector3(-0.6, 0, 0.3))
	await arrive(bear)
	say("יאמי! תודה אמי! הדוב שבע!")
	for k in 4:
		Game.play("pop", 0.7, 0.9 + k * 0.1)
		bear.jump(0.5)
		await wait(0.3)
	bear.feel("happy", 2.5)
	for a in in_basket:
		a.queue_free()
	in_basket.clear()
	finish()
	await wait(2.6)
	bear.walk_to(tree.global_position + Vector3(-0.2, 0, 2.6))

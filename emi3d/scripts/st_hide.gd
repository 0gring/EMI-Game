extends Station
## Hide and seek. The dog counts, the friends run off and hide behind the
## bushes, rocks, trees and the big mushroom; their ears stick out and they
## wriggle and giggle now and then. Emi taps a hiding place, Luli runs there
## and looks. Empty places hold a funny surprise: a bush sneezes, a frog
## jumps out from behind a rock, the big mushroom bounces Luli up. From level
## three Luli asks for one friend by name, and the wrong one ducks back.

const NAMES := {"cat": "החתול", "bunny": "הארנב", "panda": "הפנדה", "mouse": "העכבר", "pig": "החזיר", "fox": "השועל"}
const SPOTS := ["bush_a", "bush_b", "bush_c", "rock_a", "rock_b", "tree_round", "mush_big", "blossom_b"]

var dog: Actor
var home := Vector3.ZERO
var friends: Array = []           # Actor
var where := {}                   # spot name -> Actor (or null)
var spot_taps := {}               # spot name -> Area3D
var found: Array = []
var target: Actor
var hint_t := 0.0
var looking := false
var surprise_i := 0

func setup() -> void:
	id = "hide3d"
	home = Vector3(-1.5, 0, 1.0)
	home.y = garden.ground_y(home.x, home.z)
	dog = friend("dog", Vector2(home.x, home.z), 1.2)
	spot = home
	stand = home + Vector3(1.4, 0, 0.6)
	stand.y = garden.ground_y(stand.x, stand.z)

func marker_height() -> float:
	return 2.2

func play() -> void:
	var n: int = [2, 3, 3, 4][level - 1]
	var kinds := ["cat", "bunny", "panda", "mouse", "pig", "fox"]
	kinds.shuffle()
	found.clear()
	friends.clear()
	where.clear()
	var spots := SPOTS.duplicate()
	spots.shuffle()
	for i in n:
		var f := friend(kinds[i], Vector2(home.x - 1.0 + i * 0.7, home.z + 1.2), 1.05)
		friends.append(f)
	say("הכלב סופר, וכולם מתחבאים!")
	dog.feel("happy", 1.0)
	await wait(1.6)
	for i in friends.size():
		var f: Actor = friends[i]
		var sp: String = spots[i]
		where[sp] = f
		f.walk_to(_hide_pos(sp))
		f.speed = 4.5
	for k in 3:
		say(["אחת...", "שתיים...", "שלוש!"][k])
		await wait(1.1)
	for sp in SPOTS:
		if not where.has(sp):
			where[sp] = null
		var prop: Node3D = garden.props[sp]
		var r := 1.1 if sp.begins_with("bush") or sp.begins_with("rock") else 1.3
		spot_taps[sp] = garden.add_tap(prop.global_position + Vector3(0, 0.6, 0), r, _look.bind(sp))
	# the whole island in view, so every peeking ear can be seen
	garden.focus(Vector3(0, 0, -1.5), self, Vector3(0, 13.0, 13.5))
	_next_target()

func _hide_pos(sp: String) -> Vector3:
	var prop: Node3D = garden.props[sp]
	# behind it, as the camera sees it
	var back := Vector3(0, 0, -0.75 if sp.begins_with("bush") or sp.begins_with("rock") else -0.55)
	var p := prop.global_position + back
	p.y = garden.ground_y(p.x, p.z)
	return p

func _next_target() -> void:
	var left := friends.filter(func(f): return not found.has(f))
	if left.is_empty():
		_all_found()
		return
	if level >= 3:
		target = left.pick_random()
		say("איפה %s? מצאי את %s!" % [NAMES[target.species], NAMES[target.species]])
	else:
		target = null
		say("איפה החברים? מצאי אותם!" if found.is_empty() else "עוד חברים מתחבאים!")

func tap_ground(p: Vector3) -> void:
	if not looking:
		garden.luli.walk_to(garden.keep_on(p))

func _look(sp: String) -> void:
	if not active or looking:
		return
	looking = true
	var prop: Node3D = garden.props[sp]
	var near := prop.global_position + Vector3(0.9, 0, 1.1)
	garden.luli.walk_to(garden.keep_on(near))
	await garden.luli.arrived
	var f: Actor = where.get(sp)
	if f == null or found.has(f):
		await _surprise(sp)
	elif target != null and f != target:
		# the wrong friend: peeks out, giggles, ducks back
		f.jump(1.0)
		f.feel("giggle", 1.5)
		Game.play("boing")
		say("לא אני! אני %s! חפשי את %s!" % [NAMES[f.species], NAMES[target.species]])
		await wait(1.5)
	else:
		await _found(sp, f)
	looking = false

func _found(sp: String, f: Actor) -> void:
	found.append(f)
	Game.play("success")
	f.feel("happy", 2.0)
	var out: Vector3 = (garden.props[sp] as Node3D).global_position + Vector3(0.2, 0, 1.0)
	out.y = garden.ground_y(out.x, out.z)
	var tw := f.create_tween()
	tw.tween_property(f, "global_position", out + Vector3(0, 0.8, 0), 0.25).set_ease(Tween.EASE_OUT)
	tw.tween_property(f, "global_position", out, 0.25).set_ease(Tween.EASE_IN)
	garden.cheer(garden.screen_of(out + Vector3(0, 1.0, 0)))
	say("מצאת את %s!" % NAMES[f.species])
	await wait(1.4)
	f.walk_to(home + Vector3(-1.2 + found.size() * 0.6, 0, 1.0))
	_next_target()

func _surprise(sp: String) -> void:
	var prop: Node3D = garden.props[sp]
	var at: Vector2 = garden.screen_of(prop.global_position + Vector3(0, 0.8, 0))
	surprise_i += 1
	if sp.begins_with("bush"):
		# the bush sneezes
		say("אפצ'י! השיח התעטש!")
		var tw := prop.create_tween()
		tw.tween_property(prop, "scale", prop.scale * Vector3(1.2, 0.8, 1.2), 0.15)
		tw.tween_property(prop, "scale", prop.scale, 0.3).set_trans(Tween.TRANS_ELASTIC)
		Game.play("pop")
		Fx.burst(Game.fx, at, [Color("#5cbf4a"), Color("#8fd65a"), Color("#ff9fc8")], 24, 1.0)
		garden.luli.feel("surprised", 1.2)
	elif sp.begins_with("rock"):
		# a frog was sitting behind the rock
		var frog := friend("frog", Vector2(prop.global_position.x, prop.global_position.z - 0.6), 0.8)
		say("קוואק! רק צפרדע!")
		Game.play("boing")
		var p := frog.global_position
		var dest := p + Vector3(-2.5, 0, 1.0)
		dest.y = garden.ground_y(dest.x, dest.z)
		frog.jump(1.5)
		await fly(frog, p, dest, 0.7, 1.4, 0.0).finished
		frog.jump(1.0)
		await wait(0.6)
		var tw := frog.create_tween()
		tw.tween_property(frog, "scale", Vector3.ONE * 0.01, 0.3)
		await tw.finished
		frog.queue_free()
	elif sp == "mush_big":
		# boing! the mushroom bounces Luli up high
		say("בוינג! הפטרייה קופצת!")
		Game.slide("xylophone", 60, [[0, 1.0], [0.3, 2.0]])
		var l: Actor = garden.luli
		var p := l.global_position
		var tw := l.create_tween()
		tw.tween_property(l, "global_position", p + Vector3(0, 2.2, 0), 0.35).set_ease(Tween.EASE_OUT)
		tw.tween_property(l, "global_position", p, 0.35).set_ease(Tween.EASE_IN)
		l.feel("happy", 1.5)
		await tw.finished
	else:
		say("אין פה אף אחד! רק עץ.")
		var tw := prop.create_tween()
		tw.tween_property(prop, "rotation:z", 0.06, 0.1)
		tw.tween_property(prop, "rotation:z", -0.06, 0.1)
		tw.tween_property(prop, "rotation:z", 0.0, 0.1)
	await wait(1.2)

func tick(dt: float) -> void:
	if not active:
		return
	hint_t += dt
	if hint_t > 3.2:
		hint_t = 0.0
		# a hidden friend wriggles and giggles: a hint
		var hidden := friends.filter(func(f): return not found.has(f) and not f.walking())
		if not hidden.is_empty():
			var f: Actor = hidden.pick_random()
			f.jump(0.5)
			Game.note("xylophone", 72 + randi() % 8, 0.25)

func _all_found() -> void:
	for sp in spot_taps:
		garden.remove_tap(spot_taps[sp])
	spot_taps.clear()
	say("מצאת את כולם! איזו גיבורה!")
	garden.focus(home + Vector3(0, 0.4, 0), self, cam_offset())
	for f in friends:
		f.feel("happy", 2.0)
	dog.feel("happy", 2.0)
	await wait(1.0)
	await finish()
	for f in friends:
		var tw: Tween = (f as Node).create_tween()
		tw.tween_property(f, "scale", Vector3.ONE * 0.01, 0.4).set_delay(1.5)
		tw.tween_callback(f.queue_free)
	friends.clear()

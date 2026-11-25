extends RefCounted
## Play-test for the puzzle: drags pieces with simulated fingers.

var t: Node

func _ev(e: InputEvent) -> void:
	Input.parse_input_event(e)

func _win(p: Vector2) -> Vector2:
	return t.get_tree().root.get_final_transform() * p

## Presses at `from`, drags to `to` in steps, lets go - finger `idx`.
func drag(from: Vector2, to: Vector2, idx := 0, release := true) -> void:
	var d := InputEventScreenTouch.new()
	d.index = idx
	d.position = _win(from)
	d.pressed = true
	_ev(d)
	await t.get_tree().process_frame
	var steps := 8
	for i in steps:
		var m := InputEventScreenDrag.new()
		m.index = idx
		m.position = _win(from.lerp(to, float(i + 1) / steps))
		_ev(m)
		await t.get_tree().process_frame
	if release:
		var u := InputEventScreenTouch.new()
		u.index = idx
		u.position = _win(to)
		u.pressed = false
		_ev(u)
		await t.get_tree().process_frame

func lift_up(at: Vector2, idx: int) -> void:
	var u := InputEventScreenTouch.new()
	u.index = idx
	u.position = _win(at)
	u.pressed = false
	_ev(u)
	await t.get_tree().process_frame

func run(tt: Node) -> bool:
	t = tt
	print("puzzle")
	t.get_tree().change_scene_to_file("res://scenes/puzzle.tscn")
	await t.wait(0.5)
	var s: Node = t.get_tree().current_scene
	for k in 100:
		if s.ready_to_play:
			break
		await t.wait(0.1)
	t.check(s.ready_to_play, "the picture is painted, cut up and scattered")
	t.check(s.pieces.size() == s.grid.x * s.grid.y and s.pieces.size() >= 4, "%d pieces for a %dx%d grid" % [s.pieces.size(), s.grid.x, s.grid.y])
	await t.shot("puzzle-1-start")

	# a drop far from its place just stays there
	var p = s.pieces[0]
	var away: Vector2 = s.tray.get_center() + Vector2(0, s.tray.size.y * 0.3)
	await drag(p.position, away)
	await t.wait(0.4)
	t.check(not p.placed and p.position.distance_to(away) < 40.0, "a piece dropped far away stays where it was put")

	# two hands at once: two pieces carried together, both snap in
	var a = s.pieces[1]
	var b = s.pieces[2]
	var a_from: Vector2 = a.position
	var b_from: Vector2 = b.position
	var a_to: Vector2 = a.home + Vector2(12, -10)
	var b_to: Vector2 = b.home + Vector2(-10, 14)
	var da := InputEventScreenTouch.new()
	da.index = 0
	da.position = _win(a_from)
	da.pressed = true
	_ev(da)
	var db := InputEventScreenTouch.new()
	db.index = 1
	db.position = _win(b_from)
	db.pressed = true
	_ev(db)
	await t.get_tree().process_frame
	for i in 8:
		for pair in [[0, a_from, a_to], [1, b_from, b_to]]:
			var m := InputEventScreenDrag.new()
			m.index = pair[0]
			m.position = _win((pair[1] as Vector2).lerp(pair[2], (i + 1) / 8.0))
			_ev(m)
		await t.get_tree().process_frame
	await t.shot("puzzle-2-two-hands")
	await lift_up(a_to, 0)
	await lift_up(b_to, 1)
	await t.wait(0.5)
	t.check(a.placed and b.placed, "two pieces carried by two fingers both snap in")

	# the rest: press on a loose piece, then carry whichever piece the finger
	# picked up (tray pieces may overlap) to roughly its place
	var stars0: int = Game.stars
	var half_shot := false
	for k in 40:
		var loose = s.pieces.filter(func(x): return not x.placed)
		if loose.is_empty():
			break
		var at: Vector2 = loose[loose.size() - 1].position
		var d := InputEventScreenTouch.new()
		d.index = 0
		d.position = _win(at)
		d.pressed = true
		_ev(d)
		await t.get_tree().process_frame
		var got = s.held.get(0)
		if got == null:
			await lift_up(at, 0)
			continue
		var to: Vector2 = got.home + Vector2(randf_range(-30, 30), randf_range(-30, 30))
		for i in 8:
			var m := InputEventScreenDrag.new()
			m.index = 0
			m.position = _win(at.lerp(to, (i + 1) / 8.0))
			_ev(m)
			await t.get_tree().process_frame
		await lift_up(to, 0)
		await t.wait(0.15)
		if not half_shot and s.pieces.filter(func(x): return x.placed).size() * 2 >= s.pieces.size():
			half_shot = true
			await t.shot("puzzle-3-half")
	t.check(s.pieces.all(func(x): return x.placed), "every piece in its place")
	await t.wait(1.4)
	t.check(s.complete and s.live.size() >= 1, "the picture comes alive with %d friend(s)" % s.live.size())
	await t.shot("puzzle-4-alive")
	await t.wait(1.0)
	t.check(Game.stars > stars0, "a finished puzzle awards stars (%d -> %d)" % [stars0, Game.stars])
	await t.shot("puzzle-5-party")
	await t.wait(7.0)
	t.check(not s.complete and s.pieces.size() >= 4, "a new puzzle comes next")
	await t.shot("puzzle-6-next")
	# reaching here is how the runner knows the test was not cut short
	return true

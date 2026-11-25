extends RefCounted
## Play-test for the bakery: bakes a whole cake with simulated touches.

func _until(t: Node, cond: Callable, secs: float) -> bool:
	var left := secs
	while left > 0.0:
		if cond.call():
			return true
		await t.wait(0.1)
		left -= 0.1
	return cond.call()

## A finger that lands on `a`, slides to `b` and lets go there.
func _drag(t: Node, a: Vector2, b: Vector2) -> void:
	var xf: Transform2D = t.get_tree().root.get_final_transform()
	var down := InputEventScreenTouch.new()
	down.position = xf * a
	down.pressed = true
	Input.parse_input_event(down)
	await t.get_tree().process_frame
	for k in 8:
		var mv := InputEventScreenDrag.new()
		var p := a.lerp(b, (k + 1) / 8.0)
		mv.position = xf * p
		mv.relative = xf.basis_xform((b - a) / 8.0)
		Input.parse_input_event(mv)
		await t.get_tree().process_frame
	var up := InputEventScreenTouch.new()
	up.position = xf * b
	up.pressed = false
	Input.parse_input_event(up)
	await t.get_tree().process_frame

func run(t: Node) -> bool:
	print("cake")
	t.get_tree().change_scene_to_file("res://scenes/cake.tscn")
	await t.wait(1.2)
	var s: Node = t.scene()
	var stars0: int = Game.stars
	t.check(s.state == "sponge" and s.buttons.size() == 3, "three sponges to choose from")
	await t.shot("cake-1-sponge")
	await t.touch(s.buttons[1]["pos"])
	t.check(await _until(t, func(): return s.state == "icing", 6.0), "the tiers drop in and icing is offered")
	t.check(s.tiers.size() == s.tune["tiers"], "%d tier(s) on the stand" % s.tiers.size())
	await t.wait(0.8)
	await t.shot("cake-2-icing-choice")
	# poking the cake makes it wobble and never breaks the flow
	await t.touch(s.cake_root.position + Vector2(0, -60))
	await t.wait(0.2)
	await t.touch(s.buttons[1]["pos"])
	await t.wait(1.2)
	await t.shot("cake-3-pour")
	t.check(await _until(t, func(): return s.state == "decorate", 6.0), "the icing pours and decorating starts")
	await t.wait(0.8)
	await t.shot("cake-4-decorate")
	# one topping dragged onto an exact spot, the rest tapped
	var before: int = s.placed
	var top: Dictionary = s.tiers[0]
	var dest: Vector2 = s.cake_root.position + top["node"].position + Vector2(top["w"] * 0.2, -120.0 * top["sy"])
	await _drag(t, s.buttons[0]["pos"], dest)
	await t.wait(0.9)
	t.check(s.placed == before + 1, "a dragged topping lands on the cake")
	var need: int = s.tune["need"]
	var k := 0
	while s.state == "decorate" and k < 30:
		await t.touch(s.buttons[k % s.buttons.size()]["pos"])
		await t.wait(0.7)
		k += 1
	await t.shot("cake-5-decorated")
	t.check(s.placed >= need, "placed %d toppings (needed %d)" % [s.placed, need])
	t.check(await _until(t, func(): return s.state == "blow", 6.0), "the candles light")
	await t.shot("cake-6-candles")
	var blows := 0
	while s.state == "blow" and blows < 10:
		for c in s.candles:
			if c["lit"]:
				await t.touch(s._flame_pos(c))
				await t.wait(0.3)
				break
		await t.wait(0.7)
		blows += 1
	t.check(s.state == "party", "blowing out the candles starts the party")
	await t.wait(1.5)
	await t.shot("cake-7-party")
	t.check(Game.stars > stars0, "a finished cake awards stars (%d -> %d)" % [stars0, Game.stars])
	t.check(await _until(t, func(): return s.state == "sponge", 16.0), "a fresh cake is ready afterwards")
	# reaching here is how the runner knows the test was not cut short
	return true

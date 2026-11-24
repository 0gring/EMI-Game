extends Node
## Plays the game with simulated fingers and checks it behaves:
##   godot --headless --path godot -- --autotest
## An autoload, so it survives the scene changes it drives; without the flag
## it does nothing at all.
## Exits 0 when every check passes, 1 otherwise.

var failures := 0

func check(ok: bool, what: String) -> void:
	print(("  ok   " if ok else "  FAIL ") + what)
	if not ok:
		failures += 1

func touch(p: Vector2) -> void:
	# events arrive in window pixels; the game works in its stretched 1920x1080
	p = get_tree().root.get_final_transform() * p
	var down := InputEventScreenTouch.new()
	down.position = p
	down.pressed = true
	Input.parse_input_event(down)
	await get_tree().process_frame
	var up := InputEventScreenTouch.new()
	up.position = p
	up.pressed = false
	Input.parse_input_event(up)
	await get_tree().process_frame

## With --shots=DIR (and a real renderer), saves a picture of the moment.
func shot(name: String) -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="):
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("%s/%s.png" % [a.substr(8), name])

func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func scene() -> Node:
	return get_tree().current_scene

func _ready() -> void:
	if not "--autotest" in OS.get_cmdline_user_args():
		return
	Game.muted = false
	await wait(0.5)
	await test_hub()
	await test_colorpop()
	await test_feed()
	print("%s - %d failure(s)" % ["PASS" if failures == 0 else "FAIL", failures])
	get_tree().quit(1 if failures else 0)

func test_hub() -> void:
	print("hub")
	get_tree().change_scene_to_file("res://scenes/hub.tscn")
	await wait(1.5)
	var hub := scene()
	await wait(1.0)
	await shot("1-hub")
	check(hub.portals.size() == 2, "two places to go")
	await touch(hub.portals[0]["pos"])
	await wait(2.6)
	check(scene().name == "colorpop", "touching the balloons opens the balloon game (got %s)" % scene().name)

func test_colorpop() -> void:
	print("colour balloons")
	if scene().name != "colorpop":
		get_tree().change_scene_to_file("res://scenes/colorpop.tscn")
		await wait(1.5)
	var s := scene()
	var stars0 := Game.stars
	# a wrong colour giggles and does not count
	var other = null
	for k in 250:
		for b in s.balloons:
			if b.state == "rise" and b.col != s.target and b.position.y < s.size.y * 0.8 and b.position.y > s.size.y * 0.25 and not b.rainbow:
				# only one with no other balloon near it, so the tap is unambiguous
				var alone := true
				for o in s.balloons:
					if o != b and o.state == "rise" and o.position.distance_to(b.position) < b.r * 1.7:
						alone = false
				if alone:
					other = b
		if other:
			break
		await wait(0.1)
	check(other != null, "a balloon of another colour came up")
	if other:
		await touch(other.position)
		check(other.state == "tickle" and s.popped == 0, "another colour giggles instead of counting")
		await wait(0.3)
		await shot("2-tickle")
	var shot_taken := false
	for k in 400:
		if s.round_done:
			break
		if s.popped >= 2 and not shot_taken:
			shot_taken = true
			await wait(0.5)
			await shot("3-parachute")
		for b in s.balloons:
			if b.state == "rise" and (b.col == s.target or b.rainbow) and b.position.y < s.size.y * 0.9:
				await touch(b.position)
				break
		await wait(0.05)
	check(s.round_done, "a round of the called colour finishes")
	await wait(1.0)
	await shot("4-fireworks")
	check(Game.stars > stars0, "finishing the round awards stars (%d -> %d)" % [stars0, Game.stars])
	await wait(3.5)
	check(not s.round_done and s.popped == 0, "a new colour is called afterwards")

func test_feed() -> void:
	print("hungry animals")
	get_tree().change_scene_to_file("res://scenes/feed.tscn")
	await wait(0.5)
	var s := scene()
	var first: String = s.diner.species
	for k in 60:
		if s.thought.modulate.a >= 0.95:
			break
		await wait(0.1)
	check(s.thought.modulate.a >= 0.95, "the animal asks for food")
	var want: int = s.want
	var stars0 := Game.stars
	await shot("5-feed")
	for i in want:
		await touch(s.foods[0].position)
		if i == 0:
			await wait(0.3)
			await shot("6-food-flying")
		await wait(0.15)
	await wait(1.0)
	check(s.fed == want and s.full, "fed exactly %d, counted %d" % [want, s.fed])
	var left: int = s.foods.size()
	await touch(s.foods[0].position)
	await wait(0.2)
	check(s.foods.size() == left and s.fed == want, "a full animal takes no more")
	await wait(0.9)
	await shot("7-burp")
	await wait(1.3)
	await shot("8-thanks")
	check(Game.stars > stars0, "a fed animal awards a star")
	await wait(3.5)
	check(s.diner.species != first or s.fed == 0, "the next animal hops in")

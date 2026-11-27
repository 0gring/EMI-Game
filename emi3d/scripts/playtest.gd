extends Node
## Plays the garden by itself (run with `-- --autotest`): every station from
## start to star, as a child would, tapping things through the same handlers.
## Prints PASS or FAIL; with --shots=DIR saves pictures along the way.

var garden: Garden
var shots := ""
var failures := 0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="):
			shots = a.substr(8)
	Game.stars = 0
	Game.levels = {}
	run.call_deferred()

func shot(name: String) -> void:
	if shots == "":
		return
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, name])

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		failures += 1

func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func station(id: String) -> Station:
	for s in garden.station_list:
		if s.id == id:
			return s
	return null

func until(cond: Callable, limit := 20.0) -> bool:
	var t := 0.0
	while not cond.call() and t < limit:
		await get_tree().process_frame
		t += get_process_delta_time()
	return cond.call()

func run() -> void:
	await wait(2.0)
	for s in garden.station_list:
		s.level = 1
	await shot("0-garden")
	# walking: tap the lawn to the left
	var before := garden.luli.global_position
	var lawn := Vector3(3.0, 0, 6.0)
	lawn.y = garden.ground_y(lawn.x, lawn.z)
	garden.tap_screen(garden.screen_of(lawn))
	await wait(1.5)
	check(garden.luli.global_position.distance_to(before) > 0.5, "Luli walks where the lawn is tapped")
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = a.substr(7)
	for lv in [1, 2]:
		if only in ["", "apples"]:
			await apples(lv)
		if only in ["", "pond"]:
			await pond(lv)
		if only in ["", "hide"]:
			await hide(lv)
	if only in ["", "hide"]:
		await hide(3)
	if only == "":
		check(Game.stars >= 7, "stars collected: %d" % Game.stars)
	print("PASS" if failures == 0 else "FAIL - %d failure(s)" % failures)
	get_tree().quit()

func apples(lv: int) -> void:
	var st := station("apples3d") as Node
	var stars0 := Game.stars
	st.begin()
	await until(func(): return st.tree_tap != null and garden.taps.any(func(t): return t[0] == st.tree_tap), 15.0)
	await wait(0.5)
	await shot("apples-%d-start" % lv)
	var guard := 0
	while st.got < st.need and guard < 40:
		guard += 1
		if st.fallen.is_empty():
			st._shake()
			await wait(1.6)
			if guard == 2:
				await shot("apples-%d-fallen" % lv)
			continue
		var e: Array = st.fallen[0]
		var red: bool = e[1]
		if st.want_red and not red:
			# a green one: tap it once to see the face, then skip it
			if not e.has("tried"):
				st._pick(e)
				e.append("tried")
				await wait(0.6)
			st.fallen.erase(e)
			st.fallen.append(e)
			if st.fallen.all(func(f): return f.has("tried")):
				st._shake()
				await wait(1.6)
			continue
		st._pick(e)
		await wait(0.7)
	check(st.got == st.need, "apples level %d: %d of %d in the basket" % [lv, st.got, st.need])
	await shot("apples-%d-done" % lv)
	await until(func(): return not st.active, 15.0)
	check(Game.stars == stars0 + 1, "apples level %d gives a star" % lv)

func pond(lv: int) -> void:
	var st := station("pond3d") as Node
	var stars0 := Game.stars
	st.begin()
	await until(func(): return not st.jumpers.is_empty(), 20.0)
	await wait(0.4)
	await shot("pond-%d-leap" % lv)
	var guard := 0.0
	while st.got < st.need and guard < 60.0:
		guard += 0.1
		for j in st.jumpers.duplicate():
			if j["t"] > 0.3 and j["tap"] != null:
				if j["kind"] == "fish_blue" and st.only_orange and randf() < 0.7:
					continue
				st._catch(j)
				break
		await wait(0.1)
	check(st.got == st.need, "pond level %d: %d of %d fish" % [lv, st.got, st.need])
	await until(func(): return not st.active, 15.0)
	check(Game.stars == stars0 + 1, "pond level %d gives a star" % lv)

func hide(lv: int) -> void:
	var st := station("hide3d") as Node
	var stars0 := Game.stars
	st.begin()
	await until(func(): return not st.spot_taps.is_empty(), 20.0)
	await wait(0.5)
	await shot("hide-%d-hidden" % lv)
	# look in an empty place first, for the surprise
	for sp in st.SPOTS:
		if st.where.get(sp) == null:
			st._look(sp)
			await until(func(): return not st.looking, 10.0)
			await shot("hide-%d-surprise" % lv)
			break
	var guard := 0
	while st.found.size() < st.friends.size() and guard < 20:
		guard += 1
		for sp in st.SPOTS:
			var f = st.where.get(sp)
			if f != null and not st.found.has(f) and (st.target == null or st.target == f):
				st._look(sp)
				await until(func(): return not st.looking, 10.0)
				break
		await wait(0.3)
	check(st.found.size() == st.friends.size() or not st.active, "hide level %d: everyone found" % lv)
	await until(func(): return not st.active, 15.0)
	check(Game.stars == stars0 + 1, "hide level %d gives a star" % lv)

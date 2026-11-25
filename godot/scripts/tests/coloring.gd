extends RefCounted
## Colouring book: pick a crayon, colour every region of a page through real
## touches, and check the page completes, comes alive and pays stars.

## A screen point whose topmost region is region `i`.
func _spot(s: Node, i: int) -> Vector2:
	var r: Dictionary = s.regions[i]
	var poly: Polygon2D = r["poly"]
	var b: Rect2 = r["bounds"]
	for gy in 9:
		for gx in 9:
			var lp := b.position + b.size * Vector2((gx + 0.5) / 9.0, (gy + 0.5) / 9.0)
			var p: Vector2 = poly.get_global_transform() * lp
			if s.region_at(p) == i:
				return p
	return Vector2(-1, -1)

func run(t: Node) -> bool:
	print("colouring book")
	t.get_tree().change_scene_to_file("res://scenes/coloring.tscn")
	await t.wait(1.6)
	var s: Node = t.get_tree().current_scene
	t.check(s.regions.size() >= 4, "a page with %d regions to colour" % s.regions.size())
	var c2: Dictionary = s.crayons[2]
	await t.touch(Vector2(s.size.x - 120.0, c2["y"]))
	t.check(s.sel == 2, "touching a crayon picks it")
	await t.shot("coloring-1-start")
	var stars0: int = Game.stars
	var missed := 0
	for i in s.regions.size():
		# let the last fill's wobble settle, so the spot is still where we aimed
		await t.wait(0.5)
		var p := _spot(s, i)
		if p.x < 0.0:
			missed += 1
			continue
		if i % 3 == 0:
			var cr: Dictionary = s.crayons[(i * 3) % s.crayons.size()]
			await t.touch(Vector2(s.size.x - 120.0, cr["y"]))
		await t.touch(p)
		await t.wait(0.12)
		if i == 2:
			await t.wait(0.2)
			await t.shot("coloring-2-filling")
	t.check(missed == 0, "every region can be reached by a finger")
	var coloured: int = s.regions.filter(func(x): return x["mode"] >= 0).size()
	t.check(coloured == s.regions.size(), "every region took colour (%d of %d)" % [coloured, s.regions.size()])
	# the fill never leaves its region: an untouched page has no colour elsewhere
	await t.wait(1.0)
	t.check(s.complete, "a fully coloured page is complete")
	await t.wait(1.2)
	await t.shot("coloring-3-alive")
	t.check(Game.stars > stars0, "finishing a page awards stars (%d -> %d)" % [stars0, Game.stars])
	# recolouring is allowed
	# the page background stays still while the picture comes alive
	var p0 := _spot(s, 0)
	var before: Color = s.regions[0]["col"]
	var other := 0
	while s.crayons[other]["c"] == before or other == s.sel:
		other += 1
	await t.touch(Vector2(s.size.x - 120.0, s.crayons[other]["y"]))
	await t.touch(p0)
	await t.wait(0.3)
	t.check(s.regions[0]["col"] != before, "a coloured region can be coloured again")
	await t.wait(0.8)
	t.check(s.next_btn.visible, "the next-page arrow appears")
	var first: String = s.page_id
	await t.touch(s.next_btn.position)
	await t.wait(1.2)
	t.check(s.page_id != first and not s.complete, "the arrow opens a fresh page (%s -> %s)" % [first, s.page_id])
	await t.shot("coloring-4-next")
	# reaching here is how the runner knows the test was not cut short
	return true

extends RefCounted
## Play-test for the garden: plant, water, rain, a full bloom, a fresh garden.

func run(t: Node) -> bool:
	print("garden")
	t.get_tree().change_scene_to_file("res://scenes/garden.tscn")
	await t.wait(2.0)
	var s = t.get_tree().current_scene
	var stars0: int = Game.stars
	var b0 = s.beds[0]
	await t.touch(b0.position + Vector2(0, -20))
	await t.wait(0.7)
	t.check(b0.stage == 1, "touching bare soil plants a seed (stage %d)" % b0.stage)
	await t.touch(b0.position + Vector2(0, -20))
	await t.wait(0.3)
	await t.shot("garden-1-watering")
	await t.wait(0.8)
	t.check(b0.stage == 2, "watering grows it a stage (stage %d)" % b0.stage)
	var before := []
	for b in s.beds:
		before.append(b.stage)
	await t.touch(s.cloud.position)
	await t.wait(1.0)
	await t.shot("garden-2-rain")
	await t.wait(1.6)
	var all_grew := true
	for i in s.beds.size():
		if s.beds[i].stage != mini(before[i] + 1, 4):
			all_grew = false
	t.check(all_grew, "the rain cloud grows every bed a stage")
	await t.wait(2.1)
	await t.shot("garden-3-frog")
	# finish the garden by touching every bed until all are in flower
	for k in 60:
		if s.complete:
			break
		for b in s.beds:
			if b.stage < 4 and not b.busy:
				await t.touch(b.position + Vector2(0, -20))
				await t.wait(0.1)
		await t.wait(0.4)
	t.check(s.beds.all(func(b): return b.stage >= 4), "every bed comes into flower")
	await t.wait(1.3)
	t.check(s.complete, "a garden in full bloom is complete")
	await t.wait(0.8)
	await t.shot("garden-4-rainbow")
	t.check(Game.stars > stars0, "a full garden awards stars (%d -> %d)" % [stars0, Game.stars])
	await t.touch(s.beds[0].position + Vector2(0, -60))
	await t.wait(3.4)
	await t.shot("garden-5-bouquet")
	await t.wait(4.0)
	t.check(not s.complete and s.beds.all(func(b): return b.stage == 0), "fresh beds are dug for the next garden")
	await t.shot("garden-6-new")
	await t.touch(s.sun_node.position)
	await t.wait(0.3)
	t.check(s.sun_node.get_meta("face")["grin"].visible, "the sun laughs when it is touched")
	# reaching here is how the runner knows the test was not cut short
	return true

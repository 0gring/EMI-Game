extends RefCounted
## Play-test for the memory game: the peek, a mismatch that turns back on its
## own, a third card that turns a mismatch back at once, and a whole board.

func run(t: Node) -> bool:
	print("memory")
	t.get_tree().change_scene_to_file("res://scenes/memory.tscn")
	await t.wait(0.6)
	var s = t.get_tree().current_scene
	await t.wait(1.2)
	t.check(s.cards.size() == 4, "level one deals four cards (%d)" % s.cards.size())
	t.check(s.cards.all(func(c): return c.up), "the board opens with a peek, every card face up")
	await t.shot("memory-1-peek")
	for k in 80:
		if not s.locked:
			break
		await t.wait(0.1)
	t.check(not s.locked and s.cards.all(func(c): return not c.up), "after the peek every card turns back")
	await t.wait(0.5)
	await t.shot("memory-2-board")
	# a mismatch: two different animals
	var a = s.cards[0]
	var b = null
	for c in s.cards:
		if c.sp != a.sp:
			b = c
			break
	await t.touch(a.global_position)
	await t.touch(b.global_position)
	await t.wait(0.9)
	await t.shot("memory-3-raspberry")
	t.check(a.up and b.up, "both cards of a mismatch turn up")
	await t.wait(1.4)
	t.check(not a.up and not b.up and s.open.is_empty(), "a mismatch turns back on its own")
	# a third card turns a showing mismatch back at once
	await t.touch(a.global_position)
	await t.touch(b.global_position)
	var third = null
	for c in s.cards:
		if c != a and c != b:
			third = c
			break
	await t.touch(third.global_position)
	t.check(not a.up and not b.up and third.up and s.open.size() == 1, "a third card turns the mismatch back straight away")
	await t.wait(0.6)
	# finish the board: open each pair
	var stars0: int = Game.stars
	await t.touch(third.global_position)  # already up: just plays, must not break anything
	s.open.clear()
	third.flip(false)
	await t.wait(0.5)
	var shot_pair := false
	for c in s.cards:
		if c.matched:
			continue
		for d in s.cards:
			if d != c and d.sp == c.sp and not d.matched:
				await t.touch(c.global_position)
				await t.touch(d.global_position)
				if not shot_pair:
					shot_pair = true
					await t.wait(1.4)
					await t.shot("memory-4-pair-dance")
				await t.wait(0.4)
				break
	t.check(s.cards.all(func(c): return c.matched), "every pair can be found")
	await t.wait(3.6)
	await t.shot("memory-5-parade")
	t.check(s.board_done, "a finished board starts the parade")
	t.check(s.cards.all(func(c): return c.out), "every animal is out of its card for the parade")
	t.check(Game.stars > stars0, "pairs and the board award stars (%d -> %d)" % [stars0, Game.stars])
	await t.wait(5.5)
	t.check(not s.board_done and s.cards.size() == 4 and s.locked, "a new board is dealt with a fresh peek")
	t.check(s.actors.is_empty(), "every animal went home")
	# reaching here is how the runner knows the test was not cut short
	return true

extends Node2D
## Every character side by side, for checking the art.

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Color("#bfe6ff")
	bg.size = Vector2(1920, 1080)
	add_child(bg)
	var names := Creature.SPECIES.keys()
	for i in names.size():
		var c := Creature.new()
		c.species = names[i]
		c.height = 380.0
		c.position = Vector2(170 + (i % 5) * 395, 480 + (i / 5) * 520)
		add_child(c)
		if i % 3 == 1:
			c.feel("happy", 99)
		if i % 3 == 2:
			c.feel("giggle", 99)
	Shot.maybe(self)

class_name Activity
extends Node2D
## Base for every place on the island: the living world behind it, the HUD,
## Luli the unicorn who keeps her company, talks and cheers, the four levels,
## and the rewards - a glowing burst for a small win, fireworks for a big one.
##
## The rule from the first game still holds: a level raises how much there is
## to do, never how hard it is to succeed, and nothing can be failed.

var id := ""
var hue := Color("#ff5fa2")
var goals := [3, 3, 4, 4]
var level := 1
var done := 0
var world: World
var hud: Hud
var luli: Creature
var fx: Node2D
var bubble: Node2D
var bubble_label: Label
var bubble_t := 0.0
var size := Vector2(1920, 1080)
var idle := 0.0
var banner: Label

## Scenes override these.
func mood() -> Dictionary:
	return {}

func clear_rects() -> Array[Rect2]:
	return []

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.1, size.y * 0.93)

func build() -> void:
	pass

## Where Luli's speech bubble sits; top-left corner of the bubble.
func bubble_spot() -> Vector2:
	return luli.position + Vector2(luli.height * 0.55, -luli.height * 1.2)

func _ready() -> void:
	size = get_viewport_rect().size
	level = Game.level_of(id) if id != "" else 1
	world = World.new()
	add_child(world)
	world.setup(mood(), clear_rects(), 0.8)
	build()
	# Luli is painted (generated art cut into pieces), not drawn - see puppet.gd
	luli = Puppet.new()
	luli.species = "unicorn"
	luli.height = size.y * 0.3
	luli.position = luli_spot()
	luli.z_index = 8
	add_child(luli)
	_build_bubble()
	fx = Node2D.new()
	fx.z_index = 20
	add_child(fx)
	hud = Hud.new()
	hud.hue = hue
	hud.show_home = id != ""
	hud.level = level
	hud.home.connect(func(): Game.go("res://scenes/hub.tscn", hud._home_pos()))
	add_child(hud)
	banner = Label.new()
	banner.add_theme_font_size_override("font_size", 120)
	banner.add_theme_color_override("font_color", hue)
	banner.add_theme_color_override("font_outline_color", Color.WHITE)
	banner.add_theme_constant_override("outline_size", 36)
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.size = Vector2(size.x, 200)
	banner.position = Vector2(0, size.y * 0.3)
	banner.pivot_offset = banner.size / 2
	banner.modulate.a = 0.0
	banner.z_index = 30
	add_child(banner)
	Game.music("play" if id != "" else "island")

func _process(dt: float) -> void:
	idle = 0.0 if Game.last_touch.size() > 0 else idle + dt
	if bubble_t > 0.0:
		bubble_t -= dt
		bubble.modulate.a = clampf(bubble_t * 3.0, 0.0, 1.0)
		bubble.position = bubble_spot()
		bubble.position.x = clampf(bubble.position.x, 20, size.x - bubble_label.size.x - 40)
	if hud:
		hud.progress = float(done) / goals[level - 1]

# --- Luli talks ------------------------------------------------------------------------

func _build_bubble() -> void:
	bubble = Node2D.new()
	bubble.z_index = 25
	bubble.modulate.a = 0.0
	add_child(bubble)
	bubble_label = Label.new()
	bubble_label.add_theme_font_size_override("font_size", 52)
	bubble_label.add_theme_color_override("font_color", Color("#4a3560"))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.96)
	sb.set_corner_radius_all(40)
	sb.content_margin_left = 34
	sb.content_margin_right = 34
	sb.content_margin_top = 14
	sb.content_margin_bottom = 18
	sb.shadow_color = Color(0.3, 0.15, 0.4, 0.25)
	sb.shadow_size = 10
	sb.shadow_offset = Vector2(0, 6)
	bubble_label.add_theme_stylebox_override("normal", sb)
	bubble.add_child(bubble_label)

## Luli says it out loud, mouths it, and shows it in a bubble for the grown-up.
func say(text: String) -> void:
	var secs := Game.speak(text)
	luli.talk(secs)
	bubble_label.text = text
	bubble_label.reset_size()
	bubble_t = secs + 1.4

# --- rewards and levels -------------------------------------------------------------------

func reward(pos: Vector2, stars := 1, big := false, colors: Array = Fx.RAINBOW) -> void:
	Fx.burst(fx, pos, colors, 40 if big else 26, 1.3 if big else 0.8)
	Fx.confetti(fx, pos, colors, 50 if big else 22, 1.0 if big else 0.6)
	Game.add_stars(stars)
	for i in stars:
		get_tree().create_timer(i * 0.12).timeout.connect(hud.fly_star.bind(pos))
	Game.play("success" if not big else "fanfare", 0.8)
	Game.arp("xylophone", ["C6", "E6", "G6", "C7"], 0.06, 0.45)
	if big:
		Fx.fireworks(fx, 4)
		luli.celebrate()
	else:
		luli.feel("happy", 1.0)
		luli.jump(0.5)

## Counts one finished round toward the level. A full level is the biggest
## party in the game.
func score(n := 1) -> void:
	done += n
	if done < goals[level - 1]:
		return
	done = 0
	var top := level >= 4
	if not top:
		level += 1
		Game.set_level(id, level)
	hud.level = level
	Fx.fireworks(fx, 9)
	Game.play("levelup", 0.9)
	Game.arp("harp", ["C5", "E5", "G5", "C6", "E6", "G6", "C7"], 0.07, 0.55)
	luli.celebrate()
	banner.text = "אלופה!" if top else "שלב %d!" % level
	var tw := create_tween()
	banner.scale = Vector2(0.3, 0.3)
	tw.tween_property(banner, "modulate:a", 1.0, 0.2)
	tw.parallel().tween_property(banner, "scale", Vector2.ONE, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(1.8)
	tw.tween_property(banner, "modulate:a", 0.0, 0.4)
	say("כל הכבוד! עלית שלב!" if not top else "את אלופה!")
	on_level_up()

func on_level_up() -> void:
	pass

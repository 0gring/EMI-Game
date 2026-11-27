class_name Station
extends Node3D
## One game on the island. It shows a bobbing star where it is; tapping the
## star (or the station's own things) brings Luli over and starts the game.
## A game ends with finish(): a star for Emi, a cheer, back to roaming.

var garden: Garden
var id := ""
var spot := Vector3.ZERO        # where the game happens
var stand := Vector3.ZERO       # where Luli stands to play
var active := false
var marker: Node3D
var marker_tap: Area3D
var t := 0.0
var level := 1

func _ready() -> void:
	setup()
	level = Game.level_of(id)
	_make_marker()

## Overridden: build the station's things and set spot / stand.
func setup() -> void:
	pass

## Overridden: the game itself.
func play() -> void:
	pass

func _make_marker() -> void:
	marker = Node3D.new()
	add_child(marker)
	var star := Sprite3D.new()
	star.texture = load("res://art/star5.svg")
	star.pixel_size = 0.0022
	star.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	star.shaded = false
	star.modulate = Color("#ffd84a")
	star.no_depth_test = false
	marker.add_child(star)
	var glow := Sprite3D.new()
	glow.texture = load("res://art/glow.svg")
	glow.pixel_size = 0.006
	glow.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	glow.shaded = false
	glow.modulate = Color(1, 0.95, 0.6, 0.55)
	glow.transparency = 0.0
	marker.add_child(glow)
	marker.global_position = spot + Vector3(0, marker_height(), 0)
	marker_tap = garden.add_tap(marker.global_position, 0.9, begin)

func marker_height() -> float:
	return 3.2

func _process(dt: float) -> void:
	t += dt
	if marker and marker.visible:
		marker.global_position.y = spot.y + marker_height() + sin(t * 2.5) * 0.15
		marker.rotation.y = t * 1.5
	tick(dt)

## Where the camera looks during the game, and from how far.
func cam_point() -> Vector3:
	return spot + Vector3(0, 0.4, 0)

func cam_offset() -> Vector3:
	return Vector3(0, 4.2, 6.6)

## Overridden: per-frame work while it runs.
func tick(_dt: float) -> void:
	pass

## Luli walks over, the camera comes closer, the game starts.
func begin() -> void:
	if active or garden.busy:
		return
	active = true
	garden.busy = true
	marker.visible = false
	Game.play("start")
	garden.focus(cam_point(), self, cam_offset())
	garden.luli.walk_to(stand)
	await garden.luli.arrived
	garden.luli.face((spot - stand).dot(garden.cam.global_transform.basis.x))
	play()

func finish() -> void:
	garden.add_star(1)
	garden.cheer(garden.screen_of(spot + Vector3(0, 1.5, 0)))
	Game.set_level(id, mini(level + 1, 4))
	level = Game.level_of(id)
	garden.luli.feel("happy", 2.0)
	garden.luli.jump(1.2)
	await get_tree().create_timer(2.5).timeout
	active = false
	garden.busy = false
	garden.focus(Vector3.INF, null)
	marker.visible = true

func say(text: String) -> void:
	garden.say(text)

func wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout

func place_model(name: String, at: Vector3, rot := 0.0, scl := 1.0) -> Node3D:
	var n: Node3D = garden.model(name)
	n.position = at
	n.rotation.y = rot
	n.scale = Vector3.ONE * scl
	garden.add_child(n)
	return n

func friend(species: String, at: Vector2, tall := 1.15) -> Actor:
	var a := Actor.new()
	a.species = species
	a.tall = tall
	a.ground = garden.ground_y
	if species != "frog":
		a.bounds = garden.keep_on
	garden.add_child(a)
	a.global_position = Vector3(at.x, garden.ground_y(at.x, at.y), at.y)
	return a

## A thing flies from a to b in an arc, turning; calls done at the end.
func fly(n: Node3D, a: Vector3, b: Vector3, secs: float, height := 1.5, spin := 6.0) -> Tween:
	var tw := n.create_tween()
	tw.tween_method(func(k: float):
		n.global_position = a.lerp(b, k) + Vector3(0, sin(k * PI) * height, 0)
		n.rotation.x = k * spin, 0.0, 1.0, secs)
	return tw

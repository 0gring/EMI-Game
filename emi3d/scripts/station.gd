class_name Station
extends Node3D
## One game on the island. It shows a bobbing star where it is; tapping the
## star, the station's own things, or its button at the side of the screen
## brings Luli over and starts the game. A game ends with finish(): a star
## for Emi, a cheer, back to roaming.
##
## Nobody gets stuck: after HINT_AFTER seconds without progress the game
## shows where to tap (help()), and after a few hints it helps along by
## itself (rescue()). Starting another game stops this one (abort()).

const HINT_AFTER := 10.0

var garden: Garden
var id := ""
var title := ""                 # spoken when its button is pressed
var icon := ""                  # picture for its button
var spot := Vector3.ZERO        # where the game happens
var stand := Vector3.ZERO       # where Luli stands to play
var active := false
var marker: Node3D
var marker_tap: Area3D
var t := 0.0
var level := 1
var run := 0                    # changes on every start and stop: stale waits check it
var idle_t := 0.0               # seconds without progress
var hints := 0                  # hints given since the last progress
var hint_node: Node3D
var start_taps: Array[Area3D] = []

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

## Overridden: show where to tap now.
func help() -> void:
	pass

## Overridden: make one step of progress by itself (after several hints).
func rescue() -> void:
	pass

## Overridden: take away the game's things when it is stopped early.
func cleanup() -> void:
	pass

func _make_marker() -> void:
	marker = Node3D.new()
	add_child(marker)
	var star := Sprite3D.new()
	star.texture = load("res://art/star5.svg")
	star.pixel_size = 0.003
	star.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	star.shaded = false
	star.modulate = Color("#ffd84a")
	marker.add_child(star)
	var glow := Sprite3D.new()
	glow.texture = load("res://art/glow.svg")
	glow.pixel_size = 0.008
	glow.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	glow.shaded = false
	glow.modulate = Color(1, 0.95, 0.6, 0.55)
	marker.add_child(glow)
	marker.global_position = spot + Vector3(0, marker_height(), 0)
	marker_tap = garden.add_tap(marker.global_position, 1.3, begin, true)

func marker_height() -> float:
	return 3.2

## Where the camera looks during the game, and from how far.
func cam_point() -> Vector3:
	return spot + Vector3(0, 0.4, 0)

func cam_offset() -> Vector3:
	return Vector3(0, 4.2, 6.6)

## Something of the station's own that starts the game when tapped.
func start_on(at: Vector3, r: float) -> void:
	start_taps.append(garden.add_tap(at, r, func():
		if not active:
			begin(), true))

func _process(dt: float) -> void:
	t += dt
	if marker:
		# the stars inviting to a game show only while no game is on
		marker.visible = not garden.busy
	if marker and marker.visible:
		marker.global_position.y = spot.y + marker_height() + sin(t * 2.5) * 0.15
		marker.rotation.y = t * 1.5
	if hint_node:
		hint_node.position.y = hint_node.get_meta("y") + absf(sin(t * 4.0)) * 0.35
		var s := 1.0 + 0.15 * sin(t * 8.0)
		hint_node.scale = Vector3.ONE * s
	if active and _playing:
		idle_t += dt
		if idle_t > HINT_AFTER:
			idle_t = 0.0
			hints += 1
			if hints >= 3:
				hints = 0
				rescue()
			else:
				help()
	tick(dt)

var _playing := false

## Overridden: per-frame work while it runs.
func tick(_dt: float) -> void:
	pass

## The child did something right: the hint clock starts again.
func progress() -> void:
	idle_t = 0.0
	hints = 0
	clear_hint()

## A big bouncing arrow-star over a point: "here!"
func point_at(p: Vector3, secs := 4.0) -> void:
	clear_hint()
	hint_node = Node3D.new()
	var star := Sprite3D.new()
	star.texture = load("res://art/star4.svg")
	# the same size on screen near or far, big enough to see from the whole-island view
	star.fixed_size = true
	star.pixel_size = 0.0004
	star.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	star.shaded = false
	star.no_depth_test = true
	star.modulate = Color("#fff27a")
	hint_node.add_child(star)
	var glow := Sprite3D.new()
	glow.texture = load("res://art/glow.svg")
	glow.fixed_size = true
	glow.pixel_size = 0.0011
	glow.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	glow.shaded = false
	glow.no_depth_test = true
	glow.modulate = Color(1, 0.95, 0.5, 0.6)
	hint_node.add_child(glow)
	garden.add_child(hint_node)
	hint_node.global_position = p
	hint_node.set_meta("y", p.y)
	Game.arp("harp", [72, 76, 79, 84], 0.08, 0.4)
	var my := hint_node
	get_tree().create_timer(secs).timeout.connect(func():
		if hint_node == my:
			clear_hint())

func clear_hint() -> void:
	if hint_node:
		hint_node.queue_free()
		hint_node = null

## Luli walks over, the camera comes closer, the game starts.
func begin() -> void:
	if active:
		return
	garden.stop_others(self)
	active = true
	garden.busy = true
	marker.visible = false
	run += 1
	var my := run
	Game.play("start")
	garden.focus(cam_point(), self, cam_offset())
	garden.luli.walk_to(stand)
	await garden.luli.arrived
	if run != my:
		return
	garden.luli.face((spot - stand).dot(garden.cam.global_transform.basis.x))
	idle_t = 0.0
	hints = 0
	_playing = true
	play()

## Stops the game early (another game was chosen).
func abort() -> void:
	if not active:
		return
	run += 1
	_playing = false
	clear_hint()
	cleanup()
	active = false
	garden.busy = false
	garden.focus(Vector3.INF, null)
	marker.visible = true

## Is this still the same game that was running at `my`?
func alive(my: int) -> bool:
	return active and run == my

func finish() -> void:
	_playing = false
	clear_hint()
	var my := run
	garden.add_star(1)
	garden.cheer(garden.screen_of(spot + Vector3(0, 1.5, 0)))
	Game.set_level(id, mini(level + 1, 4))
	level = Game.level_of(id)
	garden.luli.feel("happy", 2.0)
	garden.luli.jump(1.2)
	await get_tree().create_timer(2.5).timeout
	if run != my:
		return
	active = false
	garden.busy = false
	garden.focus(Vector3.INF, null)
	marker.visible = true

func say(text: String) -> void:
	garden.say(text)

func wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout

## Waits for an actor to arrive, but never longer than `limit` seconds.
func arrive(a: Actor, limit := 6.0) -> void:
	if not a.walking():
		return
	var done := [false]
	var f := func(): done[0] = true
	a.arrived.connect(f, CONNECT_ONE_SHOT)
	var waited := 0.0
	while not done[0] and waited < limit:
		await get_tree().process_frame
		waited += get_process_delta_time()
	if a.arrived.is_connected(f):
		a.arrived.disconnect(f)
	a.stop()

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
		if is_instance_valid(n):
			n.global_position = a.lerp(b, k) + Vector3(0, sin(k * PI) * height, 0)
			n.rotation.x = k * spin, 0.0, 1.0, secs)
	return tw

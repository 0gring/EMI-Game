class_name Garden
extends Node3D
## Emi's garden: a little island in the sea, built from the sand3d models in
## models/ (tools/build_models.py). Luli walks wherever Emi taps; the friends
## and the games live around the island (see the stations).

const COZY := preload("res://scripts/cozy.gdshader")

var layout: Dictionary
var cam: Camera3D
var cam_target := Vector3.ZERO
var luli: Actor
var ground_body: StaticBody3D
var props := {}          # name -> Node3D, things placed on the island
var taps: Array = []     # [Area3D, Callable] things Emi can tap
var hud: CanvasLayer
var star_label: Label
var busy := false        # a station is running its game
var station_list: Array = []

func _ready() -> void:
	layout = JSON.parse_string(FileAccess.get_file_as_string("res://models/layout.json"))
	_environment()
	_sea()
	_island()
	await get_tree().physics_frame
	await get_tree().physics_frame
	_decorate()
	_luli()
	_camera()
	_hud()
	for s in [preload("res://scripts/st_apples.gd"), preload("res://scripts/st_hide.gd"), preload("res://scripts/st_pond.gd")]:
		var st: Node3D = s.new()
		st.garden = self
		add_child(st)
		station_list.append(st)
	var sh := Shot.new()
	add_child(sh)
	if "--autotest" in OS.get_cmdline_user_args():
		var pt: Node = load("res://scripts/playtest.gd").new()
		pt.garden = self
		add_child(pt)
	await get_tree().create_timer(0.8).timeout
	say("שלום אמי! בואי נשחק בגן!")

# --- the world -----------------------------------------------------------------------------
func _environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color("#4f9dff")
	sm.sky_horizon_color = Color("#bfe3ff")
	sm.ground_horizon_color = Color("#bfe3ff")
	sm.ground_bottom_color = Color("#3d8fd6")
	sm.sun_angle_max = 20.0
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("#fff4ea")
	e.ambient_light_energy = 0.4
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	e.fog_enabled = true
	e.fog_light_color = Color("#cfe9ff")
	e.fog_density = 0.0015
	e.fog_sky_affect = 0.0
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 30, 0)
	sun.light_energy = 0.3
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 45.0
	sun.shadow_blur = 1.5
	add_child(sun)

func _sea() -> void:
	var sea := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(260, 260)
	pm.subdivide_width = 90
	pm.subdivide_depth = 90
	sea.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = load("res://scripts/water.gdshader")
	var isl: Dictionary = layout["island"]
	m.set_shader_parameter("shore", Vector4(0, 0, float(isl["w"]) / 2.0 + 1.6, float(isl["d"]) / 2.0 + 1.6))
	sea.material_override = m
	sea.position.y = 0.0
	add_child(sea)

func model(name: String) -> Node3D:
	var n: Node3D = load("res://models/%s.glb" % name).instantiate()
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var mat := ShaderMaterial.new()
		mat.shader = COZY
		for i in m.mesh.get_surface_count():
			m.set_surface_override_material(i, mat)
	return n

func _island() -> void:
	var isl := model("island")
	add_child(isl)
	ground_body = StaticBody3D.new()
	add_child(ground_body)
	for mi in isl.find_children("*", "MeshInstance3D", true, false):
		var cs := CollisionShape3D.new()
		cs.shape = (mi as MeshInstance3D).mesh.create_trimesh_shape()
		cs.transform = (mi as MeshInstance3D).global_transform
		ground_body.add_child(cs)
	var grass := model("grass")
	_sway(grass, 0.04, 0.16)
	add_child(grass)
	var pond: Dictionary = layout["pond"]
	var water := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(float(pond["r"]) * 2.1, float(pond["rz"]) * 2.1)
	pm.subdivide_width = 16
	pm.subdivide_depth = 16
	water.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = load("res://scripts/water.gdshader")
	var pp: Array = pond["pos"]
	m.set_shader_parameter("shore", Vector4(pp[0], pp[2], float(pond["r"]) * 0.92, float(pond["rz"]) * 0.92))
	m.set_shader_parameter("fade", 2.0)
	m.set_shader_parameter("wave", 0.015)
	m.set_shader_parameter("foam_w", 0.25)
	water.material_override = m
	water.position = Vector3(pp[0], pp[1], pp[2])
	add_child(water)

func _sway(n: Node3D, amount: float, h: float) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for i in m.mesh.get_surface_count():
			var mat := m.get_surface_override_material(i) as ShaderMaterial
			mat.set_shader_parameter("sway", amount)
			mat.set_shader_parameter("sway_height", h)

## Height of the ground under (x, z).
func ground_y(x: float, z: float) -> float:
	var q := PhysicsRayQueryParameters3D.create(Vector3(x, 20, z), Vector3(x, -5, z))
	q.collision_mask = 1
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit["position"].y if hit else 0.9

func on_island(p: Vector3) -> bool:
	var isl: Dictionary = layout["island"]
	var a := float(isl["w"]) / 2.0 - 1.2
	var b := float(isl["d"]) / 2.0 - 1.2
	return pow(absf(p.x / a), 2.3) + pow(absf(p.z / b), 2.3) < 1.0

func in_pond(p: Vector3, margin := 0.4) -> bool:
	var pond: Dictionary = layout["pond"]
	var pp: Array = pond["pos"]
	return pow((p.x - pp[0]) / (float(pond["r"]) + margin), 2) + pow((p.z - pp[2]) / (float(pond["rz"]) + margin), 2) < 1.0

## Keeps a walker on the lawn: off the beach edge, and round the pond rather
## than into it (pushed out to its rim, with a nudge sideways so a walker
## heading straight across slides round instead of stopping).
func keep_on(p: Vector3) -> Vector3:
	var q := p
	var pond: Dictionary = layout["pond"]
	var pp: Array = pond["pos"]
	var a := float(pond["r"]) + 0.45
	var b := float(pond["rz"]) + 0.45
	var d := Vector2((q.x - pp[0]) / a, (q.z - pp[2]) / b)
	if d.length() < 1.0:
		var out := d.normalized() if d.length() > 0.001 else Vector2(0, 1)
		out = out.rotated(0.12)
		q.x = pp[0] + out.x * a * 1.01
		q.z = pp[2] + out.y * b * 1.01
	var isl: Dictionary = layout["island"]
	var ia := float(isl["w"]) / 2.0 - 1.2
	var ib := float(isl["d"]) / 2.0 - 1.2
	var e := pow(absf(q.x / ia), 2.3) + pow(absf(q.z / ib), 2.3)
	if e >= 1.0:
		var k := pow(1.0 / e, 1.0 / 2.3) * 0.995
		q.x *= k
		q.z *= k
	return q

func place(name: String, pos: Vector2, rot := 0.0, scl := 1.0) -> Node3D:
	var n := model(name)
	n.position = Vector3(pos.x, ground_y(pos.x, pos.y) - 0.03, pos.y)
	n.rotation.y = rot
	n.scale = Vector3.ONE * scl
	add_child(n)
	return n

func _decorate() -> void:
	# the big things: trees, bushes, rocks (several are hiding places, see st_hide.gd)
	props["tree_apple"] = place("tree_apple", Vector2(-7.5, -4.5), 0.3, 1.15)
	props["blossom_a"] = place("tree_blossom", Vector2(-12.0, -6.0), 1.0)
	props["blossom_b"] = place("tree_blossom", Vector2(2.5, -9.5), 2.0, 0.9)
	props["tree_round"] = place("tree_round", Vector2(11.5, -3.0), 0.5)
	props["tree_round_b"] = place("tree_round", Vector2(-3.0, -10.0), 1.4, 0.85)
	props["bush_a"] = place("bush_flowers", Vector2(-10.5, 4.5), 0.2)
	props["bush_b"] = place("bush", Vector2(9.5, 7.5), 1.2)
	props["bush_c"] = place("bush_flowers", Vector2(1.0, 8.5), 2.2, 0.9)
	props["rock_a"] = place("rock", Vector2(-4.0, 6.0), 0.4)
	props["rock_b"] = place("rock", Vector2(12.0, 3.0), 2.0, 0.85)
	props["mush_big"] = place("mushroom_big", Vector2(-1.5, -6.5), 0.0)
	for p in [Vector2(-5.2, -7.0), Vector2(-0.2, -7.4), Vector2(7.5, 9.0), Vector2(-11.5, 1.0)]:
		place("mushroom", p, randf() * TAU, randf_range(0.8, 1.2))
	for p in [Vector2(3.0, 2.0), Vector2(4.0, 3.2), Vector2(2.6, 4.6)]:
		place("stone", p, randf() * TAU)
	place("rock_small", Vector2(8.8, 1.5), 1.0)
	place("rock_small", Vector2(-8.5, 8.5), 2.0, 0.8)
	_flowers()

func _flowers() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 12
	for kind in ["flower_pink", "flower_yellow", "flower_white", "flower_blue"]:
		var src := model(kind)
		var mis := src.find_children("*", "MeshInstance3D", true, false)
		# merge the flower's parts into one mesh for the MultiMesh
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for mi in mis:
			var m := mi as MeshInstance3D
			for s in m.mesh.get_surface_count():
				st.append_from(m.mesh, s, _rel_xform(src, m))
		var mesh := st.commit()
		var mat := ShaderMaterial.new()
		mat.shader = COZY
		mat.set_shader_parameter("sway", 0.05)
		mat.set_shader_parameter("sway_height", 0.3)
		mesh.surface_set_material(0, mat)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		var spots: Array[Transform3D] = []
		var tries := 0
		while spots.size() < 55 and tries < 600:
			tries += 1
			var x := rng.randf_range(-13.5, 13.5)
			var z := rng.randf_range(-11.5, 11.5)
			# flowers grow in patches
			var patch := sin(x * 0.45 + kind.length()) * cos(z * 0.5 - kind.length() * 0.7)
			if patch < 0.35:
				continue
			var p := Vector3(x, 0, z)
			if not on_island(p) or in_pond(p, 0.8) or absf(x) < 1.5 and absf(z) < 2.0:
				continue
			p.y = ground_y(x, z) - 0.02
			var s := rng.randf_range(0.8, 1.3)
			spots.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * s), p))
		mm.instance_count = spots.size()
		for i in spots.size():
			mm.set_instance_transform(i, spots[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
		src.free()

func _rel_xform(root: Node3D, n: Node3D) -> Transform3D:
	var t := Transform3D.IDENTITY
	var c: Node = n
	while c != root and c != null:
		t = (c as Node3D).transform * t
		c = c.get_parent()
	return t

# --- Luli and the camera -----------------------------------------------------------------
func _luli() -> void:
	luli = Actor.new()
	luli.species = "unicorn"
	luli.tall = 1.5
	luli.ground = ground_y
	luli.bounds = keep_on
	add_child(luli)
	luli.global_position = Vector3(0, ground_y(0, 2), 2)

func _camera() -> void:
	cam = Camera3D.new()
	cam.fov = 42
	add_child(cam)
	cam_target = luli.global_position
	_place_cam(1.0)

const CAM_OFF := Vector3(0, 6.2, 9.0)
const CAM_NEAR := Vector3(0, 4.2, 6.6)
var cam_focus := Vector3.INF
var cam_off := CAM_OFF
var focus_owner: Node
var focus_off := CAM_NEAR

## The camera comes closer to a game (INF: back to following Luli).
func focus(p: Vector3, owner: Node, off := CAM_NEAR) -> void:
	cam_focus = p
	focus_owner = owner
	focus_off = off

func _place_cam(k: float) -> void:
	var want := luli.global_position + Vector3(0, 0.6, 0)
	# keep the view inside the island a little, so the sea frames it
	want.x = clampf(want.x, -8.0, 8.0)
	want.z = clampf(want.z, -8.0, 6.0)
	var off := CAM_OFF
	if cam_focus != Vector3.INF:
		want = cam_focus
		off = focus_off
	cam_target = cam_target.lerp(want, k)
	cam_off = cam_off.lerp(off, k)
	cam.global_position = cam_target + cam_off
	cam.look_at(cam_target, Vector3.UP)

func _process(dt: float) -> void:
	if cam:
		_place_cam(minf(1.0, dt * 2.5))

# --- tapping ---------------------------------------------------------------------------------
## A station registers what can be tapped: a sphere of radius r at a point.
func add_tap(at: Vector3, r: float, cb: Callable) -> Area3D:
	var a := Area3D.new()
	a.collision_layer = 2
	a.collision_mask = 0
	a.monitoring = false
	var cs := CollisionShape3D.new()
	var sh := SphereShape3D.new()
	sh.radius = r
	cs.shape = sh
	a.add_child(cs)
	add_child(a)
	a.global_position = at
	taps.append([a, cb])
	return a

func remove_tap(a: Area3D) -> void:
	for t in taps:
		if t[0] == a:
			taps.erase(t)
			break
	a.queue_free()

func _unhandled_input(event: InputEvent) -> void:
	var pos := Vector2.INF
	if event is InputEventScreenTouch and event.pressed:
		pos = event.position
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pos = event.position
	if pos == Vector2.INF or cam == null:
		return
	tap_screen(pos)

func tap_screen(pos: Vector2) -> void:
	var from := cam.project_ray_origin(pos)
	var dir := cam.project_ray_normal(pos)
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 200.0)
	q.collide_with_areas = true
	q.collision_mask = 2
	var hit := space.intersect_ray(q)
	if hit:
		for t in taps:
			if t[0] == hit["collider"]:
				(t[1] as Callable).call()
				return
	if busy:
		for s in station_list:
			if s.has_method("tap_ground") and s.active:
				q.collision_mask = 1
				q.collide_with_areas = false
				var g := space.intersect_ray(q)
				if g:
					s.tap_ground(g["position"])
		return
	q.collision_mask = 1
	q.collide_with_areas = false
	var g := space.intersect_ray(q)
	if g:
		var p: Vector3 = g["position"]
		luli.walk_to(keep_on(p))
		Fx.burst(Game.fx, pos, [Color("#ffffff"), Color("#ffe0f0")], 6, 0.3)

# --- talking, stars --------------------------------------------------------------------------
var bubble: PanelContainer
var bubble_label: Label
var bubble_t := 0.0

func say(text: String) -> void:
	var secs := Game.speak(text)
	bubble_label.text = text
	bubble.visible = true
	bubble.modulate.a = 1.0
	bubble_t = maxf(2.0, secs + 0.6)
	luli.creature.talk(maxf(1.0, secs))

func _hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	bubble = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.95)
	sb.set_corner_radius_all(36)
	sb.content_margin_left = 34
	sb.content_margin_right = 34
	sb.content_margin_top = 16
	sb.content_margin_bottom = 16
	sb.shadow_color = Color(0.3, 0.2, 0.4, 0.2)
	sb.shadow_size = 10
	bubble.add_theme_stylebox_override("panel", sb)
	bubble_label = Label.new()
	bubble_label.add_theme_font_size_override("font_size", 54)
	bubble_label.add_theme_color_override("font_color", Color("#4a3266"))
	bubble.add_child(bubble_label)
	bubble.position = Vector2(60, 40)
	bubble.visible = false
	hud.add_child(bubble)
	var star_box := PanelContainer.new()
	var sb2 := sb.duplicate() as StyleBoxFlat
	sb2.set_corner_radius_all(40)
	star_box.add_theme_stylebox_override("panel", sb2)
	star_label = Label.new()
	star_label.add_theme_font_size_override("font_size", 54)
	star_label.add_theme_color_override("font_color", Color("#4a3266"))
	star_label.text = "⭐ %d" % Game.stars
	star_box.add_child(star_label)
	star_box.anchor_left = 1.0
	star_box.anchor_right = 1.0
	star_box.position = Vector2(get_viewport().get_visible_rect().size.x - 240, 40)
	hud.add_child(star_box)

func add_star(n := 1) -> void:
	Game.add_stars(n)
	star_label.text = "⭐ %d" % Game.stars
	Game.play("reward")

func _physics_process(dt: float) -> void:
	if bubble_t > 0.0:
		bubble_t -= dt
		if bubble_t <= 0.0:
			var tw := bubble.create_tween()
			tw.tween_property(bubble, "modulate:a", 0.0, 0.3)
			tw.tween_callback(func(): bubble.visible = false)

## Fireworks of joy at a point on the screen.
func cheer(at: Vector2) -> void:
	Fx.burst(Game.fx, at, Fx.RAINBOW, 36, 1.1)
	Fx.confetti(Game.fx, at, Fx.RAINBOW, 40, 0.9)
	Game.play("fanfare")

## Where a 3D point is on the screen.
func screen_of(p: Vector3) -> Vector2:
	return cam.unproject_position(p)

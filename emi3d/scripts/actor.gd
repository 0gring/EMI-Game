class_name Actor
extends Node3D
## A painted character standing in the 3D garden: the same puppet as in the
## 2D games (Creature), drawn into its own little picture that always turns to
## face the camera, with a soft shadow on the ground under its feet.

signal arrived

const PX := 512            # the picture's size
var species := "unicorn"
var tall := 1.5            # metres
var creature: Creature
var view: SubViewport
var card: Sprite3D
var shadow: MeshInstance3D
var target := Vector3.INF
var speed := 3.2
var step_t := 0.0
var ground: Callable       # (x, z) -> ground height
var bounds: Callable       # Vector3 -> Vector3, kept on the island
var facing := 1.0
var best_d := INF          # closest it has come to the target
var stuck_t := 0.0         # time since it last came closer

func _ready() -> void:
	view = SubViewport.new()
	view.size = Vector2i(PX, PX)
	view.transparent_bg = true
	view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(view)
	creature = Creature.new()
	creature.species = species
	creature.height = PX * 0.82
	creature.position = Vector2(PX / 2.0, PX * 0.97)
	view.add_child(creature)
	card = Sprite3D.new()
	card.texture = view.get_texture()
	card.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	card.pixel_size = tall / (PX * 0.82)
	card.centered = true
	card.offset = Vector2(0, PX * 0.47)      # feet at the node's origin
	card.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	card.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	card.shaded = false
	add_child(card)
	shadow = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(tall * 0.75, tall * 0.4)
	q.orientation = PlaneMesh.FACE_Y
	shadow.mesh = q
	var sm := StandardMaterial3D.new()
	sm.albedo_texture = load("res://art/glow.svg")
	sm.albedo_color = Color(0.15, 0.1, 0.25, 0.4)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shadow.material_override = sm
	shadow.position.y = 0.03
	shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(shadow)

func walk_to(p: Vector3) -> void:
	target = p
	best_d = INF
	stuck_t = 0.0

func stop() -> void:
	target = Vector3.INF

func walking() -> bool:
	return target != Vector3.INF

func feel(e: String, secs := 1.2) -> void:
	creature.feel(e, secs)

func jump(power := 1.0) -> void:
	creature.jump(power)

func face(dir_x: float) -> void:
	if absf(dir_x) > 0.05:
		facing = signf(dir_x)
		creature.scale.x = facing

func _process(dt: float) -> void:
	if target == Vector3.INF:
		return
	var to := target - global_position
	to.y = 0
	var d := to.length()
	# arrived - or as close as it can get (a pond or the shore in the way):
	# a walker that stops getting closer counts as arrived, so nothing waits forever
	if d < best_d - 0.02:
		best_d = d
		stuck_t = 0.0
	else:
		stuck_t += dt
	if d < 0.08 or stuck_t > 0.6:
		target = Vector3.INF
		arrived.emit()
		return
	var step := to.normalized() * minf(d, speed * dt)
	var p := global_position + step
	if bounds.is_valid():
		p = bounds.call(p)
	if ground.is_valid():
		p.y = ground.call(p.x, p.z)
	global_position = p
	# which way it faces on screen: compare with the camera's right
	var cam := get_viewport().get_camera_3d()
	if cam:
		face(step.dot(cam.global_transform.basis.x))
	step_t += dt
	if step_t > 0.3:
		step_t = 0.0
		creature.jump(0.35)

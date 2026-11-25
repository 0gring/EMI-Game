extends Node
## Everything every scene shares: saved progress, sound and music, the Hebrew
## voice, screen changes, and the magic finger trail drawn over all of it.

const SAVE_PATH := "user://save.json"

var stars := 0
var levels := {}          # activity id -> level reached, 1..4
var muted := false

# --- sound --------------------------------------------------------------------

const SFX_NAMES := ["pop", "tap", "plink", "success", "achievement", "reward", "bonus", "levelup",
	"streak", "start", "open", "close", "swipe", "snap", "drop", "grab", "check", "wake", "sleep",
	"toggle-on", "toggle-off", "back", "badge", "expand", "chime", "nope", "boing", "fanfare"]
const INSTRUMENTS := {
	"xylophone": ["C5", "C6", "C7", "C8", "G4", "G5", "G6", "G7"],
	"harp": ["C3", "E3", "G3", "B3", "D4", "F4", "A4", "C5", "E5", "G5", "B5", "D6", "F6", "A6"],
	"flute": ["C4", "E4", "A4", "C5", "E5", "A5", "C6", "E6", "A6"],
	"piano": ["C3", "E3", "G3", "C4", "E4", "G4", "C5", "E5", "G5", "C6"],
}
var sfx := {}
var inst := {}            # name -> Array of [midi, stream]
var players: Array[AudioStreamPlayer] = []
var next_player := 0

# --- music: a gentle tune played live from the same samples -------------------
const SONGS := {
	"island": {"bpm": 88, "chords": [["F3", "A3", "C4"], ["D3", "F3", "A3"], ["A#2", "D3", "F3"], ["C3", "E3", "G3"]],
		"melody": ["C5", "F5", "A5", "G5", "F5", "D5", "F5", "A5", "A#5", "A5", "F5", "D5", "C5", "D5", "E5", "G5"], "lead": "flute"},
	"play": {"bpm": 112, "chords": [["C3", "G3", "C4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"], ["C3", "E3", "G3"]],
		"melody": ["C5", "E5", "G5", "E5", "A5", "G5", "E5", "D5", "C5", "D5", "E5", "G5", "A5", "C6", "A5", "G5"], "lead": "xylophone"},
}
var song: Dictionary = {}
var song_step := 0
var song_clock := 0.0
var music_vol := 1.0
var duck_t := 0.0

# --- voice --------------------------------------------------------------------
var he_voice := ""

# --- screen changes -----------------------------------------------------------
var overlay: CanvasLayer
var iris: ColorRect
var fading := false
var iris_center := Vector2(0.5, 0.5)
var current: Node

# --- finger magic ----------------------------------------------------------------
var trail_layer: CanvasLayer
var fx: Node2D
var last_touch := {}
var hue := 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	load_state()
	for n in SFX_NAMES:
		var p := "res://audio/sfx/%s.mp3" % n
		if ResourceLoader.exists(p):
			sfx[n] = load(p)
	for i in INSTRUMENTS:
		var list := []
		for note in INSTRUMENTS[i]:
			var p := "res://audio/inst/%s/%s.mp3" % [i, note]
			if ResourceLoader.exists(p):
				list.append([note_to_midi(note), load(p)])
		inst[i] = list
	for k in 20:
		var a := AudioStreamPlayer.new()
		a.bus = "Master"
		add_child(a)
		players.append(a)
	_find_voice()
	_build_overlay()
	_build_theme()

# --- save -------------------------------------------------------------------------

func load_state() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	var d = JSON.parse_string(f.get_as_text())
	if d is Dictionary:
		stars = int(d.get("stars", 0))
		levels = d.get("levels", {})
		muted = bool(d.get("muted", false))

func save_state() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	f.store_string(JSON.stringify({"stars": stars, "levels": levels, "muted": muted}))

func add_stars(n: int) -> void:
	stars += n
	save_state()

func level_of(id: String) -> int:
	return clampi(int(levels.get(id, 1)), 1, 4)

func set_level(id: String, lv: int) -> void:
	levels[id] = clampi(lv, 1, 4)
	save_state()

# --- sound ------------------------------------------------------------------------

static func note_to_midi(name: String) -> int:
	var base := {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
	var v: int = base.get(name.substr(0, 1), 0)
	var rest := name.substr(1)
	if rest.begins_with("#"):
		v += 1
		rest = rest.substr(1)
	elif rest.begins_with("b"):
		v -= 1
		rest = rest.substr(1)
	return v + (int(rest) + 1) * 12

func _player() -> AudioStreamPlayer:
	# round robin over a fixed pool: twenty voices is plenty for ten fingers
	var p := players[next_player]
	next_player = (next_player + 1) % players.size()
	return p

func play(name: String, vol := 0.8, pitch := 1.0) -> void:
	if muted or not sfx.has(name):
		return
	var p := _player()
	p.stream = sfx[name]
	p.volume_db = linear_to_db(vol)
	p.pitch_scale = pitch * randf_range(0.96, 1.04)
	p.play()

func note(instrument: String, n, vol := 0.6, delay := 0.0) -> void:
	if muted:
		return
	var list: Array = inst.get(instrument, [])
	if list.is_empty():
		return
	var midi: int = n if n is int else note_to_midi(n)
	var best = list[0]
	for e in list:
		if absi(e[0] - midi) < absi(best[0] - midi):
			best = e
	var rate := pow(2.0, (midi - best[0]) / 12.0)
	if delay > 0.0:
		get_tree().create_timer(delay).timeout.connect(_play_stream.bind(best[1], vol, rate))
	else:
		_play_stream(best[1], vol, rate)

func _play_stream(stream: AudioStream, vol: float, rate: float) -> void:
	var p := _player()
	p.stream = stream
	p.volume_db = linear_to_db(vol * (1.0 if not muted else 0.0) + 0.0001)
	p.pitch_scale = rate
	p.play()

## A note whose pitch slides through `bends` ([[seconds, rate], ...]) - how a
## flute becomes a deflating balloon's raspberry or a cat's miaow.
func slide(instrument: String, n, bends: Array, vol := 0.6) -> void:
	if muted:
		return
	var list: Array = inst.get(instrument, [])
	if list.is_empty():
		return
	var midi: int = n if n is int else note_to_midi(n)
	var best = list[0]
	for e in list:
		if absi(e[0] - midi) < absi(best[0] - midi):
			best = e
	var rate := pow(2.0, (midi - best[0]) / 12.0)
	var p := _player()
	p.stream = best[1]
	p.volume_db = linear_to_db(vol)
	p.pitch_scale = rate * float(bends[0][1])
	p.play()
	var tw := create_tween()
	var last := 0.0
	for b in bends:
		var dt: float = maxf(0.01, float(b[0]) - last)
		tw.tween_property(p, "pitch_scale", rate * float(b[1]), dt)
		last = float(b[0])
	tw.tween_property(p, "volume_db", -40.0, 0.25)
	tw.tween_callback(p.stop)


func arp(instrument: String, notes: Array, step := 0.06, vol := 0.5) -> void:
	for i in notes.size():
		note(instrument, notes[i], vol, i * step)

func set_muted(m: bool) -> void:
	muted = m
	AudioServer.set_bus_mute(0, m)
	save_state()

func music(name: String) -> void:
	if song.get("name", "") == name:
		return
	song = SONGS.get(name, SONGS["island"]).duplicate()
	song["name"] = name
	song_step = 0
	song_clock = 0.0

func duck(seconds := 1.0) -> void:
	duck_t = seconds

func _process(dt: float) -> void:
	_update_music(dt)
	_update_fade(dt)

func _update_music(dt: float) -> void:
	if song.is_empty() or muted:
		return
	duck_t = maxf(0.0, duck_t - dt)
	music_vol = move_toward(music_vol, 0.35 if duck_t > 0.0 else 1.0, dt * 2.0)
	song_clock -= dt
	if song_clock > 0.0:
		return
	var step_len := 60.0 / float(song["bpm"]) / 2.0
	song_clock += step_len
	var i := song_step
	var chords: Array = song["chords"]
	var chord: Array = chords[(i / 8) % chords.size()]
	var in_bar := i % 8
	var v := 0.16 * music_vol
	if in_bar == 0:
		for k in chord.size():
			note("harp", chord[k], v * 1.1, k * 0.035)
		note("piano", chord[0], v * 0.9)
	elif in_bar == 4:
		note("piano", chord[chord.size() - 1], v * 0.6)
	var mel: Array = song["melody"]
	if in_bar % 2 == 0 and randf() > 0.15:
		note(song["lead"], mel[i % mel.size()], v * 1.05)
	song_step = (i + 1) % (mel.size() * 4)

# --- voice --------------------------------------------------------------------------

func _find_voice() -> void:
	var voices := DisplayServer.tts_get_voices_for_language("he")
	if voices.is_empty():
		voices = DisplayServer.tts_get_voices_for_language("iw")
	if not voices.is_empty():
		he_voice = voices[0]

## Says `text` in Hebrew and returns roughly how long it takes, so a character
## can move its mouth for that long. Silent, but still timed, with no voice.
func speak(text: String) -> float:
	var secs := 0.35 + text.length() * 0.075
	if muted:
		return secs
	if he_voice == "":
		_find_voice()
	if he_voice != "":
		DisplayServer.tts_stop()
		# vowels added, so the engine says the word we mean (see hebrew.gd)
		DisplayServer.tts_speak(Hebrew.vocalize(text), he_voice, 100, 1.15, 0.95)
		duck(secs + 0.3)
	return secs

# --- screens ------------------------------------------------------------------------

func _build_overlay() -> void:
	overlay = CanvasLayer.new()
	overlay.layer = 100
	add_child(overlay)
	iris = ColorRect.new()
	iris.set_anchors_preset(Control.PRESET_FULL_RECT)
	iris.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mat := ShaderMaterial.new()
	mat.shader = load("res://scripts/iris.gdshader")
	iris.material = mat
	iris.visible = false
	overlay.add_child(iris)
	trail_layer = CanvasLayer.new()
	trail_layer.layer = 90
	add_child(trail_layer)
	fx = Node2D.new()
	trail_layer.add_child(fx)

func _build_theme() -> void:
	var he := load("res://fonts/secular-one-hebrew.woff2") as FontFile
	var la := load("res://fonts/secular-one-latin.woff2") as FontFile
	if he and la:
		he.fallbacks = [la]
		var t := Theme.new()
		t.default_font = he
		t.default_font_size = 64
		get_tree().root.theme = t

## Swaps in a new scene behind a sparkling iris that closes onto `at` (screen
## position in pixels) and opens again.
func go(scene_path: String, at := Vector2(-1, -1)) -> void:
	if fading:
		return
	fading = true
	var vs := get_viewport().get_visible_rect().size
	if at.x >= 0.0:
		iris_center = at / vs
	iris.visible = true
	var mat := iris.material as ShaderMaterial
	mat.set_shader_parameter("center", iris_center)
	mat.set_shader_parameter("aspect", vs.x / vs.y)
	var tw := create_tween()
	tw.tween_method(func(v): mat.set_shader_parameter("progress", v), 0.0, 1.0, 0.45).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func():
		var packed := load(scene_path) as PackedScene
		get_tree().change_scene_to_packed(packed))
	tw.tween_interval(0.12)
	tw.tween_method(func(v): mat.set_shader_parameter("progress", v), 1.0, 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func():
		iris.visible = false
		fading = false)
	play("swipe", 0.5)

func _update_fade(_dt: float) -> void:
	if iris.visible:
		(iris.material as ShaderMaterial).set_shader_parameter("time", Time.get_ticks_msec() / 1000.0)

# --- finger magic ----------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			last_touch[event.index] = event.position
			iris_center = event.position / get_viewport().get_visible_rect().size
			Fx.ring_burst(fx, event.position)
		else:
			last_touch.erase(event.index)
	elif event is InputEventScreenDrag:
		var from: Vector2 = last_touch.get(event.index, event.position)
		var d := from.distance_to(event.position)
		if d > 10.0:
			var n := mini(10, int(d / 10.0))
			for k in n:
				hue = fmod(hue + 0.012, 1.0)
				Fx.trail_spark(fx, from.lerp(event.position, float(k + 1) / n), Color.from_hsv(hue, 0.75, 1.0))
			last_touch[event.index] = event.position

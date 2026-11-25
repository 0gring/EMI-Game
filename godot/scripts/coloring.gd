extends Activity
## Colouring book.
##
## A page is a line drawing made of closed regions. She picks one of the fat
## crayons down the side (it slides out, glows, and says its colour), touches a
## region, and the colour spreads out from her finger to fill exactly that
## region - never over the lines - with a crayon grain and soft light so it
## looks painted, not flat. Any region can be coloured again.
##
## When every region has colour the page comes alive in its own way: the ball
## bounces, the butterfly flaps off on a loop, the fish swims and blows
## bubbles, the car honks and drives, smoke curls from the house and a cat
## peeks out of the door. Luli cheers, fireworks go up, and a big glowing arrow
## offers the next page (she can also keep colouring this one).
##
## Pages are defined in a 100x100 design space and scaled to fit. Each region
## belongs to a "part" - a node with its own pivot - so the page can be
## animated piece by piece once it is finished.

const PAINTS := [
	{"c": "#ff4d5e", "name": "אדום"}, {"c": "#ff9a1f", "name": "כתום"}, {"c": "#ffd93d", "name": "צהוב"},
	{"c": "#5fcf5f", "name": "ירוק"}, {"c": "#4fa8ff", "name": "כחול"}, {"c": "#a774ff", "name": "סגול"},
	{"c": "#ff85c8", "name": "ורוד"}, {"c": "#9a6440", "name": "חום"}, {"c": "#ffffff", "name": "לבן"},
	{"c": "#3d3a52", "name": "שחור"},
]
const MAGIC := [{"c": "#ffffff", "name": "קשת", "mode": 1}, {"c": "#ffd23d", "name": "זהב", "mode": 2}]

const PAGE_NAMES := {"ball": "כדור", "icecream": "גלידה", "flower": "פרח", "butterfly": "פרפר",
	"fish": "דג", "house": "בית", "rainbow": "קשת", "car": "מכונית"}

# More pages and more crayons each level; magic crayons from level three.
const TUNING := [
	{"pages": ["ball", "icecream", "flower"], "crayons": 6, "magic": false},
	{"pages": ["butterfly", "fish", "flower", "icecream"], "crayons": 8, "magic": false},
	{"pages": ["house", "rainbow", "butterfly", "fish"], "crayons": 10, "magic": true},
	{"pages": ["car", "house", "rainbow", "butterfly", "fish", "ball"], "crayons": 10, "magic": true},
]

const INK := Color("#3d3a52")

const FILL_SHADER := """
shader_type canvas_item;
uniform vec4 old_col : source_color = vec4(1.0);
uniform vec4 new_col : source_color = vec4(1.0);
uniform int old_mode = -1;
uniform int new_mode = -1;
uniform vec2 origin = vec2(0.0);
uniform float radius = 0.0;
uniform vec4 bounds = vec4(0.0, 0.0, 1.0, 1.0);
varying vec2 lp;

void vertex() { lp = VERTEX; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 paint(int mode, vec3 c) {
	if (mode == 1) {
		float k = (lp.x + lp.y) * 0.004 + TIME * 0.25;
		return 0.55 + 0.45 * cos(6.2831 * (k + vec3(0.0, 0.33, 0.67)));
	}
	if (mode == 2) {
		float k = (lp.x - lp.y) * 0.012 + TIME * 1.2;
		return mix(vec3(0.86, 0.6, 0.1), vec3(1.0, 0.92, 0.5), 0.5 + 0.5 * sin(k));
	}
	return c;
}

void fragment() {
	vec2 uv = (lp - bounds.xy) / max(bounds.zw, vec2(1.0));
	float d = length(lp - origin);
	bool fresh = d < radius;
	int m = fresh ? new_mode : old_mode;
	vec3 c;
	if (m < 0) {
		c = vec3(0.995) - noise(lp * 0.3) * 0.025;
	} else {
		c = paint(m, fresh ? new_col.rgb : old_col.rgb);
		float n = noise(lp * 0.07) * 0.5 + noise(lp * 0.23) * 0.5;
		c *= 0.9 + 0.13 * n;
		c += (1.0 - uv.y) * 0.07;
		c *= 1.0 - smoothstep(0.5, 0.95, length(uv - vec2(0.38, 0.32))) * 0.14;
		if (m == 2) {
			float s = pow(noise(lp * 0.16 + vec2(TIME * 2.0, TIME)), 10.0);
			c += vec3(s * 1.6);
		}
	}
	float rim = smoothstep(7.0, 0.0, abs(d - radius)) * step(0.5, radius) * step(radius, 5000.0);
	c = mix(c, c * 0.82, rim * 0.6);
	COLOR = vec4(c, 1.0);
}
"""

var tune: Dictionary
var page_i := 0
var page_id := ""
var page: Node2D
var parts := {}
var regions := []          # draw order; each {poly, mat, mode, col, part, pts}
var k := 9.0               # pixels per design unit
var page_size := 900.0
var page_center := Vector2.ZERO
var crayons := []          # {c, name, mode, y, slide}
var sel := 0
var crayon_len := 230.0
var crayon_th := 64.0
var complete := false
var alive_t := 0.0
var fills := 0
var peeked := false
var next_btn: Node2D
var next_pop := 0.0
var shader: Shader
var honk_t := 0.0
var smoke_t := 0.0
var bubble_t2 := 0.0
var door_cat: Creature
var crayon_node: Node2D

func mood() -> Dictionary:
	return {"horizon": 0.6, "sky_top": Color("#5ab0ff"), "sky_low": Color("#e6f4ff")}

func clear_rects() -> Array[Rect2]:
	return [Rect2(size.x * 0.2, 0, size.x * 0.8, size.y)]

func luli_spot() -> Vector2:
	return Vector2(size.x * 0.08, size.y * 0.97)

func bubble_spot() -> Vector2:
	return Vector2(24, size.y * 0.24)

func _ready() -> void:
	id = "coloring"
	hue = Color("#4fa8ff")
	goals = [1, 2, 2, 2]
	shader = Shader.new()
	shader.code = FILL_SHADER
	super._ready()
	tune = TUNING[level - 1]
	_layout()
	crayon_node = Node2D.new()
	crayon_node.z_index = 7
	crayon_node.draw.connect(_draw_crayons)
	add_child(crayon_node)
	_build_crayons()
	next_btn = Node2D.new()
	next_btn.z_index = 12
	next_btn.draw.connect(_draw_next)
	next_btn.visible = false
	add_child(next_btn)
	new_page(true)
	Shot.maybe(self)

func on_level_up() -> void:
	tune = TUNING[level - 1]
	_build_crayons()

func _layout() -> void:
	var top := 150.0
	page_size = minf(size.y - top - 40.0, size.x - 600.0)
	var left := 300.0
	var right := size.x - 290.0
	page_center = Vector2((left + right) / 2.0, top + page_size / 2.0)
	k = page_size / 100.0

# --- crayons --------------------------------------------------------------------------

func _build_crayons() -> void:
	crayons.clear()
	for i in tune["crayons"]:
		var p: Dictionary = PAINTS[i]
		crayons.append({"c": Color(p["c"]), "name": p["name"], "mode": 0, "slide": 0.0, "press": 0.0})
	if tune["magic"]:
		for m in MAGIC:
			crayons.append({"c": Color(m["c"]), "name": m["name"], "mode": m["mode"], "slide": 0.0, "press": 0.0})
	var n := crayons.size()
	var top := 150.0
	var span := size.y - top - 30.0
	var step := minf(112.0, span / n)
	crayon_th = minf(70.0, step * 0.78)
	var y0 := top + (span - step * n) / 2.0 + step / 2.0
	for i in n:
		crayons[i]["y"] = y0 + i * step
		crayons[i]["h"] = step
	sel = mini(sel, n - 1)
	crayon_node.queue_redraw()

func _draw_crayons() -> void:
	var cn := crayon_node
	var x1 := size.x - 24.0
	var t := Time.get_ticks_msec() / 1000.0
	for i in crayons.size():
		var c: Dictionary = crayons[i]
		var off: float = c["slide"] * 70.0 + c["press"] * 14.0
		var y: float = c["y"]
		var th := crayon_th
		var x0 := x1 - crayon_len - off
		var xe := x1 - off
		if i == sel:
			var g: Texture2D = World.tex("glow")
			var gs := th * 3.2
			cn.draw_texture_rect(g, Rect2(Vector2(x0 + crayon_len * 0.25 - gs / 2, y - gs / 2), Vector2(gs, gs)), false, Color(1, 1, 0.85, 0.75 + 0.2 * sin(t * 5.0)))
		# shadow
		cn.draw_rect(Rect2(Vector2(x0 + th * 0.55, y - th / 2 + 6), Vector2(xe - x0 - th * 0.55, th)), Color(0.2, 0.1, 0.3, 0.18))
		var body := Rect2(Vector2(x0 + th * 0.62, y - th / 2), Vector2(xe - x0 - th * 0.62, th))
		var col: Color = c["c"]
		# body: plain, rainbow stripes, or gold
		if c["mode"] == 1:
			var bands := 6
			for b in bands:
				var hc := Color.from_hsv(fmod(b / float(bands) + t * 0.1, 1.0), 0.65, 1.0)
				cn.draw_rect(Rect2(body.position + Vector2(0, th * b / bands), Vector2(body.size.x, th / bands + 1)), hc)
		elif c["mode"] == 2:
			cn.draw_rect(body, Color("#f2b81f"))
			cn.draw_rect(Rect2(body.position + Vector2(0, th * 0.12), Vector2(body.size.x, th * 0.22)), Color("#fff0a0"))
			for s in 3:
				var sx := body.position.x + fmod(t * 60.0 + s * 70.0, body.size.x)
				cn.draw_circle(Vector2(sx, y - th * 0.15 + s * th * 0.12), th * 0.06, Color(1, 1, 1, 0.9))
		else:
			cn.draw_rect(body, col)
			cn.draw_rect(Rect2(body.position + Vector2(0, th * 0.62), Vector2(body.size.x, th * 0.38)), col.darkened(0.14))
			cn.draw_rect(Rect2(body.position + Vector2(0, th * 0.12), Vector2(body.size.x, th * 0.16)), col.lightened(0.35))
		# paper wrapper with two bands
		var wrap := Rect2(Vector2(body.position.x + body.size.x * 0.3, y - th / 2), Vector2(body.size.x * 0.5, th))
		cn.draw_rect(wrap, Color(1, 1, 1, 0.55))
		cn.draw_rect(Rect2(wrap.position + Vector2(wrap.size.x * 0.1, 0), Vector2(th * 0.12, th)), Color(col.darkened(0.3), 0.55))
		cn.draw_rect(Rect2(wrap.position + Vector2(wrap.size.x * 0.85, 0), Vector2(th * 0.12, th)), Color(col.darkened(0.3), 0.55))
		# round cap at the end
		cn.draw_circle(Vector2(xe, y), th / 2, col.darkened(0.08) if c["mode"] == 0 else Color("#e0a020"))
		# sharpened wood and coloured tip
		var wood := PackedVector2Array([Vector2(x0 + th * 0.62, y - th / 2), Vector2(x0 + th * 0.62, y + th / 2), Vector2(x0, y)])
		cn.draw_colored_polygon(wood, Color("#f5d6a8"))
		var tipc := col if c["mode"] == 0 else (Color.from_hsv(fmod(t * 0.3, 1.0), 0.7, 1.0) if c["mode"] == 1 else Color("#f2b81f"))
		var tip := PackedVector2Array([Vector2(x0 + th * 0.24, y - th * 0.19), Vector2(x0 + th * 0.24, y + th * 0.19), Vector2(x0, y)])
		cn.draw_colored_polygon(tip, tipc)
		# outline
		var ink := Color(0.24, 0.2, 0.32, 0.55)
		cn.draw_polyline(PackedVector2Array([Vector2(xe, y - th / 2), Vector2(x0 + th * 0.62, y - th / 2), Vector2(x0, y),
			Vector2(x0 + th * 0.62, y + th / 2), Vector2(xe, y + th / 2)]), ink, 3.0, true)
		if c["c"] == Color.WHITE and c["mode"] == 0:
			cn.draw_rect(body, ink, false, 2.0)

func _crayon_at(p: Vector2) -> int:
	if p.x < size.x - crayon_len - 110.0:
		return -1
	for i in crayons.size():
		if absf(p.y - crayons[i]["y"]) < crayons[i]["h"] / 2.0:
			return i
	return -1

func pick_crayon(i: int) -> void:
	sel = i
	crayons[i]["press"] = 1.0
	Game.play("tap", 0.7)
	Game.note("xylophone", ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6", "D6", "E6", "G6", "C7"][i % 12], 0.5)
	say("%s!" % crayons[i]["name"])

# --- pages --------------------------------------------------------------------------------

static func E(cx: float, cy: float, rx: float, ry: float, rot := 0.0, n := 44) -> PackedVector2Array:
	var out := PackedVector2Array()
	for i in n:
		var a := TAU * i / n
		var v := Vector2(cos(a) * rx, sin(a) * ry).rotated(rot)
		out.append(Vector2(cx, cy) + v)
	return out

static func R(x: float, y: float, w: float, h: float, r := 0.0) -> PackedVector2Array:
	if r <= 0.0:
		return PackedVector2Array([Vector2(x, y), Vector2(x + w, y), Vector2(x + w, y + h), Vector2(x, y + h)])
	var out := PackedVector2Array()
	var corners := [Vector2(x + w - r, y + r), Vector2(x + w - r, y + h - r), Vector2(x + r, y + h - r), Vector2(x + r, y + r)]
	for c in 4:
		for j in 7:
			var a := -PI / 2 + (c + j / 6.0) * PI / 2
			out.append(corners[c] + Vector2(cos(a), sin(a)) * r)
	return out

static func Q(p0: Vector2, c: Vector2, p1: Vector2, n := 16) -> PackedVector2Array:
	var out := PackedVector2Array()
	for i in n + 1:
		var t := float(i) / n
		out.append(p0.lerp(c, t).lerp(c.lerp(p1, t), t))
	return out

static func band(cx: float, cy: float, r1: float, r2: float, a0: float, a1: float, n := 40) -> PackedVector2Array:
	var out := PackedVector2Array()
	for i in n + 1:
		var a := lerpf(a0, a1, float(i) / n)
		out.append(Vector2(cx, cy) + Vector2(cos(a), sin(a)) * r2)
	for i in n + 1:
		var a := lerpf(a1, a0, float(i) / n)
		out.append(Vector2(cx, cy) + Vector2(cos(a), sin(a)) * r1)
	return out

static func join(arrs: Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for a in arrs:
		out.append_array(a)
	return out

static func V(x: float, y: float) -> Vector2:
	return Vector2(x, y)

## A page: parts {name: [pivot, parent]}, regions [[pts, part]], details
## [[pts, part, closed]], fixed [[pts, part, color]] (never coloured).
func define(id_: String) -> Dictionary:
	var BG := R(0, 0, 100, 100, 4)
	match id_:
		"ball":
			return {"parts": {"bg": [V(50, 50), ""], "shadow": [V(50, 92), ""], "ball": [V(50, 52), ""]},
				"regions": [[BG, "bg"], [E(50, 92, 36, 6), "shadow"], [E(50, 52, 34, 34), "ball"],
					[join([Q(V(50, 18), V(22, 52), V(50, 86)), Q(V(50, 86), V(78, 52), V(50, 18))]), "ball"],
					[join([Q(V(17.5, 50), V(19, 70), V(36, 82)), Q(V(36, 82), V(25, 64), V(17.5, 50))]), "ball"],
					[join([Q(V(82.5, 50), V(81, 70), V(64, 82)), Q(V(64, 82), V(75, 64), V(82.5, 50))]), "ball"],
					[E(50, 19.5, 6, 3.6), "ball"]],
				"fixed": [[E(36, 34, 6, 3.5, -0.6), "ball", Color(1, 1, 1, 0.75)]]}
		"icecream":
			return {"parts": {"bg": [V(50, 50), ""], "cone": [V(50, 70), ""], "scoops": [V(50, 52), ""], "cherry": [V(50, 14), "scoops"]},
				"regions": [[BG, "bg"], [PackedVector2Array([V(33, 52), V(67, 52), V(50, 96)]), "cone"],
					[E(37, 41, 15, 14), "scoops"], [E(63, 41, 15, 14), "scoops"], [E(50, 27, 16, 15), "scoops"],
					[R(31, 47, 38, 9, 4.5), "scoops"], [E(50, 10, 5.5, 5.5), "cherry"]],
				"details": [[PackedVector2Array([V(39, 62), V(58, 74)]), "cone", false], [PackedVector2Array([V(61, 62), V(43, 80)]), "cone", false],
					[PackedVector2Array([V(45, 70), V(54, 86)]), "cone", false], [Q(V(50, 4.6), V(52, 0.5), V(57, 1)), "cherry", false]],
				"fixed": [[E(47.5, 8, 1.6, 1, -0.5), "cherry", Color(1, 1, 1, 0.8)]]}
		"flower":
			var regs := [[BG, "bg"], [join([PackedVector2Array([V(30, 78), V(70, 78)]), PackedVector2Array([V(64, 98), V(36, 98)])]), "pot"],
				[R(27, 73, 46, 8, 3), "pot"], [R(47.5, 44, 5, 30, 2), "stem"], [E(37, 62, 11, 5, -0.5), "stem"], [E(63, 58, 11, 5, 0.5), "stem"]]
			for i in 6:
				var a := TAU * i / 6.0 - PI / 2
				regs.append([E(50 + cos(a) * 15, 28 + sin(a) * 15, 10.5, 7.5, a), "bloom"])
			regs.append([E(50, 28, 9, 9), "bloom"])
			return {"parts": {"bg": [V(50, 50), ""], "pot": [V(50, 88), ""], "stem": [V(50, 74), ""], "bloom": [V(50, 28), "stem"]},
				"regions": regs, "fixed": [[E(47, 25, 2.2, 1.4, -0.4), "bloom", Color(1, 1, 1, 0.7)]]}
		"butterfly":
			return {"parts": {"bg": [V(50, 50), ""], "subject": [V(50, 50), ""], "wl": [V(50, 50), "subject"], "wr": [V(50, 50), "subject"], "body": [V(50, 50), "subject"]},
				"regions": [[BG, "bg"], [E(30, 36, 20, 16, -0.4), "wl"], [E(33, 64, 14, 12, 0.4), "wl"], [E(28, 35, 7, 6), "wl"], [E(34, 65, 5, 4), "wl"],
					[E(70, 36, 20, 16, 0.4), "wr"], [E(67, 64, 14, 12, -0.4), "wr"], [E(72, 35, 7, 6), "wr"], [E(66, 65, 5, 4), "wr"],
					[E(50, 52, 5, 22), "body"], [E(50, 27, 6.5, 6.5), "body"]],
				"details": [[Q(V(48, 22), V(42, 10), V(35, 9)), "body", false], [Q(V(52, 22), V(58, 10), V(65, 9)), "body", false]],
				"fixed": [[E(35, 9, 1.8, 1.8), "body", INK], [E(65, 9, 1.8, 1.8), "body", INK], [E(48, 26, 1.1, 1.4), "body", INK], [E(52, 26, 1.1, 1.4), "body", INK]]}
		"fish":
			return {"parts": {"bg": [V(50, 50), ""], "sand": [V(50, 94), ""], "bubbles": [V(18, 18), ""], "subject": [V(50, 50), ""], "tail": [V(72, 50), "subject"], "fishbody": [V(50, 50), "subject"]},
				"regions": [[BG, "bg"], [join([PackedVector2Array([V(0, 100)]), Q(V(0, 88), V(50, 78), V(100, 88)), PackedVector2Array([V(100, 100)])]), "sand"],
					[join([Q(V(8, 100), V(1, 86), V(8, 70)), Q(V(8, 70), V(15, 86), V(13, 100))]), "sand"],
					[join([Q(V(88, 100), V(82, 84), V(90, 74)), Q(V(90, 74), V(96, 86), V(93, 100))]), "sand"],
					[E(18, 18, 5, 5), "bubbles"], [E(10, 30, 3.5, 3.5), "bubbles"], [E(25, 8, 3, 3), "bubbles"],
					[PackedVector2Array([V(70, 50), V(94, 31), V(90, 50), V(94, 69)]), "tail"],
					[join([Q(V(38, 34), V(50, 12), V(64, 34))]), "fishbody"], [join([Q(V(40, 66), V(46, 80), V(58, 67))]), "fishbody"],
					[E(46, 50, 30, 19), "fishbody"], [join([Q(V(36, 34), V(27, 50), V(36, 66)), Q(V(36, 66), V(45, 50), V(36, 34))]), "fishbody"]],
				"details": [[Q(V(19, 57), V(23, 61), V(27, 58)), "fishbody", false]],
				"fixed": [[E(27, 46, 4, 4), "fishbody", Color.WHITE], [E(26.2, 46.4, 2.2, 2.4), "fishbody", INK], [E(25.5, 45.3, 0.8, 0.8), "fishbody", Color.WHITE]]}
		"house":
			return {"parts": {"bg": [V(50, 50), ""], "ground": [V(50, 90), ""], "sun": [V(84, 14), ""], "cloud": [V(19, 21), ""], "house": [V(50, 60), ""]},
				"regions": [[BG, "bg"], [join([PackedVector2Array([V(0, 100)]), Q(V(0, 82), V(50, 70), V(100, 82)), PackedVector2Array([V(100, 100)])]), "ground"],
					[E(84, 14, 9, 9), "sun"], [E(14, 22, 10, 6), "cloud"], [E(24, 19, 9, 7), "cloud"],
					[R(62, 22, 8, 18), "house"], [R(24, 48, 52, 38), "house"], [PackedVector2Array([V(17, 50), V(50, 21), V(83, 50)]), "house"],
					[R(44, 62, 13, 24, 6), "house"], [R(29, 56, 11, 11, 2), "house"], [R(61, 56, 11, 11, 2), "house"]],
				"details": [[PackedVector2Array([V(34.5, 56), V(34.5, 67)]), "house", false], [PackedVector2Array([V(29, 61.5), V(40, 61.5)]), "house", false],
					[PackedVector2Array([V(66.5, 56), V(66.5, 67)]), "house", false], [PackedVector2Array([V(61, 61.5), V(72, 61.5)]), "house", false]],
				"fixed": [[E(53.5, 75, 1.1, 1.1), "house", INK]]}
		"rainbow":
			var regs := [[BG, "bg"]]
			for i in 5:
				var r2 := 44.0 - i * 6.5
				regs.append([band(50, 74, r2 - 6.5, r2, PI, TAU), "arc"])
			regs.append_array([[E(17, 76, 14, 9), "cloudL"], [E(29, 72, 10, 8), "cloudL"], [E(83, 76, 14, 9), "cloudR"], [E(71, 72, 10, 8), "cloudR"], [E(86, 14, 8, 8), "sun"]])
			return {"parts": {"bg": [V(50, 50), ""], "arc": [V(50, 74), ""], "cloudL": [V(22, 74), ""], "cloudR": [V(78, 74), ""], "sun": [V(86, 14), ""]},
				"regions": regs}
		"car":
			return {"parts": {"bg": [V(50, 50), ""], "road": [V(50, 90), ""], "subject": [V(50, 60), ""], "car": [V(50, 60), "subject"], "wheelL": [V(30, 74), "subject"], "wheelR": [V(70, 74), "subject"]},
				"regions": [[BG, "bg"], [R(0, 82, 100, 18), "road"],
					[PackedVector2Array([V(30, 52), V(38, 34), V(64, 34), V(74, 52)]), "car"], [R(12, 50, 76, 22, 8), "car"],
					[PackedVector2Array([V(34, 50), V(40, 38), V(50, 38), V(50, 50)]), "car"], [PackedVector2Array([V(54, 50), V(54, 38), V(62, 38), V(69, 50)]), "car"],
					[E(86, 58, 3, 3), "car"], [E(30, 74, 10, 10), "wheelL"], [E(30, 74, 4, 4), "wheelL"], [E(70, 74, 10, 10), "wheelR"], [E(70, 74, 4, 4), "wheelR"]],
				"details": [[PackedVector2Array([V(52, 54), V(52, 68)]), "car", false], [PackedVector2Array([V(56, 58), V(60, 58)]), "car", false],
					[PackedVector2Array([V(22, 91), V(32, 91)]), "road", false], [PackedVector2Array([V(46, 91), V(56, 91)]), "road", false], [PackedVector2Array([V(70, 91), V(80, 91)]), "road", false]],
				"fixed": [[PackedVector2Array([V(30, 68), V(31, 74), V(30, 80), V(29, 74)]), "wheelL", Color(1, 1, 1, 0.6)], [PackedVector2Array([V(70, 68), V(71, 74), V(70, 80), V(69, 74)]), "wheelR", Color(1, 1, 1, 0.6)]]}
	return {}

func new_page(first := false) -> void:
	var pages: Array = tune["pages"]
	page_id = pages[page_i % pages.size()]
	page_i += 1
	complete = false
	alive_t = 0.0
	fills = 0
	peeked = false
	next_btn.visible = false
	if door_cat:
		door_cat.queue_free()
		door_cat = null
	var old := page
	if old:
		var tw := old.create_tween()
		tw.tween_property(old, "position:x", -page_size, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
		tw.parallel().tween_property(old, "rotation", -0.4, 0.45)
		tw.tween_callback(old.queue_free)
	_build_page(define(page_id))
	page.scale = Vector2(0.2, 0.2)
	page.rotation = 0.3
	var t2 := page.create_tween()
	t2.tween_interval(0.25 if old else 0.0)
	t2.tween_property(page, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	t2.parallel().tween_property(page, "rotation", -0.015, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Game.play("swipe", 0.6)
	get_tree().create_timer(0.6 if first else 0.3).timeout.connect(func(): say("בואי נצבע %s!" % PAGE_NAMES[page_id]))

func _build_page(def: Dictionary) -> void:
	page = Node2D.new()
	page.position = page_center
	page.z_index = 7
	add_child(page)
	var card := Node2D.new()
	card.draw.connect(func():
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color.WHITE
		sb.set_corner_radius_all(int(k * 4.0))
		sb.shadow_color = Color(0.2, 0.15, 0.35, 0.25)
		sb.shadow_size = 18
		sb.shadow_offset = Vector2(0, 12)
		var pad := k * 2.5
		card.draw_style_box(sb, Rect2(Vector2(-50, -50) * k - Vector2(pad, pad), Vector2(100, 100) * k + Vector2(pad, pad) * 2)))
	page.add_child(card)
	parts.clear()
	regions.clear()
	var pdef: Dictionary = def["parts"]
	# parts in definition order; a parent is always defined before its children
	for name in pdef:
		var piv: Vector2 = pdef[name][0]
		var parent_name: String = pdef[name][1]
		var n := Node2D.new()
		var parent_piv := Vector2(50, 50)
		var parent_node: Node2D = page
		if parent_name != "":
			parent_piv = pdef[parent_name][0]
			parent_node = parts[parent_name]["node"]
		n.position = (piv - parent_piv) * k
		parent_node.add_child(n)
		parts[name] = {"node": n, "pivot": piv, "base": n.position}
	# fills, then fixed decorations, then outlines on top within each part
	var lines := []
	for r in def["regions"]:
		var pts: PackedVector2Array = r[0]
		var part: Dictionary = parts[r[1]]
		var local := PackedVector2Array()
		for p in pts:
			local.append((p - part["pivot"]) * k)
		var poly := Polygon2D.new()
		poly.polygon = local
		poly.antialiased = true
		var mat := ShaderMaterial.new()
		mat.shader = shader
		var b := _bounds(local)
		mat.set_shader_parameter("bounds", Vector4(b.position.x, b.position.y, b.size.x, b.size.y))
		poly.material = mat
		part["node"].add_child(poly)
		regions.append({"poly": poly, "mat": mat, "mode": -1, "col": Color.WHITE, "part": r[1], "pts": local, "bounds": b})
		lines.append([local, r[1], true])
	for f in def.get("fixed", []):
		var part: Dictionary = parts[f[1]]
		var local := PackedVector2Array()
		for p in f[0]:
			local.append((p - part["pivot"]) * k)
		var poly := Polygon2D.new()
		poly.polygon = local
		poly.color = f[2]
		poly.antialiased = true
		poly.z_index = 1
		part["node"].add_child(poly)
	for d in def.get("details", []):
		var part: Dictionary = parts[d[1]]
		var local := PackedVector2Array()
		for p in d[0]:
			local.append((p - part["pivot"]) * k)
		lines.append([local, d[1], d[2]])
	for l in lines:
		var line := Line2D.new()
		line.points = l[0]
		line.closed = l[2]
		line.width = k * 0.95
		line.default_color = INK
		line.joint_mode = Line2D.LINE_JOINT_ROUND
		line.begin_cap_mode = Line2D.LINE_CAP_ROUND
		line.end_cap_mode = Line2D.LINE_CAP_ROUND
		line.antialiased = true
		line.z_index = 2
		parts[l[1]]["node"].add_child(line)

static func _bounds(pts: PackedVector2Array) -> Rect2:
	var r := Rect2(pts[0], Vector2.ZERO)
	for p in pts:
		r = r.expand(p)
	return r

## The topmost region under a screen point, or -1.
func region_at(p: Vector2) -> int:
	for i in range(regions.size() - 1, -1, -1):
		var r: Dictionary = regions[i]
		var poly: Polygon2D = r["poly"]
		var lp: Vector2 = poly.get_global_transform().affine_inverse() * p
		if Geometry2D.is_point_in_polygon(lp, r["pts"]):
			return i
	return -1

# --- colouring ----------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventScreenTouch and event.pressed):
		return
	var p: Vector2 = event.position
	var ci := _crayon_at(p)
	if ci >= 0:
		pick_crayon(ci)
		return
	if next_btn.visible and next_pop > 0.5 and p.distance_to(next_btn.position) < 110.0:
		_next()
		return
	if p.distance_to(luli.position + Vector2(0, -luli.height * 0.55)) < luli.height * 0.5:
		luli.poke()
		say("%s!" % crayons[sel]["name"])
		return
	var ri := region_at(p)
	if ri >= 0:
		fill(ri, p)

func fill(ri: int, p: Vector2) -> void:
	var r: Dictionary = regions[ri]
	var c: Dictionary = crayons[sel]
	var poly: Polygon2D = r["poly"]
	var node: Node2D = parts[r["part"]]["node"]
	if r["mode"] == c["mode"] and r["col"] == c["c"]:
		# the same colour again: the part giggles instead
		_wobble(node)
		Fx.burst(fx, p, [Color.WHITE, Color("#fff3a0")], 10, 0.35)
		Game.slide("flute", "A6", [[0, 1.0], [0.08, 1.12], [0.16, 0.96], [0.26, 1.1]], 0.3)
		return
	var mat: ShaderMaterial = r["mat"]
	var lp: Vector2 = poly.get_global_transform().affine_inverse() * p
	var b: Rect2 = r["bounds"]
	var reach := 0.0
	for corner in [b.position, b.end, Vector2(b.position.x, b.end.y), Vector2(b.end.x, b.position.y)]:
		reach = maxf(reach, lp.distance_to(corner))
	mat.set_shader_parameter("old_col", r["col"])
	mat.set_shader_parameter("old_mode", r["mode"])
	mat.set_shader_parameter("new_col", c["c"])
	mat.set_shader_parameter("new_mode", c["mode"])
	mat.set_shader_parameter("origin", lp)
	r["col"] = c["c"]
	r["mode"] = c["mode"]
	var tw := create_tween()
	tw.tween_method(func(v: float): mat.set_shader_parameter("radius", v), 0.0, reach + 10.0, 0.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		mat.set_shader_parameter("old_col", r["col"])
		mat.set_shader_parameter("old_mode", r["mode"])
		mat.set_shader_parameter("radius", 0.0))
	_wobble(node, 0.5)
	var splash: Color = c["c"] if c["mode"] == 0 else (Color("#ffd23d") if c["mode"] == 2 else Fx.RAINBOW.pick_random())
	Fx.burst(fx, p, [splash, splash.lightened(0.4), Color.WHITE], 16, 0.45)
	Game.play("pop", 0.55, 1.2)
	Game.note("harp", ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"].pick_random(), 0.4)
	fills += 1
	luli.feel("happy", 0.5)
	if fills % 5 == 0 and not complete:
		say(["יפה!", "וואו!", "איזה צבע!", "עוד!"].pick_random())
	var done_n := regions.filter(func(x): return x["mode"] >= 0).size()
	if not peeked and done_n * 2 >= regions.size() and not complete:
		peeked = true
		_peek()
	if not complete and done_n == regions.size():
		complete = true
		get_tree().create_timer(0.6).timeout.connect(_come_alive)

func _wobble(node: Node2D, amt := 1.0) -> void:
	var s0 := node.scale
	var tw := node.create_tween()
	tw.tween_property(node, "scale", s0 * Vector2(1.0 + 0.08 * amt, 1.0 - 0.06 * amt), 0.07)
	tw.tween_property(node, "scale", s0, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)

## Halfway through, an animal pops up over the page edge to have a look.
func _peek() -> void:
	var c := Creature.new()
	c.species = ["cat", "bunny", "dog", "mouse", "pig", "fox", "panda", "bear"].pick_random()
	c.height = size.y * 0.24
	var side := 1.0 if randf() < 0.5 else -1.0
	var x := page_center.x + side * page_size * 0.38
	var bottom := page_center.y + page_size * 0.5 + 40.0
	c.position = Vector2(x, bottom + c.height)
	c.z_index = 6
	add_child(c)
	var tw := c.create_tween()
	tw.tween_property(c, "position:y", bottom + c.height * 0.15, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		c.feel("surprised", 0.8)
		c.voice()
		say("וואו!"))
	tw.tween_interval(1.6)
	tw.tween_callback(c.celebrate)
	tw.tween_interval(1.0)
	tw.tween_property(c, "position:y", bottom + c.height * 1.2, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.tween_callback(c.queue_free)

# --- the page comes alive ------------------------------------------------------------------

func _come_alive() -> void:
	alive_t = 0.0
	say("איזה יפה!")
	reward(page_center, 2, true)
	score(1)
	Game.arp("harp", ["C5", "E5", "G5", "C6", "E6"], 0.07, 0.5)
	match page_id:
		"car":
			_honk()
		"house":
			_door_cat()
		"fish":
			Game.slide("flute", "C5", [[0, 0.8], [0.3, 1.2], [0.6, 0.9]], 0.4)
		"butterfly":
			Game.arp("xylophone", ["G6", "A6", "C7", "D7", "E7"], 0.06, 0.4)
	get_tree().create_timer(1.6).timeout.connect(func():
		next_btn.visible = true
		next_pop = 0.0
		var tw := create_tween()
		tw.tween_property(self, "next_pop", 1.0, 0.6).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
		Game.play("chime", 0.6))

func _honk() -> void:
	Game.slide("piano", "G4", [[0, 1.0], [0.12, 1.0]], 0.8)
	get_tree().create_timer(0.22).timeout.connect(func(): Game.slide("piano", "G4", [[0, 1.0], [0.2, 1.0]], 0.8))

func _door_cat() -> void:
	var house: Node2D = parts["house"]["node"]
	door_cat = Creature.new()
	door_cat.species = "cat"
	door_cat.height = k * 20.0
	door_cat.position = (Vector2(50.5, 86) - parts["house"]["pivot"]) * k
	door_cat.scale = Vector2(0.05, 0.05)
	door_cat.z_index = 3
	house.add_child(door_cat)
	var tw := door_cat.create_tween()
	tw.tween_property(door_cat, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		door_cat.celebrate()
		door_cat.voice())

func _alive(dt: float) -> void:
	alive_t += dt
	var t := alive_t
	var P := func(n: String) -> Node2D: return parts[n]["node"]
	var base := func(n: String) -> Vector2: return parts[n]["base"]
	match page_id:
		"ball":
			var h := absf(sin(t * 3.2))
			var ball: Node2D = P.call("ball")
			ball.position = base.call("ball") + Vector2(0, -h * k * 16.0)
			var sq := 1.0 - maxf(0.0, 0.25 - h) * 0.8
			ball.scale = Vector2(2.0 - sq, sq)
			ball.rotation = sin(t * 1.6) * 0.3
			(P.call("shadow") as Node2D).scale = Vector2.ONE * (1.0 - h * 0.35)
			if fmod(t, PI / 3.2) < dt:
				Game.play("boing", 0.35)
		"icecream":
			(P.call("scoops") as Node2D).rotation = sin(t * 5.0) * 0.08
			var cherry: Node2D = P.call("cherry")
			cherry.position = base.call("cherry") + Vector2(0, -absf(sin(t * 4.0)) * k * 6.0)
			cherry.rotation = sin(t * 8.0) * 0.4
		"flower":
			var bloom: Node2D = P.call("bloom")
			bloom.rotation = t * 0.8
			bloom.scale = Vector2.ONE * (1.12 + 0.08 * sin(t * 3.0))
			(P.call("stem") as Node2D).rotation = sin(t * 1.5) * 0.06
			if fmod(t, 0.7) < dt:
				Fx.hearts(fx, bloom.global_position, 1)
		"butterfly":
			var flap := absf(sin(t * 11.0))
			(P.call("wl") as Node2D).scale.x = 0.3 + flap * 0.7
			(P.call("wr") as Node2D).scale.x = 0.3 + flap * 0.7
			var sub: Node2D = P.call("subject")
			sub.position = base.call("subject") + Vector2(sin(t * 0.9) * k * 20.0, sin(t * 1.8) * k * 10.0)
			sub.rotation = cos(t * 0.9) * 0.25
			if fmod(t, 0.25) < dt:
				Fx.trail_spark(fx, sub.global_position + Vector2(0, k * 10), Fx.RAINBOW.pick_random())
		"fish":
			var sub: Node2D = P.call("subject")
			var x := sin(t * 0.7) * k * 14.0
			sub.position = base.call("subject") + Vector2(x, sin(t * 1.4) * k * 3.0)
			sub.scale.x = -1.0 if cos(t * 0.7) > 0.0 else 1.0
			(P.call("tail") as Node2D).rotation = sin(t * 9.0) * 0.3
			var bub: Node2D = P.call("bubbles")
			bub.position = base.call("bubbles") + Vector2(sin(t * 2.0) * k * 1.5, -fmod(t * k * 6.0, k * 10.0))
			if fmod(t, 0.9) < dt:
				var mouth := sub.global_position + Vector2(-k * 24.0 * sub.scale.x, -k * 2.0)
				Fx.trail_spark(fx, mouth, Color(0.85, 0.95, 1.0))
				Game.note("xylophone", ["C7", "E7", "G7"].pick_random(), 0.2)
		"house":
			(P.call("sun") as Node2D).rotation = t * 0.6
			(P.call("sun") as Node2D).scale = Vector2.ONE * (1.0 + 0.08 * sin(t * 3.0))
			(P.call("cloud") as Node2D).position = base.call("cloud") + Vector2(sin(t * 0.5) * k * 6.0, 0)
			smoke_t -= dt
			if smoke_t <= 0.0:
				smoke_t = 0.35
				_smoke((P.call("house") as Node2D).to_global((Vector2(66, 20) - parts["house"]["pivot"]) * k))
		"rainbow":
			(P.call("sun") as Node2D).rotation = t * 0.6
			(P.call("cloudL") as Node2D).position = base.call("cloudL") + Vector2(0, sin(t * 1.6) * k * 2.0)
			(P.call("cloudR") as Node2D).position = base.call("cloudR") + Vector2(0, sin(t * 1.6 + 1.5) * k * 2.0)
			var arc: Node2D = P.call("arc")
			arc.scale = Vector2.ONE * (1.0 + 0.03 * sin(t * 2.5))
			if fmod(t, 0.15) < dt:
				var a := PI + fmod(t * 0.9, 1.0) * PI
				Fx.trail_spark(fx, arc.to_global(Vector2(cos(a), sin(a)) * k * 32.0), Fx.RAINBOW.pick_random())
		"car":
			var sub: Node2D = P.call("subject")
			var x := sin(t * 0.8) * k * 16.0
			var vx := cos(t * 0.8)
			sub.position = base.call("subject") + Vector2(x, -absf(sin(t * 9.0)) * k * 0.8)
			(P.call("wheelL") as Node2D).rotation += vx * dt * 6.0
			(P.call("wheelR") as Node2D).rotation += vx * dt * 6.0
			honk_t -= dt
			if honk_t <= 0.0:
				honk_t = 4.0
				if alive_t > 0.5:
					_honk()
			if fmod(t, 0.2) < dt:
				Fx.trail_spark(fx, sub.to_global(Vector2(-k * 40.0 * signf(vx), k * 8.0)), Color(0.9, 0.9, 0.95))

func _smoke(p: Vector2) -> void:
	var s := Sprite2D.new()
	s.texture = World.tex("cloud")
	s.position = p
	s.scale = Vector2(0.05, 0.05)
	s.modulate = Color(1, 1, 1, 0.85)
	s.z_index = 9
	add_child(s)
	var tw := s.create_tween().set_parallel(true)
	tw.tween_property(s, "position", p + Vector2(randf_range(-20, 40), -k * 20.0), 2.2)
	tw.tween_property(s, "scale", Vector2(0.18, 0.16), 2.2)
	tw.tween_property(s, "modulate:a", 0.0, 2.2)
	tw.chain().tween_callback(s.queue_free)

func _next() -> void:
	next_btn.visible = false
	Game.play("open", 0.7)
	new_page()

func _draw_next() -> void:
	var r := 92.0 * next_pop
	if r < 2.0:
		return
	var t := Time.get_ticks_msec() / 1000.0
	r *= 1.0 + 0.06 * sin(t * 4.0)
	var g: Texture2D = World.tex("glow")
	next_btn.draw_texture_rect(g, Rect2(Vector2(-r, -r) * 2.0, Vector2(r, r) * 4.0), false, Color(1, 0.95, 0.6, 0.8))
	next_btn.draw_circle(Vector2(0, r * 0.1), r, Color(0.15, 0.25, 0.5, 0.25))
	next_btn.draw_circle(Vector2.ZERO, r, Color("#3f8ff0"))
	next_btn.draw_circle(Vector2(-r * 0.12, -r * 0.15), r * 0.8, Color("#6fb0ff"))
	next_btn.draw_arc(Vector2.ZERO, r * 0.88, 0, TAU, 48, Color.WHITE, r * 0.08, true)
	# an arrow pointing the way Hebrew reads: to the left
	var a := PackedVector2Array([Vector2(-r * 0.5, 0), Vector2(0, -r * 0.45), Vector2(0, -r * 0.18), Vector2(r * 0.45, -r * 0.18),
		Vector2(r * 0.45, r * 0.18), Vector2(0, r * 0.18), Vector2(0, r * 0.45)])
	next_btn.draw_colored_polygon(a, Color.WHITE)

func _process(dt: float) -> void:
	super._process(dt)
	for c in crayons:
		c["slide"] = move_toward(c["slide"], 1.0 if crayons.find(c) == sel else 0.0, dt * 5.0)
		c["press"] = move_toward(c["press"], 0.0, dt * 4.0)
	crayon_node.queue_redraw()
	if complete and page:
		_alive(dt)
	if next_btn.visible:
		next_btn.position = page_center + Vector2(-page_size * 0.5 - 20.0, page_size * 0.5 - 60.0)
		next_btn.queue_redraw()
	# an idle hint: the chosen crayon wiggles
	if idle > 4.0 and not crayons.is_empty():
		crayons[sel]["press"] = 0.5 + 0.5 * sin(idle * 8.0)

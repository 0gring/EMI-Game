class_name Painted
## Layouts for the painted characters: where each piece cut from a generated
## art sheet sits on the rig. Any species listed here is built from its
## painted pieces (art/<kit>/*.png) everywhere it appears; the rest keep their
## drawn SVG parts.
##
## Units are Creature's design units: 1000 tall, origin between the feet, body
## pivot 60 up, head centre 620 above that. Face and ear positions are
## relative to the head centre. A missing mouth falls back to the drawn one.

const KITS := {
	"unicorn": {
		"kit": "luli",
		"head_h": 730,
		"ears": {"x": 225, "y": -260, "h": 250, "anchor": Vector2(0.5, 0.92), "rot": 0.35},
		"tail": {"pos": Vector2(150, -170), "h": 330, "anchor": Vector2(0.15, 0.25)},
		"eyes": {"x": 150, "y": -70, "h": 190, "happy_h": 90, "happy_y": -80},
		"mouth": {"y": 250, "h": 110},
		"cheeks": {"x": 225, "y": 40},
		"behind_head": [["mane", Vector2(0, -70), 880, Vector2(0.5, 0.5), 0.0]],
		"over_head": [["lock_s", Vector2(-70, -300), 190, Vector2(0.5, 0.5), -0.3],
			["horn", Vector2(25, -300), 230, Vector2(0.5, 0.95), 0.08]],
		"arm_rest": 0.12,
	},
	"frog": {
		"kit": "frog",
		"head_h": 560, "head_y": 40,
		"eyes": {"x": 215, "y": -150, "h": 175, "happy_h": 80, "happy_y": -160},
		# the painted head already smiles: the idle mouth is the head's own
		"mouth": {"y": 60, "h": 130, "idle": ""},
		"cheeks": {"x": 300, "y": 70},
		"arm_rest": 0.2,
	},
	"mouse": {
		"kit": "mouse",
		"head_h": 640,
		"ears": {"x": 260, "y": -180, "h": 330, "anchor": Vector2(0.55, 0.85), "rot": 0.25},
		"tail": {"pos": Vector2(150, -150), "h": 230, "anchor": Vector2(0.05, 0.5)},
		"eyes": {"x": 160, "y": -40, "h": 150, "happy_h": 70, "happy_y": -50},
		"mouth": {"y": 215, "h": 80, "idle": ""},
		"cheeks": {"x": 250, "y": 70},
		"arm_rest": 0.12,
	},
	"pig": {
		"kit": "pig",
		"head_h": 640,
		"ears": {"x": 215, "y": -185, "h": 290, "anchor": Vector2(0.55, 0.9), "rot": 0.3},
		"tail": {"pos": Vector2(150, -190), "h": 140, "anchor": Vector2(0.2, 0.5)},
		"eyes": {"x": 145, "y": -40, "h": 150, "happy_h": 70, "happy_y": -50},
		"mouth": {"y": 235, "h": 70},
		"cheeks": {"x": 235, "y": 80},
	},
	"bear": {
		"kit": "bear",
		"head_h": 640,
		"ears": {"x": 260, "y": -235, "h": 230, "anchor": Vector2(0.5, 0.75), "rot": 0.2},
		"tail": {"pos": Vector2(150, -130), "h": 120, "anchor": Vector2(0.3, 0.5)},
		"eyes": {"x": 145, "y": -40, "h": 150, "happy_h": 70, "happy_y": -50},
		# the bear's mouths are whole muzzles, laid over the painted one
		"mouth": {"y": 145, "h": 215},
		"cheeks": {"x": 235, "y": 60},
	},
	"fox": {
		"kit": "fox",
		"head_h": 600,
		"ears": {"x": 180, "y": -180, "h": 260, "anchor": Vector2(0.5, 0.95), "rot": 0.3},
		"tail": {"pos": Vector2(150, -120), "h": 430, "anchor": Vector2(0.12, 0.85)},
		"eyes": {"x": 135, "y": -25, "h": 140, "happy_h": 65, "happy_y": -35},
		"mouth": {"y": 160, "h": 80},
		"cheeks": {"x": 225, "y": 70},
	},
	"panda": {
		"kit": "panda",
		"head_h": 620,
		"ears": {"x": 245, "y": -215, "h": 220, "anchor": Vector2(0.5, 0.75), "rot": 0.2},
		"tail": {"pos": Vector2(140, -130), "h": 110, "anchor": Vector2(0.3, 0.5)},
		# eyes sit inside the painted black patches
		"eyes": {"x": 128, "y": -45, "h": 140, "happy_h": 60, "happy_y": -50},
		"mouth": {"y": 150, "h": 70},
		"cheeks": {"x": 235, "y": 75},
	},
	"dog": {
		"kit": "dog",
		"head_h": 640,
		"ears": {"x": 335, "y": -150, "h": 400, "anchor": Vector2(0.62, 0.08), "rot": 0.1},
		"tail": {"pos": Vector2(140, -150), "h": 170, "anchor": Vector2(0.05, 0.5)},
		"eyes": {"x": 140, "y": -50, "h": 150, "happy_h": 70, "happy_y": -55},
		# whole muzzles, each pinned to the painted head's nose
		"mouth": {"y": 65, "h": 90, "px": 0.79, "anchors": {"smile": Vector2(0.48, 0.29), "open": Vector2(0.48, 0.22),
			"o": Vector2(0.5, 0.18), "grin": Vector2(0.48, 0.26), "tongue": Vector2(0.47, 0.27)}},
		"cheeks": {"x": 235, "y": 70},
	},
	"cat": {
		"kit": "cat",
		"head_h": 600,
		"ears": {"x": 165, "y": -195, "h": 270, "anchor": Vector2(0.5, 0.92), "rot": 0.25},
		"tail": {"pos": Vector2(140, -150), "h": 150, "anchor": Vector2(0.04, 0.35)},
		# eyes laid over the closed ones painted on the head
		"eyes": {"x": 136, "y": -116, "h": 150, "happy_h": 70, "happy_y": -120},
		# the painted head's own smile when idle; whole muzzles, pinned by the nose, otherwise
		"mouth": {"y": 84, "h": 90, "idle": "", "px": 0.75, "anchors": {"open": Vector2(0.47, 0.16), "o": Vector2(0.5, 0.17),
			"grin": Vector2(0.49, 0.16), "tongue": Vector2(0.49, 0.18)}},
		"cheeks": {"x": 225, "y": 60},
	},
	"bunny": {
		"kit": "bunny",
		"head_h": 600,
		"ears": {"x": 140, "y": -220, "h": 470, "anchor": Vector2(0.5, 0.95), "rot": 0.15},
		"tail": {"pos": Vector2(140, -130), "h": 130, "anchor": Vector2(0.3, 0.5)},
		"eyes": {"x": 140, "y": -40, "h": 150, "happy_h": 70, "happy_y": -45},
		"mouth": {"y": 95, "h": 90, "px": 0.6, "anchors": {"smile": Vector2(0.49, 0.24), "open": Vector2(0.5, 0.12),
			"o": Vector2(0.49, 0.16), "grin": Vector2(0.5, 0.12)}},
		"cheeks": {"x": 230, "y": 90},
	},
}

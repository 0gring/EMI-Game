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
}

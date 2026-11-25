class_name Hebrew
## Vowel marks (niqqud) for everything the game says out loud.
##
## Hebrew is written without vowels, so a speech engine has to guess them, and
## guesses wrong: "בואי נשחק" came out "nish-hak" instead of "ne-sa-HEK". Every
## word the game speaks is looked up here and sent to the engine fully
## vocalised; the speech bubble still shows the plain spelling.
##
## Words missing from the table are spoken as written and collected in
## `missing`, which the play-test checks is empty - so a new phrase cannot ship
## without its vowels.

const WORDS := {
	# greetings and Luli
	"שלום": "שָׁלוֹם", "אמי": "אֶמִּי", "בואי": "בּוֹאִי", "נשחק": "נְשַׂחֵק", "היי": "הַיי",
	"זה": "זֶה", "מדגדג": "מְדַגְדֵּג", "אני": "אֲנִי", "לולי": "לוּלִי", "איזה": "אֵיזֶה",
	"כיף": "כֵּיף", "נפוצץ": "נְפוֹצֵץ", "החיות": "הַחַיּוֹת", "רעבות": "רְעֵבוֹת",
	"נאכיל": "נַאֲכִיל", "אותן": "אוֹתָן", "חיות": "חַיּוֹת",
	# praise and levels
	"כל": "כָּל", "הכבוד": "הַכָּבוֹד", "עלית": "עָלִית", "שלב": "שָׁלָב", "את": "אַתְּ",
	"אלופה": "אַלּוּפָה", "וואו": "וָאוּ",
	# balloons and colours
	"בלונים": "בָּלוֹנִים", "בלון": "בָּלוֹן", "קשת": "קֶשֶׁת",
	"אדומים": "אֲדֻמִּים", "צהובים": "צְהֻבִּים", "כחולים": "כְּחֻלִּים", "ירוקים": "יְרֻקִּים",
	"סגולים": "סְגֻלִּים", "כתומים": "כְּתֻמִּים", "ורודים": "וְרֻדִּים",
	"אדום": "אָדֹם", "צהוב": "צָהֹב", "כחול": "כָּחֹל", "ירוק": "יָרֹק",
	"סגול": "סָגֹל", "כתום": "כָּתֹם", "ורוד": "וָרֹד",
	# counting
	"אפס": "אֶפֶס", "אחת": "אַחַת", "שתיים": "שְׁתַּיִם", "שלוש": "שָׁלוֹשׁ", "ארבע": "אַרְבַּע",
	"חמש": "חָמֵשׁ", "שש": "שֵׁשׁ", "שבע": "שֶׁבַע", "שמונה": "שְׁמוֹנֶה", "תשע": "תֵּשַׁע", "עשר": "עֶשֶׂר",
	# animals
	"ארנב": "אַרְנָב", "חתול": "חָתוּל", "כלב": "כֶּלֶב", "דוב": "דֹּב", "חזיר": "חֲזִיר",
	"שועל": "שׁוּעָל", "פנדה": "פַּנְדָּה", "עכבר": "עַכְבָּר", "צפרדע": "צְפַרְדֵּעַ",
	# feeding
	"רעב": "רָעֵב", "בבקשה": "בְּבַקָּשָׁה", "מלא": "מָלֵא", "סליחה": "סְלִיחָה", "תודה": "תּוֹדָה",
	# the hub's sign-posts
	"האי": "הָאִי", "הקסום": "הַקָּסוּם", "של": "שֶׁל",
}

static var missing: Array[String] = []

## The same sentence with every known word vocalised; punctuation kept.
static func vocalize(text: String) -> String:
	var out := ""
	var word := ""
	for ch in text + " ":
		var code := ch.unicode_at(0)
		if code >= 0x05D0 and code <= 0x05EA:
			word += ch
			continue
		if word != "":
			out += _word(word)
			word = ""
		out += ch
	return out.substr(0, out.length() - 1)

static func _word(w: String) -> String:
	if WORDS.has(w):
		return WORDS[w]
	if not missing.has(w):
		missing.append(w)
	return w

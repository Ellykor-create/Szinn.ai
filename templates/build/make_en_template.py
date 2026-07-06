#!/usr/bin/env python3
"""Bouwt templates/blueprint.en.html uit blueprint.nl.html door alle vaste
(niet-gepersonaliseerde) teksten te vertalen. Tokens blijven ongemoeid.
Elke vervanging asserteert een unieke match."""

NL = "/Users/danil/Documents/UDefine docs/Szinn.ai/templates/blueprint.nl.html"
EN = "/Users/danil/Documents/UDefine docs/Szinn.ai/templates/blueprint.en.html"

html = open(NL, encoding="utf-8").read()
count = 0

def rep(old, new, n=1):
    global html, count
    found = html.count(old)
    assert found == n, f"'{old[:90]}' matcht {found}x (verwacht {n})"
    html = html.replace(old, new)
    count += 1

def span(prefix, suffix, replacement):
    """Vervang het unieke bereik prefix...suffix (inclusief) door replacement."""
    global html, count
    i = html.find(prefix)
    assert i >= 0, f"prefix niet gevonden: {prefix[:80]}"
    assert html.find(prefix, i + 1) < 0, f"prefix niet uniek: {prefix[:80]}"
    j = html.find(suffix, i + len(prefix))
    assert j >= 0, f"suffix niet gevonden na prefix: {suffix[:80]}"
    html = html[:i] + replacement + html[j + len(suffix):]
    count += 1

# ── Document ─────────────────────────────────────────────────────────────────
rep('<html lang="nl">', '<html lang="en">')

# ── Nav ──────────────────────────────────────────────────────────────────────
rep('>Visie</a>', '>Vision</a>')
rep('>Introductie</a>', '>Introduction</a>')
rep('>Astrologie</a>', '>Astrology</a>')
rep('>Knopen</a>', '>Nodes</a>')
rep('>Numerologie</a>', '>Numerology</a>')
rep('>Overzicht</a>', '>Overview</a>')
rep('>Reflectie</a>', '>Reflection</a>')
rep('>Energie</a>', '>Energy</a>')
rep('>Integratie</a>', '>Integration</a>')
rep('>Verdieping</a>', '>Deepening</a>')

# ── Hero ─────────────────────────────────────────────────────────────────────
rep('<div class="hero-ey">Jouw persoonlijke Alignment Blueprint</div>',
    '<div class="hero-ey">Your personal Alignment Blueprint</div>')
span('<p class="hero-desc">Een spiegel van wie je bent', 'wat er al in je zit.</p>',
     '<p class="hero-desc">A mirror of who you are, composed from your birth chart, your numbers and your soul task. Not a prediction and not a judgment. An invitation to remember what is already within you.</p>')
rep('<div class="hcard-eye">Kern</div>', '<div class="hcard-eye">Core</div>')
rep('<div class="hcard-eye">Energiepatronen</div>', '<div class="hcard-eye">Energy patterns</div>')
rep('<div class="hcard-eye">Alignment-overzicht</div>', '<div class="hcard-eye">Alignment overview</div>')
rep('<div class="hcard-title">Jouw authentieke zelf</div>', '<div class="hcard-title">Your authentic self</div>')
rep('<div class="hcard-title">Jouw terugkerende cycli</div>', '<div class="hcard-title">Your recurring cycles</div>')
rep('<div class="hcard-title">Jouw totale alignment</div>', '<div class="hcard-title">Your total alignment</div>')
rep('<div class="hcard-sub">Kaart · Numerologie · Knopen</div>', '<div class="hcard-sub">Chart · Numerology · Nodes</div>')
rep('Astrologie<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_ASTRO}}</span>',
    'Astrology<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_ASTRO}}</span>')
rep('Numerologie<br><span style="font-size:11px;color:var(--ink)">{{L_LIFEPATH}}',
    'Numerology<br><span style="font-size:11px;color:var(--ink)">{{L_LIFEPATH}}')
rep('Zielrichting<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_SOUL}}</span>',
    'Soul direction<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_SOUL}}</span>')
rep('Persoonlijk Jaar<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_YEAR}}</span>',
    'Personal Year<br><span style="font-size:11px;color:var(--ink)">{{AI_HERO_ALIGN_YEAR}}</span>')

# ── Mini-row ─────────────────────────────────────────────────────────────────
rep('<div class="mini-lbl">Zielsgroei-richting</div>', '<div class="mini-lbl">Soul growth direction</div>')
rep('<div class="mini-lbl">Innerlijk weten</div>', '<div class="mini-lbl">Inner knowing</div>')
rep('<div class="mini-lbl">Kernuitstraling</div>', '<div class="mini-lbl">Core radiance</div>')
rep('<div class="mini-lbl">Levensblauwdruk</div>', '<div class="mini-lbl">Life blueprint</div>')
rep('<div class="mini-val">Noordknoop {{NN_SIGN}} · H{{NN_HOUSE}}</div>',
    '<div class="mini-val">North Node {{NN_SIGN}} · H{{NN_HOUSE}}</div>')

# ── Dashboard ────────────────────────────────────────────────────────────────
rep('<h2>Jouw <em>Dashboard</em></h2>', '<h2>Your <em>Dashboard</em></h2>')
span('<p>Dit dashboard is geen rapportcijfer.', 'niet als een eindoordeel.</p>',
     '<p>This dashboard is not a report card. Through four lenses it shows where your energy stands right now in relation to your full potential. A strongly activated layer means movement; a lightly activated layer means untouched terrain, the place with the greatest potential. Read it as a compass, not as a final verdict.</p>')
rep('<div class="feedback-label">Hoe je dit dashboard leest</div>', '<div class="feedback-label">How to read this dashboard</div>')
span('<div class="fb-block"><h4>Dit is geen eindoordeel</h4>', 'geen perfectie.</p></div>',
     '<div class="fb-block"><h4>This is not a final verdict</h4><p>It is a snapshot of where your energy stands right now in relation to your full potential. A lightly activated layer means untouched terrain, not failure. A strongly activated layer means movement, not perfection.</p></div>')
span('<div class="fb-block"><h4>De praktijken hieronder activeren de lagen</h4>', 'levend navigatie-instrument.</p></div>',
     '<div class="fb-block"><h4>The practices below activate the layers</h4><p>Every section in this Blueprint touches at least one layer. The more you integrate the energy of your chart, the more will start to move. This is not a static document, but a living navigation instrument.</p></div>')

# ── Sectie 01 — Visie & Missie ───────────────────────────────────────────────
rep('<div class="sec-num">01 — Visie &amp; Missie</div>', '<div class="sec-num">01 — Vision &amp; Mission</div>')
rep('<h2>Jij bent <em>de blauwdruk.</em></h2>', '<h2>You are <em>the blueprint.</em></h2>')
rep('<h3>Visie</h3>', '<h3>Vision</h3>')
span('<p>Een wereld waarin mensen leven vanuit wie ze werkelijk zijn.', 'daarna bovenop is gestapeld.</p>',
     '<p>A world in which people live from who they truly are. Not from conditioning. Not from fear. Not from what others expect of them or what the system demands. But from the unique blueprint every human carries at birth — the energetic signature of who you are, apart from everything that was stacked on top of it afterwards.</p>')
span('<p>Een mens die leeft vanuit zijn eigen blauwdruk verandert de wereld', 'verbinding in plaats van behoefte.</p>',
     '<p>A person who lives from their own blueprint changes the world around them. Not through grand gestures or outer revolution, but through the quiet, fundamental shift that happens when someone stops surviving and starts living. A person aligned with themselves gives differently, leads differently, loves differently, creates differently. From abundance instead of scarcity. From awareness instead of fear. From connection instead of need.</p>')
span('<blockquote>"Als genoeg mensen herinneren wie ze zijn', 'vanzelf."</blockquote>',
     '<blockquote>"When enough people remember who they are, the world around us changes by itself."</blockquote>')
rep('<h3>Missie</h3>', '<h3>Mission</h3>')
span('<p>SZINN bestaat om mensen te helpen zichzelf te herinneren.', 'waarheid bent gaan dragen.</p>',
     '<p>SZINN exists to help people remember themselves. Not learn. Not become. Remember — because what you encounter in this document is not new information. It is a mirror showing what is already within you, what has always been there, beneath the conditioning, beneath the patterns, beneath the story others built about you and that you, at some point, started carrying as your own truth.</p>')
rep('<h3>De vier bewegingen</h3>', '<h3>The four movements</h3>')
span('<p>SZINN begeleidt die herinnering via vier bewegingen', 'het begin van vrijheid.</p>',
     '<p>SZINN guides that remembering through four movements that together form the core of everything this Blueprint does. Recognition — the moment you see a pattern, not as something happening to you but as something you are running. As soon as you look at it instead of standing inside it, choice appears. And choice is the beginning of freedom.</p>')
span('<p>Helderheid, niet de helderheid van alle antwoorden weten', 'die jouw groei vraagt.</p>',
     '<p>Clarity — not the clarity of knowing all the answers, but the clarity of knowing who you are. Apart from what you do, apart from what others think of you, apart from the roles you carry. Clarity about your energy, your qualities, your shadow sides and the direction your growth is asking for.</p>')
span('<p>Richting, geen bestemming, maar een kompasrichting.', 'vanzelf zichtbaar.</p>',
     '<p>Direction — not a destination, but a compass bearing. A sense of moving from alignment instead of from reaction. When you know who you are and where you stand, the next step becomes visible by itself.</p>')
span('<p>Integratie, het sluitstuk en tegelijkertijd het moeilijkste.', 'weet maar belichaamt.</p>',
     '<p>Integration — the capstone and at the same time the hardest part. Knowledge is not enough. Integration is the moment insight actually changes behaviour. That you not only understand but live it. Not only know it but embody it.</p>')
span('<p>De naam SZINN draagt drie lagen', 'toegankelijk voor iedereen.</p>',
     '<p>The name SZINN carries three layers that form the core of this system. Sin is the sympathetic nervous system in overdrive, the masculine energy of structure and force that tips into stress and burnout. Zin is the parasympathetic nervous system in balance, the feminine energy of receiving and creation. Sinn is the conscious movement between the two, the childlike creative energy that arises when you learn to dance between masculine and feminine instead of being stuck on one side. This is not a spiritual concept. This is biology. And it makes the method accessible to everyone.</p>')
span('<p>Deze Blueprint is geen voorspelling en geen oordeel.', 'om ze te herkennen.</p>',
     '<p>This Blueprint is not a prediction and not a judgment. It is a mirror. It shows what is already present in you: patterns that repeat, strengths waiting to be used consciously, and a direction your soul already knows. The question is not whether these things live in you. The question is whether you are ready to recognise them.</p>')
span('<div class="ncell"><div class="nlbl">Herkenning</div>', 'verwachtingen</div></div>',
     '<div class="ncell"><div class="nlbl">Recognition</div><div class="nval">Who am I?</div><div class="ndesc">Your core, apart from roles and expectations</div></div>')
span('<div class="ncell"><div class="nlbl">Helderheid</div>', 'niet het aangeleerde</div></div>',
     '<div class="ncell"><div class="nlbl">Clarity</div><div class="nval">What do I want?</div><div class="ndesc">Your deepest longing, not the conditioned one</div></div>')
span('<div class="ncell"><div class="nlbl">Richting</div>', 'samen trekken</div></div>',
     '<div class="ncell"><div class="nlbl">Direction</div><div class="nval">Where am I going?</div><div class="ndesc">The line astrology, numerology and Kabbalah draw together</div></div>')
span('<div class="ncell"><div class="nlbl">Integratie</div>', 'in jouw eigen tempo</div></div>',
     '<div class="ncell"><div class="nlbl">Integration</div><div class="nval">How do I live this?</div><div class="ndesc">Concrete, daily, at your own pace</div></div>')
span('<div class="ncell"><div class="nlbl">Drie systemen</div>', 'Kabbalah/Tikkun</div></div>',
     '<div class="ncell"><div class="nlbl">Three systems</div><div class="nval">One instrument</div><div class="ndesc">Astrology · Numerology · Kabbalah/Tikkun</div></div>')
span('<div class="ncell"><div class="nlbl">Jouw rol</div>', 'geen instructie.</div></div>',
     '<div class="ncell"><div class="nlbl">Your role</div><div class="nval">Only expert</div><div class="ndesc">You are the only expert on yourself. This is an invitation, not an instruction.</div></div>')
rep('<blockquote>"Je was nooit jezelf kwijt. Je bent aan het herinneren."</blockquote>',
    '<blockquote>"You were never lost. You are remembering."</blockquote>')
span('<div class="note"><p>Dit document is vertrouwelijk en persoonlijk voor jou samengesteld.', 'bepaal je zelf.</p></div>',
     '<div class="note"><p>This document is confidential and was composed personally for you. It is not astrological advice, not a psychological diagnosis and not a promise. It is a mirror. What you see in it is up to you.</p></div>')

# ── Sectie 02 — Introductie ──────────────────────────────────────────────────
rep('<div class="sec-num">02 — Introductie</div>', '<div class="sec-num">02 — Introduction</div>')
rep('<h2>Een nieuw paradigma <em>van zelfherkenning.</em></h2>', '<h2>A new paradigm <em>of self-recognition.</em></h2>')
span('<p><em>Dit Szinn Alignment Blueprint is geen waarheid.', 'enige expert op jouzelf.</em></p>',
     '<p><em>This Szinn Alignment Blueprint is not a truth. It is a mirror, a reflection. What resonates, take with you. What does not fit, let go. Consider nothing here absolute truth. Explore for yourself. You are always the only expert on yourself.</em></p>')
span('<p>De meeste mensen leren zichzelf kennen via hoe anderen hen zien.', 'waar je moet kijken.</p>',
     '<p>Most people get to know themselves through how others see them. Through their role in a family, a job, a friendship. Through what is expected of them. SZINN assumes there is a deeper self — not shaped by circumstances but simply present. And that this deeper self has a signature, visible in the moments and patterns of your life, if you know where to look.</p>')
span('<div class="note"><p>Lees deze sectie niet als een oordeel.', 'laat het los.</p></div>',
     '<div class="note"><p>Do not read this section as a judgment. Read it as an invitation to look at yourself with a little more curiosity than usual. What resonates, take with you. What does not fit, let go.</p></div>')

# ── Sectie 03 — Flow ─────────────────────────────────────────────────────────
rep('<div class="sec-num">03 — Leven vanuit flow</div>', '<div class="sec-num">03 — Living from flow</div>')
span('<p>Hoe kan je leven vanuit flow? We staan continu aan.', 'waar je nu werkelijk staat.</p>',
     '<p>How can you live from flow? We are switched on all the time. We look for validation, direction and rest in what happens around us, while the only real movement runs from the inside out. In SZINN we work with a journey of awareness that moves from life happens to me, to life is for me, to life flows through me, to I create my life. Every phase begins with honesty about where you truly stand right now.</p>')
span('<p>Creatie ontstaat in de beweging tussen twee energieën.', 'Beide zijn nodig.</p>',
     '<p>Creation arises in the movement between two energies. The masculine energy of direction, action and focus, and the feminine energy of receiving, trusting and letting go. Neither is better. Both are needed.</p>')
span('<p>In de SZINN-methode noemen we dit Sin, Sinn en Zin.', 'Dit is biologie.</p>',
     '<p>In the SZINN method we call this Sin, Sinn and Zin. Sin is the sympathetic nervous system in overdrive, the masculine energy that tips into stress and burnout. Zin is the parasympathetic nervous system in balance, the feminine energy of receiving and creating. Sinn is the conscious movement between the two, the creative energy that arises when you learn to dance between masculine and feminine instead of being stuck on one side. This is not a spiritual concept. This is biology.</p>')
span('<p>Er zijn drie lagen waarop je altijd tegelijk werkt.', 'bewust of niet.</p>',
     '<p>There are three layers you always work on simultaneously. Sin is the body layer: your nervous system, your rhythm, your rest or fatigue. Sinn is the meaning layer: the question whether what you do has meaning, whether it truly fits. Zin is the intention layer: the direction you choose, consciously or not.</p>')
rep('<h3>Vijf reflectievragen over jouw flow</h3>', '<h3>Five reflection questions about your flow</h3>')

# ── Sectie 04 — Astrologie ───────────────────────────────────────────────────
rep('<div class="sec-num">04 — Astrologie</div>', '<div class="sec-num">04 — Astrology</div>')
rep('<h2>De <em>geboortekaart</em> van {{CLIENT_NAME}}</h2>', '<h2>The <em>birth chart</em> of {{CLIENT_NAME}}</h2>')
rep('<p>Placidus huizensysteem · Astronomische ephemeris · Berekend vanuit {{BIRTH_DATE_LONG}}, {{BIRTH_TIME}} {{BIRTH_CITY}}</p>',
    '<p>Placidus house system · Astronomical ephemeris · Calculated from {{BIRTH_DATE_LONG}}, {{BIRTH_TIME}} {{BIRTH_CITY}}</p>')
span('<p>Een geboortekaart is geen voorspelling. Het is een energetische vingerafdruk', 'altijd hoe je beweegt.</p>',
     '<p>A birth chart is not a prediction. It is an energetic fingerprint, a snapshot of the sky at the exact moment you arrived on this earth, at that specific place. The positions of the planets at that moment are seen as symbolic forces that resonate with who you are and how your energy works. Think of it as a map. The map does not determine how you travel, but it does show which mountains exist, where the rivers run and which roads are already there. You always decide how you move.</p>')
span('<p>Een geboortekaart bestaat uit drie lagen die je altijd samenleest.', 'directe uiterlijke expressie.</p>',
     '<p>A birth chart consists of three layers you always read together. The planets are the forces, archetypes of human experience. The signs are the quality through which those forces express themselves. The houses are the terrain: they tell you where in your life an energy plays out. The aspects, the angles between planets, describe how those energies are in conversation within you. A retrograde planet works inward instead of outward: more focused on reflection and deepening than on direct outer expression.</p>')
span('<p>Energie is neutraal. Ze is niet goed of slecht', 'vanaf nu wilt graven.</p>',
     '<p>Energy is neutral. It is not good or bad, it only wants to move. The patterns you have lived unconsciously are like channels the water flows through by itself. Becoming aware does not mean stopping those channels, but choosing which bed you want to dig from now on.</p>')
rep('<h3>Wat de planeten betekenen</h3>', '<h3>What the planets mean</h3>')
span('<p>De Zon is wie je bent als je vrij bent', 'komt brengen in de wereld.</p>',
     '<p>The Sun is who you are when you are free, your life purpose and your way of shining. The Moon is what you need inside, your emotional nature and how you feel safe. The Ascendant is how you enter the world, how others first experience you. Mercury is how you think and communicate. Venus is what you attract and what you are drawn to. Mars is how you act and what drives you. Jupiter is where you grow and expand. Saturn is where your life lessons live, what asks for structure and patience. Uranus, Neptune and Pluto are generational forces describing the larger field. Chiron is the wounded healer, the place where you carry a deep wound and can heal others precisely there. The MC is your calling, what you come to bring into the world.</p>')
rep('<h3>De twaalf huizen</h3>', '<h3>The twelve houses</h3>')
span('<div class="ncell"><div class="nlbl">Huis 1</div>', 'Begint bij de Ascendant.</div></div>',
     '<div class="ncell"><div class="nlbl">House 1</div><div class="nval">Identity &amp; body</div><div class="ndesc">How you enter the world, how you appear. Begins at the Ascendant.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 2</div>', 'veilig te voelen.</div></div>',
     '<div class="ncell"><div class="nlbl">House 2</div><div class="nval">Values</div><div class="ndesc">What you find valuable and what you need to feel safe.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 3</div>', 'omgeving ervaart.</div></div>',
     '<div class="ncell"><div class="nlbl">House 3</div><div class="nval">Communication</div><div class="ndesc">How you learn, speak and experience your immediate surroundings.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 4</div>', 'voor je betekent.</div></div>',
     '<div class="ncell"><div class="nlbl">House 4</div><div class="nval">Home &amp; roots</div><div class="ndesc">Your inner foundation, your origin, what home means to you.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 5</div>', 'vanuit vreugde maakt.</div></div>',
     '<div class="ncell"><div class="nlbl">House 5</div><div class="nval">Creativity</div><div class="ndesc">Play, pleasure, romance and everything you create from joy.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 6</div>', 'structuur van je dag.</div></div>',
     '<div class="ncell"><div class="nlbl">House 6</div><div class="nval">Work &amp; health</div><div class="ndesc">How you work, how you care for your body, the structure of your day.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 7</div>', 'verbinden en spiegelen.</div></div>',
     '<div class="ncell"><div class="nlbl">House 7</div><div class="nval">Relationships</div><div class="ndesc">What you attract in another and how you learn to connect and mirror.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 8</div>', 'de oppervlakte heen.</div></div>',
     '<div class="ncell"><div class="nlbl">House 8</div><div class="nval">Transformation</div><div class="ndesc">Shared resources, depth, crisis as catalyst. Through the surface.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 9</div>', 'zoektocht naar betekenis.</div></div>',
     '<div class="ncell"><div class="nlbl">House 9</div><div class="nval">Meaning</div><div class="ndesc">Travel, higher knowledge, the bigger story. The search for meaning.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 10</div>', 'Begint bij de MC.</div></div>',
     '<div class="ncell"><div class="nlbl">House 10</div><div class="nval">Calling</div><div class="ndesc">Your place in the world and what you come to contribute. Begins at the MC.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 11</div>', 'samen bouwt.</div></div>',
     '<div class="ncell"><div class="nlbl">House 11</div><div class="nval">Community</div><div class="ndesc">Friendships, networks and the future you build together.</div></div>')
span('<div class="ncell"><div class="nlbl">Huis 12</div>', 'onder alle lagen.</div></div>',
     '<div class="ncell"><div class="nlbl">House 12</div><div class="nval">The hidden life</div><div class="ndesc">Spirituality, the unconscious, what you rarely show. The layer beneath all layers.</div></div>')
rep('<h3>De aspecten</h3>', '<h3>The aspects</h3>')
span('<p>Aspecten zijn de hoeken die planeten met elkaar maken.', 'die om balans vraagt.</p>',
     '<p>Aspects are the angles planets make with each other. They describe how the energies within you are in conversation. A conjunction (0°) is fusion. A sextile (60°) is an opportunity. A square (90°) is friction that creates growth. A trine (120°) is flowing support. An opposition (180°) is a tension asking for balance.</p>')
rep('<thead><tr><th>Planeet</th><th>Positie</th><th>Huis</th><th>Kwaliteit</th></tr></thead>',
    '<thead><tr><th>Planet</th><th>Position</th><th>House</th><th>Quality</th></tr></thead>')
rep('<h3>Opvallende patronen in jouw kaart</h3>', '<h3>Striking patterns in your chart</h3>')

# ── Sectie 05 — Knopen ───────────────────────────────────────────────────────
rep('<div class="sec-num">05 — Noord- &amp; Zuidknoop</div>', '<div class="sec-num">05 — North &amp; South Node</div>')
rep('<h2>Van {{ZN_SIGN}} <em>naar {{NN_SIGN}}</em></h2>', '<h2>From {{ZN_SIGN}} <em>to {{NN_SIGN}}</em></h2>')
span('<p>De Noord- en Zuidknoop zijn geen planeten.', 'de groei van dit leven.</p>',
     '<p>The North and South Node are not planets. They are two mathematical points where the Moon’s orbit crosses the ecliptic. They always sit exactly opposite each other, 180 degrees apart: always an axis, always a tension between two directions. The South Node shows where you come from, what you already know, what you do almost reflexively and what feels safe. The North Node shows where you are growing toward, what feels new, sometimes uncomfortable — and precisely there lies the growth of this life.</p>')
span('<p>De bedoeling is niet om de Zuidknoop achter te laten.', 'versie van jezelf ontmoet.</p>',
     '<p>The intention is not to leave the South Node behind. See the South Node as the roots of a tree and the North Node as the direction the branches grow. Without roots a tree cannot grow; without growth the roots have no destination. The tension you feel when you move toward your North Node does not mean you are going the wrong way. Often it means you are meeting a new version of yourself.</p>')
span('<p>Je herkent de Zuidknoop aan wat moeiteloos lijkt te gaan.', 'vervulling plaatsvinden.</p>',
     '<p>You recognise the South Node by what seems effortless. It feels familiar, you hardly have to think about it, and under pressure you fall back on it. The South Node is not wrong; much of your natural strength lives here. You recognise the North Node by a feeling of uncertainty or resistance. It can feel like “this is not me” or “who am I to do this”. That is exactly why it is so valuable: it points to where growth and fulfilment happen.</p>')
rep('<div class="ncard-lbl">Zuidknoop — Oorsprong</div>', '<div class="ncard-lbl">South Node — Origin</div>')
rep('<div class="ncard-lbl">Noordknoop — Groeirichting</div>', '<div class="ncard-lbl">North Node — Growth direction</div>')
rep('<h3>{{ZN_SIGN}} · Huis {{ZN_HOUSE}}</h3>', '<h3>{{ZN_SIGN}} · House {{ZN_HOUSE}}</h3>')
rep('<h3>{{NN_SIGN}} · Huis {{NN_HOUSE}}</h3>', '<h3>{{NN_SIGN}} · House {{NN_HOUSE}}</h3>')
rep('<h3>Chiron in {{CHIRON_SIGN}} in Huis {{CHIRON_HOUSE}}</h3>', '<h3>Chiron in {{CHIRON_SIGN}} in House {{CHIRON_HOUSE}}</h3>')

# ── Sectie 06 — Numerologie ──────────────────────────────────────────────────
rep('<div class="sec-num">06 — Numerologie</div>', '<div class="sec-num">06 — Numerology</div>')
rep('<h2>De <em>getallen</em> van {{CLIENT_NAME}}</h2>', '<h2>The <em>numbers</em> of {{CLIENT_NAME}}</h2>')
rep('<p>Pythagorisch systeem · Berekend vanuit {{BIRTH_DATE_LONG}} en je geboortenaam · Meestergetallen niet gereduceerd</p>',
    '<p>Pythagorean system · Calculated from {{BIRTH_DATE_LONG}} and your birth name · Master numbers not reduced</p>')
span('<p>Numerologie is de studie van de symbolische en energetische betekenis van getallen.', 'Ze spiegelen.</p>',
     '<p>Numerology is the study of the symbolic and energetic meaning of numbers. The system we use is based on the teachings of Pythagoras: every number from 1 to 9 carries its own energy, its own character, its own movement. It does not predict what will happen; it makes visible which energies and patterns are active in your life. Numbers do not lie. They mirror.</p>')
span('<div class="ncell"><div class="nlbl">1 · Pionier</div>', 'eigenzinnigheid.</div></div>',
     '<div class="ncell"><div class="nlbl">1 · Pioneer</div><div class="nval">Beginning &amp; courage</div><div class="ndesc">The courage to go first. Shadow: wilfulness.</div></div>')
span('<div class="ncell"><div class="nlbl">2 · De brug</div>', 'afhankelijkheid.</div></div>',
     '<div class="ncell"><div class="nlbl">2 · The bridge</div><div class="nval">Connection</div><div class="ndesc">Sensitivity and cooperation. Shadow: dependence.</div></div>')
span('<div class="ncell"><div class="nlbl">3 · Schepper</div>', 'verstrooiing.</div></div>',
     '<div class="ncell"><div class="nlbl">3 · Creator</div><div class="nval">Expression</div><div class="ndesc">Creativity, joy, communication. Shadow: scattering.</div></div>')
span('<div class="ncell"><div class="nlbl">4 · Bouwer</div>', 'rigiditeit.</div></div>',
     '<div class="ncell"><div class="nlbl">4 · Builder</div><div class="nval">Structure</div><div class="ndesc">Foundation and reliability, building what lasts. Shadow: rigidity.</div></div>')
span('<div class="ncell"><div class="nlbl">5 · Avonturier</div>', 'rusteloosheid.</div></div>',
     '<div class="ncell"><div class="nlbl">5 · Adventurer</div><div class="nval">Freedom</div><div class="ndesc">Adventure, change, movement. Shadow: restlessness.</div></div>')
span('<div class="ncell"><div class="nlbl">6 · Verzorger</div>', 'jezelf verliezen.</div></div>',
     '<div class="ncell"><div class="nlbl">6 · Caregiver</div><div class="nval">Harmony</div><div class="ndesc">Care and responsibility, giving from love. Shadow: losing yourself.</div></div>')
span('<div class="ncell"><div class="nlbl">7 · Mysticus</div>', 'isolatie.</div></div>',
     '<div class="ncell"><div class="nlbl">7 · Mystic</div><div class="nval">Depth</div><div class="ndesc">Wisdom, seeking, inquiry. Shadow: isolation.</div></div>')
span('<div class="ncell"><div class="nlbl">8 · Meesterbouwer</div>', 'controle.</div></div>',
     '<div class="ncell"><div class="nlbl">8 · Master builder</div><div class="nval">Power</div><div class="ndesc">Harvest, authority, manifestation. Shadow: control.</div></div>')
span('<div class="ncell"><div class="nlbl">9 · Wijze</div>', 'martelaarschap.</div></div>',
     '<div class="ncell"><div class="nlbl">9 · Sage</div><div class="nval">Completion</div><div class="ndesc">Compassion and surrender, letting go. Shadow: martyrdom.</div></div>')
span('<p>De meestergetallen 11 (de ziener), 22 (de meesterbouwer) en 33', 'dit leven bent gestart.</p>',
     '<p>The master numbers 11 (the seer), 22 (the master builder) and 33 (the master teacher) carry a heightened vibration of their base number. They bring more potential, but also ask for more awareness and inner development. We work with your official birth name as registered on your birth certificate, not a nickname or married name: that is the energetic signature with which you started this life.</p>')
rep('<h3>De vijf kerngetallen</h3>', '<h3>The five core numbers</h3>')
span('<p>Het Levenspad, berekend uit je geboortedatum, is de centrale energie', 'voordat ze je echt kennen.</p>',
     '<p>The Life Path, calculated from your birth date, is the central energy of this life, your main theme and the lesson you came to learn. It never changes. The Personal Year, from your birth day, birth month and the current year, is the energy available this year, as part of a nine-year cycle. The Expression number, from your full birth name, is how you express yourself in the world: your talents and capacities. The Soul Urge, from the vowels in your name, is what your soul truly longs for, the most intimate number. The Personality number, from the consonants, is how others perceive you before they really know you.</p>')
rep('<h3>Levenspad {{LIFE_PATH}} — {{AI_LIFEPATH_TITLE}}</h3>', '<h3>Life Path {{LIFE_PATH}} — {{AI_LIFEPATH_TITLE}}</h3>')
rep('<h3>Persoonlijk Jaar {{PERSONAL_YEAR}} ({{GEN_YEAR}})</h3>', '<h3>Personal Year {{PERSONAL_YEAR}} ({{GEN_YEAR}})</h3>')
rep('<div class="ncard-lbl">De cyclus van {{GEN_YEAR}}</div>', '<div class="ncard-lbl">The cycle of {{GEN_YEAR}}</div>')

# ── Sectie 07 — Tikkun ───────────────────────────────────────────────────────
rep('<h2>De <em>zielstaak</em> van {{CLIENT_NAME}}</h2>', '<h2>The <em>soul task</em> of {{CLIENT_NAME}}</h2>')
span('<p>Tikkun is een Hebreeuws woord. Het betekent correctie, herstel, heelmaking.', 'totdat je erdoorheen kijkt.</p>',
     '<p>Tikkun is a Hebrew word. It means correction, repair, healing. In the Kabbalistic tradition it refers to the specific task your soul took upon itself in this life: what has it come to heal, to learn and to transform? It is not a punishment and not a flaw. It is a direction, a choice your soul made before you arrived here. It is the reason certain patterns keep returning, until you see through them.</p>')
span('<p>Waar numerologie je vertelt welke energie je meebrengt', 'niveau van de ziel.</p>',
     '<p>Where numerology tells you which energy you bring, and astrology shows how that energy unfolds, Tikkun goes a layer deeper. It does not ask who you are or how you function. It asks why you are here, at the level of the soul.</p>')
span('<p>Tikkun beschrijft drie dingen samen.', 'ermee te leren dansen.</p>',
     '<p>Tikkun describes three things together. The core wound is the theme that sits deepest, that appeared earliest and worked through longest: the place where your pain and your gift share the same address. The repetition pattern shows which themes keep returning in relationships, work and choices. And the soul task is the direction: what you had to learn the hardest is often exactly what you can later pass on most deeply. The intention is not to solve your Tikkun, but to learn to dance with it.</p>')

# ── Sectie 08 — Mandala ──────────────────────────────────────────────────────
rep('<h2>De <em>Mandala</em> van {{CLIENT_NAME}}</h2>', '<h2>The <em>Mandala</em> of {{CLIENT_NAME}}</h2>')
span('<p>Jouw volledige geboortekaart, gegenereerd vanuit jouw exacte geboortedata', 'Zuidknoop in {{ZN_SIGN}}.</p>',
     '<p>Your complete birth chart, generated from your exact birth data, with the planets at their precise ecliptic degrees. At the heart the Merkaba rotates on the node axis: the golden point reaches toward your North Node in {{NN_SIGN}} ({{NN_DEG}}), the amethyst toward your South Node in {{ZN_SIGN}}.</p>')
span('Dit patroon is als een QR-code van jouw ziel.', 'Kijk wat er beweegt.</p>',
     'This pattern is like a QR code of your soul. It is not meant to be understood with the head, but to be felt with the body. Breathe into it for six seconds, out for six seconds. Notice what moves.</p>')
span('<p>Sacred geometry is niet iets wat je begrijpt.', 'maar om te ontvangen.</p>',
     '<p>Sacred geometry is not something you understand. It is something you recognise. Your mandala is not an image to decipher, but a frequency to recognise. Look at it the way you look at the sun: not to analyse, but to receive.</p>')
span('<blockquote>Ademreeks 6 · 6 · 6 · 6', 'zes seconden stil.</blockquote>',
     '<blockquote>Breath sequence 6 · 6 · 6 · 6 — six seconds in, six seconds hold, six seconds out, six seconds still.</blockquote>')
span('<p>Het laat je adem volledig worden, kalmeert je zenuwstelsel', 'terug te keren naar jezelf.</p>',
     '<p>It lets your breath become complete, calms your nervous system and brings you back to stillness. Hang it somewhere you see it daily. Use it in moments of choice or doubt, not to find an answer but to return to yourself.</p>')

# ── Sectie 09 — Samenvatting ─────────────────────────────────────────────────
rep('<div class="sec-num">09 — Overzicht &amp; Samenvatting</div>', '<div class="sec-num">09 — Overview &amp; Summary</div>')
rep('<h2>{{CLIENT_NAME}} <em>in één zin</em></h2>', '<h2>{{CLIENT_NAME}} <em>in one sentence</em></h2>')
span('<p>Je hebt je door vier systemen bewogen', 'meest van je heeft gevraagd.</p>',
     '<p>You have moved through four systems that each describe the same thing from a different angle: who you are, what you carry and what you came here to do. Astrology showed how your energy works. Numerology gave you the numbers present at your birth. Kabbalah went a layer deeper: why you are here. Sacred geometry gave you a language your body already knows. Four languages, one truth. There is an energy in you larger than the story you tell about yourself, a direction deeper than the goals you consciously pursue, and a gift hidden precisely behind the place that has asked the most of you.</p>')

# ── Sectie 10 — Reflectie ────────────────────────────────────────────────────
rep('<div class="sec-num">10 — Reflectievragen</div>', '<div class="sec-num">10 — Reflection questions</div>')
rep('<h2>10 <em>journaling</em> vragen</h2>', '<h2>10 <em>journaling</em> questions</h2>')
span('<p>Geen informatie meer. Alleen jij en de vragen.', 'anders als je schrijft.</p>',
     '<p>No more information. Just you and the questions. Read each question slowly and wait for what comes up first, not for what sounds logical. Write it on paper, not in your head. Something different happens when you write.</p>')

# ── Sectie 11 — Energie ──────────────────────────────────────────────────────
rep('<div class="sec-num">11 — Werken met de energie</div>', '<div class="sec-num">11 — Working with the energy</div>')
rep('<h2>Jouw <em>ritme</em></h2>', '<h2>Your <em>rhythm</em></h2>')
rep('<p>Jouw dagelijkse en seizoensritme op basis van jouw kaart.</p>',
    '<p>Your daily and seasonal rhythm based on your chart.</p>')
span('<p>Je bent geen machine. Een machine werkt elke dag hetzelfde', 'natuur is van levende energie.</p>',
     '<p>You are not a machine. A machine works the same every day — same input, same output, without rhythm, without season, without ebb and flow. You are earth, fire, ether, air and water. And water moves in cycles. It rises and falls, fills and withdraws, is sometimes clear and sometimes murky. Not because something is wrong, but because that is the nature of living energy.</p>')
rep('<h3>De maan als kompas</h3>', '<h3>The moon as compass</h3>')
span('<p>Van alle cycli die het leven structureren is de maancyclus', 'eigen energiekwaliteit dragen.</p>',
     '<p>Of all the cycles that structure life, the lunar cycle is the most direct and most personally felt. The moon moves the water of the oceans, and your body consists largely of water. The cycle lasts about twenty-nine and a half days and moves through four main phases, each carrying its own quality of energy.</p>')
span('<div class="ncell"><div class="nlbl">Nieuwe maan</div>', 'niet voor actie.</div></div>',
     '<div class="ncell"><div class="nlbl">New moon</div><div class="nval">Sowing</div><div class="ndesc">The darkest point, with the most potential. A moment for intention, not for action.</div></div>')
span('<div class="ncell"><div class="nlbl">Wassende maan</div>', 'stappen zetten.</div></div>',
     '<div class="ncell"><div class="nlbl">Waxing moon</div><div class="nval">Building</div><div class="ndesc">The energy becomes more active and outward. Becoming visible and taking steps.</div></div>')
span('<div class="ncell"><div class="nlbl">Volle maan</div>', 'maar oogsten.</div></div>',
     '<div class="ncell"><div class="nlbl">Full moon</div><div class="nval">Harvesting</div><div class="ndesc">Everything stands in the light, emotions closer to the surface. Not pushing, but harvesting.</div></div>')
span('<div class="ncell"><div class="nlbl">Afnemende maan</div>', 'niet mee mag.</div></div>',
     '<div class="ncell"><div class="nlbl">Waning moon</div><div class="nval">Releasing</div><div class="ndesc">The energy withdraws. Evaluating, integrating and releasing what cannot come along.</div></div>')
span('<p>Werken met de maan betekent niet dat je alleen handelt bij wassende maan.', 'in plaats van ertegen.</p>',
     '<p>Working with the moon does not mean acting only when it waxes. It means beginning to notice patterns and learning to move with what is already there instead of against it.</p>')
rep('<h3>De elementen in jouw kaart</h3>', '<h3>The elements in your chart</h3>')

# ── Sectie 12 — Integratie ───────────────────────────────────────────────────
rep('<div class="sec-num">12 — Integratie</div>', '<div class="sec-num">12 — Integration</div>')
rep('<h2>Jouw persoonlijke <em>upgrade-plan</em></h2>', '<h2>Your personal <em>upgrade plan</em></h2>')
rep('<p><strong>Jouw vier lagen op dit moment:</strong><br>', '<p><strong>Your four layers at this moment:</strong><br>')
rep('Astrologie — {{AI_LAYERS_ASTRO}}<br>', 'Astrology — {{AI_LAYERS_ASTRO}}<br>')
rep('Numerologie — {{AI_LAYERS_NUM}}<br>', 'Numerology — {{AI_LAYERS_NUM}}<br>')
rep('Zielrichting — {{AI_LAYERS_SOUL}}<br>', 'Soul direction — {{AI_LAYERS_SOUL}}<br>')
rep('Persoonlijk Jaar — {{AI_LAYERS_YEAR}}<br>', 'Personal Year — {{AI_LAYERS_YEAR}}<br>')
rep('De praktijken hieronder richten zich op waar de meeste beweging mogelijk is. Voor jou is dat nu vooral: <strong>{{AI_LAYERS_FOCUS}}</strong>',
    'The practices below focus on where the most movement is possible. For you, right now, that is above all: <strong>{{AI_LAYERS_FOCUS}}</strong>')
span('<p>Dit is het moeilijkste deel. Niet omdat het ingewikkeld is', 'op een gewone dag.</p>',
     '<p>This is the hardest part. Not because it is complicated, but because it asks for honesty. Knowledge changes nothing. Recognition changes nothing. Even the deepest spiritual experience changes nothing unless it is followed by one thing: a different choice. In an ordinary moment, on an ordinary day.</p>')
rep('<h3>De wereld is jouw spiegel</h3>', '<h3>The world is your mirror</h3>')
span('<p>De werkelijkste, eerlijkste en meest directe spiegel', 'begin je bewust te creëren.</p>',
     '<p>The most real, honest and direct mirror you have is the world around you. The people in your life, the situations that keep returning, the things that irritate, touch, impress or repel you. Everything you see outside yourself is a reflection of what lives within you. The moment you recognise this clearly, you stop repeating unconsciously and start creating consciously.</p>')
rep('<h3>Schaduwkanten als spiegel</h3>', '<h3>Shadow sides as mirror</h3>')
span('<p>Wat je in een ander irriteert draagt een kwaliteit die ook in jou leeft', 'laten zien over mezelf?</p>',
     '<p>What irritates you in another carries a quality that also lives in you, otherwise it would not touch you. What you admire in another carries a quality that also lives in you, not yet fully claimed but present, otherwise you would not recognise it. Every judgment about another is a mirror. The question is never what is wrong with them, but always: what does this reaction want to show me about myself?</p>')
rep('<h3>Jouw schaduwkanten zijn niet je vijanden</h3>', '<h3>Your shadow sides are not your enemies</h3>')
rep('<h3>Jouw zes gaven</h3>', '<h3>Your six gifts</h3>')
span('<p>Er is iets wat jou onderscheidt van alles om je heen: zes vermogens', 'op een goed moment.</p>',
     '<p>There is something that sets you apart from everything around you: six faculties that allow you to stop, look and choose differently. Intuition is the knowing that arrives before reasoning does. Imagination is the ability to see something that does not yet exist. Memory is the ability to recognise patterns across time. Reasoning is the ability to make connections. Perception is how you see — and how you see it determines what you experience. Willpower is the ability to choose instead of react automatically. These six gifts are always available. They do not wait for a good moment.</p>')
rep('<h3>Hoe jouw zes gaven oplichten in je kaart</h3>', '<h3>How your six gifts light up in your chart</h3>')
span('<p>Je zes gaven zijn de kracht van je kaart in pure vorm.', 'kaart-energie stroomt.</p>',
     '<p>Your six gifts are the power of your chart in pure form. The more consciously you use them, the more your chart’s energy flows.</p>')
rep('<h3>De adem als sleutel</h3>', '<h3>The breath as key</h3>')
rep('<h3>Integratie in zes bewegingen</h3>', '<h3>Integration in six movements</h3>')
span('<p>Zodra je weerstand voelt, stop. Niet wegrennen', 'loopt door alles heen.</p>',
     '<p>The moment you feel resistance, stop. Do not run away, do not push through. Stop. And breathe, deep and conscious, with an out-breath longer than the in-breath. Feel what is there, without judgment. Look at it with the eyes of someone curious instead of afraid. Experience it fully, because what you fully experience and breathe through no longer has power over you. And then release what has done its work. Stop, breathe, feel, look, experience, release. The breath runs through all of it.</p>')
rep('<h3>De mandala als dagelijks integratietool</h3>', '<h3>The mandala as daily integration tool</h3>')
span('<p>Jouw mandala is de geometrische spiegel van wie je bent.', 'in plaats van reactief.</p>',
     '<p>Your mandala is the geometric mirror of who you are. The moment you recognise a pattern — an irritation or a reaction that asks more energy than the situation deserves — look at your mandala for a moment and return to yourself, to the frequency you emit when you are conscious instead of reactive.</p>')
rep('<h3>AI als dagelijkse gesprekspartner</h3>', '<h3>AI as daily conversation partner</h3>')
span('<p>AI kent jouw Blueprint, voer hem in.', 'zichtbaar is kun je kiezen.</p>',
     '<p>AI knows your Blueprint — feed it in. AI can help you connect what you have read here with what you experience today. Not as a therapist, but as a conversation partner who knows your context and asks you the questions you are not yet asking yourself. The power is not in the answers, but in the formulating. Because what you formulate becomes visible, and what is visible you can choose.</p>')
rep('<h3>Dagelijkse praktijken</h3>', '<h3>Daily practices</h3>')
rep('<h3>Zes AI-prompts voor jouw kaart</h3>', '<h3>Six AI prompts for your chart</h3>')
span('<p>Deze prompts zijn klaar voor gebruik in Claude of ChatGPT.', 'plak ze direct.</p>',
     '<p>These prompts are ready to use in Claude or ChatGPT. They are built on your specific chart data. Use them for reflection, for choices or for journaling. Copy and paste them directly.</p>')
rep('<p class="ptitle">Klik op de knop om een prompt te kopiëren</p>', '<p class="ptitle">Click the button to copy a prompt</p>')
rep('<h3>Persoonlijke kalender — {{CAL_RANGE}}</h3>', '<h3>Personal calendar — {{CAL_RANGE}}</h3>')
rep('<p>Je persoonlijke maandgetallen zijn berekend vanuit Persoonlijk Jaar {{PERSONAL_YEAR}}. Elke maand draagt een eigen kleur van energie. Hoe bewuster je dit ritme volgt, hoe meer je meebeweegt met de stroom van je jaar.</p>',
    '<p>Your personal month numbers are calculated from Personal Year {{PERSONAL_YEAR}}. Every month carries its own colour of energy. The more consciously you follow this rhythm, the more you move with the current of your year.</p>')

# ── Sectie 13 — Verdieping ───────────────────────────────────────────────────
rep('<div class="sec-num">13 — Verdieping</div>', '<div class="sec-num">13 — Deepening</div>')
rep('<h2>Waar ga je <em>vanaf hier</em> naartoe?</h2>', '<h2>Where do you go <em>from here</em>?</h2>')
span('<p>Deze Blueprint is een begin. Wat je hebt gelezen is een momentopname', 'blijft lagen toevoegen.</p>',
     '<p>This Blueprint is a beginning. What you have read is a snapshot of the energetic signature you have carried since your first breath. It is not complete and never can be. Life keeps adding layers.</p>')
span('<p>Dit document is niet bedoeld om in één keer te begrijpen.', 'jaar van nieuw begin staat.</p>',
     '<p>This document is not meant to be understood in one reading. Let it work on you. Return to it in the coming months. What feels abstract now may be exactly the sentence you need three months from now.</p>')
span('<div class="ncard"><div class="ncard-lbl">Optie 01</div>', 'voordeel werkt.</p></div>',
     '<div class="ncard"><div class="ncard-lbl">Option 01</div><h3>Progressions and transits</h3><p>If this Blueprint resonated, a next step is to look at your secondary progressions and the current planetary positions relative to your birth chart. This shows which themes are being activated now, and can time precisely when the energy works most strongly in favour of your growth.</p></div>')
span('<div class="ncard"><div class="ncard-lbl">Optie 02</div>', 'wilt vormgeven.</p></div>',
     '<div class="ncard"><div class="ncard-lbl">Option 02</div><h3>Tree of Life and 10 Sefirot</h3><p>The Kabbalah layer in this Blueprint touches the surface. The Tree of Life with the ten Sefirot offers a deeper map of how your soul works through layers of manifestation, from consciousness to the tangible reality you want to shape.</p></div>')
span('<div class="ncard"><div class="ncard-lbl">Optie 03</div>', 'beslissingen neemt.</p></div>',
     '<div class="ncard"><div class="ncard-lbl">Option 03</div><h3>Human Design or Gene Keys</h3><p>Human Design and Gene Keys are complementary systems that overlap with but also differ from astrology and numerology. They add an extra layer of information about your energetic type and how you best make decisions.</p></div>')
rep('<h3>Hoe je hiervandaan verder gaat</h3>', '<h3>How to continue from here</h3>')
span('<p>Dit document is een startpunt. Wat je ermee doet', 'die je kunt maken.</p>',
     '<p>This document is a starting point. What you do with it — every day, in small moments — is the real blueprint. There are four movements you can make.</p>')
span('<p><strong>Handelen:</strong> kies één praktijk uit je Blueprint', 'inzichten die je niet leeft.</p>',
     '<p><strong>Act:</strong> choose one practice from your Blueprint and do it today. Not tomorrow, not when you feel ready. Today, small, concrete. One movement toward your North Node is worth more than ten insights you do not live.</p>')
span('<p><strong>Contempleren</strong> is niet hetzelfde als denken.', 'het antwoord tonen.</p>',
     '<p><strong>Contemplating</strong> is not the same as thinking. Thinking is about solving; contemplating is about being present with what is. Take one question from section 10, not to answer it. Carry it with you for a week and let life show you the answer.</p>')
span('<p><strong>Blijf jezelf de juiste vragen stellen:</strong>', 'wat er nu resoneert.</p>',
     '<p><strong>Keep asking yourself the right questions:</strong> the questions in this document are not meant to be read once. A question that does nothing today may be exactly the sentence that shifts everything three months from now. Come back, read again, see what resonates now.</p>')
span('<p><strong>Praat met een mens.</strong>', 'elk van beide afzonderlijk.</p>',
     '<p><strong>Talk to a human.</strong> AI can mirror you, but a good conversation with someone who knows you and dares to challenge you goes further: someone who does not confirm what you already know, but asks the question you would rather avoid. The combination of this document plus a living conversation is more powerful than either on its own.</p>')
rep('<h3>Tot slot</h3>', '<h3>In closing</h3>')
rep('<h3>Bronnen, verdieping &amp; volgende stappen</h3>', '<h3>Sources, deepening &amp; next steps</h3>')
rep('<p>Dit document is het begin. Niet het einde. Hier zijn richtingen voor wie dieper wil gaan.</p>',
    '<p>This document is the beginning. Not the end. Here are directions for those who want to go deeper.</p>')
rep('>Aanvullende systemen om te verkennen</p>', '>Complementary systems to explore</p>')
span('<strong style="color:var(--ink);font-weight:600">Westerse astrologie</strong>', 'is gebouwd.</div>',
     '<strong style="color:var(--ink);font-weight:600">Western astrology</strong> is the tradition this Blueprint is built on.</div>')
span('<strong style="color:var(--ink);font-weight:600">Human Design</strong>', 'beslisstrategie.</div>',
     '<strong style="color:var(--ink);font-weight:600">Human Design</strong> describes your energetic type and decision strategy.</div>')
span('<strong style="color:var(--ink);font-weight:600">Gene Keys</strong>', 'de I Ching.</div>',
     '<strong style="color:var(--ink);font-weight:600">Gene Keys</strong> is a poetic transformation system based on the I Ching.</div>')
span('<strong style="color:var(--ink);font-weight:600">Vedische astrologie (Jyotish)</strong>', 'levensfasen toe.</div>',
     '<strong style="color:var(--ink);font-weight:600">Vedic astrology (Jyotish)</strong> adds karma, dharma and life phases.</div>')
span('<strong style="color:var(--ink);font-weight:600">I Ching</strong>', 'flow spreekt.</div>',
     '<strong style="color:var(--ink);font-weight:600">I Ching</strong> is a living oracle system that speaks the language of flow.</div>')
span('<strong style="color:var(--ink);font-weight:600">Kwantumfysica</strong>', 'beïnvloedt.</div>',
     '<strong style="color:var(--ink);font-weight:600">Quantum physics</strong> shows that the observer influences reality.</div>')
span('<p>Er zijn zoveel paden om te verdiepen', 'zijn eigen weg.</p>',
     '<p>There are so many paths to deepen and rediscover who you truly are. Everyone has their own way in this.</p>')
rep('>Hoe je met je Blueprint blijft werken</p>', '>How to keep working with your Blueprint</p>')
span('<p>Lees hem niet in één keer. Lees een sectie.', 'gaande te houden.</p>',
     '<p>Do not read it in one sitting. Read a section. Sit with it. Come back. Use the reflection questions as a daily practice. Work with your mandala. And use the AI prompts to keep the conversation with yourself going.</p>')
span('Vibratie is jouw aantrekkingskracht.', 'terug naar jezelf.</blockquote>',
     'Vibration is your attraction. Awareness is how you get to know that vibration. And creation is what arises when you stop surviving and start living.<br><br>You were never lost. You are on your way back to yourself.</blockquote>')
rep('<p style="font-size:12px;color:var(--muted)">SZINN · {{CLIENT_NAME}} · Blueprint {{GEN_YEAR}} · Persoonlijk en vertrouwelijk</p>',
    '<p style="font-size:12px;color:var(--muted)">SZINN · {{CLIENT_NAME}} · Blueprint {{GEN_YEAR}} · Personal and confidential</p>')

# ── Footer ───────────────────────────────────────────────────────────────────
rep('Gegenereerd {{GEN_YEAR}}<br>', 'Generated {{GEN_YEAR}}<br>')
span('© 2026 Elly Elizabeth Korving · Alterego BV · Alle rechten voorbehouden · szinn.ai<br>',
     'toestemming van Alterego BV.</p>',
     '© 2026 Elly Elizabeth Korving · Alterego BV · All rights reserved · szinn.ai<br>\n  This document is personal and confidential. Nothing in this document may be reproduced without the express written permission of Alterego BV.</p>')

open(EN, "w", encoding="utf-8").write(html)

# Restcontrole: welke herkenbaar-Nederlandse fragmenten staan er nog in (buiten base64/CSS)?
import re
clean = re.sub(r'[A-Za-z0-9+/=]{200,}', '', html)
clean = re.sub(r'<style[\s\S]*?</style>', '', clean)
clean = re.sub(r'<script[\s\S]*?</script>', '', clean)
words = ['jouw', 'jij ', ' het ', ' een ', 'niet ', ' je ', 'wordt', ' van de ']
hits = []
for w in words:
    for m in re.finditer(w, clean, re.I):
        ctx = clean[max(0, m.start()-60):m.start()+60].replace('\n', ' ')
        hits.append(ctx)
print(f"OK — {count} vervangingen → blueprint.en.html ({len(html)} bytes)")
print(f"mogelijke NL-resten: {len(hits)}")
for h in list(dict.fromkeys(hits))[:20]:
    print("  ...", h, "...")

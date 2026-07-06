'use strict';
// Vaste demo-blueprint (canonieke Barry-kaart) voor het testen van het
// gebruikers-dashboard en de blueprint-viewer zonder een AI-call. De teksten
// hieronder zijn de laag-2-tekstvelden zoals lib/ai-texts.js ze zou opleveren.

const intake = {
  clientName: 'Barry',
  birthName: 'Barry Jan Korving',
  birthDate: '1971-06-30',
  birthTime: '08:30',
  birthCity: 'Hoogezand',
  birthCountry: 'Nederland',
  lat: 53.163, lng: 6.762, tz: 'Europe/Amsterdam',
  raw: { levensvraag: 'Hoe draag ik bij aan het geheel zonder mezelf te verliezen?' },
};

const P = (...paras) => paras.map(p => `<p>${p}</p>`).join('');

const texts = {
  hero: {
    core: 'Een warme, stralende buitenkant met een gevoelig, beschermend hart. De Leeuw laat zich zien; de Kreeft voelt alles.',
    patterns: 'Een gevoel dat harmonie zoekt, een richting die naar de bijdrage wijst, en een jaar dat een nieuw begin draagt.',
    alignAstro: 'Zon, Mercurius &amp; Venus in Huis 11 · Mars op de Noordknoop in Waterman, Huis 6',
    alignSoul: 'Noordknoop Waterman · Huis 6 · bijdragen aan het geheel',
    alignYear: 'Jaar 1 · een nieuw begin',
  },
  dashboard: {
    cards: [
      { body: 'Drie planeten in Huis 11 en Mars precies op je Noordknoop maken je kaart krachtig en gericht. Veel energie staat klaar om bewust ingezet te worden.', via: 'Je zes gaven en je dagelijkse praktijken' },
      { body: 'Een Levenspad 9 dat in 2026 een Persoonlijk Jaar 1 binnengaat. Een oude ziel die een gloednieuwe cyclus begint. Voltooien en opnieuw beginnen tegelijk.', via: 'Je persoonlijke kalender en je maandritme' },
      { body: 'Je Noordknoop in Waterman in Huis 6 wijst naar bijdragen aan het grotere geheel via concreet dagelijks werk. Hier ligt je meeste groei, juist omdat het nog open is.', via: 'Je schaduwwerk en je AI-prompts' },
      { body: '2026 is voor jou een Persoonlijk Jaar 1: het eerste jaar van een nieuwe negenjarige cyclus. Een jaar van initiatief, eerste stappen en zelf het roer pakken.', via: 'Je dagelijkse praktijken en je kalender' },
    ],
    closing: 'De lens die nu het lichtst is, je Zielrichting, is niet je zwakte. Het is je grootste kans. Het is het terrein waar in dit jaar van nieuwe beginnen de meeste beweging mogelijk is.',
  },
  introQuote: 'Jouw start is een blauwdruk, niet je bestemming.',
  introduction: P(
    'Jij, Barry, bent iemand met een Zon in Kreeft en een Ascendant in Leeuw. De Ascendant in Leeuw geeft je een warme, gulle, zichtbare buitenkant. Anderen ontmoeten eerst iemand met uitstraling, iemand die warmte brengt en een ruimte kan vullen. Achter die Leeuw-buitenkant zit een Zon in Kreeft: gevoelig, beschermend, sterk verbonden met thuis en met wat geweest is. En je Mercurius staat vlak bij die zon, ook in Kreeft, in Huis 11: je denkt vanuit gevoel en geheugen, en je geest is gericht op de groep en op de toekomst die je samen met anderen bouwt.',
    'En dan is er de Maan in Weegschaal, in Huis 2. Je emotionele natuur zoekt harmonie, balans en eerlijkheid, en Huis 2 gaat over eigenwaarde en eigen grond. Hier woont je behoefte om je veilig te voelen via evenwicht en via het weten wat jij zelf waard bent, los van de ander. Je Venus staat in Tweeling, ook in Huis 11: je hebt mensen, gesprekken en uitwisseling lief, en je waardeert vrijheid en lichtheid in verbinding.',
    'De buitenkant straalt, de binnenkant voelt. Dat is geen tegenstelling om op te lossen, maar een beweging om bewust te worden. De Leeuw die gezien wil worden en de Kreeft die zich wil terugtrekken in de veiligheid van thuis horen allebei bij jou. Je groeit niet door één van de twee kwijt te raken, maar door ze elkaar te laten kennen.'
  ),
  flow: {
    body: P(
      'In jouw kaart vertaalt zich dat als volgt. Sin spreekt via je Kreeft-zon en je Mercurius in Kreeft: een gevoelig systeem dat veel opneemt en dat rust en veiligheid nodig heeft om helder te blijven. Sinn spreekt via je Maan in Weegschaal in Huis 2 en je cluster in Huis 11: betekenis ontstaat voor jou in evenwicht, in eigen waarde en in wat je deelt met de groep. Zin spreekt via je Noordknoop in Waterman in Huis 6, met Mars er vlak bij: je richting wijst naar bijdragen aan het grotere geheel via concreet dagelijks werk.',
      'Het ene dat de flow nog onderbreekt is de spanning tussen het persoonlijke en het collectieve: tussen de behoefte om gezien te worden als jezelf en het verlangen om bij te dragen aan iets dat groter is dan jij. Dat is geen blokkade, maar precies het werk van je knooppunt-as: leren dat je je niet hoeft te bewijzen om mee te tellen.'
    ),
    grid: [
      { val: 'Kreeft-zon · Mercurius Kreeft', desc: 'Een gevoelig systeem dat veel opneemt; rust en veiligheid als bron van helderheid' },
      { val: 'Maan Weegschaal H2 · cluster H11', desc: 'Betekenis in evenwicht, eigen waarde en wat je deelt met de groep' },
      { val: 'NN Waterman H6 · Mars', desc: 'Bijdragen aan het grotere geheel via concreet dagelijks werk als bestemming' },
    ],
    questions: [
      'Wanneer voelde je je deze afgelopen maand het meest in flow, en wat was je toen precies aan het doen?',
      'Waar in je leven draag je iets bij aan een groter geheel, en wat zou er gebeuren als je daar meer ruimte voor maakte?',
      'Welke vorm van gezien worden voelt als bevestiging van buitenaf, en welke voelt als echt jezelf laten zien?',
      'Wat zou je beginnen als je wist dat dit jaar een nieuw begin draagt en de eerste stap genoeg is?',
      'Waar houd je nog vast aan iets dat eigenlijk af is, en wat zou er ruimte maken als je het losliet?',
    ],
  },
  astrology: {
    qualities: {
      sun: 'Gevoelig, beschermend, verbonden met thuis en met wat geweest is; een identiteit die straalt via warmte en zorg, gericht op de groep',
      moon: 'Gevoelsleven dat harmonie, balans en eerlijkheid zoekt; behoefte aan evenwicht en aan eigen waarde',
      mercury: 'Denken vanuit gevoel en geheugen; een geest gericht op vriendschappen, de groep en de gedeelde toekomst',
      venus: 'Liefhebben en waarderen via gesprek, uitwisseling en lichtheid; vrijheid en nieuwsgierigheid als voorwaarde',
      mars: 'Daadkracht die wil bijdragen aan het collectief, vernieuwend en op het werk gericht; staat vlak bij je Noordknoop',
      jupiter: 'Groei via diepte, thuis en je innerlijke fundament; retrograde, eerst van binnen gevonden',
      saturn: 'Levensles rond communicatie, leren en je woord; de leraar in het huis van je roeping',
      uranus: 'Onrust en vernieuwing in je denken en je directe omgeving; eigen, originele ideeën',
      neptune: 'Verlangen naar betekenis en zin rond thuis en geloof; retrograde, innerlijk doorleefd',
      pluto: 'Langzame transformatie van eigenwaarde via het werk en het verfijnen van het kleine',
      northNode: 'Zielrichting: bijdragen aan het geheel via concreet dagelijks werk',
      chiron: 'Wond en heling rond je recht om je eigen kant te kiezen, in het huis van betekenis en geloof',
    },
    patterns: P(
      'Het eerste dat opvalt is een sterke nadruk op Huis 11, het huis van vriendschap, gemeenschap en de toekomst die je samen met anderen bouwt: je Zon, Mercurius en Venus staan daar samen, met een Leeuw-ascendant ervoor. Je kernidentiteit, je denken en je liefde leven in het huis van de groep en het collectief.',
      'In Huis 6, het huis van werk, dienstbaarheid en het dagelijkse, staan je Mars en je Noordknoop vlak bij elkaar in Waterman. Je daadkracht staat precies op je groeirichting: doen, bijdragen, je handen uit de mouwen voor iets dat groter is dan jij.',
      'Je Zuidknoop staat in Leeuw in Huis 12, tegenover je Noordknoop in Waterman in Huis 6. Dat is de as van je groei: van het persoonlijke, het zelf dat gezien wil worden, naar de bijdrage aan het collectief in concreet dagelijks werk.',
      'Twee planeten staan retrograde in je kaart: Jupiter en Neptunus, allebei in Huis 4, het huis van thuis en je innerlijke fundament. Daarbij draag je een Levenspad 9, en je gaat in 2026 een Persoonlijk Jaar 1 binnen. Je staat op een drempel: iets oud sluit af, iets nieuws begint.'
    ),
    cards: [
      { label: 'Cluster Huis 11 (Zon · Mercurius · Venus)', title: 'Wie je bent en met wie', body: 'Je identiteit, je denken en je liefde leven in het huis van vriendschap en gemeenschap. De groei is om je gaven bewust in te zetten in de groep, vanuit warmte in plaats van vanuit de behoefte om gezien te worden.' },
      { label: 'Knooppunt-as Leeuw H12 ↔ Waterman H6', title: 'Van het zelf naar de bijdrage', body: 'Je Noordknoop in Waterman in Huis 6 wijst naar bijdragen aan het grotere geheel via concreet dagelijks werk. Met Mars vlak bij die knoop staat je daadkracht al klaar om die stap te zetten.' },
    ],
  },
  nodes: {
    body: P(
      'De knooppunt-as in jouw kaart vertelt het verhaal van jouw ziel. De Zuidknoop in Leeuw in Huis 12 laat zien wat vertrouwd is: het zelf, de behoefte om gezien en gewaardeerd te worden, warmte en uitstraling, maar gespeeld op een verborgen, innerlijk podium. Het is een echte gave, en het heeft je vaak hart en kleur gegeven.',
      'De Noordknoop in Waterman in Huis 6 wijst de richting: naar bijdragen aan het collectief, naar vernieuwen, naar concreet dagelijks werk dat het grotere geheel dient. Van "het draait om mij" naar "het draait om wat ik geef". Met Mars vlak bij je Noordknoop is je daadkracht al op die richting afgestemd.'
    ),
    south: 'Je kent de energie van het zelf dat gezien wil worden, van warmte en uitstraling, maar op een innerlijk, verborgen podium. Dit patroon is vertrouwd en heeft je kleur gegeven. Maar het voedt je niet meer wanneer alles om jou als middelpunt draait, of wanneer je je licht juist verbergt.',
    north: 'Jouw zielsrichting is bijdragen aan het grotere geheel via concreet dagelijks werk. Niet het zelf in het midden, maar het werk dat het collectief dient. De stap is je daadkracht inzetten voor iets dat groter is dan jou, en vertrouwen dat je meetelt door wat je geeft.',
    chiron: 'Chiron, de gewonde genezer, staat in Ram in Huis 9, het huis van betekenis, geloof en het grotere verhaal. Dit kan wijzen op een oude gevoeligheid rond je recht om je eigen kant te kiezen. De heling komt juist via het durven kiezen van je eigen koers: elke keer dat je je eigen richting volgt in plaats van te wachten op toestemming, keer je deze wond naar haar gave.',
  },
  numerology: {
    lifePathTitle: 'De Wijze',
    lifePathBody: P(
      'Het getal 9 is de oude ziel, de voltooier. Het is het laatste getal van de cyclus en draagt de energie van mededogen, overgave en loslaten. Wie een 9 draagt, voelt zich vaak verbonden met iets dat groter is dan het persoonlijke. Je hebt een breed hart en de neiging om te geven, te dragen en te helpen. De schaduw is martelaarschap: blijven dragen wat eigenlijk losgelaten mag worden.',
      'Hier raken je getal en je kaart elkaar. Je Levenspad 9 en je Zuidknoop in Leeuw beschrijven samen het werk rond geven en gezien worden. En je Noordknoop in Waterman in Huis 6 wijst naar de volwassen vorm van de 9: bijdragen aan het collectief, niet vanuit opoffering, maar vanuit een vrije keuze om iets te geven aan het geheel.'
    ),
    pyBody: P(
      'De 1 staat voor een nieuw begin, initiatief, de eerste stap en zelf het roer pakken. Het is het eerste jaar van een nieuwe negenjarige cyclus. Voor jou is dat extra betekenisvol: een Levenspad 9, de voltooier, gaat een 1-jaar binnen. Iets ouds is afgerond en er begint iets gloednieuws.',
      'De energie van dit 1-jaar resoneert met je Noordknoop in Waterman in Huis 6 en met Mars die daar vlak bij staat: een jaar dat je uitnodigt om de eerste concrete stappen te zetten richting je bijdrage aan het geheel.'
    ),
    cycleTitle: 'Van oogst naar fundament',
    cycleBody: 'Je persoonlijke maandgetallen lopen van 8 (juli, kracht en oogst) via 9 (augustus, voltooien en loslaten) naar 1 (september, een nieuw begin), 11 (oktober, een meestermaand vol intuïtie), 3 (november, expressie en vreugde) en 4 (december, grond en structuur). Oktober draagt de meester-energie 11: een maand om extra naar je gevoel en je intuïtie te luisteren.',
    nameNumbers: {
      expression: 'Je uitdrukkingsgetal laat zien hoe je je talenten en capaciteiten in de wereld zet: de manier waarop anderen je in actie leren kennen.',
      soulUrge: 'Je zielenurge, berekend uit de klinkers in je naam, wijst op wat je diepste drijfveer werkelijk verlangt, onder alles wat zichtbaar is.',
      personality: 'Je persoonlijkheidsgetal, uit de medeklinkers, beschrijft de eerste indruk die je maakt voordat mensen je echt kennen.',
    },
  },
  tikkun: {
    cards: [
      { title: 'Gezien worden versus bijdragen aan het geheel', body: 'De Zuidknoop in Leeuw in Huis 12 wijst op een vertrouwd patroon: de behoefte om gezien, gewaardeerd en bevestigd te worden op een innerlijk, verborgen podium. Daaronder leeft de vraag of je meetelt. Als oude ziel met een Levenspad 9 ken je ook het patroon van blijven dragen en moeilijk kunnen loslaten.' },
      { title: 'Bijdragen via concreet dagelijks werk', body: 'Je Noordknoop in Waterman in Huis 6 vraagt het tegenovergestelde: je richten op het collectief, op vernieuwing en op concreet dagelijks werk dat het grotere geheel dient. Van "het draait om mij" naar "ik draag bij". Met Mars vlak bij je Noordknoop is de daadkracht al aanwezig.' },
      { title: '', body: 'Jouw Tikkun in dit leven is: leren dat je meetelt door wat je geeft aan het geheel, niet door gezien te worden, en als Levenspad 9 leren om los te laten en te voltooien zonder jezelf te verliezen. Het betekent ook durven loslaten wat af is, zodat er ruimte komt voor het nieuwe begin dat 2026 draagt.' },
    ],
    retroTitle: 'Retrograde planeten: innerlijke verwerking',
    retroBody: 'Twee planeten staan retrograde in jouw kaart: Jupiter en Neptunus, allebei in Huis 4, het huis van thuis, wortels en je innerlijke fundament. Je diepste groei komt van binnenuit, rond het gevoel ergens thuis te horen. Dat innerlijke werk rond je fundament is precies wat je in staat stelt om naar buiten bij te dragen vanuit een stevige basis.',
  },
  summary: {
    oneLiner: 'Een warme, gevoelige man met een stralende buitenkant en een oude ziel, die in 2026 een nieuw begin maakt en die wordt uitgenodigd om van het persoonlijke naar de bijdrage aan het grotere geheel te bewegen, via concreet dagelijks werk.',
    tikkunSub: 'Van het zelf naar de bijdrage',
    rows: [
      'Gevoelig, beschermend en verbonden met thuis en de groep, achter een warme Leeuw-buitenkant. Wie je van binnen bent mag net zo zichtbaar worden als wat je laat zien.',
      'Je gevoel zoekt harmonie, evenwicht en eigen waarde. De groei is om je veilig te voelen via wat jij zelf waard bent, los van de ander.',
      'Bijdragen aan het grotere geheel via concreet dagelijks werk. Met Mars vlak bij die knoop staat je daadkracht al klaar.',
      'De oude ziel die leert voltooien en loslaten. 2026 (Persoonlijk Jaar 1) is een nieuw begin, het eerste jaar van een nieuwe cyclus.',
      'Leren dat je meetelt door wat je geeft aan het geheel, niet door gezien te worden, en loslaten wat af is.',
      'De vertrouwde reflex: het zelf in het midden, of juist je licht verbergen. Dit herkennen is de eerste stap naar je bijdrage.',
    ],
  },
  reflection: {
    questions: [
      'Welk inzicht uit jouw astrologie, numerologie of Tikkun kwam het hardst binnen, en wat zegt het dat juist dat je raakte?',
      'Waar voelde je weerstand tijdens het lezen, en wat zou die weerstand je kunnen laten zien?',
      'Waar in je leven zoek je bevestiging dat je meetelt, en wat zou er veranderen als je wist dat je er al toe doet?',
      'Wat draag je nog mee dat eigenlijk af is, en wat zou er ruimte komen als je het losliet?',
      'Waar houd je je licht klein of verberg je jezelf, en wat zou er gebeuren als je je liet zien zonder middelpunt te hoeven zijn?',
      'Welke concrete bijdrage aan een groter geheel geeft je energie, en hoe zou je daar deze maand een eerste stap in zetten?',
      'Wat zou je beginnen als je echt geloofde dat dit jaar een nieuw begin draagt en de eerste stap genoeg is?',
      'Waar wacht je op toestemming om je eigen koers te kiezen, en van wie?',
      'Wanneer voelde je je voor het laatst echt thuis bij jezelf? Wat maakte dat mogelijk?',
      'Als je daadkracht één ding mocht doen voor het geheel, wat zou dat zijn?',
    ],
  },
  energy: {
    rhythm: 'Jouw kaart heeft een eigen ritme. Je Zon en Mercurius in Kreeft vragen om gevoel, rust en veiligheid; je Venus in Tweeling en je Mars in Waterman willen juist beweging, uitwisseling en bijdragen. De spanning daartussen is geen probleem maar een ritme. Tegelijk vraagt je Maan in Weegschaal om evenwicht, en je twee retrograde planeten in Huis 4 om innerlijke rust rond thuis en je wortels.',
    grid: [
      { val: 'Voel eerst naar binnen', desc: 'Je gevoelige Kreeft-zon is in de ochtend, voordat de wereld aanstaat, het zuiverst. Neem even rust en voel naar binnen voordat de dag zich vult met de behoeften van anderen.' },
      { val: 'Vertrouwde grond', desc: 'Met je Kreeft-zon en je wortels in Huis 4 laad je op in vertrouwde, veilige omgevingen en in contact met thuis. Geef die momenten ruimte; ze halen je uit je hoofd terug in je lichaam.' },
      { val: 'Vriendschap &amp; groep', desc: 'Je cluster in Huis 11 en je Venus in Tweeling voeden zich met vriendschap, gesprek en gedeelde richting. Zoek die verbindingen bewust op, en blijf daar bij jezelf terwijl je geeft.' },
      { val: 'Eén concrete daad', desc: 'Je Mars en Noordknoop in Waterman in Huis 6 laden op wanneer je iets concreets bijdraagt aan een groter geheel. Eén concrete daad per dag voor het werk of de gemeenschap voedt je richting.' },
      { val: 'Echte stilte', desc: 'Met twee retrograde planeten in Huis 4 verwerk je veel naar binnen. Behandel rust niet als beloning, maar als herstelenergie die je kaart nodig heeft.' },
    ],
    elements: [
      { label: 'Water (Zon &amp; Mercurius Kreeft)', title: 'Gevoeligheid en geheugen', body: 'Je Kreeft-zon en Mercurius maken je gevoelig, zorgzaam en sterk verbonden met wat geweest is. Je voelt en onthoudt veel. Vertrouw op wat je voelt, niet alleen op wat je beredeneert.' },
      { label: 'Lucht (Venus Tweeling · Mars &amp; NN Waterman · Maan Weegschaal)', title: 'Verbinding, beweging en bijdrage', body: 'In de lucht leeft je gerichtheid op anderen, op uitwisseling en op het collectief. Hier wijst ook je groeirichting: bijdragen aan het geheel via concreet werk. Beweeg naar buiten, deel, draag bij.' },
      { label: 'Vuur &amp; aarde (Chiron Ram · Neptunus Boogschutter · Pluto Maagd)', title: 'Eigen koers en langzame verdieping', body: 'Je vuur draagt het thema van je eigen richting durven kiezen. Je aarde transformeert langzaam je eigenwaarde via het werk. Kies je eigen weg, en geef de verdieping tijd.' },
    ],
  },
  integration: {
    layers: {
      astro: 'Cluster in Huis 11 en Mars op de Noordknoop in Waterman, Huis 6: jezelf vinden in de groep en bijdragen aan het geheel',
      num: 'Levenspad 9 en Persoonlijk Jaar 1: de oude ziel die een nieuw begin maakt',
      soul: 'Helder en open: van het persoonlijke naar de bijdrage, via concreet dagelijks werk',
      year: 'PJ 1: het eerste jaar van een nieuwe cyclus, een jaar van initiatief',
      focus: 'de brug tussen het persoonlijke en de bijdrage, en tussen gezien willen worden en weten dat je ertoe doet',
    },
    shadow: 'Voor jou leeft de schaduw vooral in twee dingen. Het eerste is de behoefte om gezien en bevestigd te worden, of juist het tegenovergestelde: je licht verbergen en jezelf wegcijferen, geworteld in je Zuidknoop in Leeuw in Huis 12. Het tweede is het patroon van de oude ziel: blijven dragen en moeilijk kunnen loslaten wat eigenlijk af is, geworteld in je Levenspad 9. Geen van beide is een vijand. Elke keer dat je iets geeft aan het geheel zonder je te hoeven bewijzen, beweeg je richting je Noordknoop in Waterman.',
    breath: 'Op het moment dat je reageert, verandert je ademhaling direct: sneller, vluchtiger, hoger in de borst. Een bewuste, diepe ademhaling activeert het parasympathische zenuwstelsel, de staat van rust en helderheid. Voor jou, met een gevoelige Kreeft-zon en veel beweging in je luchttekens, is de adem de snelste weg terug naar rust en naar je lichaam.',
    gifts: [
      'Kreeft-zon en Mercurius in Kreeft. Je voelt en weet vaak iets voordat je het kunt beredeneren. Vertrouw die zachte, snelle stem en handel ernaar voordat je hem wegdenkt.',
      'Neptunus in Boogschutter in Huis 4. Je kunt voorbij het zichtbare kijken en iets zien dat er nog niet is, vooral rond thuis en betekenis. Gebruik deze gave om je eigen toekomst te verbeelden.',
      'Kreeft, het teken van het geheugen, met je Zon en Mercurius. Je herkent patronen over tijd en draagt een diep geheugen voor mensen. Gebruik dat om te zien wat zich herhaalt, en wat af mag.',
      'Saturnus in Tweeling in Huis 10. Je hebt een gestructureerd, gedisciplineerd denkvermogen: je kunt verbanden leggen en met je geest bouwen. Zet dit in om je richting concreet te maken.',
      'Venus in Tweeling en Noordknoop in Waterman. Je neemt helder en met enige afstand waar, en ziet patronen en mensen scherp. Hoe je iets ziet bepaalt wat je ervaart; kies bewust een blik die je dient.',
      'Mars op de Noordknoop in Waterman, Huis 6. Dit is je sterkste gave: je daadkracht staat precies op je groeirichting. Zet die wil in voor iets dat groter is dan jou.',
    ],
    practices: [
      { title: 'Begin de dag bij jezelf', body: 'Kreeft-zon, Levenspad 9. Neem voordat je je telefoon pakt een paar minuten rust en adem laag in je buik. Voel naar binnen voordat de dag zich vult met de behoeften van anderen.' },
      { title: 'Eén concrete daad voor het geheel', body: 'Mars op de Noordknoop, Waterman in Huis 6. Doe elke dag één concrete daad die bijdraagt aan iets dat groter is dan jij. Dit is directe beweging richting je Noordknoop.' },
      { title: 'Kies elke dag één nieuw begin', body: 'Persoonlijk Jaar 1. Dit is je jaar van nieuwe beginnen. Start elke dag of week één klein nieuw ding, vanuit eigen initiatief. De eerste stap hoeft niet groot te zijn, alleen van jou.' },
      { title: 'Volg je gevoel voordat je het wegredeneert', body: 'Kreeft-zon. Merk één keer per dag op wat je gevoel als eerste zegt, en neem het serieus voordat je het wegredeneert. Elke keer groeit het vertrouwen in je eigen weten.' },
      { title: 'Laat elke dag één ding los', body: 'Levenspad 9. Als oude ziel draag je veel. Laat elke dag bewust één klein ding los dat af is: een taak, een gedachte, een verwachting. Loslaten maakt ruimte voor het nieuwe.' },
      { title: 'Voed je thuis en je wortels', body: 'Jupiter en Neptunus in Huis 4. Je fundament zit in Huis 4. Geef je thuis en je innerlijke basis bewust aandacht. Een stevige basis maakt het makkelijker om naar buiten bij te dragen.' },
    ],
    prompts: [
      { label: 'Onderscheiden tussen het persoonlijke en de bijdrage', text: 'Ik ben Barry (Zon in Kreeft in Huis 11, Mercurius in Kreeft in Huis 11, Venus in Tweeling in Huis 11, Maan in Weegschaal in Huis 2, Leeuw-ascendant, Levenspad 9, Persoonlijk Jaar 1 in 2026). Mijn Zuidknoop staat in Leeuw in Huis 12 en mijn Noordknoop in Waterman in Huis 6. Help me onderscheiden wanneer ik handel vanuit de behoefte om gezien te worden, en wanneer ik werkelijk bijdraag aan het geheel, en stel me vijf vragen om dat verschil beter te leren voelen.' },
      { label: 'Mijn wil afstemmen op mijn richting', text: 'Mijn Mars staat vlak bij mijn Noordknoop in Waterman in Huis 6: mijn daadkracht staat op mijn groeirichting. Geef me drie concrete situaties van deze week waarin ik mijn wil bewust kan inzetten voor een bijdrage aan iets dat groter is dan ikzelf, in mijn dagelijkse werk.' },
      { label: 'Een nieuw begin in een 1-jaar na een 9-cyclus', text: 'Ik heb een Levenspad 9 en ben in 2026 in een Persoonlijk Jaar 1 beland: een oude ziel die een nieuw begin maakt. Help me onderzoeken wat er in mij afgesloten mag worden, en welke kleine, concrete eerste stap ik kan zetten in een richting die echt van mij is.' },
      { label: 'Bijdragen via concreet dagelijks werk', text: 'Mijn Noordknoop in Waterman in Huis 6 wijst naar bijdragen aan het collectief via concreet dagelijks werk. Help me ontdekken welke vorm van bijdragen bij mij past en geef me een eenvoudig dagelijks ritme waarin ik elke dag één concrete stap in die richting zet.' },
      { label: 'Loslaten en voltooien', text: 'Als Levenspad 9 draag ik veel en vind ik het soms moeilijk om iets echt af te sluiten. Help me herkennen wat ik vasthoud terwijl het eigenlijk af is, en geef me concrete, kleine manieren om los te laten zonder mezelf te verliezen.' },
      { label: 'Mijn binnenwereld en mijn wortels', text: 'Ik heb een gevoelige Kreeft-zon en Jupiter en Neptunus retrograde in Huis 4 (thuis, wortels, fundament). Help me een eenvoudig ritme ontwerpen dat mijn innerlijke basis en mijn gevoel van thuishoren voedt, zodat ik vanuit een stevige basis naar buiten kan bijdragen.' },
    ],
  },
  closing: P(
    'Je kaart geeft geen oordeel, maar wel een spiegel. De richting waarin je ziel je uitnodigt te bewegen, van het persoonlijke naar de bijdrage aan het geheel, is precies de richting van je Noordknoop in Waterman in Huis 6, met Mars die daar al klaarstaat. Je draagt als Levenspad 9 een breed hart en de wijsheid van een oude ziel, en 2026 opent als Persoonlijk Jaar 1 een gloednieuwe cyclus.',
    'De ene knoop is vertrouwen: weten dat je meetelt door wat je geeft, niet door gezien te worden. De andere is loslaten: durven afsluiten wat af is, zodat er ruimte komt voor het nieuwe begin. Wat ontbreekt is niet de richting en niet de daadkracht, je hebt beide. Wat groeit is het vertrouwen dat je ertoe doet op het moment dat je geeft vanuit vrije keuze, en dat elke eerste stap genoeg is.'
  ),
};

module.exports = { intake, texts };

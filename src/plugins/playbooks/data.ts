import type { IPlaybook, IPlaybookAdvance } from "./schema.ts";

// ─── Standard Advances (shared by all playbooks) ──────────────────────────────

const STANDARD_ADVANCES: IPlaybookAdvance[] = [
  { id: "stat-blood",      label: "+1 Blood (max +2)",           statBoost: "blood",  maxTimes: 2 },
  { id: "stat-heart",      label: "+1 Heart (max +2)",           statBoost: "heart",  maxTimes: 2 },
  { id: "stat-mind",       label: "+1 Mind (max +2)",            statBoost: "mind",   maxTimes: 2 },
  { id: "stat-spirit",     label: "+1 Spirit (max +2)",          statBoost: "spirit", maxTimes: 2 },
  { id: "move-own-1",      label: "Take another move from your playbook",   maxTimes: 1 },
  { id: "move-own-2",      label: "Take another move from your playbook",   maxTimes: 1 },
  { id: "move-other-1",    label: "Take a move from another playbook",      maxTimes: 1 },
  { id: "move-other-2",    label: "Take a move from a different playbook",  maxTimes: 1 },
  { id: "circle-rating",   label: "Improve a circle rating by +1",          maxTimes: 2 },
  { id: "clear-corruption",label: "Remove a Corruption mark",               maxTimes: 3 },
  { id: "corruption-adv",  label: "Take a Corruption advance",              maxTimes: 5 },
  // Major advances — require 5+ regular advances first
  { id: "retire",          label: "Retire your character to safety",  major: true, maxTimes: 1 },
  { id: "change-playbook", label: "Change your playbook",             major: true, maxTimes: 1 },
  { id: "move-any",        label: "Take a move from any playbook",    major: true, maxTimes: 2 },
];

// ─── All 12 Urban Shadows Playbooks ──────────────────────────────────────────
//
// Base stats: one stat at -1, one at 0, two at +1.
// Player adds +1 to any one stat at chargen.
// Same rule applies to circle ratings.

export const PLAYBOOKS: IPlaybook[] = [
  // ── The Aware ───────────────────────────────────────────────────────────────
  {
    id: "aware",
    name: "The Aware",
    circle: "mortalis",
    tagline: "Play the Aware if you want to straddle the line between the mortal and supernatural worlds, caught between two lives.",
    demeanors: ["aggressive", "charming", "composed", "paranoid"],
    baseStats: { blood: 0, heart: 1, mind: -1, spirit: 1 },
    circleRatings: { mortalis: 1, night: 0, power: 1, wild: -1 },
    circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 },
    introQuestions: [
      "How did you discover the supernatural?",
      "How long have you been in the city?",
      "What mortal commitment keeps you from leaving your old life behind?",
      "What mortal aspiration have you given up?",
      "What powerful faction or person are you currently investigating?",
    ],
    startingGear: [
      { label: "A small apartment, a used car, a smartphone." },
      { label: "Your kit (detail).", detail: true },
      { label: "A self-defense weapon:", options: [
        "9mm Beretta (2-harm near loud concealable)",
        "Taser (s-harm hand)",
        "Switchblade (2-harm hand concealable)",
      ], count: 1 },
    ],
    startingDebts: [
      "Someone befriended you long before you discovered the supernatural...and purposefully hid its existence from you when it mattered. They owe you a Debt.",
      "Someone puts up with your questions about the supernatural. You owe them a Debt.",
      "You're leveraging dirt you have on someone to get their help dismantling a supernatural scheme that targets innocent mortals. You owe them a Debt.",
    ],
    letItOut: [
      "gain access to a secure or locked-down location",
      "draw immediate mortal attention to a person or situation",
      "spot a previously overlooked clue or advantage in the immediate area",
      "convince an NPC to act on their kindness, role, or own best interest",
    ],
    moveCount: 3,
    movesInstruction: "Choose three:",
    featureDefs: [
      { key: "kit", label: "Kit description", required: true, description: "Describe your investigative kit — what tools do you carry?" },
      { key: "mortalRelationships", label: "Mortal relationships (2–3 NPCs)", required: true, description: "Name 2–3 mortals (family, friends, partner) whose lives you're still part of. Include name and relationship." },
    ],
    moves: [
      { id: "aware-i-know-a-guy", name: "I Know a Guy", description: "When you need to meet with a member of your Circle, roll with Heart. On a 10+, they'll meet with you with minimal obligations. On a 7-9, they'll meet with you, but you must mark your Circle or owe them a Debt. On a miss, they'll only meet with you if you cash in a Debt with someone who can broker the meeting." },
      { id: "aware-charming-not-sincere", name: "Charming, Not Sincere", description: "When you mislead someone about your intentions during a negotiation, roll with Heart instead of Mind." },
      { id: "aware-the-lions-den", name: "The Lion's Den", description: "When you infiltrate a secure supernatural location alone to gather evidence, roll with Mind. On a 10+, you find concrete evidence of wrongdoing and get out clean. On a 7-9, you find the evidence but choose 1: you leave traces someone notices, you take 1-harm, or you owe someone inside a Debt. On a miss, you find the evidence but you're caught in the act — the evidence implicates an NPC, and the MC decides who." },
      { id: "aware-this-is-my-city", name: "This is My City", description: "When you first enter a public meeting place with a powerful supernatural being, roll with Mind. On a 10+, hold 3. On a 7-9, hold 2. Spend your hold 1-for-1 to name an escape route, spot a potential ally, or notice a weakness in the room." },
      { id: "aware-in-sheeps-clothing", name: "In Sheep's Clothing", description: "When you mislead, distract, or trick someone you've previously shared a moment of intimacy with, roll with Heart instead of Mind." },
      { id: "aware-one-way-or-another", name: "One Way or Another", description: "When you plead with a member of your Circle for help with a pressing situation, roll with Heart. On a hit, they either agree to help or owe you a Debt, their choice. On a 10+, if they decline and owe you a Debt, you take +1 ongoing against them as long as you hold that Debt. On a miss, they are free to do as they like — but if they agree to help, treat it as if they cashed in a Debt with you that you can't refuse." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Fae ─────────────────────────────────────────────────────────────────
  {
    id: "fae",
    name: "The Fae",
    circle: "wild",
    tagline: "Play the Fae if you want to portray a stranger in a strange land, caught between the needs of your court and the beauty of the city's streets.",
    demeanors: ["alien", "eccentric", "seductive", "untamed"],
    baseStats: { blood: -1, heart: 1, mind: 0, spirit: 1 },
    circleRatings: { mortalis: 0, night: -1, power: 1, wild: 1 },
    circleStatus: { mortalis: 0, night: 0, power: 0, wild: 1 },
    introQuestions: [
      "Why did you leave your homeland?",
      "How long have you been in the city?",
      "What do you love most about humanity?",
      "Who is your closest confidante or lover?",
      "What do you desperately need?",
    ],
    startingGear: [
      { label: "A comfortable house or apartment, a decent car, a smartphone." },
      { label: "A relic from your homeland (detail).", detail: true },
      { label: "A symbol of your court (sun, moon, storm, winter, spring, etc.) (detail).", detail: true },
    ],
    startingDebts: [
      "Someone disrupted a rare ritual of your court for personal gain, besmirching your reputation with your monarch. They owe you a Debt.",
      "You are keeping something hidden on behalf of someone else from a powerful member of their Circle. Ask them why. They owe you a Debt.",
      "You entrusted someone with an important and dangerous task. Ask them if they succeeded or failed. If they succeeded, you owe them a Debt. If they failed, they owe you a Debt.",
    ],
    letItOut: [
      "summon an elemental storm of your court (2-harm close area ap)",
      "appear to others as someone you have previously touched",
      "compel the elements of your court to reveal what they have seen",
      "create a telepathic link between yourself and another for a scene",
    ],
    moveCount: 3,
    movesInstruction: "You get Faerie Magic, then choose two more:",
    featureDefs: [
      { key: "relic", label: "Relic from your homeland", required: true, description: "Describe an object you brought from your faerie homeland and what it means to you." },
      { key: "courtSymbol", label: "Symbol of your court", required: true, description: "What symbol represents your faerie court (sun, moon, storm, winter, spring, etc.)?" },
      { key: "faeriePowers", label: "Three faerie powers", required: true, description: "Choose 3 faerie powers to use with Faerie Magic (e.g. Glamours, Shape Change, Nature's Caress, Elemental Storm, etc.)." },
    ],
    moves: [
      { id: "fae-faerie-magic", name: "Faerie Magic", required: true, description: "When you reach out to the faerie world for power, roll with Spirit. On a 10+, hold 3. On a 7-9, hold 3, but choose 1: mark corruption, owe a Debt to a fae noble, or take -1 ongoing until you rest. Spend hold 1-for-1 to use any of your faerie powers." },
      { id: "fae-a-dish-best-served-now", name: "A Dish Best Served Now", description: "When you invoke a promise someone made to you to demand immediate repayment, roll with Spirit. On a 10+, they must fulfill the promise now or mark corruption. On a 7-9, they can choose instead to owe you a Debt worth twice the promise." },
      { id: "fae-in-our-blood", name: "In Our Blood", description: "When you meet another fae for the first time, roll with Spirit. On a 10+, hold 2. On a 7-9, hold 1. Spend your hold 1-for-1 to ask the MC one of: what court are they from, what do they want from me, or are they hiding something?" },
      { id: "fae-scales-of-justice", name: "Scales of Justice", description: "When you use Faerie Magic by spending Debts instead of hold, each Debt spent counts as 1 hold. You may spend up to 3 Debts per use of Faerie Magic." },
      { id: "fae-draw-back-the-curtain", name: "Draw Back the Curtain", description: "When you lead someone through a portal to your homeland or another faerie realm, roll with Spirit. On a hit, you both arrive safely. On a 7-9, choose 1: you owe a Debt to a gatekeeper, you cannot return for a week, or you leave something important behind. On a miss, the path leads somewhere unexpected and dangerous." },
      { id: "fae-words-are-wind", name: "Words Are Wind", description: "When someone lies to you or breaks a promise in your presence, you automatically know and gain a Debt on them." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Hunter ──────────────────────────────────────────────────────────────
  {
    id: "hunter",
    name: "The Hunter",
    circle: "mortalis",
    tagline: "Play the Hunter if you want to stalk the monsters that prey on the innocent and remind the city's creatures what it means to fear humans.",
    demeanors: ["calculating", "detached", "friendly", "volatile"],
    baseStats: { blood: 1, heart: -1, mind: 1, spirit: 0 },
    circleRatings: { mortalis: 1, night: 1, power: 0, wild: -1 },
    circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 },
    introQuestions: [
      "What personal tragedy led you to hunt?",
      "How long have you been in the city?",
      "What impressive kill are you infamous for?",
      "What do those you hunt call you behind your back?",
      "Who inflicted the wound that still haunts you?",
    ],
    startingGear: [
      { label: "A shitty apartment, a pick-up truck or muscle car, a cell phone." },
      { label: "A symbol of your society (tattoo, coin, inscription) (detail).", detail: true },
      { label: "Your arsenal: 3 custom weapons (detail).", detail: true },
    ],
    startingDebts: [
      "Someone helps you unwind and keeps you sane, despite the horrors of your hunts. You owe them a Debt.",
      "Your hunts incurred the wrath of a powerful person; someone helped smooth things over. You owe them a Debt.",
      "Someone has enlisted you to protect them from something dangerous. They owe you a Debt.",
    ],
    letItOut: [
      "track someone or something through the city with limited information or trail",
      "treat a mundane object as a weapon (2-harm messy) or 1-armor for a scene",
      "anticipate and avoid a trap or ambush before it springs",
      "strike first against a supernatural target, ignoring their initiative",
    ],
    moveCount: 3,
    movesInstruction: "Choose three:",
    featureDefs: [
      { key: "societySymbol", label: "Symbol of your society", required: true, description: "What mark identifies you as a member of your hunter society (tattoo, coin, inscription)?" },
      { key: "arsenal", label: "Arsenal (3 custom weapons)", required: true, description: "Detail your 3 custom weapons — name, harm, tags, and any personal significance." },
    ],
    moves: [
      { id: "hunter-deadly", name: "Deadly", description: "When you turn to violence against a supernatural creature, your attacks gain +1 harm. When you deliver a killing blow, you may ask the MC one question about their weaknesses, habits, or masters — they must answer honestly." },
      { id: "hunter-safe-house", name: "Safe House", description: "You have a secure location only you and those you trust know about. When you go to your safe house to recover, clear all harm up to serious. When you bring someone to your safe house, they owe you a Debt." },
      { id: "hunter-this-way", name: "This Way!", description: "When you lead allies through unfamiliar territory or away from a threat, roll with Blood. On a 10+, everyone gets out clean. On a 7-9, everyone gets out but you choose 1: someone takes 1-harm, you leave something behind, or you owe a Debt to someone you had to call in for help." },
      { id: "hunter-worse-things-out-tonight", name: "Worse Things Out Tonight", description: "When you walk into danger unarmed and unarmored, roll with Blood. On a 10+, hold 3. On a 7-9, hold 2. Spend hold 1-for-1 to redirect an attack, disarm a foe, or escape a grapple." },
      { id: "hunter-prepared-for-anything", name: "Prepared for Anything", description: "When you have time to prepare before a hunt, roll with Mind. On a 10+, hold 3. On a 7-9, hold 2. Spend hold 1-for-1 during the hunt to have the right tool, know the right fact, or anticipate the right move." },
      { id: "hunter-watch-them-closely", name: "Watch them Closely", description: "When you observe a supernatural being in their natural environment without being detected, roll with Mind. On a 10+, ask 3 questions. On a 7-9, ask 1. Questions: What are they hunting? Who do they answer to? What are they afraid of? What do they want most right now? How can I hurt them?" },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Imp ─────────────────────────────────────────────────────────────────
  {
    id: "imp",
    name: "The Imp",
    circle: "night",
    tagline: "Play the Imp if you want to run a supernatural hustle in the city's underbelly, trading in forbidden goods and dangerous favors.",
    demeanors: ["brash", "charming", "cunning", "skittish"],
    baseStats: { blood: -1, heart: 1, mind: 1, spirit: 0 },
    circleRatings: { mortalis: 0, night: 1, power: -1, wild: 1 },
    circleStatus: { mortalis: 0, night: 0, power: 0, wild: 1 },
    introQuestions: [
      "How did you escape your servitude?",
      "How long have you been in the city?",
      "Whom do you call family in the city?",
      "Whom do you turn to when you're in trouble?",
      "Whom did you scam that still holds a grudge?",
    ],
    startingGear: [
      { label: "An upscale house or apartment, a car or utility van, a smartphone." },
      { label: "A sentimental gift from a family member (detail).", detail: true },
      { label: "A ritual object binding you to this realm (e.g. the first dollar spent at your business) (detail).", detail: true },
    ],
    startingDebts: [
      "Someone is a consistent patron or customer of your establishment, regularly relying on you for your services or assistance. They owe you 2 Debts.",
      "You offered someone work when no one else would give them the time of day. Ask them if it worked out in your favor. They owe you a Debt either way.",
      "You partner with someone on your schemes, both of you profiting in equal measure. You owe each other 2 Debts.",
    ],
    letItOut: [
      "sniff out a secret stash, even when expertly concealed or hidden",
      "infiltrate a hostile area by appearing unworthy of concern",
      "teleport into your establishment from any distance or position",
      "inflict 4-harm (ap) on a vulnerable target who underestimates you",
    ],
    moveCount: 3,
    movesInstruction: "You get Business as Usual, then choose two more:",
    featureDefs: [
      { key: "familyGift", label: "Sentimental family gift", required: true, description: "What gift from a family member do you carry, and who gave it?" },
      { key: "ritualObject", label: "Ritual binding object", required: true, description: "What object binds you to this realm (e.g. the first dollar spent at your business)?" },
      { key: "businessServices", label: "Services offered (choose 2)", required: true, description: "What two supernatural services or goods does your establishment provide?" },
      { key: "businessProblems", label: "Business problems (choose 2)", required: true, description: "What two problems plague your business (heat from authorities, rival suppliers, etc.)?" },
    ],
    moves: [
      { id: "imp-business-as-usual", name: "Business as Usual", required: true, description: "When you offer someone a service or item in exchange for a Debt, roll with Heart. On a 10+, they accept and owe you a Debt — and they're satisfied with the deal. On a 7-9, they accept, but they resent the terms; the MC will tell you how this complicates things later. On a miss, they decline and tell someone powerful about your offer." },
      { id: "imp-measure-your-mark", name: "Measure Your Mark", description: "When you size up a potential customer or mark before making your pitch, roll with Mind. On a 10+, ask 2 questions. On a 7-9, ask 1. Questions: What do they want that they aren't asking for? What are they hiding? What leverage do I have over them? What would make them walk away?" },
      { id: "imp-friends-in-low-places", name: "Friends in Low Places", description: "When you call in a favor from someone in the criminal or supernatural underground, roll with Heart. On a 10+, they help you without strings attached. On a 7-9, they help but require a Debt in return. On a miss, they're in a bad spot themselves — they need a favor from you first." },
      { id: "imp-im-a-fucking-demon", name: "I'm a Fucking Demon", description: "When you reveal your true demonic nature to intimidate or impress, roll with Blood. On a 10+, hold 3. On a 7-9, hold 2, but mark corruption. Spend hold 1-for-1 to force an NPC to flee, to command a lesser supernatural to obey one order, or to take +1 forward." },
      { id: "imp-weasel-words", name: "Weasel Words", description: "When you talk your way out of a situation you got yourself into, roll with Mind. On a 10+, you escape consequence entirely — for now. On a 7-9, you escape the immediate problem but the MC introduces a new complication later. On a miss, you make things significantly worse." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Oracle ──────────────────────────────────────────────────────────────
  {
    id: "oracle",
    name: "The Oracle",
    circle: "power",
    tagline: "Play the Oracle if you want to peer into the city's future, burdened by visions you cannot ignore and a benefactor who demands your service.",
    demeanors: ["distracted", "intense", "methodical", "serene"],
    baseStats: { blood: 0, heart: -1, mind: 1, spirit: 1 },
    circleRatings: { mortalis: 1, night: -1, power: 1, wild: 0 },
    circleStatus: { mortalis: 0, night: 0, power: 1, wild: 0 },
    introQuestions: [
      "How old were you when your visions began?",
      "How long have you been in the city?",
      "How did you originally convince your benefactor to trust you and your visions?",
      "Who seeks to sway you from your service?",
      "What signs hint your prophecy grows near?",
    ],
    startingGear: [
      { label: "Everything provided by your benefactor." },
      { label: "Two sets of prophetic tools:", options: [
        "Divining objects (tarot deck, crystal ball, set of runes, etc.)",
        "Ritual instruments (an athame, a pentacle, etc.)",
        "Rare tomes and grimoires (lost scrolls, secret books, etc.)",
      ], count: 2 },
    ],
    startingDebts: [
      "Someone helps decipher your visions with unique insights. You owe them 2 Debts.",
      "You had a dark vision about someone, but gave bad guidance. You owe them a Debt.",
      "Someone interfered with your destiny. They owe you a Debt. Tell them if you've forgiven them — they owe you another Debt if you still hold a grudge.",
    ],
    letItOut: [
      "uncover the essential truth of a thing or person in your presence",
      "twist the strands of fate to help or hinder an NPC in your presence",
      "frighten or impress someone with knowledge of their past",
      "glimpse one possible future of a current situation",
    ],
    moveCount: 2,
    movesInstruction: "Choose two:",
    featureDefs: [
      { key: "benefactor", label: "Benefactor NPC", required: true, description: "Name and describe the powerful entity who employs your services and provides for your needs." },
      { key: "prophetic tools", label: "Prophetic tools", required: true, description: "List your two sets of prophetic tools." },
      { key: "foretelling", label: "Current foretelling", required: false, description: "What prophecy are you currently working toward? (Can be filled in after first session.)" },
    ],
    moves: [
      { id: "oracle-psychometry", name: "Psychometry", description: "When you touch an object and open yourself to its history, roll with Spirit. On a 10+, ask 3 questions. On a 7-9, ask 1. Questions: Who last held this? What strong emotion is attached to it? What event does it mark? Where has it been recently?" },
      { id: "oracle-skim-the-surface", name: "Skim the Surface", description: "When you read a person's surface thoughts or emotional state, roll with Spirit. On a 10+, the MC tells you their dominant emotion and one surface thought. On a 7-9, the MC tells you their dominant emotion only, but they sense something strange — mark your Circle." },
      { id: "oracle-dual-loyalty", name: "Dual Loyalty", description: "You serve two benefactors from different Circles. When you play them off each other, roll with Mind. On a 10+, both give you what you need without conflict. On a 7-9, choose 1: one of them grows suspicious, you mark your Circle with one of them, or you owe one of them a Debt." },
      { id: "oracle-soothsayer", name: "Soothsayer", description: "When you publicly announce a prophecy and it comes true (MC confirms), take +1 ongoing with your Circle until you next change Status. When it fails to come true, take -1 ongoing and mark corruption." },
      { id: "oracle-foresight", name: "Foresight", description: "When you have at least an hour to prepare for a dangerous confrontation, roll with Spirit. On a 10+, hold 3. On a 7-9, hold 2. During the confrontation, spend hold 1-for-1 to redirect an attack, anticipate a lie, or know what someone will do next." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Spectre ─────────────────────────────────────────────────────────────
  {
    id: "spectre",
    name: "The Spectre",
    circle: "night",
    tagline: "Play the Spectre if you want to haunt the city as an unfinished ghost, anchored to the world by the things you left behind.",
    demeanors: ["brooding", "distant", "fierce", "mournful"],
    baseStats: { blood: 1, heart: 0, mind: -1, spirit: 1 },
    circleRatings: { mortalis: 0, night: 1, power: 1, wild: -1 },
    circleStatus: { mortalis: 0, night: 1, power: 0, wild: 0 },
    introQuestions: [
      "What memories do you still hold of your death?",
      "How long have you been in the city?",
      "Who looks after you when your trauma overwhelms you?",
      "What place in the city still makes you feel alive?",
      "Which of your anchors has been most recently threatened?",
    ],
    startingGear: [
      { label: "Whatever was on your person when you died, albeit spiritual versions of each (detail).", detail: true },
    ],
    startingDebts: [
      "Someone, or someone's progenitor, was involved in your death. They owe you a Debt.",
      "Someone is actively watching over one of your anchors. Ask them why they agreed to keep it safe. You owe them 2 Debts.",
      "Someone almost destroyed one of your anchors once, perhaps by accident or carelessness. Ask them what happened. They owe you 2 Debts.",
    ],
    letItOut: [
      "instantaneously travel to one of your anchors, no matter the distance",
      "take control of a machine or vehicle by possessing its mechanical form",
      "let loose a psychic blast of ectoplasmic energy (2-harm close area ap)",
      "follow an ordinary mortal — no matter where they go",
    ],
    moveCount: 3,
    movesInstruction: "You get Manifest, then choose two more:",
    featureDefs: [
      { key: "anchors", label: "Four anchors (people, places, objects)", required: true, description: "Choose and describe your 4 anchors — the things that keep you tied to the world of the living." },
      { key: "deathCircumstances", label: "Death circumstances", required: true, description: "What were you carrying when you died? What is the spiritual version of your possessions?" },
      { key: "trauma", label: "Trauma", required: false, description: "Describe the trauma your death left on you. (Optional at chargen.)" },
    ],
    moves: [
      { id: "spectre-manifest", name: "Manifest", required: true, description: "When you make yourself visible or audible to the living, roll with Spirit. On a 10+, you manifest fully and clearly for the scene. On a 7-9, you manifest but choose 1: you take 1-harm (ap), your manifestation is unstable and flickering, or you mark corruption." },
      { id: "spectre-wont-be-ignored", name: "Won't Be Ignored", description: "When you haunt someone relentlessly — appearing in mirrors, whispering in their ear, moving their objects — roll with Spirit. On a 10+, hold 3. On a 7-9, hold 2. Spend hold 1-for-1 to compel them to go to a specific place, reveal a secret, or be unable to sleep until they act." },
      { id: "spectre-ghost-town", name: "Ghost Town", description: "When you reach into the ghost world to see events that occurred in a location, roll with Spirit. On a 10+, you see clearly up to a week back. On a 7-9, you see fragments — the MC chooses what's clear and what's distorted." },
      { id: "spectre-potent", name: "Potent", description: "Your ectoplasmic attacks deal +1 harm and count as supernatural for the purpose of overcoming resistances and vulnerabilities." },
      { id: "spectre-wall-what-wall", name: "Wall? What Wall?", description: "Physical barriers don't stop you. You can pass through walls, floors, and ceilings at will. When you do so in combat or under pressure, roll with Blood; on a miss, something pulls you back." },
      { id: "spectre-conduit", name: "Conduit", description: "When you channel the voice or memories of another dead person, roll with Spirit. On a 10+, the communication is clear and complete. On a 7-9, you get fragments and must mark corruption or take 1-harm (ap) from the strain." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Sworn ───────────────────────────────────────────────────────────────
  {
    id: "sworn",
    name: "The Sworn",
    circle: "power",
    tagline: "Play the Sworn if you want to serve a powerful supernatural master as their enforcer and emissary, caught between duty and conscience.",
    demeanors: ["disciplined", "haunted", "proud", "wary"],
    baseStats: { blood: 1, heart: 0, mind: 1, spirit: -1 },
    circleRatings: { mortalis: -1, night: 0, power: 1, wild: 1 },
    circleStatus: { mortalis: 0, night: 0, power: 1, wild: 0 },
    introQuestions: [
      "Why did you swear your oath?",
      "How long have you been in the city?",
      "Who trained you in the ways of your order?",
      "What marks you as different from the masters you serve?",
      "Whose disappearance are you investigating?",
    ],
    startingGear: [
      { label: "A luxurious house or apartment, a fancy car, an expensive smartphone." },
      { label: "One backup weapon of choice:", options: [
        "9mm Beretta (2-harm near loud concealable)",
        "Hunting Knife (2-harm hand)",
        "Sawed-off shotgun (2-harm close loud reload messy concealable)",
      ], count: 1 },
    ],
    startingDebts: [
      "Someone gives you info about a Circle you don't understand. You owe them a Debt.",
      "You secretly helped someone get justice for a wrong done upon them. They owe you a Debt. Tell them why you helped.",
      "Your service forced you to punish or kill someone's ally or friend on behalf of your masters. You owe them a Debt.",
    ],
    letItOut: [
      "shatter a magical spell, illusion, or enchantment with a touch",
      "cloak yourself in magical armor; expend it to ignore all harm one time",
      "strike down all lesser foes in your vicinity with a blast of elemental force",
      "force someone to answer your questions truthfully for a scene",
    ],
    moveCount: 2,
    movesInstruction: "Choose two:",
    featureDefs: [
      { key: "masters", label: "Masters (who you serve)", required: true, description: "Name the supernatural masters you are sworn to serve and describe your oath." },
      { key: "legendaryWeapon", label: "Legendary weapon", required: false, description: "If your order provides a legendary weapon, describe it and its properties." },
      { key: "oathObligations", label: "Oath obligations (choose 5)", required: true, description: "List the 5 obligations your oath places on you (e.g. never kill the innocent, always obey the council, etc.)." },
    ],
    moves: [
      { id: "sworn-protect-and-serve", name: "Protect and Serve", description: "When you put yourself between your masters' interests and an oncoming threat, roll with Blood. On a 10+, you hold the line — the threat is stopped and you take no harm. On a 7-9, you hold the line but take 1-harm. On a miss, the threat gets through and you take 2-harm." },
      { id: "sworn-hard-to-shake", name: "Hard to Shake", description: "When someone tries to lose you or escape your pursuit, roll with Blood. On a hit, you stay on them. On a 10+, you also learn one thing about where they're headed or who they're running to." },
      { id: "sworn-devious", name: "Devious", description: "When you manipulate someone by appealing to their loyalty or sense of duty, roll with Mind instead of Heart." },
      { id: "sworn-genuine-police", name: "Genuine Police", description: "When you flash credentials or invoke the authority of your masters to deal with a problem, roll with Mind. On a 10+, NPCs comply and the situation resolves without violence. On a 7-9, they comply but mark your Circle — your masters will hear about this use of authority." },
      { id: "sworn-chess-not-checkers", name: "Chess Not Checkers", description: "When you take time to plan an operation in advance, roll with Mind. On a 10+, hold 3. On a 7-9, hold 2. Spend hold 1-for-1 during the operation to have anticipated a complication, have the right ally on standby, or know the fastest exit." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Tainted ─────────────────────────────────────────────────────────────
  {
    id: "tainted",
    name: "The Tainted",
    circle: "wild",
    tagline: "Play the Tainted if you want to struggle against a demonic patron whose power you depend on but whose agenda terrifies you.",
    demeanors: ["desperate", "intense", "sardonic", "volatile"],
    baseStats: { blood: 1, heart: 1, mind: -1, spirit: 0 },
    circleRatings: { mortalis: 1, night: -1, power: 0, wild: 1 },
    circleStatus: { mortalis: 0, night: 0, power: 0, wild: 1 },
    introQuestions: [
      "Why did you trade away your soul?",
      "How long have you been in the city?",
      "Which fellow demonic agent do you loathe?",
      "How do you cope with your demonic dreams and hungers?",
      "What do you desperately need?",
    ],
    startingGear: [
      { label: "A house or apartment, a car, a smartphone." },
      { label: "One brutal weapon of choice:", options: [
        "Truncheon (2-harm hand stun)",
        "9mm Beretta (2-harm near loud concealable)",
        "Pump-action shotgun (3-harm close/near loud reload messy)",
        "Sword (3-harm close messy)",
      ], count: 1 },
    ],
    startingDebts: [
      "You're protecting someone from a dark power, a rival and enemy of your demonic patron. Your charge owes you a Debt.",
      "Someone is trying to save you from damnation and keeps suffering for it. Ask them why they care when no one else does. You owe them a Debt.",
      "You hurt or killed someone's good friend or ally on your demonic patron's orders. You owe them a Debt.",
    ],
    letItOut: [
      "imbue your touch with demonic corruption (2-harm hand ap)",
      "impress, dismay, or frighten someone with a display of demonic fury",
      "move through or past a physical obstacle created by mortal hands",
      "resist or ignore the effects of a supernatural compulsion or mind control",
    ],
    moveCount: 3,
    movesInstruction: "You get The Devil Inside, then choose two more:",
    featureDefs: [
      { key: "demonicPatron", label: "Demonic patron", required: true, description: "Name and describe the demon or dark power that owns a piece of your soul. What did you trade it for?" },
      { key: "demonicJobs", label: "Demonic jobs (choose 2)", required: true, description: "What two kinds of jobs does your patron call on you to do (intimidation, assassination, corruption, etc.)?" },
      { key: "demonForm", label: "Demon form", required: false, description: "Describe what you look like when your demonic nature fully manifests." },
    ],
    moves: [
      { id: "tainted-the-devil-inside", name: "The Devil Inside", required: true, description: "When you call upon your demonic patron for power, roll with Blood. On a 10+, hold 3. On a 7-9, hold 2, but mark corruption. Spend hold 1-for-1 to gain +2 harm on an attack, ignore armor for one hit, or take +1 ongoing until the end of the scene. On a miss, your patron answers — but demands something terrible." },
      { id: "tainted-invocation", name: "Invocation", description: "When you perform a demonic ritual to summon or bind a lesser supernatural entity, roll with Spirit. On a 10+, it works as intended. On a 7-9, it works but the entity is resentful — it obeys but looks for opportunities to cause harm. On a miss, the entity is hostile and someone is going to get hurt." },
      { id: "tainted-tongued-and-silver", name: "Tongued and Silver", description: "When you seduce or beguile someone with your demonic charm, roll with Heart. On a 10+, they are fully in your sway for the scene. On a 7-9, they're interested but not committed — they want something first. On a miss, they're suspicious and on guard." },
      { id: "tainted-dark-bargain", name: "Dark Bargain", description: "When you offer someone something they desperately want in exchange for their cooperation, roll with Mind. On a 10+, they agree and owe you a Debt. On a 7-9, they agree but only for a limited time — and they'll resent you for it. On a miss, your patron takes notice of the bargain and has opinions." },
      { id: "tainted-tough-as-nails", name: "Tough as Nails", description: "When you take harm, you may mark corruption to reduce it by 2 (minimum 0). This represents your demonic resilience absorbing the blow." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Vamp ────────────────────────────────────────────────────────────────
  {
    id: "vamp",
    name: "The Vamp",
    circle: "night",
    tagline: "Play the Vamp if you want to navigate the city's predatory social web as an undead creature of the night, hungry for blood and power.",
    demeanors: ["alluring", "calculating", "imperious", "restless"],
    baseStats: { blood: 1, heart: 1, mind: 0, spirit: -1 },
    circleRatings: { mortalis: 1, night: 1, power: -1, wild: 0 },
    circleStatus: { mortalis: 0, night: 1, power: 0, wild: 0 },
    introQuestions: [
      "When did you become a vampire?",
      "How long have you been in the city?",
      "How do you keep your cravings in check?",
      "How did you acquire your haven?",
      "What deal are you invested in right now?",
    ],
    startingGear: [
      { label: "A secluded apartment, a comfortable car, a smartphone." },
      { label: "One stylish weapon of choice:", options: [
        "Dual Colt Double Eagles (3-harm near loud)",
        "Sword (3-harm close messy)",
        "Walther PPK (2-harm close/near reload concealable)",
      ], count: 1 },
    ],
    startingDebts: [
      "Someone makes sure you get fed regularly, without attracting too much attention. You owe them 2 Debts.",
      "Someone relies on you for their fix. Ask them what you provide that keeps them sane. They owe you a Debt; add them to your web.",
      "Someone recently sold you out to one of your enemies. You avoided the worst of the attacks, but your betrayer owes you a Debt; add them to your web.",
    ],
    letItOut: [
      "create an opportunity to escape, ignoring all mortal bindings",
      "perform a fantastic feat of vampiric strength or agility",
      "extend your vampiric senses for a short period of time",
      "display your dominance; low-Status NPCs flee, PCs must keep their cool",
    ],
    moveCount: 3,
    movesInstruction: "You get Eternal Hunger, then choose two more:",
    featureDefs: [
      { key: "haven", label: "Haven", required: true, description: "Describe your haven — where it is, its advantages (choose 2), and its dangers (choose 2)." },
      { key: "web", label: "Web (enthralled contacts)", required: true, description: "Name at least 1 person in your web — someone you feed on or who depends on you." },
    ],
    moves: [
      { id: "vamp-eternal-hunger", name: "Eternal Hunger", required: true, description: "At the start of each session, mark hungry. When you feed on a willing or helpless mortal, clear hungry and take +1 forward. When you are hungry and act violently, roll with Blood — on a miss, you lose control and feed whether you intended to or not." },
      { id: "vamp-always-welcome", name: "Always Welcome", description: "When you enter a social situation where you aren't explicitly banned, roll with Heart. On a 10+, you are welcomed and treated as an equal by the most important person in the room. On a 7-9, you get access, but someone important is suspicious of your motives." },
      { id: "vamp-cold-blooded", name: "Cold-Blooded", description: "When you act without empathy or conscience to get what you want, roll with Mind instead of Blood. On a miss, your ruthlessness costs you — someone unexpected is harmed or a relationship is permanently damaged." },
      { id: "vamp-keep-your-friends-close", name: "Keep Your Friends Close", description: "When you add someone to your web by feeding on them or making them dependent on you, roll with Heart. On a hit, they are enthralled and owe you a Debt. On a 10+, they'll also do one thing for you right now, no questions asked. On a miss, they resist the enthrallment — and they're angry about the attempt." },
      { id: "vamp-terrifying", name: "Terrifying", description: "When you drop the social mask and let your true monstrous nature show, all NPCs in the scene must act according to their nature — most flee or cower, but some are drawn toward you." },
      { id: "vamp-in-the-neighborhood", name: "In the Neighborhood", description: "When you feed in your territory or call on someone from your web for information, you always have a lead. The MC must give you a name, a place, or a connection — never nothing." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Veteran ─────────────────────────────────────────────────────────────
  {
    id: "veteran",
    name: "The Veteran",
    circle: "mortalis",
    tagline: "Play the Veteran if you want to portray a powerful figure from the city's past trying to stay retired — and failing.",
    demeanors: ["guarded", "methodical", "sardonic", "world-weary"],
    baseStats: { blood: -1, heart: 1, mind: 1, spirit: 0 },
    circleRatings: { mortalis: 1, night: 0, power: 0, wild: 0 },
    circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 },
    introQuestions: [
      "What were you once known for in the city?",
      "How long have you lived here?",
      "What was your greatest accomplishment?",
      "Why did you step back from who you were?",
      "What do you desperately need?",
    ],
    startingGear: [
      { label: "An apartment or warehouse hideout, a practical car or old pick-up truck, a smartphone, a workshop (detail).", detail: true },
      { label: "One trusty weapon of choice:", options: [
        "9mm Beretta (2-harm near loud concealable)",
        "Pump-action shotgun (3-harm near/close loud reload messy)",
        "Magnum revolver (3-harm near loud reload)",
      ], count: 1 },
    ],
    startingDebts: [
      "Someone relies on you for training or knowledge. Ask them why they need your help; tell the MC what you've provided and ask how many Debts (1-3) you're owed.",
      "You're working on something big for someone, and it's nearly ready. They owe you a Debt.",
      "Someone keeps pulling your ass out of the fire when you forget you're retired. You owe them a Debt.",
    ],
    letItOut: [
      "blindside an unsuspecting target with a terrible or knockout blow",
      "barricade or secure a place using minimal supplies",
      "frighten or intimidate someone with a reminder of the person you used to be",
      "reveal the ways an old ally or enemy is shaping a current conflict",
    ],
    moveCount: 3,
    movesInstruction: "You get Old Friends, Old Favors, then choose two more:",
    featureDefs: [
      { key: "workshop", label: "Workshop / area of expertise", required: true, description: "Describe your workshop or area of expertise — what can you build, repair, or create there?" },
      { key: "reputation", label: "Old reputation", required: true, description: "What were you known for in the city's supernatural community before you stepped back?" },
    ],
    moves: [
      { id: "veteran-old-friends-old-favors", name: "Old Friends, Old Favors", required: true, description: "When you reach out to an old contact for help, roll with Heart. On a 10+, they help immediately and without obligation. On a 7-9, they help but it stirs up the past — something from your history resurfaces, and the MC says what. On a miss, they've moved on, changed sides, or can't be reached." },
      { id: "veteran-true-artist", name: "True Artist", description: "When you apply your craft or expertise to a problem (your workshop specialty), roll with Mind. On a 10+, the result is exceptional — better than expected. On a 7-9, it works but takes longer or costs more than planned. On a miss, something goes wrong and you need a specific thing to fix it." },
      { id: "veteran-invested", name: "Invested", description: "When you take someone under your wing and spend a session mentoring them, they take +1 forward to a move of your choice. You take +1 ongoing with them until something drives you apart." },
      { id: "veteran-too-old-for-this-shit", name: "Too Old for This Shit!", description: "When you wade into a dangerous situation that you've handled before, roll with Blood. On a 10+, you handle it with minimal fuss — no harm, no drama. On a 7-9, you handle it but show your age: take 1-harm or owe someone a Debt for their help." },
      { id: "veteran-the-best-laid-plans", name: "The Best Laid Plans", description: "When you brief allies on a plan before a job, roll with Mind. On a 10+, hold 3. On a 7-9, hold 2. Anyone following the plan can spend your hold 1-for-1 to act as if they rolled a 10+ on a move you anticipated." },
      { id: "veteran-gun-to-a-knife-fight", name: "Gun to a Knife Fight", description: "When you bring overwhelming force or preparation to a situation others expected to be simpler, the opposition must choose: back down or escalate. If they escalate, they take -1 forward from the surprise." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Wizard ──────────────────────────────────────────────────────────────
  {
    id: "wizard",
    name: "The Wizard",
    circle: "power",
    tagline: "Play the Wizard if you want to wield tremendous magical power while navigating the political obligations of the supernatural elite.",
    demeanors: ["arrogant", "cautious", "eccentric", "focused"],
    baseStats: { blood: 0, heart: -1, mind: 1, spirit: 1 },
    circleRatings: { mortalis: 0, night: -1, power: 1, wild: 1 },
    circleStatus: { mortalis: 0, night: 0, power: 1, wild: 0 },
    introQuestions: [
      "How did you learn to wield magic?",
      "How long have you been in the city?",
      "What mistake keeps you up at night?",
      "What have you sacrificed for your power?",
      "What conflict are you trying to mediate?",
    ],
    startingGear: [
      { label: "A nice apartment or simple house, a crappy car, a decent smartphone." },
      { label: "A sanctum (detail).", detail: true },
      { label: "One useful weapon of choice:", options: [
        "Snubnosed revolver (2-harm close/near loud reload concealable)",
        "9mm Glock (2-harm near loud concealable)",
        "Sword (3-harm close messy)",
      ], count: 1 },
    ],
    startingDebts: [
      "Someone tempted your ward away from you and into danger. Ask them what it cost your ward to return to you. They owe you a Debt.",
      "Someone is your go-to when you get into trouble, providing information or muscle to get things done. You owe them 2 Debts.",
      "You are helping someone keep a dangerous secret from powerful members of their Circle. They owe you a Debt.",
    ],
    letItOut: [
      "deflect or redirect an oncoming blow before it strikes",
      "perform a feat of telekinetic strength or precision",
      "detect the presence and function of magical items or spells",
      "reshape the essence or nature of an exposed object or magical spell",
    ],
    moveCount: 4,
    movesInstruction: "You get Channeling, then choose three spells:",
    featureDefs: [
      { key: "sanctum", label: "Sanctum", required: true, description: "Describe your sanctum. Choose 4 resources and 2 downsides from the lists in the playbook." },
      { key: "sanctumResources", label: "Sanctum resources (choose 4)", required: true, description: "e.g. knowledgeable assistant, testing ground, magical booby traps, library of old tomes, ancient relics, mystical prison, magical wards, portal to another dimension, focus circle, apothecary." },
      { key: "sanctumDownsides", label: "Sanctum downsides (choose 2)", required: true, description: "e.g. cursed by previous owner, attracts otherworldly attention, volatile substances, location known by many, always lacks key ingredient, tough to access, contains unknown secrets." },
      { key: "ward", label: "Ward NPC", required: true, description: "Name and describe your ward — who are they, why do they need your protection, and why did you accept this obligation?" },
    ],
    moves: [
      { id: "wizard-channeling", name: "Channeling", required: true, description: "When you channel and collect your magics, roll with Spirit. On a 10+, hold 3. On a 7-9, hold 3 and choose 1: take -1 ongoing until you rest, suffer 1-harm (ap), or mark corruption. On a miss, hold 1 but you cannot channel again this scene. Spend hold to activate your spells." },
      { id: "wizard-sanctum-sanctorum", name: "Sanctum Sanctorum", description: "When you go to your sanctum for a spell ingredient, relic, or tome, roll with Spirit. On a 10+, you've got just the thing. On a 7-9, you've got something close but flawed. On a miss, you don't have it, but you know someone from another Circle who might." },
      { id: "wizard-spell-tracking", name: "Spell: Tracking", description: "Spend 1 hold to learn the location of a specific person. You must have a personal object or recent leavings (a lock of hair, their blood, etc.) that belongs to the target." },
      { id: "wizard-spell-stun", name: "Spell: Stun", description: "Spend 1 hold to target someone with a blast of psychic energy that inflicts s-harm. Spend 2 hold to target a small group or 3 hold to target a medium group." },
      { id: "wizard-spell-linking", name: "Spell: Linking", description: "Spend 1 hold to telepathically link up to two characters in your presence for a few hours, allowing communication regardless of distance." },
      { id: "wizard-spell-shielding", name: "Spell: Shielding", description: "Spend 1 hold to provide armor+1 to yourself or someone nearby, or spend 2 hold to provide armor+1 to everyone in a small area. Lasts until end of scene." },
      { id: "wizard-spell-veil", name: "Spell: Veil", description: "Spend 1 hold to make yourself invisible from sight — mundane, supernatural, and electronic — for a few moments." },
      { id: "wizard-spell-teleport", name: "Spell: Teleport", description: "Spend 1 hold to teleport yourself a short distance within the current scene." },
      { id: "wizard-spell-trinket", name: "Spell: Trinket", description: "Spend 1 hold to produce a small mundane object that perfectly fits your needs. It vanishes within 24 hours or when its purpose is served." },
    ],
    advances: STANDARD_ADVANCES,
  },

  // ── The Wolf ────────────────────────────────────────────────────────────────
  {
    id: "wolf",
    name: "The Wolf",
    circle: "night",
    tagline: "Play the Wolf if you want to fight for what's yours, no matter who tries to take it from you.",
    demeanors: ["aggressive", "feral", "restless", "violent"],
    baseStats: { blood: 1, heart: -1, mind: 0, spirit: 1 },
    circleRatings: { mortalis: 0, night: 1, power: -1, wild: 1 },
    circleStatus: { mortalis: 0, night: 1, power: 0, wild: 0 },
    introQuestions: [
      "When did you first experience the change?",
      "How long have you been in the city?",
      "What is the best part of your other form?",
      "Who is the most important person in your territory?",
      "What do you desperately need?",
    ],
    startingGear: [
      { label: "A duffel bag with your personal belongings, a shitty cell phone." },
      { label: "Two practical weapons:", options: [
        "Snubnosed revolver (2-harm close/near loud reload concealable)",
        "9mm Beretta (2-harm near loud concealable)",
        "Butterfly knife (2-harm hand concealable)",
        "Machete (3-harm close messy)",
        "Baseball bat (2-harm close stun)",
      ], count: 2 },
    ],
    startingDebts: [
      "Someone intervened on your behalf when you crossed a powerful figure from another Circle. You owe them a Debt.",
      "Someone hired you for a job and you fucked it up. Tell them why another obligation got in the way. You owe them a Debt.",
      "Someone lives in your territory, benefiting from your protection. They owe you a Debt.",
    ],
    letItOut: [
      "heal 2-harm instantaneously, starting with critical harm",
      "transform from one form into the other without seeing the moon",
      "perform a ferocious feat of lupine strength and speed",
      "enhance your lupine senses to supernatural levels",
    ],
    moveCount: 2,
    movesInstruction: "You get Comes with the Territory, then choose one more:",
    featureDefs: [
      { key: "territory", label: "Territory", required: true, description: "Describe your territory — what area of the city you hold, its trouble (+crime by default), and which 2 blessings/options you chose." },
      { key: "transformation", label: "Transformation details", required: false, description: "Describe what your lupine form looks like and any distinctive traits." },
    ],
    moves: [
      { id: "wolf-comes-with-the-territory", name: "Comes with the Territory", required: true, description: "You hold a territory in the city. When a trouble from your territory finds you, roll with Blood. On a 10+, you handle it decisively — choose 2 from the list. On a 7-9, you handle it — choose 1. On a miss, the trouble escalates and something in your territory is damaged, endangered, or lost. List: no one gets hurt, your reputation is protected, you don't owe anyone a favor, nothing is destroyed." },
      { id: "wolf-alpha-dog", name: "Alpha Dog", description: "When you assert dominance over a supernatural being of lower or equal Status, roll with Blood. On a 10+, they back down and defer to you for the scene. On a 7-9, they defer for now but will look for an opportunity to reassert themselves." },
      { id: "wolf-reckless", name: "Reckless", description: "When you throw yourself into danger without hesitation, take +1 Blood forward. If you take harm as a result, take +1 Spirit forward as your instincts sharpen." },
      { id: "wolf-bloodhound", name: "Bloodhound", description: "When you track someone by scent, roll with Spirit. On a 10+, you find them with no complications. On a 7-9, you find them but something unexpected is at the location — the MC decides what." },
      { id: "wolf-mark-of-the-beast", name: "Mark of the Beast", description: "When you mark someone with your scent or claws to claim them as part of your territory, they cannot be harmed by other supernatural creatures in your territory without your permission — anyone who tries must face you first." },
    ],
    advances: STANDARD_ADVANCES,
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getPlaybook(id: string): IPlaybook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

export function listPlaybooks(): Pick<IPlaybook, "id" | "name" | "circle" | "tagline" | "demeanors">[] {
  return PLAYBOOKS.map(({ id, name, circle, tagline, demeanors }) => ({
    id, name, circle, tagline, demeanors,
  }));
}

/**
 * The language a MoodStamp cannot carry.
 *
 * A MoodStamp can be hard to receive — Rotten Eggs are criticism, and
 * criticism is allowed to sting. What it cannot be is abusive: no swearing, no
 * sexual or 18+ content, no slurs, no personal insults, no threats. The point
 * is to say what happened and how it felt, and a stamp full of abuse says
 * neither.
 *
 * The lists are written in plain lowercase ASCII. The matcher normalises what
 * people type — case, accents, leetspeak, masking, spacing, stretched letters
 * — down to the same form before comparing, so each word appears here once
 * rather than in every disguise.
 *
 * Common Hindi and Hinglish abuse is included: that is how a large share of
 * Skewvy's readers swear.
 */

export type ModerationCategory = 'profanity' | 'sexual' | 'hate' | 'insult' | 'threat';

/** Whole words. Matched only as a complete word, so "class" never trips "ass". */
export const WORDS: Record<ModerationCategory, string[]> = {
  profanity: [
    // English
    'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin', 'fuckn', 'fuckoff', 'fuckface',
    'fck', 'fcking', 'fuk', 'fuks', 'fukin', 'fukking', 'fucc', 'phuck', 'phuk', 'fuq', 'fuxk', 'effing',
    'shit', 'shits', 'shitty', 'shite', 'shitting', 'shithead', 'shitface', 'shithole', 'bullshit', 'horseshit',
    'dipshit', 'batshit', 'crap', 'crappy', 'damn', 'damned', 'dammit', 'damnit', 'goddamn', 'goddamnit',
    'bitch', 'bitches', 'bitchy', 'bitching', 'biatch', 'beeyotch', 'bastard', 'bastards', 'ass', 'arse',
    'asshole', 'assholes', 'arsehole', 'ahole', 'piss', 'pissed', 'pissing', 'pisser', 'bollocks', 'bugger',
    'wtf', 'stfu', 'gtfo', 'omfg', 'fml', 'cunt', 'cunts', 'twat', 'wank', 'wanker', 'wanking', 'motherfucker',
    'motherfucking', 'mofo', 'jackass', 'dumbass', 'smartass', 'badass', 'hellhole',
    // Hindi / Hinglish
    'bhenchod', 'behenchod', 'benchod', 'bhanchod', 'bahenchod', 'bhencho', 'behnchod', 'madarchod', 'maderchod',
    'madharchod', 'madarjaat', 'chutiya', 'chutiye', 'chutia', 'chootiya', 'chutiyapa', 'chut',
    'choot', 'gand', 'gaand', 'gandu', 'gaandu', 'bhosdike', 'bhosadike', 'bhosdi', 'bhosdiwale', 'bhosda',
    'bsdk', 'lund', 'lauda', 'lavda', 'lawda', 'lodu', 'loda', 'jhatu', 'jhaatu', 'jhaat', 'chodu', 'chod',
    'chodna', 'randwa', 'raand', 'randibaaz', 'kutiya', 'haramkhor', 'tatti',
  ],
  sexual: [
    'sex', 'sexy', 'sexting', 'sext', 'horny', 'nude', 'nudes', 'naked', 'nudity', 'porn', 'porno', 'porns',
    'pornography', 'pornhub', 'boob', 'boobs', 'boobies', 'tits', 'titties', 'titty', 'dick', 'dicks', 'cock',
    'cocks', 'pussy', 'pussies', 'penis', 'vagina', 'blowjob', 'blowjobs', 'handjob', 'orgasm', 'orgasms',
    'masturbate', 'masturbating', 'masturbation', 'cum', 'cumming', 'jizz', 'erection', 'boner', 'dildo',
    'vibrator', 'fetish', 'kinky', 'milf', 'dilf', 'hentai', 'xxx', 'onlyfans', 'threesome', 'orgy', 'stripper',
    'hooker', 'prostitute', 'slut', 'sluts', 'slutty', 'whore', 'whores', 'thot', 'nsfw', 'bdsm', 'anal',
    'fellatio', 'cunnilingus', 'genitals', 'butthole', 'seduce', 'seductive', 'nipple', 'nipples', 'lingerie',
  ],
  hate: [
    'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'dyke', 'dykes', 'tranny',
    'trannies', 'retard', 'retards', 'retarded', 'spastic', 'chink', 'chinks', 'gook', 'spic', 'kike', 'paki',
    'pakis', 'raghead', 'towelhead', 'wetback', 'coon', 'beaner', 'mongoloid', 'chakka', 'chhakka',
  ],
  insult: [
    'idiot', 'idiots', 'idiotic', 'moron', 'morons', 'moronic', 'imbecile', 'loser', 'losers', 'jerk', 'scumbag',
    'dickhead', 'prick', 'douche', 'douchebag', 'dimwit', 'halfwit', 'nitwit', 'numbskull', 'bonehead',
    'blockhead', 'cretin', 'degenerate', 'lowlife', 'bimbo', 'skank', 'airhead', 'pea-brain', 'peabrain',
    'nincompoop', 'dumbo', 'kutta', 'kutte', 'kutti', 'kamina', 'kamine', 'kamini', 'harami', 'haramzada',
    'haramzade', 'nalayak', 'nikamma', 'nikammi',
    // Body-shaming
    'fatso', 'fatty', 'fatass', 'lardass', 'lardo', 'blimp', 'pigface', 'uggo',
  ],
  threat: ['kys'],
};

/**
 * Words whose every longer form is still the same word: "fuckwit", "shitshow",
 * "bitchface". Matched at the start of a word. Only roots that cannot begin an
 * innocent word belong here — "ass" is not one ("assess"), nor is "cock"
 * ("cockpit").
 */
export const ROOTS: Record<ModerationCategory, string[]> = {
  profanity: ['fuck', 'shit', 'bitch', 'bastard', 'cunt', 'twat', 'wank', 'bullshit', 'asshole', 'motherfuck', 'dumbass', 'jackass', 'bhenchod', 'behenchod', 'madarchod', 'chutiy', 'bhosd', 'gaand'],
  sexual: ['porn', 'masturb', 'blowjob', 'handjob', 'dildo', 'slut', 'whore', 'horny', 'boob', 'orgasm'],
  hate: ['nigg', 'fagg'],
  insult: ['dickhead', 'douche', 'scumbag', 'idiot', 'moron'],
  threat: [],
};

/**
 * Distinctive enough to find even inside run-together text, where spaces have
 * been stripped to get past a word filter ("fu ck", "go fuckyourself"). Each
 * is long or odd enough not to appear across the join of two innocent words.
 */
export const FRAGMENTS: Record<ModerationCategory, string[]> = {
  profanity: ['fuck', 'motherfuck', 'behenchod', 'bhenchod', 'madarchod', 'chutiya', 'bhosdike'],
  sexual: ['blowjob', 'handjob', 'pornhub'],
  hate: ['nigger', 'nigga', 'faggot'],
  insult: [],
  threat: ['killyourself', 'killurself'],
};

/** Phrases: harmless word by word, abusive together. Matched on whole words in order. */
export const PHRASES: Record<ModerationCategory, string[]> = {
  profanity: ['f off', 'piss off', 'screw you', 'go screw yourself'],
  sexual: [
    'send nudes', 'send me nudes', 'sleep with me', 'sleep with you', 'have sex', 'get laid', 'one night stand',
    'strip for me', 'take off your clothes', 'turn me on', 'turns me on', 'in bed with you', 'suck my',
    'sit on my face', 'make love to', 'friends with benefits', 'sugar daddy',
  ],
  hate: [],
  insult: [
    'shut up', 'nobody likes you', 'no one likes you', 'nobody cares about you',
    'no one cares about you', 'waste of space', 'waste of oxygen', 'waste of air', 'piece of garbage',
    'piece of trash', 'piece of crap', 'you make me sick', 'i hate you', 'hate your guts', 'ullu ka pattha',
    'ullu ke patthe', 'ullu ki patthi', 'bhaad mein ja', 'get a life', 'grow a brain', 'go to hell',
    'burn in hell', 'rot in hell',
    // Body-shaming: words that describe a thing, aimed at a body or a face.
    'fattest kid', 'fattest person', 'fattest girl', 'fattest boy', 'fattest guy', 'fattest one',
    'ugliest kid', 'ugliest person', 'ugliest girl', 'ugliest boy', 'ugliest guy', 'ugliest one', 'ugliest face',
    'fat pig', 'fat cow', 'fat slob', 'fat kid', 'fat loser', 'ugly face', 'ugly mug', 'so fat', 'so ugly',
    'too fat', 'too ugly',
  ],
  threat: [
    'kill you', 'kill u', 'murder you', 'will hurt you', 'gonna hurt you', 'ill hurt you', 'beat you up',
    'break your legs', 'break your neck', 'break your face', 'i will find you', 'ill find you', 'watch your back',
    'you will pay for this', 'you will regret this', 'hope you die', 'hope u die', 'go die', 'drop dead', 'kill yourself', 'kill urself', 'kill your self', 'end yourself', 'end your life',
    'slit your', 'shoot you', 'stab you', 'burn your house', 'jaan se maar', 'maar dunga', 'maar dalunga',
  ],
};

/**
 * Words that describe an action fairly — "a useless meeting", "a stupid
 * mistake" — but insult a person when aimed at one: "you're useless". Flagged
 * only in that second shape, after "you are", "you're", "you were", "you
 * look" and the like, which is the line a MoodStamp is asked to hold:
 * criticise what happened, not who they are.
 */
export const TARGETED_INSULTS = [
  'stupid', 'dumb', 'useless', 'worthless', 'pathetic', 'ugly', 'fat', 'lazy', 'disgusting', 'incompetent',
  'clueless', 'brainless', 'spineless', 'hopeless', 'fool', 'clown', 'joke', 'failure', 'trash', 'garbage',
  'creep', 'freak', 'psycho', 'bewakoof', 'pagal', 'gadha', 'ullu', 'nobody', 'waste', 'dog', 'pig',
];

/** Nouns that insult even straight after a bare "you": "you clown", "you fool". */
export const VOCATIVE_INSULTS = ['fool', 'clown', 'creep', 'freak', 'psycho', 'pig', 'bewakoof', 'gadha', 'ullu'];

/**
 * Innocent phrases that happen to contain a listed word. Removed before
 * matching, so "a chink in the armour" and "knee-jerk" pass.
 */
export const ALLOWED_PHRASES = [
  'chink in the armour', 'chink in the armor', 'chinks in the armour', 'chinks in the armor', 'knee jerk',
  'kneejerk', 'cum laude', 'magna cum laude', 'summa cum laude',
];

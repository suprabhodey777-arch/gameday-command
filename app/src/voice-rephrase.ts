import { normalise } from './voice-commands.ts';

/**
 * People do not talk in commands. "Can you get some backup over to gate two",
 * "shut down Woody Hayes", "tell everyone the west gates are open" and "how's
 * gate 2 looking" all mean something the command box already knows how to do.
 * This rewrites everyday speech into those commands: it drops the chat around
 * an order, maps the many ways of saying each verb onto one, and fixes words
 * dictation commonly mishears. It is only tried when the words as said were
 * not understood, and whatever it produces still goes through the same strict
 * parser and is shown back to confirm, so a rewrite can never act on its own.
 */

/** Said before an order and adding nothing to it. Stripped repeatedly from the front. */
const LEAD_INS = [
  'hey', 'hi', 'ok', 'okay', 'alright', 'all right', 'right', 'so', 'um', 'uh', 'er', 'erm', 'yeah', 'well', 'now', 'and', 'then', 'also',
  'please', 'kindly', 'just', 'quickly', 'immediately', 'actually', 'basically', 'command', 'dispatch here', 'control',
  'can you', 'could you', 'would you', 'will you', 'can we', 'could we', 'should we', 'shall we', 'lets', 'let us',
  'i want you to', 'i want to', 'i need you to', 'i need to', 'i would like you to', 'i would like to', 'id like to', 'id like you to',
  'we need to', 'we should', 'we have to', 'we gotta', 'we must', 'you need to', 'you should', 'i think we should', 'i think we need to',
  'go ahead and', 'try to', 'make sure to', 'make sure we', 'maybe', 'how about we', 'why dont we', 'why dont you',
];
/** Said after an order: politeness and urgency. Stripped repeatedly from the end. */
const TRAILERS = ['please', 'now', 'right now', 'right away', 'immediately', 'asap', 'as soon as possible', 'thanks', 'thank you', 'for me', 'quickly', 'fast', 'over', 'over and out', 'copy', 'if you can', 'if possible', 'okay', 'ok'];

/** Count words dictation leaves as words. */
const COUNTS: [RegExp, string][] = [
  [/\ba (?:few|handful of)\b/g, '3'],
  [/\bfew\b/g, '3'],
  [/\bseveral\b/g, '4'],
  [/\ba (?:bunch|lot|group|team|squad) of\b/g, '6'],
  [/\b(?:a )?couple(?: of)?\b/g, '2'],
  // `normalise` has already made "a couple of" into "a 2 of".
  [/\b(?:a )?(\d+) of\b/g, '$1'],
  [/\b(?:a )?dozen\b/g, '12'],
];

/** Words dictation hears instead of the ones meant. Applied only before a number or a name, where they are unambiguous. */
const MISHEARD: [RegExp, string][] = [
  [/\b(?:gait|gates|kate|gay|gated|great|grate)( \d+)\b/g, 'gate$1'],
  [/\bget (\d+)\b(?! (?:officers?|cops?|police|units?|people|men|guys))/g, 'gate $1'],
  [/\bgate number (\d+)\b/g, 'gate $1'],
  [/\b(?:offices|officer s|ossifers|officers s)\b/g, 'officers'],
  [/\bpolice ?(?:men|women|officers|people)\b/g, 'officers'],
  [/\b(?:pea a|p a|pee a|p\.a\.)\b/g, 'pa'],
  [/\bplan (?:bee|be)\b/g, 'plan b'],
  [/\bplan (?:see|sea)\b/g, 'plan c'],
  [/\bnorth east\b/g, 'northeast'],
  [/\bnorth west\b/g, 'northwest'],
  [/\bsouth east\b/g, 'southeast'],
  [/\bsouth west\b/g, 'southwest'],
];

/** People and the ways of saying them. */
const STAFF = '(?:officers?|cops?|police|units?|patrols?|guys|men|people|staff|security|team|squad|backup|back up|help|support|reinforcements)';
const MOVE = '(?:send|get|put|station|post|position|move|deploy|dispatch|bring|place|have|assign|throw|rush)';
const CROWD = '(?:people|fans|the crowd|everyone|everybody|folks|them|the fans|the people|traffic)';
const TO = '(?:(?:over|down|up|out|right) (?:to|at|by|on|near)|to|at|on|by|near|toward|towards|into)';

/** Rewrites, in order. Each takes normalised text and returns it rewritten (or unchanged). */
const RULES: [RegExp, string][] = [
  // "we need more cops at gate 2", "i want 3 officers on the plaza".
  [new RegExp(`^(?:we|i) (?:need|want|could use|gotta get|have to get)(?: (?:some|more|extra|a few))? (\\d+ )?(?:more |extra )?${STAFF} ${TO} (?:the )?(.+)$`), 'send $1officers to $2'],
  // Asking for help at a place is sending officers there.
  [new RegExp(`^(.+?) (?:needs?|could use|wants?|requires?|is asking for) (?:some |more |extra )?(?:\\d+ )?(?:backup|back up|help|support|officers|cops|police|units|reinforcements)$`), 'send 4 officers to $1'],
  [new RegExp(`^(?:more |extra |some )?(?:backup|back up|help|support|reinforcements|officers|cops|police) (?:needed )?${TO} (.+)$`), 'send 4 officers to $1'],
  // "get 4 officers over to gate 2", "station two cops at the plaza", "have security at gate 3".
  [new RegExp(`^${MOVE}(?: (?:me|us))?(?: (?:an?|some|the|more|extra|a few))? (\\d+ )?(?:more |extra )?${STAFF}(?: (?:officers|units))? ${TO} (?:the )?(.+)$`), 'send $1officers to $2'],
  // Crowd moves are redirects: "move people from gate 1 to gate 5", "tell fans at gate 2 to use gate 1".
  [new RegExp(`^(?:move|send|direct|point|route|push|shift|walk|guide|steer|take) ${CROWD} (?:away )?from (.+?) (?:to|over to|toward|towards) (.+)$`), 'redirect $1 to $2'],
  [new RegExp(`^(?:tell|ask|get|have) ${CROWD} (?:at|near|by|in) (.+?) to (?:use|go to|head to|walk to|move to|try) (.+)$`), 'redirect $1 to $2'],
  [/^use (.+?) instead of (.+)$/, 'redirect $2 to $1'],
  [/^(.+?) is (?:full|packed|jammed|blocked|too busy|too crowded|overloaded|swamped)[, ]+(?:send|move|redirect|push) (?:them|people|fans|the crowd|everyone) to (.+)$/, 'redirect $1 to $2'],
  // Closing, in its many forms.
  [/^(?:shut|lock|block|close|seal|cordon|rope|fence|tape) (?:down|off|up) (.+)$/, 'close $1'],
  [/^(?:shut|lock|block|close|seal|cordon|rope|fence|tape) (.+?) (?:down|off|up)$/, 'close $1'],
  [new RegExp(`^(?:dont|do not|stop) (?:let(?:ting)? )?(?:anyone|anybody|${CROWD}) (?:go |get |come |walk |drive )?(?:in|into|through|use|on|onto|past)(?: at)? (.+)$`), 'close $1'],
  [/^(?:put up|set up|place|drop) (?:a |some )?(?:barricades?|barriers?|roadblocks?|cones) (?:on|at|across|in) (.+)$/, 'close $1'],
  [/^(?:keep|leave) (.+?) (?:closed|shut|locked)$/, 'close $1'],
  [/^(?:no one|nobody|no traffic|no cars) (?:goes |gets |through |on |in )*(.+)$/, 'close $1'],
  // Opening, in its many forms.
  [new RegExp(`^(?:let|allow) ${CROWD} (?:in|into|through|use|back in|back into)(?: at| through| via)? (.+)$`), 'open $1'],
  [/^(?:open up|reopen|unlock|unblock|clear) (.+)$/, 'open $1'],
  [/^(?:take down|remove|pull|lift|drop) (?:the )?(?:barricades?|barriers?|roadblocks?|closure|cones) (?:on|at|from|across)? ?(.+)$/, 'open $1'],
  [/^(?:keep|leave) (.+?) open$/, 'open $1'],
  // Announcements: keep the commander's words after the verb.
  [new RegExp(`^(?:announce|broadcast|make an? (?:pa )?announcement|put out an? (?:pa )?(?:announcement|message)|tell ${CROWD}|let ${CROWD} know|say over the (?:pa|speakers?|loudspeakers?)|over the (?:pa|speakers?)|pa announcement|on the pa|get on the pa and (?:say|tell everyone))(?: (?:saying|that|to say|to))? (.+)$`), 'pa: $1'],
  [new RegExp(`^(?:text|message|notify|ping|push (?:an? )?(?:alert|notification) to|send (?:an? )?(?:text|message|push notification|push|alert|notification)(?: to)?) ?(?:everyones? phones?|${CROWD}|the phones|phones|all phones)?(?: (?:saying|that|to say|telling them|telling them to))? (.+)$`), 'phone: $1'],
  // Shelter.
  [/^(?:get|move|send|bring) (?:everyone|everybody|people|fans|the crowd) (?:inside|indoors|under cover|to (?:shelter|safety|cover))$/, 'shelter'],
  [/^(?:lightning|storm|weather) (?:protocol|plan|procedure|shelter)$/, 'shelter'],
  // Questions.
  [/^(?:hows|how is|how s|what about|whats (?:happening|going on) (?:at|with)|whats the (?:situation|status|line|queue) (?:at|for)|is) (gate \d+)(?: (?:doing|looking|going|busy|ok|okay|crowded|bad|packed))?$/, 'how many waiting at $1'],
  [/^(?:any|are there any|where are the|where is the|wheres the|show me the) (?:problems?|trouble|issues?|hotspots?|jams?|crowds?|bottlenecks?)(?: right now)?$/, 'where is it congested'],
  [/^(?:where should i (?:look|worry|focus)|what should i worry about|whats the worst (?:area|spot|place)|wheres it bad)$/, 'where is it congested'],
  [/^how many (?:officers|cops|police|units)(?: (?:do we have|have we got|are there|left|available|do i have))+$/, 'how many officers are free'],
  [/^(?:whats going on|whats happening|give me an? (?:update|sitrep|rundown|overview)|brief me|catch me up|fill me in|where are we|update me|report)$/, 'status'],
  [/^(?:which gate is (?:the )?(?:worst|busiest)|whats the busiest gate|wheres the (?:biggest|longest) (?:line|queue))$/, 'whats the worst gate'],
  // Controls.
  [/^(?:go|lets go|start it|start it up|kick it off|kick off|hit play|press play|play it|run it|begin|start the (?:sim|simulation|game))$/, 'run the plans'],
  [/^(?:hold on|hold up|wait|stop it|freeze it|pause it|stop the sim|stop everything)$/, 'pause'],
  [/^(?:fast forward|speed (?:it|things) up|hurry up|go quicker|quicker)$/, 'faster'],
  [/^(?:slow it down|go slower|slower please|not so fast)$/, 'slow down'],
  [/^(?:start over|reset everything|go back to the (?:start|beginning)|from the top|run it again)$/, 'restart the plans'],
  [/^(?:overhead|top|birds eye|map|flat) (?:view|map)?$/, 'show 2d'],
  [/^(?:compare(?: them| the plans)?|show (?:me )?all (?:of them|plans)|all plans side by side)$/, 'show all 3'],
];

// Longest first, so "right now" goes before "now" can leave a stray "right".
const LEADS_LONGEST = [...LEAD_INS].sort((a, b) => b.length - a.length);
const TRAILERS_LONGEST = [...TRAILERS].sort((a, b) => b.length - a.length);

function strip(s: string): string {
  let out = s;
  for (let changed = true; changed; ) {
    changed = false;
    for (const lead of LEADS_LONGEST) {
      if (out === lead) continue;
      if (out.startsWith(`${lead} `)) {
        out = out.slice(lead.length + 1);
        changed = true;
      }
    }
    for (const tail of TRAILERS_LONGEST) {
      if (out === tail) continue;
      if (out.endsWith(` ${tail}`)) {
        out = out.slice(0, -(tail.length + 1));
        changed = true;
      }
    }
  }
  return out.trim();
}

/** Whether one of the specific rewrites matched, rather than only trimming chat around the words. */
export function rephrasedByRule(text: string): boolean {
  if (text.includes(':')) return false;
  let s = normalise(text);
  for (const [re, to] of COUNTS) s = s.replace(re, to);
  for (const [re, to] of MISHEARD) s = s.replace(re, to);
  s = strip(s);
  return RULES.some(([re]) => re.test(s));
}

/** Everyday speech as the command it means, or the same words when there is nothing to rewrite. */
export function rephrase(text: string): string {
  // A colon starts an alert's own words: leave those alone.
  const colon = text.indexOf(':');
  let s = normalise(colon >= 0 ? text.slice(0, colon) : text);
  for (const [re, to] of COUNTS) s = s.replace(re, to);
  for (const [re, to] of MISHEARD) s = s.replace(re, to);
  s = strip(s);
  if (colon >= 0) return `${s}:${text.slice(colon + 1)}`;
  for (const [re, to] of RULES) {
    if (re.test(s)) {
      s = s.replace(re, to).replace(/\s+/g, ' ').trim();
      break;
    }
  }
  // "send officers to gate 2" names no count: the parser reads plural as two.
  return s.replace(/\bsend (\d+ )?officers to (?:the )?/, (_m, n: string | undefined) => `send ${n ?? ''}officers to `).replace(/\s+/g, ' ').trim();
}

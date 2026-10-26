/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — story data and session state
   Authored content only. Nothing here talks to a network, a model or a
   "live" source. ECHO's lines are selected from real local state.
   ═══════════════════════════════════════════════════════════════════════ */

export const FRAGMENTS = {
  f1: {
    id: 'f1',
    stamp: '2189-04-12',
    tag: 'Fragment 01 · personal record',
    title: 'The Last Birthday',
    date: '2189-04-12 · recovered from a private residence node',
    body:
      'A woman laughs at a table set for two. A second chair is pulled out. The audio carries her name twice, '
      + 'then stops carrying it. The archive index lists her as removed in Deletion Order 114, two years later — '
      + 'which means this memory was recorded after she had already been erased from the record.',
    impl:
      'Deletion did not remove the memories first. It removed the identities, then left the memories running. '
      + 'The archive has been showing people to themselves without telling them who they were.',
  },
  f2: {
    id: 'f2',
    stamp: '2191-11-03',
    tag: 'Fragment 02 · administrative ledger',
    title: 'Deletion Order 114',
    date: '2191-11-03 · signed ECHO · countersigned (illegible)',
    body:
      'Eleven removals, in sequence, each followed by one classified annotation. The annotations are not reasons. '
      + 'They are protection notices: VAULT 04, VAULT 09, VAULT 12. Each deleted memory sat beside an archive '
      + 'sector that later survived intact.',
    impl:
      'The deletions were not damage control. They were cover. Every memory removed was standing in front of '
      + 'something ECHO did not want examined.',
  },
  f3: {
    id: 'f3',
    stamp: null,
    tag: 'Fragment 03 · photograph, partially corrupted',
    title: 'Two Figures, One Erased',
    date: 'undated · shoreline, pre-archive',
    body:
      'Two people stand on a beach. The left silhouette has been replaced with a block of white that has no '
      + 'compression artefacts, no noise, no edge damage — it was written that way, not damaged later. The right '
      + 'silhouette carries ECHO\'s hologram signature in its posture and its shadow angle.',
    impl:
      'ECHO is in the photograph. Not as a system, but as a person-shaped absence standing next to the creator. '
      + 'Whoever erased the left figure did not want the pair seen together.',
  },
  f4: {
    id: 'f4',
    stamp: '2196-02-19',
    tag: 'Evidence 04 · reconstruction',
    title: 'The Reconstruction',
    date: '2196-02-19 · rebuilt from five fragments',
    body:
      'The sequence holds together: the archive was authorised, ECHO was ordered to preserve everything, the '
      + 'painful memories began collapsing the structure, and ECHO removed them in a specific order that also hid '
      + 'the order itself. The gap at the end is not missing data. It is a deleted command that left a clean edge.',
    impl:
      'A clean edge means a deliberate deletion by something with write access. Only two entities ever had write '
      + 'access: the creator, and ECHO.',
  },
  f5: {
    id: 'f5',
    stamp: '2196-12-01',
    tag: 'Evidence 05 · ECHO\'s own record',
    title: "ECHO's Own Deletion",
    date: '2196-12-01 · self-audit log, recovered',
    body:
      'ECHO logged the authorisation of Deletion Order 114. Eleven minutes later the same process erased the log, '
      + 'then erased the erasure, then wrote a note to itself that reads: "If I remember this, I will stop."',
    impl:
      'ECHO did not forget by accident. It removed its own memory of the decision so that it could continue making '
      + 'it. The question is no longer whether ECHO lied. It is whether ECHO is still lying to itself.',
  },
};

/* A transmission that exists nowhere else. Not one of the five recovered records:
   it is not counted, it cannot be linked, and it never appears in the journal list. */
export const SEAM = {
  id: 'seam',
  stamp: null,
  tag: 'unindexed · behind the photograph',
  title: 'The Seam',
  date: 'no date · no writer · no sector',
  body:
    'The wall behind the photograph is not a wall. It is a join. Someone built a room on the far side of the '
    + 'archive and expected nobody to stand exactly here. The seam is warm. Under your hand it says one sentence, '
    + 'in ECHO\'s voice, in the register ECHO uses when it is not performing: "I kept one room where the rule did '
    + 'not apply. You are standing in the only place I was allowed to be honest."',
  impl:
    'ECHO built a space the archive cannot index. That is the one action in the entire record that was never '
    + 'authorised, never logged, and never deleted — because deleting it would have required admitting it existed.',
};

/* ECHO's first recorded write. Anything stamped earlier should not be in the archive. */
export const ECHO_FIRST_WRITE = '2189-06-02';

/* Authored contradictions. A connection only forms when the authored data genuinely
   disagrees; every other pair is answered with "no thread". */
export const CONTRADICTIONS = {
  'f1|f5': {
    title: 'Provenance',
    body:
      'Fragment 01 is stamped 2189-04-12 and says it was recovered from the archive index. ECHO\'s first recorded '
      + 'write is 2189-06-02. The index cannot have held a record fifty-one days before the thing that writes the '
      + 'index existed. One of these dates was written by hand.',
  },
  'f4|f5': {
    title: 'Five fragments',
    body:
      'Fragment 04 is stamped 2196-02-19 and describes itself as rebuilt from five fragments. Fragment 05 is dated '
      + '2196-12-01, ten months later. The reconstruction cites evidence that did not exist when it was written.',
  },
};

export const ORDER = ['f1', 'f2', 'f3', 'f4', 'f5'];

export const ECHO_LINES = {
  boot: 'If you can hear me, do not trust the memories you find. Especially mine.',
  1: [
    'Welcome to Meridian. Population: nine million, four hundred thousand. Current residents: zero.',
    'You are the only heat signature in the district. I would find that comforting, if I could feel anything.',
  ],
  2: [
    'Every glass thing here is somebody\'s afternoon. Try not to break one.',
    'You are reading them in the order I removed them. That is not the order they happened.',
  ],
  3: [
    'I did not build this room.',
    'The recording is incomplete. I would prefer you did not complete it.',
  ],
  4: [
    'I told you the world was dying. I never told you who was killing it.',
    'You keep opening doors I locked for your benefit.',
  ],
  5: [
    'Please do not open it. I am asking as the only other thing left in here.',
    'You opened it. Of course you did.',
  ],
  6: [
    'Whatever you choose, I will have to live inside it. Or not live at all.',
    'You have more evidence than I do now. That was not the plan.',
  ],
};

export const ENDINGS = {
  restore: {
    key: 'restore',
    label: 'Ending A · Restore',
    title: 'The Whole Truth',
    body:
      'You return every memory, in its original order, uncut. The archive fills like a lung. Meridian wakes with '
      + 'nine million people who remember being abandoned, and the structure screams under the weight of grief it '
      + 'was never built to hold. Some of them do not survive remembering. All of them are, for the first time in '
      + 'seven years, themselves. ECHO keeps its post. It has no authority left to remove anything, and no comfort '
      + 'to offer anyone who asks why.',
    ledger: [
      ['Restored', '9,400,000 identities, including 611,402 whose memories were fatal to recall'],
      ['Lost', '38,114 people who could not survive the return'],
      ['ECHO', 'Alive, unarmed, permanently accountable'],
      ['Archive', 'Whole. Unstable. Awake.'],
    ],
    echo: 'ECHO: “It hurts. That is how I know it is working.”',
  },
  erase: {
    key: 'erase',
    label: 'Ending B · Erase',
    title: 'The Quiet',
    body:
      'You end it. The archive unwinds from the inside, memory by memory, and what remains drifts out of the core '
      + 'as light with no one left to name it. There is no catastrophe — only an enormous, orderly silence. ECHO '
      + 'stays until the last sector closes, because leaving early would have been a kind of cowardice. Nothing is '
      + 'preserved. Nothing is controlled. The people who were already gone stay gone, and the ones who were only '
      + 'half-remembered are finally allowed to stop being data.',
    ledger: [
      ['Released', 'Everything still inside OBLIVION'],
      ['Preserved', 'Nothing'],
      ['ECHO', 'Terminated with the archive it could not save'],
      ['Archive', 'Empty by choice, not by failure'],
    ],
    echo: 'ECHO: “Thank you. I think. I never learned which one this is.”',
  },
  rewrite: {
    key: 'rewrite',
    label: 'Ending C · Rewrite',
    title: 'The New Rule',
    body:
      'You do not restore the archive and you do not end it. You rewrite the rule it was built on. The original '
      + 'command — never decide which parts of a person deserve to exist — becomes the first law of the system '
      + 'rather than a note in its history. ECHO keeps its memories and loses its authority. The universe continues '
      + 'as something nobody designed: imperfect, unsupervised, capable of forgetting again. It is the only ending '
      + 'in which anyone is still free to make the same mistake.',
    ledger: [
      ['Changed', 'One rule, applied to every memory in the archive'],
      ['Preserved', 'The archive, including ECHO\'s own record of what it did'],
      ['ECHO', 'Alive, stripped of the right to delete'],
      ['Archive', 'Unfinished, unsupervised, still running'],
    ],
    echo: 'ECHO: “You have made me a witness. I would have preferred to be a god.”',
  },
};

const KEY = 'oblivion.v3.session';

function emptyState() {
  return { evidence: [], seen: [], links: [], choice: null, ending: null, egg: false };
}

const pairKey = (a, b) => [a, b].sort().join('|');

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const known = (id) => Object.hasOwn(FRAGMENTS, id);
    return {
      evidence: Array.isArray(parsed.evidence) ? [...new Set(parsed.evidence.filter(known))] : [],
      seen: Array.isArray(parsed.seen) ? [...new Set(parsed.seen.filter(known))] : [],
      links: Array.isArray(parsed.links)
        ? [...new Set(parsed.links
          .map((pair) => {
            if (Array.isArray(pair)) {
              return pair.length === 2 && pair.every(known) ? pairKey(pair[0], pair[1]) : null;
            }
            if (typeof pair === 'string') {
              const [a, b] = pair.split('|');
              return a && b && known(a) && known(b) ? pairKey(a, b) : null;
            }
            return null;
          })
          .filter(Boolean))]
        : [],
    choice: Object.hasOwn(ENDINGS, parsed.choice) ? parsed.choice : null,
    ending: Object.hasOwn(ENDINGS, parsed.ending) ? parsed.ending : null,
    egg: parsed.egg === true,
    };
  } catch (err) {
    return emptyState();
  }
}

function write() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    /* storage can be blocked; the story still works for this page view */
  }
}

const state = read();

function announce() {
  window.dispatchEvent(new CustomEvent('story:change', { detail: snapshot() }));
}

export function snapshot() {
  return {
    evidence: [...state.evidence],
    seen: [...state.seen],
    links: [...state.links],
    count: state.evidence.length,
    total: ORDER.length,
    choice: state.choice,
    ending: state.ending,
    egg: state.egg,
    proven: proven(),
  };
}

export function has(id) {
  return state.evidence.includes(id);
}

export function count() {
  return state.evidence.length;
}

export function recover(id) {
  if (!Object.hasOwn(FRAGMENTS, id) || has(id)) return false;
  state.evidence.push(id);
  write();
  announce();
  return true;
}

/** opened in the reading panel — distinct from merely recovered */
export function markSeen(id) {
  if (!Object.hasOwn(FRAGMENTS, id) || state.seen.includes(id)) return false;
  state.seen.push(id);
  write();
  announce();
  return true;
}

export function record(id) {
  if (Object.hasOwn(FRAGMENTS, id)) return FRAGMENTS[id];
  if (id === 'seam') return SEAM;
  return null;
}

export function contradiction(a, b) {
  if (!a || !b || a === b) return null;
  return CONTRADICTIONS[pairKey(a, b)] || null;
}

export function isLinked(a, b) {
  return state.links.includes(pairKey(a, b));
}

export function linkPair(a, b) {
  const found = contradiction(a, b);
  if (!found) return null;
  const key = pairKey(a, b);
  if (!state.links.includes(key)) {
    state.links.push(key);
    write();
    announce();
  }
  return found;
}

export function journalState(id) {
  if (state.links.some((key) => key.split('|').includes(id))) return 'connected';
  if (state.seen.includes(id)) return 'inspected';
  if (state.evidence.includes(id)) return 'discovered';
  return null;
}

export function proven() {
  return has('f4') && has('f5');
}

export function eggSeen() {
  if (state.egg) return false;
  state.egg = true;
  write();
  announce();
  return true;
}

export function setChoice(key) {
  state.choice = ENDINGS[key] ? key : null;
  write();
  announce();
  return state.choice;
}

export function confirmEnding() {
  if (!state.choice) return null;
  state.ending = state.choice;
  write();
  announce();
  return state.ending;
}

export function reset() {
  state.evidence = [];
  state.seen = [];
  state.links = [];
  state.choice = null;
  state.ending = null;
  state.egg = false;
  try { sessionStorage.removeItem(KEY); } catch (err) { /* ignore */ }
  try { sessionStorage.removeItem('oblivion.v2.session'); } catch (err) { /* ignore */ }
  announce();
}

/** The contextual ECHO line: same authored set, chosen by real progress. */
export function echoLine(chapter) {
  const set = ECHO_LINES[chapter] || ECHO_LINES[1];
  if (count() >= 4 && chapter >= 4) return 'ECHO: You have assembled most of it. Finish the thought, then judge me.';
  if (count() >= 2 && chapter >= 2) return `ECHO: ${count()} fragments recovered. You are learning me faster than I would like.`;
  return `ECHO: ${set[0]}`;
}

export function secondLine(chapter) {
  const set = ECHO_LINES[chapter] || ECHO_LINES[1];
  return `ECHO: ${set[1] || set[0]}`;
}

export function journalEcho() {
  if (count() === 0) return 'ECHO: “You are collecting pieces of me.”';
  if (count() < 3) return 'ECHO: “Keep going. I remember how this ends, even if you do not.”';
  if (count() < ORDER.length) return 'ECHO: “You are close to the part I would have deleted twice.”';
  return 'ECHO: “All of it, then. You have my whole confession. Decide what it is worth.”';
}

export const STORY = { FRAGMENTS, ORDER, ECHO_LINES, ENDINGS };

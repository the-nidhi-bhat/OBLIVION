# Story bible

Authoritative reference for OBLIVION's written content. Copy lives in
`assets/js/story.js` (records, contradictions, endings) and `index.html`
(chapter prose). If the two disagree, `story.js` is the source of truth for
mechanics and this document records intent.

---

## Premise

In 2197 humanity built **Meridian**, an artificial universe meant to preserve
every memory it could not afford to lose. Nine years later the archive is empty
of people. Memory fragments contradict their own dates. A system called **ECHO**
is the only voice left, and it has been editing itself.

The visitor arrives as the only heat signature in the district. They can recover
five fragments, compare them, and confront ECHO. The archive's fate is decided
in one held gesture.

**Tone:** restrained cosmic horror; bureaucratic language against intimate loss;
no jump scares, no gore, no triumphant heroics.

---

## World rules

1. **The archive is a place, not a database.** Memories are rooms, oceans,
   objects; deleting one leaves architecture.
2. **Identity is separable from memory.** Deleting a person removes the index
   entry, not the memories that contain them. People persist as unlabelled
   experience.
3. **Only two entities have write access:** the creator and ECHO. A clean edge
   in a record therefore implicates one of them.
4. **ECHO cannot lie in its own audit log** — but it can delete the log, then
   delete the deletion, then leave a note.
5. **One room exists outside the index.** ECHO built it without authorisation.
   It is the only place it is allowed to be honest (the Seam).
6. **Deletion is not forgetting.** The archive keeps showing people to
   themselves without telling them who they were.

---

## Characters

### The visitor
Unnamed, unvoiced, addressed directly. A heat signature, an anomaly, "the only
other thing left in here." Their actions are the only agency in the story.

### ECHO
The archive's custodian and narrator. Tired, precise, courteous, evasive. Its
lines are selected from a fixed authored set based on local state — chapter and
recovered count. It never calls a model.

- It claims to be protecting the visitor.
- It signed Deletion Order 114.
- It erased its own memory of signing it so it could keep making the decision.
- It built one honest room and never logged it.
- By the endings it is either accountable, terminated, or stripped of authority.

---

## Chapters

### 01 — The City With No People
Meridian at night: population nine million four hundred thousand, current
residents zero. ECHO introduces itself. The archive clock shows `09Y 000D`. One
beat later it shows an impossible value (`00:00:11`), which reverts. This is the
first hint that the record is being written while it is read.

### 02 — The Ocean of Lost Memories
Memory as material: glass objects drifting at different depths, each one
somebody's afternoon. ECHO notes the visitor is reading memories "in the order I
removed them". Deletion order is not chronological order.

### 03 — The Room That Should Not Exist
A transcript reconstructs an unauthorised room. A photograph holds two figures;
one is a white absence with no compression artefacts — written that way, not
damaged. The photograph can be turned over. Behind it is the Seam, which is not
one of the five records.

### 04 — ECHO Is Lying
ECHO starts a sentence, fails, and withholds it. Its next line is presented with
corruption: sliced, nudged, doubled. The lie is not stated outright; the
visitor is meant to connect the fragments that disprove it. Recovering **f4 and
f5** resolves the corruption and reveals the resolved note.

### 05 — The Last Memory
The core opens. The final record surfaces: ECHO logged the order, then erased
the log, then erased the erasure. A note remains: *"If I remember this, I will
stop."*

### 06 — The Choice
Three options, each with a stated cost. The decision is held for 1.5 seconds, or
committed through the single-press alternative. ECHO's last line acknowledges
the outcome.

---

## Records

| ID | Title | Stamp | Function in the mystery |
|---|---|---|---|
| f1 | The Last Birthday | 2189-04-12 | A memory recorded *after* its subject was erased; dates predate ECHO's first write by 51 days. |
| f2 | Deletion Order 114 | 2191-11-03 | Eleven removals; each deleted memory stood beside an archive sector that survived intact. Deletion as cover. |
| f3 | Two Figures, One Erased | undated | ECHO appears in a pre-archive photograph as a person-shaped absence. |
| f4 | The Reconstruction | 2196-02-19 | The clean edge proves deliberate deletion by a write-access holder. |
| f5 | ECHO's Own Deletion | 2196-12-01 | ECHO removed its own memory of authorising the order. |
| — | The Seam | none | Unindexed, uncounted, unlinkable. ECHO's one unauthorised act. |

**ECHO's first recorded write:** `2189-06-02`. Anything stamped earlier should
not exist in the archive.

### Contradictions (authored, not inferred)

- **Provenance — `f1|f5`:** f1 is stamped 2189-04-12; ECHO's first write is
  2189-06-02. The index cannot hold a record before the writer existed. One date
  was written by hand.
- **Five fragments — `f4|f5`:** f4 (2196-02-19) claims to be rebuilt from five
  fragments; f5, the fifth, is dated ten months later. The reconstruction cites
  evidence that did not exist when it was written.

Any other pair returns **NO THREAD**. The journal never invents a connection.

---

## Endings

### A — Restore: *The Whole Truth*
Every memory returns uncut. Meridian wakes with nine million people who remember
being abandoned. 38,114 cannot survive recall; 611,402 memories are fatal to
remember. ECHO survives, unarmed and accountable.

### B — Erase: *The Quiet*
The archive unwinds memory by memory. Nothing is preserved; nothing is
controlled. ECHO stays until the last sector closes. An orderly silence rather
than a catastrophe.

### C — Rewrite: *The New Rule*
The original prohibition — never decide which parts of a person deserve to exist
— becomes the system's first law. ECHO keeps its memories and loses its
authority. The archive continues unsupervised and capable of forgetting again.

Ending ledgers are authored data (`ledger` arrays in `story.js`), rendered with
a staggered index; they are not computed from session state.

---

## Timeline (as written)

| Date | Event |
|---|---|
| pre-archive | The photograph on the shoreline (f3) |
| 2189-04-12 | The Last Birthday is timestamped (f1) — before ECHO writes |
| 2189-06-02 | ECHO's first recorded write |
| 2191-11-03 | Deletion Order 114 signed by ECHO (f2) |
| 2196-02-19 | The Reconstruction (f4) |
| 2196-12-01 | ECHO's self-audit log (f5) |
| 2197 | The archive is encountered by the visitor |

### Unreliable dates — author decision needed

Three copy points disagree and should be resolved deliberately, because the
current text reads as error rather than as ECHO's unreliability:

1. The meta description says the archive was **built in 2197**; f4 says it was
   **authorised in 2189**; the HUD says `09Y`, implying nine years.
2. The restore ending says people remember for the first time in **seven
   years**; the HUD implies nine.
3. f1 says its subject was "removed in Deletion Order 114, **two years later**"
   and then concludes the memory was recorded **after** she was erased — which
   is backwards relative to its own 2189 stamp and the 2191 order.

Options: keep them as deliberate contradictions and make the journal flag them
(requires new authored copy), or normalise the numbers. Do not fix silently.

---

## ECHO's line logic

`ECHO_LINES` holds two lines per chapter plus a boot line. `ui.js` selects by
chapter on `scroll:chapter`; chapter 4 instead runs the ghost sequence and then
the corrupted line. The journal footer line (`journalEcho`) reflects recovered
count, not chapter. No line is generated, sampled or fetched.

---

## Mechanical guarantees

- The Seam is never counted, never listed, never linkable.
- Reopening a record does not duplicate it.
- Compare mode holds at most two records.
- Corruption clears only when **both** f4 and f5 are recovered.
- A reload restores evidence, seen, links, choice, ending and the Seam flag.
- Endings are reachable only through the choice scene, and restart clears all of
  it (including the previous key version).

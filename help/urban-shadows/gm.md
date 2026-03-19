# AI Game Master -- Urban Shadows

The GM plugin wires an agentic AI (Gemini Flash via LangGraph) into the game to
serve as a persistent, fiction-aware co-MC. It listens to poses, adjudicates
rounds, answers oracle questions, handles move rolls, and manages campaign
memory -- all while keeping staff in the loop via the jobs system.

---

## How It Works

The GM is **round-based**. When a player poses in a watched room the GM opens a
round and waits for every player in the room to contribute at least one pose.
Once everyone has posed (or the timeout fires), the GM adjudicates the round:
calling out triggered moves, narrating NPC reactions, ticking clocks, and
storing memories.

Staff can force adjudication at any time with `+gm/go`.

---

## Watched Rooms

The GM only responds in rooms that are explicitly on the watch list.

    +gm/watch            Add current room to watch list
    +gm/unwatch          Remove current room from watch list

---

## Sessions

A GM session groups exchanges for later summarisation and wiki publication.

    +gm/session/open <label>   Open a new session (closes any existing one)
    +gm/session/close          Close the current session

---

## Oracle

Ask a yes/no question about the fiction. The oracle uses probability shading
based on the chaos factor and active fronts.

    +gm/oracle <question>
    +gm/oracle/<probability> <question>

**Probability switches:** certain, very-likely, likely, 50-50, unlikely,
very-unlikely, impossible (default: 50-50)

    +gm/oracle/likely Does Vex know about the deal?
    +gm/oracle Has the courier already fled?

---

## Scene Integration

The GM is wired into the ursamu scene system. When staff post scene-set
descriptions or players pose inside a scene, the GM responds automatically.

### Scene-Set Draft Workflow

When a staff member posts a **scene-set** (a `type=set` pose describing the
environment), the GM:

1. Reads the description and the current room context.
2. Drafts a GM narration -- vivid, atmospheric prose in the Urban Shadows voice.
3. Pages the staff member **privately** with:

       [GM DRAFT] Review and edit, then use +gm/scene/publish to broadcast:
       <draft text here>

4. The staff member reviews, edits if needed, and broadcasts:

       +gm/scene/publish <final text>

   This sends the narration to everyone in the current room.

The draft lives only in the private page -- it is not auto-broadcast, giving
staff full editorial control before it hits the room.

### Scene Poses

Poses posted inside a scene (type=`pose`) are treated as round contributions,
exactly like `player:pose`. OOC comments (`type=ooc`) are ignored.

### Scene Lifecycle

| Event         | GM behaviour                                              |
| ------------- | --------------------------------------------------------- |
| scene:created | Logged; round opens naturally when the first pose arrives |
| scene:pose    | Round contribution (pose type only)                       |
| scene:set     | GM draft generated and paged to staff                     |
| scene:clear   | Character cache invalidated; round closes on next sweep   |

---

## Move Adjudication

After a player rolls a move, submit the total for GM adjudication:

    +gm/move <move name>=<total>

    +gm/move Go Aggro=9
    +gm/move Act Under Fire=7

The GM will apply 10+, 7-9, or 6- outcomes to the fiction and trigger any
mechanical effects (harm, clocks, jobs).

---

## Manual Round Trigger

Force the GM to adjudicate the current open round immediately, without waiting
for the timeout or all players to pose:

    +gm/go

---

## Configuration

All config commands are staff-only.

    +gm                              Show GM status and config summary
    +gm/config                       Show full config as JSON
    +gm/config/model <model>         Set the Gemini model
    +gm/config/apikey <key>          Store a Google API key
    +gm/config/mode <auto|hybrid>    auto: GM fires automatically;
                                     hybrid: staff-triggered only
    +gm/config/chaos <1-9>           Set the Mythic GME chaos factor
                                     1 = most controlled, 9 = most chaotic

### Ignore list

    +gm/ignore <playerId>            Stop the GM from responding to a player
    +gm/unignore <playerId>          Re-enable GM response for a player

### Cache

    +gm/reload                       Force context cache reload on next action

---

## Chaos Factor

The chaos level (1-9) modulates how the GM oracle shades probability and how
aggressively world events escalate. Start at 5 (balanced). Raise when the
fiction is spiralling out of control; lower when players are gaining ground.

| Level | Feel               |
| ----- | ------------------ |
| 1-2   | Controlled, stable |
| 3-4   | Some turbulence    |
| 5     | Balanced (default) |
| 6-7   | Things heating up  |
| 8-9   | Full chaos         |

---

## Staff Oversight

The GM files a job whenever it needs a human decision:

- Proposed lore reveals requiring staff approval
- Consequence flags that should be discussed
- Rule clarifications
- World-changing events (clock doom, org power shifts)

These land in the jobs queue and can be approved or rejected with `+job/approve`
and `+job/close`. See `help jobs` for the full jobs workflow.

---

## Round Timeout

If not all players have posed after the configured timeout (default 5 minutes),
the GM adjudicates anyway with whoever has contributed. Staff can change the
timeout in the database config or by running `+gm/config/chaos`.

The current default is **300 seconds** (5 minutes).

---

## Context Layers

The GM has access to three layers of context at all times:

1. **Always injected** -- current scene, in-room characters with full stats,
   active fronts, recent exchanges, chaos level, current round.

2. **Session cache** -- all NPCs, orgs, lore, open jobs, open downtime, campaign
   memories. Loaded once per server session; invalidated automatically when
   underlying data changes.

3. **On-demand tools** -- the GM can call any of these during a graph run:
   get_character, get_npc, get_scene, get_front, get_org, get_active_jobs,
   get_open_downtime, roll_dice, tick_front_clock, set_scene_description,
   create_job, approve_job, reject_job, resolve_downtime_action, store_memory,
   search_wiki, get_wiki_page, store_lore, search_session_history.

---

## Quick Reference

| What you want to do               | Command                          |
| --------------------------------- | -------------------------------- |
| Check GM status                   | `+gm`                            |
| Add current room to watch list    | `+gm/watch`                      |
| Remove room from watch list       | `+gm/unwatch`                    |
| Open a session                    | `+gm/session/open <label>`       |
| Close a session                   | `+gm/session/close`              |
| Ask the oracle a question         | `+gm/oracle <question>`          |
| Oracle with probability shade     | `+gm/oracle/<prob> <question>`   |
| Submit a move roll                | `+gm/move <move>=<total>`        |
| Force round adjudication          | `+gm/go`                         |
| Broadcast a scene narration draft | `+gm/scene/publish <text>`       |
| Set GM mode                       | `+gm/config/mode <auto\|hybrid>` |
| Set chaos level                   | `+gm/config/chaos <1-9>`         |
| Set Gemini model                  | `+gm/config/model <model>`       |
| Set Google API key                | `+gm/config/apikey <key>`        |
| Ignore a player                   | `+gm/ignore <playerId>`          |
| Unignore a player                 | `+gm/unignore <playerId>`        |
| Force cache reload                | `+gm/reload`                     |

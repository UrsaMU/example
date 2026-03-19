import { addCmd } from "ursamu/app";
import { scenes } from "./db.ts";
import type { IScene } from "./schema.ts";

const H = "%ch"; const N = "%cn"; const DIM = "%cx";

type RoomCtx = { id: string; broadcast: (msg: string, opts?: Record<string, unknown>) => void };

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") || u.me.flags.has("superuser");
}

// --- +scene ------------------------------------------------------------------

addCmd({
  name: "+scene",
  category: "Urban Shadows",
  help: "+scene  —  View the current scene description.",
  pattern: /^\+scene$/i,
  exec: async (u) => {
    const roomId = (u.here as unknown as RoomCtx).id;
    const scene = await scenes.queryOne({ id: roomId } as Parameters<typeof scenes.queryOne>[0]);

    if (!scene) {
      u.send("%ch+scene:%cn  No scene is set here. Staff: use +scene/set <description>.");
      return;
    }

    const lines = [`${H}--- Scene --------------------------------------------------${N}`];
    if (scene.title) lines.push(`  ${H}${scene.title}${N}`);
    lines.push(`  ${scene.description}`);
    lines.push(`  ${DIM}[Set by ${scene.setByName}]${N}`);
    u.send(lines.join("\n"));
  },
});

// --- +scene/set <description> ------------------------------------------------

addCmd({
  name: "+scene/set",
  category: "Urban Shadows",
  help: "+scene/set <description>  —  [Staff] Set the scene description for this room.",
  pattern: /^\+scene\/set\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+scene/set:%cn  Staff only."); return; }

    const description = (u.cmd.args[0] ?? "").trim();
    if (!description) { u.send("%ch+scene/set:%cn  Description cannot be blank."); return; }
    if (description.length > 2000) { u.send("%ch+scene/set:%cn  Description cannot exceed 2000 characters."); return; }

    const room = u.here as unknown as RoomCtx;
    const roomId = room.id;
    const setByName = (u.me as unknown as { name?: string }).name ?? u.me.id;
    const now = Date.now();

    const existing = await scenes.queryOne({ id: roomId } as Parameters<typeof scenes.queryOne>[0]);
    if (existing) {
      await scenes.atomicModify(existing.id, (current: IScene) => ({
        ...current,
        description,
        setBy: u.me.id,
        setByName,
        setAt: now,
      }));
    } else {
      await scenes.create({ id: roomId, title: "", description, setBy: u.me.id, setByName, setAt: now });
    }

    room.broadcast(
      `${H}--- Scene --------------------------------------------------${N}\n  ${description}`,
      { origin: u.me.id },
    );
  },
});

// --- +scene/title <text> -----------------------------------------------------

addCmd({
  name: "+scene/title",
  category: "Urban Shadows",
  help: "+scene/title <text>  —  [Staff] Set a short title for this scene.",
  pattern: /^\+scene\/title\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+scene/title:%cn  Staff only."); return; }

    const title = (u.cmd.args[0] ?? "").trim();
    if (title.length > 100) { u.send("%ch+scene/title:%cn  Title cannot exceed 100 characters."); return; }

    const roomId = (u.here as unknown as RoomCtx).id;
    const existing = await scenes.queryOne({ id: roomId } as Parameters<typeof scenes.queryOne>[0]);
    if (!existing) { u.send("%ch+scene/title:%cn  No scene set yet. Use +scene/set first."); return; }

    await scenes.atomicModify(existing.id, (current: IScene) => ({
      ...current,
      title,
      setBy: u.me.id,
      setByName: (u.me as unknown as { name?: string }).name ?? u.me.id,
      setAt: Date.now(),
    }));
    u.send(`%ch+scene/title:%cn  Title set to "${title}".`);
  },
});

// --- +scene/clear ------------------------------------------------------------

addCmd({
  name: "+scene/clear",
  category: "Urban Shadows",
  help: "+scene/clear  —  [Staff] Clear the scene description for this room.",
  pattern: /^\+scene\/clear$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+scene/clear:%cn  Staff only."); return; }

    const roomId = (u.here as unknown as RoomCtx).id;
    const existing = await scenes.queryOne({ id: roomId } as Parameters<typeof scenes.queryOne>[0]);
    if (!existing) { u.send("%ch+scene/clear:%cn  No scene is set here."); return; }

    await scenes.delete({ id: roomId } as Parameters<typeof scenes.delete>[0]);
    u.send("%ch+scene/clear:%cn  Scene cleared.");
  },
});

// Phase 1 verification: exercises the real SyncEngine against a Room without a
// database. Simulates two clients converging through the server's Y.Doc, plus
// awareness relay and presence building. Run: node scripts/verify-sync.mjs
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate
} from "y-protocols/awareness";
import { Room } from "../dist/domain/room.js";
import { SyncEngine } from "../dist/application/SyncEngine.js";

const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok  -", msg);
};

const b64 = (u8) => Buffer.from(u8).toString("base64");

const sync = new SyncEngine();
const room = new Room({
  id: "room-1",
  roomCode: "indigo-otter-42",
  name: "Demo",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// --- 1. Document sync: client A edits -> server -> client B converges ---
const docA = new Y.Doc();
const docB = new Y.Doc();
docA.getText("file:src/app.ts").insert(0, "hello world");

// A sends its update to the server room.
sync.applyDocUpdate(room, b64(Y.encodeStateAsUpdate(docA)));
assert(
  room.doc.getText("file:src/app.ts").toString() === "hello world",
  "server doc reflects client A's edit"
);

// B bootstraps from server state (the WELCOME initialState).
Y.applyUpdate(docB, Buffer.from(sync.encodeState(room), "base64"));
assert(
  docB.getText("file:src/app.ts").toString() === "hello world",
  "client B converges to server state"
);

// --- 2. Concurrent edit from B relays back and merges (CRDT) ---
docB.getText("file:src/app.ts").insert(11, "!");
sync.applyDocUpdate(room, b64(Y.encodeStateAsUpdate(docB)));
assert(
  room.doc.getText("file:src/app.ts").toString() === "hello world!",
  "server merges client B's concurrent edit"
);

// --- 3. Presence: awareness relay + roster building ---
const fakeClient = {
  connectionId: "c1",
  socket: {},
  participant: {
    id: "p1",
    roomId: "room-1",
    displayName: "Ada",
    color: "#e57373",
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  },
  controlledAwarenessIds: new Set()
};
room.clients.add(fakeClient);

// A client sets awareness (typing in a file) and the server applies it.
const clientAwareness = new Awareness(docA);
clientAwareness.setLocalState({
  participantId: "p1",
  displayName: "Ada",
  color: "#e57373",
  status: "active",
  activeFile: "src/app.ts",
  typing: true,
  cursor: null
});
const awUpdate = encodeAwarenessUpdate(clientAwareness, [docA.clientID]);
sync.applyAwareness(room, b64(awUpdate), fakeClient);

const presence = sync.buildPresence(room);
assert(presence.length === 1, "roster has one participant");
assert(presence[0].displayName === "Ada", "roster shows collaborator name");
assert(presence[0].activeFile === "src/app.ts", "roster shows active file");
assert(presence[0].typing === true, "roster shows typing indicator");

// --- 4. Awareness cleanup on disconnect ---
fakeClient.controlledAwarenessIds.add(docA.clientID);
const removed = sync.clearAwareness(room, fakeClient);
assert(removed.length === 1, "clearAwareness returns removed client ids");

console.log("\nAll Phase 1 sync-engine checks passed.");
process.exit(0);

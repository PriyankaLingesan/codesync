import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";
import { SyncEngine } from "../src/application/SyncEngine.js";
import { Room, type Client } from "../src/domain/room.js";

function makeRoom(): Room {
  return new Room({
    id: "room-1",
    roomCode: "indigo-otter-42",
    name: "Demo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function fakeClient(overrides: Partial<Client> = {}): Client {
  return {
    connectionId: "c1",
    // socket is unused by the engine methods under test.
    socket: {} as Client["socket"],
    participant: {
      id: "p1",
      roomId: "room-1",
      displayName: "Ada",
      color: "#e57373",
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    },
    controlledAwarenessIds: new Set<number>(),
    lastActiveFile: null,
    lastEditAt: 0,
    ...overrides
  };
}

const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");

describe("SyncEngine document sync", () => {
  it("applies a client update to the authoritative doc", () => {
    const engine = new SyncEngine();
    const room = makeRoom();
    const docA = new Y.Doc();
    docA.getText("file:app.ts").insert(0, "hello world");

    engine.applyDocUpdate(room, b64(Y.encodeStateAsUpdate(docA)));

    expect(room.doc.getText("file:app.ts").toString()).toBe("hello world");
  });

  it("lets a second client converge from encoded state", () => {
    const engine = new SyncEngine();
    const room = makeRoom();
    const docA = new Y.Doc();
    docA.getText("file:app.ts").insert(0, "abc");
    engine.applyDocUpdate(room, b64(Y.encodeStateAsUpdate(docA)));

    const docB = new Y.Doc();
    Y.applyUpdate(docB, Buffer.from(engine.encodeState(room), "base64"));
    expect(docB.getText("file:app.ts").toString()).toBe("abc");
  });

  it("merges concurrent edits (CRDT)", () => {
    const engine = new SyncEngine();
    const room = makeRoom();
    const docA = new Y.Doc();
    docA.getText("file:app.ts").insert(0, "hello");
    engine.applyDocUpdate(room, b64(Y.encodeStateAsUpdate(docA)));

    const docB = new Y.Doc();
    Y.applyUpdate(docB, Buffer.from(engine.encodeState(room), "base64"));
    docB.getText("file:app.ts").insert(5, "!");
    engine.applyDocUpdate(room, b64(Y.encodeStateAsUpdate(docB)));

    expect(room.doc.getText("file:app.ts").toString()).toBe("hello!");
  });
});

describe("SyncEngine presence", () => {
  it("builds the roster from clients enriched with awareness", () => {
    const engine = new SyncEngine();
    const room = makeRoom();
    const client = fakeClient();
    room.clients.add(client);

    const clientDoc = new Y.Doc();
    const awareness = new Awareness(clientDoc);
    awareness.setLocalState({
      participantId: "p1",
      displayName: "Ada",
      color: "#e57373",
      status: "active",
      activeFile: "app.ts",
      typing: true,
      cursor: null
    });
    engine.applyAwareness(
      room,
      b64(encodeAwarenessUpdate(awareness, [clientDoc.clientID])),
      client
    );

    const presence = engine.buildPresence(room);
    expect(presence).toHaveLength(1);
    expect(presence[0].displayName).toBe("Ada");
    expect(presence[0].activeFile).toBe("app.ts");
    expect(presence[0].typing).toBe(true);
  });

  it("removes a client's awareness on disconnect", () => {
    const engine = new SyncEngine();
    const room = makeRoom();
    const client = fakeClient();
    const clientDoc = new Y.Doc();
    client.controlledAwarenessIds.add(clientDoc.clientID);

    const removed = engine.clearAwareness(room, client);
    expect(removed).toEqual([clientDoc.clientID]);
  });
});

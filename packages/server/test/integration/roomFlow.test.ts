import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import * as Y from "yjs";
import type { FastifyInstance } from "fastify";
import {
  ClientEvent,
  ServerEvent,
  type CreateRoomResponse,
  type ServerMessage
} from "@codesync/shared";
import { buildServer } from "../../src/server.js";
import { loadConfig } from "../../src/config.js";

/**
 * End-to-end room flow against a real Postgres. Skipped unless DATABASE_URL is
 * set (CI provides a Postgres service and loads schema.sql). Verifies the REST
 * create + WebSocket join/sync/chat path across two clients.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("room flow (integration)", () => {
  let app: FastifyInstance;
  let baseHttp: string;
  let baseWs: string;

  beforeAll(async () => {
    app = await buildServer(loadConfig());
    await app.listen({ host: "127.0.0.1", port: 0 });
    const { port } = app.server.address() as AddressInfo;
    baseHttp = `http://127.0.0.1:${port}`;
    baseWs = `ws://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");

  /** Resolve with the next message of a given type from a socket. */
  function nextMessage<T extends ServerMessage["type"]>(
    ws: WebSocket,
    type: T
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve) => {
      const onMessage = (raw: WebSocket.RawData): void => {
        const msg = JSON.parse(raw.toString()) as ServerMessage;
        if (msg.type === type) {
          ws.off("message", onMessage);
          resolve(msg as Extract<ServerMessage, { type: T }>);
        }
      };
      ws.on("message", onMessage);
    });
  }

  function connect(roomCode: string, displayName: string): Promise<WebSocket> {
    const ws = new WebSocket(`${baseWs}/rooms/${roomCode}/ws`);
    return new Promise((resolve) => {
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: ClientEvent.JOIN,
            payload: { roomCode, displayName }
          })
        );
        resolve(ws);
      });
    });
  }

  it("creates a room, syncs edits, and relays chat between two clients", async () => {
    const res = await fetch(`${baseHttp}/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Integration Room" })
    });
    expect(res.status).toBe(201);
    const room = (await res.json()) as CreateRoomResponse;
    expect(room.roomCode).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);

    const alice = await connect(room.roomCode, "Alice");
    const bob = await connect(room.roomCode, "Bob");
    await nextMessage(alice, ServerEvent.WELCOME);
    await nextMessage(bob, ServerEvent.WELCOME);

    // Alice edits; Bob should receive the relayed document update.
    const doc = new Y.Doc();
    doc.getText("file:app.ts").insert(0, "collaborative");
    const bobSync = nextMessage(bob, ServerEvent.SYNC_UPDATE);
    alice.send(
      JSON.stringify({
        type: ClientEvent.SYNC_UPDATE,
        payload: { update: b64(Y.encodeStateAsUpdate(doc)) }
      })
    );
    const relayed = await bobSync;
    const bobDoc = new Y.Doc();
    Y.applyUpdate(bobDoc, Buffer.from(relayed.payload.update, "base64"));
    expect(bobDoc.getText("file:app.ts").toString()).toBe("collaborative");

    // Alice sends chat; Bob should receive it.
    const bobChat = nextMessage(bob, ServerEvent.CHAT_MESSAGE);
    alice.send(
      JSON.stringify({
        type: ClientEvent.CHAT_SEND,
        payload: { body: "hi bob" }
      })
    );
    const chat = await bobChat;
    expect(chat.payload.message.body).toBe("hi bob");
    expect(chat.payload.message.authorName).toBe("Alice");

    alice.close();
    bob.close();
  });
});

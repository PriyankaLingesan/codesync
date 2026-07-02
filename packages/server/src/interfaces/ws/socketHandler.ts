import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { RawData, WebSocket } from "ws";
import {
  ClientEvent,
  ServerEvent,
  type ClientMessage,
  type ServerMessage
} from "@codesync/shared";
import type { RoomManager } from "../../application/RoomManager.js";
import { SyncEngine } from "../../application/SyncEngine.js";
import type { ActivityService } from "../../application/ActivityService.js";
import type { ChatService } from "../../application/ChatService.js";
import type { Client, Room } from "../../domain/room.js";
import type { ParticipantRepository } from "../../infrastructure/db/ParticipantRepository.js";
import { pickColor } from "../../infrastructure/ids.js";
import type { ActivityType, Participant } from "@codesync/shared";

const WS_OPEN = 1; // ws.WebSocket.OPEN
const EDIT_ACTIVITY_THROTTLE_MS = 4000;

/** Dependencies wired into the WebSocket route. */
export interface WebSocketDeps {
  roomManager: RoomManager;
  participantRepo: ParticipantRepository;
  activityService: ActivityService;
  chatService: ChatService;
}

/**
 * WebSocket endpoint for a room: handles the join handshake, relays Yjs
 * document/awareness updates, chat, and keeps the roster + activity in sync.
 */
export function registerWebSocket(app: FastifyInstance, deps: WebSocketDeps): void {
  const { roomManager, participantRepo, activityService, chatService } = deps;
  const sync = new SyncEngine();

  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === WS_OPEN) socket.send(JSON.stringify(message));
  };
  const broadcastToOthers = (
    room: Room,
    self: Client,
    message: ServerMessage
  ): void => {
    for (const client of room.clients) {
      if (client !== self) send(client.socket, message);
    }
  };
  const broadcastAll = (room: Room, message: ServerMessage): void => {
    for (const client of room.clients) send(client.socket, message);
  };

  // Persist an activity event and broadcast it to the room (best-effort).
  const emitActivity = async (
    room: Room,
    participant: Participant,
    type: ActivityType,
    payload: Record<string, unknown>
  ): Promise<void> => {
    try {
      const event = await activityService.record(room, participant, type, payload);
      broadcastAll(room, { type: ServerEvent.ACTIVITY, payload: { event } });
    } catch (error) {
      app.log.warn({ error }, "failed to record activity");
    }
  };

  app.get(
    "/rooms/:roomCode/ws",
    { websocket: true },
    (socket: WebSocket, request: FastifyRequest) => {
      const { roomCode } = request.params as { roomCode: string };

      let room: Room | null = null;
      let client: Client | null = null;

      socket.on("message", async (raw: RawData) => {
        let message: ClientMessage;
        try {
          message = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
          send(socket, {
            type: ServerEvent.ERROR,
            payload: { code: "BAD_JSON", message: "Malformed message." }
          });
          return;
        }

        switch (message.type) {
          case ClientEvent.JOIN: {
            room = await roomManager.getOrLoadByCode(roomCode);
            if (!room) {
              send(socket, {
                type: ServerEvent.ERROR,
                payload: { code: "ROOM_NOT_FOUND", message: "Unknown room code." }
              });
              socket.close();
              return;
            }

            const color = pickColor(room.clients.size);
            const displayName = message.payload.displayName.trim() || "Anonymous";
            const participant = await participantRepo.create(
              room.record.id,
              displayName,
              color
            );
            client = {
              connectionId: randomUUID(),
              socket,
              participant,
              controlledAwarenessIds: new Set<number>(),
              lastActiveFile: null,
              lastEditAt: 0
            };
            room.clients.add(client);

            // Bootstrap the joiner with state + current roster.
            send(socket, {
              type: ServerEvent.WELCOME,
              payload: {
                participant,
                initialState: sync.encodeState(room),
                presence: sync.buildPresence(room)
              }
            });
            // Tell everyone else the roster changed.
            broadcastToOthers(room, client, {
              type: ServerEvent.PRESENCE_LIST,
              payload: { presence: sync.buildPresence(room) }
            });
            void emitActivity(room, client.participant, "join", {});
            return;
          }

          case ClientEvent.SYNC_UPDATE: {
            if (!room || !client) return;
            sync.applyDocUpdate(room, message.payload.update);
            broadcastToOthers(room, client, {
              type: ServerEvent.SYNC_UPDATE,
              payload: {
                update: message.payload.update,
                from: client.participant.id
              }
            });

            // Throttled "edit" activity, attributed to the client's active file.
            const now = Date.now();
            if (now - client.lastEditAt > EDIT_ACTIVITY_THROTTLE_MS) {
              client.lastEditAt = now;
              const file =
                client.lastActiveFile ??
                sync.readClientPresence(room, client)?.activeFile ??
                null;
              void emitActivity(
                room,
                client.participant,
                "edit",
                file ? { file } : {}
              );
            }
            return;
          }

          case ClientEvent.AWARENESS_UPDATE: {
            if (!room || !client) return;
            sync.applyAwareness(room, message.payload.update, client);
            // Relay presence to peers; they render cursors/typing from this.
            broadcastToOthers(room, client, {
              type: ServerEvent.AWARENESS_UPDATE,
              payload: { update: message.payload.update }
            });

            // Detect active-file changes to emit "file_open" activity.
            const file = sync.readClientPresence(room, client)?.activeFile ?? null;
            if (file && file !== client.lastActiveFile) {
              client.lastActiveFile = file;
              void emitActivity(room, client.participant, "file_open", { file });
            }
            return;
          }

          case ClientEvent.CHAT_SEND: {
            if (!room || !client) return;
            const body = message.payload.body.trim();
            if (!body) return;
            const activeRoom = room;
            const author = client.participant;
            try {
              const chat = await chatService.send(activeRoom, author, body);
              broadcastAll(activeRoom, {
                type: ServerEvent.CHAT_MESSAGE,
                payload: { message: chat }
              });
            } catch (error) {
              app.log.warn({ error }, "failed to persist chat message");
              send(socket, {
                type: ServerEvent.ERROR,
                payload: { code: "CHAT_FAILED", message: "Message not delivered." }
              });
            }
            return;
          }

          case ClientEvent.CHAT_TYPING: {
            if (!room || !client) return;
            broadcastToOthers(room, client, {
              type: ServerEvent.CHAT_TYPING,
              payload: {
                participantId: client.participant.id,
                displayName: client.participant.displayName,
                typing: message.payload.typing
              }
            });
            return;
          }

          case ClientEvent.PING: {
            send(socket, { type: ServerEvent.PONG, payload: {} });
            return;
          }

          default: {
            const exhaustive: never = message;
            send(socket, {
              type: ServerEvent.ERROR,
              payload: {
                code: "UNKNOWN",
                message: `Unhandled message: ${String(exhaustive)}`
              }
            });
            return;
          }
        }
      });

      socket.on("close", async () => {
        if (!room || !client) return;
        const current = room;
        const leaving = client;

        current.clients.delete(leaving);
        void participantRepo.touch(leaving.participant.id).catch(() => undefined);
        void emitActivity(current, leaving.participant, "leave", {});

        // Remove the leaver's presence and notify peers.
        const removed = sync.clearAwareness(current, leaving);
        if (removed.length > 0) {
          broadcastAll(current, {
            type: ServerEvent.AWARENESS_UPDATE,
            payload: { update: sync.encodeAwareness(current, removed) }
          });
        }
        broadcastAll(current, {
          type: ServerEvent.PRESENCE_LIST,
          payload: { presence: sync.buildPresence(current) }
        });

        await roomManager.disposeIfEmpty(current);
      });
    }
  );
}

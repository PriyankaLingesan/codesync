import type { FastifyInstance } from "fastify";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse
} from "@codesync/shared";
import type { RoomRepository } from "../../infrastructure/db/RoomRepository.js";
import type { ActivityRepository } from "../../infrastructure/db/ActivityRepository.js";
import type { ChatRepository } from "../../infrastructure/db/ChatRepository.js";
import { generateRoomCode } from "../../infrastructure/ids.js";

/** Dependencies wired into the REST routes. */
export interface RoomRoutesDeps {
  roomRepo: RoomRepository;
  activityRepo: ActivityRepository;
  chatRepo: ChatRepository;
}

/**
 * REST endpoints for room lifecycle + history. Realtime traffic goes over
 * WebSocket; these handle creation, pre-join validation, and history reads.
 */
export function registerRoomRoutes(
  app: FastifyInstance,
  deps: RoomRoutesDeps
): void {
  const { roomRepo, activityRepo, chatRepo } = deps;

  // Create a room and return its shareable code.
  app.post<{ Body: CreateRoomRequest }>("/rooms", async (request, reply) => {
    const name = (request.body?.name ?? "").trim() || "Untitled Room";

    // Generate a code, retrying on the rare collision.
    let roomCode = generateRoomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await roomRepo.findByCode(roomCode);
      if (!clash) break;
      roomCode = generateRoomCode();
    }

    const record = await roomRepo.create(roomCode, name);
    const body: CreateRoomResponse = {
      roomId: record.id,
      roomCode: record.roomCode,
      name: record.name
    };
    return reply.code(201).send(body);
  });

  // Validate a room code + display name before the client opens the socket.
  app.post<{ Params: { roomCode: string }; Body: JoinRoomRequest }>(
    "/rooms/:roomCode/join",
    async (request, reply) => {
      const record = await roomRepo.findByCode(request.params.roomCode);
      if (!record) {
        return reply
          .code(404)
          .send({ code: "ROOM_NOT_FOUND", message: "No room with that code." });
      }

      const displayName = (request.body?.displayName ?? "").trim();
      if (!displayName) {
        return reply
          .code(400)
          .send({ code: "INVALID_NAME", message: "Display name is required." });
      }

      const body: JoinRoomResponse = {
        roomId: record.id,
        roomCode: record.roomCode,
        name: record.name
      };
      return reply.send(body);
    }
  );

  // Activity history (newest first), used to seed the activity panel.
  app.get<{
    Params: { roomCode: string };
    Querystring: { limit?: string; before?: string };
  }>("/rooms/:roomCode/activity", async (request, reply) => {
    const record = await roomRepo.findByCode(request.params.roomCode);
    if (!record) {
      return reply
        .code(404)
        .send({ code: "ROOM_NOT_FOUND", message: "No room with that code." });
    }
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 200);
    const events = await activityRepo.list(record.id, limit, request.query.before);
    return reply.send(events);
  });

  // Chat history (newest first), used to seed the chat panel.
  app.get<{
    Params: { roomCode: string };
    Querystring: { limit?: string; before?: string };
  }>("/rooms/:roomCode/chat", async (request, reply) => {
    const record = await roomRepo.findByCode(request.params.roomCode);
    if (!record) {
      return reply
        .code(404)
        .send({ code: "ROOM_NOT_FOUND", message: "No room with that code." });
    }
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 200);
    const messages = await chatRepo.list(record.id, limit, request.query.before);
    return reply.send(messages);
  });
}

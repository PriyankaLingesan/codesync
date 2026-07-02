import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { Config } from "./config.js";
import { createPool } from "./infrastructure/db/pool.js";
import { RoomRepository } from "./infrastructure/db/RoomRepository.js";
import { ParticipantRepository } from "./infrastructure/db/ParticipantRepository.js";
import { SnapshotRepository } from "./infrastructure/db/SnapshotRepository.js";
import { ActivityRepository } from "./infrastructure/db/ActivityRepository.js";
import { ChatRepository } from "./infrastructure/db/ChatRepository.js";
import { RoomManager } from "./application/RoomManager.js";
import { ActivityService } from "./application/ActivityService.js";
import { ChatService } from "./application/ChatService.js";
import { registerRoomRoutes } from "./interfaces/http/roomRoutes.js";
import { registerWebSocket } from "./interfaces/ws/socketHandler.js";

/**
 * Composition root: wires infrastructure, application, and interface layers
 * into a ready-to-listen Fastify instance.
 */
export async function buildServer(config: Config): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  const pool = createPool(config.databaseUrl);
  const roomRepo = new RoomRepository(pool);
  const participantRepo = new ParticipantRepository(pool);
  const snapshotRepo = new SnapshotRepository(pool);
  const activityRepo = new ActivityRepository(pool);
  const chatRepo = new ChatRepository(pool);
  const roomManager = new RoomManager(roomRepo, snapshotRepo, config);
  const activityService = new ActivityService(activityRepo);
  const chatService = new ChatService(chatRepo);

  await app.register(websocket);

  app.get("/health", async () => ({ status: "ok" }));
  registerRoomRoutes(app, { roomRepo, activityRepo, chatRepo });
  registerWebSocket(app, {
    roomManager,
    participantRepo,
    activityService,
    chatService
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return app;
}

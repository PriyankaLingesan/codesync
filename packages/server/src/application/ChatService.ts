import type { ChatMessage, Participant } from "@codesync/shared";
import type { Room } from "../domain/room.js";
import type { ChatRepository } from "../infrastructure/db/ChatRepository.js";

/** Persists chat messages and returns them for broadcast to the room. */
export class ChatService {
  constructor(private readonly repo: ChatRepository) {}

  send(room: Room, participant: Participant, body: string): Promise<ChatMessage> {
    return this.repo.create(
      room.record.id,
      participant.id,
      participant.displayName,
      body
    );
  }
}

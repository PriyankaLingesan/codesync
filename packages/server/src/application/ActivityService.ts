import type { ActivityEvent, ActivityType, Participant } from "@codesync/shared";
import type { Room } from "../domain/room.js";
import type { ActivityRepository } from "../infrastructure/db/ActivityRepository.js";

/**
 * Records collaboration activity (join/leave/file_open/edit) to Postgres and
 * returns the persisted event so it can be broadcast to the room.
 */
export class ActivityService {
  constructor(private readonly repo: ActivityRepository) {}

  record(
    room: Room,
    participant: Participant,
    type: ActivityType,
    payload: Record<string, unknown>
  ): Promise<ActivityEvent> {
    return this.repo.create(
      room.record.id,
      participant.id,
      participant.displayName,
      type,
      payload
    );
  }
}

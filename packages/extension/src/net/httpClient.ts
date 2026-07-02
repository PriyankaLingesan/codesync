import type {
  ActivityEvent,
  ChatMessage,
  CreateRoomResponse,
  JoinRoomResponse
} from "@codesync/shared";

/** Thin REST client for room lifecycle + history. */
export class HttpClient {
  constructor(private readonly baseUrl: string) {}

  async createRoom(name: string): Promise<CreateRoomResponse> {
    const res = await fetch(`${this.baseUrl}/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      throw new Error(await errorMessage(res, "Failed to create room"));
    }
    return (await res.json()) as CreateRoomResponse;
  }

  async joinRoom(roomCode: string, displayName: string): Promise<JoinRoomResponse> {
    const res = await fetch(
      `${this.baseUrl}/rooms/${encodeURIComponent(roomCode)}/join`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName })
      }
    );
    if (res.status === 404) {
      throw new Error("Room not found. Check the code and try again.");
    }
    if (!res.ok) {
      throw new Error(await errorMessage(res, "Failed to join room"));
    }
    return (await res.json()) as JoinRoomResponse;
  }

  /** Recent activity events (newest first) to seed the activity panel. */
  async getActivity(roomCode: string, limit = 50): Promise<ActivityEvent[]> {
    const res = await fetch(
      `${this.baseUrl}/rooms/${encodeURIComponent(roomCode)}/activity?limit=${limit}`
    );
    if (!res.ok) return [];
    return (await res.json()) as ActivityEvent[];
  }

  /** Recent chat messages (newest first) to seed the chat panel. */
  async getChat(roomCode: string, limit = 50): Promise<ChatMessage[]> {
    const res = await fetch(
      `${this.baseUrl}/rooms/${encodeURIComponent(roomCode)}/chat?limit=${limit}`
    );
    if (!res.ok) return [];
    return (await res.json()) as ChatMessage[];
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

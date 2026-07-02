import { describe, it, expect } from "vitest";
import { ClientEvent, ServerEvent } from "../src/index.js";

describe("protocol event constants", () => {
  it("uses stable client event names", () => {
    expect(ClientEvent.JOIN).toBe("client:join");
    expect(ClientEvent.SYNC_UPDATE).toBe("client:sync_update");
    expect(ClientEvent.CHAT_SEND).toBe("client:chat_send");
    expect(ClientEvent.CHAT_TYPING).toBe("client:chat_typing");
  });

  it("uses stable server event names", () => {
    expect(ServerEvent.WELCOME).toBe("server:welcome");
    expect(ServerEvent.CHAT_MESSAGE).toBe("server:chat_message");
    expect(ServerEvent.ACTIVITY).toBe("server:activity");
    expect(ServerEvent.ERROR).toBe("server:error");
  });

  it("keeps client and server names disjoint", () => {
    const client = new Set(Object.values(ClientEvent));
    const server = new Set(Object.values(ServerEvent));
    for (const name of client) expect(server.has(name)).toBe(false);
  });
});

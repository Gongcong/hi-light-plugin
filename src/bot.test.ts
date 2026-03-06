import { beforeEach, describe, expect, it, vi } from "vitest";

const getHiLightRuntimeMock = vi.hoisted(() => vi.fn());
const finalizeInboundContextMock = vi.hoisted(() => vi.fn((ctx) => ctx));
const dispatchReplyWithBufferedBlockDispatcherMock = vi.hoisted(() => vi.fn(async () => undefined));
const resolveStorePathMock = vi.hoisted(() => vi.fn(() => "/tmp/sessions.json"));
const recordInboundSessionMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./runtime.js", () => ({
  getHiLightRuntime: getHiLightRuntimeMock,
}));

import { handleHiLightMessage } from "./bot.js";

function createLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as never;
}

describe("handleHiLightMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getHiLightRuntimeMock.mockReturnValue({
      channel: {
        routing: {
          resolveAgentRoute: vi.fn(() => ({
            agentId: "main",
            accountId: "acc-main",
            sessionKey: "agent:main:main",
          })),
        },
        session: {
          resolveStorePath: resolveStorePathMock,
          recordInboundSession: recordInboundSessionMock,
        },
        reply: {
          finalizeInboundContext: finalizeInboundContextMock,
          dispatchReplyWithBufferedBlockDispatcher: dispatchReplyWithBufferedBlockDispatcherMock,
          resolveHumanDelayConfig: vi.fn(() => undefined),
        },
      },
    });
  });

  it("uses route session key and keeps sender name", async () => {
    await handleHiLightMessage({
      ws: { send: vi.fn() } as never,
      raw: JSON.stringify({
        context: "conv-001",
        action: "msg",
        payload: {
          userId: "user-1",
          userName: "Alice",
          text: "hello",
        },
      }),
      config: {} as never,
      accountId: "acc-main",
      log: createLog(),
    });

    expect(finalizeInboundContextMock).toHaveBeenCalledTimes(1);
    expect(finalizeInboundContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Body: "hello",
        BodyForAgent: "hello",
        From: "user-1",
        SenderName: "Alice",
        AccountId: "acc-main",
        SessionKey: "agent:main:main",
      }),
    );
    expect(resolveStorePathMock).toHaveBeenCalledTimes(1);
    expect(recordInboundSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storePath: "/tmp/sessions.json",
        sessionKey: "agent:main:main",
      }),
    );

    expect(dispatchReplyWithBufferedBlockDispatcherMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to default context and sender when optional fields are missing", async () => {
    await handleHiLightMessage({
      ws: { send: vi.fn() } as never,
      raw: JSON.stringify({
        context: "",
        action: "msg",
        payload: {
          userId: "42",
          text: "ping",
        },
      }),
      config: {} as never,
      accountId: "acc-main",
      log: createLog(),
    });

    expect(finalizeInboundContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        SenderName: "42",
        SessionKey: "agent:main:main",
      }),
    );
  });

  it("drops invalid msg payloads", async () => {
    await handleHiLightMessage({
      ws: { send: vi.fn() } as never,
      raw: JSON.stringify({
        context: "conv-1",
        action: "msg",
        payload: {
          userId: "user-1",
          text: "   ",
        },
      }),
      config: {} as never,
      accountId: "acc-main",
      log: createLog(),
    });

    expect(finalizeInboundContextMock).not.toHaveBeenCalled();
    expect(dispatchReplyWithBufferedBlockDispatcherMock).not.toHaveBeenCalled();
    expect(recordInboundSessionMock).not.toHaveBeenCalled();
  });
});

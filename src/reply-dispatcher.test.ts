import { beforeEach, describe, expect, it, vi } from "vitest";

const getHiLightRuntimeMock = vi.hoisted(() => vi.fn());
const createReplyDispatcherWithTypingMock = vi.hoisted(() => vi.fn());

vi.mock("./runtime.js", () => ({
  getHiLightRuntime: getHiLightRuntimeMock,
}));

import { createHiLightReplyDispatcher } from "./reply-dispatcher.js";

describe("createHiLightReplyDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createReplyDispatcherWithTypingMock.mockImplementation(() => ({
      dispatcher: {},
      replyOptions: {},
      markDispatchIdle: vi.fn(),
    }));

    getHiLightRuntimeMock.mockReturnValue({
      channel: {
        reply: {
          createReplyDispatcherWithTyping: createReplyDispatcherWithTypingMock,
          resolveHumanDelayConfig: vi.fn(() => undefined),
        },
      },
    });
  });

  it("sends typing indicator via onReplyStart", async () => {
    const send = vi.fn();
    const ws = { send } as never;

    createHiLightReplyDispatcher({
      ws,
      config: {} as never,
      userId: "user-1",
      context: "conv-1",
      log: {} as never,
    });

    const options = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];
    await options.onReplyStart?.();

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      context: "conv-1",
      action: "typing",
      payload: { userId: "user-1" },
    });
  });

  it("buffers chunks and sends one reply on final payload", async () => {
    const send = vi.fn();
    const ws = { send } as never;

    createHiLightReplyDispatcher({
      ws,
      config: {} as never,
      userId: "user-1",
      context: "conv-1",
      log: {} as never,
    });

    const options = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];
    await options.deliver({ text: "hello " }, { kind: "block" });
    await options.deliver({ text: "world" }, { kind: "final" });

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      context: "conv-1",
      action: "reply",
      payload: {
        userId: "user-1",
        text: "hello world",
        done: true,
      },
    });
  });

  it("flushes buffered block-only replies when dispatch is marked idle", async () => {
    const send = vi.fn();
    const ws = { send } as never;

    const result = createHiLightReplyDispatcher({
      ws,
      config: {} as never,
      userId: "user-1",
      context: "conv-1",
      log: {} as never,
    });

    const options = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];
    await options.deliver({ text: "chunk-only" }, { kind: "block" });

    result.markDispatchIdle();
    result.markDispatchIdle();

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      context: "conv-1",
      action: "reply",
      payload: {
        userId: "user-1",
        text: "chunk-only",
        done: true,
      },
    });
  });
});

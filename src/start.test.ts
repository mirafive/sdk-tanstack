import { describe, expect, test } from "bun:test";

import { miraMiddleware } from "./start";

type ServerFn = (input: {
  next: (options: { context: Record<string, unknown> }) => Promise<unknown>;
  context: Record<string, unknown>;
  request: Request;
}) => Promise<unknown>;

const run = (middleware: ReturnType<typeof miraMiddleware>, next = async () => "response") => {
  const server = (middleware.options as unknown as { server: ServerFn }).server;
  let context: Record<string, unknown> = {};
  return server({
    next: async (options) => {
      context = options.context;
      return next();
    },
    context: {},
    request: new Request("https://app.example/"),
  }).then((result) => ({ result, context }));
};

describe("miraMiddleware", () => {
  test("puts one shared server client on context and flushes it with waitUntil", async () => {
    const waited: Promise<unknown>[] = [];
    const options = {
      enabled: false,
      waitUntil: (promise: Promise<unknown>) => waited.push(promise),
    };
    const first = await run(miraMiddleware(options));
    const second = await run(miraMiddleware(options));
    expect(first.result).toBe("response");
    expect(typeof (first.context.mira as { track: unknown }).track).toBe("function");
    expect(first.context.mira).toBe(second.context.mira);
    expect(waited).toHaveLength(2);
  });

  test("flushes even when the handler throws", async () => {
    const waited: Promise<unknown>[] = [];
    const middleware = miraMiddleware({ enabled: false, waitUntil: (p) => waited.push(p) });
    const failure = await run(middleware, async () => {
      throw new Error("handler failed");
    }).catch((error: unknown) => error);
    expect(String(failure)).toContain("handler failed");
    expect(waited).toHaveLength(1);
  });
});

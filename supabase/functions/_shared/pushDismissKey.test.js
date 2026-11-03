import { describe, test, expect } from "bun:test";
import { pushDismissKey } from "./pushDismissKey.ts";

describe("pushDismissKey", () => {
  test("new-post pushes map to a post key", () =>
    expect(pushDismissKey("/post/9b9ac33d-9115-4481-9a66-07363d4983e3")).toBe(
      "post-9b9ac33d-9115-4481-9a66-07363d4983e3"));

  test("chat pushes carry the conversation id in the url", () =>
    expect(pushDismissKey("/messages?c=64431997-9957-428c-89e8-c7340f801f98")).toBe(
      "chat-64431997-9957-428c-89e8-c7340f801f98"));

  test("uppercase urls normalize to lowercase keys", () =>
    expect(pushDismissKey("/POST/9B9AC33D-9115-4481-9A66-07363D4983E3")).toBe(
      "post-9b9ac33d-9115-4481-9a66-07363d4983e3"));

  test("other notifications never get a key", () => {
    for (const url of ["/notifications", "/messages", "/", "", null, undefined]) {
      expect(pushDismissKey(url as string)).toBeNull();
    }
  });

  test("junk post paths are not matched", () =>
    expect(pushDismissKey("/post/not-a-uuid")).toBeNull());
});

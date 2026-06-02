"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  resolveStateAndEvent,
  buildCursorStateBody,
} = require("../hooks/cursor-hook");

const resolved = {
  stablePid: 123,
  agentPid: 456,
  detectedEditor: "cursor",
  pidChain: [789, 456, 123],
};

describe("Cursor hook", () => {
  it("forwards the composer model so sessions are not reported as unknown", () => {
    const body = buildCursorStateBody(
      resolveStateAndEvent({}, "beforeSubmitPrompt"),
      {
        conversation_id: "conv-1",
        model: "claude-sonnet-4-20250514",
        cwd: "/repo",
      },
      "beforeSubmitPrompt",
      resolved,
    );

    assert.strictEqual(body.agent_id, "cursor-agent");
    assert.strictEqual(body.session_id, "conv-1");
    assert.strictEqual(body.state, "thinking");
    assert.strictEqual(body.model, "claude-sonnet-4-20250514");
    assert.strictEqual(body.cwd, "/repo");
    assert.strictEqual(body.source_pid, 123);
    assert.strictEqual(body.editor, "cursor");
    assert.strictEqual(body.agent_pid, 456);
    assert.strictEqual(body.cursor_pid, 456);
    assert.deepStrictEqual(body.pid_chain, [789, 456, 123]);
  });

  it("falls back to subagent_model for subagent hooks", () => {
    const body = buildCursorStateBody(
      resolveStateAndEvent({}, "subagentStart"),
      { conversation_id: "conv-2", subagent_model: "gpt-5" },
      "subagentStart",
      resolved,
    );
    assert.strictEqual(body.model, "gpt-5");
    assert.strictEqual(body.state, "juggling");
  });

  it("trims the model and omits it when the payload has none", () => {
    const trimmed = buildCursorStateBody(
      resolveStateAndEvent({}, "preToolUse"),
      { conversation_id: "c", model: "  gemini-2.5-pro  ", tool_name: "Read" },
      "preToolUse",
      resolved,
    );
    assert.strictEqual(trimmed.model, "gemini-2.5-pro");

    // workspaceOpen-style lifecycle hooks omit model entirely.
    const noModel = buildCursorStateBody(
      resolveStateAndEvent({}, "sessionStart"),
      { conversation_id: "c" },
      "sessionStart",
      resolved,
    );
    assert.strictEqual(Object.prototype.hasOwnProperty.call(noModel, "model"), false);
  });

  it("uses host instead of local pid fields in remote mode", () => {
    const body = buildCursorStateBody(
      resolveStateAndEvent({}, "postToolUse"),
      { conversation_id: "c", model: "qwen3-coder", tool_name: "Write" },
      "postToolUse",
      resolved,
      { remote: true, host: "remote-box" },
    );
    assert.strictEqual(body.host, "remote-box");
    assert.strictEqual(body.model, "qwen3-coder");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(body, "source_pid"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(body, "agent_pid"), false);
  });
});

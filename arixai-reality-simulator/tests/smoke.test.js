import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/reality.js";
import { SCENARIOS, searchScenarios } from "../reality-scenarios.js";
import { createSession, applyTurnResult, restoreSession } from "../reality-state.js";
import { normaliseEvaluation } from "../reality-evaluator.js";

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

test("scenario library contains the full 63-situation catalogue", () => {
  assert.equal(SCENARIOS.length, 63);
  assert.ok(searchScenarios("interview").length >= 5);
  assert.ok(searchScenarios("", "business").length >= 10);
});

test("session state appends multiple characters and restores safely", () => {
  const scenario = {
    id: "test", title: "Panel interview", objectives: ["Explain experience"],
    characters: [{ id: "chair", name: "Maya", role: "Chair" }, { id: "technical", name: "Dev", role: "Technical interviewer" }]
  };
  let session = createSession(scenario, { mode: "training" });
  session = applyTurnResult(session, {
    reply: "Tell us about a project.",
    responses: [
      { characterId: "chair", text: "Tell us about a project.", emotion: "neutral" },
      { characterId: "technical", text: "What trade-off did you make?", emotion: "curious" }
    ],
    suggestedActions: ["Use one concrete example."],
    statePatch: { tension: 48, progress: 25 }
  }, "I led a project.");
  assert.equal(session.turnCount, 1);
  assert.equal(session.messages.length, 3);
  assert.equal(session.messages[2].characterId, "technical");
  assert.equal(session.suggestedActions.length, 1);
  assert.equal(restoreSession(session).messages.length, 3);
});

test("evaluation normalisation clamps model scores and preserves evidence", () => {
  const session = { messages: [{ role: "user" }, { role: "character" }], summary: "Resolved" };
  const evaluation = normaliseEvaluation({
    overallScore: 140,
    summary: "Specific evidence was considered.",
    dimensions: [{ name: "Clarity", score: 83, evidence: "The response included a concrete example.", improvement: "State the outcome earlier." }]
  }, session);
  assert.equal(evaluation.overallScore, 100);
  assert.equal(evaluation.dimensions[0].score, 83);
  assert.equal(evaluation.dimensions[0].evidence, "The response included a concrete example.");
});

test("API health route exposes readiness without revealing key values", async () => {
  const oldKey = process.env.GEMINI_KEY;
  delete process.env.GEMINI_KEY;
  const response = mockResponse();
  await handler({ method: "GET", headers: { host: "localhost:3000", origin: "http://localhost:3000" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ready, false);
  assert.equal(response.body.configuredKeys, 0);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "http://localhost:3000");
  if (oldKey !== undefined) process.env.GEMINI_KEY = oldKey;
});

test("Gemini key failover and create response validation work with a mocked provider", async () => {
  const originalFetch = globalThis.fetch;
  const previous = [process.env.GEMINI_KEY, process.env.GEMINI_KEY2, process.env.GEMINI_KEY3];
  process.env.GEMINI_KEY = "first-smoke-test-key-123456";
  process.env.GEMINI_KEY2 = "second-smoke-test-key-123456";
  delete process.env.GEMINI_KEY3;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      scenario: {
        title: "Interview practice", description: "A realistic interview.", category: "career", environment: "interview",
        objectives: ["Explain experience", "Use evidence", "Ask a question"],
        characters: [{ id: "lead", name: "Maya", role: "Hiring manager" }],
        evaluationCriteria: [{ name: "Clarity", description: "Clear communication", weight: 100 }],
        openingLine: "Welcome. Tell me about a project you are proud of.", openingCharacterId: "lead"
      }
    }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = mockResponse();
    await handler({ method: "POST", headers: { host: "localhost:3000" }, body: { action: "create", prompt: "Create a realistic interview for a junior analyst." } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.keySlot, "GEMINI_KEY2");
    assert.equal(response.body.data.scenario.title, "Interview practice");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    ["GEMINI_KEY", "GEMINI_KEY2", "GEMINI_KEY3"].forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index];
    });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/reality.js";
import { SCENARIOS, searchScenarios } from "../reality-scenarios.js";
import { createSession, applyTurnResult, restoreSession } from "../reality-state.js";
import { normaliseEvaluation } from "../reality-evaluator.js";
import { buildDirectorContext, normaliseWorldUpdate, normaliseDecisionOptions, captureBranchPoint, createReplayBranch } from "../reality-intelligence.js";

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


test("director context preserves continuity facts and per-character memory", () => {
  const session = createSession({ id: "director", title: "Supplier negotiation", objectives: ["Agree terms"], worldFacts: ["Delivery is due Friday"], characters: [{ id: "supplier", name: "Ravi", role: "Supplier" }] });
  session.turnCount = 3;
  session.continuitySummary = "The supplier promised Friday delivery; the price is still unresolved.";
  session.characters[0].memory = ["User needs delivery before Friday"];
  const context = buildDirectorContext(session);
  assert.equal(context.turn, 4);
  assert.match(context.summary, /Friday/);
  assert.equal(context.characters[0].rememberedDetails[0], "User needs delivery before Friday");
  assert.equal(context.scenario.worldFacts[0], "Delivery is due Friday");
});

test("world updates and decision options are bounded and sanitised", () => {
  const world = normaliseWorldUpdate({ variables: [{ key: "budget!", label: "Budget", value: "₹4,000", detail: "Remaining" }, { key: "", value: "ignored" }] }, { worldState: {}, turnCount: 2 });
  assert.equal(world.budget.value, "₹4,000");
  const options = normaliseDecisionOptions([{ label: "Ask for evidence", prompt: "Ask them to support the claim.", lens: "Verify" }, { label: "", prompt: "" }]);
  assert.equal(options.length, 1);
  assert.equal(options[0].prompt, "Ask them to support the claim.");
});

test("branch replay creates an independent session at the saved decision point", () => {
  const scenario = { id: "branch-test", title: "Practice", objectives: ["Respond"], characters: [{ id: "c1", name: "Maya", role: "Interviewer" }], openingLine: "Tell me about yourself." };
  const session = createSession(scenario);
  const point = captureBranchPoint(session);
  session.branchPoints = [point];
  const branch = createReplayBranch(session, point.id);
  assert.notEqual(branch.id, session.id);
  assert.equal(branch.turnCount, 0);
  assert.equal(branch.status, "active");
  assert.equal(branch.parentSessionId, session.id);
  assert.equal(branch.messages.length, 0);
  assert.equal(session.status, "active");
});

test("partial character and relationship updates preserve established dynamics", () => {
  const scenario = { id: "dynamics", title: "Negotiation", objectives: ["Agree terms"], characters: [{ id: "one", name: "Maya", role: "Buyer" }, { id: "two", name: "Ravi", role: "Seller" }] };
  let session = createSession(scenario);
  session.characters[0].mood = "skeptical";
  session.characters[0].rapport = 64;
  session.characters[0].pressure = 37;
  session.relationships = [{ from: "one", to: "two", dynamic: "cautiously cooperative", trust: 71, tension: 29, updatedAtTurn: 1 }];
  session = applyTurnResult(session, {
    reply: "Can you clarify that point?",
    responses: [{ characterId: "one", text: "Can you clarify that point?", emotion: "curious" }],
    characterUpdates: [{ characterId: "one", remember: ["Supplier requested a written timeline"] }],
    relationshipUpdates: [{ from: "one", to: "two" }],
    statePatch: { progress: 20 }
  }, "I can share the timeline.");
  assert.equal(session.characters[0].mood, "skeptical");
  assert.equal(session.characters[0].rapport, 64);
  assert.equal(session.characters[0].pressure, 37);
  assert.equal(session.relationships[0].trust, 71);
  assert.equal(session.relationships[0].tension, 29);
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

test("turn API preserves omitted state fields and validates director intelligence", async () => {
  const originalFetch = globalThis.fetch;
  const previous = [process.env.GEMINI_KEY, process.env.GEMINI_KEY2, process.env.GEMINI_KEY3];
  process.env.GEMINI_KEY = "turn-smoke-test-key-123456";
  delete process.env.GEMINI_KEY2;
  delete process.env.GEMINI_KEY3;
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
    reply: "Maya pauses, then asks for one concrete example.",
    responses: [{ characterId: "lead", text: "Maya pauses, then asks for one concrete example.", emotion: "curious" }],
    characterUpdates: [{ characterId: "lead", remember: ["User promised to share a measurable result"] }],
    statePatch: { progress: 42 },
    sceneCue: "Maya turns a page in the interview notes.",
    visualCue: { lighting: "cool", focus: "interview notes", ambience: "subtle-motion", transition: "soft" },
    activeBeat: "Evidence check",
    branch: { label: "Evidence requested", description: "The interviewer asks for a measurable result." },
    worldUpdate: { variables: [{ key: "time_remaining", label: "Time remaining", value: "8 minutes" }] },
    decisionOptions: [{ label: "Give a measured result", prompt: "Explain the result with a number and context.", lens: "Evidence" }],
    continuitySummary: "The interviewer has asked for a measurable project result."
  }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = mockResponse();
    await handler({ method: "POST", headers: { host: "localhost:3000" }, body: {
      action: "turn", scenario: { id: "interview", characters: [{ id: "lead", name: "Maya" }], objectives: ["Explain experience"] },
      characters: [{ id: "lead", name: "Maya" }], userInput: "I completed a project."
    } }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data.statePatch, { progress: 42 });
    assert.equal(response.body.data.characterUpdates[0].rapportDelta, 0);
    assert.equal(response.body.data.characterUpdates[0].pressureDelta, 0);
    assert.equal(response.body.data.characterUpdates[0].mood, undefined);
    assert.equal(response.body.data.activeBeat, "Evidence check");
    assert.equal(response.body.data.worldUpdate.variables[0].value, "8 minutes");
    assert.equal(response.body.data.decisionOptions[0].lens, "Evidence");
  } finally {
    globalThis.fetch = originalFetch;
    ["GEMINI_KEY", "GEMINI_KEY2", "GEMINI_KEY3"].forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index];
    });
  }
});


test("temporary Gemini provider outage returns a usable local fallback turn", async () => {
  const previousKey = process.env.GEMINI_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_KEY = "test-key-for-fallback";
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "temporary overload" } }), { status: 503, headers: { "Content-Type": "application/json" } });
  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000", "x-forwarded-for": "198.51.100.44" },
      body: { action: "turn", scenario: { title: "Practice", characters: [{ id: "c1", name: "Maya", role: "Interviewer" }] }, characters: [{ id: "c1", name: "Maya", role: "Interviewer" }], userInput: "I would explain the project outcome with measurable evidence.", turn: 1 }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.degraded, true);
    assert.equal(response.body.model, "local-resilience-fallback");
    assert.match(response.body.data.reply, /measurable evidence/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = previousKey;
  }
});

import { initialiseCharacters, applyCharacterUpdates } from "./reality-characters.js";

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `rs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createSession(scenario, options = {}) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    scenario: structuredCloneSafe(scenario),
    mode: options.mode || "training",
    difficulty: options.difficulty || "intermediate",
    pressure: options.pressure || "balanced",
    language: options.language || "English",
    timeLimit: Number(options.timeLimit) || 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    turnCount: 0,
    messages: [],
    events: [],
    decisions: [],
    objectives: (scenario.objectives || []).map((text, index) => ({ id: `objective-${index}`, text, status: "pending" })),
    characters: initialiseCharacters(scenario.characters || []),
    scene: { mood: "calm", tension: 28, stage: "opening", progress: 5 },
    summary: "",
    evaluation: null,
    context: options.context || ""
  };
}

export function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function appendMessage(session, message) {
  const updated = {
    ...session,
    messages: [...session.messages, {
      id: makeId(),
      role: message.role,
      characterId: message.characterId || null,
      text: String(message.text || "").slice(0, 6000),
      emotion: message.emotion || "neutral",
      createdAt: new Date().toISOString(),
      meta: message.meta || null
    }],
    updatedAt: new Date().toISOString()
  };
  return updated;
}

export function applyTurnResult(session, result, userText) {
  let next = appendMessage(session, { role: "user", text: userText });
  const characterResponses = Array.isArray(result.responses) && result.responses.length
    ? result.responses.slice(0, 3)
    : [{ characterId: result.characterId, text: result.reply, emotion: result.emotion || "neutral" }];
  for (const response of characterResponses) {
    next = appendMessage(next, {
      role: "character",
      characterId: response.characterId,
      text: response.text,
      emotion: response.emotion || "neutral"
    });
  }
  const scenePatch = result.statePatch || {};
  const nextScene = {
    ...next.scene,
    ...scenePatch,
    tension: finiteClamp(scenePatch.tension ?? next.scene.tension, 0, 100),
    progress: finiteClamp(scenePatch.progress ?? Math.min(94, next.scene.progress + 7), 0, 100)
  };
  const objectiveUpdates = Array.isArray(result.objectivesUpdate) ? result.objectivesUpdate : [];
  const objectiveMap = new Map(objectiveUpdates.map((item) => [item.id, item.status]));
  const objectives = next.objectives.map((objective) => ({ ...objective, status: objectiveMap.get(objective.id) || objective.status }));
  const event = result.event && typeof result.event.title === "string" ? {
    id: makeId(), title: result.event.title.slice(0, 100), description: String(result.event.description || "").slice(0, 360), severity: result.event.severity || "info", createdAt: new Date().toISOString()
  } : null;
  next = {
    ...next,
    turnCount: next.turnCount + 1,
    scene: nextScene,
    objectives,
    characters: applyCharacterUpdates(next.characters, result.characterUpdates || []),
    events: event ? [...next.events, event].slice(-20) : next.events,
    decisions: result.decisionImpact ? [...next.decisions, { id: makeId(), userText: userText.slice(0, 500), impact: String(result.decisionImpact).slice(0, 500), createdAt: new Date().toISOString() }].slice(-20) : next.decisions,
    status: result.ending ? "completed" : next.status,
    summary: result.endingReason || next.summary,
    suggestedActions: Array.isArray(result.suggestedActions) ? result.suggestedActions.slice(0, 3) : [],
    updatedAt: new Date().toISOString()
  };
  return next;
}

export function restoreSession(raw) {
  if (!raw || !raw.id || !raw.scenario || !Array.isArray(raw.messages)) throw new Error("This saved simulation is incomplete.");
  return {
    ...raw,
    characters: initialiseCharacters(raw.characters || raw.scenario.characters || []),
    events: Array.isArray(raw.events) ? raw.events : [],
    decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
    objectives: Array.isArray(raw.objectives) ? raw.objectives : []
  };
}

function finiteClamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

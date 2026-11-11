import { initialiseCharacters, applyCharacterUpdates } from "./reality-characters.js";
import { normaliseWorldUpdate, normaliseDecisionOptions, appendBranch, createSnapshot } from "./reality-intelligence.js";

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
    continuitySummary: "",
    evaluation: null,
    context: options.context || "",
    worldFacts: Array.isArray(scenario.worldFacts) ? scenario.worldFacts.slice(0, 24) : [],
    worldState: Object.fromEntries((scenario.worldVariables || []).slice(0, 8).filter((item) => item?.key).map((item) => [String(item.key).slice(0, 42), { label: String(item.label || item.key).slice(0, 48), value: String(item.value || "").slice(0, 100), detail: String(item.detail || "").slice(0, 180), updatedAtTurn: 0 }])),
    relationships: [],
    branchHistory: [],
    unresolvedThreads: Array.isArray(scenario.openThreads) ? scenario.openThreads.slice(0, 8) : [],
    decisionOptions: [],
    activeBeat: scenario.storyArc?.[0]?.beat || scenario.storyArc?.[0] || "Opening moment",
    snapshots: [],
    branchPoints: [],
    objectiveEvidence: [],
    turnMetrics: { totalLatencyMs: 0, averageLatencyMs: 0, successfulTurns: 0 }
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
    id: makeId(), title: result.event.title.slice(0, 100), description: String(result.event.description || "").slice(0, 360), severity: result.event.severity || "info", createdAt: new Date().toISOString(), turn: next.turnCount + 1
  } : null;
  const nextTurn = next.turnCount + 1;
  const updatedCharacters = applyCharacterUpdates(next.characters, result.characterUpdates || []).map((character) => {
    const ownResponses = characterResponses.filter((response) => response.characterId === character.id).map((response) => ({ turn: nextTurn, text: String(response.text || "").slice(0, 260), emotion: response.emotion || "neutral", at: new Date().toISOString() }));
    return ownResponses.length ? { ...character, dialogueHistory: [...(character.dialogueHistory || []), ...ownResponses].slice(-12), lastSpokeAtTurn: nextTurn } : character;
  });
  const newDecision = result.decisionImpact ? { id: makeId(), turn: nextTurn, userText: userText.slice(0, 500), impact: String(result.decisionImpact).slice(0, 500), branch: String(result.branch?.label || "").slice(0, 90), createdAt: new Date().toISOString() } : null;
  const evidence = Array.isArray(result.objectiveEvidence) ? result.objectiveEvidence.slice(0, 5).map((item) => ({ id: String(item.id || "").slice(0, 48), evidence: String(item.evidence || "").slice(0, 320), turn: nextTurn })) : [];
  const previousSnapshotState = { ...next, turnCount: nextTurn, messages: next.messages, characters: updatedCharacters, scene: nextScene, objectives };
  const snapshot = createSnapshot(previousSnapshotState);
  const relationshipUpdates = Array.isArray(result.relationshipUpdates) ? result.relationshipUpdates.slice(0, 6) : [];
  const relationships = [...(next.relationships || [])];
  for (const item of relationshipUpdates) {
    const from = String(item.from || "").slice(0, 48); const to = String(item.to || "").slice(0, 48);
    if (!from || !to || from === to || !updatedCharacters.some((character) => character.id === from) || !updatedCharacters.some((character) => character.id === to)) continue;
    const index = relationships.findIndex((entry) => entry.from === from && entry.to === to);
    const previous = index >= 0 ? relationships[index] : null;
    const entry = {
      from, to,
      dynamic: item.dynamic === undefined ? (previous?.dynamic || "") : String(item.dynamic).slice(0, 120),
      trust: item.trust === undefined ? (previous?.trust ?? 50) : finiteClamp(item.trust, 0, 100),
      tension: item.tension === undefined ? (previous?.tension ?? 50) : finiteClamp(item.tension, 0, 100),
      updatedAtTurn: nextTurn
    };
    if (index >= 0) relationships[index] = entry; else relationships.push(entry);
  }
  const threads = Array.isArray(result.unresolvedThreads) ? result.unresolvedThreads.slice(0, 8).map((item) => String(item).slice(0, 180)).filter(Boolean) : next.unresolvedThreads;
  next = {
    ...next,
    turnCount: nextTurn,
    scene: {
      ...nextScene,
      caption: typeof result.sceneCue === "string" ? result.sceneCue.slice(0, 240) : nextScene.caption || "",
      visualCue: result.visualCue && typeof result.visualCue === "object" ? {
        lighting: String(result.visualCue.lighting || "balanced").slice(0, 32),
        focus: String(result.visualCue.focus || "conversation").slice(0, 48),
        ambience: String(result.visualCue.ambience || "still").slice(0, 40),
        transition: String(result.visualCue.transition || "soft").slice(0, 32)
      } : nextScene.visualCue || null
    },
    objectives,
    objectiveEvidence: [...(next.objectiveEvidence || []), ...evidence].slice(-30),
    characters: updatedCharacters,
    relationships: relationships.slice(-30),
    worldState: normaliseWorldUpdate(result.worldUpdate, next),
    branchHistory: appendBranch(next, result.branch),
    activeBeat: typeof result.activeBeat === "string" ? result.activeBeat.slice(0, 180) : next.activeBeat,
    unresolvedThreads: threads,
    decisionOptions: normaliseDecisionOptions(result.decisionOptions),
    events: event ? [...next.events, event].slice(-24) : next.events,
    decisions: newDecision ? [...next.decisions, newDecision].slice(-30) : next.decisions,
    snapshots: [...(next.snapshots || []), snapshot].slice(-18),
    status: result.ending ? "completed" : next.status,
    summary: result.endingReason || next.summary,
    continuitySummary: typeof result.continuitySummary === "string" && result.continuitySummary.trim() ? result.continuitySummary.slice(0, 1800) : next.continuitySummary,
    suggestedActions: Array.isArray(result.suggestedActions) ? result.suggestedActions.slice(0, 3) : [],
    lastTurnQuality: {
      continuity: String(result.turnQuality?.continuity || "maintained").slice(0, 40),
      realism: String(result.turnQuality?.realism || "contextual").slice(0, 40),
      notes: String(result.turnQuality?.notes || "").slice(0, 240)
    },
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
    objectives: Array.isArray(raw.objectives) ? raw.objectives : [],
    worldFacts: Array.isArray(raw.worldFacts) ? raw.worldFacts : [],
    worldState: raw.worldState && typeof raw.worldState === "object" ? raw.worldState : {},
    relationships: Array.isArray(raw.relationships) ? raw.relationships : [],
    branchHistory: Array.isArray(raw.branchHistory) ? raw.branchHistory : [],
    unresolvedThreads: Array.isArray(raw.unresolvedThreads) ? raw.unresolvedThreads : [],
    decisionOptions: Array.isArray(raw.decisionOptions) ? raw.decisionOptions : [],
    snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
    branchPoints: Array.isArray(raw.branchPoints) ? raw.branchPoints : [],
    objectiveEvidence: Array.isArray(raw.objectiveEvidence) ? raw.objectiveEvidence : [],
    continuitySummary: String(raw.continuitySummary || raw.summary || "").slice(0, 1800)
  };
}

function finiteClamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

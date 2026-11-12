const MAX_FACTS = 24;
const MAX_BRANCHES = 30;
const MAX_SNAPSHOTS = 18;

const clamp = (value, min = 0, max = 100) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
};
const clean = (value, max = 260) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max);
const id = () => globalThis.crypto?.randomUUID?.() || `ri-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Build a compact, structured director brief from the complete local simulation state. */
export function buildDirectorContext(session) {
  if (!session?.scenario) throw new Error("A scenario is required to direct the next turn.");
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const recent = messages.slice(-24).map((item) => ({
    role: item.role,
    characterId: item.characterId || null,
    text: clean(item.text, 1800),
    emotion: item.emotion || "neutral"
  }));
  const userTurns = messages.filter((item) => item.role === "user");
  return {
    turn: session.turnCount + 1,
    mode: session.mode,
    difficulty: session.difficulty,
    pressure: session.pressure,
    language: session.language,
    scenario: {
      id: session.scenario.id,
      title: session.scenario.title,
      premise: session.scenario.description,
      stakes: session.scenario.stakes,
      objectives: (session.objectives || []).map(({ id: objectiveId, text, status, evidence }) => ({ id: objectiveId, text, status, evidence: clean(evidence, 280) })),
      successConditions: session.scenario.successConditions || [],
      worldFacts: session.worldFacts || session.scenario.worldFacts || [],
      possibleComplications: session.scenario.possibleComplications || [],
      storyArc: session.scenario.storyArc || []
    },
    scene: {
      ...session.scene,
      activeBeat: session.activeBeat || null,
      caption: session.scene?.caption || "",
      visualCue: session.scene?.visualCue || null,
      unresolvedThreads: (session.unresolvedThreads || []).slice(-8)
    },
    characters: (session.characters || []).map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
      background: character.background,
      personality: character.personality,
      style: character.style,
      currentMood: character.mood,
      rapport: character.rapport,
      pressure: character.pressure,
      goalProgress: character.goalProgress,
      lastReaction: character.lastReaction || "",
      rememberedDetails: (character.memory || []).slice(-6),
      recentDialogue: (character.dialogueHistory || []).slice(-4)
    })),
    relationships: session.relationships || [],
    worldState: session.worldState || {},
    branchHistory: (session.branchHistory || []).slice(-12),
    decisionLedger: (session.decisions || []).slice(-12),
    eventLog: (session.events || []).slice(-10),
    summary: clean(session.continuitySummary || session.summary, 1800),
    userTurnCount: userTurns.length,
    recentTranscript: recent
  };
}

/** Safely normalise the richer scene/world payload returned by the simulation director. */
export function normaliseWorldUpdate(raw = {}, session = {}) {
  const patch = raw && typeof raw === "object" ? raw : {};
  const current = session?.worldState && typeof session.worldState === "object" ? session.worldState : {};
  const next = { ...current };
  const updates = Array.isArray(patch.variables) ? patch.variables.slice(0, 8) : [];
  for (const item of updates) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const key = clean(item.key, 42).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
    if (!key) continue;
    next[key] = {
      label: clean(item.label || key.replace(/-/g, " "), 48),
      value: clean(item.value, 100),
      detail: clean(item.detail, 180),
      updatedAtTurn: Number(session?.turnCount || 0) + 1
    };
  }
  return Object.fromEntries(Object.entries(next).slice(-MAX_FACTS));
}

export function normaliseDecisionOptions(options = []) {
  if (!Array.isArray(options)) return [];
  return options.slice(0, 3).map((item, index) => {
    const label = clean(item?.label, 72);
    const prompt = clean(item?.prompt || item?.intent || label, 220);
    if (!label || !prompt) return null;
    return { id: clean(item.id, 36) || `choice-${index + 1}`, label, prompt, lens: clean(item.lens, 90) };
  }).filter(Boolean);
}

export function appendBranch(session, branch = {}) {
  // The API intentionally returns branch: null when the director has no meaningful
  // branch change to record. A default parameter does not catch explicit null.
  // Normalise that case (and malformed primitives) before reading label/name.
  const safeBranch = branch && typeof branch === "object" && !Array.isArray(branch) ? branch : {};
  const previous = Array.isArray(session?.branchHistory)
    ? session.branchHistory.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
  const label = clean(safeBranch.label || safeBranch.name, 90);
  const description = clean(safeBranch.description || safeBranch.reason, 240);
  if (!label && !description) return previous;
  return [...previous, {
    id: id(), label: label || "A new direction", description,
    turn: Number(session?.turnCount || 0) + 1,
    createdAt: new Date().toISOString()
  }].slice(-MAX_BRANCHES);
}

export function createSnapshot(session) {
  const safe = {
    turnCount: Number(session.turnCount || 0),
    messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    scene: { ...(session.scene || {}) },
    objectives: (session.objectives || []).map((item) => ({ ...item })),
    characters: (session.characters || []).map((item) => ({
      id: item.id, mood: item.mood, rapport: item.rapport, pressure: item.pressure,
      goalProgress: item.goalProgress, memory: [...(item.memory || [])]
    })),
    worldState: { ...(session.worldState || {}) },
    decisionCount: (session.decisions || []).length,
    eventCount: (session.events || []).length,
    branchCount: (session.branchHistory || []).length,
    createdAt: new Date().toISOString()
  };
  return [...(session.snapshots || []), safe].slice(-MAX_SNAPSHOTS);
}

export function calculateContinuityWarnings(session) {
  const warnings = [];
  const ids = new Set((session?.characters || []).map((item) => item.id));
  const lastCharacters = (session?.messages || []).filter((item) => item.role === "character").slice(-6);
  if (lastCharacters.length >= 4 && new Set(lastCharacters.map((item) => item.characterId)).size === 1 && ids.size > 1) {
    warnings.push("Only one character has spoken recently; consider a relevant second perspective when the scene calls for it.");
  }
  const pending = (session?.objectives || []).filter((item) => item.status !== "completed");
  if (session?.turnCount >= 8 && pending.length === (session?.objectives || []).length) {
    warnings.push("Objectives have not progressed; introduce a concrete opportunity or obstacle without forcing completion.");
  }
  return warnings;
}

export function getIntelligenceLimits() {
  return { maxFacts: MAX_FACTS, maxBranches: MAX_BRANCHES, maxSnapshots: MAX_SNAPSHOTS };
}

/** Capture a reversible point before the user commits to the next response. */
export function captureBranchPoint(session) {
  const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
  return {
    id: id(),
    turn: Number(session.turnCount || 0) + 1,
    createdAt: new Date().toISOString(),
    scenario: copy(session.scenario),
    mode: session.mode,
    difficulty: session.difficulty,
    pressure: session.pressure,
    language: session.language,
    timeLimit: session.timeLimit,
    timerElapsed: session.timerElapsed || 0,
    turnCount: Number(session.turnCount || 0),
    messages: copy((session.messages || []).slice(-28)),
    events: copy((session.events || []).slice(-16)),
    decisions: copy((session.decisions || []).slice(-20)),
    objectives: copy(session.objectives || []),
    characters: copy(session.characters || []),
    scene: copy(session.scene || {}),
    continuitySummary: clean(session.continuitySummary || session.summary, 1800),
    context: clean(session.context, 12000),
    worldFacts: copy(session.worldFacts || []),
    worldState: copy(session.worldState || {}),
    relationships: copy(session.relationships || []),
    branchHistory: copy(session.branchHistory || []),
    unresolvedThreads: copy(session.unresolvedThreads || []),
    activeBeat: clean(session.activeBeat, 180),
    objectiveEvidence: copy(session.objectiveEvidence || []),
    turnMetrics: copy(session.turnMetrics || {}),
    snapshots: copy((session.snapshots || []).slice(-8)),
    branchPoints: copy((session.branchPoints || []).slice(-3))
  };
}

/** Create an independent session from a saved point; the original run stays untouched. */
export function createReplayBranch(session, branchPointId) {
  const point = (session?.branchPoints || []).find((item) => item.id === branchPointId);
  if (!point) throw new Error("That replay point is no longer available in this saved session.");
  const branchId = id();
  const clone = JSON.parse(JSON.stringify(point));
  delete clone.id;
  delete clone.createdAt;
  return {
    ...clone,
    id: branchId,
    parentSessionId: session.id,
    branchOrigin: { sessionId: session.id, pointId: point.id, turn: point.turn, title: session.scenario?.title || "Simulation" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    evaluation: null,
    summary: clone.continuitySummary || "",
    turnMetrics: { totalLatencyMs: 0, averageLatencyMs: 0, successfulTurns: 0 },
    branchPoints: (session.branchPoints || []).filter((item) => item.turn < point.turn).slice(-4),
    branchHistory: [...(clone.branchHistory || []), {
      id: id(), label: `Alternative path · Turn ${point.turn}`,
      description: "A separate replay from an earlier moment. The original session remains saved.",
      turn: point.turn, createdAt: new Date().toISOString()
    }].slice(-MAX_BRANCHES),
    decisionOptions: [],
    suggestedActions: []
  };
}

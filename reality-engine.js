import { createSession, applyTurnResult, appendMessage } from "./reality-state.js";
import { buildDirectorContext, captureBranchPoint } from "./reality-intelligence.js";

const API_PATH = "/api/reality";

export class RealityEngine {
  constructor({ endpoint = API_PATH, timeout = 50000 } = {}) {
    this.endpoint = endpoint;
    this.timeout = timeout;
    this.activeController = null;
    this.sequence = 0;
  }

  async health() {
    const response = await fetch(this.endpoint, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    const result = await safeJSON(response);
    if (!response.ok || !result.ok) throw apiError(result, response.status);
    return result;
  }

  async prepareScenario(seed, options = {}) {
    const seedText = options.prompt || `Build a playable simulation based on this curated scenario template. Preserve its situation and intended skills, but add scene details, believable characters, specific objectives and a natural opening line.\n\nTemplate: ${JSON.stringify(seed)}`;
    const result = await this.request("create", {
      prompt: seedText,
      context: options.context || "",
      mode: options.mode || "training",
      difficulty: options.difficulty || seed.difficulty || "intermediate",
      language: options.language || "English"
    });
    const scenario = unwrapScenario(result);
    if (!isPlayableScenario(scenario)) {
      throw new Error("The scenario response was incomplete. Please retry; your selected situation has not been changed.");
    }
    return scenario;
  }

  async createCustomScenario(prompt, context = "", options = {}) {
    const result = await this.request("create", {
      prompt: String(prompt).trim(), context,
      mode: options.mode || "training", difficulty: options.difficulty || "adaptive", language: options.language || "English"
    });
    const scenario = unwrapScenario(result);
    if (!isPlayableScenario(scenario)) {
      throw new Error("The generated scenario response was incomplete. Please retry with a little more detail.");
    }
    return scenario;
  }

  startSession(scenario, options = {}) {
    let session = createSession(scenario, { ...options, context: options.context || "" });
    session = appendMessage(session, {
      role: "character",
      characterId: scenario.openingCharacterId || scenario.characters?.[0]?.id || "primary",
      text: scenario.openingLine,
      emotion: scenario.initialSceneMood || "neutral"
    });
    session.scene = { ...session.scene, mood: scenario.initialSceneMood || "calm", stage: "opening", progress: 6 };
    return session;
  }

  async sendTurn(session, userInput) {
    const startedAt = Date.now();
    const branchPoint = captureBranchPoint(session);
    const directorContext = buildDirectorContext(session);
    const result = await this.request("turn", {
      scenario: session.scenario,
      state: directorContext,
      characters: session.characters,
      messages: session.messages.slice(-24).map((message) => ({ role: message.role, characterId: message.characterId, text: String(message.text || "").slice(0, 1800), emotion: message.emotion })),
      userInput,
      mode: session.mode,
      difficulty: session.difficulty,
      pressure: session.pressure,
      language: session.language,
      context: session.context,
      turn: session.turnCount + 1
    });
    const allowedCharacters = new Set((session.characters || []).map((character) => character.id));
    result.responses = (Array.isArray(result.responses) ? result.responses : []).filter((response) => allowedCharacters.has(response.characterId) && String(response.text || "").trim()).slice(0, 3);
    if (!result.responses.length && result.reply) {
      result.responses = [{ characterId: session.characters[0]?.id || "primary", text: result.reply, emotion: result.emotion || "neutral" }];
    }
    result.characterUpdates = (result.characterUpdates || []).filter((update) => allowedCharacters.has(update.characterId));
    const allowedObjectives = new Set((session.objectives || []).map((objective) => objective.id));
    result.objectivesUpdate = (result.objectivesUpdate || []).filter((update) => allowedObjectives.has(update.id));
    const next = applyTurnResult(session, result, userInput);
    next.branchPoints = [...(session.branchPoints || []), branchPoint].slice(-5);
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const previousMetrics = session.turnMetrics || { totalLatencyMs: 0, successfulTurns: 0 };
    const successfulTurns = Number(previousMetrics.successfulTurns || 0) + 1;
    next.turnMetrics = {
      totalLatencyMs: Math.min(3600000, Number(previousMetrics.totalLatencyMs || 0) + elapsedMs),
      successfulTurns,
      averageLatencyMs: Math.round((Number(previousMetrics.totalLatencyMs || 0) + elapsedMs) / successfulTurns)
    };
    return next;
  }

  async evaluate(session) {
    const result = await this.request("evaluate", {
      scenario: session.scenario,
      state: buildDirectorContext(session),
      messages: session.messages.slice(-80),
      mode: session.mode,
      difficulty: session.difficulty,
      language: session.language,
      context: session.context
    });
    return result;
  }

  cancel() {
    this.activeController?.abort();
    this.activeController = null;
  }

  async request(action, payload) {
    this.cancel();
    const controller = new AbortController();
    this.activeController = controller;
    const sequence = ++this.sequence;
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ action, ...payload })
      });
      const result = await safeJSON(response);
      if (sequence !== this.sequence) throw new Error("This request was superseded by a newer action.");
      if (!response.ok || !result.ok) throw apiError(result, response.status);
      return result.data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The AI response took too long or the request was cancelled. Your session is saved; try again.");
      throw error;
    } finally {
      globalThis.clearTimeout(timer);
      if (this.activeController === controller) this.activeController = null;
    }
  }
}

function unwrapScenario(result) {
  // Accept the canonical API shape and the legacy bare-scenario shape so a stale
  // deployment cannot turn a valid fallback response into a blank setup screen.
  if (result?.scenario && typeof result.scenario === "object") return result.scenario;
  if (result && typeof result === "object" && Array.isArray(result.characters)) return result;
  return null;
}

function isPlayableScenario(scenario) {
  return Boolean(
    scenario &&
    Array.isArray(scenario.characters) &&
    scenario.characters.length > 0 &&
    String(scenario.openingLine || "").trim() &&
    String(scenario.title || "").trim()
  );
}

async function safeJSON(response) {
  try { return await response.json(); }
  catch { return { ok: false, error: { message: `The server returned an unreadable response (${response.status}).` } }; }
}

function apiError(result, status) {
  const message = result?.error?.message || `The simulator request failed (${status}).`;
  const error = new Error(message);
  error.status = status;
  error.code = result?.error?.code || "API_ERROR";
  error.retryAfter = result?.error?.retryAfter || null;
  return error;
}

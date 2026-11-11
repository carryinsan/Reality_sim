import { SCENARIOS, CATEGORIES, searchScenarios, createLocalScenarioDraft } from "./reality-scenarios.js";
import { RealityEngine } from "./reality-engine.js";
import { restoreSession } from "./reality-state.js";
import { applyCharacterUpdates } from "./reality-characters.js";
import { createReplayBranch } from "./reality-intelligence.js";
import { saveSession, getSession, listSessions, deleteSession, getHistory, saveCustomScenario, getCustomScenarios, removeCustomScenario, clearLocalData } from "./reality-storage.js";
import { normaliseEvaluation, formatEvaluationForExport } from "./reality-evaluator.js";
import { renderEnvironment, renderAvatar, setSceneMood, flashScene } from "./reality-visuals.js";
import { RealityVoice } from "./reality-voice.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const engine = new RealityEngine();
const state = {
  category: "all", query: "", nav: "discover", pendingScenario: null, pendingPrepared: false,
  pendingContext: "", pendingPrompt: "", editingScenarioId: null, session: null, busy: false, timer: null,
  remainingSeconds: 0, voice: null, voiceOutputEnabled: false, history: [], lastCharacterLine: "", activeCharacterId: null
};

const refs = {
  appShell: $("#appShell"), discovery: $("#discoveryView"), history: $("#historyView"), custom: $("#customView"),
  scenarioGrid: $("#scenarioGrid"), categoryTabs: $("#categoryTabs"), search: $("#searchInput"), featured: $("#featuredSpotlight"),
  resultCount: $("#resultCount"), libraryTitle: $("#libraryTitle"), empty: $("#emptyState"), recent: $("#recentList"),
  simulation: $("#simulationView"), results: $("#resultsView"), globalLoading: $("#globalLoading"),
  setupDialog: $("#setupDialog"), createDialog: $("#createDialog"), helpDialog: $("#helpDialog"),
  sceneRoot: $("#sceneRoot"), sceneWrap: $("#sceneWrap"), dialogue: $("#dialogueList"), response: $("#responseInput"),
  responseForm: $("#responseForm"), send: $("#sendButton"), suggestions: $("#suggestionRow"), events: $("#eventFeed"),
  characterPanel: $("#characterPanel"), objectives: $("#objectiveList"), eventLog: $("#eventLog"), toast: $("#toastRegion")
};

const CARD_COLORS = {
  career: ["#253f4d", "#1b293b", "#bd9a70"], everyday: ["#284b48", "#1b3038", "#91b7a8"],
  education: ["#2a405d", "#1d2b40", "#91acd0"], business: ["#443753", "#202a40", "#c39cca"],
  communication: ["#514039", "#2b2d3e", "#d4a98d"], challenge: ["#573d42", "#242c3b", "#d48f85"], custom: ["#344f5c", "#1a2c3c", "#d1ad7e"]
};
const GLYPHS = { career: "◈", everyday: "⌂", education: "▤", business: "◫", communication: "◎", challenge: "⌁", custom: "✦" };
const ENV_LABELS = { office: ["Office", "A professional environment"], interview: ["Interview room", "A focused conversation"], classroom: ["Classroom", "A place to learn and respond"], meeting: ["Meeting room", "A shared decision"], shop: ["Retail floor", "A practical negotiation"], service: ["Service desk", "A problem to resolve"], conference: ["Conference room", "A group perspective"], stage: ["Presentation stage", "An audience is listening"], boardroom: ["Boardroom", "Decisions with stakes"], cafe: ["Cafe", "A natural conversation"], studio: ["Practice studio", "A situation in motion"] };

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
function titleCase(value = "") { return String(value).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { try { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); } catch { return "Recently"; } }
function notify(message, kind = "info", duration = 3400) {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  refs.toast.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}
function setLoading(show, title = "Preparing your experience", subtitle = "Building the scene and characters…") {
  $("#loadingTitle").textContent = title;
  $("#loadingSubtitle").textContent = subtitle;
  refs.globalLoading.classList.toggle("hidden", !show);
}
function setBusy(busy) {
  state.busy = busy;
  refs.send.disabled = busy;
  refs.response.disabled = busy;
  refs.send.querySelector("span").textContent = busy ? "Thinking…" : "Send response";
  $("#simStatus").textContent = busy ? "DIRECTING SCENE" : state.session?.status === "paused" ? "PAUSED" : "LIVE SESSION";
}
function showDiscoveryView(view = "discover") {
  state.nav = view;
  refs.discovery.classList.toggle("hidden", view !== "discover");
  refs.history.classList.toggle("hidden", view !== "history");
  refs.custom.classList.toggle("hidden", view !== "custom");
  refs.appShell.classList.remove("hidden");
  refs.simulation.classList.add("hidden");
  refs.results.classList.add("hidden");
  $$("[data-nav]").forEach((button) => button.classList.toggle("is-active", button.dataset.nav === view));
  if (view === "history") renderHistory();
  if (view === "custom") renderCustomScenarios();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showSimulationView() {
  refs.appShell.classList.add("hidden");
  refs.results.classList.add("hidden");
  refs.simulation.classList.remove("hidden");
  refs.simulation.setAttribute("aria-hidden", "false");
  refs.response.focus({ preventScroll: true });
}
function showResultsView() {
  refs.simulation.classList.add("hidden");
  refs.appShell.classList.add("hidden");
  refs.results.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderScenarioCard(scenario, index = 0, custom = false) {
  const [a, b, glow] = CARD_COLORS[scenario.category] || CARD_COLORS.custom;
  const category = CATEGORIES[scenario.category]?.label || "Your scenario";
  const skills = (scenario.skills || ["Communication", "Adaptability"]).slice(0, 2).map((skill) => `<span>${escapeHTML(skill)}</span>`).join("");
  const duration = escapeHTML(scenario.duration || "Custom");
  return `<article class="scenario-card" role="button" tabindex="0" data-scenario-id="${escapeHTML(scenario.id)}" style="--card-a:${a};--card-b:${b};--card-glow:${glow}" aria-label="Start ${escapeHTML(scenario.title)}">
    <div class="card-art"><span class="card-art-label">${escapeHTML(category.toUpperCase())}</span><span class="card-art-glyph">${GLYPHS[scenario.category] || "✦"}</span><span class="card-art-index">${String(index + 1).padStart(2, "0")}</span></div>
    <div class="card-content"><div class="card-meta"><span>${duration}</span><span class="difficulty-tag">${escapeHTML(titleCase(scenario.difficulty || "adaptive"))}</span></div><h3>${escapeHTML(scenario.title)}</h3><p>${escapeHTML(scenario.description || "A custom situation shaped around your goals.")}</p><div class="card-bottom"><div class="skill-chips">${skills}</div><span class="card-enter" aria-hidden="true">↗</span></div></div>
  </article>`;
}
function renderFeatured() {
  const featured = SCENARIOS.find((scenario) => scenario.featured) || SCENARIOS[0];
  if (!featured) return;
  refs.featured.innerHTML = `<article class="featured-card"><div class="featured-copy"><span class="featured-tag">✦ FEATURED EXPERIENCE</span><h3>${escapeHTML(featured.title)}</h3><p>${escapeHTML(featured.description)} Step into the moment and let the conversation unfold around your choices.</p><div class="featured-meta"><span>◷ ${escapeHTML(featured.duration)}</span><span>◈ ${escapeHTML(titleCase(featured.difficulty))}</span><span>◎ Adaptive characters</span></div><button class="featured-action" data-featured-id="${escapeHTML(featured.id)}">Enter this experience ↗</button></div><div class="featured-art"><div class="featured-emblem">${GLYPHS[featured.category] || "✦"}</div></div></article>`;
}
function renderLibrary() {
  const filtered = searchScenarios(state.query, state.category);
  refs.libraryTitle.textContent = state.category === "all" ? "Explore all experiences" : `Explore ${CATEGORIES[state.category]?.label || "experiences"}`;
  refs.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "experience" : "experiences"}`;
  refs.categoryTabs.querySelectorAll("[data-category]").forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  refs.scenarioGrid.innerHTML = filtered.map((scenario, index) => renderScenarioCard(scenario, index)).join("");
  refs.empty.classList.toggle("hidden", filtered.length > 0);
}
function renderRecent() {
  state.history = getHistory();
  $("#historyCount").textContent = String(state.history.length);
  const recent = state.history.slice(0, 3);
  if (!recent.length) { refs.recent.innerHTML = `<div class="recent-empty">Your next experience is waiting. Start one to see it here.</div>`; return; }
  refs.recent.innerHTML = recent.map((item) => `<div class="recent-card"><span class="recent-icon">${GLYPHS[item.category] || "✦"}</span><div class="recent-copy"><strong>${escapeHTML(item.title)}</strong><small>${item.status === "completed" ? `Completed · ${item.score !== null ? `${item.score}/100` : "Debrief available"}` : "In progress"} · ${formatDate(item.updatedAt)}</small></div><button class="recent-open" data-resume="${escapeHTML(item.id)}" aria-label="Open ${escapeHTML(item.title)}">↗</button></div>`).join("");
}
function setCategory(category) {
  if (!Object.hasOwn(CATEGORIES, category)) return;
  state.category = category;
  renderLibrary();
  $$("[data-category]", $("#sidebarCategories")).forEach((button) => button.classList.toggle("is-active", button.dataset.category === category));
}
function openSetup(scenario, prepared = false) {
  state.pendingScenario = scenario;
  state.pendingPrepared = prepared;
  state.pendingContext = "";
  $("#setupPreview").innerHTML = `<strong>${escapeHTML(scenario.title)}</strong><p>${escapeHTML(scenario.description || scenario.settingDetails || "Your AI-generated experience is ready to configure.")}</p>`;
  $("#setupMode").value = "training";
  $("#setupDifficulty").value = scenario.difficulty === "adaptive" ? "intermediate" : scenario.difficulty || "intermediate";
  $("#setupPressure").value = "balanced";
  $("#setupLanguage").value = "English";
  $("#contextFile").value = "";
  $("#uploadName").textContent = "Text is extracted locally in your browser.";
  $("#timeLimitField").classList.add("hidden");
  refs.setupDialog.showModal();
}
function readContextFile(file, maxChars = 24000) {
  if (!file) return Promise.resolve("");
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["txt", "md", "csv", "json"].includes(ext)) return Promise.reject(new Error("Choose a TXT, Markdown, CSV or JSON reference file."));
  if (file.size > 150000) return Promise.reject(new Error("Keep reference files below 150 KB for this simulator build."));
  return file.text().then((text) => String(text).slice(0, maxChars));
}
async function startPendingScenario() {
  if (!state.pendingScenario || state.busy) return;
  const options = readSetupOptions();
  const contextFile = $("#contextFile").files[0];
  try {
    state.pendingContext = contextFile ? await readContextFile(contextFile) : state.pendingContext;
  } catch (error) { notify(error.message, "error"); return; }
  refs.setupDialog.close();
  setLoading(true, "Preparing the environment", "Creating characters, objectives and an evolving situation…");
  try {
    const prepared = state.pendingPrepared
      ? state.pendingScenario
      : await engine.prepareScenario(state.pendingScenario, { ...options, context: state.pendingContext });
    const scenario = { ...prepared, category: prepared.category || state.pendingScenario.category || "custom" };
    state.session = engine.startSession(scenario, { ...options, context: state.pendingContext });
    state.remainingSeconds = Number(state.session.timeLimit) || 0;
    state.activeCharacterId = scenario.openingCharacterId || scenario.characters?.[0]?.id;
    state.pendingScenario = null; state.pendingPrepared = false;
    await persistSession();
    setLoading(false);
    showSimulationView();
    renderSimulation();
    startTimerIfNeeded();
  } catch (error) {
    setLoading(false);
    notify(error.message, "error", 5200);
  }
}
function readSetupOptions() {
  const mode = $("#setupMode").value;
  return {
    mode,
    difficulty: $("#setupDifficulty").value,
    pressure: $("#setupPressure").value,
    language: $("#setupLanguage").value,
    timeLimit: mode === "timed" ? Number($("#setupTimeLimit").value) : 0
  };
}
function renderSimulation() {
  const session = state.session;
  if (!session) return;
  const scenario = session.scenario;
  $("#simTitle").textContent = scenario.title;
  initVoice();
  $("#simCategory").textContent = (CATEGORIES[scenario.category]?.label || "CUSTOM EXPERIENCE").toUpperCase();
  $("#sceneLabel").textContent = ENV_LABELS[scenario.environment]?.[0] || "Practice studio";
  $("#sceneSubLabel").textContent = ENV_LABELS[scenario.environment]?.[1] || "A situation in motion";
  $("#modeLabel").textContent = titleCase(session.mode) + " mode";
  $("#difficultyLabel").textContent = `${titleCase(session.difficulty)} · ${titleCase(session.pressure)} pressure`;
  $("#scenarioObjectiveText").textContent = scenario.stakes || scenario.description || "Stay present and navigate the situation.";
  $("#characterCount").textContent = String(session.characters.length).padStart(2, "0");
  renderEnvironment(refs.sceneRoot, scenario, session);
  setSceneMood(refs.sceneRoot, session.scene.mood);
  renderCharacters();
  renderObjectives();
  renderDialogue();
  renderEvents();
  renderSessionInsights();
  renderDecisionBoard();
  renderCharacterDynamics();
  renderWorldState();
  renderBranchTimeline();
  renderSuggestions([]);
  updateTimerLabel();
}
function renderCharacters() {
  const session = state.session;
  if (!session) return;
  if (!session.characters.some((character) => character.id === state.activeCharacterId)) state.activeCharacterId = session.characters[0]?.id || null;
  refs.characterPanel.innerHTML = session.characters.map((character) => `<button class="character-item ${character.id === state.activeCharacterId ? "is-active" : ""}" data-character-id="${escapeHTML(character.id)}" aria-pressed="${character.id === state.activeCharacterId}">${renderAvatar(character, character.id === state.activeCharacterId)}<span class="character-copy"><strong>${escapeHTML(character.name)}</strong><small>${escapeHTML(character.role)}</small></span><i class="character-dot" data-mood="${escapeHTML(character.mood || "neutral")}"></i></button>`).join("");
  renderCharacterDynamics();
}
function renderObjectives() {
  const session = state.session;
  if (!session) return;
  const completed = session.objectives.filter((item) => item.status === "completed").length;
  $("#objectiveCounter").textContent = `${completed}/${session.objectives.length}`;
  refs.objectives.innerHTML = session.objectives.map((objective) => `<div class="objective-item ${objective.status === "completed" ? "is-done" : ""}"><i class="objective-check"></i><span>${escapeHTML(objective.text)}</span></div>`).join("");
}
function renderDialogue() {
  const session = state.session;
  if (!session) return;
  refs.dialogue.innerHTML = session.messages.map((message) => {
    const character = session.characters.find((item) => item.id === message.characterId) || session.characters[0];
    const name = message.role === "user" ? "You" : character?.name || "AI character";
    const avatar = message.role === "user" ? `<div class="avatar-portrait"><svg viewBox="0 0 90 90" aria-hidden="true"><defs><linearGradient id="youGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#86b9bd"/><stop offset="1" stop-color="#344f68"/></linearGradient></defs><rect width="90" height="90" rx="25" fill="url(#youGrad)"/><circle cx="45" cy="33" r="16" fill="#d6a27e"/><path d="M17 89 Q19 54 45 54 Q71 54 73 89" fill="#1b3447"/><path d="M29 31 Q27 11 48 12 Q66 14 62 35 Q55 23 44 24 Q35 25 29 31" fill="#222a35"/></svg></div>` : renderAvatar(character, true);
    return `<article class="dialogue-entry ${message.role === "user" ? "user-entry" : "character-entry"}">${avatar}<div class="dialogue-content"><div class="dialogue-name">${escapeHTML(name)}</div><div class="dialogue-bubble">${escapeHTML(message.text)}</div><div class="dialogue-meta">${message.role === "user" ? "YOUR RESPONSE" : escapeHTML(titleCase(message.emotion || "in character"))} · ${formatDate(message.createdAt)}</div></div></article>`;
  }).join("");
  refs.dialogue.scrollTop = refs.dialogue.scrollHeight;
  const lastAI = [...session.messages].reverse().find((message) => message.role === "character");
  state.lastCharacterLine = lastAI?.text || "";
  $("#replayLastButton").disabled = !state.lastCharacterLine;
  $("#turnCount").textContent = `TURN ${String(Math.max(1, session.turnCount + 1)).padStart(2, "0")}`;
}
function renderEvents() {
  const session = state.session;
  if (!session) return;
  refs.events.innerHTML = session.events.slice(-3).map((event) => `<div class="event-banner ${event.severity === "warning" ? "warning" : event.severity === "success" ? "success" : ""}"><span class="event-symbol">${event.severity === "warning" ? "!" : event.severity === "success" ? "✓" : "✦"}</span><div><strong>${escapeHTML(event.title)}</strong><p>${escapeHTML(event.description)}</p></div></div>`).join("");
  $("#eventCount").textContent = String(session.events.length);
  $("#eventLog").innerHTML = session.events.length ? session.events.slice(-5).reverse().map((event) => `<div class="logged-event"><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.description)}</small></div>`).join("") : `<div class="quiet-event">The situation will unfold as you interact.</div>`;
}
function renderSessionInsights() {
  const session = state.session;
  if (!session) return;
  const { scene } = session;
  $("#simProgressBar").style.width = `${Math.max(5, Math.min(100, scene.progress))}%`;
  $("#tensionBar").style.width = `${scene.tension}%`;
  $("#sceneEnergy").textContent = scene.tension > 72 ? "High pressure" : scene.tension > 48 ? "Building" : scene.tension < 25 ? "Calm" : "Steady";
  $("#conversationStage").textContent = titleCase(scene.stage || "Opening");
  $("#trackerMeterFill").style.width = `${scene.tension}%`;
  $("#activeBeatLabel").textContent = session.activeBeat || titleCase(scene.stage || "Opening moment");
  $("#sceneCaption").textContent = scene.caption || session.scenario.sceneDesign?.visualFocus || session.scenario.settingDetails || session.scenario.description || "A situation shaped by your choices.";
}
function renderDecisionBoard() {
  const board = $("#decisionBoard");
  const target = $("#decisionOptions");
  if (!board || !target || !state.session) return;
  const options = (state.session.decisionOptions || []).slice(0, 3);
  board.classList.toggle("hidden", options.length === 0 || state.session.status !== "active");
  target.innerHTML = options.map((option, index) => `<button class="decision-option" type="button" data-decision-prompt="${escapeHTML(option.prompt)}"><span class="decision-index">0${index + 1}</span><span class="decision-copy"><strong>${escapeHTML(option.label)}</strong>${option.lens ? `<small>${escapeHTML(option.lens)}</small>` : ""}</span><span class="decision-arrow">↗</span></button>`).join("");
}
function renderCharacterDynamics() {
  const target = $("#characterDynamics");
  const session = state.session;
  if (!target || !session) return;
  const character = session.characters.find((item) => item.id === state.activeCharacterId) || session.characters[0];
  if (!character) { target.innerHTML = `<div class="quiet-event">No active character.</div>`; return; }
  const mood = titleCase(character.mood || "neutral");
  const rapport = Math.max(0, Math.min(100, Number(character.rapport) || 0));
  const pressure = Math.max(0, Math.min(100, Number(character.pressure) || 0));
  const relation = session.relationships?.find((item) => item.from === character.id || item.to === character.id);
  target.innerHTML = `<div class="dynamic-character-head">${renderAvatar(character, true)}<div><strong>${escapeHTML(character.name)}</strong><small>${escapeHTML(mood)} · ${escapeHTML(character.style || character.role || "In the scene")}</small></div></div><div class="dynamic-meter"><div><span>Rapport</span><strong>${rapport}</strong></div><i><b style="width:${rapport}%"></b></i></div><div class="dynamic-meter pressure-meter"><div><span>Character pressure</span><strong>${pressure}</strong></div><i><b style="width:${pressure}%"></b></i></div>${relation?.dynamic ? `<p class="dynamic-note">${escapeHTML(relation.dynamic)}</p>` : `<p class="dynamic-note">${escapeHTML(character.lastReaction || "Their response will evolve as the situation develops.")}</p>`}`;
}
function renderWorldState() {
  const target = $("#worldStatePanel");
  const session = state.session;
  if (!target || !session) return;
  const entries = Object.entries(session.worldState || {}).slice(-5);
  const facts = (session.worldFacts || []).slice(-2);
  target.innerHTML = entries.length ? entries.map(([key, item]) => `<div class="world-state-item"><span>${escapeHTML(item.label || titleCase(key))}</span><strong>${escapeHTML(item.value || "—")}</strong>${item.detail ? `<small>${escapeHTML(item.detail)}</small>` : ""}</div>`).join("") : facts.length ? facts.map((fact) => `<div class="world-state-item"><span>Established fact</span><strong>${escapeHTML(fact)}</strong></div>`).join("") : `<div class="quiet-event">Relevant facts and resources appear as the situation develops.</div>`;
}
function renderBranchTimeline() {
  const target = $("#branchTimeline");
  const session = state.session;
  if (!target || !session) return;
  const branches = (session.branchHistory || []).slice(-4).reverse();
  $("#branchCount").textContent = String((session.branchHistory || []).length);
  const pathMarkup = branches.length ? branches.map((branch) => `<div class="branch-item"><i></i><div><strong>${escapeHTML(branch.label)}</strong><small>${escapeHTML(branch.description || "The situation shifted based on your decision.")}</small></div></div>`).join("") : `<div class="quiet-event">Your decisions will shape this path.</div>`;
  const replayPoint = (session.branchPoints || []).slice(-1)[0];
  target.innerHTML = `${pathMarkup}${replayPoint && session.status === "active" ? `<button class="branch-replay-button" type="button" data-replay-point="${escapeHTML(replayPoint.id)}">↶ Replay from turn ${replayPoint.turn}</button>` : ""}${session.branchOrigin ? `<div class="branch-origin-note">Branch replay · based on turn ${Number(session.branchOrigin.turn) || 1}</div>` : ""}`;
}
function renderSuggestions(suggestions = []) {
  refs.suggestions.innerHTML = suggestions.slice(0, 3).map((suggestion) => `<button type="button" class="suggestion-chip" data-suggestion="${escapeHTML(suggestion)}">${escapeHTML(suggestion)}</button>`).join("");
}
function addTyping() {
  const item = document.createElement("div");
  item.className = "dialogue-entry character-entry";
  item.id = "typingIndicator";
  item.innerHTML = `<div class="avatar-portrait"><span class="avatar-initial">✦</span></div><div class="dialogue-content"><div class="dialogue-name">Thinking through the situation</div><div class="dialogue-bubble"><span class="typing-indicator"><i></i><i></i><i></i></span></div></div>`;
  refs.dialogue.append(item);
  refs.dialogue.scrollTop = refs.dialogue.scrollHeight;
}
async function submitResponse(text = refs.response.value) {
  const clean = String(text || "").trim();
  if (!clean || !state.session || state.busy || state.session.status !== "active") return;
  state.voice?.stop();
  refs.response.value = "";
  updateResponseCount();
  setBusy(true);
  addTyping();
  renderSuggestions([]);
  try {
      state.session = await engine.sendTurn(state.session, clean);
    const latest = state.session.messages[state.session.messages.length - 1];
    state.activeCharacterId = latest.characterId || state.activeCharacterId;
    const resultEventCount = state.session.events.length;
    $("#typingIndicator")?.remove();
    renderDialogue(); renderCharacters(); renderObjectives(); renderEvents(); renderSessionInsights();
    renderEnvironment(refs.sceneRoot, state.session.scenario, state.session);
    renderDecisionBoard(); renderCharacterDynamics(); renderWorldState(); renderBranchTimeline();
    const lastEvent = state.session.events[resultEventCount - 1];
    if (lastEvent) flashScene(refs.sceneRoot, lastEvent.severity);
    setSceneMood(refs.sceneRoot, state.session.scene.mood);
    renderSuggestions(state.session.mode === "challenge" || state.session.mode === "expert" ? [] : (state.session.suggestedActions || []));
    if (state.voiceOutputEnabled) {
      const recentReplies = state.session.messages.slice(-3).filter((message) => message.role === "character");
      const spoken = recentReplies.map((message) => `${state.session.characters.find((item) => item.id === message.characterId)?.name || "Character"}: ${message.text}`).join(" ");
      state.voice?.speak(spoken, { language: voiceLocale(state.session.language) });
    }
    await persistSession();
    if (state.session.status === "completed") { stopTimer(); notify("The scenario reached a resolution.", "success"); await finishSession(true); }
  } catch (error) {
    $("#typingIndicator")?.remove();
    refs.response.value = clean;
    updateResponseCount();
    notify(error.message, "error", 5500);
  } finally { setBusy(false); }
}
function updateResponseCount() { $("#responseCount").textContent = `${refs.response.value.length} / 5000`; }
async function finishSession(alreadyCompleted = false) {
  if (!state.session || (state.busy && !alreadyCompleted)) return;
  stopTimer(); state.voice?.stop(); state.voice?.stopSpeaking();
  state.session.status = "completed";
  if (!state.session.messages.some((message) => message.role === "user")) {
    state.session.evaluation = null;
    state.session.summary = "No response was submitted, so there is not enough interaction evidence to generate a performance evaluation.";
    await persistSession();
    renderResultsUnavailable();
    return;
  }
  await persistSession();
  showResultsView();
  renderResultsLoading();
  setLoading(false);
  try {
    const evaluation = await engine.evaluate(state.session);
    state.session.evaluation = normaliseEvaluation(evaluation, state.session);
    state.session.summary = evaluation.outcome || state.session.summary;
    await persistSession();
    renderResults(state.session.evaluation);
  } catch (error) {
    renderResultsError(error);
  }
}
function renderResultsLoading() {
  $("#resultsContent").innerHTML = `<div class="results-loading"><div class="loading-orbit"></div><div class="section-kicker">REFLECTING ON YOUR EXPERIENCE</div><h1>Finding the moments<br><em>that mattered.</em></h1><p>Reviewing your choices, the conversation and what changed.</p></div>`;
}
function renderResultsUnavailable() {
  showResultsView();
  $("#resultsContent").innerHTML = `<div class="results-error"><div class="section-kicker">EXPERIENCE SAVED</div><h2>There wasn't enough interaction to evaluate.</h2><p>${escapeHTML(state.session?.summary || "You can return to the library and start a new experience.")}</p><div class="result-actions"><button class="primary-button" id="resultsRestartButton">Try the scenario again ↗</button><button class="secondary-button" id="resultsToHomeButton">Back to discovery</button></div></div>`;
}
function renderResultsError(error) {
  $("#resultsContent").innerHTML = `<div class="results-error"><div class="section-kicker">EXPERIENCE SAVED · DEBRIEF UNAVAILABLE</div><h2>Your conversation is safe.</h2><p>The AI evaluation could not be completed: ${escapeHTML(error.message)}. Nothing was scored because a verified evaluation was not returned.</p><div class="result-actions"><button class="primary-button" id="retryEvaluationButton">Retry evaluation ↗</button><button class="secondary-button" id="resultsToHomeButton">Back to discovery</button></div></div>`;
}
function renderResults(evaluation) {
  const session = state.session;
  const dimensions = evaluation.dimensions.map((dimension) => `<div class="dimension-row"><span>${escapeHTML(dimension.name)}</span><div class="dimension-track"><i style="width:${dimension.score}%"></i></div><strong>${dimension.score}</strong></div>`).join("");
  const strengths = evaluation.strengths.length ? evaluation.strengths.map((item) => `<li>${escapeHTML(item)}</li>`).join("") : `<li>The AI did not identify a sufficiently evidenced strength.</li>`;
  const improvements = evaluation.improvements.length ? evaluation.improvements.map((item) => `<li>${escapeHTML(item)}</li>`).join("") : `<li>No additional improvement points were returned.</li>`;
  const moments = evaluation.keyMoments.length ? evaluation.keyMoments.map((item) => `<div class="moment-card"><strong>${escapeHTML(item.moment)}</strong><p>${escapeHTML(item.evidence)}</p><small>Impact: ${escapeHTML(item.impact)}</small>${item.alternative ? `<p>Alternative: ${escapeHTML(item.alternative)}</p>` : ""}</div>`).join("") : `<p class="quiet-event">There were not enough distinct moments to highlight.</p>`;
  const plan = evaluation.repeatPlan.length ? evaluation.repeatPlan.map((item) => `<li>${escapeHTML(item)}</li>`).join("") : `<li>Repeat the scenario and focus on the feedback above.</li>`;
  $("#resultsContent").innerHTML = `
    <section class="results-hero"><div class="section-kicker">THE DEBRIEF · ${escapeHTML(titleCase(session.mode))} MODE</div><h1>${escapeHTML(session.scenario.title)}</h1><p>${escapeHTML(evaluation.outcome)}</p></section>
    <section class="score-panel"><div class="score-orb"><strong>${evaluation.overallScore}</strong><small>OUT OF 100</small></div><div class="score-summary"><span class="score-label">${escapeHTML(evaluation.label.toUpperCase())}</span><h2>Here's what your experience revealed.</h2><p>${escapeHTML(evaluation.summary)}</p></div></section>
    <div class="results-grid"><section class="result-card"><h3>Skill breakdown</h3>${dimensions || `<p class="quiet-event">No skill dimensions were returned.</p>`}</section><section class="result-card"><h3>What went well</h3><ul class="result-list">${strengths}</ul></section><section class="result-card"><h3>Where to improve</h3><ul class="result-list">${improvements}</ul></section><section class="result-card"><h3>Moments that mattered</h3>${moments}</section><section class="result-card"><h3>Your next practice steps</h3><ul class="result-list">${plan}</ul></section><section class="result-card"><h3>About this assessment</h3><p class="quiet-event">Assessment confidence: ${escapeHTML(evaluation.confidence)}. Evidence coverage: ${escapeHTML(evaluation.evidenceCoverage)}. Scores are AI-generated estimates based on the conversation text, not validated psychological or professional measurements.</p></section></div>
    <div class="result-actions"><button class="primary-button" id="resultsReplayButton">Replay this scenario ↗</button><button class="secondary-button" id="exportReportButton">Export debrief ↓</button><button class="secondary-button" id="shareDebriefButton">Share summary ↗</button><button class="secondary-button" id="resultsToHomeButton">Explore more</button></div>
    <p class="confidence-note">AI-generated practice feedback · Use your judgement when applying it in real situations.</p>`;
}
async function shareDebrief() {
  if (!state.session?.evaluation) return;
  const evaluation = state.session.evaluation;
  const shareText = `ArixAI Reality Simulator — ${state.session.scenario.title}\nScore: ${evaluation.overallScore}/100 (${evaluation.label})\n${evaluation.summary}\n\nPractise, reflect and try again.`;
  try {
    if (navigator.share) await navigator.share({ title: `Reality Simulator · ${state.session.scenario.title}`, text: shareText });
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(shareText); notify("Debrief summary copied. Share it wherever you like.", "success"); }
    else { exportTextFile(`${slugify(state.session.scenario.title)}-share.txt`, shareText); }
  } catch (error) { if (error.name !== "AbortError") notify("The share action was not available. You can export the debrief instead.", "info"); }
}

async function retryEvaluation() {
  if (!state.session) return;
  renderResultsLoading();
  try {
    const evaluation = await engine.evaluate(state.session);
    state.session.evaluation = normaliseEvaluation(evaluation, state.session);
    await persistSession();
    renderResults(state.session.evaluation);
  } catch (error) { renderResultsError(error); }
}
async function resumeSession(id) {
  const saved = await getSession(id);
  if (!saved) { notify("That saved session could not be found on this device.", "error"); return; }
  try { state.session = restoreSession(saved); }
  catch (error) { notify(error.message, "error"); return; }
  if (state.session.status === "completed" && state.session.evaluation) {
    state.activeCharacterId = state.session.characters[0]?.id;
    showResultsView(); renderResults(state.session.evaluation); return;
  }
  state.session.status = "active";
  state.activeCharacterId = state.session.characters[0]?.id;
  showSimulationView(); renderSimulation(); startTimerIfNeeded();
  notify("Your saved scene is ready to continue.", "success");
}
async function renderHistory() {
  const sessions = await listSessions();
  const history = getHistory();
  const completed = history.filter((item) => item.status === "completed");
  const avg = completed.filter((item) => Number.isFinite(item.score)).map((item) => item.score);
  const averageScore = avg.length ? Math.round(avg.reduce((a, b) => a + b, 0) / avg.length) : "—";
  $("#historySummary").innerHTML = `<div class="summary-tile"><small>Total sessions</small><strong>${history.length}</strong></div><div class="summary-tile"><small>Completed</small><strong>${completed.length}</strong></div><div class="summary-tile"><small>Average score</small><strong>${averageScore}${averageScore === "—" ? "" : "/100"}</strong></div><div class="summary-tile"><small>Saved on this device</small><strong>${sessions.length}</strong></div>`;
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const combined = history.map((item) => ({ ...item, full: sessionMap.get(item.id) })).filter((item) => item.full);
  $("#historyList").innerHTML = combined.length ? combined.map((item) => `<div class="history-item"><span class="recent-icon">${GLYPHS[item.category] || "✦"}</span><div class="history-item-main"><strong>${escapeHTML(item.title)}</strong><small>${formatDate(item.updatedAt)} · ${item.turnCount || 0} user turns · ${escapeHTML(titleCase(item.mode || "training"))} · ${item.status === "completed" ? "Completed" : "In progress"}</small></div><div class="history-score">${Number.isFinite(item.score) ? item.score : "—"}</div><button class="history-action" data-resume="${escapeHTML(item.id)}">${item.status === "completed" ? "Review" : "Continue"}</button><button class="history-action" data-delete-session="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.title)}">×</button></div>`).join("") : `<div class="history-empty">No saved simulations yet. Start an experience and your sessions will appear here.</div>`;
}
function renderCustomScenarios() {
  const scenarios = getCustomScenarios();
  $("#customCount").textContent = `${scenarios.length} saved`;
  $("#customScenarioGrid").innerHTML = scenarios.length ? scenarios.map((scenario, index) => `<div class="custom-scenario-tile">${renderScenarioCard(scenario, index, true)}<div class="custom-card-actions"><button class="text-button" data-edit-scenario="${escapeHTML(scenario.id)}">Edit</button><button class="text-button" data-duplicate-scenario="${escapeHTML(scenario.id)}">Duplicate</button><button class="text-button" data-export-scenario="${escapeHTML(scenario.id)}">Export</button><button class="text-button" data-delete-scenario="${escapeHTML(scenario.id)}">Delete</button></div></div>`).join("") : `<div class="history-empty">Your custom scenarios will live here. Build one around a real situation you want to practise.</div>`;
}
function startTimerIfNeeded() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  const session = state.session;
  if (!session || session.mode !== "timed" || !session.timeLimit) { $("#timerBlock").classList.add("hidden"); return; }
  $("#timerBlock").classList.remove("hidden");
  state.remainingSeconds = Math.max(0, session.timeLimit - (Number(session.timerElapsed) || 0));
  updateTimerLabel();
  state.timer = window.setInterval(() => {
    if (!state.session || state.session.status !== "active") return;
    state.remainingSeconds -= 1;
    updateTimerLabel();
    if (state.remainingSeconds <= 0) { stopTimer(); notify("Time is up. Your scene is being wrapped up.", "info"); finishSession(); }
  }, 1000);
}
function stopTimer() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  if (state.session?.mode === "timed" && Number.isFinite(state.remainingSeconds)) state.session.timerElapsed = Math.max(0, Math.min(state.session.timeLimit, state.session.timeLimit - state.remainingSeconds));
}
async function persistSession() {
  if (!state.session) return { saved: false, storage: "none" };
  if (state.session.mode === "timed" && Number.isFinite(state.remainingSeconds)) {
    state.session.timerElapsed = Math.max(0, Math.min(state.session.timeLimit, state.session.timeLimit - state.remainingSeconds));
  }
  return saveSession(state.session);
}
function updateTimerLabel() {
  if (!state.session || state.session.mode !== "timed") return;
  const seconds = Math.max(0, state.remainingSeconds);
  $("#timerValue").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function pauseSimulation() {
  if (!state.session || state.session.status !== "active") return;
  stopTimer(); state.session.status = "paused"; persistSession();
  $("#pauseOverlay").classList.remove("hidden");
  $("#simStatus").textContent = "PAUSED";
  $(".sim-live-status").classList.add("paused");
}
function resumeSimulation() {
  if (!state.session) return;
  state.session.status = "active";
  $("#pauseOverlay").classList.add("hidden");
  $("#simStatus").textContent = "LIVE SESSION";
  $(".sim-live-status").classList.remove("paused");
  startTimerIfNeeded();
}
async function saveAndLeave() {
  if (!state.session) return;
  stopTimer(); state.session.status = "paused";
  await persistSession();
  state.voice?.destroy();
  state.session = null;
  showDiscoveryView("discover"); renderRecent();
  notify("Your progress has been saved on this device.", "success");
}
async function restartCurrentScenario() {
  if (!state.session) return;
  if (!window.confirm("Restart this experience? The current attempt remains in your local history.")) return;
  const previous = state.session;
  previous.status = "abandoned"; await saveSession(previous);
  const scenario = previous.scenario;
  const options = { mode: previous.mode, difficulty: previous.difficulty, pressure: previous.pressure, language: previous.language, timeLimit: previous.timeLimit, context: previous.context };
  state.session = engine.startSession(scenario, options);
  state.remainingSeconds = previous.timeLimit;
  state.activeCharacterId = scenario.openingCharacterId || scenario.characters?.[0]?.id;
  renderSimulation(); startTimerIfNeeded();
  await persistSession();
}
function voiceLocale(language) { return ({ English: "en-IN", Hindi: "hi-IN", Gujarati: "gu-IN", Hinglish: "en-IN", Spanish: "es-ES", French: "fr-FR", German: "de-DE", Japanese: "ja-JP" })[language] || "en-IN"; }
function initVoice() {
  state.voice?.destroy();
  const lang = voiceLocale(state.session?.language);
  state.voice = new RealityVoice({ language: lang,
    onTranscript: (transcript) => { refs.response.value = [refs.response.value.trim(), transcript].filter(Boolean).join(" "); updateResponseCount(); refs.response.focus(); },
    onState: (mode, detail) => {
      const mic = $("#micButton");
      mic.classList.toggle("is-listening", mode === "listening" || mode === "transcribing");
      mic.querySelector("span").textContent = mode === "listening" ? "Listening…" : "Voice";
      if (mode === "unsupported" || mode === "error") notify(detail || "Voice input is unavailable. You can type instead.", "info");
    }
  });
}
function createCustomFlow() {
  const prompt = $("#customPrompt").value.trim();
  if (prompt.length < 12) { notify("Describe the situation in a little more detail (at least 12 characters).", "error"); return; }
  const file = $("#customContextFile").files[0];
  const button = $("#generateScenarioButton");
  button.disabled = true;
  button.textContent = "Building…";
  setLoading(true, "Building your situation", "Designing the scene, character motives and evaluation criteria…");
  readContextFile(file).then(async (context) => {
    const scenario = await engine.createCustomScenario(prompt, context, { language: "English" });
    scenario.sourcePrompt = prompt;
    if (state.editingScenarioId) scenario.id = state.editingScenarioId;
    state.pendingScenario = scenario;
    state.pendingPrepared = true;
    state.pendingContext = context;
    state.pendingPrompt = prompt;
    saveCustomScenario(scenario);
    state.editingScenarioId = null;
    refs.createDialog.close();
    $("#customPrompt").value = ""; $("#customContextFile").value = ""; updateCustomPromptCount();
    openSetup(scenario, true);
    state.pendingContext = context;
    setLoading(false);
  }).catch((error) => {
    setLoading(false);
    notify(error.message, "error", 5500);
  }).finally(() => { button.disabled = false; button.innerHTML = "Build my scenario <span>✦</span>"; });
}
function exportTextFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadScenario(id) {
  const scenario = getCustomScenarios().find((item) => item.id === id);
  if (!scenario) return;
  exportTextFile(`${slugify(scenario.title)}.json`, JSON.stringify(scenario, null, 2), "application/json");
}
function slugify(value) { return String(value || "reality-scenario").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "reality-scenario"; }
function duplicateCustomScenario(id) {
  const original = getCustomScenarios().find((item) => item.id === id);
  if (!original) return;
  const copy = { ...original, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: `${original.title} (copy)`, createdAt: new Date().toISOString() };
  saveCustomScenario(copy); renderCustomScenarios(); notify("Scenario duplicated.", "success");
}
function editCustomScenario(id) {
  const scenario = getCustomScenarios().find((item) => item.id === id);
  if (!scenario) return;
  state.editingScenarioId = id;
  $("#customPrompt").value = scenario.sourcePrompt || `${scenario.title}. ${scenario.description || ""} Recreate this scenario with improved detail while preserving its intent.`;
  updateCustomPromptCount();
  $("#generateScenarioButton").innerHTML = "Update scenario <span>✦</span>";
  refs.createDialog.showModal();
}
async function importCustomScenario(file) {
  if (!file) return;
  try {
    if (file.size > 100000) throw new Error("Scenario JSON must be smaller than 100 KB.");
    const parsed = JSON.parse(await file.text());
    const scenario = parsed.scenario && typeof parsed.scenario === "object" ? parsed.scenario : parsed;
    if (!scenario.title || !Array.isArray(scenario.characters) || !scenario.characters.length || !Array.isArray(scenario.objectives)) throw new Error("This file does not contain a valid Reality Simulator scenario.");
    const safe = { ...scenario, id: `imported-${Date.now()}`, category: scenario.category || "custom", environment: scenario.environment || "studio", difficulty: scenario.difficulty || "adaptive" };
    saveCustomScenario(safe); renderCustomScenarios(); notify("Scenario imported and saved on this device.", "success");
  } catch (error) { notify(error.message || "Could not import this scenario file.", "error"); }
  finally { $("#importScenarioInput").value = ""; }
}

function bindEvents() {
  refs.search.addEventListener("input", () => { state.query = refs.search.value; renderLibrary(); });
  refs.categoryTabs.addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (button) setCategory(button.dataset.category); });
  $("#sidebarCategories").addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (!button) return; showDiscoveryView("discover"); setCategory(button.dataset.category); $("#experienceLibrary").scrollIntoView({ behavior: "smooth" }); });
  refs.scenarioGrid.addEventListener("click", (event) => { const card = event.target.closest("[data-scenario-id]"); if (!card) return; const scenario = SCENARIOS.find((item) => item.id === card.dataset.scenarioId) || getCustomScenarios().find((item) => item.id === card.dataset.scenarioId); if (scenario) openSetup(scenario); });
  refs.scenarioGrid.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { const card = event.target.closest("[data-scenario-id]"); if (card) { event.preventDefault(); card.click(); } } });
  $("#customScenarioGrid").addEventListener("click", (event) => { const card = event.target.closest("[data-scenario-id]"); if (!card) return; const scenario = getCustomScenarios().find((item) => item.id === card.dataset.scenarioId); if (scenario) openSetup(scenario); });
  refs.featured.addEventListener("click", (event) => { const button = event.target.closest("[data-featured-id]"); if (button) { const scenario = SCENARIOS.find((item) => item.id === button.dataset.featuredId); if (scenario) openSetup(scenario); } });
  $("#surpriseButton").addEventListener("click", () => { const candidates = searchScenarios("", state.category); const scenario = candidates[Math.floor(Math.random() * candidates.length)] || SCENARIOS[0]; openSetup(scenario); });
  $("#exploreButton").addEventListener("click", () => $("#experienceLibrary").scrollIntoView({ behavior: "smooth" }));
  ["#createScenarioButton", "#emptyCreateButton", "#customViewCreateButton"].forEach((selector) => $(selector).addEventListener("click", () => { state.editingScenarioId = null; $("#customPrompt").value = ""; updateCustomPromptCount(); $("#generateScenarioButton").innerHTML = "Build my scenario <span>✦</span>"; refs.createDialog.showModal(); }));
  $("#beginSimulationButton").addEventListener("click", startPendingScenario);
  $("#setupMode").addEventListener("change", () => $("#timeLimitField").classList.toggle("hidden", $("#setupMode").value !== "timed"));
  $("#contextFile").addEventListener("change", () => { const file = $("#contextFile").files[0]; $("#uploadName").textContent = file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "Text is extracted locally in your browser."; });
  $("#customContextFile").addEventListener("change", () => { const file = $("#customContextFile").files[0]; if (file) notify(`Reference selected: ${file.name}`, "success"); });
  $("#importScenarioButton").addEventListener("click", () => $("#importScenarioInput").click());
  $("#importScenarioInput").addEventListener("change", () => importCustomScenario($("#importScenarioInput").files[0]));
  $("#customPrompt").addEventListener("input", updateCustomPromptCount);
  $("#generateScenarioButton").addEventListener("click", createCustomFlow);
  $("#helpButton").addEventListener("click", () => refs.helpDialog.showModal());
  $("#profileButton").addEventListener("click", () => notify("Your simulation profile is kept in this browser for this standalone build.", "info"));
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) showDiscoveryView(nav.dataset.nav);
    const resume = event.target.closest("[data-resume]"); if (resume) resumeSession(resume.dataset.resume);
    const deleteSessionButton = event.target.closest("[data-delete-session]"); if (deleteSessionButton) removeHistorySession(deleteSessionButton.dataset.deleteSession);
    const deleteScenarioButton = event.target.closest("[data-delete-scenario]"); if (deleteScenarioButton) { removeCustomScenario(deleteScenarioButton.dataset.deleteScenario); renderCustomScenarios(); }
    const exportScenarioButton = event.target.closest("[data-export-scenario]"); if (exportScenarioButton) downloadScenario(exportScenarioButton.dataset.exportScenario);
    const editScenarioButton = event.target.closest("[data-edit-scenario]"); if (editScenarioButton) editCustomScenario(editScenarioButton.dataset.editScenario);
    const duplicateScenarioButton = event.target.closest("[data-duplicate-scenario]"); if (duplicateScenarioButton) duplicateCustomScenario(duplicateScenarioButton.dataset.duplicateScenario);
    const suggestion = event.target.closest("[data-suggestion]"); if (suggestion) { refs.response.value = suggestion.dataset.suggestion; updateResponseCount(); refs.response.focus(); }
  });
  refs.response.addEventListener("input", () => { refs.response.style.height = "auto"; refs.response.style.height = `${Math.min(refs.response.scrollHeight, 150)}px`; updateResponseCount(); });
  refs.response.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); refs.responseForm.requestSubmit(); } });
  refs.responseForm.addEventListener("submit", (event) => { event.preventDefault(); submitResponse(); });
  $("#micButton").addEventListener("click", () => { if (!state.voice) initVoice(); if (state.voice.listening) state.voice.stop(); else state.voice.start(); });
  $("#voiceOutputButton").addEventListener("click", () => {
    if (!state.voice) initVoice();
    if (!state.voice?.supportsSynthesis) { notify("Spoken responses are not supported in this browser. Text remains available.", "info"); return; }
    state.voiceOutputEnabled = !state.voiceOutputEnabled;
    $("#voiceOutputButton").setAttribute("aria-pressed", String(state.voiceOutputEnabled));
    $("#voiceOutputButton").classList.toggle("is-active", state.voiceOutputEnabled);
    if (!state.voiceOutputEnabled) state.voice.stopSpeaking();
    notify(state.voiceOutputEnabled ? "Spoken character responses enabled." : "Spoken character responses disabled.", "success");
  });
  $("#hintButton").addEventListener("click", () => { if (state.session?.mode === "challenge" || state.session?.mode === "expert") { notify("Hints are disabled in this mode. Trust your judgement and keep going."); return; } refs.response.value = "Could you give me one subtle hint about what I should consider next?"; updateResponseCount(); refs.response.focus(); });
  $("#replayLastButton").addEventListener("click", () => { if (!state.voice) initVoice(); const characterIndex = Math.max(0, state.session?.characters.findIndex((item) => item.id === state.activeCharacterId) || 0); state.voice.speak(state.lastCharacterLine, { characterIndex }); });
  refs.characterPanel.addEventListener("click", (event) => { const button = event.target.closest("[data-character-id]"); if (!button) return; state.activeCharacterId = button.dataset.characterId; renderCharacters(); });
  $("#decisionOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-decision-prompt]");
    if (!button || state.busy || !state.session || state.session.status !== "active") return;
    refs.response.value = button.dataset.decisionPrompt || "";
    updateResponseCount();
    refs.response.focus();
  });
  $("#branchTimeline").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-replay-point]");
    if (!button || !state.session || state.busy) return;
    if (!window.confirm("Create a separate replay from this moment? Your current session will remain saved.")) return;
    try {
      const original = state.session;
      state.voice?.destroy();
      state.session = createReplayBranch(original, button.dataset.replayPoint);
      state.activeCharacterId = state.session.characters[0]?.id || null;
      state.remainingSeconds = Number(state.session.timeLimit) || 0;
      await persistSession();
      showSimulationView();
      renderSimulation();
      startTimerIfNeeded();
      notify("A separate reality branch is ready. Try a different response.", "success", 4800);
    } catch (error) { notify(error.message || "Could not create that replay branch.", "error"); }
  });
  $("#pauseButton").addEventListener("click", pauseSimulation);
  $("#resumeButton").addEventListener("click", resumeSimulation);
  $("#pauseSaveButton").addEventListener("click", saveAndLeave);
  $("#saveExitButton").addEventListener("click", saveAndLeave);
  $("#leaveSimulationButton").addEventListener("click", () => { if (window.confirm("Leave this experience? Your progress will be saved.")) saveAndLeave(); });
  $("#finishButton").addEventListener("click", () => { if (window.confirm("End this experience and open your debrief?")) finishSession(); });
  $("#restartButton").addEventListener("click", restartCurrentScenario);
  $("#fullscreenButton").addEventListener("click", async () => { try { if (!document.fullscreenElement) await refs.simulation.requestFullscreen(); else await document.exitFullscreen(); } catch { notify("Fullscreen is unavailable in this browser."); } });
  $("#resultsCloseButton").addEventListener("click", () => { state.session = null; state.voice?.destroy(); showDiscoveryView("discover"); renderRecent(); });
  $("#resultsHomeButton").addEventListener("click", () => { state.session = null; showDiscoveryView("discover"); renderRecent(); });
  $("#clearHistoryButton").addEventListener("click", async () => { if (!window.confirm("Delete all Reality Simulator sessions saved on this device?")) return; await clearLocalData(); renderRecent(); renderHistory(); notify("Local simulator data cleared.", "success"); });
  $("#resultsContent").addEventListener("click", (event) => {
    if (event.target.closest("#resultsToHomeButton")) { state.session = null; showDiscoveryView("discover"); renderRecent(); }
    if (event.target.closest("#resultsRestartButton") || event.target.closest("#resultsReplayButton")) { const scenario = state.session?.scenario; const options = state.session ? { mode: state.session.mode, difficulty: state.session.difficulty, pressure: state.session.pressure, language: state.session.language, timeLimit: state.session.timeLimit, context: state.session.context } : {}; if (scenario) { state.session = engine.startSession(scenario, options); state.activeCharacterId = scenario.characters?.[0]?.id; showSimulationView(); renderSimulation(); startTimerIfNeeded(); saveSession(state.session); } }
    if (event.target.closest("#retryEvaluationButton")) retryEvaluation();
    if (event.target.closest("#exportReportButton") && state.session?.evaluation) exportTextFile(`${slugify(state.session.scenario.title)}-debrief.md`, formatEvaluationForExport(state.session.evaluation, state.session), "text/markdown");
    if (event.target.closest("#shareDebriefButton") && state.session?.evaluation) shareDebrief();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) && !refs.simulation.classList.contains("hidden")) return;
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) && refs.simulation.classList.contains("hidden")) { event.preventDefault(); refs.search.focus(); }
    if (event.key === "Escape" && state.voice?.listening) state.voice.stop();
  });
  window.addEventListener("beforeunload", () => { if (state.session && state.session.status === "active") { stopTimer(); state.session.status = "paused"; persistSession(); } state.voice?.destroy(); });
}
async function removeHistorySession(id) {
  if (!window.confirm("Delete this saved simulation from this device?")) return;
  await deleteSession(id); renderHistory(); renderRecent(); notify("Saved session deleted.", "success");
}
function updateCustomPromptCount() { $("#customPromptCount").textContent = `${$("#customPrompt").value.length} / 3000`; }
async function checkAPI() {
  const label = $("#connectionLabel");
  try {
    const health = await engine.health();
    label.textContent = health.ready ? `Gemini connected · ${health.model}` : "Gemini keys not configured";
    label.previousElementSibling.style.background = health.ready ? "#8abeb1" : "#d2a972";
    if (!health.ready) notify("The interface is ready, but add a Gemini key in Vercel to start AI simulations.", "info", 6000);
  } catch (error) {
    label.textContent = "API connection unavailable";
    label.previousElementSibling.style.background = "#d28e85";
    console.warn("Reality API health check failed:", error.message);
  }
}

function boot() {
  renderFeatured();
  renderLibrary();
  renderRecent();
  bindEvents();
  checkAPI();
}

boot();

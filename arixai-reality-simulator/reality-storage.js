const DB_NAME = "arixai-reality-v1";
const DB_VERSION = 1;
const STORE = "sessions";
const HISTORY_KEY = "arixai-reality-history-v1";
const CUSTOM_KEY = "arixai-reality-custom-v1";

let dbPromise;

function openDB() {
  if (!("indexedDB" in globalThis)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

function localRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

function localWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export async function saveSession(session) {
  const db = await openDB();
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(session);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      await updateHistory(session);
      return { saved: true, storage: "indexeddb" };
    } catch { /* use fallback */ }
  }
  const all = localRead("arixai-reality-sessions-v1", []);
  const next = [session, ...all.filter((item) => item.id !== session.id)].slice(0, 12);
  const saved = localWrite("arixai-reality-sessions-v1", next);
  await updateHistory(session);
  return { saved, storage: "localstorage" };
}

export async function getSession(id) {
  const db = await openDB();
  if (db) {
    try {
      return await new Promise((resolve) => {
        const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch { /* fallback */ }
  }
  return localRead("arixai-reality-sessions-v1", []).find((item) => item.id === id) || null;
}

export async function listSessions() {
  const db = await openDB();
  if (db) {
    try {
      const all = await new Promise((resolve) => {
        const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
      return all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 12);
    } catch { /* fallback */ }
  }
  return localRead("arixai-reality-sessions-v1", []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 12);
}

export async function deleteSession(id) {
  const db = await openDB();
  if (db) {
    try { await new Promise((resolve) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = resolve; tx.onerror = resolve; }); }
    catch { /* fallback too */ }
  }
  const all = localRead("arixai-reality-sessions-v1", []).filter((item) => item.id !== id);
  localWrite("arixai-reality-sessions-v1", all);
  localWrite(HISTORY_KEY, localRead(HISTORY_KEY, []).filter((item) => item.id !== id));
}

export async function updateHistory(session) {
  const history = localRead(HISTORY_KEY, []);
  const item = {
    id: session.id,
    title: session.scenario?.title || "Simulation",
    category: session.scenario?.category || "custom",
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turnCount: session.turnCount || 0,
    score: session.evaluation?.overallScore ?? null,
    mode: session.mode
  };
  localWrite(HISTORY_KEY, [item, ...history.filter((entry) => entry.id !== item.id)].slice(0, 30));
}

export function getHistory() {
  return localRead(HISTORY_KEY, []);
}

export function saveCustomScenario(scenario) {
  const all = localRead(CUSTOM_KEY, []);
  localWrite(CUSTOM_KEY, [scenario, ...all.filter((item) => item.id !== scenario.id)].slice(0, 30));
}

export function getCustomScenarios() {
  return localRead(CUSTOM_KEY, []);
}

export function removeCustomScenario(id) {
  localWrite(CUSTOM_KEY, localRead(CUSTOM_KEY, []).filter((item) => item.id !== id));
}

export function clearLocalData() {
  try { for (const key of [HISTORY_KEY, CUSTOM_KEY, "arixai-reality-sessions-v1"]) localStorage.removeItem(key); } catch { /* storage may be disabled */ }
  return openDB().then((db) => new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = resolve; tx.onerror = resolve;
  }));
}

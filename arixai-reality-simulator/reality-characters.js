const DEFAULT_ATTITUDE = { warm: 68, neutral: 50, skeptical: 34, impatient: 25, strict: 42, curious: 62 };

export function initialiseCharacters(characters = []) {
  return characters.map((character, index) => ({
    ...character,
    id: character.id || `character-${index + 1}`,
    mood: character.mood || character.attitude || "neutral",
    rapport: Number.isFinite(character.rapport) ? character.rapport : 50,
    pressure: Number.isFinite(character.pressure) ? character.pressure : 30,
    memory: Array.isArray(character.memory) ? character.memory : [],
    active: index === 0
  }));
}

export function getCharacter(characters, characterId) {
  return characters.find((character) => character.id === characterId) || characters[0] || null;
}

export function applyCharacterUpdates(characters, updates = []) {
  const updateMap = new Map(updates.filter(Boolean).map((update) => [update.characterId || update.id, update]));
  return characters.map((character) => {
    const update = updateMap.get(character.id);
    if (!update) return character;
    const rapport = Number.isFinite(update.rapportDelta) ? Math.max(0, Math.min(100, character.rapport + update.rapportDelta)) : character.rapport;
    const pressure = Number.isFinite(update.pressureDelta) ? Math.max(0, Math.min(100, character.pressure + update.pressureDelta)) : character.pressure;
    const memory = Array.isArray(update.remember) ? [...character.memory, ...update.remember.map((item) => String(item).slice(0, 180))].slice(-8) : character.memory;
    return {
      ...character,
      mood: typeof update.mood === "string" ? update.mood.slice(0, 32) : character.mood,
      rapport, pressure, memory,
      lastReaction: typeof update.lastReaction === "string" ? update.lastReaction.slice(0, 180) : character.lastReaction
    };
  });
}

export function buildCharacterContext(characters = []) {
  return characters.map((character) => ({
    id: character.id,
    name: character.name,
    role: character.role,
    personality: character.personality,
    communicationStyle: character.style,
    objective: character.goal || character.objective,
    currentMood: character.mood,
    rapport: character.rapport,
    pressure: character.pressure,
    rememberedDetails: character.memory.slice(-5),
    lastReaction: character.lastReaction || ""
  }));
}

export function getAttitudeTone(character) {
  const mood = String(character?.mood || "neutral").toLowerCase();
  return DEFAULT_ATTITUDE[mood] ?? 50;
}

export function characterDisplayName(characters, id) {
  return getCharacter(characters, id)?.name || "Simulation character";
}

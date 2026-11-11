const DIMENSION_ORDER = ["Clarity", "Relevance", "Reasoning", "Adaptability", "Communication", "Decision-making", "Persuasion", "Listening"];

export function normaliseEvaluation(raw, session) {
  const candidate = raw && typeof raw === "object" ? raw : {};
  const dimensions = Array.isArray(candidate.dimensions) ? candidate.dimensions.slice(0, 8).map((item) => ({
    name: String(item.name || "Skill").slice(0, 48),
    score: clampScore(item.score),
    evidence: String(item.evidence || "No specific evidence supplied.").slice(0, 600),
    improvement: String(item.improvement || "Continue practising this skill.").slice(0, 600)
  })) : [];
  const overallScore = clampScore(candidate.overallScore ?? average(dimensions.map((item) => item.score)));
  return {
    overallScore,
    label: scoreLabel(overallScore),
    summary: String(candidate.summary || "The simulation is complete. Review the turn-by-turn evidence and improvement points.").slice(0, 1800),
    outcome: String(candidate.outcome || session.summary || "The scenario reached its stopping point.").slice(0, 800),
    dimensions,
    strengths: stringArray(candidate.strengths, 5),
    improvements: stringArray(candidate.improvements, 5),
    keyMoments: Array.isArray(candidate.keyMoments) ? candidate.keyMoments.slice(0, 6).map((item) => ({
      moment: String(item.moment || "Interaction").slice(0, 100),
      evidence: String(item.evidence || "").slice(0, 500),
      impact: String(item.impact || "").slice(0, 300),
      alternative: String(item.alternative || "").slice(0, 500)
    })) : [],
    alternativeResponses: stringArray(candidate.alternativeResponses, 5),
    repeatPlan: stringArray(candidate.repeatPlan, 4),
    confidence: ["high", "medium", "low"].includes(String(candidate.confidence).toLowerCase()) ? String(candidate.confidence).toLowerCase() : "medium",
    evidenceCoverage: session.messages.length > 6 ? "multiple turns" : "limited turns",
    completedAt: new Date().toISOString()
  };
}

export function scoreLabel(score) {
  if (score >= 90) return "Exceptional";
  if (score >= 78) return "Strong";
  if (score >= 65) return "Developing well";
  if (score >= 45) return "Building the skill";
  return "Early practice";
}

export function formatEvaluationForExport(evaluation, session) {
  const lines = [
    `# Reality Simulator — ${session.scenario?.title || "Simulation"}`,
    `Date: ${new Date(evaluation.completedAt || Date.now()).toLocaleString()}`,
    `Overall score: ${evaluation.overallScore}/100 (${evaluation.label})`,
    "",
    "## Summary", evaluation.summary,
    "",
    "## Skill assessment",
    ...evaluation.dimensions.map((dimension) => `- **${dimension.name}: ${dimension.score}/100** — ${dimension.evidence} Improvement: ${dimension.improvement}`),
    "",
    "## Strengths", ...evaluation.strengths.map((item) => `- ${item}`),
    "",
    "## Areas to improve", ...evaluation.improvements.map((item) => `- ${item}`),
    "",
    "## Key moments", ...evaluation.keyMoments.map((item) => `- **${item.moment}:** ${item.evidence}\n  - Impact: ${item.impact}\n  - Alternative: ${item.alternative}`),
    "",
    "## Practice plan", ...evaluation.repeatPlan.map((item) => `- ${item}`),
    "",
    "## Transcript", ...session.messages.map((message) => `**${message.role === "user" ? "You" : message.characterId || "Character"}:** ${message.text}`)
  ];
  return lines.join("\n");
}

export function dimensionOrder() { return DIMENSION_ORDER; }

function clampScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(100, number))) : 50;
}
function average(values) { return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 50; }
function stringArray(value, limit) { return Array.isArray(value) ? value.slice(0, limit).map((item) => String(item).slice(0, 600)).filter(Boolean) : []; }

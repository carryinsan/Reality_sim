const characterPresets = {
  interviewer: { name: "Maya Chen", role: "Hiring manager", personality: "observant, direct and professionally demanding", style: "asks precise follow-ups and challenges unsupported claims", attitude: "neutral", goal: "understand the candidate's judgement, communication and evidence" },
  customer: { name: "Rohan Mehta", role: "Customer", personality: "frustrated but reasonable", style: "explains the problem and expects ownership", attitude: "impatient", goal: "get a fair and practical resolution" },
  examiner: { name: "Dr. Sen", role: "Examiner", personality: "strict, curious and academically rigorous", style: "asks layered questions and tests understanding", attitude: "neutral", goal: "distinguish understanding from memorisation" },
  investor: { name: "Anika Rao", role: "Investor", personality: "commercially sharp and sceptical", style: "tests assumptions, economics and execution", attitude: "skeptical", goal: "decide whether the proposal merits further discussion" },
  peer: { name: "Aarav Shah", role: "Conversation partner", personality: "friendly, expressive and realistic", style: "responds naturally and asks relevant follow-ups", attitude: "warm", goal: "have a genuine, two-way conversation" },
  negotiator: { name: "Nina Kapoor", role: "Negotiation counterpart", personality: "calm, strategic and firm about constraints", style: "uses trade-offs and asks for reasons before moving", attitude: "neutral", goal: "reach an outcome that protects their interests" },
  manager: { name: "Dev Malhotra", role: "Team manager", personality: "busy, practical and accountable", style: "focuses on impact, ownership and next steps", attitude: "neutral", goal: "resolve the issue while protecting team outcomes" },
  speaker: { name: "Jordan Lee", role: "Audience member", personality: "attentive and occasionally challenging", style: "asks concise questions and reacts to clarity", attitude: "curious", goal: "understand the speaker's core message" }
};

const definitions = [
  ["career","Job interview","A realistic first-round interview with probing follow-ups.","office","interviewer"],
  ["career","HR interview","Discuss motivation, fit, expectations and workplace judgement.","office","interviewer"],
  ["career","Technical interview","Explain technical choices, trade-offs and problem-solving steps.","interview","interviewer"],
  ["career","Group discussion","Contribute clearly while responding to competing viewpoints.","conference","speaker"],
  ["career","Salary negotiation","Discuss compensation using evidence, priorities and trade-offs.","meeting","negotiator"],
  ["career","Resume-based interview","Defend the experience and claims in a supplied resume.","office","interviewer"],
  ["career","First day at work","Navigate introductions, expectations and an unfamiliar team.","office","manager"],
  ["career","Workplace conflict","Resolve a disagreement while preserving professional trust.","meeting","manager"],
  ["career","Performance review","Discuss outcomes, feedback and a practical growth plan.","meeting","manager"],
  ["career","Leadership challenge","Guide a team through competing priorities and uncertainty.","conference","manager"],
  ["career","Workplace presentation","Present an idea and respond to audience questions.","stage","speaker"],
  ["career","Difficult manager conversation","Raise a difficult issue with clarity and tact.","meeting","manager"],
  ["everyday","Negotiate in a shop","Ask for a fair price without becoming adversarial.","shop","negotiator"],
  ["everyday","Return a defective product","Explain the issue and request a reasonable remedy.","shop","customer"],
  ["everyday","Make a complaint","Communicate a concern clearly and seek a useful resolution.","service","customer"],
  ["everyday","Talk to a stranger","Start and sustain a natural conversation.","cafe","peer"],
  ["everyday","Handle an angry customer","De-escalate frustration while setting realistic expectations.","service","customer"],
  ["everyday","Resolve a misunderstanding","Clarify intent, acknowledge impact and rebuild understanding.","cafe","peer"],
  ["everyday","Ask for help","Explain what you need and make the request confidently.","cafe","peer"],
  ["everyday","Make a personal decision","Explore competing priorities and explain a considered choice.","studio","peer"],
  ["everyday","Uncomfortable conversation","Address a sensitive issue respectfully and directly.","meeting","peer"],
  ["everyday","Build social confidence","Practise a low-pressure social interaction with natural turns.","cafe","peer"],
  ["everyday","Different personalities","Adapt communication to a person with a contrasting style.","meeting","peer"],
  ["education","School viva","Answer probing questions and explain concepts in your own words.","classroom","examiner"],
  ["education","College admissions interview","Explain interests, motivation and readiness for study.","interview","interviewer"],
  ["education","Scholarship interview","Connect achievements, goals and need to a compelling case.","office","interviewer"],
  ["education","University presentation","Deliver a clear argument and handle questions.","stage","speaker"],
  ["education","Classroom debate","Defend a position, test evidence and engage opposing arguments.","classroom","speaker"],
  ["education","Teacher-student interaction","Ask questions, clarify feedback and communicate respectfully.","classroom","examiner"],
  ["education","Competitive exam interview","Handle structured questions under realistic pressure.","interview","interviewer"],
  ["education","Public speaking","Practise a short talk with audience reactions and feedback.","stage","speaker"],
  ["education","Explain a difficult subject","Teach a concept clearly and respond to confusion.","classroom","peer"],
  ["education","Unexpected questions","Think aloud and respond to unfamiliar questions.","interview","examiner"],
  ["education","Defend an argument","Support a position when an examiner challenges assumptions.","classroom","examiner"],
  ["business","Startup investor pitch","Present the problem, solution, market and execution plan.","boardroom","investor"],
  ["business","Supplier negotiation","Agree terms while balancing quality, cost and reliability.","meeting","negotiator"],
  ["business","Convince a customer","Discover needs and explain relevant value without pressure.","service","customer"],
  ["business","Unhappy business customer","Protect trust while addressing a service failure.","service","customer"],
  ["business","Partnership negotiation","Align incentives, contributions, risks and responsibilities.","boardroom","negotiator"],
  ["business","Financial setback","Prioritise responses to a sudden business constraint.","boardroom","manager"],
  ["business","Product launch","Coordinate a launch plan and respond to changing information.","conference","manager"],
  ["business","Sales conversation","Understand needs, handle objections and agree next steps.","office","customer"],
  ["business","Business decision-making","Choose between imperfect options using explicit criteria.","boardroom","manager"],
  ["business","Team crisis","Lead a team through a time-sensitive operational problem.","conference","manager"],
  ["business","Present a business proposal","Make a concise proposal and answer stakeholder questions.","boardroom","investor"],
  ["communication","English conversation","Practise everyday English in a natural, supportive exchange.","cafe","peer"],
  ["communication","Foreign-language practice","Practise a chosen language with level-appropriate dialogue.","cafe","peer"],
  ["communication","Debate competition","Build and defend arguments under active challenge.","stage","speaker"],
  ["communication","Public speaking practice","Deliver a structured talk and respond to the audience.","stage","speaker"],
  ["communication","Persuasive communication","Make a clear case while respecting the listener's concerns.","meeting","negotiator"],
  ["communication","Negotiation skills","Practise interests, options, concessions and boundaries.","meeting","negotiator"],
  ["communication","Storytelling practice","Tell a compelling story with clear structure and pacing.","studio","peer"],
  ["communication","Difficult personalities","Stay constructive with a defensive or dismissive counterpart.","meeting","manager"],
  ["communication","Professional communication","Handle a concise, realistic workplace exchange.","office","manager"],
  ["communication","Impromptu speaking","Organise thoughts and speak clearly with little preparation.","stage","speaker"],
  ["challenge","Unexpected interview questions","Adapt when the interviewer changes direction without warning.","interview","interviewer"],
  ["challenge","Panel questioning","Respond to different perspectives from multiple characters.","boardroom","interviewer"],
  ["challenge","Handle pressure and criticism","Respond thoughtfully while facing pointed criticism.","meeting","manager"],
  ["challenge","Incomplete information","Make a provisional decision and identify what is missing.","boardroom","manager"],
  ["challenge","Unexpected problem","Diagnose a new problem and choose a practical response.","studio","manager"],
  ["challenge","Conflicting priorities","Negotiate deadlines, scope and stakeholder expectations.","meeting","manager"],
  ["challenge","Group disagreement","Help multiple people move from disagreement to a decision.","conference","peer"],
  ["challenge","Sudden change of circumstances","Adapt a plan when a critical assumption changes.","boardroom","manager"]
];

const categoryMeta = {
  all: { label: "All experiences", icon: "✦", tagline: "Find a situation worth stepping into." },
  career: { label: "Career", icon: "◈", tagline: "Practise the moments that shape your working life." },
  everyday: { label: "Everyday life", icon: "⌂", tagline: "Build confidence for conversations that happen every day." },
  education: { label: "Education", icon: "▤", tagline: "Prepare for questions, exams and the unexpected." },
  business: { label: "Business", icon: "◫", tagline: "Make decisions, pitch ideas and negotiate with purpose." },
  communication: { label: "Communication", icon: "◎", tagline: "Get clearer, calmer and more persuasive." },
  challenge: { label: "Pressure tests", icon: "⌁", tagline: "See how you respond when the situation changes." }
};

export const SCENARIOS = definitions.map((row, index) => {
  const [category, title, description, environment, preset] = row;
  const character = characterPresets[preset];
  return {
    id: `scenario-${String(index + 1).padStart(2, "0")}`,
    category, title, description, environment,
    duration: category === "everyday" ? "4–7 min" : "6–10 min",
    difficulty: category === "challenge" ? "advanced" : category === "education" ? "intermediate" : "adaptive",
    featured: [0, 12, 23, 34, 56].includes(index),
    skills: category === "career" ? ["Communication", "Judgement", "Confidence"] : category === "business" ? ["Decision-making", "Persuasion", "Strategy"] : category === "education" ? ["Clarity", "Reasoning", "Recall"] : ["Clarity", "Adaptability", "Confidence"],
    objectives: ["Understand the situation", "Respond with clarity", "Reach a considered next step"],
    characters: [{ id: "primary", ...character }],
    evaluationCriteria: [
      { name: "Clarity", description: "How clearly the response communicates its point.", weight: 25 },
      { name: "Relevance", description: "How directly the response addresses the situation.", weight: 25 },
      { name: "Reasoning", description: "How well the response explains its choices.", weight: 25 },
      { name: "Adaptability", description: "How well the response uses new information and follow-up questions.", weight: 25 }
    ]
  };
});

export const CATEGORIES = categoryMeta;

export function getScenarioById(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) || null;
}

export function searchScenarios(query = "", category = "all") {
  const normalized = String(query).trim().toLowerCase();
  return SCENARIOS.filter((scenario) => {
    const categoryMatch = category === "all" || scenario.category === category;
    const textMatch = !normalized || [scenario.title, scenario.description, scenario.category, ...scenario.skills].join(" ").toLowerCase().includes(normalized);
    return categoryMatch && textMatch;
  });
}

export function createLocalScenarioDraft(description) {
  const clean = String(description || "").trim();
  if (!clean) throw new Error("Describe the situation you want to practise.");
  return {
    id: `custom-${Date.now()}`,
    title: clean.length > 68 ? `${clean.slice(0, 65)}…` : clean,
    description: "A custom scenario prepared from your description. The AI will build the environment, characters and objectives.",
    category: "custom", environment: "studio", duration: "Custom", difficulty: "adaptive",
    objectives: ["Understand the situation", "Respond naturally", "Navigate the outcome"],
    characters: [], evaluationCriteria: []
  };
}

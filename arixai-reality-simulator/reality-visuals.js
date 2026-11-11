const PALETTES = {
  office: ["#111f2a", "#274c59", "#d6a36e"],
  interview: ["#182339", "#374d67", "#c79a70"],
  classroom: ["#172d2e", "#3d6560", "#dfb77d"],
  meeting: ["#1c2539", "#495c77", "#d7a778"],
  shop: ["#292435", "#62506a", "#e3b36e"],
  service: ["#172d35", "#3c616c", "#e3b477"],
  conference: ["#162334", "#2e5970", "#d6a66d"],
  stage: ["#211e34", "#4d3e73", "#e3b56f"],
  boardroom: ["#121f31", "#344c68", "#d1a36e"],
  cafe: ["#29242b", "#69504a", "#d8a36c"],
  studio: ["#202735", "#48536b", "#d4ab78"]
};

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

export function renderEnvironment(sceneRoot, scenario, state = {}) {
  if (!sceneRoot) return;
  const environment = PALETTES[scenario?.environment] ? scenario.environment : "studio";
  const [base, mid, accent] = PALETTES[environment];
  const title = esc(scenario?.title || "Simulation");
  const stage = esc(state?.scene?.stage || "Opening");
  const progress = Math.max(0, Math.min(100, Number(state?.scene?.progress) || 5));
  const tension = Math.max(0, Math.min(100, Number(state?.scene?.tension) || 28));
  const personCount = Math.max(1, Math.min(4, scenario?.characters?.length || 1));
  const environmentProps = {
    classroom: `<g opacity=".82"><rect x="315" y="67" width="275" height="105" rx="5" fill="#173a3a" stroke="#b5cdbb" stroke-opacity=".3"/><path d="M345 99 H545 M345 119 H505 M345 139 H470" stroke="#d8e6cb" stroke-opacity=".54" stroke-width="3" stroke-linecap="round"/><path d="M330 286 H610 V308 H330Z" fill="#9a7658"/><path d="M354 308 V350 M586 308 V350" stroke="#674f43" stroke-width="7"/></g>`,
    shop: `<g opacity=".8"><path d="M730 75 H934 V285 H730Z" fill="#1b2834" stroke="#d9e0e3" stroke-opacity=".22"/><path d="M730 145 H934 M730 215 H934" stroke="#d7b78c" stroke-opacity=".5" stroke-width="4"/><g fill="${accent}" opacity=".72"><rect x="750" y="91" width="24" height="40" rx="3"/><rect x="786" y="104" width="31" height="27" rx="3"/><rect x="832" y="91" width="25" height="40" rx="3"/><rect x="875" y="101" width="35" height="30" rx="3"/><rect x="750" y="160" width="34" height="40" rx="3"/><rect x="802" y="170" width="24" height="30" rx="3"/><rect x="844" y="158" width="28" height="42" rx="3"/><rect x="886" y="170" width="24" height="30" rx="3"/></g></g>`,
    stage: `<g opacity=".6"><path d="M210 0 L430 0 L535 292 H95Z" fill="${accent}" opacity=".1"/><path d="M790 0 L920 0 L1000 300 H670Z" fill="${accent}" opacity=".12"/><ellipse cx="500" cy="310" rx="250" ry="28" fill="${accent}" opacity=".1"/><path d="M496 255 V285 M482 265 H510" stroke="#f0d6b0" stroke-width="3" stroke-linecap="round"/></g>`,
    boardroom: `<g opacity=".7"><rect x="80" y="67" width="230" height="130" fill="#80a4b6" fill-opacity=".09" stroke="#dce5eb" stroke-opacity=".2"/><path d="M135 67 V197 M195 67 V197 M255 67 V197" stroke="#dce5eb" stroke-opacity=".16"/><path d="M50 297 H950 L885 328 H115Z" fill="#15202d" stroke="#dce5eb" stroke-opacity=".14"/><path d="M140 328 V378 M860 328 V378" stroke="#0b1420" stroke-width="10"/></g>`,
    cafe: `<g opacity=".74"><path d="M355 0 V65 M500 0 V55 M645 0 V67" stroke="#d5b17f" stroke-opacity=".5" stroke-width="2"/><path d="M336 64 Q355 82 374 64 L367 93 H343Z M481 54 Q500 72 519 54 L512 82 H488Z M626 66 Q645 84 664 66 L657 94 H633Z" fill="#d5ad7a" opacity=".65"/><rect x="744" y="120" width="180" height="120" rx="8" fill="#1b2530" stroke="#ffffff" stroke-opacity=".13"/><path d="M770 174 H897 M785 146 H870" stroke="#d6ae7c" stroke-opacity=".38" stroke-width="4"/></g>`,
    service: `<g opacity=".82"><path d="M80 250 H340 V300 H80Z" fill="#253c4c" stroke="#e5e9ec" stroke-opacity=".2"/><rect x="130" y="105" width="110" height="65" rx="6" fill="#0c1b29" stroke="#c6d9df" stroke-opacity=".2"/><path d="M148 125 H221 M148 141 H200" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><rect x="760" y="110" width="145" height="88" rx="6" fill="#0c1b29" stroke="#c6d9df" stroke-opacity=".18"/><text x="832" y="145" text-anchor="middle" fill="#e0c59f" font-size="17" font-family="Arial">HELP</text><text x="832" y="169" text-anchor="middle" fill="#9db0bc" font-size="9" font-family="Arial">SERVICE DESK</text></g>`,
    conference: `<g opacity=".72"><rect x="645" y="56" width="290" height="154" rx="7" fill="#0e1b2b" stroke="#d5e3eb" stroke-opacity=".22"/><rect x="663" y="74" width="254" height="117" rx="3" fill="#7fa9bd" fill-opacity=".1"/><path d="M690 159 L738 122 L784 143 L830 106 L887 130" stroke="${accent}" stroke-width="3" fill="none"/><path d="M130 310 H880 L840 336 H170Z" fill="#121d2b" stroke="#d9e4e9" stroke-opacity=".18"/></g>`,
    interview: `<g opacity=".58"><rect x="735" y="86" width="170" height="98" rx="6" fill="#152436" stroke="#d9e3e9" stroke-opacity=".18"/><path d="M758 109 H881 M758 129 H846 M758 149 H865" stroke="#d5b88f" stroke-opacity=".46" stroke-width="3" stroke-linecap="round"/><circle cx="865" cy="234" r="36" fill="${accent}" opacity=".08"/></g>`,
    office: `<g opacity=".6"><rect x="735" y="85" width="185" height="115" rx="6" fill="#17283a" stroke="#d9e4e9" stroke-opacity=".18"/><path d="M754 110 H897 M754 131 H869 M754 152 H887" stroke="#c2d4dd" stroke-opacity=".23" stroke-width="3" stroke-linecap="round"/></g>`,
    meeting: `<g opacity=".6"><rect x="725" y="73" width="200" height="116" rx="6" fill="#142336" stroke="#d9e4e9" stroke-opacity=".18"/><path d="M747 98 H902 M747 118 H872 M747 138 H888" stroke="${accent}" stroke-opacity=".38" stroke-width="3" stroke-linecap="round"/></g>`,
    studio: `<g opacity=".52"><rect x="728" y="84" width="205" height="118" rx="7" fill="#142234" stroke="#dce5ec" stroke-opacity=".2"/><circle cx="830" cy="142" r="29" fill="${accent}" opacity=".18"/><path d="M795 142 H865 M830 107 V177" stroke="${accent}" stroke-opacity=".35" stroke-width="2"/></g>`
  };
  const sceneProps = environmentProps[environment] || environmentProps.studio;
  const people = Array.from({ length: personCount }, (_, index) => {
    const x = 300 + index * 140;
    const y = index % 2 ? 236 : 246;
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="104" rx="53" ry="10" fill="#050910" opacity=".24"/>
      <path d="M-38 96 Q-34 34 0 30 Q34 34 38 96Z" fill="${index === 0 ? accent : "#60758b"}" opacity=".95"/>
      <path d="M-23 42 Q-24 3 0 3 Q24 3 23 42 Q12 58 0 57 Q-12 58 -23 42" fill="#d3a27f"/>
      <path d="M-24 28 Q-22 -5 4 -2 Q28 0 22 31 Q13 14 0 15 Q-15 14 -24 28" fill="#20202a"/>
      <circle cx="-8" cy="31" r="2" fill="#24242a"/><circle cx="8" cy="31" r="2" fill="#24242a"/>
      <path d="M-6 45 Q0 48 7 44" stroke="#8d554a" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`;
  }).join("");
  sceneRoot.innerHTML = `
    <svg class="environment-art" viewBox="0 0 1000 430" role="img" aria-label="Illustrated ${title} environment" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="room-${environment}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
        <linearGradient id="floor-${environment}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#162334"/><stop offset="1" stop-color="#0c1421"/></linearGradient>
        <radialGradient id="glow-${environment}"><stop stop-color="${accent}" stop-opacity=".36"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
        <filter id="soft-${environment}"><feGaussianBlur stdDeviation="18"/></filter>
      </defs>
      <rect width="1000" height="430" fill="url(#room-${environment})"/>
      <ellipse cx="740" cy="68" rx="270" ry="180" fill="url(#glow-${environment})" filter="url(#soft-${environment})"/>
      <path d="M0 320 L1000 292 L1000 430 L0 430Z" fill="url(#floor-${environment})"/>
      <path d="M0 318 L1000 290" stroke="#ffffff" stroke-opacity=".16" stroke-width="2"/>
      ${sceneProps}
      <g opacity=".55" stroke="#d8e6f0" stroke-opacity=".17" fill="none">
        <path d="M50 52 H330 V245 H50Z"/><path d="M65 66 H315 V232 H65Z"/>
        <path d="M80 80 V220 M150 80 V220 M220 80 V220 M290 80 V220"/>
      </g>
      <g opacity=".7"><rect x="690" y="90" width="225" height="120" rx="9" fill="#111c2b" stroke="#ffffff" stroke-opacity=".16"/><rect x="709" y="109" width="187" height="82" rx="4" fill="#9ec3d0" opacity=".12"/><path d="M728 166 L765 142 L797 157 L839 124 L879 145" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g opacity=".68"><path d="M160 302 H840 L810 327 H180Z" fill="#101b2a"/><path d="M188 327 V376 M812 327 V376" stroke="#0c1421" stroke-width="10"/><path d="M230 302 V287 H770 V302" fill="none" stroke="#ffffff" stroke-opacity=".13" stroke-width="2"/></g>
      ${people}
      <g opacity=".3" fill="#fff"><circle cx="112" cy="48" r="1.6"/><circle cx="565" cy="65" r="1.3"/><circle cx="942" cy="230" r="1.5"/></g>
      <rect x="26" y="25" width="238" height="31" rx="15.5" fill="#07111e" fill-opacity=".55" stroke="#ffffff" stroke-opacity=".15"/>
      <text x="44" y="45" fill="#e8f2fb" font-size="12" font-family="Arial,sans-serif" letter-spacing="1.6">${title.toUpperCase().slice(0, 30)}</text>
      <g transform="translate(760 30)"><rect width="205" height="33" rx="16.5" fill="#07111e" fill-opacity=".58" stroke="#ffffff" stroke-opacity=".15"/><text x="16" y="21" fill="#d9e6f0" font-size="11" font-family="Arial,sans-serif">${stage.toUpperCase().slice(0, 22)}</text></g>
      <g transform="translate(35 390)"><rect width="930" height="4" rx="2" fill="#ffffff" fill-opacity=".15"/><rect width="${930 * progress / 100}" height="4" rx="2" fill="${accent}"/><text x="0" y="-12" fill="#d7e5f0" font-size="10" font-family="Arial,sans-serif">SIMULATION PROGRESS</text><text x="930" y="-12" text-anchor="end" fill="#d7e5f0" font-size="10" font-family="Arial,sans-serif">${Math.round(progress)}%</text></g>
    </svg>
    <div class="scene-atmosphere" style="--scene-accent:${accent};--scene-tension:${tension / 100}"></div>
  `;
}

export function renderAvatar(character, active = false) {
  const name = esc(character?.name || "Character");
  const role = esc(character?.role || "Simulation character");
  const rawName = String(character?.name || "Character");
  const hash = [...rawName].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) >>> 0, 7);
  const initial = esc(rawName.trim().charAt(0).toUpperCase() || "C");
  const skins = ["#d7a17f", "#b97d5d", "#e0b08b", "#9c684f", "#c88e70"];
  const hairs = ["#28242a", "#4b352c", "#222d35", "#6a4735", "#35303f"];
  const jackets = ["#344f67", "#4c665d", "#66516b", "#536276", "#755a46"];
  const skin = skins[hash % skins.length];
  const hair = hairs[(hash >>> 3) % hairs.length];
  const jacket = active ? "#b18b61" : jackets[(hash >>> 6) % jackets.length];
  const hairShape = [
    "M25 38 Q21 9 47 10 Q71 12 65 41 Q57 24 42 26 Q31 28 25 38",
    "M24 35 Q22 8 45 8 Q68 8 67 34 L63 48 Q58 26 44 23 Q31 24 26 47Z",
    "M26 35 Q24 13 43 11 Q65 9 64 31 Q56 20 44 24 Q33 25 26 35"
  ][(hash >>> 9) % 3];
  return `<div class="avatar-portrait ${active ? "is-active" : ""}" aria-label="${name}, ${role}">
    <svg viewBox="0 0 90 90" aria-hidden="true"><defs><linearGradient id="av-${hash}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${active ? "#d9b17f" : "#879db2"}"/><stop offset="1" stop-color="#273d52"/></linearGradient></defs><rect width="90" height="90" rx="28" fill="url(#av-${hash})"/><path d="M13 90 Q16 53 45 53 Q74 53 77 90" fill="${jacket}"/><ellipse cx="45" cy="38" rx="19" ry="23" fill="${skin}"/><path d="${hairShape}" fill="${hair}"/><circle cx="38" cy="39" r="2" fill="#20212a"/><circle cx="52" cy="39" r="2" fill="#20212a"/><path d="M39 49 Q45 53 51 49" fill="none" stroke="#8c5149" stroke-width="2" stroke-linecap="round"/></svg>
    <span class="avatar-initial">${initial}</span>
  </div>`;
}

export function setSceneMood(sceneRoot, mood) {
  if (!sceneRoot) return;
  sceneRoot.dataset.mood = ["calm", "tense", "positive", "uncertain", "urgent"].includes(mood) ? mood : "calm";
}

export function flashScene(sceneRoot, type = "info") {
  if (!sceneRoot) return;
  sceneRoot.classList.remove("scene-flash", "flash-success", "flash-warning");
  void sceneRoot.offsetWidth;
  sceneRoot.classList.add("scene-flash", type === "success" ? "flash-success" : type === "warning" ? "flash-warning" : "");
  window.setTimeout(() => sceneRoot.classList.remove("scene-flash", "flash-success", "flash-warning"), 850);
}

export function drawProgressRing(canvas, value = 0) {
  if (!canvas?.getContext) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = 110;
  canvas.width = size * dpr; canvas.height = size * dpr;
  const context = canvas.getContext("2d");
  context.scale(dpr, dpr);
  context.lineWidth = 7;
  context.strokeStyle = "rgba(255,255,255,.12)";
  context.beginPath(); context.arc(size / 2, size / 2, 43, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = "#d5ad79";
  context.lineCap = "round";
  context.beginPath(); context.arc(size / 2, size / 2, 43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(100, value)) / 100); context.stroke();
}

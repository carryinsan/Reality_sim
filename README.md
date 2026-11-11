# ArixAI Reality Simulator — 2.1

A dependency-light, immersive real-life simulation experience for ArixAI. Built with HTML, CSS, vanilla JavaScript ES modules, inline SVG, Canvas 2D and browser-native speech APIs. No React, TypeScript, Unity, external game engine or paid visualisation service is required.

## Package layout

The ZIP is intentionally flat: `reality.html`, `reality.css`, the JavaScript modules, `README.md`, configuration files and tests are at the archive root. The only required subdirectory is `api/`, containing `api/reality.js` for the Vercel serverless endpoint.

## Included files

- `reality.html` — accessible simulator interface and all experience views
- `reality.css` — visual system, responsive layouts, animations and reduced-motion support
- `reality.js` — discovery, navigation, simulation controls, decisions, history and debrief UI
- `reality-engine.js` — model orchestration, session turns, request cancellation and performance timing
- `reality-intelligence.js` — director context, continuity, world-state normalisation, branch points and alternative-path replay
- `reality-characters.js` — individual character mood, rapport, pressure, memory and dialogue history
- `reality-scenarios.js` — curated 63-situation catalogue and scenario search
- `reality-state.js` — scenario state, relationship/world updates, decisions, events and session checkpoints
- `reality-evaluator.js` — evidence-based skill evaluation and debrief export
- `reality-visuals.js` — procedural 2D SVG environments, expressive avatars and scene-state presentation
- `reality-voice.js` — browser speech recognition and speech synthesis with text fallback
- `reality-storage.js` — IndexedDB persistence with localStorage fallback
- `api/reality.js` — server-side Gemini orchestration, strict validation, bounded retry/repair and three-key failover
- `tests/smoke.test.js` — automated behaviour and API contract tests
- `vercel.json` — `/reality` routing and security headers
- `.env.example` — server environment variable template

## 2.0 experience improvements

- **Reality Director:** every turn receives a structured continuity brief with the story state, character memories, unresolved threads, objective progress, relationship state, world facts and the recent transcript.
- **Persistent continuity summary:** the model maintains a compact, evolving memory of established names, facts, promises, constraints and unresolved questions so long sessions do not depend only on a short recent transcript.
- **Character dynamics:** individual mood, rapport, pressure, remembered details, goal progress and recent dialogue evolve independently.
- **Branch-aware storytelling:** scenario story arcs are used as triggers rather than scripts; the user's actions steer the next beat.
- **World-state variables:** scenario facts and relevant resources can change and remain visible in the live session.
- **Decision board:** the director may offer up to three distinct next approaches when they genuinely help; users can edit the suggested response before sending it.
- **Relationship and event tracking:** meaningful changes are recorded in the path timeline and event feed.
- **Alternative-path replay:** a separate local session can restart from a saved moment. The original session remains unchanged.
- **Responsive 2D scene direction:** SVG environments react to the current speaker, stage, mood, lighting, focus and ambience. Character portraits reflect their current attitude.
- **More resilient generation:** bounded output validation and one repair pass for malformed model JSON, plus provider-key failover for transient provider errors.
- **Partial-update safety:** optional character, relationship and scene fields preserve established values when the model omits them; absent rapport/pressure deltas default to zero rather than unexpectedly swinging character dynamics.
- **Branch replay integrity:** replay checkpoints are captured before each submitted turn and fork into a separate local session, leaving the source run unchanged.
- **Request lifecycle controls:** client cancellation, bounded server-side provider timeout, no-store responses, request-size limits and bounded output token settings.
- **Scene feedback:** the active speaker, character mood, ambience, focus and scene lighting can change the SVG environment without introducing a 3D runtime.

## Deploy to Vercel

1. Extract the ZIP into the root of the ArixAI repository. `reality.html`, `reality.css` and all root JavaScript files should sit beside your existing app files. Keep `api/reality.js` inside the root `api/` directory.
2. Merge the supplied `vercel.json` rules into your existing Vercel configuration. Do not replace existing rewrites, headers, redirects or project settings without checking them.
3. In Vercel → Project → Settings → Environment Variables, add `GEMINI_KEY`, `GEMINI_KEY2` and `GEMINI_KEY3`. Add only keys you are authorised to use. The server uses them as failover credentials and never returns key values to the browser.
4. The default model is `gemini-3.8-flash`. Set `GEMINI_MODEL` to another model ID only when it is enabled for your Google AI project.
5. Deploy, then open `/reality` or `/reality.html`. Environment-variable changes require a new deployment.

Never place real API keys in HTML, CSS, browser JavaScript, `.env.example` or a public repository. Three keys do not multiply an individual provider project's allowed quota; they are fallback credentials for authorised, separately provisioned access.

## Local development and verification

Use Node.js 20+ and Vercel's local development environment. A static file server can display the interface, but `/api/reality` requires the serverless runtime and configured environment variables.

```bash
npm run check
npm test
vercel dev
```

The test suite covers the 63-scenario catalogue, state recovery, multi-character turn handling, director context, world-state sanitisation, independent branch replay, partial-update preservation, evaluation normalisation, API readiness, Gemini key failover and enriched turn-response validation with a mocked provider.

## API contract

`POST /api/reality` accepts JSON actions `create`, `turn` and `evaluate`. The endpoint limits request size, validates action payloads, normalises model output, returns structured errors and never exposes API key values. Gemini calls use the official `generateContent` REST endpoint with JSON response mode.

Optional environment variables:

- `GEMINI_MODEL` — default `gemini-3.8-flash`
- `ALLOWED_ORIGINS` — comma-separated allowed origins; same-origin is allowed by default
- `REALITY_MAX_BODY_BYTES` — request cap
- `REALITY_MAX_OUTPUT_TOKENS` — generation output cap
- `REALITY_TIMEOUT_MS` — total provider/failover/repair time budget for one action
- `REALITY_PER_KEY_TIMEOUT_MS` — maximum time allowed for one configured Gemini key slot
- `REALITY_RATE_LIMIT_PER_MINUTE` — instance-local safety limit

The supplied `vercel.json` sets `api/reality.js` to a 60-second maximum function duration. Merge that entry into the ArixAI project's existing Vercel configuration rather than replacing unrelated settings.

## Storage, data and integration notes

Simulation sessions, custom scenarios, replay points and reports are saved locally in the current browser using IndexedDB, with a localStorage fallback. Clearing local simulator history removes those locally saved records. TXT, Markdown, CSV and JSON context files are read locally in the browser and only their extracted text is sent with the scenario request.

This is a self-contained feature package: the ArixAI repository's private authentication, billing, profile and shared-rate-limit contracts were not supplied. The UI therefore does not assume or modify those services. Before making the endpoint account-bound or exposing paid usage, connect it to ArixAI's existing authentication, entitlement and shared rate-limiting controls.

API throttling in this package is an instance-local brake, not a globally consistent production quota system. For high-volume public traffic, use ArixAI's existing shared rate limiter. Browser speech recognition and speech synthesis vary by browser and operating system; text interaction remains available when voice APIs are missing.

No build can be truthfully guaranteed error-free across all browsers, model outages, quotas and deployment environments. This package passes its automated local checks, but must still be staged against the actual ArixAI repository and live Gemini credentials before production release.

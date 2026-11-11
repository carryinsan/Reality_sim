# ArixAI Reality Simulator

A dependency-light HTML/CSS/Vanilla JavaScript simulator with a Gemini-backed server function. It uses SVG, CSS and Canvas 2D instead of a 3D engine or premade 3D models.

## Included files

- `reality.html` — simulator shell and accessible interface
- `reality.css` — visual system, responsive layouts and scene styling
- `reality.js` — user interface, navigation, controls and rendering
- `reality-engine.js` — scenario creation, live turns and evaluation orchestration
- `reality-characters.js` — independent character state and behaviour helpers
- `reality-scenarios.js` — curated scenario library and category metadata
- `reality-state.js` — in-memory simulation state and checkpoints
- `reality-evaluator.js` — evidence-based evaluation formatting and score validation
- `reality-visuals.js` — generated 2D SVG environments, character portraits and visual effects
- `reality-voice.js` — browser SpeechRecognition and SpeechSynthesis support with text fallback
- `reality-storage.js` — IndexedDB persistence with localStorage fallback
- `api/reality.js` — server-side Gemini API orchestration with three-key failover

## Deploy to Vercel

1. Copy the project files into the root of the ArixAI repository. Keep the `api` directory at the project root.
2. Merge the `vercel.json` rewrites/headers with your existing configuration rather than overwriting other routes or headers.
3. In Vercel → Project → Settings → Environment Variables, add `GEMINI_KEY`, `GEMINI_KEY2`, and `GEMINI_KEY3`. Add only keys you are authorised to use. The server attempts configured keys in rotation/failover order; they are not exposed to the browser.
4. Optionally set `GEMINI_MODEL` (default: `gemini-3.8-flash`). Check that this model is enabled for your Google AI project.
5. Deploy. Open `/reality` or `/reality.html`.
6. After changing environment variables, create a new deployment for the changes to take effect.

Do not paste API keys into `reality.js`, `reality.html`, CSS, or any public repository file.

## Local development

Use Node.js 20+ and a local serverless-function emulator such as `vercel dev`. A static file server can display the UI but cannot execute `/api/reality`; the simulator will show a clear API-not-connected state until the server function and environment variables are available.

```bash
npm run check
npm test
vercel dev
```

## API contract

`POST /api/reality` with JSON:

```json
{
  "action": "create | turn | evaluate",
  "scenario": {},
  "state": {},
  "userInput": "...",
  "mode": "training",
  "difficulty": "intermediate",
  "context": "optional extracted text"
}
```

The API accepts JSON only, limits request size, validates actions and input, uses timeouts, returns structured errors, and never sends key values to the client. It uses Gemini's `generateContent` REST endpoint. Three key variables are treated as failover credentials, not as a way to bypass quotas or provider restrictions.

## Important integration notes

- This is a self-contained feature package. The ArixAI repository and its existing authentication, billing, user profile and memory contracts were not included in the supplied material. The package therefore does not make assumptions about private ArixAI APIs or modify any existing application file.
- The supplied implementation includes a curated scenario set, custom AI scenario creation, character state tracking, dynamic multi-turn simulations, local session save/resume, replay, basic report history, import/export of scenario definitions, text/Markdown/CSV/JSON context uploads, browser-native voice, and model-generated evaluation.
- Browser speech recognition and speech synthesis availability varies by browser and OS. They are optional and the text interface remains usable.
- User uploads are read locally as text for TXT, MD, CSV and JSON. Full PDF/DOCX extraction, remote file storage, cross-device syncing, authenticated public scenario sharing, multiplayer live sessions and community moderation need the corresponding ArixAI storage/authentication services or document extraction infrastructure; they are not falsely represented as complete here.
- API rate limiting in this package is an in-memory per-function-instance guard. It is a useful safety brake, not a globally consistent rate limiter. Use ArixAI's existing shared rate limiter or a database/Redis-backed limiter for high-volume production deployments.
- No software package can be honestly guaranteed "errorless" across every deployment, browser, account quota and model outage. This package includes validation, recovery paths and static checks; it still needs staging deployment and end-to-end tests against your actual ArixAI project and Gemini keys.

## Security checklist before production

- Set the three Gemini environment variables in Vercel; do not commit values.
- Configure `ALLOWED_ORIGINS` if the feature is hosted on a separate origin.
- Connect the handler to ArixAI's actual authentication and entitlement checks before exposing paid or account-bound usage.
- Replace the instance-local rate guard with the shared ArixAI limiter if available.
- Review upload size, data retention, privacy notice and user deletion flows against ArixAI policy.
- Test the route on Preview before merging to Production.

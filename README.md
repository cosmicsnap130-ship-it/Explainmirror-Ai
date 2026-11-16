# ExplainMirror AI
*Understand how students think, not just what they answer.*

Students write an explanation and a confidence rating first. Then the AI reports conceptual gaps, reasoning weak spots, suggestions, one thought question and one follow-up. Students can challenge the feedback. History and progress are stored in the browser (localStorage).

## Run locally
1. `npm install`
2. `cp .env.example .env` and put your key in `GEMINI_API_KEY` (free key: https://aistudio.google.com/apikey)
3. Development: `export $(cat .env | xargs) && npm run dev` then open http://localhost:5173
4. Production: `npm run build && export $(cat .env | xargs) && npm start` then open http://localhost:3001

Without a key, the app runs but shows a banner and disables analysis. It never fakes AI output.

## Configure the AI key
The key is read only by `server.js` from the `GEMINI_API_KEY` environment variable. It is never sent to the browser or committed (`.env` is git-ignored). Set it as an environment variable on your host.

## Deploy (Render, free tier)
1. Push this folder to a public GitHub repo.
2. On render.com: New > Blueprint (uses `render.yaml`) or New > Web Service with build `npm install && npm run build`, start `npm start`.
3. Add environment variable `GEMINI_API_KEY`. Deploy. Any Node host (Railway, Fly.io, a VPS) works the same way.

## Notes
Scores are AI estimates, not grades. Progress lives in each browser; clearing site data deletes it.

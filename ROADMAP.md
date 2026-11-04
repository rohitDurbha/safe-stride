# SafeStride Roadmap

Work moves one step at a time, so each item is split into small steps that land over several days.

## Urgent

The public repository still holds a Google API key in `backend/.env` and hardcoded MongoDB Atlas and Gmail passwords in `backend/app.py`. Removing them from the current code does not remove them from git history, so every one of those credentials has to be rotated (see Needs Rohit below).

## Items

- [ ] 1. Move every secret to environment variables, add `backend/.env.example`, delete `backend/.env`, `__pycache__` and `cache/` from the repo, and tighten `.gitignore`.
  - [x] a. Read the MongoDB URI and the SMTP sender settings from environment variables through one config module, send mail through one helper, add `backend/.env.example`, delete `backend/.env` and ignore env files.
  - [ ] b. Delete `backend/__pycache__` and `backend/cache/` from the repo and ignore Python build output and the osmnx cache.
  - [ ] c. Move the Firebase web config in `src/firebase/config.ts` to `VITE_` environment variables and add a root `.env.example`.
  - [ ] d. Fail fast with a clear message when a required backend variable is missing, and document local setup in the README.
- [ ] 2. Fix the Gemini integration. Move from the retired gemini-1.5-flash model and the deprecated google-generativeai SDK to the google-genai SDK with a current free-tier Flash model and JSON structured output, with a keyword fallback when the API fails.
- [ ] 3. Fix the login crash for unknown emails, the emergency contact bug where alerts go to an empty global variable, remove the unauthenticated `/add_user` route, and require a token on `/report_audio`.
- [ ] 4. Replace hardcoded `http://127.0.0.1:5000` calls with one `VITE_API_URL` setting.
- [ ] 5. Debloat. Remove duplicate imports, choose one auth system (Flask JWT or Firebase, not both), delete unused shadcn components and npm packages, and drop the random mock lighting and foot traffic columns.
- [ ] 6. Improve routing. Use length times (1 + lambda times risk) as the edge weight, use real OSM lighting tags, weight crimes by recency and time of day, and assign weights in one vectorized pass instead of a per-edge DataFrame scan.
- [ ] 7. Cache the Oakland walking graph to a file so the server does not download it from OpenStreetMap on every start.
- [ ] 8. Host for free. Frontend on Vercel, backend as a Docker Space on Hugging Face, MongoDB Atlas M0, and the Gemini free tier.
- [ ] 9. Pytest coverage for routing and the classifier, Vitest for the map helpers, a CI workflow, and a real README.

## Needs Rohit

- Rotate the Google API key, the MongoDB Atlas user password and the Gmail password that were committed to this repository, because git history still holds the old values.
- Create a Gmail app password (or a free Resend key) and set `SMTP_USER` and `SMTP_PASSWORD` locally as described in `backend/.env.example`.
- Put the new Atlas connection string in `MONGO_URI` in your local `backend/.env`. The backend now refuses to start without it.
- Vercel and Hugging Face accounts for item 8.

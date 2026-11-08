# SafeStride Roadmap

Work moves one step at a time, so each item is split into small steps that land over several days.

## Urgent

The public repository still holds a Google API key in `backend/.env` and hardcoded MongoDB Atlas and Gmail passwords in `backend/app.py`. Removing them from the current code does not remove them from git history, so every one of those credentials has to be rotated (see Needs Rohit below).

## Items

- [x] 1. Move every secret to environment variables, add `backend/.env.example`, delete `backend/.env`, `__pycache__` and `cache/` from the repo, and tighten `.gitignore`.
  - [x] a. Read the MongoDB URI and the SMTP sender settings from environment variables through one config module, send mail through one helper, add `backend/.env.example`, delete `backend/.env` and ignore env files.
  - [x] b. Delete `backend/__pycache__` and `backend/cache/` from the repo and ignore Python build output and the osmnx cache.
  - [x] c. Move the Firebase web config in `src/firebase/config.ts` to `VITE_` environment variables and add a root `.env.example`.
  - [x] d. Fail fast with a clear message when a required backend variable is missing, and document local setup in the README.
- [ ] 2. Fix the Gemini integration. Move from the retired gemini-1.5-flash model and the deprecated google-generativeai SDK to the google-genai SDK with a current free-tier Flash model and JSON structured output, with a keyword fallback when the API fails.
  - [ ] a. Move `report_classifier.py` to the google-genai SDK with a current free-tier Flash model read from a `GEMINI_MODEL` setting, ask for JSON structured output limited to the known crime categories, update `requirements.txt`, and add pytest coverage with a fake client.
  - [ ] b. Add a keyword fallback that classifies reports when `GOOGLE_API_KEY` is missing or the Gemini call fails, with tests.
  - [ ] c. Add a GitHub Actions workflow that runs the backend tests on every push, plus a live Gemini smoke test that sends one sample report using the `GOOGLE_API_KEY` repository secret and is skipped when the secret is unavailable.
- [ ] 3. Fix the login crash for unknown emails, the emergency contact bug where alerts go to an empty global variable, remove the unauthenticated `/add_user` route, and require a token on `/report_audio`.
- [ ] 4. Replace hardcoded `http://127.0.0.1:5000` calls with one `VITE_API_URL` setting.
- [ ] 5. Debloat. Remove duplicate imports, choose one auth system (Flask JWT or Firebase, not both), delete unused shadcn components and npm packages, and drop the random mock lighting and foot traffic columns.
- [ ] 6. Improve routing. Use length times (1 + lambda times risk) as the edge weight, use real OSM lighting tags, weight crimes by recency and time of day, and assign weights in one vectorized pass instead of a per-edge DataFrame scan.
- [ ] 7. Cache the Oakland walking graph to a file so the server does not download it from OpenStreetMap on every start.
- [ ] 8. Host for free. Frontend on Vercel, backend as a Docker Space on Hugging Face, MongoDB Atlas M0, and the Gemini free tier.
- [ ] 9. Pytest coverage for routing and the classifier, Vitest for the map helpers, a CI workflow, and a real README. CI end to end tests start a throwaway MongoDB service seeded from `backend/crime_rate.csv` and never write to Atlas. The `MONGO_URI` secret is only used for a read only connection check.

## Needs Rohit

- Rotate the Google API key, the MongoDB Atlas user password and the Gmail password that were committed to this repository, because git history still holds the old values.
- Create a Gmail app password (or a free Resend key) and set `SMTP_USER` and `SMTP_PASSWORD` locally as described in `backend/.env.example`.
- Put the new Atlas connection string in `MONGO_URI` and a freshly generated `SECRET_KEY` in your local `backend/.env`. The backend now refuses to start without either one, and it no longer accepts `dev_key` as a signing secret.
- The Firebase web key that used to sit in `src/firebase/config.ts` is still in git history. Restrict it to your domains in the Google Cloud console (or rotate it), then copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_` values. Set the same values in Vercel when the frontend is hosted.
- Done. `GOOGLE_API_KEY` and `MONGO_URI` are saved as repository secrets for the CI workflow.
- GitHub Actions runners have changing IP addresses, so the read only Atlas check in CI only works after adding `0.0.0.0/0` under Network Access in Atlas. Until then that check is skipped and everything else still runs.
- Vercel and Hugging Face accounts for item 8.

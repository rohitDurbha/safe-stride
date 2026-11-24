# SafeStride

SafeStride suggests safer walking routes around Oakland by weighting streets with crime data and community reports. The frontend is a Vite and React app, and the backend is a Flask server that talks to MongoDB and Gemini.

## Local setup

You will need Node.js 20.19 or newer (Vite 8 needs it) for the frontend and Python 3.10 or newer for the backend.

### Frontend

```sh
npm install
cp .env.example .env   # optional, set VITE_API_URL to use a backend other than 127.0.0.1:5000
npm run dev
```

Run the frontend tests with `npm test`. They use Vitest and need no backend settings.

### Backend

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # then fill in the values described below
python app.py
```

The backend reads its settings from `backend/.env`, which git ignores so your credentials stay on your machine. The table below lists every setting and whether the server needs it to start.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB Atlas connection string, including the database name |
| `SECRET_KEY` | Yes | Long random string used to sign login tokens |
| `JWT_EXPIRATION` | No | Login token lifetime in seconds, which defaults to 3600 |
| `GOOGLE_API_KEY` | No | Google AI Studio key for the incident classifier, and reports are classified with keyword rules when it is empty |
| `GEMINI_MODEL` | No | Gemini model for the incident classifier, which defaults to the free tier `gemini-3.1-flash-lite` |
| `SMTP_HOST`, `SMTP_PORT` | No | Outgoing mail server, which defaults to Gmail on port 587 |
| `SMTP_USER`, `SMTP_PASSWORD` | No | Mail account and app password for emergency contact alerts, and alerts are skipped when either one is empty |
| `SMTP_SENDER` | No | Display address for alerts, which falls back to `SMTP_USER` |
| `STREET_GRAPH_PATH` | No | Where the cached Oakland walking graph is stored, which defaults to `backend/cache/oakland_walk.graphml` |

If `MONGO_URI` or `SECRET_KEY` is missing, the server stops right away with a message that names each missing variable, so you never wait for the Oakland street graph to download only to hit a configuration error. It also refuses placeholder secrets such as `dev_key`, and you can generate a proper one with this command.

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The first start downloads the Oakland walking graph from OpenStreetMap, which takes a few minutes, and saves it to `backend/cache/oakland_walk.graphml`. Every later start reads that file in seconds. You can also build it ahead of time with `python street_graph.py` from the `backend` folder, which is what the Docker image does.

### Running the backend tests

```sh
cd backend
python -m pytest
```

These tests use a fake Gemini client and never touch the network. A separate live smoke test sends one sample report to the real Gemini API, and it only runs when you ask for it with `python -m pytest -m live` and `GOOGLE_API_KEY` is set (otherwise it is skipped). It calls Gemini without the keyword fallback, so a bad key, a retired model name or an exhausted quota shows up as a failure instead of a silent switch to keywords.

The CI workflow in `.github/workflows/ci.yml` runs the backend tests on every push and pull request. When they pass, it runs the live smoke test with the `GOOGLE_API_KEY` repository secret, and it skips that check when the secret is not available to the run, such as on pull requests from forks.

## Hosting

The backend runs as a free Hugging Face Docker Space. Every push to `main` that touches `backend/` runs `.github/workflows/deploy-backend.yml`, which runs the backend tests, creates the Space if it does not exist yet, copies the settings below into the Space secrets, uploads `backend/` with its `Dockerfile`, and waits until the Space answers on `/home`. The image downloads the Oakland walking graph while it builds, and gunicorn serves the app on port 7860.

| Repository setting | Kind | Purpose |
| --- | --- | --- |
| `HF_TOKEN` | Secret | Hugging Face token with write access |
| `MONGO_URI`, `SECRET_KEY` | Secret | Required by the server, so the deploy stops when either is missing |
| `GOOGLE_API_KEY`, `SMTP_USER`, `SMTP_PASSWORD` | Secret | Optional, copied when present |
| `HF_SPACE_NAME` | Variable | Optional Space name, which defaults to `safe-stride` under the token's account |
| `CORS_ORIGINS` | Variable | Optional list of frontend origins, which defaults to the `safe-stride` Vercel URL and its preview URLs |

MongoDB Atlas has to accept connections from anywhere (`0.0.0.0/0` under Network Access), because Spaces have no fixed IP address.

## How routes are chosen

The routing code lives in `backend/routing.py`. Each crime in the dataset, and each report people send through the app, adds risk to the streets around it. The risk fades smoothly over about 120 m, so streets right next to a hotspot score highest and the next block over scores a little. Each crime's weight depends on how dangerous it is for someone on foot (a robbery counts far more than a car break-in), how recent it is (older incidents fade with a 90 day half-life but never disappear), and whether it happened in the same part of the day as the walk.

The cost of walking a street is its length plus 300 m for each unit of risk, and at night streets that OpenStreetMap marks as unlit cost more. A route may be at most 1.5 times as long as the plain shortest path. If the safest route is longer than that, the safety weight is halved until the route fits, so you always get the safest route that is still a sensible walk. The `/safe_path` response includes a `summary` with the distance, the detour compared with the shortest path, and how much less crime the route passes. Add `period=day` or `period=night` to override the time of day. The start is the typed starting point (`source`, or `start_lat` and `start_lon` when a suggestion is picked), and your current location is used only when the starting point is left empty.

Reports are saved in MongoDB and replayed into the graph when the server starts, so they keep counting after a restart.

## How reports are classified

When someone sends a spoken report, `backend/report_classifier.py` asks Gemini to match the transcript against the Oakland crime categories and keeps the answer with the highest confidence. If `GOOGLE_API_KEY` is not set, or the Gemini call fails, or the reply is not valid JSON, the backend falls back to the keyword rules in `backend/keyword_classifier.py`. Those rules check the most specific and serious categories first, so a report about someone pulling a gun to take a phone is filed as a robbery and a stolen car is not filed as petty theft. A report that matches no rule is saved as `UNKNOWN`, which means the app keeps working offline and in tests without any API key.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Flask
- Gemini
- MongoDB
- Web Speech API
- OSM + GeoPY
  

## Sign in

SafeStride uses one login system, the Flask backend's email and password sign up with JWT tokens, so the frontend needs no Firebase or other third party keys.

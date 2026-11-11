# SafeStride

SafeStride suggests safer walking routes around Oakland by weighting streets with crime data and community reports. The frontend is a Vite and React app, and the backend is a Flask server that talks to MongoDB and Gemini.

## Local setup

You will need Node.js 18 or newer for the frontend and Python 3.10 or newer for the backend.

### Frontend

```sh
npm install
cp .env.example .env   # then fill in the VITE_FIREBASE_ values
npm run dev
```

Run the frontend tests with `npm test`. They use Vitest and need no backend or Firebase settings.

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

If `MONGO_URI` or `SECRET_KEY` is missing, the server stops right away with a message that names each missing variable, so you never wait for the Oakland street graph to download only to hit a configuration error. It also refuses placeholder secrets such as `dev_key`, and you can generate a proper one with this command.

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Running the backend tests

```sh
cd backend
python -m pytest
```

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
- Firebase
- Web Speech API
- OSM + GeoPY
  

## Firebase Setup

To connect this application to Firebase:

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable Authentication, Firestore, and Storage services
3. Create a web app in your Firebase project
4. Copy your Firebase config from the Firebase Console
5. Copy `.env.example` to `.env` in the project root and fill in the `VITE_FIREBASE_` values from your web app config

```sh
cp .env.example .env
```

The `.env` file is ignored by git, so the keys stay on your machine. You can also enter the values on the `/setup` page, which saves them in the browser.

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
| `GOOGLE_API_KEY` | No | Google AI Studio key for the incident classifier |
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

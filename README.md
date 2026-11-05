
```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

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


// Import the Firebase SDK
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Values come from .env (see .env.example) so no project keys live in the source
const envConfig: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

// Firebase configuration manager
const FirebaseConfigManager = {
  getConfig: (): FirebaseWebConfig => {
    // Try to get config from localStorage first
    const storedConfig = localStorage.getItem('firebase_config');
    if (storedConfig) {
      try {
        return JSON.parse(storedConfig);
      } catch (e) {
        console.error("Invalid stored Firebase config:", e);
      }
    }
    
    // Fall back to the values supplied at build time through VITE_ variables
    return envConfig;
  },
  
  setConfig: (config: FirebaseWebConfig) => {
    localStorage.setItem('firebase_config', JSON.stringify(config));
  }
};

// Initialize Firebase with current config
const firebaseConfig = FirebaseConfigManager.getConfig();
const app = initializeApp(firebaseConfig);

// Firebase services throw at startup without an API key and project id, so
// only create them when those are configured. The setup page still loads and
// lets the user enter the values.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isFirebaseConfigured) {
  console.warn(
    "Firebase is not configured. Copy .env.example to .env and fill in the VITE_FIREBASE_ values, or enter them on the setup page."
  );
}

// Get Firebase services
export const auth = isFirebaseConfigured ? getAuth(app) : null;
export const db = isFirebaseConfigured ? getFirestore(app) : null;
export const storage = isFirebaseConfigured ? getStorage(app) : null;

// Export the config manager for use in setup screens
export const configManager = FirebaseConfigManager;

export default app;

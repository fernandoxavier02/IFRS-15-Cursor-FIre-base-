// Firebase Client SDK Configuration
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, Firestore, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, Functions, getFunctions } from "firebase/functions";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAR-mXBKfDyFGV5JCCBl6WrReBmlDo2wS0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ifrs15-revenue-manager.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ifrs15-revenue-manager",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ifrs15-revenue-manager.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1065024526212",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1065024526212:web:e1de7ccb1cbb7c93f26fd1",
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);
functions = getFunctions(app, "us-central1"); // Cloud Functions region

// Connect to emulators in development
if (import.meta.env.DEV && (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" || import.meta.env.VITE_USE_EMULATORS === "true")) {
  console.log("Connecting to Firebase emulators...");
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
  } catch (error) {
    // Emulators already connected
    console.warn("Firebase emulators may already be connected:", error);
  }
}

export { app, auth, db, functions };
export default app;

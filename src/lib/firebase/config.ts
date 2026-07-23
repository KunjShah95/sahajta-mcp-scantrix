// Ported from Scantrix_v2 src/config/firebase.ts (branch frontend-ui-v2).
// firebaseConfig copied verbatim from the source file — NOT substituted with
// any values from GoogleService-Info.plist, which is stale/inert on that
// branch. getReactNativePersistence(AsyncStorage) has no web equivalent;
// replaced with the browser SDK default, which persists via IndexedDB.
import { getApp, getApps, initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC2fvQBg9xb7JjHSjqRnCJFuFJrCrPQgsM",
  authDomain: "scantrix-3d179.firebaseapp.com",
  projectId: "scantrix-3d179",
  storageBucket: "scantrix-3d179.firebasestorage.app",
  messagingSenderId: "244169573027",
  appId: "1:244169573027:web:9c0a382948954757bbf516",
};

// ✅ Ensure single app instance
const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// ✅ Typed auth — browser SDK default persistence (IndexedDB/localStorage)
const auth: Auth = getAuth(app);

// ✅ Typed Firestore & Storage
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };

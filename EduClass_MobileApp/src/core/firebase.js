import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmWJHJ6WrHT32DHOVyrJGXTDcoDRWbfkA",
  authDomain: "educlass-mobileapp.firebaseapp.com",
  projectId: "educlass-mobileapp",
  storageBucket: "educlass-mobileapp.firebasestorage.app",
  messagingSenderId: "742422030077",
  appId: "1:742422030077:web:1c98d0b70737e664218094",
  measurementId: "G-R0KFT80W52"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth dengan sesi tersimpan di HP (tidak perlu login ulang)
let auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch (e) {
  // Sudah diinisialisasi (terjadi saat Fast Refresh), pakai yang ada
  auth = getAuth(app);
}

// Auto-detect long polling membantu koneksi Firestore di React Native
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  db = getFirestore(app);
}

export { app, auth, db };
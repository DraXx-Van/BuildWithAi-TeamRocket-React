import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDMjbMpcbj6l9AXpIaeZ5cJpyEgnWxtbd4',
  appId: '1:767012601628:web:06b1d96e1bd2f4cafd04d9',
  messagingSenderId: '767012601628',
  projectId: 'aegis-hospitality-proto',
  authDomain: 'aegis-hospitality-proto.firebaseapp.com',
  databaseURL: 'https://aegis-hospitality-proto-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: 'aegis-hospitality-proto.firebasestorage.app',
  measurementId: 'G-GZZXDBB5GV',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getFirestore,
collection,
addDoc,
getDocs,
updateDoc,
deleteDoc, // Added here
doc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyDKle4Lj-r0AVCybAsA0fInlOhoneolbYk",
authDomain: "noonray-db777.firebaseapp.com",
projectId: "noonray-db777",
storageBucket: "noonray-db777.firebasestorage.app",
messagingSenderId: "275520776179",
appId: "1:275520776179:web:9ab0d7769cd708455cd486",
measurementId: "G-9HG7T5ZMVT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
db,
collection,
addDoc,
getDocs,
updateDoc,
deleteDoc, // Exported here
doc,
serverTimestamp
};

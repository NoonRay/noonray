
FIREBASE FIX FOR GITHUB PAGES

1. Open Firebase Console
2. Firestore Database
3. Rules
4. Paste:

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

5. Click Publish

6. Create Collection:
tasks

IMPORTANT:
Analytics removed because GitHub Pages can block analytics initialization.

INDEX PAGE FIXED:
Now index.html opens normally instead of redirecting to login.

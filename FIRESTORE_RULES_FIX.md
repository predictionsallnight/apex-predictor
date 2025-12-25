# Fix Firestore Security Rules - REQUIRED!

The "missing or insufficient permissions" error means Firestore rules are blocking access.

## Quick Fix (2 Minutes):

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **apexpred-77460**
3. Go to **Firestore Database** → **Rules** (top tab)
4. Replace ALL rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Whitelist codes - allow read and write (for sign-in and UID linking)
    match /whitelist_codes/{codeId} {
      allow read: if true;  // Anyone can read codes
      allow write: if true; // Allow writes for UID linking
    }
    
    // Users collection - allow read and write
    match /users/{userId} {
      allow read: if true;
      allow write: if true; // Allow writes for account creation
    }
    
    // Whitelist collection - allow read and write
    match /whitelist/{userId} {
      allow read: if true;
      allow write: if true; // Allow writes for whitelisting
    }
  }
}
```

5. Click **"Publish"** button
6. Wait 10 seconds
7. Try signing in again!

## That's It! ✅

After updating rules, if the code exists in Firebase, access is granted immediately!


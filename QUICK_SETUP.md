# Quick Firebase Setup Guide

## Step 1: Get Your Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create/Select your project
3. Go to Project Settings (gear icon) → Your apps → Web
4. Copy the `firebaseConfig` object

## Step 2: Update the Script

In `bloxscript.js`, find this section (around line 18):

```javascript
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Replace with your actual Firebase config values.

## Step 3: Enable Authentication

1. Firebase Console → Authentication → Get started
2. Enable **Email/Password** sign-in
3. Enable **Google** sign-in (optional but recommended)

## Step 4: Create Firestore Database

1. Firebase Console → Firestore Database → Create database
2. Start in **test mode** (we'll add rules)
3. Choose location

## Step 5: Set Security Rules

Firestore → Rules → Paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /whitelist/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }
  }
}
```

Click **Publish**.

## Step 6: Add Users to Whitelist

### When a user signs up:

1. They create account via the script
2. Go to Firebase Console → Authentication → Users
3. Find their email and copy their **UID**
4. Go to Firestore → Data → `whitelist` collection
5. Add document with:
   - **Document ID**: Their UID (paste it)
   - **Fields**:
     - `email` (string): their email
     - `active` (boolean): `true`
     - `tier` (string): `"premium"` (optional)

### Example Whitelist Document:
```
Collection: whitelist
Document ID: abc123xyz789 (user's UID)
Fields:
  email: "user@example.com"
  active: true
  tier: "premium"
```

## Step 7: Test

1. Load the script on bloxgame.us
2. You should see login modal
3. Sign up or sign in
4. If whitelisted → predictor appears
5. If not whitelisted → error message

## How It Works

1. **User opens script** → Login modal appears
2. **User signs in** → Firebase authenticates
3. **Script checks Firestore** → Looks for user's UID in `whitelist` collection
4. **If found and active** → Predictor UI loads
5. **If not found** → Error message, no access

## Security Notes

- ✅ User UID is used (can't be faked)
- ✅ Firestore rules prevent unauthorized reads
- ✅ Only you can add users to whitelist
- ✅ Each user can only read their own whitelist entry
- ⚠️ Firebase config is visible in script (this is normal for client-side auth)
- ⚠️ Consider using Firebase Functions for additional server-side validation

## Managing Users

**Add User:**
1. User signs up → Get their UID from Authentication
2. Add document to `whitelist` collection with their UID

**Remove User:**
1. Delete their document from `whitelist` collection
2. Or set `active: false` in their document

**Deactivate User:**
- Set `active: false` in their whitelist document
- They'll see "account is not active" error

## Troubleshooting

- **"Failed to initialize"**: Check Firebase config values
- **"Permission denied"**: Check Firestore security rules
- **"Not whitelisted"**: User UID not in whitelist collection
- **Login modal not showing**: Check browser console for errors
- **Script not loading**: Check @grant permissions (should be `none`)


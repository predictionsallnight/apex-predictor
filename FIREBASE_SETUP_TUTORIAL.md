# Firebase Authentication & Whitelist Setup Tutorial

## 🎯 Quick Overview

**What you're doing:**
1. Create Firebase project (free)
2. Enable login (email/password)
3. Create database to store who's allowed
4. Add security rules (copy/paste)
5. Get your config code
6. Add users to whitelist when they sign up

**Time needed:** About 10 minutes

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Name your project (e.g., "ApexPredictor")
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Get started**
2. Click **Sign-in method** tab
3. Enable these providers:
   - **Email/Password**: Click → Enable → Save
   - **Google**: Click → Enable → Add support email → Save

## Step 3: Create Firestore Database (Super Simple!)

**This is where we store who's allowed to use the script.**

1. In Firebase Console, click **"Firestore Database"** in the left menu
2. Click **"Create database"** button
3. Choose **"Start in test mode"** (just click it, don't worry about the warning)
4. Pick a location (choose the one closest to you)
5. Click **"Enable"** button
6. Wait a few seconds... done! ✅

**That's it for creating the database!**

---

## Step 4: Set Up Security Rules (Copy & Paste)

**This keeps your data safe. Just copy and paste this code.**

1. In Firestore Database, click the **"Rules"** tab at the top
2. You'll see some code already there - **DELETE ALL OF IT**
3. **COPY AND PASTE** this code:

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

4. Click **"Publish"** button
5. Done! ✅

**Don't worry about what this code does - it just keeps your data safe!**

---

## Step 5: Create the Whitelist Collection (Easy!)

**This is where you'll add users who can use the script.**

### First Time Setup:

1. In Firestore Database, click the **"Data"** tab at the top
2. Click **"Start collection"** button (big blue button)
3. **Collection ID**: Type exactly: `whitelist` (all lowercase, no spaces)
4. Click **"Next"** button
5. **DON'T ADD ANYTHING YET** - just click **"Save"** (we'll add users later)
6. Done! You now have a `whitelist` collection! ✅

### Adding Your First User (After They Sign Up):

**Wait until someone signs up first! Then follow these steps:**

1. Go to **Authentication** → **Users** tab
2. Find the person who signed up (look for their email)
3. Next to their email, you'll see a long code (like `abc123xyz789`) - **THIS IS THEIR UID**
4. **COPY THAT UID** (click on it, then Ctrl+C or Cmd+C)

5. Go back to **Firestore Database** → **Data** tab
6. Click on the **`whitelist`** collection (you should see it now)
7. Click **"Add document"** button
8. **Document ID**: **PASTE THE UID YOU COPIED** (this is the important part!)
9. Click **"Add field"** button:
   - Field name: `email`
   - Type: Click dropdown, choose **"string"**
   - Value: Type their email address
   - Click **"Update"**
10. Click **"Add field"** again:
    - Field name: `active`
    - Type: Click dropdown, choose **"boolean"**
    - Value: **Check the box** (should show `true`)
    - Click **"Update"**
11. Click **"Save"** button
12. Done! That user can now use the script! ✅

**Repeat steps 7-12 for each new user you want to add!**

## Step 6: Get Your Firebase Config & Add It to Script

**This is the code that connects your script to Firebase. You need to copy it from Firebase and paste it into your script.**

### Part A: Get the Config from Firebase

1. In Firebase Console, click the **gear icon** ⚙️ (top left, next to "Project Overview")
2. Click **"Project settings"**
3. Scroll down to the **"Your apps"** section
4. You'll see different platform icons (iOS, Android, Web, etc.)
5. Click the **Web icon** (`</>`) - it looks like angle brackets
6. If you haven't registered a web app yet:
   - Click **"Register app"** button
   - App nickname: Type `ApexPredictor` (or anything you want)
   - **DON'T check** "Also set up Firebase Hosting" (we don't need it)
   - Click **"Register app"** button
7. You'll see a code block that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz",
  authDomain: "your-project-name.firebaseapp.com",
  projectId: "your-project-name",
  storageBucket: "your-project-name.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

8. **COPY ALL OF THIS CODE** (select it all, then Ctrl+C or Cmd+C)

### Part B: Paste It Into Your Script

1. Open your `bloxscript.js` file in your code editor
2. Find this section (around line 20):

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

3. **DELETE** all the placeholder text (the `YOUR_API_KEY_HERE` stuff)
4. **PASTE** the code you copied from Firebase
5. **IMPORTANT**: Make sure it says `const FIREBASE_CONFIG = {` (not `firebaseConfig`)
   - If it says `firebaseConfig`, change it to `FIREBASE_CONFIG`
6. Save the file

**Example of what it should look like after:**

```javascript
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz",
    authDomain: "my-project.firebaseapp.com",
    projectId: "my-project-name",
    storageBucket: "my-project-name.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};
```

**That's it! Your script is now connected to Firebase!** ✅

## Step 7: Add Authorized Domains (IMPORTANT!)

**This fixes the "website not authorized" error!**

1. In Firebase Console, click **"Authentication"** in the left menu
2. Click **"Settings"** tab (at the top, next to "Users" and "Sign-in method")
3. Scroll down to **"Authorized domains"** section
4. You'll see a list of domains like:
   - `localhost` (already there)
   - `your-project.firebaseapp.com` (already there)
   - `your-project.web.app` (already there)

5. Click **"Add domain"** button
6. Type: `bloxgame.us` (exactly like this, no www, no https://)
7. Click **"Add"** button
8. You should now see `bloxgame.us` in the list! ✅

**Also add www version (optional but recommended):**
- Click **"Add domain"** again
- Type: `www.bloxgame.us`
- Click **"Add"**

**That's it! The error should be gone now!** 🎉

## Step 8: Adding Users to Whitelist (The Easy Way!)

**Every time someone new wants to use your script, do this:**

### Step-by-Step:

1. **User signs up first:**
   - They go to bloxgame.us
   - They see the login modal
   - They click "Sign Up"
   - They enter email and password
   - They click "Create Account"
   - **A modal will pop up showing their UID!** (You can copy it from there)
   - **OR** check the browser console (F12) - it will also log the UID
   - **OR** go to Firebase Console → Authentication → Users to find it

2. **You get their UID (3 ways):**
   
   **Method 1: From the Modal (Easiest!)**
   - When user signs up, a green modal appears
   - It shows their email and UID
   - Click the "📋 Copy UID" button
   - Paste it somewhere safe
   
   **Method 2: From Browser Console**
   - Open browser console (Press F12)
   - Look for a message that says "NEW USER SIGNED UP!"
   - You'll see: Email and UID listed
   - Copy the UID from there
   
   **Method 3: From Firebase Console**
   - Go to Firebase Console
   - Click **"Authentication"** → **"Users"** tab
   - Find their email in the list
   - Next to their email, copy the **UID** (the long random code)

3. **You add them to whitelist:**
   - Go to **"Firestore Database"** → **"Data"** tab
   - Click on **"whitelist"** collection
   - Click **"Add document"**
   - **Document ID**: Paste the UID you copied
   - Click **"Add field"**:
     - Name: `email`, Type: string, Value: their email
   - Click **"Add field"** again:
     - Name: `active`, Type: boolean, Value: check the box (true)
   - Click **"Save"**

4. **Done!** They can now sign in and use the script! ✅

### Removing Someone:

- Go to Firestore → whitelist collection
- Find their document (by their UID or email)
- Click the three dots (...) → Delete

### Deactivating Someone (Without Deleting):

- Go to Firestore → whitelist collection
- Click on their document
- Click on the `active` field
- Change it to `false` (uncheck the box)
- Click "Update"

## Step 9: Security Best Practices

1. **Never expose Admin SDK credentials** in Tampermonkey script
2. **Use Firestore security rules** to prevent unauthorized access
3. **Validate on server side** if possible (Firebase Functions)
4. **Use environment variables** for sensitive config (if using build tools)
5. **Monitor usage** via Firebase Analytics

## Step 10: Testing

1. Create a test user account
2. Add them to whitelist in Firestore
3. Test login flow
4. Verify whitelist check works
5. Test with non-whitelisted user (should be blocked)

## Troubleshooting

### "Permission denied" Error
- **Fix**: Go to Firestore → Rules tab
- Make sure you pasted the security rules code correctly
- Click "Publish" again

### "User not whitelisted" Error
- **Fix**: Check that you:
  1. Created a document in `whitelist` collection
  2. Used their UID as the Document ID (not their email!)
  3. Set `active` to `true` (checked box)
- **How to check**: Go to Firestore → Data → whitelist → see if their UID document exists

### "Failed to initialize" Error
- **Fix**: Check your Firebase config in the script
- Make sure you replaced ALL the placeholder values
- Double-check for typos

### User Can't Sign In
- **Fix**: Make sure you enabled Email/Password in Authentication → Sign-in method

### Script Shows Login But Nothing Happens
- **Fix**: Open browser console (F12) and check for errors
- Make sure Firebase config is correct
- Make sure user is actually in the whitelist collection

## Next Steps

After setup, the script will:
1. Show login modal on load
2. Authenticate user (email/password or Google)
3. Check if user UID exists in `whitelist` collection
4. Only show predictor if whitelisted
5. Store auth state in localStorage (optional)


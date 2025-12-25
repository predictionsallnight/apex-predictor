# Whitelist Setup - One Page Cheat Sheet

## What is UID?
**UID = User ID** - A unique code Firebase gives each user (like: `abc123xyz789`)

## Quick Steps (2 Minutes)

### 1. User Signs Up
- User goes to bloxgame.us
- Clicks "Sign Up" 
- Enters email/password
- Clicks "Create Account"

### 2. You Get Their UID
1. Firebase Console → **Authentication** → **Users**
2. Find their email
3. Copy the **UID** (the long code next to their email)

### 3. You Add Them to Whitelist
1. Firebase Console → **Firestore Database** → **Data**
2. Click **"Start collection"** (or **"Add document"** if collection exists)
3. Collection ID: `whitelist`
4. Document ID: **Paste the UID here** ← THIS IS THE IMPORTANT PART
5. Add fields:
   - `email` (string): their email
   - `active` (boolean): check box (true)
   - `tier` (string): `premium` (optional)
6. Click **"Save"**

### 4. Done!
User can now sign in and use the predictor!

---

## Visual Example

```
Firebase Console → Authentication → Users
┌─────────────────────────────────────────┐
│ Email              │ UID                 │
│ user@example.com   │ abc123xyz789       │ ← Copy this!
└─────────────────────────────────────────┘

Firebase Console → Firestore → whitelist
┌─────────────────────────────────────────┐
│ Document ID: abc123xyz789  ← Paste UID  │
│ Fields:                                  │
│   email: "user@example.com"             │
│   active: true                           │
│   tier: "premium"                        │
└─────────────────────────────────────────┘
```

---

## Remember
- **Document ID = UID** (paste the UID you copied)
- **Collection = whitelist** (exactly this name, lowercase)
- **active = true** (must be checked/enabled)

That's it! 🎉


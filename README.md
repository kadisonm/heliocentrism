# Heliocentrism
Heliocentrism is a vibe coded dashboard to simply organise your life, events, projects, and to-dos.

Heliocentrism: the earth still orbits the sun. Every day, without fail, no matter what's happening down here. Heliocentrism helps you carry that same quiet steadiness — for the days you need reminding that this, too, keeps turning.

## Why is this vibe coded?
I needed a dashboard personalised to **me** with the features that I need in order to organise my life better and keep on top of my study/work.

I personally love programming, it has been my passion since I was a kid. In almost ALL cases, I prefer to code using my own brain and type with my own fingers. But, I do know that taking on a project of this magnitude will suck a lot of time out of the projects that I am truly passionate about.

I am vibe coding this app to free up time for me to actually work on and code my passion projects.

**Transparency** with AI is important! Any repositories that I am actively maintaining docs, reviewing pull requests and fixing issues are all done by me personally. If a project uses AI like this one, it will be VERY clearly stated in the description and README.

## Firebase Sync Setup (User-Owned)

This app uses Firebase for cross-browser sync. To avoid shared billing, each user provides their own Firebase project config in Settings.

### 1) Create your Firebase project

1. Create a project in Firebase Console on the Spark plan.
2. Enable Firestore Database and select a server close to you.
3. Click `Add App` and select `Web`.
4. On the left sidebar, click `Security > Authentication`
5. Click `Get Started` and select `Native Providers` and optionally `Google`.
4. Note down the values provided in this format:

```
const firebaseConfig = {
    apiKey:...,
    authDomain:...,
    projectId:...,
    storageBucket:...,
    messagingSenderId:...,
    appId:...
};
```

### 2) Add config in Heliocentrism

1. Open Settings in the dashboard.
2. Fill in API Key, Auth Domain, Project ID, and App ID (required).
3. Save config.
4. Sign in with Google or Email.

### 3) Firestore rules baseline

Use rules that scope documents to the signed-in user id:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email == "youremail@example.com";
    }

    match /{document=**} {
      allow read, write: if isOwner();
    }
  }
}
```

Replace {"youremail@example.com"} with the email you used to sign in.

This ensures only your account can read and write to the database.

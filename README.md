# ReflectAI — Authenticated Journal & Gemini Reflections

A user-authenticated web application built with **React**, **Express**, **Firebase Authentication**, **Cloud Firestore**, and **Gemini 3.6 Flash**. ReflectAI allows users to write multi-turn journal reflections and converse with Gemini for empathetic insights, brainstorming, and executive summaries—with all interactions strictly isolated to the authenticated user in Firestore.

---

## 🏗️ Architecture & Security Zones

| Component | Technology | Security & Isolation Pattern |
| :--- | :--- | :--- |
| **Authentication** | Firebase Auth (Google Sign-In) | Federated identity only. No passwords stored or handled. |
| **Database** | Cloud Firestore | User-scoped path isolation: `/users/{userId}/entries/{entryId}` & `/users/{userId}/interactions/{interactionId}`. |
| **AI Engine** | Gemini 3.6 Flash (`@google/genai`) | Express server proxy with automated fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`). |
| **Secrets** | Secret Manager & Environment Variables | Gemini API key strictly server-side; never exposed to browser. |

---

## 🔒 Firestore Security Rules

Deploy the following security rules to ensure user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🚀 Google Cloud Run & Secret Manager Deployment Guide

### 1. Prerequisites & GCP API Setup
Enable the necessary Google Cloud APIs in your project:
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

### 2. Secret Manager Configuration
Store the `GEMINI_API_KEY` securely in Google Cloud Secret Manager:
```bash
# 1. Create the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add your Gemini API Key as the secret payload
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the default Cloud Run Compute service account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy to Google Cloud Run
Deploy the container directly using `gcloud run deploy`:
```bash
gcloud run deploy reflect-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000
```

### 4. Apply Required Campaign Labeling
Register the deployed Cloud Run service for the AI Challenge automated verification:
```bash
gcloud run services update reflect-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## ⚡ Vercel Deployment Guide

ReflectAI includes built-in Vercel Serverless Function support via `api/index.ts` and `vercel.json`.

### 1. Push to GitHub & Import to Vercel
1. Push your repository to GitHub / GitLab.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** > **Project** and import the repository.
3. Framework Preset: **Vite** (Build command: `npm run build`, Output directory: `dist`).

### 2. Configure Environment Variables in Vercel
In **Project Settings** > **Environment Variables**, add the following keys:
- `GEMINI_API_KEY`: Your Gemini API key from Google AI Studio.
- *(Optional)* `GROQ_API_KEY`: For ultra-low latency fallback inference.

> ⚠️ **Why did Vercel show "Failed to generate summary from Gemini"?**  
> By default, Vercel only deploys Vite's static `dist/` frontend and does not run standalone Node servers (`server.ts`).  
> With our `vercel.json` rewrites and `api/index.ts` serverless adapter, Vercel routes `/api/*` requests directly to the serverless function, allowing Gemini & Groq APIs to function seamlessly.

---

## 🧪 Functional Walkthrough & Test Guide

1. **Authentication Flow**:
   - Navigate to the landing page. Click **Continue with Google** (or **Try Anonymous Guest Session** for instant test sandbox).
   - Verify that upon login, the header updates with user credentials, Firestore badge, and navigation tabs.

2. **Journaling & AI Reflection**:
   - In the **Studio** tab, enter a title or choose one of the preset prompts (e.g. *Gratitude & Joy* or *Decision Crossroads*).
   - Select a Focus / Mood tag.
   - Choose an AI Lens: `Reflect & Inquire`, `Brainstorm Next Steps`, or `Mindfulness & Reframing`.
   - Submit your reflection. Verify that Gemini 3.6 Flash responds with empathetic analysis and probing questions.
   - Send follow-up multi-turn responses to continue the conversation.

3. **Synthesis & Executive Summary**:
   - Click the **Synthesize Summary** button to generate a structured core essence, key insights, and actionable micro-step.

4. **Firestore Realtime Persistence & Isolation**:
   - Notice the **Synced to Cloud** status indicator.
   - Switch to the **History** tab. Verify the new entry is listed with turn count, timestamp, and mood tag.
   - Test keyword search and mood filters.
   - Test the **Export as Markdown** and **Delete** buttons.

5. **Analytics & Insights**:
   - Switch to the **Insights** tab to review total entries, dialogue turns, word count, and mood distribution.

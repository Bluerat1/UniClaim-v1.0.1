# Lost and Found App Repository

## Monorepo Layout

- **frontend/**: Vite + React 19 web dashboard for managing lost and found tickets, analytics, and admin tooling.
- **mobile/**: Expo/React Native client that mirrors core ticket, chat, and notification experiences for end users.
- **docs/**: Product, QA, and engineering reference material covering features such as notification flows, flagging, and test plans.
- **firebase._ / firestore._ / storage.rules**: Firebase Hosting, Firestore, and Storage configuration used by both clients.
- **scripts/**/\*.js|ts\*\*: Utility scripts to maintain Firebase data, migrate conversations, and ensure subscription consistency.

## Tech Stack Overview

- **Web**: React 19, TypeScript, Vite, Tailwind CSS, Chart.js (analytics dashboards), Leaflet/React-Leaflet (mapping), Cloudinary integrations.
- **Mobile**: React Native 0.81 (Expo SDK 54), Expo Router, NativeWind, Firebase client SDK, device APIs (notifications, secure storage, media, location).
- **Backend Services**: Firebase Authentication, Firestore, Cloud Storage, and Cloud Messaging. Cloudinary is used for media management across platforms.
- **Tooling**: ESLint 9, TypeScript ~5.9, Autoprefixer, Lightning CSS, Tailwind tooling, Expo developer tooling.

## Core Functionality

- **Ticket Lifecycle**: Create, view, update, and delete lost or found item tickets with image upload/deletion managed through Cloudinary.
- **Realtime Sync**: Firebase provides live updates for posts, analytics, and chat conversations on both web and mobile.
- **Chat & Handover Workflows**: Dedicated chat interfaces (web and Expo) supporting claim/handover requests and system messages.
- **Analytics**: Web dashboard offers category distribution and other insights via reusable Chart.js components.
- **Notifications**: Push notification setup and optimization documented under `docs/`, with Expo notifications used on mobile.

## Setup & Installation

1. **Install dependencies**
   - Web: `cd frontend && npm install`
   - Mobile: `cd mobile && npm install`
2. **Environment variables**
   - Web: duplicate `frontend/env_temp.txt` to `.env` and configure Firebase + Cloudinary keys (see `frontend/README.md`).
   - Mobile: manage Expo environment in `mobile/.env` and keep credentials aligned with Firebase project settings.
3. **Firebase Configuration**
   - Ensure `.firebaserc`, `firebase.json`, and `firestore.rules` reflect the target project.
   - Update Firestore/Storage rules before deployment when schema changes.

## Key Scripts

- **Web (`frontend/package.json`)**
  1. `npm run dev` – start Vite dev server.
  2. `npm run build` – type-check then produce production build.
  3. `npm run lint` – run ESLint across the frontend.
  4. `npm run ensure-subscriptions` – execute cross-repo subscription script via `ts-node`.
- **Mobile (`mobile/package.json`)**
  1. `npm run start` – launch Expo CLI.
  2. `npm run android | ios | web` – platform-specific Expo entry points.
  3. `npm run lint` – Expo lint runner.
  4. `npm run reset-project` – convenience script to clear local Expo state.

## Linting, Testing & Quality

- ESLint configurations exist for both frontend (`eslint.config.js`) and mobile (`eslint.config.js` via Expo).
- TypeScript config files (`tsconfig*.json`) govern build-time checks for each client.
- No automated test suites are currently defined; QA plans live under `docs/` (e.g., notification and flagging test plans).

## Documentation Highlights

- **docs/frontend/**: Feature-specific retrospectives (e.g., realtime filtering, claim rejection photo deletion).
- **docs/mobile/**: Performance testing and release notes for the Expo client.
- **docs/scripts/**: Firebase admin scripts and debugging utilities.
- **docs/utils/**: Editing guides and coordinate utilities for location-related features.

## Useful Paths & Assets

- **frontend/src/**: React components, analytics charts (e.g., `components/analytics/charts/CategoryDistributionChart.tsx`), hooks, services, and types.
- **frontend/public/firebase-messaging-sw.js**: Service worker for Firebase Cloud Messaging in the web client.
- **mobile/app/**: Expo Router routes (tabs, Chat screen) and layout wrappers.
- **mobile/components/**: Shared UI elements (ImagePicker, NotificationPreferences, PostCard, etc.).
- **mobile/context/**: React context providers for auth, notifications, messaging, and coordinates.
- **mobile/utils/firebase/**: Firebase client initialization and helper utilities.

## Deployment Considerations

- Web build output lives in `frontend/dist/`; align deployment with Firebase Hosting or Vercel configuration (`frontend/vercel.json`).
- Expo projects rely on `app.json`, `eas.json`, and `android/` native config for builds.
- Update Cloudinary credentials and Firebase rule files prior to production deployments.

Keep this file updated whenever new packages, services, or major workflows are introduced to maintain accurate repository context.

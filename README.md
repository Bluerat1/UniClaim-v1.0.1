UniClaim - Lost and Found Platform
UniClaim is a comprehensive platform designed to reunite lost items with their owners through a synchronized ecosystem of web and mobile applications. It leverages modern technologies to provide real-time reporting, in-app communication, and advanced location-based searches.


🏗 Project Architecture
The repository is organized into three main sections:

1. Frontend (Web)
Core: Built with React 18/19 and Vite for fast development.

Styling: Utilizes Tailwind CSS and Radix UI primitives for a responsive, accessible interface.

Mapping: Features interactive maps powered by Leaflet and OpenLayers.

Analytics: Integrated Chart.js for data visualization within the admin dashboard.

2. Mobile (iOS & Android)
Framework: Developed using Expo (v54) and React Native.

Styling: Uses NativeWind (Tailwind for React Native) to maintain styling consistency with the web.

Native Features: Camera integration for quick photo reports, push notifications via expo-notifications, and offline support using AsyncStorage.

3. Backend (Firebase & Cloudinary)
Authentication: Firebase Auth for secure user and admin management.

Database: Cloud Firestore and Firebase Realtime Database for live updates.

Storage: Cloudinary manages all image uploads and media assets.

🚀 Getting Started
Prerequisites
Node.js (v18+)

Firebase CLI & Expo CLI

Installation
Clone and Root Setup

Bash
git clone [repository-url]
npm install
Frontend Setup

Bash
cd frontend
npm install
Mobile Setup

Bash
cd mobile
npm install
Development Commands
Target	Command
Web (Dev)	cd frontend && npm run dev
Mobile (Expo)	cd mobile && npx expo start
Web (Build)	cd frontend && npm run build
🛠 Key Features
Reporting System: Post lost/found items with photos and detailed location tagging.

Communication: Direct in-app messaging between finders and owners.

Admin Dashboard: Manage flagged posts, view system analytics, and handle user verification.

Data Export: Generate reports in PDF or Excel formats directly from the web application.

Real-time Notifications: Instant alerts for matches, messages, and claim updates across platforms.

📂 Documentation
For deeper technical insights, refer to the /docs folder:

DELETE_ACCOUNT_VALIDATION.md

EDITING_GUIDE.md

scripts/: Contains administrative scripts for user migration and setup.

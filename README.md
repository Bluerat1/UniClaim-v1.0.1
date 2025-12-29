# UniClaim - Lost and Found App

UniClaim is a tool that helps people find things they lost. It has a website and a mobile app that work together to show reported items and help people talk to each other to get their things back.

## 🏗️ How it's Made

### Website (Frontend)
* **React 18/19**: The main building block for the website.
* **Vite**: Makes the website load and run fast for developers.
* **Tailwind CSS**: Used to make the website look good on all screens.
* **Maps**: Uses Leaflet and OpenLayers to show where items were found.

### Mobile App
* **Expo & React Native**: Used to build the app for both Android and iPhones.
* **Native Features**: Uses the phone's camera to take pictures of items and sends alerts (notifications) to your phone.
* **NativeWind**: Makes the app look the same as the website.

### Database & Storage (Backend)
* **Firebase**: Handles user logins and saves all the item information.
* **Cloudinary**: A safe place where all the item photos are stored.
---


## 🚀 Getting Started


### What you need
* **Node.js**: Version 18 or newer.
* **Firebase & Expo CLI**: Tools to help run and put the app online.

### How to Install
1. **Get the code:**
   ```bash
   git clone [repository-url]
   cd "lost and found app 2"

	 Install everything:

Bash

## Root folder
```npm install```

## Website folder
```cd frontend && npm install```

## Mobile app folder
```cd ../mobile && npm install```


## How to Run
* **To start the website**: <br>
cd frontend then npm run dev.

* **To start the app**:  <br>
cd mobile then npx expo start.

## 🛠️ Main Features
* Report Items: Easily post about things you found or lost with photos and locations.

* Chat: Send messages directly to other users to arrange a meetup.

* Admin Tools: Special dashboard for staff to manage reports and see stats.

* Export Data: Save lists of items as PDF or Excel files.

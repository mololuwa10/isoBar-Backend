# Isometric Exercise App

This repository contains the backend code for the Isometric Exercise App, which is designed to manage training sessions and ambulatory blood pressure diaries. The backend is built using Node.js, Express, and Firebase.

- User Authentication & Authorization: Ensures that only authenticated users can access and modify their own diaries and training exercises.
- Diary Management: CRUD operations for managing blood pressure diary entries, including time slots for specific activities and events.
- Training Sessions: Support for creating and updating training sessions for a user's health regimen over a 10-week period.
- RESTful API: Adheres to RESTful principles for easy integration with frontend applications.

# Key Endpoints:
- POST /api/trainingSessions: Create or update a training session.
- GET /api/trainingSessions: Retrieve all training sessions for the authenticated user.
- PUT /api/trainingSessions/:sessionId/:weekNumber: Update a specific training session.
- GET /api/bloodPressureDiary/:diaryId: Retrieve a specific blood pressure diary.
- PUT /api/bloodPressureDiary/:diaryId/timeSlot/:timeSlotIndex: Update a specific time slot in the blood pressure diary.

# Technologies Used:
- Node.js: Backend runtime environment.
- Express.js: Web framework for building RESTful APIs.
- Firebase Firestore: NoSQL database for storing diary and training session data.
- Firebase Authentication: For user authentication and security.

# Prerequisites:

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm (v6 or higher)
- Firebase account and project setup


# Installation

1. Clone the repository:
   - git clone https://github.com/mololuwa10/isoBar-Backend.git
   - cd isometric-exercise-app
     
2. Install dependencies:
   - npm install
     
3. Set up firebase:
   - Create a firebase project at https://console.firebase.google.com
   - Create a firebaseConfig.js file in the Config directory with your Firebase configuration.
     
4. Set up Firebase Admin SDK:
   - Go to the Firebase Console, navigate to Project Settings, and then to the Service accounts tab.
   - Generate a new private key and save the JSON file.
   - Place the JSON file in the Config directory and rename it to firebaseAdminConfig.json.
  
5. Start the server:
   - npm run dev
     
# Project Structure

- index.js: Entry point of the application.
- firebase.js: Firebase client configuration.
- firestoreFunctions.js: Contains functions interacting with Firestore.
- Config: Directory containing configuration files.
- DatabaseFields.txt: Describes the structure of the database fields.
- test.json: Sample test data.
- test.rest: REST client test file.

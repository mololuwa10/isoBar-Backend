# isoBar-Backend

Ambulatory Blood Pressure Diary and Training Exercises API
The API allows users to create, view, and update their blood pressure diary entries. Key features include:

- User Authentication & Authorization: Ensures that only authenticated users can access and modify their own diaries.
- Diary Management: CRUD operations for managing blood pressure diary entries, including time slots for specific activities and events.
- Training Sessions: Support for creating and updating training sessions for a user's health regimen over a 10-week period.
- RESTful API: Adheres to RESTful principles for easy integration with frontend applications.

Key Endpoints:
- POST /api/trainingSessions: Create or update a training session.
- GET /api/trainingSessions: Retrieve all training sessions for the authenticated user.
- PUT /api/trainingSessions/:sessionId/:weekNumber: Update a specific training session.
- GET /api/bloodPressureDiary/:diaryId: Retrieve a specific blood pressure diary.
- PUT /api/bloodPressureDiary/:diaryId/timeSlot/:timeSlotIndex: Update a specific time slot in the blood pressure diary.

Technologies Used:
- Node.js: Backend runtime environment.
- Express.js: Web framework for building RESTful APIs.
- Firebase Firestore: NoSQL database for storing diary and training session data.
- Firebase Authentication: For user authentication and security.

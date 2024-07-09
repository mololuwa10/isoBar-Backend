const express = require('express');
const cors = require('cors');
const { db, admin, storage } = require('./firebase.js')
const { createUser, 
  loginUser, 
  editUser,
  deleteUser,
  createDefaultAdmin, 
  createExercise, 
  getAllExercises, 
  getExercise, 
  updateExercise, 
  deleteExercise,
  createTrainingSession,
  createOrUpdateTrainingSession,
  calculateWeekNumber } = require('./firestoreFunctions.js');

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');

const app = express();

// Middleware to parse JSON
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
    res.send("Isometric Exercise App Backend");
});

// Initialize default admin
createDefaultAdmin().catch(console.error);

// Initialize time slots
const initializeTimeSlots = () => {
  const times = [
    "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
    "22:00", "22:30", "23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"
  ];

  return times.map(time => ({
    time,
    activity: "",
    event: "",
    notes: ""
  }));
};

// Middleware to authenticate token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      // console.log('Token verified successfully:', decodedToken);
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(401).send({ error: 'Invalid or expired token' });
    }
  } else {
    res.status(401).send({ error: 'No token provided' });
  }
};

// Middleware to authorize admin
const authorizeAdmin = async (req, res, next) => {
  const userId = req.user.uid;
  const userDoc = await db.collection('db_user_roles').doc(userId).get();
  if (userDoc.exists && userDoc.data().role === 'ROLE_ADMIN') {
    next();
  } else {
    res.status(403).send({ error: 'Forbidden: Admins only' });
  }
};


// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Create users =============================================================
app.post('/api/register', async (req, res) => {
  const userData = req.body;

  // Log the received data for debugging
  console.log('Received data:', userData);

  try {
    const { userId, token, role } = await createUser(userData);
    res.status(201).send({ userId, token, role });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Edit users
app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const updatedData = req.body;
  const currentUser = req.user; 

  // Log the received data for debugging
  console.log('Received data:', updatedData);

  try {
      await editUser(userId, updatedData, currentUser);
      res.status(200).send({ message: 'User updated successfully.' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

// Delete Users
app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    const currentUser = req.user; // Assuming req.user contains the authenticated user info

    try {
        await deleteUser(userId, currentUser);
        res.status(200).send({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// ===========================================================================

// Login user ============================================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Log the received data for debugging
    console.log('Received login data:', { email, password });

    try {
      const { userId, firstname, lastname, age, gender, address, height, weight, token, role } = await loginUser(email, password);
      res.status(200).send({ userId, firstname, lastname, age, gender, address, height, weight, email, token, role });
    } catch (error) {
      res.status(401).send({ error: error.message });
    }
});
// =============================================================================

// EXERCISE ENDPOINTS ==================================================================
// Create Exercises (ADMIN ONLY) 
app.post('/api/exercises', authenticateToken, authorizeAdmin, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 10 }
]), async(req, res) => {
  const { name, description } = req.body;
  const userId = req.user.uid;
  const imageFiles = req.files && req.files.images ? req.files.images : [];
  const videoFiles = req.files && req.files.videos ? req.files.videos : [];

  // Log the received data for debugging
  console.log('Received exercise data:', { name, description, imageFiles, videoFiles });

  if (imageFiles.length === 0 && videoFiles.length === 0) {
    console.error('No files received');
    return res.status(400).send({ error: 'No files received' });
  }

  try {
    // Get current date
    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

    // Upload images and get their URLs
    const imageUrls = await Promise.all(imageFiles.map(async file => {
      const fileId = uuidv4();
      const fileRef = ref(storage, `/exercises/images/${fileId}-${formattedDate}-${file.originalname}`);
      await uploadBytes(fileRef, file.buffer);
      const fileUrl = await getDownloadURL(fileRef);
      console.log(`Uploaded image ${file.originalname} to ${fileUrl}`);
      return fileUrl;
    }));

    // Upload videos and get their URLs
    const videoUrls = await Promise.all(videoFiles.map(async file => {
      const fileId = uuidv4();
      const fileRef = ref(storage, `/exercises/videos/${fileId}-${formattedDate}-${file.originalname}`);
      await uploadBytes(fileRef, file.buffer);
      const fileUrl = await getDownloadURL(fileRef);
      return fileUrl;
    }));

    const exerciseId = await createExercise(userId, name, description, imageUrls, videoUrls);
    res.status(201).send({ exerciseId });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
})

// Get Exercise by ID
app.get('/api/exercises/:id', async (req, res) => {
    const { id } = req.params;

  try {
    const exercise = await getExercise(id);
    res.status(200).send(exercise);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get All Exercises
app.get('/api/exercises', async (req, res) => {
  try {
    const exercises = await getAllExercises();
    res.status(200).send(exercises);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update Exercise (Admin only)
app.put('/api/exercises/:id', authenticateToken, authorizeAdmin, upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 10 }
]), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const userId = req.user.uid;
  const imageFiles = req.files && req.files.images ? req.files.images : [];
  const videoFiles = req.files && req.files.videos ? req.files.videos : [];

  try {
    // Get current date
    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

    const updates = { name, description };

    if (imageFiles.length > 0) {
      const imageUrls = await Promise.all(imageFiles.map(async file => {
        const fileId = uuidv4();
        const fileRef = ref(storage, `/exercises/images/${fileId}-${formattedDate}-${file.originalname}`);
        await uploadBytes(fileRef, file.buffer);
        const fileUrl = await getDownloadURL(fileRef);
        return fileUrl;
      }));
      updates.images = imageUrls;
    }

    if (videoFiles.length > 0) {
      const videoUrls = await Promise.all(videoFiles.map(async file => {
        const fileId = uuidv4();
        const fileRef = ref(storage, `/exercises/videos/${fileId}-${formattedDate}-${file.originalname}`);
        await uploadBytes(fileRef, file.buffer);
        const fileUrl = await getDownloadURL(fileRef);
        return fileUrl;
      }));
      updates.videos = videoUrls;
    }

    await updateExercise(userId, id, updates);
    res.status(200).send({ message: 'Exercise updated successfully' });
  } catch (error) {
      res.status(500).send({ error: error.message });
  }
});

// Delete Exercise (Admin only)
app.delete('/api/exercises/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;
  try {
    await deleteExercise(userId, id);
    res.status(200).send({ message: 'Exercise deleted successfully' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});
// ========================================================================

// TRAINING SESSION ENDPOINTS =====================================================
// Create Training Session
app.post('/api/trainingSessions', authenticateToken, async (req, res) => {
  const { sessionNumber, notes } = req.body;
  const userId = req.user.uid;
  
  try {
    // Check if the user already has existing sessions
    const existingSessions = await getUserSessions(userId);
    
    if (existingSessions.length > 0) {
      return res.status(403).send({ error: 'Forbidden: You already have existing sessions. Update them instead.' });
    }

    // Calculate the week number dynamically based on user's first session date
    const startDate = await getStartDate(userId); 
    const weekNumber = calculateWeekNumber(startDate, new Date()) + 1; 

    // Create the training session
    await createOrUpdateTrainingSession(userId, weekNumber, sessionNumber, notes, getStartDate);

    res.status(201).send({ message: 'Training session created successfully.' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update Training Session
app.put('/api/trainingSessions/:sessionId/:weekNumber', authenticateToken, async (req, res) => {
  const sessionId = req.params.sessionId;
  const weekNumber = req.params.weekNumber;
  const { sessionNumber, notes } = req.body;
  const userId = req.user.uid;

  try {
    // Check if the user has permission to update this session (authorization logic)
    const session = await getUserSession(userId, sessionId);
    // console.log(session);
    if (!session) {
      return res.status(404).send({ error: 'Session not found.' });
    }

    // Ensure the session belongs to the user
    if (session.userId !== userId) {
      return res.status(403).send({ error: 'Forbidden: You are not authorized to update this session.' });
    }

    // Determine the week field to update based on the session's weekNumber
    const weekField = `week${String(weekNumber).padStart(2, '0')}`;     
    console.log(weekField);
    const weekSessions = session[weekField];

    // Check if the week field exists in the session
    if (!weekSessions) {
      return res.status(404).send({ error: `Week ${session.week} not found in session.` });
    }

    // Ensure sessionNumber increments up to 3 per week
    if (weekSessions.length >= 3 && !weekSessions.find(s => s.sessionNumber === sessionNumber)) {
      return res.status(403).send({ error: 'You have reached the limit of 3 sessions for this week.' });
    }

    // Find and update the session notes or add a new session if it doesn't exist
    const sessionToUpdate = weekSessions.find(s => s.sessionNumber === sessionNumber);
    if (sessionToUpdate) {
      sessionToUpdate.notes = notes;
    } else {
      weekSessions.push({ sessionNumber, notes });
    }

    // Find and update the session notes
    const updatedWeekSessions = weekSessions.map(session => {
      if (session.sessionNumber === sessionNumber) {
        return { ...session, notes };
      }
      return session;
    });

    // Update Firestore document with the updated weekSessions
    const updateData = {};
    updateData[weekField] = updatedWeekSessions;

    await db.collection('db_trainingSessions').doc(sessionId).update(updateData);

    res.status(200).send({ message: 'Training session updated successfully.' });
  } catch (error) {
    console.error('Error updating training session:', error);
    res.status(500).send({ error: error.message });
  }
});

// Function to get user's existing sessions or a specific session by sessionId
const getUserSession = async (userId, sessionId) => {
  const sessionSnapshot = await db.collection('db_trainingSessions')
    .where('userId', '==', userId)
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();

  if (sessionSnapshot.empty) {
    return null;
  }

  // Since sessionId is unique, there should be only one document
  const sessionData = sessionSnapshot.docs[0].data();
  return sessionData;
};

const getUserSessions = async (userId) => {
  const sessionSnapshot = await db.collection('db_trainingSessions')
    .where('userId', '==', userId)
    .limit(1) // Assuming you only need to check if any sessions exist
    .get();

  if (sessionSnapshot.empty) {
    return [];
  }

  // Map through the sessionSnapshot to get an array of sessions
  return sessionSnapshot.docs.map(doc => doc.data());
};

// Function to get user's start date based on their first session creation
const getStartDate = async (userId) => {
  // Query Firestore to find the earliest session date for the user
  const userSessions = await db.collection('db_trainingSessions')
    .where('userId', '==', userId)
    .orderBy('dateOfCompletion', 'asc')
    .limit(1)
    .get();

  if (!userSessions.empty) {
    return userSessions.docs[0].data().dateOfCompletion.toDate();
  } else {
    // If no sessions exist for the user, default to current date
    return new Date();
  }
};

// Get Users training Session
app.get('/api/trainingSessions', authenticateToken, async (req, res) => {
  const userId = req.user.uid;

  try {
    const sessionsSnapshot = await db.collection('db_trainingSessions').where('userId', '==', userId).get();
    const sessions = sessionsSnapshot.docs.map(doc => doc.data());
    res.status(200).send(sessions);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
})
// =====================================================================================

// BLOOD PRESSURE DIARY ENDPOINTS ===================================================================
// Create Blood Pressure Diary
app.post('/api/bloodPressureDiary', authenticateToken, async (req, res) => {
  const userId = req.user.uid;
  const { date } = req.body;

  try {
    const diaryRef = db.collection('db_bloodPressureDiaries').doc();
    const timeSlots = initializeTimeSlots();

    await diaryRef.set({
      bloodPressureDiaryId: diaryRef.id,
      userId,
      date: admin.firestore.FieldValue.serverTimestamp(),
      timeSlots
    });

    res.status(201).send({ message: 'Blood Pressure diary created successfully'});
  } catch (error) {
    console.error('Error creating blood pressure diary: ', error)
    res.status(500).send({ error: error.message });
  }
});

// Update a specific time slot in the blood pressure diary
app.put('/api/bloodPressureDiary/:diaryId/timeSlot/:timeSlotIndex', authenticateToken, async (req, res) => {
  const userId = req.user.uid;
  const diaryId = req.params.diaryId;
  const timeSlotIndex = parseInt(req.params.timeSlotIndex, 10);
  const { activity, event, notes } = req.body;

  try {
    const diarySnapshot = db.collection('db_bloodPressureDiaries').doc(diaryId);
    const diaryDoc = await diarySnapshot.get();

    if (!diaryDoc.exists) {
      return res.status(404).send({error: 'Diary Not Found'});
    }

    const diaryData = diaryDoc.data();

    if (diaryData.userId !== userId) {
      return res.status(403).send({error: 'Forbidden: You are not authorized to update this diary'});
    }

    const timeSlots = diaryData.timeSlots;

    if (timeSlotIndex < 0 || timeSlotIndex >= timeSlots.length) {
      return res.status(400).send({error: 'Invalid time slot index'});
    }

    // Update the time slot
    timeSlots[timeSlotIndex] = {
      ...timeSlots[timeSlotIndex],
      activity,
      event,
      notes
    };

    await diarySnapshot.update({ timeSlots });

    res.status(200).send({ message: 'Time slot updated successfully.' });
  } catch (error) {
    console.error('Error getting blood pressure diary: ', error);
    res.status(500).send({ error: error.message });
  }
})

// Get Users Blood Pressure Diaries
app.get('/api/bloodPressureDiaries', authenticateToken, async (req, res) => {
  const userId = req.user.uid;

  try {
    const diariesSnapshot = await db.collection('db_bloodPressureDiaries')
      .where('userId', '==', userId)
      .get();
    
      if (diariesSnapshot.empty) {
        return res.status(404).send({error: 'No blood Pressure diary found'});
      }

      const diaries = diariesSnapshot.docs.map(doc => ({
        bloodPressureDiaryId: doc.id,
        ...doc.data()
      }));

      res.status(200).send(diaries);
  } catch (error) {
    console.error('Error getting blood pressure diaries: ', error);
    res.status(500).send({ error: error.message });
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
});

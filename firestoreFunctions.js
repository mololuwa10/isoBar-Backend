const { db, firebase, admin } = require('./firebase.js');
const { getAuth, signInWithEmailAndPassword, sendEmailVerification } = require('firebase/auth');
const bcrypt = require('bcrypt');

// User role validation ======================================
const validateAdmin = async(userId) => {
    const userDoc = await db.collection('db_user_roles').doc(userId).get();
    if(userDoc.exists && userDoc.data().role == 'ROLE_ADMIN') {
        return true;
    } 
    return false;
}
// ==========================================================

// Users Collection ====================================================
const createUser = async (userData) => {
    const { firstname, lastname, email, password, dateOfBirth, address, phoneNumber, gender, height, weight, restingBloodPressure } = userData;

    if (!firstname || !lastname || !email || !password || !dateOfBirth || !address || !phoneNumber || !gender ) {
        throw new Error('Missing required fields');
    }

    try {
        // Generate a salt (random string) for password hashing
        const saltRounds = 10; // Adjust this value as needed (higher = more secure)
        const salt = await bcrypt.genSalt(saltRounds);

        // Hash the password using the generated salt
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create User with firebase authentication
        const user = await admin.auth().createUser({
            email: email,
            password: password,
        });

        const userId = user.uid;

        // Create User with firestore
        await db.collection('db_users').doc(userId).set({
            userId: userId,
            firstname: firstname,
            lastname: lastname,
            email: email,
            password: hashedPassword,
            dateOfBirth: dateOfBirth,
            age: calculateAge(dateOfBirth),
            address: address,
            phoneNumber: phoneNumber,
            gender: gender,
            height: height,
            weight: weight,
            restingBloodPressure: restingBloodPressure,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`User created with ID: ${userId}`);

        // Assign user role
        await db.collection('db_user_roles').doc(userId).set({
            role: 'ROLE_USER'
        });

        // Sign in the user with Firebase Client SDK
        const userCredentials = await signInWithEmailAndPassword(getAuth(), email, password);
        const authUser = userCredentials.user;
        const token = await authUser.getIdToken();

        // Retrieve user role
        const userDoc = await db.collection('db_user_roles').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('User role not found');
        }
        const userRole = userDoc.data().role;

        // Send verification email
        await sendEmailVerification(authUser);

        return {userId: userId, token: token, userRole: userRole};
    } catch(error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Edit User
const editUser = async(userId, updatedData, currentUser) => {
    const { firstname, lastname, dateOfBirth, address, phoneNumber, gender, height, weight, restingBloodPressure } = updatedData;

    // Check if the current user is an admin or the user themselves
    if (currentUser.role !== 'ROLE_ADMIN' && currentUser.uid !== userId) {
        throw new Error('Unauthorized to edit user details');
    }

    try {
        const userRef = db.collection('db_users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const updateData = {};
        if (firstname) updateData.firstname = firstname;
        if (lastname) updateData.lastname = lastname;
        if (dateOfBirth) {
            updateData.dateOfBirth = dateOfBirth;
            updateData.age = calculateAge(dateOfBirth);
        }
        if (address) updateData.address = address;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (gender) updateData.gender = gender;
        if (height) updateData.height = height;
        if (weight) updateData.weight = weight;
        if (restingBloodPressure) updateData.restingBloodPressure = restingBloodPressure;

        await userRef.update(updateData);
        console.log(`User with ID: ${userId} updated successfully`);
    } catch (error) {
        console.error('Error editing user:', error);
        throw error;
    }
}
// Delete User
const deleteUser = async (userId, currentUser) => {
    // Check if the current user is an admin or the user themselves
    if (currentUser.role !== 'ROLE_ADMIN' && currentUser.uid !== userId) {
        throw new Error('Unauthorized to delete user');
    }

    try {
        // Delete the user from Firebase Authentication
        await admin.auth().deleteUser(userId);

        // Delete the user from Firestore
        await db.collection('db_users').doc(userId).delete();
        await db.collection('db_user_roles').doc(userId).delete();
        console.log(`User with ID: ${userId} deleted successfully`);
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
};


/**
 * Calculates the age based on the provided date of birth.
 *
 * @param {string} dateOfBirth - The date of birth in the format 'YYYY-MM-DD'.
 * @return {number} The calculated age.
 */
const calculateAge = (dateOfBirth) => {
    const dob = new Date(dateOfBirth);
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

const createDefaultAdmin = async () => {
    const adminEmail = "admin@example.com";
    const adminPassword = "AdminSecurePassword123";

    try {
        // Check if admin user exists
        const userRecord = await admin.auth().getUserByEmail(adminEmail);

        // Admin user already exists
        console.log('Admin user already exists:', userRecord.uid);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            // Admin user does not exist, create it
            const adminUser = await admin.auth().createUser({
                email: adminEmail,
                password: adminPassword,
            });
            const adminUserId = adminUser.uid;

            // Create Admin user with firestore
            await db.collection('db_users').doc(adminUserId).set({
                firstname: 'Admin',
                lastname: 'User',
                email: adminEmail,
                password: await bcrypt.hash(adminPassword, 10),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Assign admin role
            await db.collection('db_user_roles').doc(adminUserId).set({
                role: 'ROLE_ADMIN'
            });

            console.log(`Default admin created with ID: ${adminUserId}`);
        } else {
            console.error('Error fetching admin user:', error);
        }
    }
}
// ======================================================================

// Login function ==========================================================
const loginUser = async (email, password) => {
    if(!email || !password) {
        throw new Error('Email and password are required');
    }

    try {
        const userCredential = await signInWithEmailAndPassword(getAuth(), email, password);
        const user = userCredential.user;
        const token = await user.getIdToken();

        // Retrieve user role
        const userDoc = await db.collection('db_user_roles').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('User role not found');
        }
        const userRole = userDoc.data().role;

        return { userId: user.uid, 
            firstname: user.firstname, 
            lastname: user.lastname, 
            age: user.age, 
            gender: user.gender, 
            address: user.address, 
            height: user.height, 
            weight: user.weight, 
            email: user.email, 
            token: token, 
            role: userRole}
    } catch (error) {
        console.error('Error logging in: ', error);
        throw error;
    }
}
// ==============================================================================

/**
 * Creates or updates a training session for a user.
 * 
 * @param {string} userId - The ID of the user.
 * @param {number} weekNumber - The number of the week.
 * @param {number} sessionNumber - The number of the session within the week.
 * @param {string} notes - The notes for the session.
 * @param {function} getStartDate - A function that returns the start date of the training program.
 * @returns {Promise<string>} - The ID of the created/updated session.
 * @throws {Error} - If there is an error creating/updating the session.
 */
const createOrUpdateTrainingSession = async (userId, weekNumber, sessionNumber, notes, getStartDate) => {
    try {
        // Calculate dates
        const startDate = await getStartDate(userId); // Get the start date of the training program
        const dateStarted = admin.firestore.Timestamp.fromDate(startDate); // Convert the start date to a Firestore Timestamp

        // Calculate end date after 10 weeks
        const endDate = new Date(dateStarted.seconds * 1000); // Convert the Firestore Timestamp to a JavaScript Date
        endDate.setDate(endDate.getDate() + 7 * 10); // Calculate the end date by adding 70 weeks (10 weeks * 7 days)
        const dateOfCompletion = admin.firestore.Timestamp.fromDate(endDate); // Convert the end date to a Firestore Timestamp

        // Get reference to the user's training session document
        const sessionRef = db.collection('db_trainingSessions').doc(); // Create a reference to a new document in the 'db_trainingSessions' collection

        // Run a Firestore transaction to ensure atomic updates
        await db.runTransaction(async (transaction) => {
            // Retrieve the current session data or initialize if it doesn't exist
            let sessionDoc = await transaction.get(sessionRef); // Get the current session data or initialize if it doesn't exist
            const sessionData = sessionDoc.exists ? sessionDoc.data() : { userId, dateStarted, dateOfCompletion }; // Get the data from the session document or an empty object if it doesn't exist

            // Ensure the structure for weeks exists
            for (let i = 1; i <= 10; i++) {
                const weekKey = `week${String(i).padStart(2, '0')}`; // Pad the week number with leading zeros
                if (!sessionData.hasOwnProperty(weekKey)) {
                    sessionData[weekKey] = []; // Initialize the structure for each week if it doesn't exist
                }
            }
           
            // Ensure sessionNumber increments up to 3 per week
            const weekKey = `week${String(weekNumber).padStart(2, '0')}`; // Pad the week number with leading zeros
            const weekSessions = sessionData[weekKey]; // Get the sessions for the week
            if (weekSessions.length >= 3) {
                throw new Error('You have reached the limit of 3 sessions for this week.'); // Throw an error if the limit is reached
            }

            let sessionToUpdate = weekSessions.find(session => session.sessionNumber === sessionNumber);
            if (sessionToUpdate) {
                // Update existing session notes
                sessionToUpdate.notes = notes;
            } else {
                // Add new session to the current week
                weekSessions.push({ sessionNumber, notes }); // Add the new session to the week
            }

            // Update the session document with the new session data
            transaction.set(sessionRef, {
                sessionId: sessionRef.id, // Set the ID of the session
                userId, // Set the ID of the user
                dateStarted, // Set the start date of the session
                dateOfCompletion, // Set the completion date of the session
                ...sessionData // Merge the existing session data with the new data
            });
        });

        console.log(`Training session created/updated successfully for week ${weekNumber}, session ${sessionNumber}`); // Log a success message
        return sessionRef.id; // Return the ID of the created/updated session
    } catch (error) {
        console.error('Error creating/updating training session: ', error); // Log an error message
        throw error; // Throw the error
    }
};

// const createOrUpdateTrainingSession = async (userId, notes) => {
//     try {
//         // Get the user's start date and all sessions
//         const startDate = await getStartDate(userId);
//         const dateStarted = admin.firestore.Timestamp.fromDate(startDate);
//         const existingSessions = await getUserSessions(userId);

//         // Calculate the current week and session number
//         let weekNumber, sessionNumber;
//         if (existingSessions.length === 0) {
//             weekNumber = 1;
//             sessionNumber = 1;
//         } else {
//             // Determine the last week and session
//             const lastSession = existingSessions[existingSessions.length - 1];
//             console.log('Last session:', lastSession);

//             if (lastSession && lastSession.week) {
//                 const lastWeekNumber = parseInt(lastSession.week.replace('week', ''));
//                 const lastSessionNumber = lastSession.sessions.length;

//                 if (lastSessionNumber < 3) {
//                     weekNumber = lastWeekNumber;
//                     sessionNumber = lastSessionNumber + 1;
//                 } else {
//                     weekNumber = lastWeekNumber + 1;
//                     sessionNumber = 1;
//                 }
//             } else {
//                 throw new Error('Invalid last session data.');
//             }
//         }

//         // Calculate the end date for the training program (10 weeks from start date)
//         const endDate = new Date(dateStarted.seconds * 1000);
//         endDate.setDate(endDate.getDate() + 7 * 10);
//         const dateOfCompletion = admin.firestore.Timestamp.fromDate(endDate);

//         // Get reference to the user's training session document
//         const sessionRef = db.collection('db_trainingSessions').doc(userId);

//         // Run a Firestore transaction to ensure atomic updates
//         await db.runTransaction(async (transaction) => {
//             let sessionDoc = await transaction.get(sessionRef);
//             let sessionData = sessionDoc.exists ? sessionDoc.data() : { sessionId: sessionRef.id ,userId, dateStarted, dateOfCompletion };

//             // Ensure the structure for the current week exists
//             const weekKey = `week${String(weekNumber).padStart(2, '0')}`;
//             if (!sessionData.hasOwnProperty(weekKey)) {
//                 sessionData[weekKey] = [];
//             }

//             // Add the new session to the current week
//             sessionData[weekKey].push({ sessionNumber, notes });

//             // Update the session document with the new session data
//             transaction.set(sessionRef, sessionData);
//         });

//         console.log(`Training session created/updated successfully for week ${weekNumber}, session ${sessionNumber}`);
//         return sessionRef.id;
//     } catch (error) {
//         console.error('Error creating/updating training session: ', error);
//         throw error;
//     }
// };

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
/**
 * Calculates the week number based on the start date and session date.
 *
 * @param {Date} startDate - The start date of the training program.
 * @param {Date} sessionDate - The date of the session.
 * @return {number} The week number.
 */
const calculateWeekNumber = (startDate, sessionDate) => {
  const startDateTime = startDate.getTime();
  const sessionDateTime = sessionDate.getTime();
  
  // Calculate the difference in milliseconds between session date and start date
  const timeDifference = sessionDateTime - startDateTime;
  
  // Convert milliseconds to weeks
  const millisecondsInWeek = 7 * 24 * 60 * 60 * 1000;
  const weekNumber = Math.ceil(timeDifference / millisecondsInWeek);
  
  return weekNumber;
};

// BloodPressureDiary Collection ======================================================================
const createBloodPressureEntry = async (userId, time, activity, event, notes) => {
  const entryRef = db.collection('db_bloodPressureDiary').doc();
  const entryId = entryRef.id;
  await entryRef.set({ entryId, userId, time, activity, event, notes });
  console.log(`Blood pressure entry created with ID: ${entryId}`);
  return entryId;
};

// Exercises Collection ===================================================
// Get all exercise
const getAllExercises = async () => {
    const snapshot = await db.collection('db_exercises').get();
    return snapshot.docs.map(doc => doc.data());
};

// Get Exercises by Id
const getExercise = async (exerciseId) => {
    const exerciseDoc = await db.collection('db_exercises').doc(exerciseId).get();
    if (!exerciseDoc.exists) {
        throw new Error('Exercise not found');
    }
    return exerciseDoc.data();
};

// Create Exercise
const createExercise = async (userId, name, description, imageUrls, videoUrls) => {
    if (!(await validateAdmin(userId))) {
        throw new Error('Unauthorized: Only admins can create exercises');
    }

    const exerciseRef = db.collection('db_exercises').doc();
    const exerciseId = exerciseRef.id;
    await exerciseRef.set({ exerciseId, name, description, images: imageUrls, videos: videoUrls });
    console.log(`Exercise created with ID: ${exerciseId}`);
    return exerciseId;
};

// Update Exercise
const updateExercise = async (userId, exerciseId, updates) => {
    if(!(await validateAdmin(userId))) {
        throw new Error('Unauthorized: Only admins can update exercises');
    }

    const exerciseRef = db.collection('db_exercises').doc(exerciseId);
    await exerciseRef.update(updates);
    console.log(`Exercise updated with ID: ${exerciseId}`);
}

// Delete Exercise
const deleteExercise = async (userId, exerciseId) => {
    if(!(await validateAdmin(userId))) {
        throw new Error('Unauthorized: Only admins can delete exercises');
    }

    const exerciseRef = db.collection('db_exercises').doc(exerciseId);
    await exerciseRef.delete();
    console.log(`Exercise deleted with ID: ${exerciseId}`);
}
// ===========================================================================

module.exports = {
  createUser,
  editUser,
  deleteUser,
  loginUser,
  createDefaultAdmin,
//   createTrainingSession,
  createOrUpdateTrainingSession,
  calculateWeekNumber,
  createBloodPressureEntry,
  createExercise,
  getExercise,
  updateExercise,
  deleteExercise,
  getAllExercises
};
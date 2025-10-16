// index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GeoPoint } = require('@google-cloud/firestore');

const nodemailer = require('nodemailer');
const { onDocumentCreated } = require('firebase-functions/firestore');
const { v4: uuidv4 } = require("uuid");
const busboyUploadToStorageMiddleware = require("./busboyUploadToStorageMiddleware");

admin.initializeApp();


const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY || 'external-api-key-here';
const db = admin.firestore();
const bucket = admin.storage().bucket();


function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== EXTERNAL_API_KEY) {
    return res.status(401).json({ message: 'Invalid or missing API key' });
  }
  next();
}

// Auth middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });

  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Rate limiting middleware (basic in-memory limiter for demo; use Redis or Firestore for production)
const rateLimit = require('express-rate-limit');
const guestListLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window per IP
  message: { message: 'Too many requests, please try again later.' },
});


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "noreply.planit.online@gmail.com",
        pass: "viwxojqfceyzmjye"
    }
});

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://witty-stone-03009b61e.1.azurestaticapps.net',
    'https://event-flow-6514.onrender.com/'
  ],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
//app.use(limiter);

const upload = multer({ storage: multer.memoryStorage() });


app.use((req, res, next) => {
  // If request is JSON → run express.json()
  if (req.is("application/json")) {
    return express.json()(req, res, next);
  }
  // Otherwise (e.g. multipart/form-data for uploads) → skip
  next();
});


//VENDOR=============================================
app.post('/vendor/apply', authenticate, async (req, res) => {
  try {
    const { businessName, phone, email, description, category, address, profilePic } = req.body;
    let profilePicURL = '';

    if (profilePic) {
      const buffer = Buffer.from(profilePic, 'base64');
      const fileRef = bucket.file(`Vendor/${req.uid}/profile.jpg`);
      await fileRef.save(buffer, { contentType: 'image/jpeg' });
      await fileRef.makePublic();
      profilePicURL = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;
    }

    await db.collection('Vendor').doc(req.uid).set({
      businessName,
      phone,
      email,
      description,
      category,
      address: address || 'None',
      profilePic: profilePicURL,


      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: 'Vendor application submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});



// Get the vendor profile
app.get('/vendor/me', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('Vendor').doc(req.uid).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const vendorData = doc.data();

    res.json({
      ...vendorData,
      profilePic: vendorData.profilePic || null // ensure field always exists
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update the vendor's profile
app.put('/vendor/me', authenticate, async (req, res) => {
  try {
    const { description, address, phone, email, profilePic } = req.body;
    let profilePicURL = '';

    if (profilePic) {
      const buffer = Buffer.from(profilePic, 'base64');
      const fileRef = bucket.file(`Vendor/${req.uid}/profile.jpg`);
      await fileRef.save(buffer, { contentType: 'image/jpeg' });
      await fileRef.makePublic();
      profilePicURL = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;
    }

    await db.collection('Vendor').doc(req.uid).update({
      description,
      address,
      phone,
      email,
      ...(profilePicURL && { profilePic: profilePicURL }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//These functions are for getting vendor bookings to work with planner service requests
// Get the services a vendor has been booked for
app.get('/vendor/bookings/services', authenticate, async (req, res) => {
  try {
    const vendorID = req.uid;
    const eventsSnapshot = await db.collection("Event").get();
    const vendorBookings = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventData = eventDoc.data();

      // Get all services for this event
      const servicesSnapshot = await db
        .collection("Event")
        .doc(eventDoc.id)
        .collection("Services")
        .where("vendorId", "==", vendorID)
        .get();

      if (!servicesSnapshot.empty) {
        const vendorServices = servicesSnapshot.docs.map(svcDoc => ({
          serviceId: svcDoc.id,
          ...svcDoc.data()
        }));

        vendorBookings.push({
          eventId: eventDoc.id,
          eventPlanner: eventData.plannerId,
          eventName: eventData.name,
          description: eventData.description,
          date: eventData.date,
          location: eventData.location,
          budget: eventData.budget,
          expectedGuestCount: eventData.expectedGuestCount,
          style: eventData.style,
          specialRequirements: eventData.specialRequirements || [],
          eventCategory: eventData.eventCategory,
          theme: eventData.theme,

          // all services from this event assigned to this vendor
          vendorServices,
        });
      }
    }

    res.json({ vendorID, bookings: vendorBookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});




//Get the vendor bookings from the Event collection
// completely donw
app.get('/vendor/bookings', authenticate, async (req, res) => {
  try {
    const vendorID = req.uid;
    const eventsSnapshot = await db.collection("Event").get();
    const vendorEvents = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const vendorsRef = db.collection("Event").doc(eventDoc.id).collection("Vendors").doc(vendorID);
      const vendorDoc = await vendorsRef.get();
      if (vendorDoc.exists) {
        const eventData = eventDoc.data();
        vendorEvents.push({

          budget:eventData.budget,
          eventId: eventDoc.id,
          eventName: eventData.name,
          description: eventData.description,

          date: eventData.date,
          location: eventData.location,
          expectedGuestCount: eventData.expectedGuestCount,

          style: eventData.style,
          specialRequirements: eventData.specialRequirements||[],
          eventCategory: eventData.eventCategory,
          theme: eventData.theme,

          vendorServices: vendorDoc.data().vendoringCategoriesNeeded || [], // services map for this vendor
          status: vendorDoc.data().status || "pending",     // optional overall status
        });
      }
    }

    res.json({ vendorID, bookings: vendorEvents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.put("/event/:eventId/vendor/:vendorId/status", authenticate, async (req, res) => {
  try {
    const { eventId, vendorId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const servicesRef = db
      .collection("Event")
      .doc(eventId)
      .collection("Services")
      .where("vendorId", "==", vendorId);

    const servicesSnap = await servicesRef.get();

    if (servicesSnap.empty) {
      return res.status(404).json({ message: "No services found for vendor" });
    }

    // Update all service docs under this vendor
    const batch = db.batch();
    servicesSnap.forEach((doc) => {
      batch.update(doc.ref, { status });
    });
    await batch.commit();

    res.json({ message: "Service status updated successfully" });
  } catch (err) {
    console.error("Error updating service status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



app.put("/vendor/:eventId/contract",authenticate,upload.single("contract"),
  async (req, res) => {
    try {
      const vendorId = req.uid;
      const eventId = req.params.eventId;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type" });
      }

      // Upload to Firebase Storage
      const fileName = `contracts/${eventId}/${vendorId}/${uuidv4()}-${file.originalname}`;
      const fileRef = storage.bucket().file(fileName); // make sure to use .bucket()
      await fileRef.save(file.buffer, { metadata: { contentType: file.mimetype } });

      const [downloadUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: new Date("2026-09-03"),
      });

      // Update Firestore
      const vendorRef = db.collection("Event").doc(eventId).collection("Vendors").doc(vendorId);
      const vendorSnap = await vendorRef.get();
      if (!vendorSnap.exists) {
        return res.status(404).json({ message: "Vendor not found for this event" });
      }

      await vendorRef.set({ contractUrl: downloadUrl }, { merge: true });

      res.json({ message: "Contract uploaded successfully", contractUrl: downloadUrl });
    } catch (err) {
      console.error("Error uploading contract:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);




app.get("/analytics/:vendorId", authenticate, async (req, res) => {
  try {
    const vendorId = req.params.vendorId; // Use the URL param
    console.log("Fetching analytics for vendor:", vendorId);

    // Fetch the Analytics document for this vendor
    const analyticsDoc = await db.collection("Analytics").doc(vendorId).get();
    if (!analyticsDoc.exists) {
      return res.status(404).json({ message: "Vendor analytics not found" });
    }

    const analyticsData = analyticsDoc.data();

    // Fetch Reviews subcollection
    const reviewsSnapshot = await db
      .collection("Analytics")
      .doc(vendorId)
      .collection("Reviews")
      .get();

    const reviews = reviewsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ ...analyticsData, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/////////////////////////Use to review a vendor////////////////////////////////
// POST - Save a review for a vendor
app.post("/analytics/:vendorId/reviews", authenticate, async (req, res) => {
  try {
    const vendorId = req.params.vendorId;
    const { review, timeOfReview, rating } = req.body;

    if (!review || !timeOfReview || rating == null) {
      return res.status(400).json({ message: "review, timeOfReview, and rating are required" });
    }

    // Reference to Reviews subcollection
    const reviewsRef = db
      .collection("Analytics")
      .doc(vendorId)
      .collection("Reviews");

    // Add a new review doc
    const newReviewRef = await reviewsRef.add({
      review,
      timeOfReview,
      rating,
      
    });

    res.status(201).json({
      message: "Review added successfully",
      id: newReviewRef.id,
      review,
      timeOfReview,
      rating,
    });
  } catch (err) {
    console.error("Error saving review:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



//================================================================
//-- Planner Routes
//================================================================

//Events with location pickers test
// Helper function to check if two events overlap in time
function eventsOverlap(event1Start, event1Duration, event2Start, event2Duration) {
  const event1End = new Date(event1Start.getTime() + event1Duration * 60 * 60 * 1000);
  const event2End = new Date(event2Start.getTime() + event2Duration * 60 * 60 * 1000);
  
  return event1Start < event2End && event2Start < event1End;
}

// Helper function to calculate distance between two coordinates (in meters)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaphi = (lat2 - lat1) * Math.PI / 180;
  const deltalamda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaphi / 2) * Math.sin(deltaphi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltalamda / 2) * Math.sin(deltalamda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Check for location conflicts
async function checkLocationConflict(newEventDate, newEventDuration, newEventCoords) {
  const PROXIMITY_THRESHOLD = 100; // 100 meters - same location
  
  const eventsSnapshot = await db.collection('Event').get();
  
  for (const doc of eventsSnapshot.docs) {
    const event = doc.data();
    
    // Skip if event doesn't have location coordinates
    if (!event.locationCoordinates || !event.date || !event.duration) {
      continue;
    }
    
    // Convert dates
    const existingEventDate = event.date.toDate ? event.date.toDate() : new Date(event.date);
    const newEventDateObj = new Date(newEventDate);
    
    // Check if events overlap in time
    if (eventsOverlap(newEventDateObj, newEventDuration, existingEventDate, event.duration)) {
      // Check if locations are close (within threshold)
      const distance = calculateDistance(
        newEventCoords.lat,
        newEventCoords.lng,
        event.locationCoordinates.lat,
        event.locationCoordinates.lng
      );
      
      if (distance < PROXIMITY_THRESHOLD) {
        return {
          conflict: true,
          conflictingEvent: {
            id: doc.id,
            name: event.name,
            date: existingEventDate,
            location: event.location,
            distance: Math.round(distance)
          }
        };
      }
    }
  }
  
  return { conflict: false };
}

// Updated Create Event Endpoint
app.post('/event/apply', authenticate, async (req, res) => {
  try {
    const {
      name,
      description,
      theme,
      location,
      locationCoordinates, // NEW: lat/lng object
      budget,
      expectedGuestCount,
      duration,
      eventCategory,
      notes,
      specialRequirements = [],
      style = [],
      tasks = [],
      vendoringCategoriesNeeded = [],
      files = null,
      schedules = null,
      services = null,
      date,
      plannerId
    } = req.body;

    // Validate location coordinates
    if (!locationCoordinates || !locationCoordinates.lat || !locationCoordinates.lng) {
      return res.status(400).json({ 
        message: 'Location coordinates are required' 
      });
    }

    // Check for location conflict
    const conflictCheck = await checkLocationConflict(
      date,
      Number(duration),
      locationCoordinates
    );

    if (conflictCheck.conflict) {
      return res.status(409).json({
        message: `Location conflict: Another event "${conflictCheck.conflictingEvent.name}" is scheduled at the same location and time`,
        conflictingEvent: conflictCheck.conflictingEvent
      });
    }

    // Create GeoPoint for Firestore
    const geoPoint = new GeoPoint(
      locationCoordinates.lat,
      locationCoordinates.lng
    );

    const newEvent = {
      name,
      description,
      theme,
      location,
      locationCoordinates: geoPoint, // Store as GeoPoint
      budget: Number(budget),
      expectedGuestCount: Number(expectedGuestCount),
      duration: Number(duration),
      eventCategory,
      notes,
      specialRequirements,
      style,
      tasks,
      vendoringCategoriesNeeded,
      files,
      schedules,
      services,
      date: date ? new Date(date) : null,
      status: "planning",
      plannerId,
      //createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("Event").add(newEvent);

    res.status(200).json({ 
      message: "Event created successfully", 
      id: docRef.id, 
      event: {
        ...newEvent,
        locationCoordinates: locationCoordinates // Return as plain object for response
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Also update the event update endpoint to check conflicts
app.put('/planner/me/:eventId', authenticate, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const updatedEventData = req.body;

    // If location or date/duration are being updated, check for conflicts
    if (updatedEventData.locationCoordinates || updatedEventData.date || updatedEventData.duration) {
      const existingEvent = await db.collection("Event").doc(eventId).get();
      
      if (!existingEvent.exists) {
        return res.status(404).json({ message: "Event not found" });
      }

      const existing = existingEvent.data();
      
      // Use new values if provided, otherwise use existing
      const checkDate = updatedEventData.date || existing.date;
      const checkDuration = updatedEventData.duration || existing.duration;
      const checkCoords = updatedEventData.locationCoordinates || existing.locationCoordinates;

      // Convert GeoPoint to plain object if needed
      const coords = checkCoords._latitude ? 
        { lat: checkCoords._latitude, lng: checkCoords._longitude } : 
        checkCoords;

      // Check for conflicts (excluding this event)
      const eventsSnapshot = await db.collection('Event').get();
      
      for (const doc of eventsSnapshot.docs) {
        if (doc.id === eventId) continue; // Skip current event
        
        const event = doc.data();
        
        if (!event.locationCoordinates || !event.date || !event.duration) {
          continue;
        }
        
        const existingEventDate = event.date.toDate ? event.date.toDate() : new Date(event.date);
        const newEventDateObj = checkDate.toDate ? checkDate.toDate() : new Date(checkDate);
        
        if (eventsOverlap(newEventDateObj, checkDuration, existingEventDate, event.duration)) {
          const eventCoords = event.locationCoordinates._latitude ?
            { lat: event.locationCoordinates._latitude, lng: event.locationCoordinates._longitude } :
            event.locationCoordinates;
          
          const distance = calculateDistance(
            coords.lat,
            coords.lng,
            eventCoords.lat,
            eventCoords.lng
          );
          
          if (distance < 100) {
            return res.status(409).json({
              message: `Location conflict: Event "${event.name}" is at the same location and time`,
              conflictingEvent: {
                id: doc.id,
                name: event.name,
                date: existingEventDate,
                location: event.location
              }
            });
          }
        }
      }
    }

    // Convert locationCoordinates to GeoPoint if provided
    if (updatedEventData.locationCoordinates) {
      updatedEventData.locationCoordinates = new GeoPoint(
        updatedEventData.locationCoordinates.lat,
        updatedEventData.locationCoordinates.lng
      );
    }

    await db.collection("Event").doc(eventId).update(updatedEventData);

    res.json({ message: "Event updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.post('/planner/profile', authenticate, busboyUploadToStorageMiddleware(undefined, (req) => `PlannerProfiles/${req.uid}`), async (req, res) => {
  try {
    const { name } = req.body;
    const bucket = admin.storage().bucket();
    const uploadedFiles = [];

    // Process uploaded file if exists
    if (req.uploads && Object.keys(req.uploads).length > 0) {
      for (const [field, storageFile] of Object.entries(req.uploads)) {
        // Generate a permanent download token
        const token = uuidv4();

        // Set metadata with the token
        await storageFile.setMetadata({
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        });

        // Construct the permanent URL
        const url = `https://firebasestorage.googleapis.com/v0/b/${storageFile.bucket.name}/o/${encodeURIComponent(
          storageFile.name
        )}?alt=media&token=${token}`;

        uploadedFiles.push({
          field,
          gsPath: `gs://${storageFile.bucket.name}/${storageFile.name}`,
          url, // permanent download URL
        });
      }
    }

    const profilePictureUrl = uploadedFiles.length > 0 ? uploadedFiles[0].url : null;

    // Update or create planner profile in Firestore
    const plannerRef = db.collection('Planner').doc(req.uid);
    const plannerDoc = await plannerRef.get();

    const profileData = {
      name: name || '',
      //updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (profilePictureUrl) {
      profileData.profilePicture = profilePictureUrl;
    }

    if (plannerDoc.exists) {
      // Update existing document
      await plannerRef.update(profileData);
    } else {
      // Create new document
      await plannerRef.set({
        ...profileData,
        //createdAt: admin.firestore.FieldValue.serverTimestamp(),
        uid: req.uid
      });
    }

    res.status(200).json({
      message: 'Profile updated successfully!',
      profile: {
        name: name,
        profilePicture: profilePictureUrl
      }
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send('Failed to update profile');
  }
});

app.get('/planner/profile', authenticate, async (req, res) => {
  try {
    const plannerRef = db.collection('Planner').doc(req.uid);
    const plannerDoc = await plannerRef.get();

    if (plannerDoc.exists) {
      res.status(200).json(plannerDoc.data());
    } else {
      res.status(404).json({ message: 'Planner profile not found' });
    }
  } catch (err) {
    console.error('Error fetching planner profile:', err);
    res.status(500).send('Failed to fetch planner profile');
  }
});


//Fetch events
app.get('/planner/me/events', authenticate, async (req, res) => {
  try {
    const plannerId = req.uid; 

    const snapshot = await db.collection("Event")
      .where("plannerId", "==", plannerId)
      .get();

    if (snapshot.empty) {
      return res.json({ plannerId, events: [] });
    }

    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ plannerId, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//Get the guests for a particular event
app.get('/planner/:eventId/guests', authenticate, async (req, res) =>{
  try{

    const eventId = req.params.eventId;
    const snapshot = await db.collection("Event").doc(eventId).collection("Guests").get();

    if(snapshot.empty){
      return res.json({message: "No guests found for this event"});
    }

    const guests = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() }));
    res.json({eventId, guests});
  }
  catch(err){
    console.error(err);
    res.status(500).json({message: "Server error"});
  }
});

//Get the vendors for a particular event
app.get('/planner/:eventId/vendors', authenticate, async (req, res) => {

  try{
    const eventId = req.params.eventId;
    const snapshot = await db.collection("Event").doc(eventId).collection("Vendors").get();

    if(snapshot.empty){
      return res.json({message: "No vendors found for this event"});
    }

    const vendors = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() }));
    res.json({eventId, vendors});
  }
  catch(err){
    console.error(err);
    res.status(500).json({message: "Server error"});
  }

});

//Get all vendors for a particular planner
app.get('/planner/all/vendors', authenticate, async (req, res) => {
  try {
    const plannerId = req.uid;
    const eventsSnapshot = await db.collection("Event")
      .where("plannerId", "==", plannerId)
      .get();

    if (eventsSnapshot.empty) {
      return res.json({ vendors: [] });
    }

    const vendorSet = new Set();
    const vendors = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const vendorsSnapshot = await db.collection("Event")
        .doc(eventDoc.id)
        .collection("Vendors")
        .get();

      vendorsSnapshot.forEach(vendorDoc => {
        if (!vendorSet.has(vendorDoc.id)) {
          vendorSet.add(vendorDoc.id);
          vendors.push({ id: vendorDoc.id, ...vendorDoc.data() });
        }
      });
    }

    res.json({ vendors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//Delete an event for a planner
app.delete('/planner/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventRef = db.collection('Event').doc(eventId);

   
    await eventRef.delete();

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while deleting event' });
  }
});

//Create a guest manually
app.post('/planner/me/:eventId/guests', authenticate, async (req, res) => {

  try{
    const eventId = req.params.eventId;
    const guestDetails = req.body;

    await db.collection("Event").doc(eventId).collection("Guests").add({
      token: uuidv4(),
      ...guestDetails});

    res.json({message: "Guest added successfully"});
  }
  catch(err){
    console.error(err);
    res.status(500).json({message: "Server error"});
  }
});

//Create planner doc on signup
app.post('/planner/signup', async (req, res) => {
  try{
    const {uid, name, email, eventHistory, activeEvents, preferences} = req.body;

    const plannerDoc = {
      uid,
      name,
      email,
      eventHistory,
      activeEvents,
      preferences
    };

    await db.collection('Planner').doc(plannerDoc.uid).set(plannerDoc);

    res.json({message: "Planner successfully created"});

  }



  catch(err){
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

//Import guests
app.post('/planner/events/:eventId/guests/import', authenticate, async (req, res) => {
  try{
    const eventId = req.params.eventId;
    const { guests } = req.body;

    //Validate guest data
    const validGuests = guests.filter(guest => 
      guest.email && guest.firstname
    ).map(guest => ({
      token: uuidv4(),
      firstname: guest.firstname?.trim(),
      lastname: guest.lastname?.trim() || '',
      email: guest.email?.toLowerCase().trim(),
      rsvpStatus: 'pending'
    }));

    // Batch write to Firestore
    const batch = db.batch();
    const guestCollection = db.collection('Event').doc(eventId).collection('Guests');
    
    validGuests.forEach(guest => {
      const guestRef = guestCollection.doc();
      batch.set(guestRef, guest);
    });

    await batch.commit();
    return res.status(200).json({ success: true, imported: validGuests.length });
  }
  catch{
    console.error(error);
    return res.status(500).json({message: "Internal Server Error"});
  }
});

// Helper: Score a vendor based on category, profile, and services
const scoreVendor = (vendor, eventCategory, eventRequirements = {}) => {
  let score = 0;

  // Category match (strong weight)
  if (vendor.category && vendor.category.toLowerCase() === eventCategory.toLowerCase()) score += 50;

  // Profile completeness
  if (vendor.profilePic && vendor.profilePic.trim() !== "") score += 20;
  if (vendor.description && vendor.description.trim() !== "") score += 20;
  if (vendor.businessName && vendor.businessName.trim() !== "") score += 10;

  // Services: check if vendor has services that fit requirements
  if (vendor.services && vendor.services.length > 0) {
    vendor.services.forEach(service => {
      // Match service name with event category loosely
      if (service.name && eventCategory && service.name.toLowerCase().includes(eventCategory.toLowerCase())) {
        score += 30; // relevant service
      }

      // Reward lower base cost
      if (service.cost && service.cost < 5000) score += 10; // arbitrary threshold
      else if (service.cost && service.cost < 10000) score += 5;
    });
  }

  return score;
};

// Fetch best vendors for a specific event
app.get('/planner/events/:eventId/bestvendors', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ error: "eventId is required" });

    const eventSnap = await db.collection("Event").doc(eventId).get();
    if (!eventSnap.exists) return res.status(404).json({ error: "Event not found" });

    const event = eventSnap.data();
    const category = event.eventCategory;

    // Fetch approved vendors
    const vendorSnap = await db.collection("Vendor")
      .where("status", "==", "approved")
      .limit(100)
      .get();

    if (vendorSnap.empty) return res.status(200).json({ vendors: [] });

    // Batch process vendors to avoid memory issues
    const batchSize = 25; // Process 25 vendors at a time
    const vendorDocs = vendorSnap.docs;
    const allVendors = [];

    for (let i = 0; i < vendorDocs.length; i += batchSize) {
      const batch = vendorDocs.slice(i, i + batchSize);
      
      // Fetch services for this batch of vendors in parallel
      const batchPromises = batch.map(async (doc) => {
        try {
          const vendor = { id: doc.id, ...doc.data() };

          // Get services for this vendor with limit
          const servicesSnap = await db.collection("Vendor")
            .doc(doc.id)
            .collection("Services")
            .limit(50) // Limit services per vendor
            .get();

          vendor.services = servicesSnap.docs.map(s => ({ id: s.id, ...s.data() }));

          // Score the vendor
          vendor.score = scoreVendor(vendor, category);
          
          return vendor;
        } catch (error) {
          console.error(`Error processing vendor ${doc.id}:`, error);
          return null; // Skip failed vendors
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Add successful results to allVendors
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allVendors.push(result.value);
        }
      });

      // Small delay between batches to prevent overwhelming the database
      if (i + batchSize < vendorDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Sort by score descending and limit final results
    const sortedVendors = allVendors
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Return top 50 vendors max

    res.status(200).json({ 
      vendors: sortedVendors,
      totalVendors: sortedVendors.length
    });
  } catch (err) {
    console.error("Error matching vendors:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch best vendors for a planner (all events)
app.get('/planner/:plannerId/bestvendors', authenticate, async (req, res) => {
  try {
    const { plannerId } = req.params;
        console.log(plannerId);
    if (!plannerId) return res.status(400).json({ error: "Missing plannerId" });

    const eventsSnap = await db.collection("Event")
      .where("plannerId", "==", plannerId)
      .limit(50)
      .get();

    const categories = new Set();

    eventsSnap.forEach(doc => {
      const data = doc.data();
      if (data.eventCategory) categories.add(data.eventCategory.toLowerCase());
    });

    console.log(categories);
    console.log(eventsSnap.size);
    console.log(plannerId);
    if (categories.size === 0) {
      return res.status(200).json({ vendors: [] });
    }

    const vendorSnap = await db.collection("Vendor")
      .where("status", "==", "approved")
      .limit(100)
      .get();

    if (vendorSnap.empty) return res.status(200).json({ vendors: [] });

    // Batch process vendors
    const batchSize = 25;
    const vendorDocs = vendorSnap.docs;
    const allVendors = [];

    for (let i = 0; i < vendorDocs.length; i += batchSize) {
      const batch = vendorDocs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (doc) => {
        try {
          const vendor = { id: doc.id, ...doc.data() };

          // Get services with limit
          const servicesSnap = await db.collection("Vendor")
            .doc(doc.id)
            .collection("Services")
            .limit(50)
            .get();

          vendor.services = servicesSnap.docs.map(s => ({ id: s.id, ...s.data() }));

          // Score vendor based on multiple categories
          let score = 0;
          let categoryCount = 0;
          
          categories.forEach(cat => {
            const categoryScore = scoreVendor(vendor, cat);
            if (categoryScore > 0) {
              score += categoryScore;
              categoryCount++;
            }
          });
          
          // Average score across relevant categories
          vendor.score = categoryCount > 0 ? score / categoryCount : 0;

          return vendor;
        } catch (error) {
          console.error(`Error processing vendor ${doc.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allVendors.push(result.value);
        }
      });

      // Delay between batches
      if (i + batchSize < vendorDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Sort and limit results
    const sortedVendors = allVendors
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    res.status(200).json({ 
      vendors: sortedVendors,
      totalVendors: sortedVendors.length
    });
  } catch (err) {
    console.error("Error recommending vendors:", err);
    res.status(500).json({ error: "Internal Server error" });
  }
});

//Add a vendor to an event
app.post('/planner/:eventId/vendors/:vendorId', authenticate, async (req, res) => {
  try{
    const eventId = req.params.eventId;
    const vendorId = req.params.vendorId;
    
    if (!eventId || !vendorId){
      return res.status(400).json({message: "Missing eventId or vendorId"});
    }

    const vendorSnap = await db.collection("Vendor").doc(vendorId).get();
    if (!vendorSnap.exists) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendor = { id: vendorSnap.id, ...vendorSnap.data() };

    await db.collection("Event").doc(eventId).collection("Vendors").doc(vendor.id).set({
      businessName: vendor.businessName || "",
      email: vendor.email || "",
      status: "pending",
      extraNotes: "",
      AllContracts: [],
      services: []
    });

    res.status(200).json({message: "Vendor added to event successfully"});
  }
  catch(error){
    console.error("Error adding vendor to event: ", error);
    res.status(500).json({message: "Internal Server error"});
  }
});

//Update Status of past event
app.get("/planner/event-status-update", authenticate, async (req, res) => {
  try {
    const now = new Date();

    // Fetch all upcoming events
    const eventsSnapshot = await db.collection("Event")
      .where("status", "==", "planning")
      .get();

    if (eventsSnapshot.empty) {
      console.log("No upcoming events to update");
      return res.status(200).send("No upcoming events to update");
    }

    const batch = db.batch();

    eventsSnapshot.forEach(doc => {
      const event = doc.data();
      const endTime = event.date.toDate ? event.date.toDate() : new Date(event.date);

      if (now > endTime) {
        batch.update(doc.ref, { status: "passed" });
        console.log(`Event ${doc.id} marked as passed`);
      }
    });

    await batch.commit();
    console.log("Event status update completed");
    return res.status(200).send("Event statuses updated successfully");
  } catch (error) {
    console.error("Error updating event statuses:", error);
    return res.status(500).send("Error updating event statuses");
  }
});

// Send an invitation email when a guest is added
exports.sendInvitationOnGuestAdded = onDocumentCreated('Event/{eventId}/Guests/{guestId}', async (event) => {
    
  try {
      const snap = event.data;
      const guestData = snap.data();
      const { firstname, email, token: guestToken } = guestData;
      
      if (!email || !firstname) {
        console.error('Missing guest email or firstname');
        return;
      }

      const { eventId, guestId} = event.params;

      // Fetch event data
      const eventDoc = await db.collection('Event').doc(eventId).get();
      if (!eventDoc.exists) {
        console.error('Event not found:', eventId);
        return;
      }

      const eventData = eventDoc.data();
      const { name, date, duration, location, description } = eventData;

      const acceptUrl = `https://witty-stone-03009b61e.1.azurestaticapps.net/planner/rsvp/${eventId}/${guestToken}/accept`;
      const declineUrl = `https://witty-stone-03009b61e.1.azurestaticapps.net/planner/rsvp/${eventId}/${guestToken}/decline`;

      const mailOptions = {
        from: 'noreply.planit.online@gmail.com',
        to: email,
        subject: `Event Invitation: ${name}`,
        html: `
          <section style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: 0 auto;">
            <section style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">PlanIT</h1>
              <p style="color: #666; margin: 5px 0;">Event Invitation</p>
            </section>
            
            <p style="font-size: 16px;">Dear ${firstname},</p>
            
            <p style="font-size: 16px;">You are cordially invited to the following event:</p>
            
            <section style="background-color: #f8f9fa; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2563eb;">
              <h2 style="color: #2563eb; margin-top: 0; margin-bottom: 15px;">${name}</h2>
              <p style="margin: 8px 0;"><strong>Date:</strong> ${date}</p>
              ${duration ? `<p style="margin: 8px 0;"><strong>Duration:</strong> ${duration}</p>` : ''}
              ${location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>` : ''}
              ${description ? `<p style="margin: 8px 0;"><strong>Details:</strong> ${description}</p>` : ''}
            </section>
            
            <section style="text-align: center; margin: 30px 0;">
              <p style="font-size: 16px; margin-bottom: 20px;">Please RSVP as soon as possible:</p>
              <section style="display: inline-block;">
                <a href="${acceptUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 0 10px; display: inline-block;">Accept</a>
                <a href="${declineUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 0 10px; display: inline-block;">Decline</a>
              </section>
            </section>
            
            <section style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 14px; color: #666;">Best regards,<br><strong>The PlanIT Team</strong></p>
              <p style="font-size: 12px; color: #999; margin-top: 15px;">
                This is an automated invitation. Please do not reply directly to this email.
              </p>
            </section>
          </section>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Invitation email sent successfully to ${email} for event ${name}`);
      
    } catch (error) {
      console.error('Error sending invitation email:', error);
    }
  }
);

// RSVP Accept endpoint
app.put("/rsvp/:eventId/:guestToken/accept", async (req, res) => {
  try {
    const { eventId, guestToken } = req.params;

    // Verify event exists
    const eventDoc = await db.collection('Event').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ message: "Event not found" });
    }

    const eventData = eventDoc.data();

    // Verify guest exists
    const guestQuery = await db.collection('Event').doc(eventId).collection('Guests').where('token', '==', guestToken).get();
    
    // Check if any documents matched
    if (guestQuery.empty) {
      return res.status(404).json({ message: "Guest not found" });
    }

    // Get the first (and should be only) guest document
    const guestDoc = guestQuery.docs[0];
    const guestData = {id: guestDoc.id, ...guestDoc.data()};

    // Update guest RSVP status
    await db.collection('Event').doc(eventId)
      .collection('Guests').doc(guestDoc.id)
      .update({
        rsvpStatus: 'accepted',
      });

    // Send confirmation email
    const confirmationEmail = {
      from: 'noreply.planit.online@gmail.com',
      to: guestData.email,
      subject: `RSVP Confirmed: ${eventData.name}`,
      html: `
        <section style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: 0 auto;">
          <section style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">PlanIT</h1>
            <p style="color: #666; margin: 5px 0;">RSVP Confirmation</p>
          </section>
          
          <section style="background-color: #ecfdf5; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #10b981; text-align: center;">
            <h2 style="color: #10b981; margin-top: 0;">RSVP Accepted!</h2>
            <p style="font-size: 16px; margin: 10px 0;">Thank you for accepting the invitation to:</p>
            <h3 style="color: #2563eb; margin: 15px 0;">${eventData.name}</h3>
          </section>
          
          <p style="font-size: 16px;">Dear ${guestData.firstname},</p>
          <p style="font-size: 16px;">We're excited to confirm that you'll be joining us! We look forward to seeing you at the event.</p>
          
          <section style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #666;">Best regards,<br><strong>The PlanIT Team</strong></p>
          </section>
        </section>
      `
    };

    await transporter.sendMail(confirmationEmail);
    res.status(200).json({event: eventData, guest: guestData});
    console.log(`RSVP accepted for guest ${guestData.id} in event ${eventId}`);

  } catch (error) {
    console.error('Error processing RSVP accept:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// RSVP Decline endpoint
app.put("/rsvp/:eventId/:guestToken/decline", async (req, res) => {
  try {
    const { eventId, guestToken } = req.params;

    // Verify event exists
    const eventDoc = await db.collection('Event').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ message: "Event not found" });
    }

    const eventData = eventDoc.data();

    // Verify guest exists
    const guestQuery = await db.collection('Event').doc(eventId)
      .collection('Guests').where("token", "==", guestToken).get();
    
    // Check if any documents matched
    if (guestQuery.empty) {
      return res.status(404).json({ message: "Guest not found" });
    }

    // Get the first (and should be only) guest document
    const guestDoc = guestQuery.docs[0];
    const guestData = {id: guestDoc.id, ...guestDoc.data()};

    // Update guest RSVP status
    await db.collection('Event').doc(eventId)
      .collection('Guests').doc(guestData.id)
      .update({
        rsvpStatus: 'declined'
      });

    // Send confirmation email
    const confirmationEmail = {
      from: 'noreply.planit.online@gmail.com',
      to: guestData.email,
      subject: `RSVP Response Received: ${eventData.name}`,
      html: `
        <section style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: 0 auto;">
          <section style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">PlanIT</h1>
            <p style="color: #666; margin: 5px 0;">RSVP Response</p>
          </section>
          
          <section style="background-color: #fef2f2; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #ef4444; text-align: center;">
            <h2 style="color: #ef4444; margin-top: 0;">RSVP Response Received</h2>
            <p style="font-size: 16px; margin: 10px 0;">We understand you won't be able to join us for:</p>
            <h3 style="color: #2563eb; margin: 15px 0;">${eventData.name}</h3>
          </section>
          
          <p style="font-size: 16px;">Dear ${guestData.firstname},</p>
          <p style="font-size: 16px;">Thank you for letting us know. We're sorry you won't be able to make it, but we appreciate your response.</p>
          <p style="font-size: 16px;">If your plans change, please feel free to reach out to the event organizer.</p>
          
          <section style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #666;">Best regards,<br><strong>The PlanIT Team</strong></p>
          </section>
        </section>
      `
    };

    await transporter.sendMail(confirmationEmail);
    res.status(200).json({event: eventData, guest: guestData});
    console.log(`RSVP declined for guest ${guestData.id}in event ${eventId}`);

  } catch (error) {
    console.error('Error processing RSVP decline:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Send reminder email to a specific guest
app.get("/planner/:eventId/:guestId/sendReminder", authenticate, async (req, res) => {
  try {
    const { eventId, guestId } = req.params;

    // Verify planner owns the event
    const eventDoc = await db.collection('Event').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventData = eventDoc.data();

    // Get guest data
    const guestDoc = await db.collection('Event').doc(eventId)
      .collection('Guests').doc(guestId).get();
    
    if (!guestDoc.exists) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const guestData = guestDoc.data();
    const { firstname, email, rsvpStatus } = guestData;

    if (!email || !firstname) {
      return res.status(400).json({ error: 'Guest email or name missing' });
    }

    const { name, date, duration, location, description } = eventData;

    // Determine reminder type based on RSVP status
    const isRsvpReminder = !rsvpStatus || rsvpStatus === 'pending';
    const reminderType = isRsvpReminder ? 'RSVP Reminder' : 'Event Reminder';
    const reminderMessage = isRsvpReminder 
      ? "We haven't received your RSVP yet. Please let us know if you can attend:"
      : "This is a friendly reminder about your upcoming event:";

    const mailOptions = {
      from: 'noreply.planit.online@gmail.com',
      to: email,
      subject: `${reminderType}: ${name}`,
      html: `
        <section style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: 0 auto;">
          <section style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">PlanIT</h1>
            <p style="color: #666; margin: 5px 0;">${reminderType}</p>
          </section>
          
          <p style="font-size: 16px;">Dear ${firstname},</p>
          
          <p style="font-size: 16px;">${reminderMessage}</p>
          
          <section style="background-color: #f8f9fa; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2563eb;">
            <h2 style="color: #2563eb; margin-top: 0; margin-bottom: 15px;">${name}</h2>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${date}</p>
            ${duration ? `<p style="margin: 8px 0;"><strong>Duration:</strong> ${duration}</p>` : ''}
            ${location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>` : ''}
            ${description ? `<p style="margin: 8px 0;"><strong>Details:</strong> ${description}</p>` : ''}
          </section>
          
          ${isRsvpReminder ? `
            <section style="text-align: center; margin: 30px 0;">
              <p style="font-size: 16px; margin-bottom: 20px;">Please RSVP:</p>
              <section style="display: inline-block;">
                <a href="#" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 0 10px; display: inline-block;">Accept</a>
                <a href="#" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 0 10px; display: inline-block;">Decline</a>
              </section>
            </section>
          ` : `
            <section style="background-color: #ecfdf5; padding: 20px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #10b981;">
              <p style="margin: 0; color: #065f46;"><strong>Your RSVP Status:</strong> ${rsvpStatus === 'accepted' ? 'Accepted' : rsvpStatus === 'declined' ? 'Declined' : 'Pending'}</p>
            </section>
          `}
          
          <section style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #666;">Best regards,<br><strong>The PlanIT Team</strong></p>
            <p style="font-size: 12px; color: #999; margin-top: 15px;">
              This is an automated reminder. Please do not reply directly to this email.
            </p>
          </section>
        </section>
      `
    };

    await transporter.sendMail(mailOptions);
    
    await db.collection('Event').doc(eventId)
      .collection('Guests').doc(guestId)
      .update({
        lastReminderSent: admin.firestore.FieldValue.serverTimestamp(),
        reminderCount: admin.firestore.FieldValue.increment(1)
      });

    console.log(`Reminder email sent successfully to ${email} for event ${name}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Reminder email sent successfully',
      sentTo: email,
      reminderType
    });

  } catch (error) {
    console.error('Error sending reminder email:', error);
    res.status(500).json({ 
      error: 'Failed to send reminder email',
      details: error.message 
    });
  }
});

//Create Schedule doc for event
app.post('/planner/:eventId/schedules', authenticate, async (req, res) => {
  try {

    const eventId = req.params.eventId;
   
    const schedule = req.body;

    if (!eventId || !schedule.scheduleTitle) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create a new schedule under the event
    const scheduleRef = await db
      .collection("Event")
      .doc(eventId)
      .collection("Schedules")
      .add({
        scheduleTitle: schedule.scheduleTitle,
      });


    return res.status(200).json({
      message: "Schedule created successfully",
      scheduleId: scheduleRef.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//Create Item doc for Schedule
app.post('/planner/:eventId/schedules/:scheduleId/items', authenticate, async (req, res) => {
  try {

    const eventId = req.params.eventId;
    const scheduleId = req.params.scheduleId;
   
    const item = req.body;

    if (!eventId || !scheduleId || !item) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create a new schedule under the event
    const itemRef = await db
      .collection("Event")
      .doc(eventId)
      .collection("Schedules")
      .doc(scheduleId)
      .collection("Items")
      .add({
        title: item.title,
        time: String(item.time),
        duration: item.duration || null,
        description: item.description || "",
      });


    return res.json({
      message: "Item created successfully",
      scheduleId: itemRef.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//Get Schedules for an event
app.get('/planner/:eventId/schedules', authenticate, async (req, res) => {
  try {

    const eventId = req.params.eventId;

    const schedulesSnapshot = await db
      .collection("Event")
      .doc(eventId)
      .collection("Schedules")
      .get();

    const schedules = [];

    for (const doc of schedulesSnapshot.docs) {
      const scheduleData = doc.data();

      // Fetch items for this schedule
      const itemsSnapshot = await db
        .collection("Event")
        .doc(eventId)
        .collection("Schedules")
        .doc(doc.id)
        .collection("Items")
        .orderBy("time", "asc")
        .get();

      const items = itemsSnapshot.docs.map(itemDoc => ({
        id: itemDoc.id,
        ...itemDoc.data(),
      }));

      schedules.push({
        id: doc.id,
        ...scheduleData,
        items,
      });
    }

    return res.status(200).json({schedules});

  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//Update an item in a schedule
app.put('/planner/:eventId/schedules/:scheduleId/items/:itemId', authenticate, async (req, res) => {
  try {
    const { eventId, scheduleId, itemId } = req.params;
    const updatedItem = req.body;

    if (!eventId || !scheduleId || !itemId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.collection("Event")
      .doc(eventId)
      .collection("Schedules")
      .doc(scheduleId)
      .collection("Items")
      .doc(itemId)
      .update({
        ...updatedItem,
      });

    res.json({ message: "Item updated successfully" });
  } catch (error) {
    console.error("Error updating schedule item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save uploaded PDF metadata to Firestore
app.post("/planner/schedule-save/:eventId", authenticate, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { title, permanentUrl } = req.body;

    if (!eventId || !permanentUrl || !title) {
      return res.status(400).json({ error: "Missing required fields" });
    }


    // Save schedule doc for this file
    const scheduleRef = await db
      .collection("Event")
      .doc(eventId)
      .collection("Schedules")
      .add({
        scheduleTitle: title,
        url: permanentUrl
      });

    return res.status(200).json({
      message: "File metadata saved successfully",
      scheduleId: scheduleRef.id,
      url: permanentUrl,
    });
  } catch (error) {
    console.error("Error saving file metadata:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload Schedule PDF to firestore
app.post("/planner/schedule-upload/:eventId",
 busboyUploadToStorageMiddleware(undefined, (req) => `Schedules/${req.params.eventId}`),
 async (req, res) => {
  try {
      const bucket = admin.storage().bucket();
      const uploadedFiles = [];

      for (const [field, storageFile] of Object.entries(req.uploads)) {
        // Generate a permanent download token
        const token = uuidv4();

        // Set metadata with the token
        await storageFile.setMetadata({
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        });

        // Construct the permanent URL
        const url = `https://firebasestorage.googleapis.com/v0/b/${storageFile.bucket.name}/o/${encodeURIComponent(
          storageFile.name
        )}?alt=media&token=${token}`;

        uploadedFiles.push({
          field,
          gsPath: `gs://${storageFile.bucket.name}/${storageFile.name}`,
          url, // permanent download URL
        });
      }

      // Return URLs so frontend or backend can save them to the schedule doc
      res.status(200).json({
        message: "File uploaded successfully!",
        files: uploadedFiles,
      });
    } catch (err) {
      console.error("Error generating permanent URL:", err);
      res.status(500).send("Failed to upload file");
    }
});

//Upload image for an event
app.post('/event/apply-with-image', authenticate, upload.single("image"), async (req, res) => {
  try {
    const {
      name, description, theme, location, budget, expectedGuestCount,
      duration, eventCategory, notes, specialRequirements = [], style = [],
      tasks = [], vendoringCategoriesNeeded = [], files = null, schedules = null,
      services = null, date, plannerId
    } = req.body;

    let imageUrl = "";
    if (req.file) {
      const fileName = `events/${plannerId}/${uuidv4()}-${req.file.originalname}`;
      const fileRef = bucket.file(fileName);
      await fileRef.save(req.file.buffer, { contentType: req.file.mimetype });
      await fileRef.makePublic();
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;
    }

    const newEvent = {
      name, description, theme, location,
      budget: Number(budget),
      expectedGuestCount: Number(expectedGuestCount),
      duration: Number(duration),
      eventCategory, notes,
      specialRequirements, style, tasks, vendoringCategoriesNeeded,
      files, schedules, services,
      date: date ? new Date(date) : null,
      eventImage: imageUrl,
      status: "planning",
      plannerId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("Event").add(newEvent);
    res.status(200).json({ message: "Event created successfully", id: docRef.id, event: newEvent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete schedule item
app.delete('/planner/:eventId/schedules/:scheduleId/items/:itemId', authenticate, async (req, res) => {
  try {
    const { eventId, scheduleId, itemId } = req.params;
    await db.collection("Event").doc(eventId)
      .collection("Schedules").doc(scheduleId)
      .collection("Items").doc(itemId).delete();
    res.json({ message: "Schedule item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting schedule item", error: err.message });
  }
});

// Delete schedule
app.delete('/planner/:eventId/schedules/:scheduleId', authenticate, async (req, res) => {
  try {
    const { eventId, scheduleId } = req.params;
    await db.collection("Event").doc(eventId).collection("Schedules").doc(scheduleId).delete();
    res.json({ message: "Schedule deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting schedule", error: err.message });
  }
});

// Delete vendor
app.delete('/planner/:eventId/vendors/:vendorId', authenticate, async (req, res) => {
  try {
    const { eventId, vendorId } = req.params;
    await db.collection("Event").doc(eventId).collection("Vendors").doc(vendorId).delete();
    res.json({ message: "Vendor deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting vendor", error: err.message });
  }
});

// Delete guest
app.delete('/planner/:eventId/guests/:guestId', authenticate, async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    await db.collection("Event").doc(eventId).collection("Guests").doc(guestId).delete();
    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting guest", error: err.message });
  }
});

//Add Service
app.post('/planner/:eventId/services', authenticate, async(req, res) =>{
  try{
    const eventId = req.params.eventId;

    const eventSnap = await db.collection("Event").doc(eventId).get();
    if(!eventSnap.exists){
      return res.status(404).json({message: "Event not found"});
    }
    const event = eventSnap.data();

    const data = req.body;

    function estimateCost(data){
            return Number(data.chargeByHour * (event.duration || 0)) +
             Number(data.chargePerPerson * (event.expectedGuestCount || 0)) +
             Number(data.cost || 0) +
             Number(data.chargePerSquareMeter || 0);
    }

    const service = {
      serviceName: data.serviceName,
      vendorName: data.vendorName,
      status: "pending",
      estimatedCost: estimateCost(data),
      negotiatedCost: 0,
      vendorId: data.vendorId
    }

    const serviceSnap = await db.collection("Event").doc(eventId).collection("Services").doc(data.id).set(service);
    if(!serviceSnap){
      return res.status(500).json({messgae: "Failed to add service"});
    }

    res.status(200).json({message: "Service Added Successfully", id: serviceSnap.id});

  } catch(err){
    res.status(500).json({message: "Error adding service ", error: err.message});
  }
});

//Get All Services
app.get('/planner/:eventId/services', authenticate, async(req, res) => {
  try{
    const eventId = req.params.eventId;
    const servicesSnap = await db.collection("Event").doc(eventId).collection("Services").get();

    if(servicesSnap.empty){
      return res.status(200).json({services: []});
    }

    const services = servicesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    return res.status(200).json({services});

  } catch(err){
    res.status(500).json({message: "Error getting services", error: err.message})
  }
});

//CHATS
const getChatId = (eventId, plannerId, vendorId) => {
  return `${eventId}_${plannerId}_${vendorId}`;
};

app.post('/chats/:eventId/:plannerId/:vendorId/messages', authenticate, async (req, res) => {
  try {
    const { eventId, plannerId, vendorId } = req.params;
    const { senderId, senderName, senderType, content } = req.body;
    console.log("SENT FIELDS: ", senderId, " ", senderName, " ", senderType, " ", content);
    if (!content || !senderId || !senderName || !senderType) {
      return res.status(400).json({ error: "Missing required message fields" });
    }


    const chatId = getChatId(eventId, plannerId, vendorId);
    const chatRef = db.collection("Chats").doc(chatId);

    // ensure chat doc exists
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) {
      await chatRef.set({
        eventId,
        plannerId,
        vendorId,
        createdAt: new Date(),
      });
    }

    // add new message
    const messageRef = await chatRef.collection("messages").add({
      senderId,
      senderName,
      senderType,
      content,
      createdAt: new Date(),
      status: "sent",
    });

    res.status(201).json({ id: messageRef.id, content });
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/chats/:eventId/:plannerId/:vendorId/messages', authenticate, async (req, res) => {
  try {
    const { eventId, plannerId, vendorId } = req.params;
    const chatId = getChatId(eventId, plannerId, vendorId);

    const messagesSnap = await db
      .collection("Chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const messages = messagesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================
// VENDOR REVIEW ROUTES
// ============================================

// Create a review for a vendor
app.post('/planner/vendors/:vendorId/reviews', authenticate, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const plannerId = req.uid;
    const { rating, review, eventId, serviceName } = req.body;

    if (!rating || !review || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Valid rating (1-5) and review text are required' });
    }

    // Verify vendor exists
    const vendorDoc = await db.collection('Vendor').doc(vendorId).get();
    if (!vendorDoc.exists) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Create review document
    const reviewData = {
      plannerId,
      vendorId,
      rating: Number(rating),
      review: review.trim(),
      eventId: eventId || null,
      serviceName: serviceName || null,
      //createdAt: admin.firestore.FieldValue.serverTimestamp(),
      //updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const reviewRef = await db.collection('Reviews').add(reviewData);

    // Update vendor analytics
    const analyticsRef = db.collection('Analytics').doc(vendorId);
    const analyticsDoc = await analyticsRef.get();

    if (analyticsDoc.exists) {
      const currentData = analyticsDoc.data();
      const currentRating = currentData.averageRating || 0;
      const currentCount = currentData.totalReviews || 0;
      
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;

      await analyticsRef.update({
        averageRating: newRating,
        totalReviews: newCount,
        //lastReviewDate: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create analytics doc if it doesn't exist
      await analyticsRef.set({
        vendorId,
        averageRating: rating,
        totalReviews: 1,
        //lastReviewDate: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Also add to Analytics Reviews subcollection for backward compatibility
    await analyticsRef.collection('Reviews').doc(reviewRef.id).set({
      ...reviewData,
      //timeOfReview: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Review submitted successfully',
      reviewId: reviewRef.id,
      review: { id: reviewRef.id, ...reviewData }
    });
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all reviews for a vendor
app.get('/vendors/:vendorId/reviews', async (req, res) => {
  try {
    const { vendorId } = req.params;

    const reviewsSnapshot = await db.collection('Reviews')
      .where('vendorId', '==', vendorId)
      .orderBy('createdAt', 'desc')
      .get();

    const reviews = reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ reviews });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get planner's own reviews
app.get('/planner/my-reviews', authenticate, async (req, res) => {
  try {
    const plannerId = req.uid;

    const reviewsSnapshot = await db.collection('Reviews')
      .where('plannerId', '==', plannerId)
      .get();

    const reviews = reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ reviews });
  } catch (err) {
    console.error('Error fetching planner reviews:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update a review
app.put('/planner/reviews/:reviewId', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const plannerId = req.uid;
    const { rating, review } = req.body;

    const reviewRef = db.collection('Reviews').doc(reviewId);
    const reviewDoc = await reviewRef.get();

    if (!reviewDoc.exists) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (reviewDoc.data().plannerId !== plannerId) {
      return res.status(403).json({ message: 'Unauthorized to edit this review' });
    }

    await reviewRef.update({
      rating: Number(rating),
      review: review.trim(),
      //updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ message: 'Review updated successfully' });
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete a review
app.delete('/planner/reviews/:reviewId', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const plannerId = req.uid;

    const reviewRef = db.collection('Reviews').doc(reviewId);
    const reviewDoc = await reviewRef.get();

    if (!reviewDoc.exists) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (reviewDoc.data().plannerId !== plannerId) {
      return res.status(403).json({ message: 'Unauthorized to delete this review' });
    }

    await reviewRef.delete();

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================
// CONTRACT MANAGEMENT ROUTES
// ============================================

// Get all contracts for a planner's events
app.get('/planner/contracts', authenticate, async (req, res) => {
  try {
    const plannerId = req.uid;
    
    // Get all events for this planner
    const eventsSnapshot = await db.collection('Event')
      .where('plannerId', '==', plannerId)
      .get();

    if (eventsSnapshot.empty) {
      return res.json({ contracts: [] });
    }

    const contracts = [];
    
    // For each event, get all vendors and their contracts
    for (const eventDoc of eventsSnapshot.docs) {
      const eventData = eventDoc.data();
      const eventId = eventDoc.id;
      
      const vendorsSnapshot = await db.collection('Event')
        .doc(eventId)
        .collection('Vendors')
        .get();

      for (const vendorDoc of vendorsSnapshot.docs) {
        const vendorData = vendorDoc.data();
        const vendorId = vendorDoc.id;
        
        const contractsSnapshot = await db.collection('Event')
          .doc(eventId)
          .collection('Vendors')
          .doc(vendorId)
          .collection('Contracts')
          .get();

        contractsSnapshot.forEach(contractDoc => {
          const contract = contractDoc.data();
          contracts.push({
            id: contractDoc.id,
            eventId,
            eventName: eventData.name || 'Unknown Event',
            eventDate: eventData.date,
            vendorId,
            vendorName: vendorData.businessName || 'Unknown Vendor',
            contractUrl: contract.contractUrl,
            fileName: contract.fileName || 'unknown.pdf',
            signatureFields: contract.signatureFields || [],
            signatureWorkflow: contract.signatureWorkflow || {
              isElectronic: true,
              workflowStatus: 'sent'
            },
            status: contract.status || 'active',
            lastedited: contract.lastedited || { seconds: Math.floor(Date.now() / 1000) },
            draftSignatures: contract.draftSignatures || {},
            signedAt: contract.signedAt || null,
            signedBy: contract.signedBy || null
          });
        });
      }
    }

    res.json({ contracts });
  } catch (err) {
    console.error('Error fetching contracts:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Upload contract signature to storage
app.post('/planner/contracts/:eventId/:contractId/:fieldId/signatures/upload',
  authenticate,
  busboyUploadToStorageMiddleware(undefined,
     (req) => `Signatures/${req.params.eventId}/${req.params.contractId}/${req.params.fieldId}_${req.uid}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`),
  async (req, res) => {
    try {

      const eventId = req.params.eventId;
      const contractId = req.params.contractId;
      const fieldId = req.params.fieldId;
      const plannerId = req.uid;

      if (!eventId || !fieldId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const fileName = `Signatures/${req.params.eventId}/${req.params.contractId}/${req.params.fieldId}_${req.uid.plannerId}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

      // Generate permanent download URL
      const token = uuidv4();

      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;

      // Save signature metadata to audit collection
      await db.collection('SignatureAudit').add({
        fieldId,
        signerId: plannerId,
        signerRole: 'client',
        contractId,
        eventId,
        signatureUrl: downloadURL,
        signedAt: new Date().toISOString(),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        //timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ 
        downloadURL,
        fieldId,
        message: 'Signature uploaded successfully'
      });
    } catch (err) {
      console.error('Error uploading signature:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Save draft signatures
app.post('/planner/contracts/:contractId/signatures/draft', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { eventId, vendorId, signatures } = req.body;

    if (!eventId || !vendorId || !signatures) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const contractRef = db.collection('Event')
      .doc(eventId)
      .collection('Vendors')
      .doc(vendorId)
      .collection('Contracts')
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const currentFields = contractDoc.data().signatureFields || [];
    const updatedFields = currentFields.map(field => {
      if (signatures[field.id]) {
        return {
          ...field,
          draftSignature: signatures[field.id].url,
          draftSignatureData: signatures[field.id].metadata,
          lastDraftSaved: new Date().toISOString()
        };
      }
      return field;
    });

    await contractRef.update({
      signatureFields: updatedFields,
      draftSignatures: signatures,
      lastDraftSaved: new Date().toISOString(),
      //lastedited: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ 
      message: 'Draft saved successfully',
      signatureFields: updatedFields
    });
  } catch (err) {
    console.error('Error saving draft:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Finalize and sign contract
app.post('/planner/contracts/:contractId/finalize', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { eventId, vendorId, signatures, signatureFields } = req.body;

    if (!eventId || !vendorId || !signatures || !signatureFields) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const plannerId = req.uid;
    const contractRef = db.collection('Event')
      .doc(eventId)
      .collection('Vendors')
      .doc(vendorId)
      .collection('Contracts')
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const updatedFields = signatureFields.map(field => {
      if (signatures[field.id]) {
        return {
          ...field,
          signed: true,
          signedAt: new Date().toISOString(),
          signerId: plannerId,
          signatureData: signatures[field.id].url,
          signatureMetadata: signatures[field.id].metadata,
          finalizedAt: new Date().toISOString()
        };
      }
      return field;
    });

    const allSigned = updatedFields.every(field => !field.required || field.signed);

    const updateData = {
      signatureFields: updatedFields,
      finalSignatures: signatures,
      signatureWorkflow: {
        isElectronic: true,
        workflowStatus: allSigned ? 'completed' : 'partially_signed',
        completedAt: allSigned ? new Date().toISOString() : null,
        completedBy: plannerId
      },
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedBy: plannerId,
      //lastedited: admin.firestore.FieldValue.serverTimestamp(),
      //documentHistory: admin.firestore.FieldValue.arrayUnion({
        //action: 'document_signed',
        //timestamp: new Date().toISOString(),
        //signedBy: plannerId
      //})
    };

    await contractRef.update(updateData);

    // Add to audit log
    await db.collection('ContractAudit').add({
      contractId,
      eventId,
      vendorId,
      action: 'contract_signed',
      performedBy: plannerId,
      performedAt: new Date().toISOString(),
      details: {
        signedFields: updatedFields.filter(f => f.signed).length,
        totalFields: updatedFields.length,
        allRequiredSigned: allSigned
      }
    });

    res.json({ 
      message: 'Contract signed successfully',
      contract: {
        id: contractId,
        ...updateData
      }
    });
  } catch (err) {
    console.error('Error finalizing contract:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete contract
app.delete('/planner/contracts/:contractId', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { eventId, vendorId, contractUrl } = req.query;

    if (!eventId || !vendorId) {
      return res.status(400).json({ message: 'Missing eventId or vendorId' });
    }

    const contractRef = db.collection('Event')
      .doc(eventId)
      .collection('Vendors')
      .doc(vendorId)
      .collection('Contracts')
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Delete from Firestore
    await contractRef.delete();

    // Try to delete from storage
    if (contractUrl) {
      try {
        const urlObj = new URL(contractUrl);
        const storagePath = decodeURIComponent(
          urlObj.pathname.split('/o/')[1].split('?')[0]
        );
        const storageRef = bucket.file(storagePath);
        await storageRef.delete();
      } catch (storageErr) {
        console.warn('Failed to delete contract file from storage:', storageErr);
      }
    }

    // Add audit log
    await db.collection('ContractAudit').add({
      contractId,
      eventId,
      vendorId,
      action: 'contract_deleted',
      performedBy: req.uid,
      performedAt: new Date().toISOString(),
      details: {
        fileName: contractUrl ? contractUrl.split('/').pop().split('?')[0] : 'unknown',
        deletedAt: new Date().toISOString()
      }
    });

    res.json({ message: 'Contract deleted successfully' });
  } catch (err) {
    console.error('Error deleting contract:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Confirm services after contract signing
app.post('/planner/contracts/:contractId/confirm-services', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { eventId, vendorId } = req.body;

    if (!eventId || !vendorId) {
      return res.status(400).json({ message: 'Missing eventId or vendorId' });
    }

    // Get all services for this vendor in this event
    const servicesSnapshot = await db.collection('Event')
      .doc(eventId)
      .collection('Services')
      .where('vendorId', '==', vendorId)
      .get();

    if (servicesSnapshot.empty) {
      return res.json({ message: 'No services found to confirm' });
    }

    // Update all services to confirmed
    const batch = db.batch();
    servicesSnapshot.forEach(serviceDoc => {
      batch.update(serviceDoc.ref, {
        status: 'confirmed',
        confirmedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({ 
      message: 'Services confirmed successfully',
      confirmedCount: servicesSnapshot.size
    });
  } catch (err) {
    console.error('Error confirming services:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


//================================================================
//-- End of Planner routes
//================================================================


//Get all vendor applications with a 'pending' status.
app.get('/admin/vendor-applications', async (req, res) => {
  try {
    const snapshot = await db.collection('Vendor').where('status', '==', 'pending').get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching applications' });
  }
});

//Approve or reject a vendor application.
app.put('/admin/vendor-applications/:vendorId', async (req, res) => {
  const { vendorId } = req.params;
  const { status } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }

  try {
    const vendorRef = db.collection('Vendor').doc(vendorId);
    await vendorRef.update({ status: status });
    res.json({ message: `Vendor application has been ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while updating application' });
  }
});

//Get the vendors for a particular event
app.get('/planner/:eventId/vendors', authenticate, async (req, res) => {

  try{
    const eventId = req.params.eventId;
    const snapshot = await db.collection("Event").doc(eventId).collection("Vendors").get();

    if(snapshot.empty){
      return res.json({message: "No vendors found for this event"});
    }

    const vendors = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() }));
    console.log(vendors);
    res.json({eventId, vendors});
  }
  catch(err){
    console.error(err);
    res.status(500).json({message: "Server error"});
  }

});

//Get the guests for a particular event
app.get('/planner/:eventId/guests', [guestListLimiter, authenticateApiKey], async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const snapshot = await db.collection("Event").doc(eventId).collection("Guests").get();

    if (snapshot.empty) {
      return res.json({ eventId, guests: [], message: "No guests found for this event" });
    }

    // Sanitize guest data to expose only necessary fields
    const guests = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        rsvpStatus: data.rsvpStatus || 'pending'
      };
    });

    res.json({ eventId, guests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.get('/admin/vendor-applications', async (req, res) => {
  try {
    const snapshot = await db.collection('Vendor').where('status', '==', 'pending').get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching applications' });
  }
});


app.put('/admin/vendor-applications/:vendorId', async (req, res) => {
  const { vendorId } = req.params;
  const { status } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }

  try {
    const vendorRef = db.collection('Vendor').doc(vendorId);
    await vendorRef.update({ status: status });
    res.json({ message: `Vendor application has been ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while updating application' });
  }
});


app.get("/vendor/status", authenticate, async (req, res) => {
  try {
    const vendorRef = db.collection("Vendor").doc(req.uid); 
    const doc = await vendorRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Vendor application not found" });
    }

    const { status } = doc.data();
    return res.json({ status });
  } catch (err) {
    console.error("Error fetching vendor status:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/admin/events', async (req, res) => {
  try {
    const snapshot = await db.collection('Event').get();
    if (snapshot.empty) {
      return res.json({ events: [] });
    }
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching events' });
  }
});

app.delete('/admin/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventRef = db.collection('Event').doc(eventId);

   
    await eventRef.delete();

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while deleting event' });
  }
});


// Unprotected: Get all events for a user by UID (guid)
app.get('/public/user/:uid/events', async (req, res) => {
  try {
    const uid = req.params.uid;
    const snapshot = await db.collection("Event")
      .where("plannerId", "==", uid)
      .get();

    if (snapshot.empty) {
      return res.json({ uid, events: [] });
    }

    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ uid, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Unprotected guest list endpoint (public)
app.get('/public/event/:eventId/guests', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const snapshot = await db.collection("Event").doc(eventId).collection("Guests").get();

    if (snapshot.empty) {
      return res.json({ message: "No guests found for this event" });
    }

    const guests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ eventId, guests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




// =================================================================
// --- ADMIN PROFILE MANAGEMENT ROUTES ---
// =================================================================

app.post('/admin/me', authenticate, async (req, res) => {
  try {
    const { fullName, phone, email, profilePic } = req.body;
    let profilePicURL = '';

    if (profilePic) {
      const buffer = Buffer.from(profilePic, 'base64');
      const fileRef = bucket.file(`Admin/${req.uid}/profile.jpg`);
      await fileRef.save(buffer, { contentType: 'image/jpeg' });
      await fileRef.makePublic();
      profilePicURL = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;
    }

    await db.collection('Admin').doc(req.uid).set({
      fullName,
      phone,
      email,
      profilePic: profilePicURL,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: 'Admin profile created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// Get the admin profile
app.get('/admin/me', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('Admin').doc(req.uid).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const adminData = doc.data();

    res.json({
      ...adminData,
      profilePic: adminData.profilePic || null // ensure field always exists
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update the Admin's profile
app.put('/admin/me', authenticate, async (req, res) => {
  try {
    const {fullName, phone, email, profilePic } = req.body;
    let profilePicURL = '';

    if (profilePic) {
      const buffer = Buffer.from(profilePic, 'base64');
      const fileRef = bucket.file(`admin/${req.uid}/profile.jpg`);
      await fileRef.save(buffer, { contentType: 'image/jpeg' });
      await fileRef.makePublic();
      profilePicURL = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;
    }

    await db.collection('Admin').doc(req.uid).update({ fullName,
      phone,
      ...(profilePicURL && { profilePic: profilePicURL }),
      updatedAt: 'admin.firestore.FieldValue.serverTimestamp()',
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


app.post("/vendors/:vendorId/services", authenticate, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const {
      serviceId, // pass this if updating an existing service
      serviceName,
      cost,
      chargeByHour,
      chargePerPerson,
      chargePerSquareMeter,
      extraNotes,
    } = req.body;

    if (!serviceName) {
      return res.status(400).json({ error: "Service name is required" });
    }

    // reference to the vendor services subcollection
    const servicesRef = db
      .collection("Vendor")
      .doc(vendorId)
      .collection("Services");

    let serviceDocRef;

    if (serviceId) {
      // update existing service
      serviceDocRef = servicesRef.doc(serviceId);
      await serviceDocRef.set(
        {
          serviceName,
          cost: cost || 0,
          chargeByHour: chargeByHour || 0,
          chargePerPerson: chargePerPerson || 0,
          chargePerSquareMeter: chargePerSquareMeter || 0,
          extraNotes: extraNotes || "",
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } else {
      // create new service
      serviceDocRef = await servicesRef.add({
        serviceName,
        cost: cost || 0,
        chargeByHour: chargeByHour || 0,
        chargePerPerson: chargePerPerson || 0,
        chargePerSquareMeter: chargePerSquareMeter || 0,
        extraNotes: extraNotes || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.status(200).json({
      message: serviceId ? "Service updated successfully" : "Service added successfully",
      serviceId: serviceDocRef.id,
    });
  } catch (error) {
    console.error("Error adding/updating service:", error);
    res.status(500).json({ error: "Failed to add/update service" });
  }
});

/**
 * Get all services for a vendor
 */
app.get("/vendors/:vendorId/services", authenticate, async (req, res) => {
  try {
    const { vendorId } = req.params;

    const servicesSnapshot = await db
      .collection("Vendor")
      .doc(vendorId)
      .collection("Services")
      .get();

    const services = servicesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

app.delete("/vendors/:vendorId/services/:serviceId", authenticate, async (req, res) => {
  try {
    const { vendorId, serviceId } = req.params;
    if (!vendorId || !serviceId) {
      return res.status(400).json({ error: "vendorId and serviceId are required" });
    }

    // Validate IDs to prevent invalid Firestore paths
    if (vendorId.includes("/") || serviceId.includes("/")) {
      return res.status(400).json({ error: "Invalid vendorId or serviceId: Path separators not allowed" });
    }

    console.log("Deleting service:", { vendorId, serviceId, user: req.uid });

    const serviceDocRef = db.collection("Vendor").doc(vendorId).collection("Services").doc(serviceId);
    console.log("Firestore path:", serviceDocRef.path);

    const serviceSnapshot = await serviceDocRef.get();
    if (!serviceSnapshot.exists) {
      return res.status(404).json({ error: "Service not found" });
    }

    await serviceDocRef.delete();
    console.log("Service deleted successfully:", { vendorId, serviceId });

    res.status(200).json({
      message: "Service deleted successfully",
      serviceId,
    });
  } catch (error) {
    console.error("Error deleting service:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    let errorMessage = "Failed to delete service";
    if (error.code === "permission-denied") {
      errorMessage = "Permission denied: User not authorized to delete this service";
    } else if (error.code === "not-found") {
      errorMessage = "Service document not found";
    } else {
      errorMessage = `Failed to delete service: ${error.message}`;
    }
    res.status(500).json({ error: errorMessage, details: error.message });
  }
});

async function addAuditLog(eventId, vendorId, contractId, action, details = {}) {
  const logRef = db.collection("Event").doc(eventId)
    .collection("AuditLogs").doc();

  await logRef.set({
    vendorId,
    contractId,
    action,
    details,
    createdAt: new Date()
  });
}

app.post('/contracts/:contractId/signature-fields', authenticate, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { eventId, signatureFields, signers, vendorId } = req.body;


    // Validate that user owns this contract
    const contractRef = db.collection('Event').doc(eventId)
      .collection('Vendors').doc(vendorId)
      .collection('Contracts').doc(contractId);
    
    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Update contract with signature workflow
    await contractRef.update({
      signatureWorkflow: {
        isElectronic: true,
        workflowStatus: 'draft',
        expirationDate: new Date(admin.firestore.FieldValue.serverTimestamp() + 30 * 24 * 60 * 60 * 1000), // 30 days
        reminderSettings: {
          enabled: true,
          frequency: 3,
          maxReminders: 3
        }
      },
      signatureFields: signatureFields,
      signers: signers || [],
      updatedAt: new Date()
    });

    // Add audit log
    await addAuditLog(eventId, vendorId, contractId, 'signature_fields_defined', {
      fieldsCount: signatureFields.length,
      signersCount: signers?.length || 0
    });

    res.status(200).json({ 
      message: 'Signature fields saved successfully',
      contractId: contractId
    });

  } catch (error) {
    console.error('Error saving signature fields:', error);
    res.status(500).json({ error: 'Failed to save signature fields' });
  }
});

/**
 * @route   GET /api/admin/vendors
 * @desc    Get a list of all vendors (approved, pending, etc.).
 * @access  Private (Admin Only)
 */
app.get('/admin/vendors', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('Vendor').where('status', '==', 'approved').get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const vendors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(vendors);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ message: 'Server error while fetching vendors' });
  }
});

// Get a list of all planners.
app.get('/admin/planners', authenticate, async (req, res) => {
  try {
    const plannersSnapshot = await db.collection('Planner').get();
    if (plannersSnapshot.empty) {
      return res.json([]);
    }

    const plannersData = await Promise.all(plannersSnapshot.docs.map(async (doc) => {
      const planner = { id: doc.id, ...doc.data() };
      const eventsSnapshot = await db.collection('Event').where('plannerId', '==', doc.id).get();
      planner.events = eventsSnapshot.docs.map(eventDoc => ({ id: eventDoc.id, ...eventDoc.data() }));
      return planner;
    }));

    res.json(plannersData);
  } catch (err) {
    console.error('Error fetching planners:', err);
    res.status(500).json({ message: 'Server error while fetching planners' });
  }
});

// -------------------------
// Fetch services for contract entry (planner + vendor)
// GET /:vendorId/:eventId/services-for-contract
// -------------------------
app.get('/:vendorId/:eventId/services-for-contract', authenticate, async (req, res) => {
  try {
    const { vendorId, eventId } = req.params;

    // Get all services for this vendor under this event
    const servicesSnap = await db
      .collection('Event')
      .doc(eventId)
      .collection('Services')
      .where('vendorId', '==', vendorId)
      .get();

    if (servicesSnap.empty) {
      return res.json({ services: [] });
    }

    const services = servicesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ services });
  } catch (err) {
    console.error('Error fetching services for contract:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// -------------------------
// Update final prices when contract is uploaded
// POST /:vendorId/:eventId/update-final-prices
// Body: { finalPrices: { serviceId: price, ... } }
// -------------------------
app.post('/:vendorId/:eventId/update-final-prices', authenticate, async (req, res) => {
  try {
    const { vendorId, eventId } = req.params;
    const { finalPrices } = req.body;

    if (!finalPrices || typeof finalPrices !== 'object') {
      return res.status(400).json({ message: 'Invalid finalPrices object' });
    }

    const batch = db.batch();

    for (const [serviceId, price] of Object.entries(finalPrices)) {
      const serviceRef = db
        .collection('Event')
        .doc(eventId)
        .collection('Services')
        .doc(serviceId);

      batch.update(serviceRef, { finalPrice: price });
    }

    await batch.commit();

    res.json({ message: 'Final prices updated successfully' });
  } catch (err) {
    console.error('Error updating final prices:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// -------------------------
// Fetch final prices for a contract
// GET /:eventId/:vendorId/contract-prices-final
// -------------------------
app.get('/:eventId/:vendorId/contract-prices-final', authenticate, async (req, res) => {
  try {
    const { eventId, vendorId } = req.params;

    const servicesSnap = await db
      .collection('Event')
      .doc(eventId)
      .collection('Services')
      .where('vendorId', '==', vendorId)
      .get();

    if (servicesSnap.empty) {
      return res.json({ finalPrices: {} });
    }

    const finalPrices = {};
    servicesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.finalPrice !== undefined) {
        finalPrices[doc.id] = data.finalPrice;
      }
    });

    res.json({ finalPrices });
  } catch (err) {
    console.error('Error fetching final prices:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Confirm all services for a vendor in an event (after contract signed)
app.post('/planner/:eventId/:vendorId/confirm-services', authenticate, async (req, res) => {
  try {

    const { eventId, vendorId } = req.params;

    if (!eventId || !vendorId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get all services for this vendor in this event
    const servicesRef = db.collection("Event")
      .doc(eventId)
      .collection("Services")
      .where("vendorId", "==", vendorId);

    const servicesSnapshot = await servicesRef.get();

    if (servicesSnapshot.empty) {
      return res.status(404).json({ message: "No services found for this vendor in this event" });
    }

    // Batch update all to "confirmed"
    const batch = db.batch();
    servicesSnapshot.forEach((svcDoc) => {
      batch.update(svcDoc.ref, {
        status: "confirmed",
        updatedAt: new Date()
      });
    });
    await batch.commit();


    res.status(200).json({
      message: `${servicesSnapshot.size} services confirmed successfully.`,
      eventId,
      vendorId
    });

  } catch (error) {
    console.error("Error confirming services:", error);
    res.status(500).json({ error: "Failed to confirm services" });
  }
});

// -------------------------
// Fetch services for contract entry (planner + vendor)
// GET /:vendorId/:eventId/services-for-contract
// -------------------------
app.get('/:vendorId/:eventId/services-for-contract', authenticate, async (req, res) => {
  try {
    const { vendorId, eventId } = req.params;

    // Get all services for this vendor under this event
    const servicesSnap = await db
      .collection('Event')
      .doc(eventId)
      .collection('Services')
      .where('vendorId', '==', vendorId)
      .get();

    if (servicesSnap.empty) {
      return res.json({ services: [] });
    }

    const services = servicesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ services });
  } catch (err) {
    console.error('Error fetching services for contract:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// -------------------------
// Update final prices when contract is uploaded
// POST /:vendorId/:eventId/update-final-prices
// Body: { finalPrices: { serviceId: price, ... } }
// -------------------------
app.post('/:vendorId/:eventId/update-final-prices', authenticate, async (req, res) => {
  try {
    const { vendorId, eventId } = req.params;
    const { finalPrices } = req.body;

    if (!finalPrices || typeof finalPrices !== 'object') {
      return res.status(400).json({ message: 'Invalid finalPrices object' });
    }

    const batch = db.batch();

    for (const [serviceId, price] of Object.entries(finalPrices)) {
      const serviceRef = db
        .collection('Event')
        .doc(eventId)
        .collection('Services')
        .doc(serviceId);

      batch.update(serviceRef, { finalPrice: price });
    }

    await batch.commit();

    res.json({ message: 'Final prices updated successfully' });
  } catch (err) {
    console.error('Error updating final prices:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// -------------------------
// Fetch final prices for a contract
// GET /:eventId/:vendorId/contract-prices-final
// -------------------------
app.get('/:eventId/:vendorId/contract-prices-final', authenticate, async (req, res) => {
  try {
    const { eventId, vendorId } = req.params;

    const servicesSnap = await db
      .collection('Event')
      .doc(eventId)
      .collection('Services')
      .where('vendorId', '==', vendorId)
      .get();

    if (servicesSnap.empty) {
      return res.json({ finalPrices: {} });
    }

    const finalPrices = {};
    servicesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.finalPrice !== undefined) {
        finalPrices[doc.id] = data.finalPrice;
      }
    });

    res.json({ finalPrices });
  } catch (err) {
    console.error('Error fetching final prices:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/admin/vendors
 * @desc    Get a list of all vendors (approved, pending, etc.).
 * @access  Private (Admin Only)
 */
app.get('/admin/vendors', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('Vendor').get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const vendors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(vendors);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ message: 'Server error while fetching vendors' });
  }
});


// GET /analytics/:vendorId
app.get("/analytics/:vendorId", authenticate, async (req, res) => {
  const { vendorId } = req.params;

  try {
    // Get Analytics doc
    const analyticsRef = db.collection("Analytics").doc(vendorId);
    const analyticsDoc = await analyticsRef.get();

    if (!analyticsDoc.exists) {
      return res.status(404).json({ message: "Analytics not found" });
    }

    // Get Reviews subcollection
    const reviewsSnapshot = await analyticsRef.collection("Reviews").get();
    const reviews = reviewsSnapshot.docs.map((doc) => ({
      id: doc.id, // ✅ include Firestore doc id
      ...doc.data(),
    }));

    // Send combined response
    res.json({
      id: analyticsDoc.id,
      ...analyticsDoc.data(),
      reviews,
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ message: "Server error while fetching analytics" });
  }
});

// POST /analytics/:vendorId/reviews/:reviewId/reply
app.post("/analytics/:vendorId/reviews/:reviewId/reply", authenticate, async (req, res) => {
  const { vendorId, reviewId } = req.params;
  const { reply } = req.body;

  if (!reply || !reply.trim()) {
    return res.status(400).json({ message: "Reply text is required" });
  }

  try {
    const reviewRef = db
      .collection("Analytics")
      .doc(vendorId)
      .collection("Reviews")
      .doc(reviewId);

    const reviewDoc = await reviewRef.get();
    if (!reviewDoc.exists) {
      return res.status(404).json({ message: "Review not found" });
    }

    // update only reply field
    await reviewRef.update({ reply });

    // return updated review with id
    const updated = await reviewRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    console.error("Error adding reply:", err);
    res.status(500).json({ message: "Server error while adding reply" });
  }
});

app.post(
  "/api/analytics/:vendorId/reviews/:reviewId/deleteReply",
  authenticate,
  async (req, res) => {
    const { vendorId, reviewId } = req.params;

    try {
      const reviewRef = db
        .collection("Analytics")
        .doc(vendorId)
        .collection("Reviews")
        .doc(reviewId);

      const reviewSnap = await reviewRef.get();
      if (!reviewSnap.exists) {
        return res.status(404).json({ message: "Review not found" });
      }

      // Delete only the reply field
      await reviewRef.update({
        reply: admin.firestore.FieldValue.delete(),
      });

      res.json({ message: "Reply deleted successfully" });
    } catch (err) {
      console.error("Error deleting reply:", err);
      res
        .status(500)
        .json({ message: "Server error while deleting reply" });
    }
  }
);


// ===============
// Analytics Helper functions
// ===============
async function buildVendorReport(vendorId) {
  const eventsSnapshot = await db.collection('Event').get();

  let totalBookings = 0;
  let totalValueNegotiated = 0;
  let totalEstimated = 0;
  const eventTypeBreakdown = {};
  const serviceBreakdown = {};           // frequency of each service name
  const monthlyRevenue = {};             // yyyy-mm → value
  let earliestBooking = null;
  let latestBooking = null;

  for (const eventDoc of eventsSnapshot.docs) {
    const servicesSnap = await db.collection('Event')
      .doc(eventDoc.id)
      .collection('Services')
      .where('vendorId', '==', vendorId)
      .get();

    for (const service of servicesSnap.docs) {
      const data = service.data();
      totalBookings++;
      const neg = data.negotiatedCost || 0;
      const est = data.estimatedCost || 0;
      totalValueNegotiated += neg;
      totalEstimated += est;

      // Event categories
      const category = eventDoc.data().eventCategory || 'Uncategorized';
      eventTypeBreakdown[category] = (eventTypeBreakdown[category] || 0) + 1;

      // Service types
      const svcName = data.serviceName || 'Unnamed';
      serviceBreakdown[svcName] = (serviceBreakdown[svcName] || 0) + 1;

      // Monthly revenue
      const createdAt = data.createdAt?.toDate?.() || null;
      if (createdAt) {
        const key = createdAt.toISOString().slice(0,7); // 2025-09
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + neg;
        earliestBooking = !earliestBooking || createdAt < earliestBooking ? createdAt : earliestBooking;
        latestBooking   = !latestBooking  || createdAt > latestBooking  ? createdAt : latestBooking;
      }
    }
  }

  const avgDeal = totalBookings ? totalValueNegotiated / totalBookings : 0;

  return {
    vendorId,
    totalBookings,
    totalValueNegotiated,
    totalEstimated,
    avgDealSize: avgDeal,
    bookingSpanDays: earliestBooking && latestBooking
        ? Math.round((latestBooking - earliestBooking)/86400000)
        : 0,
    eventTypeBreakdown,
    serviceBreakdown,
    monthlyRevenue,
    generatedAt: 'admin.firestore.Timestamp.now()'
  };
}


async function buildPlannerReport(plannerId) {
  const eventsSnap = await db.collection('Event')
    .where('plannerId', '==', plannerId)
    .get();

  let totalEventsManaged = 0;
  let totalBudgetManaged = 0;
  let totalGuestsManaged = 0;
  let totalVendorSpend = 0;
  const uniqueVendors = new Set();
  const statusBreakdown = {};
  const avgGuestsPerEvent = [];
  const spendPerEvent = [];

  for (const eventDoc of eventsSnap.docs) {
    const event = eventDoc.data();
    totalEventsManaged++;
    totalBudgetManaged += Number(event.budget) || 0;
    totalGuestsManaged += event.expectedGuestCount || 0;
    statusBreakdown[event.status || 'unknown'] =
        (statusBreakdown[event.status || 'unknown'] || 0) + 1;

    avgGuestsPerEvent.push(event.expectedGuestCount || 0);

    const servicesSnap = await db.collection('Event')
      .doc(eventDoc.id)
      .collection('Services')
      .get();

    let eventSpend = 0;
    servicesSnap.forEach(s => {
      const d = s.data();
      eventSpend += d.negotiatedCost || d.estimatedCost || 0;
      if (d.vendorId) uniqueVendors.add(d.vendorId);
    });
    totalVendorSpend += eventSpend;
    spendPerEvent.push(eventSpend);
  }

  return {
    plannerId,
    totalEventsManaged,
    totalBudgetManaged,
    totalGuestsManaged,
    averageGuestsPerEvent: totalEventsManaged
        ? totalGuestsManaged / totalEventsManaged : 0,
    averageVendorSpendPerEvent: totalEventsManaged
        ? totalVendorSpend / totalEventsManaged : 0,
    uniqueVendorsHiredCount: uniqueVendors.size,
    budgetUtilization: totalBudgetManaged > 0
        ? totalVendorSpend / totalBudgetManaged : 0,
    statusBreakdown,
    generatedAt: 'admin.firestore.Timestamp.now()'
  };
}


async function buildEventReport(eventId) {
  const eventDoc = await db.collection('Event').doc(eventId).get();
  if (!eventDoc.exists) return null;

  const event = eventDoc.data();
  const guestsSnap = await db.collection('Event')
      .doc(eventId)
      .collection('Guests').get();
  const servicesSnap = await db.collection('Event')
      .doc(eventId)
      .collection('Services').get();

  let negotiatedSpend = 0;
  const rsvpBreakdown = { accepted: 0, declined: 0, pending: 0 };
  const vendorCategorySpend = {};

  guestsSnap.forEach(g => {
    const status = g.data().rsvpStatus || 'pending';
    rsvpBreakdown[status] = (rsvpBreakdown[status] || 0) + 1;
  });

  for (const s of servicesSnap.docs) {
    const d = s.data();
    negotiatedSpend += d.negotiatedCost || d.estimatedCost || 0;
    const cat = d.category || 'Uncategorized';
    vendorCategorySpend[cat] = (vendorCategorySpend[cat] || 0)
        + (d.negotiatedCost || d.estimatedCost || 0);
  }

  const totalGuests = guestsSnap.size;
  const accepted = rsvpBreakdown.accepted || 0;

  return {
    eventId,
    eventName: event.name,
    totalBudget: Number(event.budget) || 0,
    negotiatedSpend,
    budgetUtilization: event.budget > 0 ? negotiatedSpend / event.budget : 0,
    invitationsSent: totalGuests,
    rsvpBreakdown,
    acceptanceRate: totalGuests ? accepted / totalGuests : 0,
    costPerInvitedGuest: totalGuests ? negotiatedSpend / totalGuests : 0,
    hiredVendorCount: servicesSnap.size,
    vendorCategorySpend,
    generatedAt: 'admin.firestore.Timestamp.now()'
  };
}

async function generatePlatformSummary() {
  // Grab all top-level collections in parallel
  const [vendorSnap, plannerSnap, eventSnap] = await Promise.all([
    db.collection('Vendor').get(),
    db.collection('Planner').get(),
    db.collection('Event').get()
  ]);

  /** ----------------------------
   *  Vendors
   * ---------------------------- */
  const vendorStatusDistribution = {};
  const vendorCategoryCounts = {};
  let vendorWithServices = 0;
  let totalVendorCreatedAt = 0;

  for (const v of vendorSnap.docs) {
    const vd = v.data();
    const status = vd.status || 'unknown';
    vendorStatusDistribution[status] = (vendorStatusDistribution[status] || 0) + 1;

    const category = vd.category || 'Uncategorized';
    vendorCategoryCounts[category] = (vendorCategoryCounts[category] || 0) + 1;

    if (vd.createdAt?.seconds) totalVendorCreatedAt += vd.createdAt.seconds;
    // quick heuristic to see if they’ve listed at least one service
    const servicesSnap = await db.collection('Vendor').doc(v.id).collection('Services').limit(1).get();
    if (!servicesSnap.empty) vendorWithServices++;
  }

  // Popular categories sorted
  const popularVendorCategories = Object.entries(vendorCategoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  /** ----------------------------
   *  Planners
   * ---------------------------- */
  const plannerEventCounts = [];
  let totalPlannerCreatedAt = 0;
  for (const p of plannerSnap.docs) {
    const pd = p.data();
    plannerEventCounts.push((pd.activeEvents?.length || 0) + (pd.eventHistory?.length || 0));
    if (pd.createdAt?.seconds) totalPlannerCreatedAt += pd.createdAt.seconds;
  }
  const avgEventsPerPlanner =
    plannerEventCounts.length > 0
      ? plannerEventCounts.reduce((a, b) => a + b, 0) / plannerEventCounts.length
      : 0;

  /** ----------------------------
   *  Events
   * ---------------------------- */
  const overallRsvpBreakdown = { accepted: 0, declined: 0, pending: 0 };
  const eventCategoryCounts = {};
  let totalBudget = 0;
  let totalNegotiatedSpend = 0;
  let totalGuests = 0;
  let totalServices = 0;
  let earliestEventDate = null;
  let latestEventDate = null;

  for (const e of eventSnap.docs) {
    const ed = e.data();
    const budget = Number(ed.budget) || 0;
    totalBudget += budget;

    // track category popularity
    const eCat = ed.eventCategory || 'Uncategorized';
    eventCategoryCounts[eCat] = (eventCategoryCounts[eCat] || 0) + 1;

    // parse event date range
    if (ed.date) {
      const d = new Date(ed.date);
      if (!earliestEventDate || d < earliestEventDate) earliestEventDate = d;
      if (!latestEventDate || d > latestEventDate) latestEventDate = d;
    }

    // Guests + RSVP
    const guestsSnap = await db.collection('Event').doc(e.id).collection('Guests').get();
    totalGuests += guestsSnap.size;
    guestsSnap.forEach(g => {
      const s = g.data().rsvpStatus || 'pending';
      overallRsvpBreakdown[s] = (overallRsvpBreakdown[s] || 0) + 1;
    });

    // Services + spend
    const servicesSnap = await db.collection('Event').doc(e.id).collection('Services').get();
    totalServices += servicesSnap.size;
    servicesSnap.forEach(s => {
      const d = s.data();
      totalNegotiatedSpend += d.negotiatedCost || d.estimatedCost || 0;
    });
  }

  const mostPopularEventCategories = Object.entries(eventCategoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  /** ----------------------------
   *  Aggregate metrics
   * ---------------------------- */
  const platformLifetimeVendors = vendorSnap.size;
  const platformLifetimePlanners = plannerSnap.size;
  const platformLifetimeEvents = eventSnap.size;

  const avgBudgetPerEvent = platformLifetimeEvents > 0
    ? totalBudget / platformLifetimeEvents
    : 0;

  const avgSpendPerEvent = platformLifetimeEvents > 0
    ? totalNegotiatedSpend / platformLifetimeEvents
    : 0;

  const avgGuestsPerEvent = platformLifetimeEvents > 0
    ? totalGuests / platformLifetimeEvents
    : 0;

  const vendorServiceRatio = platformLifetimeVendors > 0
    ? vendorWithServices / platformLifetimeVendors
    : 0;

  return {
    // High-level counts
    totals: {
      vendors: platformLifetimeVendors,
      planners: platformLifetimePlanners,
      events: platformLifetimeEvents,
      guests: totalGuests,
      services: totalServices,
    },

    vendorInsights: {
      statusDistribution: vendorStatusDistribution,
      popularCategories: popularVendorCategories,
      vendorServiceRatio, // fraction of vendors who listed at least one service
    },

    plannerInsights: {
      avgEventsPerPlanner,
    },

    eventInsights: {
      budget: {
        totalBudget,
        avgBudgetPerEvent,
        totalNegotiatedSpend,
        avgSpendPerEvent,
      },
      guestStats: {
        overallRsvpBreakdown,
        avgGuestsPerEvent,
      },
      categoryPopularity: mostPopularEventCategories,
      dateRange: {
        earliest: earliestEventDate ? earliestEventDate.toISOString() : null,
        latest: latestEventDate ? latestEventDate.toISOString() : null,
      },
    },

    meta: {
      generatedAt: 'admin.firestore.FieldValue.serverTimestamp()'
    }
  };
}

app.get('/vendor/my-report', authenticate, async (req, res) => {
    try {
        const data = await buildVendorReport(req.uid);
        res.json(data);
    } catch (err) {
        console.error('Vendor report error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/planner/my-report', authenticate, async (req, res) => {
    try {
        const data = await buildPlannerReport(req.uid);
        res.json(data);
    } catch (err) {
        console.error('Planner report error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/event/:eventId', authenticate, async (req, res) => {
    try {
        const eventDoc = await db.collection('Event').doc(req.params.eventId).get();
        if (!eventDoc.exists) return res.status(404).json({ message: 'Event not found' });
        if (eventDoc.data().plannerId !== req.uid) return res.status(403).json({ message: 'Forbidden' });

        const data = await buildEventReport(req.params.eventId);
        if (!data) return res.status(404).json({ message: 'No analytics' });
        res.json(data);
    } catch (err) {
        console.error('Event report error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/admin/analytics/platform-summary', authenticate, async (req, res) => {
    try {
        const data = await generatePlatformSummary();
        res.json(data);
    } catch (err) {
        console.error('Platform summary error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ------------------------------
// Public debug route (no auth) for quick testing
// ------------------------------
app.get('/public/analytics/platform-summary-debug', async (req, res) => {
  try {
    const summary = await generatePlatformSummary();
    res.json(summary);
  } catch (err) {
    console.error('Error generating anayltics:', err);
    res.status(500).json({ 
      message: 'Server error generating platform summary', 
      details: err.message 
    });
  }
});


// GET /analytics/:vendorId
app.get("/analytics/:vendorId", authenticate, async (req, res) => {
  const { vendorId } = req.params;

  try {
    // Get Analytics doc
    const analyticsRef = db.collection("Analytics").doc(vendorId);
    const analyticsDoc = await analyticsRef.get();

    if (!analyticsDoc.exists) {
      return res.status(404).json({ message: "Analytics not found" });
    }

    // Get Reviews subcollection
    const reviewsSnapshot = await analyticsRef.collection("Reviews").get();
    const reviews = reviewsSnapshot.docs.map((doc) => ({
      id: doc.id, // ✅ include Firestore doc id
      ...doc.data(),
    }));

    // Send combined response
    res.json({
      id: analyticsDoc.id,
      ...analyticsDoc.data(),
      reviews,
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ message: "Server error while fetching analytics" });
  }
});

// POST /analytics/:vendorId/reviews/:reviewId/reply
app.post("/analytics/:vendorId/reviews/:reviewId/reply", authenticate, async (req, res) => {
  const { vendorId, reviewId } = req.params;
  const { reply } = req.body;

  if (!reply || !reply.trim()) {
    return res.status(400).json({ message: "Reply text is required" });
  }

  try {
    const reviewRef = db
      .collection("Analytics")
      .doc(vendorId)
      .collection("Reviews")
      .doc(reviewId);

    const reviewDoc = await reviewRef.get();
    if (!reviewDoc.exists) {
      return res.status(404).json({ message: "Review not found" });
    }

    // update only reply field
    await reviewRef.update({ reply });

    // return updated review with id
    const updated = await reviewRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    console.error("Error adding reply:", err);
    res.status(500).json({ message: "Server error while adding reply" });
  }
});

app.post(
  "/api/analytics/:vendorId/reviews/:reviewId/deleteReply",
  authenticate,
  async (req, res) => {
    const { vendorId, reviewId } = req.params;

    try {
      const reviewRef = db
        .collection("Analytics")
        .doc(vendorId)
        .collection("Reviews")
        .doc(reviewId);

      const reviewSnap = await reviewRef.get();
      if (!reviewSnap.exists) {
        return res.status(404).json({ message: "Review not found" });
      }

      // Delete only the reply field
      await reviewRef.update({
        reply: admin.firestore.FieldValue.delete(),
      });

      res.json({ message: "Reply deleted successfully" });
    } catch (err) {
      console.error("Error deleting reply:", err);
      res
        .status(500)
        .json({ message: "Server error while deleting reply" });
    }
  }
);

// ===================================================================
// =================== VENDOR HIGHLIGHTS ENDPOINTS ===================
// ===================================================================

const highlightsCollection = 'Highlights';
const reviewsCollection = 'Reviews';
const eventsCollection = 'Event';
const plannersCollection = 'Planner';

const uploadBase64Images = async (images, vendorId, highlightId) => {
    const imageUrls = [];
    const imageArray = Array.isArray(images) ? images : [images];

    for (const image of imageArray) {
        const base64Data = image.split(';base64,').pop();
        const buffer = Buffer.from(base64Data, 'base64');
        const uniqueId = uuidv4();
        
        // --- THIS IS THE CORRECTED FILE PATH ---
        // It now includes the 'highlights' root folder and the vendorId subfolder.
        const filePath = `Highlights/${vendorId}/${highlightId}/${uniqueId}.jpg`;
        const fileRef = bucket.file(filePath);

        await fileRef.save(buffer, {
            metadata: { 
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000',
            },
        });
        
        await fileRef.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        imageUrls.push(publicUrl);
    }
    return imageUrls;
};


// CREATE a new highlight with base64 images
app.post('/vendor/highlights', authenticate, async (req, res) => {
    const vendorId = req.uid; 
    try {
        const { reviewId, description, images } = req.body; // `images` is an array of base64 strings

        if (!reviewId || !description || !images || images.length === 0) {
            return res.status(400).send({ message: 'Missing required fields.' });
        }
        
        const highlightRef = db.collection(highlightsCollection).doc();
        const highlightId = highlightRef.id;

        const imageUrls = await uploadBase64Images(images, vendorId, highlightId);

        const newHighlight = {
            reviewId,
            vendorId,
            description,
            imageUrls,
            createdAt: 'Timestamp.now()',
            updatedAt: 'Timestamp.now()',
        };

        await highlightRef.set(newHighlight);
        res.status(201).send({ id: highlightId, ...newHighlight });

    } catch (error) {
        console.error('Error creating highlight:', error);
        res.status(500).send({ message: 'Error creating highlight', error: error.message });
    }
});


// UPDATE a highlight (with optional new base64 images)
app.put('/vendor/highlights/:highlightId', authenticate, async (req, res) => {
    const vendorId = req.uid;
    const { highlightId } = req.params;
    try {
        const { description, images } = req.body;
        
        const highlightRef = db.collection(highlightsCollection).doc(highlightId);
        const doc = await highlightRef.get();
        if(!doc.exists) return res.status(404).send({ message: "Highlight not found" });

        // Security check: ensure the vendor owns this highlight
        if (doc.data().vendorId !== vendorId) {
             return res.status(403).send({ message: "You are not authorized to edit this highlight."});
        }
        
        let finalImageUrls = doc.data().imageUrls;

        if (images && images.length > 0) {
            finalImageUrls = await uploadBase64Images(images, vendorId, highlightId);
        }

        const updateData = {
            description,
            imageUrls: finalImageUrls,
            updatedAt: 'Timestamp.now()',
        };
        
        await highlightRef.update(updateData);
        res.status(200).send({ message: 'Highlight updated successfully.' });

    } catch (error) {
        console.error('Error updating highlight:', error);
        res.status(500).send({ message: 'Error updating highlight', error: error.message });
    }
});

// DELETE a highlight
app.delete('/vendor/highlights/:highlightId', async (req, res) => {
    try {
        const { highlightId } = req.params;
        // Optional: Add security check here to ensure vendor owns the highlight
        await db.collection(highlightsCollection).doc(highlightId).delete();
        res.status(200).send({ message: 'Highlight deleted successfully.' });
    } catch (error) {
        console.error('Error deleting highlight:', error);
        res.status(500).send({ message: 'Error deleting highlight', error: "Internal Server Error" });
    }
});

// GET all highlights for the authenticated vendor (ENRICHED)
app.get('/vendor/:vendorId/highlights', authenticate, async (req, res) => {
    try {
        // Ensure the authenticated user is requesting their own highlights
        if (req.uid !== req.params.vendorId) {
            return res.status(403).send({ message: "Forbidden: You can only access your own highlights." });
        }
        const { vendorId } = req.params;

        // 1. Fetch all highlights for the vendor
        const highlightsSnap = await db.collection(highlightsCollection)
            .where('vendorId', '==', vendorId)
            .get();

        if (highlightsSnap.empty) {
            return res.status(404).send({ message: 'No highlights found.' });
        }

        const highlights = highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Data Enrichment ---
        
        // 2. Collect unique IDs for reviews, events, and planners
        const reviewIds = [...new Set(highlights.map(h => h.reviewId))];
        if (reviewIds.length === 0) {
            return res.status(200).send(highlights); // Return highlights if no reviews are linked
        }

        // 3. Fetch all related documents in batches
        const reviewDocs = await Promise.all(reviewIds.map(id => db.collection(reviewsCollection).doc(id).get()));
        
        const reviewsMap = new Map();
        reviewDocs.forEach(doc => {
            if (doc.exists) reviewsMap.set(doc.id, doc.data());
        });

        const eventIds = [...new Set(Array.from(reviewsMap.values()).map(r => r.eventId))];
        const plannerIds = [...new Set(Array.from(reviewsMap.values()).map(r => r.plannerId))];

        const [eventDocs, plannerDocs] = await Promise.all([
            Promise.all(eventIds.map(id => db.collection(eventsCollection).doc(id).get())),
            Promise.all(plannerIds.map(id => db.collection(plannersCollection).doc(id).get()))
        ]);

        const eventsMap = new Map();
        eventDocs.forEach(doc => {
            if (doc.exists) eventsMap.set(doc.id, doc.data());
        });

        const plannersMap = new Map();
        plannerDocs.forEach(doc => {
            if (doc.exists) plannersMap.set(doc.id, doc.data());
        });
        
        // 4. Combine all the data
        const enrichedHighlights = highlights.map(highlight => {
            const review = reviewsMap.get(highlight.reviewId);
            if (!review) return highlight; // Return original if review is not found

            const event = eventsMap.get(review.eventId);
            const planner = plannersMap.get(review.plannerId);

            return {
                ...highlight,
                reviewData: {
                    comment: review.comment,
                    rating: review.rating,
                },
                eventData: {
                    name: event ? event.name : 'Unknown Event',
                },
                plannerData: {
                    name: planner ? planner.name : 'Unknown Planner',
                },
            };
        });

        res.status(200).send(enrichedHighlights);

    } catch (error) {
        console.error('Error fetching enriched highlights for vendor:', error);
        res.status(500).send({ message: 'Error fetching highlights', error: error.message });
    }
});

// GET all ENRICHED highlights for a specific vendor (for planners to view)
app.get('/highlights/vendor/:vendorId', authenticate, async (req, res) => {
    try {
        const { vendorId } = req.params;

        // 1. Fetch all highlights for the specified vendor - FIXED COLLECTION NAME
        const highlightsSnap = await db.collection('Highlights')
            .where('vendorId', '==', vendorId)
            .get();

        if (highlightsSnap.empty) {
            return res.status(404).send({ message: 'No highlights found for this vendor.' });
        }

        const highlights = highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Collect unique IDs for data enrichment
        const reviewIds = [...new Set(highlights.map(h => h.reviewId))];
        if (reviewIds.length === 0) {
            return res.status(200).send(highlights);
        }

        // 3. Fetch all related documents - FIXED COLLECTION NAMES
        const reviewDocs = await Promise.all(reviewIds.map(id => db.collection('Reviews').doc(id).get()));
        
        const reviewsMap = new Map();
        reviewDocs.forEach(doc => doc.exists && reviewsMap.set(doc.id, doc.data()));

        const eventIds = [...new Set(Array.from(reviewsMap.values()).map(r => r.eventId))];
        const plannerIds = [...new Set(Array.from(reviewsMap.values()).map(r => r.plannerId))];

        const [eventDocs, plannerDocs] = await Promise.all([
            Promise.all(eventIds.map(id => db.collection('Event').doc(id).get())),
            Promise.all(plannerIds.map(id => db.collection('Planner').doc(id).get()))
        ]);

        const eventsMap = new Map();
        eventDocs.forEach(doc => doc.exists && eventsMap.set(doc.id, doc.data()));

        const plannersMap = new Map();
        plannerDocs.forEach(doc => doc.exists && plannersMap.set(doc.id, doc.data()));
        
        // 4. Combine all the data into enriched highlight objects
        const enrichedHighlights = highlights.map(highlight => {
            const review = reviewsMap.get(highlight.reviewId);
            if (!review) return highlight;

            const event = eventsMap.get(review.eventId);
            const planner = plannersMap.get(review.plannerId);

            return {
                ...highlight,
                reviewData: {
                    comment: review.review || review.comment || '',
                    rating: review.rating,
                },
                eventData: {
                    name: event ? event.name : 'Unknown Event',
                },
                plannerData: {
                    name: planner ? planner.name : 'Unknown Planner',
                },
            };
        });

        res.status(200).send(enrichedHighlights);

    } catch (error) {
        console.error('Error fetching public highlights:', error);
        res.status(500).send({ message: 'Error fetching highlights', error: error.message });
    }
});

// ===================================================================
// ======================= VENDOR REVIEWS ENDPOINTS ======================
// ===================================================================

// GET all reviews for a specific vendor
app.get('/reviews/vendor/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        const reviewsSnap = await db.collection(reviewsCollection)
            .where('vendorId', '==', vendorId)
            .get();
        
        if (reviewsSnap.empty) {
            return res.status(404).send({ message: 'No reviews found for this vendor.' });
        }

        const reviewsData = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- NEW LOGIC TO ADD EVENT NAMES ---
        // 1. Get all unique event IDs from the reviews
        const eventIds = [...new Set(reviewsData.map(review => review.eventId).filter(id => id))];

        let eventsMap = {};
        if (eventIds.length > 0) {
            // 2. Fetch all corresponding event documents in one batch
            const eventDocs = await Promise.all(
                eventIds.map(id => db.collection(eventsCollection).doc(id).get())
            );
            // 3. Create a map of eventId -> eventName
            eventDocs.forEach(doc => {
                if (doc.exists) {
                    eventsMap[doc.id] = doc.data().name || 'Unnamed Event';
                }
            });
        }
        
        // 4. Merge the event name into each review object
        const enrichedReviews = reviewsData.map(review => ({
            ...review,
            eventName: eventsMap[review.eventId] || 'Unknown Event'
        }));
        // --- END NEW LOGIC ---

        res.status(200).send(enrichedReviews);

    } catch (error) {
        console.error('Error fetching vendor reviews:', error);
        res.status(500).send({ message: 'Error fetching reviews', error: error.message });
    }
});

// GET a single review by its ID
app.get('/reviews/:reviewId', async (req, res) => {
    try {
        const reviewId = req.params.reviewId;
        const doc = await db.collection(reviewsCollection).doc(reviewId).get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'Review not found.' });
        }

        res.status(200).send({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error('Error fetching single review:', error);
        res.status(500).send({ message: 'Error fetching review', error: error.message });
    }
});


exports.api = functions.https.onRequest(app);
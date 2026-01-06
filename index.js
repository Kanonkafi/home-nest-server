// ===== 1️ Import Packages =====
const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// index.js Firebase Setup
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

// ===== 2️ App Configuration =====
const app = express();
const port = process.env.PORT || 3000;

// ===== 3️ Middleware =====
app.use(cors());
app.use(express.json());

// ===== 4️ Initialize Firebase Admin =====
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ===== 5️ MongoDB Atlas Connection =====
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.kepsnmk.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// ===== 6️ Firebase Token Verification Function =====
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized. Token not found!" });
  }
  const token = authorization.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.decodedUser = decodedToken;
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorized access." });
  }
};

// ===== 7️ MongoDB Collections and Routes =====
async function run() {
  try {
    const db = client.db("homeNestDB");

    const usersCollection = db.collection("usersCollection");
    const propertiesCollection = db.collection("propertiesCollection");
    const reviewsCollection = db.collection("reviewsCollection");
    const bookingsCollection = db.collection("bookingsCollection");

    console.log("✅ MongoDB connected successfully!");
    
    // Create default admin user if it doesn't exist
    const adminUser = {
      name: "Admin",
      email: "admin@gmail.com",
      role: "admin",
      createdAt: new Date()
    };
    
    const existingAdmin = await usersCollection.findOne({ email: "admin@gmail.com" });
    if (!existingAdmin) {
      await usersCollection.insertOne(adminUser);
      console.log("✅ Default admin user created: admin@gmail.com");
    } else {
      console.log("✅ Admin user already exists");
    }

    /*********************
      USERS ROUTES
    *********************/
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const existingUser = await usersCollection.findOne({ email: newUser.email });
      if (existingUser) return res.send({ message: "User already exists" });
      const result = await usersCollection.insertOne({ ...newUser, createdAt: new Date() });
      res.send(result);
    });

    /*********************
      PROPERTIES ROUTES
    *********************/
    app.get("/properties", async (req, res) => {
      const { search, sortBy, category } = req.query;
      let query = {};
      if (search) query.propertyName = { $regex: search, $options: "i" };
      if (category) query.category = category; // Filter by category
      let sortOptions = {};
      if (sortBy === "price") sortOptions = { price: 1 };
      else if (sortBy === "date") sortOptions = { createdAt: -1 };

      const result = await propertiesCollection.find(query).sort(sortOptions).toArray();
      res.send(result);
    });

    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;
      const result = await propertiesCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // My added properties
    app.get("/my-properties", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await propertiesCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.post("/properties", verifyToken, async (req, res) => {
      const newProperty = { ...req.body, createdAt: new Date() };
      const result = await propertiesCollection.insertOne(newProperty);
      res.send(result);
    });

    // Property Update Route
    app.put("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const propertyData = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updateDoc = {
        $set: {
          propertyName: propertyData.propertyName,
          description: propertyData.description,
          category: propertyData.category,
          price: propertyData.price,
          location: propertyData.location,
          image: propertyData.image,
          // Only update fields that exist in the request
          ...(propertyData.status && { status: propertyData.status }),
          updatedAt: new Date()
        },
      };
      const result = await propertiesCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });
    
    // Property Delete Route (এটা আপনার দরকার ছিল)
    app.delete("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    /*********************
      BOOKINGS ROUTES
    *********************/
    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = { 
        ...req.body, 
        status: "Pending", // Default Status
        paymentStatus: "Unpaid",
        createdAt: new Date() 
      };
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    app.get("/my-bookings", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await bookingsCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    /*********************
      REVIEWS ROUTES
    *********************/
    app.post("/reviews", verifyToken, async (req, res) => {
      const newReview = { ...req.body, createdAt: new Date() };
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });

    app.get("/my-reviews", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await reviewsCollection.find({ reviewerEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    /*********************
      ADMIN ROUTES
    *********************/
    // Verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "Unauthorized. Token not found!" });
      }
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userEmail = decodedToken.email;
        
        // Check if user is admin in the database
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user || user.role !== 'admin') {
          return res.status(403).send({ message: "Access denied. Admin only." });
        }
        
        req.decodedUser = decodedToken;
        next();
      } catch (error) {
        res.status(401).send({ message: "Unauthorized access." });
      }
    };
    
    // Get all users (admin only)
    app.get("/users", verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });
    
    // Update user role (admin only)
    app.patch("/users/:email", verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;
      
      const result = await usersCollection.updateOne(
        { email: email },
        { $set: { role: role } }
      );
      
      res.send(result);
    });
    
    // Get all bookings (admin only)
    app.get("/all-bookings", verifyAdmin, async (req, res) => {
      const result = await bookingsCollection.find({}).toArray();
      res.send(result);
    });
    
    // Update booking status (admin only)
    app.patch("/bookings/:id", verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status } }
      );
      
      res.send(result);
    });
    
    // Get all properties (admin only)
    app.get("/all-properties", verifyAdmin, async (req, res) => {
      const result = await propertiesCollection.find({}).toArray();
      res.send(result);
    });
    
    // Get all reviews (admin only)
    app.get("/all-reviews", verifyAdmin, async (req, res) => {
      const result = await reviewsCollection.find({}).toArray();
      res.send(result);
    });
    
    // Delete review (admin only)
    app.delete("/admin/reviews/:id", verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

  } finally { }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("HomeNest backend server is running!"));
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
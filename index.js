
// ===== 1️ Import Packages =====
const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); // For environment variables
const serviceAccount = require("./serviceKey.json"); // Firebase service account

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
    await admin.auth().verifyIdToken(token); // Verify Firebase ID token
    next(); // token valid → continue
  } catch (error) {
    res.status(401).send({ message: "Unauthorized access." });
  }
};

// ===== 7️ MongoDB Collections and Routes =====
async function run() {
  try {
    await client.connect();
    const db = client.db("homeNestDB");

    const usersCollection = db.collection("usersCollection");
    const propertiesCollection = db.collection("propertiesCollection");
    const reviewsCollection = db.collection("reviewsCollection");

    console.log(" MongoDB connected successfully!");

    /*********************
      USERS ROUTES
    *********************/
    // Register user
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const existingUser = await usersCollection.findOne({ email: newUser.email });
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne({ ...newUser, createdAt: new Date() });
      res.send(result);
    });

    /*********************
      PROPERTIES ROUTES
    *********************/
    // Get all properties (public)
    app.get("/properties", async (req, res) => {
      const { search, sortBy } = req.query;
      let query = {};
      let options = {};

      if (search) query.propertyName = { $regex: search, $options: "i" };
      if (sortBy === "price") options.sort = { price: 1 };
      if (sortBy === "date") options.sort = { createdAt: -1 };

      const result = await propertiesCollection.find(query, options).toArray();
      res.send(result);
    });

    // Get latest 6 properties
    app.get("/latest-properties", async (req, res) => {
      const result = await propertiesCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
      res.send(result);
    });

    // Get my properties (private)
    app.get("/my-properties", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await propertiesCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // Get single property (private)
    app.get("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await propertiesCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Add property (private)
   app.post("/properties", verifyToken, async (req, res) => {
    //app.post("/properties", async (req, res) => {
      const newProperty = { ...req.body, createdAt: new Date() };
      const result = await propertiesCollection.insertOne(newProperty);
      res.send(result);
    });

    // Update property (private)
    app.put("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await propertiesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { 
            propertyName: updated.propertyName,
            description: updated.description,
            category: updated.category,
            price: updated.price,
            location: updated.location,
            image: updated.image
          }
        }
      );
      res.send(result);
    });

    // Delete property (private)
    app.delete("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    /*REVIEWS ROUTES*/
    // Add review (private)
    app.post("/reviews", verifyToken, async (req, res) => {
      const newReview = { ...req.body, createdAt: new Date() };
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });

    // Get all reviews for a property
    app.get("/reviews/:propertyId", async (req, res) => {
      const propertyId = req.params.propertyId;
      const result = await reviewsCollection.find({ propertyId }).toArray();
      res.send(result);
    });

    // Get my reviews (private)
    app.get("/my-reviews", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await reviewsCollection.find({ reviewerEmail: email }).toArray();
      res.send(result);
    });

  } finally {
    // await client.close(); // Uncomment if needed
  }
}
run().catch(console.dir);

// ===== 8️⃣ Root Route =====
app.get("/", (req, res) => {
  res.send("HomeNest backend server is running!");
});

// ===== 9️⃣ Server Listening =====
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

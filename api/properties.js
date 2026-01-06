import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let propertiesCollection;
let usersCollection;
let bookingsCollection;
let reviewsCollection;

async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db("homeNestDB");
    propertiesCollection = db.collection("propertiesCollection");
    usersCollection = db.collection("users");
    bookingsCollection = db.collection("bookings");
    reviewsCollection = db.collection("reviews");
  }
  return { propertiesCollection, usersCollection, bookingsCollection, reviewsCollection };
}

// Verify token middleware
const verifyToken = async (req) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return { valid: false, decodedToken: null, message: "Unauthorized. Token not found!" };
  }
  const token = authorization.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return { valid: true, decodedToken };
  } catch (error) {
    return { valid: false, decodedToken: null, message: "Unauthorized access." };
  }
};

// Verify admin middleware
const verifyAdmin = async (req) => {
  const tokenResult = await verifyToken(req);
  if (!tokenResult.valid) {
    return tokenResult;
  }

  const userEmail = tokenResult.decodedToken.email;
  
  // Check if user is admin in the database
  const { usersCollection } = await connectToDatabase();
  const user = await usersCollection.findOne({ email: userEmail });
  if (!user || user.role !== 'admin') {
    return { valid: false, decodedToken: null, message: "Access denied. Admin only." };
  }

  return { valid: true, decodedToken: tokenResult.decodedToken };
};

export default async function handler(req, res) {
  const { propertiesCollection } = await connectToDatabase();

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { search, sortBy, category } = req.query;
    let query = {};
    
    if (search) query.propertyName = { $regex: search, $options: "i" };
    if (category) query.category = category; // Filter by category
    
    let sortOptions = {};
    if (sortBy === "price") sortOptions = { price: 1 };
    else if (sortBy === "date") sortOptions = { createdAt: -1 };

    try {
      const result = await propertiesCollection.find(query).sort(sortOptions).toArray();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching properties:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const tokenResult = await verifyToken(req);
    if (!tokenResult.valid) {
      return res.status(401).json({ message: tokenResult.message });
    }

    try {
      const newProperty = { ...req.body, createdAt: new Date() };
      const result = await propertiesCollection.insertOne(newProperty);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error adding property:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    const tokenResult = await verifyToken(req);
    if (!tokenResult.valid) {
      return res.status(401).json({ message: tokenResult.message });
    }

    const { id } = req.query;
    const propertyData = req.body;
    
    try {
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
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error updating property:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const tokenResult = await verifyToken(req);
    if (!tokenResult.valid) {
      return res.status(401).json({ message: tokenResult.message });
    }

    const { id } = req.query;
    
    try {
      const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting property:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export const config = {
  api: {
    bodyParser: true,
  },
};
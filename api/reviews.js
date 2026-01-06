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
let reviewsCollection;

async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db("homeNestDB");
    reviewsCollection = db.collection("reviews");
  }
  return { reviewsCollection };
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
  const { reviewsCollection } = await connectToDatabase();

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { propertyId, email } = req.query;
    try {
      let query = {};
      if (propertyId) {
        query = { propertyId: propertyId };
      } else if (email) {
        query = { userEmail: email };
      }
      
      const result = await reviewsCollection.find(query).toArray();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const tokenResult = await verifyToken(req);
    if (!tokenResult.valid) {
      return res.status(401).json({ message: tokenResult.message });
    }

    try {
      const newReview = { ...req.body, createdAt: new Date() };
      const result = await reviewsCollection.insertOne(newReview);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error adding review:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const adminResult = await verifyAdmin(req);
    if (!adminResult.valid) {
      // Allow users to delete their own reviews
      const tokenResult = await verifyToken(req);
      if (!tokenResult.valid) {
        return res.status(401).json({ message: tokenResult.message });
      }
    }

    const { id } = req.query;
    
    try {
      const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting review:', error);
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
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
let contactCollection;

async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db("homeNestDB");
    contactCollection = db.collection("contact");
  }
  return { contactCollection };
}

export default async function handler(req, res) {
  const { contactCollection } = await connectToDatabase();

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const contactData = { ...req.body, createdAt: new Date(), status: 'new' };
      const result = await contactCollection.insertOne(contactData);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error saving contact form:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    // Only allow admin to view contact messages
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ message: "Unauthorized. Token not found!" });
    }
    const token = authorization.split(" ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Check if user is admin
      const usersCollection = db.collection("users");
      const user = await usersCollection.findOne({ email: decodedToken.email });
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }
      
      const result = await contactCollection.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching contact messages:', error);
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
// Vercel API route that serves as the main entry point
// This is a simple health check endpoint
export default function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'HomeNest API is running successfully!',
      endpoints: {
        properties: '/api/properties',
        users: '/api/users',
        bookings: '/api/bookings',
        reviews: '/api/reviews'
      }
    });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export const config = {
  api: {
    bodyParser: true,
  },
};
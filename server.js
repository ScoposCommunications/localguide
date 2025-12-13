// Development server for the API
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// In-memory cache
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;

// Category detection based on place name keywords
function detectCategory(placeName) {
  const name = placeName.toLowerCase();

  if (
    name.includes('restaurant') ||
    name.includes('cafe') ||
    name.includes('coffee') ||
    name.includes('pizza') ||
    name.includes('bar') ||
    name.includes('grill') ||
    name.includes('kitchen') ||
    name.includes('bakery') ||
    name.includes('diner') ||
    name.includes('food') ||
    name.includes('taco') ||
    name.includes('sushi') ||
    name.includes('burger')
  ) {
    return 'Food';
  }

  if (
    name.includes('hotel') ||
    name.includes('inn') ||
    name.includes('motel') ||
    name.includes('resort') ||
    name.includes('lodge') ||
    name.includes('suites')
  ) {
    return 'Hotels';
  }

  if (
    name.includes('park') ||
    name.includes('trail') ||
    name.includes('beach') ||
    name.includes('lake') ||
    name.includes('mountain') ||
    name.includes('forest') ||
    name.includes('garden') ||
    name.includes('nature')
  ) {
    return 'Outdoors';
  }

  if (
    name.includes('museum') ||
    name.includes('theater') ||
    name.includes('theatre') ||
    name.includes('zoo') ||
    name.includes('aquarium') ||
    name.includes('amusement') ||
    name.includes('attraction')
  ) {
    return 'Attractions';
  }

  if (
    name.includes('mall') ||
    name.includes('store') ||
    name.includes('shop') ||
    name.includes('market') ||
    name.includes('outlet')
  ) {
    return 'Shopping';
  }

  if (
    name.includes('monument') ||
    name.includes('memorial') ||
    name.includes('historic') ||
    name.includes('landmark') ||
    name.includes('tower') ||
    name.includes('bridge') ||
    name.includes('capitol') ||
    name.includes('cathedral') ||
    name.includes('church')
  ) {
    return 'Landmarks';
  }

  return 'Other';
}

// Generate coordinates within major US metropolitan areas for realistic clustering
function generateCoordinates() {
  const cities = [
    { lat: 40.7128, lng: -74.0060, spread: 0.15 }, // New York
    { lat: 34.0522, lng: -118.2437, spread: 0.2 }, // Los Angeles
    { lat: 41.8781, lng: -87.6298, spread: 0.1 }, // Chicago
    { lat: 29.7604, lng: -95.3698, spread: 0.15 }, // Houston
    { lat: 33.4484, lng: -112.0740, spread: 0.12 }, // Phoenix
    { lat: 39.7392, lng: -104.9903, spread: 0.1 }, // Denver
    { lat: 47.6062, lng: -122.3321, spread: 0.08 }, // Seattle
    { lat: 37.7749, lng: -122.4194, spread: 0.1 }, // San Francisco
    { lat: 25.7617, lng: -80.1918, spread: 0.15 }, // Miami
    { lat: 38.9072, lng: -77.0369, spread: 0.08 }, // Washington DC
  ];

  const city = cities[Math.floor(Math.random() * cities.length)];
  return {
    lat: city.lat + (Math.random() - 0.5) * city.spread,
    lng: city.lng + (Math.random() - 0.5) * city.spread,
  };
}

function generateDemoContributions(count) {
  const places = [
    // Food
    'The Capital Grille', 'Shake Shack Times Square', "Joe's Pizza", "Katz's Delicatessen",
    'Blue Bottle Coffee', 'Momofuku Noodle Bar', 'Le Bernardin', 'Peter Luger Steak House',
    "Grimaldi's Pizzeria", 'The Spotted Pig', 'Carbone', 'Via Carota',
    'Russ & Daughters Cafe', 'Dominique Ansel Bakery', 'Eleven Madison Park',
    'The French Laundry', 'In-N-Out Burger', 'Nobu Restaurant', 'The Cheesecake Factory',
    'Olive Garden Times Square', 'Shake Shack Hollywood', 'Eataly NYC Downtown',

    // Hotels
    'The Plaza Hotel', 'Waldorf Astoria', 'The Standard High Line', 'Ace Hotel New York',
    'The NoMad Hotel', 'Gramercy Park Hotel', 'The Bowery Hotel', 'The Jane Hotel',
    'Four Seasons Beverly Hills', 'The Ritz-Carlton Chicago', 'W Hotel Miami Beach',

    // Outdoors
    'Central Park', 'Brooklyn Bridge Park', 'The High Line', 'Prospect Park',
    'Hudson River Park', 'Washington Square Park', 'Battery Park', 'Governors Island',
    'Griffith Park', 'Golden Gate Park', 'Millennium Park', 'Everglades National Park',

    // Attractions
    'Metropolitan Museum of Art', 'MoMA', 'American Museum of Natural History',
    'Statue of Liberty', 'Empire State Building', 'Top of the Rock', 'One World Observatory',
    '9/11 Memorial & Museum', 'Bronx Zoo', 'Brooklyn Museum', 'Getty Center',
    'Walt Disney World Magic Kingdom', 'Universal Studios Hollywood',

    // Shopping
    "Macy's Herald Square", "Bloomingdale's", 'Century 21', 'Chelsea Market',
    'Brooklyn Flea', 'Strand Bookstore', 'Eataly NYC Flatiron', 'The Grove LA',
    'Rodeo Drive Shops', 'Michigan Avenue Shopping District',

    // Landmarks
    'Grand Central Terminal', 'Brooklyn Bridge', 'Flatiron Building', "St. Patrick's Cathedral",
    'Trinity Church', 'Chrysler Building', 'Radio City Music Hall', 'Lincoln Center',
    'Hollywood Sign', 'Golden Gate Bridge', 'Space Needle', 'Capitol Building',
  ];

  const contributions = [];

  for (let i = 0; i < count; i++) {
    const placeName = places[Math.floor(Math.random() * places.length)];
    const category = detectCategory(placeName);
    // More realistic view distribution - most have moderate views, few have very high
    const viewCount = Math.floor(Math.pow(Math.random(), 0.3) * 500000) + 500;

    contributions.push({
      id: `contrib-${i}`,
      placeName,
      placeUrl: `https://www.google.com/maps/place/?q=place_id:demo${i}`,
      photoUrl: `https://picsum.photos/seed/${i + 100}/800/600`,
      thumbnailUrl: `https://picsum.photos/seed/${i + 100}/400/300`,
      viewCount,
      rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
      category,
      coordinates: generateCoordinates(),
      date: new Date(Date.now() - Math.random() * 8 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Sort by view count descending
  return contributions.sort((a, b) => b.viewCount - a.viewCount);
}

function getProfileData() {
  // Check cache first
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  // Generate demo data
  const contributions = generateDemoContributions(150);
  const totalViews = contributions.reduce((sum, c) => sum + c.viewCount, 0);

  const profileData = {
    name: 'Local Guide',
    level: 8,
    totalViews,
    totalPhotos: contributions.length,
    totalReviews: Math.floor(contributions.length * 0.7),
    profileUrl: PROFILE_URL,
    contributions,
    lastUpdated: new Date().toISOString(),
  };

  // Cache the result
  cachedData = profileData;
  cacheTimestamp = Date.now();

  return profileData;
}

app.get('/api/profile', (req, res) => {
  try {
    const data = getProfileData();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile data' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

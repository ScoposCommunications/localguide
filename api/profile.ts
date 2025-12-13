import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ProfileData, Contribution, Category } from '../src/types';

// In-memory cache with 1 hour TTL
let cachedData: ProfileData | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;

// Category detection based on place name keywords
function detectCategory(placeName: string): Category {
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

// Generate random coordinates within the US for demo purposes
// In production, these would be extracted from the actual Google Maps data
function generateCoordinates(): { lat: number; lng: number } {
  // Random coordinates within continental US
  const lat = 25 + Math.random() * 24; // 25 to 49
  const lng = -125 + Math.random() * 57; // -125 to -68
  return { lat, lng };
}

async function scrapeProfile(): Promise<ProfileData> {
  // Check cache first
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  // Since we can't use Puppeteer in Vercel edge functions,
  // and Google Maps requires JavaScript execution,
  // we'll use a combination of approaches:
  // 1. For demo: Use realistic mock data based on typical Local Guide profiles
  // 2. For production: Use Puppeteer with @sparticuz/chromium in a Node.js serverless function

  // For now, generate realistic mock data that demonstrates the UI
  // The actual scraping implementation would use Puppeteer like this:
  /*
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.goto(PROFILE_URL, { waitUntil: 'networkidle0' });

  // Extract data from the page
  const data = await page.evaluate(() => {
    // Scraping logic here
  });

  await browser.close();
  */

  // Generate demo data
  const contributions: Contribution[] = generateDemoContributions(150);

  const totalViews = contributions.reduce((sum, c) => sum + c.viewCount, 0);

  const profileData: ProfileData = {
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

function generateDemoContributions(count: number): Contribution[] {
  const places = [
    // Food
    'The Capital Grille', 'Shake Shack Times Square', 'Joe\'s Pizza', 'Katz\'s Delicatessen',
    'Blue Bottle Coffee', 'Momofuku Noodle Bar', 'Le Bernardin', 'Peter Luger Steak House',
    'Grimaldi\'s Pizzeria', 'The Spotted Pig', 'Carbone', 'Via Carota',
    'Russ & Daughters Cafe', 'Dominique Ansel Bakery', 'Eleven Madison Park',

    // Hotels
    'The Plaza Hotel', 'Waldorf Astoria', 'The Standard High Line', 'Ace Hotel New York',
    'The NoMad Hotel', 'Gramercy Park Hotel', 'The Bowery Hotel', 'The Jane Hotel',

    // Outdoors
    'Central Park', 'Brooklyn Bridge Park', 'The High Line', 'Prospect Park',
    'Hudson River Park', 'Washington Square Park', 'Battery Park', 'Governors Island',

    // Attractions
    'Metropolitan Museum of Art', 'MoMA', 'American Museum of Natural History',
    'Statue of Liberty', 'Empire State Building', 'Top of the Rock', 'One World Observatory',
    '9/11 Memorial & Museum', 'Bronx Zoo', 'Brooklyn Museum',

    // Shopping
    'Macy\'s Herald Square', 'Bloomingdale\'s', 'Century 21', 'Chelsea Market',
    'Brooklyn Flea', 'Strand Bookstore', 'Eataly NYC Flatiron',

    // Landmarks
    'Grand Central Terminal', 'Brooklyn Bridge', 'Flatiron Building', 'St. Patrick\'s Cathedral',
    'Trinity Church', 'Chrysler Building', 'Radio City Music Hall', 'Lincoln Center',
  ];

  const contributions: Contribution[] = [];

  for (let i = 0; i < count; i++) {
    const placeName = places[Math.floor(Math.random() * places.length)];
    const category = detectCategory(placeName);
    const viewCount = Math.floor(Math.random() * 500000) + 1000;

    contributions.push({
      id: `contrib-${i}`,
      placeName,
      placeUrl: `https://www.google.com/maps/place/?q=place_id:demo${i}`,
      photoUrl: `https://picsum.photos/seed/${i}/800/600`,
      thumbnailUrl: `https://picsum.photos/seed/${i}/400/300`,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await scrapeProfile();

    // Set cache headers
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile data' });
  }
}

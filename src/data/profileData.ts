import type { ProfileData, Contribution, Category } from '../types';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;

function detectCategory(placeName: string): Category {
  const name = placeName.toLowerCase();

  if (name.includes('restaurant') || name.includes('cafe') || name.includes('coffee') ||
      name.includes('pizza') || name.includes('bar') || name.includes('grill') ||
      name.includes('kitchen') || name.includes('bakery') || name.includes('diner') ||
      name.includes('food') || name.includes('taco') || name.includes('sushi') ||
      name.includes('burger')) {
    return 'Food';
  }
  if (name.includes('hotel') || name.includes('inn') || name.includes('motel') ||
      name.includes('resort') || name.includes('lodge') || name.includes('suites')) {
    return 'Hotels';
  }
  if (name.includes('park') || name.includes('trail') || name.includes('beach') ||
      name.includes('lake') || name.includes('mountain') || name.includes('forest') ||
      name.includes('garden') || name.includes('nature')) {
    return 'Outdoors';
  }
  if (name.includes('museum') || name.includes('theater') || name.includes('theatre') ||
      name.includes('zoo') || name.includes('aquarium') || name.includes('amusement')) {
    return 'Attractions';
  }
  if (name.includes('mall') || name.includes('store') || name.includes('shop') ||
      name.includes('market') || name.includes('outlet')) {
    return 'Shopping';
  }
  if (name.includes('monument') || name.includes('memorial') || name.includes('historic') ||
      name.includes('landmark') || name.includes('tower') || name.includes('bridge') ||
      name.includes('capitol') || name.includes('cathedral') || name.includes('church')) {
    return 'Landmarks';
  }
  return 'Other';
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function generateCoordinates(random: () => number): { lat: number; lng: number } {
  const cities = [
    { lat: 40.7128, lng: -74.0060, spread: 0.15 },
    { lat: 34.0522, lng: -118.2437, spread: 0.2 },
    { lat: 41.8781, lng: -87.6298, spread: 0.1 },
    { lat: 29.7604, lng: -95.3698, spread: 0.15 },
    { lat: 33.4484, lng: -112.0740, spread: 0.12 },
    { lat: 39.7392, lng: -104.9903, spread: 0.1 },
    { lat: 47.6062, lng: -122.3321, spread: 0.08 },
    { lat: 37.7749, lng: -122.4194, spread: 0.1 },
    { lat: 25.7617, lng: -80.1918, spread: 0.15 },
    { lat: 38.9072, lng: -77.0369, spread: 0.08 },
  ];
  const city = cities[Math.floor(random() * cities.length)];
  return {
    lat: city.lat + (random() - 0.5) * city.spread,
    lng: city.lng + (random() - 0.5) * city.spread,
  };
}

function generateContributions(): Contribution[] {
  const random = seededRandom(12345);
  const places = [
    'The Capital Grille', 'Shake Shack Times Square', "Joe's Pizza", "Katz's Delicatessen",
    'Blue Bottle Coffee', 'Momofuku Noodle Bar', 'Le Bernardin', 'Peter Luger Steak House',
    "Grimaldi's Pizzeria", 'The Spotted Pig', 'Carbone', 'Via Carota',
    'Russ & Daughters Cafe', 'Dominique Ansel Bakery', 'Eleven Madison Park',
    'The French Laundry', 'In-N-Out Burger', 'Nobu Restaurant', 'The Cheesecake Factory',
    'The Plaza Hotel', 'Waldorf Astoria', 'The Standard High Line', 'Ace Hotel New York',
    'The NoMad Hotel', 'Gramercy Park Hotel', 'The Bowery Hotel', 'The Jane Hotel',
    'Four Seasons Beverly Hills', 'The Ritz-Carlton Chicago', 'W Hotel Miami Beach',
    'Central Park', 'Brooklyn Bridge Park', 'The High Line', 'Prospect Park',
    'Hudson River Park', 'Washington Square Park', 'Battery Park', 'Governors Island',
    'Griffith Park', 'Golden Gate Park', 'Millennium Park', 'Everglades National Park',
    'Metropolitan Museum of Art', 'MoMA', 'American Museum of Natural History',
    'Statue of Liberty', 'Empire State Building', 'Top of the Rock', 'One World Observatory',
    '9/11 Memorial & Museum', 'Bronx Zoo', 'Brooklyn Museum', 'Getty Center',
    "Macy's Herald Square", "Bloomingdale's", 'Century 21', 'Chelsea Market',
    'Brooklyn Flea', 'Strand Bookstore', 'Eataly NYC Flatiron', 'The Grove LA',
    'Grand Central Terminal', 'Brooklyn Bridge', 'Flatiron Building', "St. Patrick's Cathedral",
    'Trinity Church', 'Chrysler Building', 'Radio City Music Hall', 'Lincoln Center',
    'Hollywood Sign', 'Golden Gate Bridge', 'Space Needle', 'Capitol Building',
  ];

  const contributions: Contribution[] = [];
  for (let i = 0; i < 150; i++) {
    const placeName = places[Math.floor(random() * places.length)];
    const viewCount = Math.floor(Math.pow(random(), 0.3) * 500000) + 500;
    contributions.push({
      id: `contrib-${i}`,
      placeName,
      placeUrl: `https://www.google.com/maps/place/?q=place_id:demo${i}`,
      photoUrl: `https://picsum.photos/seed/${i + 100}/800/600`,
      thumbnailUrl: `https://picsum.photos/seed/${i + 100}/400/300`,
      viewCount,
      rating: Math.floor(random() * 2) + 4,
      category: detectCategory(placeName),
      coordinates: generateCoordinates(random),
    });
  }
  return contributions.sort((a, b) => b.viewCount - a.viewCount);
}

const contributions = generateContributions();
const totalViews = contributions.reduce((sum, c) => sum + c.viewCount, 0);

export const profileData: ProfileData = {
  name: 'Local Guide',
  level: 8,
  totalViews,
  totalPhotos: contributions.length,
  totalReviews: Math.floor(contributions.length * 0.7),
  profileUrl: PROFILE_URL,
  contributions,
  lastUpdated: new Date().toISOString(),
};

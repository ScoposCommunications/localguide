import type { ProfileData, Contribution, Category } from '../types';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;

// Realistic data for an established Local Guide
export const profileData: ProfileData = {
  name: 'Local Guide',
  level: 8,
  totalViews: 32847291,
  totalPhotos: 2847,
  totalReviews: 412,
  profileUrl: PROFILE_URL,
  contributions: generateContributions(),
  lastUpdated: new Date().toISOString(),
};

function detectCategory(placeName: string): Category {
  const name = placeName.toLowerCase();
  if (name.includes('restaurant') || name.includes('cafe') || name.includes('coffee') ||
      name.includes('pizza') || name.includes('bar') || name.includes('grill') ||
      name.includes('kitchen') || name.includes('bakery') || name.includes('burger')) {
    return 'Food';
  }
  if (name.includes('hotel') || name.includes('inn') || name.includes('resort') ||
      name.includes('lodge') || name.includes('suites')) {
    return 'Hotels';
  }
  if (name.includes('park') || name.includes('trail') || name.includes('beach') ||
      name.includes('lake') || name.includes('mountain') || name.includes('garden')) {
    return 'Outdoors';
  }
  if (name.includes('museum') || name.includes('theater') || name.includes('zoo') ||
      name.includes('aquarium')) {
    return 'Attractions';
  }
  if (name.includes('mall') || name.includes('store') || name.includes('shop') ||
      name.includes('market')) {
    return 'Shopping';
  }
  if (name.includes('monument') || name.includes('memorial') || name.includes('bridge') ||
      name.includes('tower') || name.includes('cathedral') || name.includes('church')) {
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
    { lat: 40.7128, lng: -74.0060, spread: 0.12 },
    { lat: 34.0522, lng: -118.2437, spread: 0.15 },
    { lat: 41.8781, lng: -87.6298, spread: 0.08 },
    { lat: 37.7749, lng: -122.4194, spread: 0.1 },
    { lat: 25.7617, lng: -80.1918, spread: 0.12 },
    { lat: 38.9072, lng: -77.0369, spread: 0.06 },
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
    'The Capital Grille', 'Shake Shack', "Joe's Pizza", "Katz's Delicatessen",
    'Blue Bottle Coffee', 'Momofuku Noodle Bar', 'Le Bernardin', 'Peter Luger Steak House',
    "Grimaldi's Pizzeria", 'Carbone', 'Eleven Madison Park', 'Nobu Restaurant',
    'The Plaza Hotel', 'Waldorf Astoria', 'The Standard High Line', 'Ace Hotel',
    'Four Seasons', 'The Ritz-Carlton', 'W Hotel', 'Park Hyatt',
    'Central Park', 'Brooklyn Bridge Park', 'The High Line', 'Prospect Park',
    'Golden Gate Park', 'Millennium Park', 'Griffith Observatory',
    'Metropolitan Museum of Art', 'MoMA', 'Natural History Museum',
    'Statue of Liberty', 'Empire State Building', 'One World Observatory',
    '9/11 Memorial', 'Bronx Zoo', 'Getty Center', 'LACMA',
    "Macy's", "Bloomingdale's", 'Chelsea Market', 'The Grove',
    'Grand Central Terminal', 'Brooklyn Bridge', 'Golden Gate Bridge',
    'Hollywood Sign', 'Space Needle', 'Capitol Building',
  ];

  const contributions: Contribution[] = [];
  for (let i = 0; i < 120; i++) {
    const placeName = places[Math.floor(random() * places.length)];
    const viewCount = Math.floor(50000 + random() * 450000);
    contributions.push({
      id: `contrib-${i}`,
      placeName,
      placeUrl: `https://www.google.com/maps/contrib/${PROFILE_ID}`,
      photoUrl: `https://picsum.photos/seed/${i + 200}/800/600`,
      thumbnailUrl: `https://picsum.photos/seed/${i + 200}/400/300`,
      viewCount,
      rating: Math.floor(random() * 2) + 4,
      category: detectCategory(placeName),
      coordinates: generateCoordinates(random),
    });
  }
  return contributions.sort((a, b) => b.viewCount - a.viewCount);
}

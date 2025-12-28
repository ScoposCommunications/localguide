/**
 * Google Maps Local Guide Profile Scraper
 * Uses SerpApi for reliable data extraction
 *
 * Required: SERPAPI_KEY environment variable
 * Get free API key (100 searches/month): https://serpapi.com/
 */

import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

// SerpApi endpoint
const SERPAPI_BASE = 'https://serpapi.com/search.json';

async function fetchFromSerpApi(params) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_KEY environment variable is required. Get a free key at https://serpapi.com/');
  }

  const url = new URL(SERPAPI_BASE);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpApi request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getContributorReviews() {
  console.log('Fetching contributor reviews from SerpApi...');

  const data = await fetchFromSerpApi({
    engine: 'google_maps_contributor_reviews',
    contributor_id: PROFILE_ID,
    hl: 'en'
  });

  return data;
}

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile:', PROFILE_URL);

  try {
    // Get contributor data from SerpApi
    const contributorData = await getContributorReviews();

    console.log('Contributor data received:', JSON.stringify(contributorData, null, 2).slice(0, 500) + '...');

    // Extract profile info from contributor data
    const contributor = contributorData.contributor || {};
    const reviews = contributorData.reviews || [];

    // Extract photos from reviews (reviews often include photos)
    const photos = [];
    let photoIndex = 0;

    for (const review of reviews) {
      if (review.images && Array.isArray(review.images)) {
        for (const img of review.images) {
          photos.push({
            id: `photo-${photoIndex++}`,
            url: img.original || img.thumbnail || img,
            thumbnail: img.thumbnail || img.original || img,
            placeName: review.place?.title || review.title || null,
            placeUrl: review.place?.link || null,
            rating: review.rating || null
          });
        }
      }
    }

    // Parse contributor stats
    const output = {
      name: contributor.name || 'Local Guide',
      level: contributor.level || null,
      totalViews: null, // SerpApi doesn't provide view counts directly
      totalPhotos: contributor.photos || null,
      totalReviews: contributor.reviews || null,
      points: contributor.points || null,
      localGuide: contributor.local_guide || false,
      thumbnailUrl: contributor.thumbnail || null,
      profileUrl: PROFILE_URL,
      photos: photos.slice(0, 50), // Limit to 50 photos
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: !!(contributor.name || contributor.level || photos.length > 0)
    };

    console.log('=== RESULTS ===');
    console.log('Name:', output.name);
    console.log('Level:', output.level);
    console.log('Photos count:', output.totalPhotos);
    console.log('Reviews count:', output.totalReviews);
    console.log('Scraped photos:', photos.length);
    console.log('Success:', output.scrapedSuccessfully);

    // Write output
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log('=== SCRAPE COMPLETE ===');
    console.log('Data saved to:', OUTPUT_PATH);

  } catch (err) {
    console.error('SCRAPE FAILED:', err.message);

    // Write error state
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
      needsSetup: true,
      scrapedSuccessfully: false,
      error: err.message,
      profileUrl: PROFILE_URL,
      photos: [],
      lastUpdated: new Date().toISOString()
    }, null, 2));

    process.exit(1);
  }
}

scrapeProfile();

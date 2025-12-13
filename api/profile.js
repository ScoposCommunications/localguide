import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}/photos`;

// Cache for 1 hour
let cachedData = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  // Return cached data if valid
  if (cachedData && Date.now() - cacheTime < CACHE_DURATION) {
    return res.status(200).json(cachedData);
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to profile
    await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Extract profile data
    const profileData = await page.evaluate((profileId) => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      // Try to find stats from the page
      const bodyText = document.body.innerText;

      // Parse view count - look for patterns like "123,456,789 views" or "123M views"
      let totalViews = 0;
      const viewPatterns = [
        /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:M|million)\s*views/i,
        /(\d{1,3}(?:,\d{3})*)\s*views/i,
        /views[:\s]*(\d{1,3}(?:,\d{3})*)/i,
      ];

      for (const pattern of viewPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          let num = match[1].replace(/,/g, '');
          if (match[0].toLowerCase().includes('m') || match[0].toLowerCase().includes('million')) {
            totalViews = Math.floor(parseFloat(num) * 1000000);
          } else {
            totalViews = parseInt(num, 10);
          }
          break;
        }
      }

      // Parse level
      let level = 0;
      const levelMatch = bodyText.match(/Level\s*(\d+)/i);
      if (levelMatch) {
        level = parseInt(levelMatch[1], 10);
      }

      // Parse photos count
      let totalPhotos = 0;
      const photosMatch = bodyText.match(/(\d{1,3}(?:,\d{3})*)\s*photos/i);
      if (photosMatch) {
        totalPhotos = parseInt(photosMatch[1].replace(/,/g, ''), 10);
      }

      // Parse reviews count
      let totalReviews = 0;
      const reviewsMatch = bodyText.match(/(\d{1,3}(?:,\d{3})*)\s*reviews/i);
      if (reviewsMatch) {
        totalReviews = parseInt(reviewsMatch[1].replace(/,/g, ''), 10);
      }

      // Get contribution photos
      const contributions = [];
      const photoElements = document.querySelectorAll('[data-photo-id], .gallery-image, img[src*="googleusercontent"]');

      photoElements.forEach((el, index) => {
        if (index < 50) { // Limit to 50 photos
          const img = el.tagName === 'IMG' ? el : el.querySelector('img');
          if (img && img.src && img.src.includes('googleusercontent')) {
            contributions.push({
              id: `photo-${index}`,
              photoUrl: img.src.replace(/=w\d+-h\d+/, '=w800-h600'),
              thumbnailUrl: img.src.replace(/=w\d+-h\d+/, '=w400-h300'),
            });
          }
        }
      });

      return {
        level,
        totalViews,
        totalPhotos,
        totalReviews,
        contributions,
        profileUrl: `https://www.google.com/maps/contrib/${profileId}`,
      };
    }, PROFILE_ID);

    await browser.close();

    // Build response
    const response = {
      name: 'Local Guide',
      level: profileData.level || 8,
      totalViews: profileData.totalViews || 0,
      totalPhotos: profileData.totalPhotos || 0,
      totalReviews: profileData.totalReviews || 0,
      profileUrl: profileData.profileUrl,
      contributions: profileData.contributions || [],
      lastUpdated: new Date().toISOString(),
    };

    // Cache the response
    cachedData = response;
    cacheTime = Date.now();

    return res.status(200).json(response);

  } catch (error) {
    console.error('Scraping error:', error);

    if (browser) {
      await browser.close();
    }

    // Return fallback data on error
    return res.status(200).json({
      name: 'Local Guide',
      level: 8,
      totalViews: 0,
      totalPhotos: 0,
      totalReviews: 0,
      profileUrl: `https://www.google.com/maps/contrib/${PROFILE_ID}`,
      contributions: [],
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch live data',
    });
  }
}

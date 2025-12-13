import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

async function scrapeProfile() {
  console.log('Starting profile scrape...');
  console.log('Profile URL:', PROFILE_URL);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to profile...');
    await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for content to load
    await page.waitForSelector('body', { timeout: 30000 });

    // Give extra time for dynamic content
    await new Promise(r => setTimeout(r, 5000));

    console.log('Extracting data...');

    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Extract stats using various patterns
      let totalViews = 0;
      let totalPhotos = 0;
      let totalReviews = 0;
      let level = 0;

      // Views - look for patterns like "12,345,678 views" or "12M views"
      const viewsPatterns = [
        /(\d{1,3}(?:,\d{3})*)\s*views/gi,
        /views[:\s]+(\d{1,3}(?:,\d{3})*)/gi,
      ];

      for (const pattern of viewsPatterns) {
        const matches = [...bodyText.matchAll(pattern)];
        for (const match of matches) {
          const num = parseInt(match[1].replace(/,/g, ''), 10);
          if (num > totalViews) totalViews = num;
        }
      }

      // Check for "M" million format
      const millionMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*M\s*views/i);
      if (millionMatch) {
        const millionViews = Math.floor(parseFloat(millionMatch[1]) * 1000000);
        if (millionViews > totalViews) totalViews = millionViews;
      }

      // Photos
      const photosMatch = bodyText.match(/(\d{1,3}(?:,\d{3})*)\s*photos/i);
      if (photosMatch) {
        totalPhotos = parseInt(photosMatch[1].replace(/,/g, ''), 10);
      }

      // Reviews
      const reviewsMatch = bodyText.match(/(\d{1,3}(?:,\d{3})*)\s*reviews/i);
      if (reviewsMatch) {
        totalReviews = parseInt(reviewsMatch[1].replace(/,/g, ''), 10);
      }

      // Level
      const levelMatch = bodyText.match(/Level\s*(\d+)/i);
      if (levelMatch) {
        level = parseInt(levelMatch[1], 10);
      }

      // Get photo URLs
      const photos = [];
      const imgElements = document.querySelectorAll('img[src*="googleusercontent.com"]');
      imgElements.forEach((img, index) => {
        if (index < 100 && img.src && !img.src.includes('avatar') && !img.src.includes('profile')) {
          photos.push({
            id: `photo-${index}`,
            url: img.src.replace(/=w\d+-h\d+.*/, '=w800-h600'),
            thumbnail: img.src.replace(/=w\d+-h\d+.*/, '=w400-h300')
          });
        }
      });

      return {
        level,
        totalViews,
        totalPhotos,
        totalReviews,
        photos,
        rawTextSample: bodyText.substring(0, 2000) // For debugging
      };
    });

    console.log('Extracted data:', {
      level: data.level,
      totalViews: data.totalViews,
      totalPhotos: data.totalPhotos,
      totalReviews: data.totalReviews,
      photosFound: data.photos.length
    });

    // Build the profile data object
    const profileData = {
      name: 'Local Guide',
      level: data.level || 0,
      totalViews: data.totalViews || 0,
      totalPhotos: data.totalPhotos || 0,
      totalReviews: data.totalReviews || 0,
      profileUrl: PROFILE_URL,
      photos: data.photos || [],
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: data.totalViews > 0 || data.totalPhotos > 0
    };

    // Write to file
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(profileData, null, 2));
    console.log('Data saved to:', OUTPUT_PATH);

    await browser.close();
    console.log('Scrape complete!');

  } catch (error) {
    console.error('Scraping failed:', error);
    await browser.close();
    process.exit(1);
  }
}

scrapeProfile();

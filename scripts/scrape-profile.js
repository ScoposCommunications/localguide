import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile:', PROFILE_URL);

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Loading page...');
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for content to load
    await new Promise(r => setTimeout(r, 5000));

    console.log('Extracting data...');
    const data = await page.evaluate(() => {
      const text = document.body.innerText;

      // Extract stats from page text
      const levelMatch = text.match(/Level\s+(\d+)/i);
      const viewsMatch = text.match(/([\d,]+)\s*views/i);
      const photosMatch = text.match(/([\d,]+)\s*photos/i);
      const reviewsMatch = text.match(/([\d,]+)\s*reviews/i);

      // Get photo URLs
      const photos = [...document.querySelectorAll('img[src*="googleusercontent"]')]
        .filter(img => !img.src.includes('avatar') && img.width > 50)
        .slice(0, 30)
        .map((img, i) => ({
          id: `photo-${i}`,
          url: img.src.replace(/=w\d+-h\d+/, '=w800-h600'),
          thumbnail: img.src
        }));

      return {
        level: levelMatch ? levelMatch[1] : null,
        totalViews: viewsMatch ? viewsMatch[1].replace(/,/g, '') : null,
        totalPhotos: photosMatch ? photosMatch[1].replace(/,/g, '') : null,
        totalReviews: reviewsMatch ? reviewsMatch[1].replace(/,/g, '') : null,
        photos
      };
    });

    await browser.close();

    const output = {
      name: 'Local Guide',
      level: data.level ? parseInt(data.level) : null,
      totalViews: data.totalViews ? parseInt(data.totalViews) : null,
      totalPhotos: data.totalPhotos ? parseInt(data.totalPhotos) : null,
      totalReviews: data.totalReviews ? parseInt(data.totalReviews) : null,
      profileUrl: PROFILE_URL,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: !!(data.level || data.totalViews || data.totalPhotos)
    };

    console.log('Results:', JSON.stringify(output, null, 2));

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log('=== SCRAPE COMPLETE ===');

  } catch (err) {
    console.error('SCRAPE FAILED:', err.message);
    if (browser) await browser.close();

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
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

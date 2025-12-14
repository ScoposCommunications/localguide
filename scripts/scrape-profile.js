import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile URL:', PROFILE_URL);
  console.log('');

  let browser;
  try {
    console.log('Launching browser with @sparticuz/chromium...');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigating to profile...');
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Waiting for content...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Extracting data...');
    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      const result = {
        level: null,
        totalViews: null,
        totalPhotos: null,
        totalReviews: null,
        photos: []
      };

      // Level
      const levelMatch = text.match(/Level\s+(\d+)/i);
      if (levelMatch) result.level = parseInt(levelMatch[1]);

      // Views
      const viewPatterns = [
        /(\d[\d,]*)\s*views/i,
        /viewed\s+(\d[\d,]*)/i,
        /(\d[\d,]*)\s*photo views/i
      ];
      for (const p of viewPatterns) {
        const m = text.match(p);
        if (m) {
          result.totalViews = parseInt(m[1].replace(/,/g, ''));
          break;
        }
      }

      // Photos
      const photoMatch = text.match(/(\d[\d,]*)\s*photos?/i);
      if (photoMatch) result.totalPhotos = parseInt(photoMatch[1].replace(/,/g, ''));

      // Reviews
      const reviewMatch = text.match(/(\d[\d,]*)\s*reviews?/i);
      if (reviewMatch) result.totalReviews = parseInt(reviewMatch[1].replace(/,/g, ''));

      // Photo URLs
      document.querySelectorAll('img[src*="googleusercontent"]').forEach((img, i) => {
        if (i < 50 && img.src && !img.src.includes('avatar')) {
          result.photos.push({
            id: `photo-${i}`,
            url: img.src.replace(/=w\d+-h\d+.*/, '=w800-h600'),
            thumbnail: img.src
          });
        }
      });

      return result;
    });

    await browser.close();

    console.log('');
    console.log('=== EXTRACTED DATA ===');
    console.log('Level:', data.level);
    console.log('Total Views:', data.totalViews);
    console.log('Total Photos:', data.totalPhotos);
    console.log('Total Reviews:', data.totalReviews);
    console.log('Photos found:', data.photos.length);

    const output = {
      needsSetup: false,
      name: 'Local Guide',
      level: data.level,
      totalViews: data.totalViews,
      totalPhotos: data.totalPhotos,
      totalReviews: data.totalReviews,
      profileUrl: PROFILE_URL,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: !!(data.level || data.totalViews || data.totalPhotos)
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log('');
    console.log('Data saved to:', OUTPUT_PATH);
    console.log('=== SCRAPE COMPLETE ===');

  } catch (error) {
    console.error('');
    console.error('=== SCRAPE FAILED ===');
    console.error('Error:', error.message);

    if (browser) await browser.close();

    const errorOutput = {
      needsSetup: false,
      scrapedSuccessfully: false,
      error: error.message,
      name: null,
      level: null,
      totalViews: null,
      totalPhotos: null,
      totalReviews: null,
      profileUrl: PROFILE_URL,
      photos: [],
      lastUpdated: new Date().toISOString()
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(errorOutput, null, 2));
    console.log('Error state saved. Build will continue.');
  }
}

scrapeProfile();

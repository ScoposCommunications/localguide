import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

// Ensure chromium binary is ready
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile:', PROFILE_URL);

  let browser;
  try {
    const execPath = await chromium.executablePath();
    console.log('Chrome path:', execPath);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: true,
      defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    console.log('Loading page...');
    await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        level: (text.match(/Level\s+(\d+)/i) || [])[1] || null,
        totalViews: (text.match(/(\d[\d,]*)\s*views/i) || [])[1]?.replace(/,/g, '') || null,
        totalPhotos: (text.match(/(\d[\d,]*)\s*photos/i) || [])[1]?.replace(/,/g, '') || null,
        totalReviews: (text.match(/(\d[\d,]*)\s*reviews/i) || [])[1]?.replace(/,/g, '') || null,
        photos: [...document.querySelectorAll('img[src*="googleusercontent"]')]
          .filter(img => !img.src.includes('avatar'))
          .slice(0, 30)
          .map((img, i) => ({ id: `p${i}`, url: img.src, thumbnail: img.src }))
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
    console.log('=== DONE ===');

  } catch (err) {
    console.error('FAILED:', err.message);
    if (browser) await browser.close();

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
      scrapedSuccessfully: false,
      error: err.message,
      profileUrl: PROFILE_URL,
      photos: [],
      lastUpdated: new Date().toISOString()
    }, null, 2));
  }
}

scrapeProfile();

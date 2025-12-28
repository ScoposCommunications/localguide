import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');
const SCREENSHOT_DIR = path.join(process.cwd(), 'debug-screenshots');

// Optional: ScrapingBee API key for fallback
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumber(str) {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.floor(num);
}

function parseStats(text) {
  let level = null;
  let totalViews = null;
  let totalPhotos = null;
  let totalReviews = null;

  // Level
  const levelPatterns = [
    /Local Guide\s*[·•\-]?\s*Level\s*(\d+)/i,
    /Level\s+(\d+)\s*Local Guide/i,
    /Level\s+(\d+)/i
  ];
  for (const pattern of levelPatterns) {
    const match = text.match(pattern);
    if (match) {
      level = parseInt(match[1]);
      console.log('      Found level:', level);
      break;
    }
  }

  // Views - handle "65M views", "65,000,000 views"
  const viewsPatterns = [
    /(\d+(?:\.\d+)?)\s*M\s*views/i,
    /(\d+(?:\.\d+)?)\s*B\s*views/i,
    /(\d{1,3}(?:,\d{3})+)\s*views/i,
    /(\d+)\s*views/i
  ];
  for (const pattern of viewsPatterns) {
    const match = text.match(pattern);
    if (match) {
      let viewNum = match[1].replace(/,/g, '');
      if (/M\s*views/i.test(match[0])) {
        viewNum = parseFloat(viewNum) * 1000000;
      } else if (/B\s*views/i.test(match[0])) {
        viewNum = parseFloat(viewNum) * 1000000000;
      }
      totalViews = Math.floor(parseFloat(viewNum));
      console.log('      Found views:', totalViews);
      break;
    }
  }

  // Photos
  const photosPatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*photos/i,
    /photos[:\s]+(\d{1,3}(?:,\d{3})*)/i
  ];
  for (const pattern of photosPatterns) {
    const match = text.match(pattern);
    if (match) {
      totalPhotos = parseNumber(match[1]);
      console.log('      Found photos:', totalPhotos);
      break;
    }
  }

  // Reviews
  const reviewsPatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*reviews/i,
    /reviews[:\s]+(\d{1,3}(?:,\d{3})*)/i
  ];
  for (const pattern of reviewsPatterns) {
    const match = text.match(pattern);
    if (match) {
      totalReviews = parseNumber(match[1]);
      console.log('      Found reviews:', totalReviews);
      break;
    }
  }

  return { level, totalViews, totalPhotos, totalReviews };
}

function extractPhotoUrls(html) {
  const photos = [];
  const seenUrls = new Set();

  // Find all googleusercontent image URLs
  const imgRegex = /https:\/\/lh[3-5]\.googleusercontent\.com\/[^"'\s<>]+/g;
  const matches = html.match(imgRegex) || [];

  for (const url of matches) {
    // Skip avatars and small images
    if (url.includes('=s32') || url.includes('=s48') || url.includes('=s64') || url.includes('=s96')) continue;
    if (url.includes('avatar') || url.includes('profile')) continue;

    const baseUrl = url.split('=')[0];
    if (seenUrls.has(baseUrl)) continue;
    seenUrls.add(baseUrl);

    photos.push({
      id: `photo-${photos.length}`,
      url: baseUrl + '=w800-h600-k-no',
      thumbnail: baseUrl + '=w300-h200-k-no'
    });

    if (photos.length >= 50) break;
  }

  return photos;
}

async function scrapeWithScrapingBee() {
  console.log('[SCRAPINGBEE] Using ScrapingBee API...');

  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_API_KEY,
    url: PROFILE_URL,
    render_js: 'true',
    wait: '5000',
    wait_browser: 'networkidle0',
    premium_proxy: 'true',
    country_code: 'us'
  });

  const response = await fetch(`https://app.scrapingbee.com/api/v1?${params}`);

  if (!response.ok) {
    throw new Error(`ScrapingBee error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  console.log('[SCRAPINGBEE] Got response, length:', html.length);

  // Save for debugging
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'scrapingbee-response.html'), html);

  // Extract text content (simple HTML to text)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'scrapingbee-text.txt'), textContent);

  const stats = parseStats(textContent);
  const photos = extractPhotoUrls(html);

  return { ...stats, photos, html, text: textContent };
}

async function scrapeWithPuppeteer() {
  console.log('[PUPPETEER] Using Puppeteer with Stealth plugin...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    });

    console.log('[PUPPETEER] Navigating to profile...');
    const response = await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle0',
      timeout: 90000
    });

    console.log('[PUPPETEER] Response status:', response.status());

    // Handle consent page
    const currentUrl = page.url();
    if (currentUrl.includes('consent') || currentUrl.includes('signin')) {
      console.log('[PUPPETEER] Detected consent page, trying to accept...');
      try {
        await page.click('button[aria-label*="Accept"]');
        await delay(2000);
      } catch {
        // Try other buttons
        const buttons = await page.$$('button');
        for (const btn of buttons.slice(0, 5)) {
          try {
            await btn.click();
            await delay(1000);
            break;
          } catch { /* ignore */ }
        }
      }
    }

    // Take screenshot
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial.png'), fullPage: true });

    // Wait and scroll
    await delay(8000);
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await delay(500);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-scroll.png'), fullPage: true });

    // Get content
    const pageData = await page.evaluate(() => ({
      html: document.documentElement.outerHTML,
      text: document.body.innerText || '',
      title: document.title
    }));

    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'page-source.html'), pageData.html);
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'page-text.txt'), pageData.text);

    console.log('[PUPPETEER] Page text length:', pageData.text.length);
    console.log('[PUPPETEER] Page title:', pageData.title);

    // Log preview
    console.log('[PUPPETEER] Text preview:');
    console.log(pageData.text.substring(0, 1000));

    const stats = parseStats(pageData.text);

    // Extract photos from page
    const photos = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const imgs = document.querySelectorAll('img');

      for (const img of imgs) {
        const src = img.src || '';
        if (!src.includes('googleusercontent.com')) continue;
        if (src.includes('=s32') || src.includes('=s48') || src.includes('=s64')) continue;
        if (src.includes('avatar') || src.includes('profile')) continue;

        const base = src.split('=')[0];
        if (seen.has(base)) continue;
        seen.add(base);

        results.push({
          id: `photo-${results.length}`,
          url: base + '=w800-h600-k-no',
          thumbnail: base + '=w300-h200-k-no'
        });

        if (results.length >= 50) break;
      }
      return results;
    });

    await browser.close();
    return { ...stats, photos, html: pageData.html, text: pageData.text };

  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function scrapeProfile() {
  console.log('='.repeat(60));
  console.log('GOOGLE MAPS LOCAL GUIDE PROFILE SCRAPER');
  console.log('='.repeat(60));
  console.log('Profile URL:', PROFILE_URL);
  console.log('ScrapingBee API:', SCRAPINGBEE_API_KEY ? 'Available (will use as primary)' : 'Not configured');
  console.log('Time:', new Date().toISOString());
  console.log('');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  let result;
  let method;

  try {
    // Try ScrapingBee first if available (more reliable)
    if (SCRAPINGBEE_API_KEY) {
      method = 'scrapingbee';
      result = await scrapeWithScrapingBee();
    } else {
      method = 'puppeteer';
      result = await scrapeWithPuppeteer();
    }
  } catch (err) {
    console.error(`[${method?.toUpperCase()}] Failed:`, err.message);

    // Fallback to other method
    if (method === 'scrapingbee') {
      console.log('Falling back to Puppeteer...');
      try {
        method = 'puppeteer';
        result = await scrapeWithPuppeteer();
      } catch (err2) {
        console.error('[PUPPETEER] Also failed:', err2.message);
        throw err2;
      }
    } else {
      throw err;
    }
  }

  const { level, totalViews, totalPhotos, totalReviews, photos } = result;
  const hasData = level !== null || totalViews !== null || totalPhotos !== null || totalReviews !== null;

  const output = {
    name: 'Local Guide',
    level,
    totalViews,
    totalPhotos,
    totalReviews,
    profileUrl: PROFILE_URL,
    photos,
    lastUpdated: new Date().toISOString(),
    scrapedSuccessfully: hasData,
    scrapedWith: method
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS:');
  console.log('  Method:', method);
  console.log('  Level:', level ?? 'NOT FOUND');
  console.log('  Views:', totalViews?.toLocaleString() ?? 'NOT FOUND');
  console.log('  Photos:', totalPhotos?.toLocaleString() ?? 'NOT FOUND');
  console.log('  Reviews:', totalReviews?.toLocaleString() ?? 'NOT FOUND');
  console.log('  Images:', photos.length);
  console.log('  Success:', hasData ? 'YES' : 'NO');
  console.log('='.repeat(60));

  if (!hasData) {
    console.log('');
    console.log('WARNING: No data extracted. Check debug-screenshots/ for details.');
    if (!SCRAPINGBEE_API_KEY) {
      console.log('');
      console.log('TIP: For more reliable scraping, set up ScrapingBee:');
      console.log('  1. Sign up at https://www.scrapingbee.com (free tier available)');
      console.log('  2. Add SCRAPINGBEE_API_KEY as a GitHub repository secret');
    }
    process.exit(1);
  }
}

scrapeProfile().catch(err => {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    needsSetup: true,
    name: null,
    level: null,
    totalViews: null,
    totalPhotos: null,
    totalReviews: null,
    profileUrl: PROFILE_URL,
    photos: [],
    lastUpdated: new Date().toISOString(),
    scrapedSuccessfully: false,
    error: err.message
  }, null, 2));

  process.exit(1);
});

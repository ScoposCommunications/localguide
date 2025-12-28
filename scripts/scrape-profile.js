import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');
const SCREENSHOT_DIR = path.join(process.cwd(), 'debug-screenshots');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeProfile() {
  console.log('='.repeat(60));
  console.log('GOOGLE MAPS LOCAL GUIDE PROFILE SCRAPER');
  console.log('='.repeat(60));
  console.log('Profile URL:', PROFILE_URL);
  console.log('Output:', OUTPUT_PATH);
  console.log('Time:', new Date().toISOString());
  console.log('');

  let browser;

  try {
    // Create screenshot directory
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    console.log('[1/7] Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    console.log('[2/7] Navigating to profile...');
    const response = await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('      Response status:', response.status());

    // Take initial screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });
    console.log('      Screenshot saved: 01-initial-load.png');

    console.log('[3/7] Waiting for page to fully render...');
    await delay(5000);

    // Scroll down to trigger lazy loading
    console.log('[4/7] Scrolling to load content...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(1000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-scroll.png'), fullPage: true });
    console.log('      Screenshot saved: 02-after-scroll.png');

    console.log('[5/7] Extracting data from page...');

    const data = await page.evaluate(() => {
      const results = {
        level: null,
        totalViews: null,
        totalPhotos: null,
        totalReviews: null,
        photos: [],
        debugInfo: {
          bodyTextLength: 0,
          foundElements: [],
          pageTitle: document.title,
          url: window.location.href
        }
      };

      // Get full page text for debugging
      const bodyText = document.body.innerText || '';
      results.debugInfo.bodyTextLength = bodyText.length;

      // Log first 2000 chars for debugging
      console.log('Page text preview:', bodyText.substring(0, 2000));

      // Try multiple patterns for each stat

      // Level patterns
      const levelPatterns = [
        /Level\s+(\d+)/i,
        /Local Guide\s*·?\s*Level\s*(\d+)/i,
        /(\d+)\s*level/i
      ];

      for (const pattern of levelPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          results.level = match[1];
          results.debugInfo.foundElements.push(`Level found with pattern: ${pattern}`);
          break;
        }
      }

      // Views patterns - handle millions/billions
      const viewsPatterns = [
        /([\d,\.]+)\s*[MB]?\s*views/i,
        /views[:\s]*([\d,\.]+)\s*[MB]?/i,
        /([\d,\.]+)\s*million\s*views/i,
        /([\d,\.]+)M\s*views/i
      ];

      for (const pattern of viewsPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          let viewStr = match[1].replace(/,/g, '');
          // Handle "M" suffix for millions
          if (bodyText.match(new RegExp(match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*M', 'i')) ||
              match[0].toLowerCase().includes('million') ||
              match[0].includes('M')) {
            if (!viewStr.includes('.')) {
              viewStr = String(parseFloat(viewStr) * 1000000);
            } else {
              viewStr = String(parseFloat(viewStr) * 1000000);
            }
          }
          results.totalViews = viewStr;
          results.debugInfo.foundElements.push(`Views found: ${match[0]}`);
          break;
        }
      }

      // Photos patterns
      const photosPatterns = [
        /([\d,]+)\s*photos/i,
        /photos[:\s]*([\d,]+)/i,
        /([\d,]+)\s*photo(?:graph)?s?\s*(?:shared|contributed|uploaded)/i
      ];

      for (const pattern of photosPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          results.totalPhotos = match[1].replace(/,/g, '');
          results.debugInfo.foundElements.push(`Photos found: ${match[0]}`);
          break;
        }
      }

      // Reviews patterns
      const reviewsPatterns = [
        /([\d,]+)\s*reviews/i,
        /reviews[:\s]*([\d,]+)/i,
        /([\d,]+)\s*review(?:s)?\s*(?:written|contributed)/i
      ];

      for (const pattern of reviewsPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          results.totalReviews = match[1].replace(/,/g, '');
          results.debugInfo.foundElements.push(`Reviews found: ${match[0]}`);
          break;
        }
      }

      // Get photos - try multiple selectors
      const photoSelectors = [
        'img[src*="googleusercontent.com"]',
        'img[src*="lh3.google"]',
        'img[src*="lh4.google"]',
        'img[src*="lh5.google"]',
        '[role="img"] img',
        'img[data-src*="google"]'
      ];

      const seenUrls = new Set();

      for (const selector of photoSelectors) {
        const images = document.querySelectorAll(selector);
        for (const img of images) {
          const src = img.src || img.dataset.src;
          if (!src) continue;
          if (src.includes('avatar')) continue;
          if (src.includes('profile')) continue;
          if (img.width < 50 && img.height < 50) continue;

          // Normalize URL to avoid duplicates
          const baseUrl = src.split('=')[0];
          if (seenUrls.has(baseUrl)) continue;
          seenUrls.add(baseUrl);

          results.photos.push({
            id: `photo-${results.photos.length}`,
            url: src.replace(/=w\d+-h\d+[^&]*/, '=w800-h600'),
            thumbnail: src.replace(/=w\d+-h\d+[^&]*/, '=w300-h200')
          });

          if (results.photos.length >= 50) break;
        }
        if (results.photos.length >= 50) break;
      }

      results.debugInfo.foundElements.push(`Found ${results.photos.length} photos`);

      return results;
    });

    console.log('');
    console.log('[6/7] Results:');
    console.log('      Level:', data.level || 'NOT FOUND');
    console.log('      Views:', data.totalViews || 'NOT FOUND');
    console.log('      Photos:', data.totalPhotos || 'NOT FOUND');
    console.log('      Reviews:', data.totalReviews || 'NOT FOUND');
    console.log('      Images found:', data.photos.length);
    console.log('');
    console.log('      Debug info:');
    console.log('      - Page title:', data.debugInfo.pageTitle);
    console.log('      - Body text length:', data.debugInfo.bodyTextLength);
    console.log('      - Found elements:', data.debugInfo.foundElements.join(', '));

    // Get page content for debugging
    const pageContent = await page.content();
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'page-source.html'), pageContent);
    console.log('      Page source saved: page-source.html');

    await browser.close();

    // Check if we got meaningful data
    const hasData = data.level || data.totalViews || data.totalPhotos || data.totalReviews;

    const output = {
      name: 'Local Guide',
      level: data.level ? parseInt(data.level) : null,
      totalViews: data.totalViews ? parseInt(data.totalViews) : null,
      totalPhotos: data.totalPhotos ? parseInt(data.totalPhotos) : null,
      totalReviews: data.totalReviews ? parseInt(data.totalReviews) : null,
      profileUrl: PROFILE_URL,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: hasData
    };

    console.log('[7/7] Saving output...');
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log('');
    console.log('='.repeat(60));
    if (hasData) {
      console.log('SUCCESS! Data extracted and saved.');
    } else {
      console.log('WARNING: No data could be extracted from the page.');
      console.log('Check the debug screenshots and page source for more info.');
    }
    console.log('='.repeat(60));

    // Exit with error if no data
    if (!hasData) {
      process.exit(1);
    }

  } catch (err) {
    console.error('');
    console.error('='.repeat(60));
    console.error('SCRAPE FAILED:', err.message);
    console.error('Stack:', err.stack);
    console.error('='.repeat(60));

    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          await pages[0].screenshot({ path: path.join(SCREENSHOT_DIR, 'error-state.png'), fullPage: true });
          console.log('Error screenshot saved: error-state.png');
        }
      } catch (e) {
        console.error('Could not save error screenshot:', e.message);
      }
      await browser.close();
    }

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
  }
}

scrapeProfile();

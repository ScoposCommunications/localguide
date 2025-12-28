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

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumber(str) {
  if (!str) return null;
  // Remove commas and parse
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.floor(num);
}

async function scrapeProfile() {
  console.log('='.repeat(60));
  console.log('GOOGLE MAPS LOCAL GUIDE PROFILE SCRAPER');
  console.log('Using puppeteer-extra with stealth plugin');
  console.log('='.repeat(60));
  console.log('Profile URL:', PROFILE_URL);
  console.log('Output:', OUTPUT_PATH);
  console.log('Time:', new Date().toISOString());
  console.log('');

  let browser;

  try {
    // Create screenshot directory
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    console.log('[1/8] Launching stealth browser...');
    browser = await puppeteer.launch({
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

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });

    // Use a common user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    console.log('[2/8] Navigating to profile...');
    const response = await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle0',
      timeout: 90000
    });

    console.log('      Response status:', response.status());
    console.log('      Response URL:', response.url());

    // Check for redirects or consent pages
    const currentUrl = page.url();
    if (currentUrl.includes('consent') || currentUrl.includes('signin')) {
      console.log('      Detected consent/signin page, attempting to proceed...');

      // Try to click accept/continue buttons
      const acceptSelectors = [
        'button[aria-label*="Accept"]',
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
        '[data-ved] button',
        'form button'
      ];

      for (const selector of acceptSelectors) {
        try {
          await page.click(selector);
          console.log('      Clicked:', selector);
          await delay(2000);
          break;
        } catch (e) {
          // Selector not found, try next
        }
      }
    }

    // Take initial screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });
    console.log('      Screenshot: 01-initial-load.png');

    console.log('[3/8] Waiting for dynamic content...');
    await delay(8000); // Wait longer for JS to execute

    console.log('[4/8] Scrolling to load lazy content...');
    // Scroll down slowly to trigger lazy loading
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await delay(500);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-scroll.png'), fullPage: true });
    console.log('      Screenshot: 02-after-scroll.png');

    console.log('[5/8] Extracting page content...');

    // Get full page HTML and text
    const pageData = await page.evaluate(() => {
      return {
        html: document.documentElement.outerHTML,
        text: document.body.innerText || '',
        title: document.title,
        url: window.location.href
      };
    });

    // Save page source for debugging
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'page-source.html'), pageData.html);
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'page-text.txt'), pageData.text);
    console.log('      Page source and text saved');

    console.log('[6/8] Parsing statistics...');
    console.log('      Page text length:', pageData.text.length, 'chars');
    console.log('      Page title:', pageData.title);

    // Log a preview of the text for debugging
    console.log('');
    console.log('      Text preview (first 1500 chars):');
    console.log('      ---');
    console.log(pageData.text.substring(0, 1500).split('\n').map(l => '      ' + l).join('\n'));
    console.log('      ---');
    console.log('');

    // Parse stats from text using multiple patterns
    let level = null;
    let totalViews = null;
    let totalPhotos = null;
    let totalReviews = null;

    const text = pageData.text;

    // Level - try multiple patterns
    const levelPatterns = [
      /Local Guide\s*[·•-]?\s*Level\s*(\d+)/i,
      /Level\s+(\d+)\s*Local Guide/i,
      /Level\s+(\d+)/i
    ];
    for (const pattern of levelPatterns) {
      const match = text.match(pattern);
      if (match) {
        level = parseInt(match[1]);
        console.log('      Found level:', level, 'with pattern:', pattern.toString());
        break;
      }
    }

    // Views - handle various formats including "65M views", "65,000,000 views"
    const viewsPatterns = [
      /(\d+(?:\.\d+)?)\s*[MB]\s*views/i,          // 65M views, 1.5B views
      /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*views/i,  // 65,000,000 views
      /views[:\s]+(\d+(?:,\d+)*(?:\.\d+)?)/i      // views: 65,000,000
    ];
    for (const pattern of viewsPatterns) {
      const match = text.match(pattern);
      if (match) {
        let viewNum = match[1].replace(/,/g, '');
        // Check if the original match had M or B suffix
        if (/M\s*views/i.test(match[0])) {
          viewNum = parseFloat(viewNum) * 1000000;
        } else if (/B\s*views/i.test(match[0])) {
          viewNum = parseFloat(viewNum) * 1000000000;
        }
        totalViews = Math.floor(parseFloat(viewNum));
        console.log('      Found views:', totalViews, 'with pattern:', pattern.toString());
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
        console.log('      Found photos:', totalPhotos, 'with pattern:', pattern.toString());
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
        console.log('      Found reviews:', totalReviews, 'with pattern:', pattern.toString());
        break;
      }
    }

    console.log('[7/8] Extracting photos...');

    // Extract photo URLs from page
    const photos = await page.evaluate(() => {
      const photoUrls = [];
      const seenUrls = new Set();

      // Find all images that look like user photos
      const images = document.querySelectorAll('img');

      for (const img of images) {
        const src = img.src || img.dataset?.src || '';

        // Skip small images, avatars, icons
        if (!src) continue;
        if (!src.includes('googleusercontent.com') && !src.includes('lh3.google') && !src.includes('lh4.google') && !src.includes('lh5.google')) continue;
        if (src.includes('avatar') || src.includes('profile') || src.includes('=s32') || src.includes('=s48') || src.includes('=s64')) continue;

        // Dedupe by base URL
        const baseUrl = src.split('=')[0];
        if (seenUrls.has(baseUrl)) continue;
        seenUrls.add(baseUrl);

        // Create high-res URL
        const highResUrl = baseUrl + '=w800-h600-k-no';
        const thumbUrl = baseUrl + '=w300-h200-k-no';

        photoUrls.push({
          id: `photo-${photoUrls.length}`,
          url: highResUrl,
          thumbnail: thumbUrl
        });

        if (photoUrls.length >= 50) break;
      }

      return photoUrls;
    });

    console.log('      Found', photos.length, 'photos');

    await browser.close();

    // Check if we got meaningful data
    const hasData = level !== null || totalViews !== null || totalPhotos !== null || totalReviews !== null;

    const output = {
      name: 'Local Guide',
      level: level,
      totalViews: totalViews,
      totalPhotos: totalPhotos,
      totalReviews: totalReviews,
      profileUrl: PROFILE_URL,
      photos: photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: hasData,
      debugInfo: {
        pageTitle: pageData.title,
        pageUrl: pageData.url,
        textLength: pageData.text.length,
        photosFound: photos.length
      }
    };

    console.log('[8/8] Saving results...');
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log('');
    console.log('='.repeat(60));
    console.log('RESULTS:');
    console.log('  Level:', level ?? 'NOT FOUND');
    console.log('  Views:', totalViews?.toLocaleString() ?? 'NOT FOUND');
    console.log('  Photos:', totalPhotos?.toLocaleString() ?? 'NOT FOUND');
    console.log('  Reviews:', totalReviews?.toLocaleString() ?? 'NOT FOUND');
    console.log('  Images:', photos.length);
    console.log('  Success:', hasData ? 'YES' : 'NO - Check debug artifacts');
    console.log('='.repeat(60));

    if (!hasData) {
      console.log('');
      console.log('WARNING: Could not extract data from page.');
      console.log('Possible reasons:');
      console.log('  - Google blocked automated access');
      console.log('  - Page structure changed');
      console.log('  - Consent/login page shown');
      console.log('');
      console.log('Check the debug-screenshots folder for more info.');
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
          console.log('Error screenshot saved');
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

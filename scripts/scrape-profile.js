import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

async function handleConsentDialog(page) {
  console.log('Checking for consent dialog...');

  // Common consent button selectors for Google
  const consentSelectors = [
    'button[aria-label*="Accept"]',
    'button[aria-label*="accept"]',
    'button[aria-label*="Agree"]',
    '[aria-label*="Accept all"]',
    '[aria-label*="Reject all"]',
    'form[action*="consent"] button',
    '#L2AGLb', // Google's "I agree" button ID
    '#W0wltc', // Google's "Reject all" button ID
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Reject all")',
  ];

  for (const selector of consentSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        console.log(`Found consent button: ${selector}`);
        await button.click();
        await new Promise(r => setTimeout(r, 2000));
        console.log('Clicked consent button');
        return true;
      }
    } catch (e) {
      // Continue trying other selectors
    }
  }

  // Try clicking any visible button with consent-related text
  try {
    const clicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.innerText.toLowerCase();
        if (text.includes('accept') || text.includes('agree') || text.includes('reject all')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      console.log('Clicked consent button via text search');
      await new Promise(r => setTimeout(r, 2000));
      return true;
    }
  } catch (e) {
    console.log('No consent buttons found via text search');
  }

  console.log('No consent dialog found or already dismissed');
  return false;
}

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile:', PROFILE_URL);
  console.log('Time:', new Date().toISOString());

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set language to English to ensure consistent text patterns
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    console.log('Loading page...');
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Handle consent dialog
    await handleConsentDialog(page);

    // Wait for page to settle after consent
    await new Promise(r => setTimeout(r, 3000));

    // Try navigating again if needed (consent might redirect)
    const currentUrl = page.url();
    if (!currentUrl.includes('/maps/contrib/')) {
      console.log('Redirected, navigating back to profile...');
      await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));
    }

    // Wait for content to load - look for profile indicators
    console.log('Waiting for profile content...');
    try {
      await page.waitForSelector('img[src*="googleusercontent"]', { timeout: 15000 });
      console.log('Found profile images');
    } catch (e) {
      console.log('No profile images found within timeout');
    }

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 5000));

    // Save screenshot for debugging
    const screenshotPath = path.join(process.cwd(), 'debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);

    // Debug: Log page title and URL
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log('Page title:', pageTitle);
    console.log('Page URL:', pageUrl);

    console.log('Extracting data...');
    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      const html = document.body.innerHTML;

      // Debug: Log a sample of the text content
      console.log('Page text sample:', text.substring(0, 1000));

      // Multiple patterns for stats extraction
      // Pattern 1: "Level X" format
      let level = null;
      const levelPatterns = [
        /Level\s+(\d+)/i,
        /level\s*:\s*(\d+)/i,
        /Local Guide\s*·?\s*Level\s+(\d+)/i,
      ];
      for (const pattern of levelPatterns) {
        const match = text.match(pattern);
        if (match) {
          level = match[1];
          break;
        }
      }

      // Pattern for views - try multiple formats
      let totalViews = null;
      const viewsPatterns = [
        /([\d,]+(?:\.\d+)?[KMB]?)\s*(?:photo\s*)?views/i,
        /views[:\s]*([\d,]+)/i,
        /([\d,]+)\s*Views/i,
      ];
      for (const pattern of viewsPatterns) {
        const match = text.match(pattern);
        if (match) {
          totalViews = match[1].replace(/,/g, '');
          // Handle K, M, B suffixes
          if (totalViews.endsWith('K')) {
            totalViews = String(parseFloat(totalViews) * 1000);
          } else if (totalViews.endsWith('M')) {
            totalViews = String(parseFloat(totalViews) * 1000000);
          } else if (totalViews.endsWith('B')) {
            totalViews = String(parseFloat(totalViews) * 1000000000);
          }
          break;
        }
      }

      // Pattern for photos
      let totalPhotos = null;
      const photosPatterns = [
        /([\d,]+(?:\.\d+)?[KMB]?)\s*photos/i,
        /photos[:\s]*([\d,]+)/i,
        /([\d,]+)\s*Photos/i,
      ];
      for (const pattern of photosPatterns) {
        const match = text.match(pattern);
        if (match) {
          totalPhotos = match[1].replace(/,/g, '');
          if (totalPhotos.endsWith('K')) {
            totalPhotos = String(parseFloat(totalPhotos) * 1000);
          } else if (totalPhotos.endsWith('M')) {
            totalPhotos = String(parseFloat(totalPhotos) * 1000000);
          }
          break;
        }
      }

      // Pattern for reviews
      let totalReviews = null;
      const reviewsPatterns = [
        /([\d,]+(?:\.\d+)?[KMB]?)\s*reviews/i,
        /reviews[:\s]*([\d,]+)/i,
        /([\d,]+)\s*Reviews/i,
      ];
      for (const pattern of reviewsPatterns) {
        const match = text.match(pattern);
        if (match) {
          totalReviews = match[1].replace(/,/g, '');
          if (totalReviews.endsWith('K')) {
            totalReviews = String(parseFloat(totalReviews) * 1000);
          } else if (totalReviews.endsWith('M')) {
            totalReviews = String(parseFloat(totalReviews) * 1000000);
          }
          break;
        }
      }

      // Try to get name from profile
      let name = 'Local Guide';
      const namePatterns = [
        /aria-label="([^"]+)'s? contributions/i,
        /contributions by ([^"<]+)/i,
      ];
      for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match) {
          name = match[1].trim();
          break;
        }
      }

      // Get photo URLs - try multiple selectors
      const photoSelectors = [
        'img[src*="googleusercontent.com"]',
        'img[src*="lh3.googleusercontent"]',
        'img[src*="lh4.googleusercontent"]',
        'img[src*="lh5.googleusercontent"]',
        '[data-photo-id] img',
        '.gallery-image img',
      ];

      let photos = [];
      for (const selector of photoSelectors) {
        const imgs = [...document.querySelectorAll(selector)];
        const validPhotos = imgs
          .filter(img => {
            const src = img.src || '';
            // Exclude avatars and tiny images
            return !src.includes('avatar') &&
                   !src.includes('=s32') &&
                   !src.includes('=s48') &&
                   !src.includes('=s64') &&
                   (img.width > 50 || src.includes('=w') || src.includes('=s'));
          })
          .map((img, i) => {
            let url = img.src;
            // Resize to larger version
            url = url.replace(/=w\d+-h\d+/, '=w800-h600');
            url = url.replace(/=s\d+/, '=s800');
            return {
              id: `photo-${i}`,
              url: url,
              thumbnail: img.src
            };
          });

        if (validPhotos.length > 0) {
          photos = validPhotos.slice(0, 30);
          break;
        }
      }

      return {
        name,
        level,
        totalViews,
        totalPhotos,
        totalReviews,
        photos,
        debugText: text.substring(0, 2000) // Include for debugging
      };
    });

    await browser.close();

    // Log debug info
    console.log('=== EXTRACTED DATA ===');
    console.log('Name:', data.name);
    console.log('Level:', data.level);
    console.log('Views:', data.totalViews);
    console.log('Photos:', data.totalPhotos);
    console.log('Reviews:', data.totalReviews);
    console.log('Photo count:', data.photos.length);
    console.log('=== DEBUG TEXT ===');
    console.log(data.debugText);
    console.log('===================');

    const scrapedSuccessfully = !!(data.level || data.totalViews || data.totalPhotos || data.photos.length > 0);

    const output = {
      name: data.name || 'Local Guide',
      level: data.level ? parseInt(data.level) : null,
      totalViews: data.totalViews ? parseInt(data.totalViews) : null,
      totalPhotos: data.totalPhotos ? parseInt(data.totalPhotos) : null,
      totalReviews: data.totalReviews ? parseInt(data.totalReviews) : null,
      profileUrl: PROFILE_URL,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully
    };

    console.log('Final output:', JSON.stringify(output, null, 2));

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    if (!scrapedSuccessfully) {
      console.log('WARNING: No data extracted - page structure may have changed');
      // Don't exit with error so we can see the debug output
    }

    console.log('=== SCRAPE COMPLETE ===');

  } catch (err) {
    console.error('SCRAPE FAILED:', err.message);
    console.error('Stack:', err.stack);
    if (browser) await browser.close();

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
      name: 'Local Guide',
      level: null,
      totalViews: null,
      totalPhotos: null,
      totalReviews: null,
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

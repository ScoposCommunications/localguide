import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

// Helper to scroll page and load lazy content
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight || totalHeight > 5000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile ID:', PROFILE_ID);
  console.log('URL:', PROFILE_URL);
  console.log('Timestamp:', new Date().toISOString());

  let browser;
  try {
    console.log('\n[1/6] Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Block unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('[2/6] Loading profile page...');
    const response = await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log(`     HTTP Status: ${response.status()}`);

    // Wait for page content to stabilize
    console.log('[3/6] Waiting for content to load...');
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load lazy content
    console.log('[4/6] Scrolling to load lazy content...');
    await autoScroll(page);
    await new Promise(r => setTimeout(r, 2000));

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    console.log('[5/6] Extracting data...');
    const data = await page.evaluate(() => {
      const text = document.body.innerText;

      // Log page text length for debugging
      console.log('Page text length:', text.length);

      // Extract name - usually in an h1 or heading element
      let name = null;
      const h1 = document.querySelector('h1');
      if (h1) {
        name = h1.innerText.trim();
      }
      // If name contains "contributions" or looks like stats, try alternatives
      if (!name || name.toLowerCase().includes('contribution') || /^\d/.test(name)) {
        const headings = document.querySelectorAll('[role="heading"]');
        for (const h of headings) {
          const t = h.innerText.trim();
          if (t && !t.toLowerCase().includes('contribution') && !/^\d/.test(t) && t.length < 50) {
            name = t;
            break;
          }
        }
      }

      // Extract level - patterns like "Level 8" or "Level 8 Local Guide"
      let level = null;
      const levelPatterns = [
        /Level\s*(\d+)/i,
        /Local Guide\s*Level\s*(\d+)/i,
        /(\d+)\s*Local Guide/i
      ];
      for (const pattern of levelPatterns) {
        const match = text.match(pattern);
        if (match) {
          level = parseInt(match[1]);
          if (level >= 1 && level <= 10) break; // Valid level range
          level = null;
        }
      }

      // Extract views - "X views" or "viewed X times"
      let totalViews = null;
      const viewPatterns = [
        /([\d,]+(?:\.\d+)?[KMB]?)\s*views/i,
        /viewed\s*([\d,]+(?:\.\d+)?[KMB]?)\s*times/i,
        /([\d,]+(?:\.\d+)?)\s*photo\s*views/i
      ];
      for (const pattern of viewPatterns) {
        const match = text.match(pattern);
        if (match) {
          let val = match[1].replace(/,/g, '');
          // Handle K, M, B suffixes
          if (val.endsWith('K')) totalViews = parseFloat(val) * 1000;
          else if (val.endsWith('M')) totalViews = parseFloat(val) * 1000000;
          else if (val.endsWith('B')) totalViews = parseFloat(val) * 1000000000;
          else totalViews = parseInt(val);
          if (totalViews > 0) break;
        }
      }

      // Extract photos count
      let totalPhotos = null;
      const photoPatterns = [
        /([\d,]+)\s*photos?(?!\s*views)/i,
        /photos?\s*\(?([\d,]+)\)?/i
      ];
      for (const pattern of photoPatterns) {
        const match = text.match(pattern);
        if (match) {
          totalPhotos = parseInt(match[1].replace(/,/g, ''));
          if (totalPhotos > 0) break;
        }
      }

      // Extract reviews count
      let totalReviews = null;
      const reviewPatterns = [
        /([\d,]+)\s*reviews?/i,
        /reviews?\s*\(?([\d,]+)\)?/i
      ];
      for (const pattern of reviewPatterns) {
        const match = text.match(pattern);
        if (match) {
          totalReviews = parseInt(match[1].replace(/,/g, ''));
          if (totalReviews > 0) break;
        }
      }

      // Extract ratings count if available
      let totalRatings = null;
      const ratingMatch = text.match(/([\d,]+)\s*ratings?/i);
      if (ratingMatch) {
        totalRatings = parseInt(ratingMatch[1].replace(/,/g, ''));
      }

      // Get photo elements - look for contribution images
      const photos = [];
      const imgElements = document.querySelectorAll('img[src*="googleusercontent"], img[src*="gstatic"]');

      for (const img of imgElements) {
        const src = img.src || '';
        // Skip avatars, icons, and very small images
        if (src.includes('avatar') || src.includes('icon') || img.width < 50 || img.height < 50) {
          continue;
        }
        // Skip if it looks like a UI element
        if (img.closest('button') || img.closest('[role="menuitem"]')) {
          continue;
        }

        // Get high-res version of the image
        const highResUrl = src.replace(/=w\d+-h\d+/, '=w800-h600').replace(/=s\d+/, '=s800');

        photos.push({
          id: `photo-${photos.length}`,
          url: highResUrl,
          thumbnail: src
        });

        if (photos.length >= 50) break; // Limit to 50 photos
      }

      // Get first 500 chars of page text for debugging
      const debugText = text.substring(0, 500).replace(/\s+/g, ' ');

      return {
        name,
        level,
        totalViews,
        totalPhotos,
        totalReviews,
        totalRatings,
        photos,
        pageTextLength: text.length,
        debugTextPreview: debugText
      };
    });

    await browser.close();

    // Build output
    const output = {
      name: data.name || 'Local Guide',
      level: data.level,
      totalViews: data.totalViews,
      totalPhotos: data.totalPhotos,
      totalReviews: data.totalReviews,
      totalRatings: data.totalRatings,
      profileUrl: PROFILE_URL,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: !!(data.level || data.totalViews || data.totalPhotos || data.totalReviews)
    };

    console.log('\n[6/6] Results:');
    console.log('     Name:', output.name);
    console.log('     Level:', output.level);
    console.log('     Views:', output.totalViews?.toLocaleString() || 'N/A');
    console.log('     Photos:', output.totalPhotos?.toLocaleString() || 'N/A');
    console.log('     Reviews:', output.totalReviews?.toLocaleString() || 'N/A');
    console.log('     Ratings:', output.totalRatings?.toLocaleString() || 'N/A');
    console.log('     Photo URLs extracted:', output.photos.length);
    console.log('     Page text length:', data.pageTextLength);
    console.log('     Successfully scraped:', output.scrapedSuccessfully);

    if (!output.scrapedSuccessfully) {
      console.log('\n[DEBUG] Page text preview:');
      console.log(data.debugTextPreview);
    }

    // Save output
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log('\n=== SCRAPE COMPLETE ===');
    console.log('Output saved to:', OUTPUT_PATH);

    // Exit with error if we didn't get any data
    if (!output.scrapedSuccessfully) {
      console.error('\nWARNING: No profile data was extracted. The page may have changed structure.');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n=== SCRAPE FAILED ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    // Save error state
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
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

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

async function scrapeProfile() {
  console.log('=== GOOGLE MAPS PROFILE SCRAPER v3 ===');
  console.log('Profile ID:', PROFILE_ID);
  console.log('URL:', PROFILE_URL);
  console.log('Time:', new Date().toISOString());

  let browser;
  try {
    console.log('\n[1/7] Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--lang=en-US,en'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set English language preference
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    console.log('[2/7] Loading profile page...');
    const response = await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    console.log('     Status:', response.status());

    // Handle cookie consent - try multiple selectors
    console.log('[3/7] Handling consent dialogs...');
    const consentSelectors = [
      'button[aria-label*="Accept"]',
      'button[aria-label*="accept"]',
      '[aria-label*="Accept all"]',
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
      '[data-ved] button',
      'form[action*="consent"] button'
    ];

    for (const selector of consentSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          console.log('     Clicked consent button:', selector);
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    // Also try clicking by text content
    try {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const acceptBtn = buttons.find(b =>
          b.textContent?.toLowerCase().includes('accept') ||
          b.textContent?.toLowerCase().includes('agree')
        );
        if (acceptBtn) acceptBtn.click();
      });
    } catch (e) {
      // Ignore
    }

    console.log('[4/7] Waiting for content to load...');
    await new Promise(r => setTimeout(r, 5000));

    // Scroll to trigger lazy loading
    console.log('[5/7] Scrolling page...');
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 500));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 3000));

    console.log('[6/7] Extracting data...');
    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const html = document.body.innerHTML;

      // Debug: get page structure
      const debugInfo = {
        textLength: bodyText.length,
        hasLevel: bodyText.toLowerCase().includes('level'),
        hasViews: bodyText.toLowerCase().includes('view'),
        hasPhotos: bodyText.toLowerCase().includes('photo'),
        hasReviews: bodyText.toLowerCase().includes('review'),
        hasContributions: bodyText.toLowerCase().includes('contribution'),
        title: document.title,
        url: window.location.href
      };

      // Try to find the contributor name
      let name = null;
      // Look for the main heading
      const headings = document.querySelectorAll('h1, [role="heading"][aria-level="1"]');
      for (const h of headings) {
        const text = h.textContent?.trim();
        if (text && text.length > 1 && text.length < 100 && !text.match(/^\d/)) {
          name = text;
          break;
        }
      }

      // Extract level
      let level = null;
      const levelPatterns = [
        /Level\s*(\d+)/i,
        /(\d+)\s*Local Guide/i,
        /Local Guide.*?(\d+)/i
      ];
      for (const pattern of levelPatterns) {
        const match = bodyText.match(pattern);
        if (match && parseInt(match[1]) >= 1 && parseInt(match[1]) <= 10) {
          level = parseInt(match[1]);
          break;
        }
      }

      // Extract views - look for large numbers followed by "views"
      let totalViews = null;
      const viewPatterns = [
        /([\d,]+)\s*views/gi,
        /views[:\s]*([\d,]+)/gi,
        /([\d,]+)\s*photo views/gi
      ];
      for (const pattern of viewPatterns) {
        const matches = [...bodyText.matchAll(pattern)];
        for (const match of matches) {
          const num = parseInt(match[1].replace(/,/g, ''));
          if (num > 1000 && (totalViews === null || num > totalViews)) {
            totalViews = num;
          }
        }
      }

      // Extract photos count
      let totalPhotos = null;
      const photoPatterns = [
        /([\d,]+)\s*photos?(?!\s*view)/gi,
        /photos?[:\s]*([\d,]+)/gi
      ];
      for (const pattern of photoPatterns) {
        const matches = [...bodyText.matchAll(pattern)];
        for (const match of matches) {
          const num = parseInt(match[1].replace(/,/g, ''));
          if (num > 0 && num < 100000) {
            totalPhotos = num;
            break;
          }
        }
        if (totalPhotos) break;
      }

      // Extract reviews count
      let totalReviews = null;
      const reviewPatterns = [
        /([\d,]+)\s*reviews?/gi,
        /reviews?[:\s]*([\d,]+)/gi
      ];
      for (const pattern of reviewPatterns) {
        const matches = [...bodyText.matchAll(pattern)];
        for (const match of matches) {
          const num = parseInt(match[1].replace(/,/g, ''));
          if (num > 0 && num < 100000) {
            totalReviews = num;
            break;
          }
        }
        if (totalReviews) break;
      }

      // Get photos
      const photos = [];
      const images = document.querySelectorAll('img[src*="googleusercontent"], img[src*="lh3."], img[src*="lh4."], img[src*="lh5."]');
      for (const img of images) {
        const src = img.src;
        if (!src || src.includes('avatar') || src.includes('icon') || src.includes('=s32') || src.includes('=s64')) {
          continue;
        }
        const rect = img.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) continue;

        photos.push({
          id: `photo-${photos.length}`,
          url: src.replace(/=w\d+-h\d+/, '=w800-h600').replace(/=s\d+/, '=s800'),
          thumbnail: src
        });
        if (photos.length >= 50) break;
      }

      // Get a sample of the text for debugging
      const textSample = bodyText.substring(0, 1500).replace(/\s+/g, ' ');

      return {
        name,
        level,
        totalViews,
        totalPhotos,
        totalReviews,
        photos,
        debugInfo,
        textSample
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
      profileUrl: PROFILE_URL,
      photos: data.photos || [],
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: !!(data.level || data.totalViews || data.totalPhotos || data.totalReviews)
    };

    console.log('\n[7/7] Results:');
    console.log('     Name:', output.name);
    console.log('     Level:', output.level);
    console.log('     Views:', output.totalViews?.toLocaleString() || 'N/A');
    console.log('     Photos:', output.totalPhotos?.toLocaleString() || 'N/A');
    console.log('     Reviews:', output.totalReviews?.toLocaleString() || 'N/A');
    console.log('     Images found:', output.photos.length);
    console.log('     Success:', output.scrapedSuccessfully);

    console.log('\n[DEBUG] Page info:');
    console.log('     Title:', data.debugInfo.title);
    console.log('     URL:', data.debugInfo.url);
    console.log('     Text length:', data.debugInfo.textLength);
    console.log('     Has "level":', data.debugInfo.hasLevel);
    console.log('     Has "view":', data.debugInfo.hasViews);
    console.log('     Has "photo":', data.debugInfo.hasPhotos);
    console.log('     Has "review":', data.debugInfo.hasReviews);

    if (!output.scrapedSuccessfully) {
      console.log('\n[DEBUG] Text sample:');
      console.log(data.textSample);
    }

    // Save
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log('\nSaved to:', OUTPUT_PATH);

    if (!output.scrapedSuccessfully) {
      console.log('\n⚠️  WARNING: No data extracted. Check the debug output above.');
      process.exit(1);
    }

    console.log('\n✅ SCRAPE COMPLETE');

  } catch (err) {
    console.error('\n❌ SCRAPE FAILED');
    console.error('Error:', err.message);

    if (browser) {
      try { await browser.close(); } catch (e) {}
    }

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

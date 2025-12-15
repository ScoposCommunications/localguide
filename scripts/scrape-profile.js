import fs from 'fs';
import path from 'path';

const PROFILE_ID = '103557089728311501865';
const PROFILE_URL = `https://www.google.com/maps/contrib/${PROFILE_ID}`;
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/profile.json');

async function getBrowser() {
  const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isVercel) {
    console.log('Vercel environment - using @sparticuz/chromium with stealth...');
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteerExtra = (await import('puppeteer-extra')).default;
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;

    puppeteerExtra.use(StealthPlugin());

    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    return puppeteerExtra.launch({
      args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  // GitHub Actions / Local
  console.log('Standard environment - using puppeteer with stealth...');
  const puppeteerExtra = (await import('puppeteer-extra')).default;
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;

  puppeteerExtra.use(StealthPlugin());

  return puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
}

async function scrapeProfile() {
  console.log('=== SCRAPING GOOGLE MAPS PROFILE ===');
  console.log('Profile:', PROFILE_URL);
  console.log('Time:', new Date().toISOString());

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Randomize user agent
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

    console.log('Loading page...');
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle0', timeout: 90000 });

    // Random delay to appear human
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    console.log('Extracting data...');
    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      console.log('Page text length:', text.length);

      // Extract stats - try multiple patterns
      const levelMatch = text.match(/Level\s+(\d+)/i) || text.match(/Local Guide\s+·\s+Level\s+(\d+)/i);
      const viewsMatch = text.match(/([\d,]+)\s*views/i) || text.match(/Views[:\s]*([\d,]+)/i);
      const photosMatch = text.match(/([\d,]+)\s*photos/i) || text.match(/Photos[:\s]*([\d,]+)/i);
      const reviewsMatch = text.match(/([\d,]+)\s*reviews/i) || text.match(/Reviews[:\s]*([\d,]+)/i);

      // Get name from page title or profile
      const nameMatch = document.title.match(/(.+?)\s*[-–]\s*Google Maps/) ||
                        text.match(/^([A-Za-z\s]+)\nLocal Guide/m);

      // Get photo URLs
      const photos = [...document.querySelectorAll('img[src*="googleusercontent"]')]
        .filter(img => {
          const dominated = img.src.includes('avatar') || img.src.includes('profile');
          return !dominated && img.naturalWidth > 100;
        })
        .slice(0, 50)
        .map((img, i) => ({
          id: `photo-${i}`,
          url: img.src.replace(/=w\d+-h\d+.*/, '=w1200-h900'),
          thumbnail: img.src.replace(/=w\d+-h\d+.*/, '=w400-h300')
        }));

      return {
        name: nameMatch ? nameMatch[1].trim() : null,
        level: levelMatch ? levelMatch[1] : null,
        totalViews: viewsMatch ? viewsMatch[1].replace(/,/g, '') : null,
        totalPhotos: photosMatch ? photosMatch[1].replace(/,/g, '') : null,
        totalReviews: reviewsMatch ? reviewsMatch[1].replace(/,/g, '') : null,
        photos,
        pageTextSample: text.substring(0, 500)
      };
    });

    await browser.close();

    console.log('Extracted:', JSON.stringify({ ...data, pageTextSample: '[truncated]' }, null, 2));

    const hasData = data.level || data.totalViews || data.totalPhotos || data.photos.length > 0;

    const output = {
      name: data.name || 'Local Guide',
      level: data.level ? parseInt(data.level) : null,
      totalViews: data.totalViews ? parseInt(data.totalViews) : null,
      totalPhotos: data.totalPhotos ? parseInt(data.totalPhotos) : null,
      totalReviews: data.totalReviews ? parseInt(data.totalReviews) : null,
      profileUrl: PROFILE_URL,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: hasData
    };

    if (!hasData) {
      console.log('WARNING: No data extracted. Page may have blocked scraping.');
      console.log('Page text sample:', data.pageTextSample);
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log('=== SCRAPE COMPLETE ===');
    console.log('Success:', hasData);

  } catch (err) {
    console.error('SCRAPE FAILED:', err.message);
    if (browser) await browser.close();

    // Check if we have existing good data - don't overwrite it
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      if (existing.scrapedSuccessfully) {
        console.log('Keeping existing scraped data (scrape failed but have previous data)');
        process.exit(0); // Don't fail build, keep existing data
      }
    } catch (e) {
      // No existing data
    }

    // Only write failure if no good data exists
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

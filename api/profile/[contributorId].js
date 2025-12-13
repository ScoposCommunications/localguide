import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  const { contributorId } = req.query;

  if (!contributorId) {
    return res.status(400).json({
      success: false,
      error: 'Missing contributorId parameter'
    });
  }

  const profileUrl = `https://www.google.com/maps/contrib/${contributorId}`;
  let browser = null;

  try {
    console.log('[1] Starting chromium executable path fetch...');

    const executablePath = await chromium.executablePath(
      'https://github.com/nicenoise/chromium/releases/download/v127.0.1/chromium-v127.0.1-pack.tar'
    );

    console.log('[2] Got executable path:', executablePath);
    console.log('[3] Launching browser...');

    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 },
      executablePath,
      headless: 'new',
    });

    console.log('[4] Browser launched, creating page...');
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('[5] Navigating to:', profileUrl);

    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    console.log('[6] Page loaded, waiting for content...');
    await new Promise(r => setTimeout(r, 4000));

    console.log('[7] Extracting data...');
    const profileData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const data = {
        name: 'Local Guide',
        level: null,
        totalViews: null,
        totalPhotos: null,
        totalReviews: null,
        photos: [],
      };

      // Level
      const levelMatch = bodyText.match(/Level\s+(\d+)/i);
      if (levelMatch) data.level = parseInt(levelMatch[1], 10);

      // Views
      const viewMatch = bodyText.match(/([\d,]+)\s*views/i) ||
                        bodyText.match(/viewed\s+([\d,]+)/i);
      if (viewMatch) {
        data.totalViews = parseInt(viewMatch[1].replace(/,/g, ''), 10);
      }

      // Photos
      const photoMatch = bodyText.match(/([\d,]+)\s*photos?/i);
      if (photoMatch) {
        data.totalPhotos = parseInt(photoMatch[1].replace(/,/g, ''), 10);
      }

      // Reviews
      const reviewMatch = bodyText.match(/([\d,]+)\s*reviews?/i);
      if (reviewMatch) {
        data.totalReviews = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
      }

      // Photos from images
      const images = document.querySelectorAll('img[src*="googleusercontent"]');
      images.forEach((img, i) => {
        if (i < 24 && img.src && !img.src.includes('avatar')) {
          data.photos.push({
            id: `photo-${i}`,
            url: img.src.replace(/=w\d+-h\d+/, '=w600-h400'),
            thumbnail: img.src,
          });
        }
      });

      return data;
    });

    console.log('[8] Data extracted, closing browser...');
    await browser.close();
    browser = null;

    console.log('[9] Sending response');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.json({
      success: true,
      profileUrl,
      contributorId,
      ...profileData,
      extractedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[ERROR]', error.message);

    if (browser) {
      try { await browser.close(); } catch {}
    }

    return res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error.message,
      profileUrl,
    });
  }
}

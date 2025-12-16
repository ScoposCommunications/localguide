import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid contributor ID' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const profileUrl = `https://www.google.com/maps/contrib/${id}`;

    const response = await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    console.log('Page loaded, status:', response.status());

    // Handle consent dialogs
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const acceptBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('accept') ||
        b.textContent?.toLowerCase().includes('agree')
      );
      if (acceptBtn) acceptBtn.click();
    });

    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load content
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 300));
      }
      window.scrollTo(0, 0);
    });

    await new Promise(r => setTimeout(r, 2000));

    // Extract data
    const data = await page.evaluate(() => {
      const text = document.body.innerText;

      let name = null;
      const h1 = document.querySelector('h1');
      if (h1) name = h1.textContent?.trim();

      let level = null;
      const levelMatch = text.match(/Level\s*(\d+)/i);
      if (levelMatch) level = parseInt(levelMatch[1]);

      let totalViews = null;
      const viewMatches = [...text.matchAll(/([\d,]+)\s*views/gi)];
      for (const m of viewMatches) {
        const num = parseInt(m[1].replace(/,/g, ''));
        if (num > 1000 && (!totalViews || num > totalViews)) totalViews = num;
      }

      let totalPhotos = null;
      const photoMatch = text.match(/([\d,]+)\s*photos?(?!\s*view)/i);
      if (photoMatch) totalPhotos = parseInt(photoMatch[1].replace(/,/g, ''));

      let totalReviews = null;
      const reviewMatch = text.match(/([\d,]+)\s*reviews?/i);
      if (reviewMatch) totalReviews = parseInt(reviewMatch[1].replace(/,/g, ''));

      const photos = [];
      const images = document.querySelectorAll('img[src*="googleusercontent"], img[src*="lh3."]');
      for (const img of images) {
        const src = img.src;
        if (!src || src.includes('avatar') || src.includes('=s32')) continue;
        photos.push({
          id: `photo-${photos.length}`,
          url: src.replace(/=w\d+-h\d+/, '=w800-h600'),
          thumbnail: src
        });
        if (photos.length >= 30) break;
      }

      return {
        name,
        level,
        totalViews,
        totalPhotos,
        totalReviews,
        photos,
        textLength: text.length,
        textSample: text.substring(0, 300)
      };
    });

    await browser.close();

    console.log('Extracted:', JSON.stringify({
      name: data.name,
      level: data.level,
      views: data.totalViews,
      photos: data.totalPhotos,
      reviews: data.totalReviews,
      textLength: data.textLength
    }));

    const result = {
      name: data.name || 'Local Guide',
      level: data.level,
      totalViews: data.totalViews,
      totalPhotos: data.totalPhotos,
      totalReviews: data.totalReviews,
      profileUrl,
      photos: data.photos,
      lastUpdated: new Date().toISOString(),
      scrapedSuccessfully: !!(data.level || data.totalViews || data.totalPhotos),
      debug: {
        textLength: data.textLength,
        textSample: data.textSample
      }
    };

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.json(result);

  } catch (error) {
    console.error('Scrape error:', error);
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }

    return res.status(500).json({
      error: 'Failed to scrape profile',
      message: error.message,
      scrapedSuccessfully: false
    });
  }
}

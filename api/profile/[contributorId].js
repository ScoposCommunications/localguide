import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

export default async function handler(req, res) {
  const { contributorId } = req.query;

  if (!contributorId) {
    return res.status(400).json({ error: 'Missing contributorId parameter' });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(
        'https://github.com/nicenoise/chromium/releases/download/v127.0.1/chromium-v127.0.1-pack.tar'
      ),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const profileUrl = `https://www.google.com/maps/contrib/${contributorId}`;

    console.log(`Navigating to: ${profileUrl}`);

    await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    // Wait for page content to load
    await page.waitForFunction(() => document.body.innerText.length > 100, { timeout: 30000 });

    // Give extra time for dynamic content
    await new Promise(r => setTimeout(r, 3000));

    // Extract data from the page
    const profileData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const data = {
        name: 'Local Guide',
        level: null,
        totalViews: null,
        totalPhotos: null,
        totalReviews: null,
        totalRatings: null,
        totalEdits: null,
        photos: [],
        rawText: bodyText.substring(0, 2000), // For debugging
      };

      // Extract level - look for "Level X Local Guide" pattern
      const levelMatch = bodyText.match(/Level\s+(\d+)\s+Local Guide/i);
      if (levelMatch) {
        data.level = parseInt(levelMatch[1], 10);
      }

      // Extract total views - various patterns
      const viewPatterns = [
        /Photos have been viewed\s+([\d,]+)\s+times/i,
        /Viewed\s+([\d,]+)\s+times/i,
        /([\d,]+)\s+views/i,
        /([\d,.]+[KMB]?)\s+views/i,
      ];

      for (const pattern of viewPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          let viewStr = match[1].replace(/,/g, '');
          // Handle K, M, B suffixes
          if (viewStr.endsWith('K')) {
            data.totalViews = parseFloat(viewStr) * 1000;
          } else if (viewStr.endsWith('M')) {
            data.totalViews = parseFloat(viewStr) * 1000000;
          } else if (viewStr.endsWith('B')) {
            data.totalViews = parseFloat(viewStr) * 1000000000;
          } else {
            data.totalViews = parseInt(viewStr, 10);
          }
          break;
        }
      }

      // Extract photo count
      const photoPatterns = [
        /([\d,]+)\s+photos?/i,
        /Photos\s*\(?([\d,]+)\)?/i,
      ];

      for (const pattern of photoPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.totalPhotos = parseInt(match[1].replace(/,/g, ''), 10);
          break;
        }
      }

      // Extract review count
      const reviewPatterns = [
        /([\d,]+)\s+reviews?/i,
        /Reviews\s*\(?([\d,]+)\)?/i,
      ];

      for (const pattern of reviewPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.totalReviews = parseInt(match[1].replace(/,/g, ''), 10);
          break;
        }
      }

      // Extract ratings count
      const ratingMatch = bodyText.match(/([\d,]+)\s+ratings?/i);
      if (ratingMatch) {
        data.totalRatings = parseInt(ratingMatch[1].replace(/,/g, ''), 10);
      }

      // Extract edits/updates count
      const editPatterns = [
        /([\d,]+)\s+edits?/i,
        /([\d,]+)\s+updates?/i,
        /([\d,]+)\s+facts?/i,
      ];

      for (const pattern of editPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          data.totalEdits = parseInt(match[1].replace(/,/g, ''), 10);
          break;
        }
      }

      // Try to get the name from the page title or header
      const titleMatch = document.title.match(/(.+?)(?:\s*-\s*Google Maps|$)/);
      if (titleMatch && titleMatch[1] && !titleMatch[1].includes('Google')) {
        data.name = titleMatch[1].trim();
      }

      // Try to extract photo thumbnails
      const photoElements = document.querySelectorAll('img[src*="googleusercontent.com"]');
      photoElements.forEach((img, index) => {
        if (index < 50 && img.src && !img.src.includes('avatar') && !img.src.includes('profile')) {
          data.photos.push({
            id: `photo-${index}`,
            url: img.src.replace(/=w\d+-h\d+/, '=w800-h600'),
            thumbnail: img.src,
          });
        }
      });

      return data;
    });

    await browser.close();

    // Validate we got real data
    if (!profileData.totalViews && !profileData.totalPhotos && !profileData.level) {
      return res.status(500).json({
        error: 'Failed to extract profile data',
        message: 'Could not parse any statistics from the profile page',
        debug: {
          url: profileUrl,
          rawTextSample: profileData.rawText,
        }
      });
    }

    // Cache for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.json({
      success: true,
      profileUrl,
      contributorId,
      ...profileData,
      extractedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Scraping error:', error);

    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      error: 'Failed to scrape profile',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

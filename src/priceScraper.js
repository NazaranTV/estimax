const axios = require('axios');
const cheerio = require('cheerio');

const SCRAPINGFISH_API_KEY = process.env.SCRAPINGFISH_API_KEY;
const SCRAPINGFISH_API_URL = 'https://scraping.narf.ai/api/v1/';

/**
 * Scrape a URL using ScrapingFish API
 */
async function scrapeWithScrapingFish(url) {
  try {
    const scrapingFishUrl = `${SCRAPINGFISH_API_URL}?api_key=${SCRAPINGFISH_API_KEY}&url=${encodeURIComponent(url)}`;

    console.log(`🐟 ScrapingFish fetching: ${url}`);

    const response = await axios.get(scrapingFishUrl, {
      timeout: 30000 // 30 second timeout
    });

    return response.data;
  } catch (error) {
    console.error('ScrapingFish error:', error.message);
    throw error;
  }
}

/**
 * Scrape Google Shopping for product info from multiple retailers
 */
async function scrapeGoogleShopping(materialName) {
  try {
    // Add gl=us (geolocation US) and hl=en (language English) to get USD prices
    const searchUrl = `https://www.google.com/search?tbm=shop&gl=us&hl=en&q=${encodeURIComponent(materialName)}`;
    const html = await scrapeWithScrapingFish(searchUrl);

    const $ = cheerio.load(html);
    const products = [];

    console.log(`HTML length: ${html.length} characters`);

    // Strategy: Find product containers using common Google Shopping patterns
    const productCards = $('[role="listitem"], .sh-dgr__content, [data-docid], [data-product-id]');
    console.log(`Found ${productCards.length} potential product containers`);

    productCards.each((i, card) => {
      if (products.length >= 15) return;

      const $card = $(card);
      const cardText = $card.text();

      // Look for price within this card
      const priceMatch = cardText.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);

      if (priceMatch) {
        const price = parsePrice(priceMatch[1]);

        if (price > 0.50 && price < 100000) {
          // Look for product title - try multiple selectors
          let name = '';
          const title = $card.find('h3, h4, [role="heading"], a[aria-label]').first();

          if (title.length) {
            name = title.text().trim() || title.attr('aria-label') || '';
          }

          // Fallback: look for any anchor with title attribute
          if (!name) {
            const link = $card.find('a[title]').first();
            if (link.length) {
              name = link.attr('title');
            }
          }

          // Get merchant from card
          let source = 'Unknown';
          const cardHtml = $card.html().toLowerCase();
          if (cardHtml.includes('home depot') || cardHtml.includes('homedepot')) source = 'Home Depot';
          else if (cardHtml.includes('lowes') || cardHtml.includes('lowe')) source = 'Lowes';
          else if (cardHtml.includes('amazon')) source = 'Amazon';
          else if (cardHtml.includes('walmart')) source = 'Walmart';

          // Only add if we found a reasonable product name
          if (name && name.length > 10 && name.length < 300) {
            // Skip if name looks like a UI element or filter
            const skipTerms = ['accessibility', 'refine', 'filter', 'nearby', 'menu', 'navigation', 'results', 'under $', 'over $', 'sort by', 'price range', 'select'];
            const nameLower = name.toLowerCase();
            const isUIElement = skipTerms.some(term => nameLower.includes(term));

            // Also skip very short names or names that are just prices
            const hasLetters = /[a-zA-Z]{3,}/.test(name);

            if (!isUIElement && hasLetters && !products.some(p => p.price === price && p.name === name)) {
              products.push({
                name: name.substring(0, 200),
                price: price,
                description: name,
                source: source
              });
            }
          }
        }
      }
    });

    console.log(`Found ${products.length} products from Google Shopping`);

    // Log some sample data for debugging
    if (products.length > 0) {
      console.log(`Sample products:`, products.slice(0, 3).map(p => ({ name: p.name.substring(0, 40), price: p.price, source: p.source })));
    } else {
      // Debug: Save HTML to file if no products found
      const fs = require('fs');
      const debugPath = './debug-google-shopping.html';
      fs.writeFileSync(debugPath, html);
      console.log(`⚠️ No products found. HTML saved to ${debugPath} for debugging`);
    }

    return products;
  } catch (error) {
    console.error('Google Shopping scrape error:', error.message);
    return [];
  }
}

/**
 * Parse price from text (handles formats like "?2.99", "12.99", "?,234.56")
 */
function parsePrice(text) {
  if (!text) return 0;

  // Remove everything except digits, decimal point, and comma
  const cleaned = text.replace(/[^0-9.,]/g, '');

  // Remove commas (for numbers like 1,234.56)
  const withoutCommas = cleaned.replace(/,/g, '');

  // Parse to float
  const price = parseFloat(withoutCommas);

  return isNaN(price) ? 0 : price;
}

/**
 * Calculate average price excluding outliers
 */
function calculateAveragePrice(prices) {
  if (prices.length === 0) return 0;
  if (prices.length === 1) return prices[0];

  // Sort prices
  const sorted = [...prices].sort((a, b) => a - b);

  // Remove outliers (lowest 20% and highest 20%)
  const removeCount = Math.floor(sorted.length * 0.2);
  const filtered = sorted.slice(removeCount, sorted.length - removeCount);

  // If we filtered everything out, use all prices
  const finalPrices = filtered.length > 0 ? filtered : sorted;

  // Calculate average
  const sum = finalPrices.reduce((acc, price) => acc + price, 0);
  const average = sum / finalPrices.length;

  return Math.round(average * 100) / 100; // Round to 2 decimal places
}

/**
 * Main function to get material data (price, description, etc.)
 */
async function getMaterialData(materialName) {
  console.log(`\n========================================`);
  console.log(`Searching for: "${materialName}"`);
  console.log(`========================================`);

  try {
    // Scrape Google Shopping (single API call gets prices from ALL retailers)
    const products = await scrapeGoogleShopping(materialName);

    if (products.length === 0) {
      console.log(`⚠️ No products found for: ${materialName}`);
      return {
        name: materialName,
        price: 0,
        description: '',
        found: false
      };
    }

    console.log(`Found ${products.length} products from Google Shopping`);

    // Extract prices for averaging
    const prices = products.map(p => p.price);
    const averagePrice = calculateAveragePrice(prices);

    // Use the first product's name and description (usually most relevant)
    const bestProduct = products[0];
    const description = bestProduct.description || bestProduct.name || materialName;

    // Get unique sources for logging
    const sources = [...new Set(products.map(p => p.source))].join(', ');

    console.log(`✓ Average price: $${averagePrice} (from ${products.length} listings)`);
    console.log(`✓ Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`);
    console.log(`✓ Sources: ${sources}`);
    console.log(`✓ Description: ${description.substring(0, 80)}...`);

    return {
      name: materialName,
      price: averagePrice,
      description: description,
      found: true,
      products: products.length,
      sources: sources
    };
  } catch (error) {
    console.error(`❌ Error getting data for ${materialName}:`, error.message);
    return {
      name: materialName,
      price: 0,
      description: '',
      found: false,
      error: error.message
    };
  }
}

module.exports = {
  getMaterialData,
  scrapeGoogleShopping,
  calculateAveragePrice
};

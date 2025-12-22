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
 * Scrape Home Depot search for products
 */
async function scrapeHomeDepot(searchTerm) {
  try {
    const searchUrl = `https://www.homedepot.com/s/${encodeURIComponent(searchTerm)}`;
    const html = await scrapeWithScrapingFish(searchUrl);

    const $ = cheerio.load(html);
    const products = [];

    // Debug: save HTML for inspection
    const fs = require('fs');
    fs.writeFileSync('./debug-homedepot.html', html);
    console.log('HTML saved to debug-homedepot.html');

    // Home Depot uses product pods/cards with specific classes
    $('.product-pod, [data-pod-type="product"]').each((i, elem) => {
      if (products.length >= 10) return;

      const $elem = $(elem);

      // Try to find product title
      const title = $elem.find('.product-header__title, [data-testid="product-header__title"], h3, .product__title').first().text().trim();

      // Try to find price
      const priceText = $elem.find('[data-testid="product-price"], .price, .product-price').first().text().trim();
      const priceMatch = priceText.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);

      if (title && priceMatch) {
        const price = parsePrice(priceMatch[1]);
        if (price > 0 && price < 100000) {
          products.push({
            name: title,
            price: price,
            description: title,
            source: 'Home Depot'
          });
        }
      }
    });

    console.log(`Found ${products.length} products from Home Depot`);
    return products;
  } catch (error) {
    console.error('Home Depot scrape error:', error.message);
    return [];
  }
}

/**
 * Scrape Lowes search for products
 */
async function scrapeLowes(searchTerm) {
  try {
    const searchUrl = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(searchTerm)}`;
    const html = await scrapeWithScrapingFish(searchUrl);

    const $ = cheerio.load(html);
    const products = [];

    // Lowes uses grid items for products
    $('[data-selector="product-card"], .product-card, [data-itemtype="http://schema.org/Product"]').each((i, elem) => {
      if (products.length >= 10) return;

      const $elem = $(elem);

      // Try to find product title
      const title = $elem.find('[itemprop="name"], .product-title, [data-selector="product-title"]').first().text().trim();

      // Try to find price
      const priceText = $elem.find('[itemprop="price"], .product-price, [data-selector="product-price"]').first().text().trim();
      const priceMatch = priceText.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);

      if (title && priceMatch) {
        const price = parsePrice(priceMatch[1]);
        if (price > 0 && price < 100000) {
          products.push({
            name: title,
            price: price,
            description: title,
            source: 'Lowes'
          });
        }
      }
    });

    console.log(`Found ${products.length} products from Lowes`);
    return products;
  } catch (error) {
    console.error('Lowes scrape error:', error.message);
    return [];
  }
}

/**
 * Parse price from text
 */
function parsePrice(text) {
  if (!text) return 0;

  const cleaned = text.replace(/[^0-9.,]/g, '');
  const withoutCommas = cleaned.replace(/,/g, '');
  const price = parseFloat(withoutCommas);

  return isNaN(price) ? 0 : price;
}

/**
 * Calculate average price excluding outliers
 */
function calculateAveragePrice(prices) {
  if (prices.length === 0) return 0;
  if (prices.length === 1) return prices[0];

  const sorted = [...prices].sort((a, b) => a - b);

  // Remove outliers (lowest 20% and highest 20%)
  const removeCount = Math.floor(sorted.length * 0.2);
  const filtered = sorted.slice(removeCount, sorted.length - removeCount);

  const finalPrices = filtered.length > 0 ? filtered : sorted;

  const sum = finalPrices.reduce((acc, price) => acc + price, 0);
  const average = sum / finalPrices.length;

  return Math.round(average * 100) / 100;
}

/**
 * Main function to get material data (price, description, etc.)
 */
async function getMaterialData(materialName) {
  console.log(`\n========================================`);
  console.log(`Searching for: "${materialName}"`);
  console.log(`========================================`);

  try {
    // Scrape Home Depot only
    const allProducts = await scrapeHomeDepot(materialName);

    if (allProducts.length === 0) {
      console.log(`⚠️ No products found for: ${materialName}`);
      return {
        name: materialName,
        price: 0,
        description: '',
        found: false
      };
    }

    console.log(`Found ${allProducts.length} total products from Home Depot`);

    // Extract prices for averaging
    const prices = allProducts.map(p => p.price);
    const averagePrice = calculateAveragePrice(prices);

    // Use the first product's name and description
    const bestProduct = allProducts[0];
    const description = bestProduct.description || bestProduct.name || materialName;

    // Get unique sources
    const sources = 'Home Depot';

    console.log(`✓ Average price: $${averagePrice} (from ${allProducts.length} listings)`);
    console.log(`✓ Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`);
    console.log(`✓ Sources: ${sources}`);
    console.log(`✓ Description: ${description.substring(0, 80)}...`);

    return {
      name: materialName,
      price: averagePrice,
      description: description,
      found: true,
      products: allProducts.length,
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
  calculateAveragePrice
};

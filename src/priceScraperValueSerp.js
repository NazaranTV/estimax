const axios = require('axios');

const VALUESERP_API_KEY = process.env.VALUESERP_API_KEY;
const VALUESERP_API_URL = 'https://api.valueserp.com/search';

/**
 * Fetch Google Shopping results using ValueSerp API
 */
async function getShoppingResults(searchQuery) {
  try {
    console.log(`🔍 ValueSerp searching for: ${searchQuery}`);

    const response = await axios.get(VALUESERP_API_URL, {
      params: {
        api_key: VALUESERP_API_KEY,
        q: searchQuery,
        location: 'United States',
        google_domain: 'google.com',
        gl: 'us',
        hl: 'en',
        tbm: 'shop', // Google Shopping
        num: 20 // Get up to 20 results
      },
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    console.error('ValueSerp API error:', error.message);
    throw error;
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
    // Get shopping results from ValueSerp
    const data = await getShoppingResults(materialName);

    // Extract shopping data from organic_results with rich snippets
    const organicResults = data.organic_results || [];

    if (organicResults.length === 0) {
      console.log(`⚠️ No products found for: ${materialName}`);
      return {
        name: materialName,
        price: 0,
        description: '',
        found: false
      };
    }

    console.log(`Found ${organicResults.length} product listings from Google Shopping`);

    // Extract product data from organic results
    const allProducts = organicResults.map(result => {
      // Try to get price from rich snippet
      let price = 0;
      if (result.rich_snippet && result.rich_snippet.top && result.rich_snippet.top.detected_extensions) {
        price = result.rich_snippet.top.detected_extensions.price || 0;
      }

      // Extract domain name as source
      const source = result.domain || 'Unknown';

      return {
        name: result.title || '',
        price: price,
        description: result.snippet || result.title || '',
        source: source
      };
    })
    .filter(p => p.price > 0 && p.price < 100000); // Filter out invalid prices

    // Prefer Home Depot and Lowes results
    let products = allProducts.filter(p => {
      const domain = p.source.toLowerCase();
      return domain.includes('homedepot') || domain.includes('lowes');
    });

    // Fallback: If no HD/Lowes results, use all available results
    if (products.length === 0) {
      console.log('⚠️ No Home Depot/Lowes results found, using all available retailers');
      products = allProducts;
    } else {
      console.log(`✓ Using ${products.length} results from Home Depot/Lowes only`);
    }

    if (products.length === 0) {
      console.log(`⚠️ No valid prices found for: ${materialName}`);
      return {
        name: materialName,
        price: 0,
        description: '',
        found: false
      };
    }

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

    // Log sample products for debugging
    if (products.length > 0) {
      console.log(`Sample products:`, products.slice(0, 3).map(p => ({
        name: p.name.substring(0, 40),
        price: p.price,
        source: p.source
      })));
    }

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
  calculateAveragePrice
};

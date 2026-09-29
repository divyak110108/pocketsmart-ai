// Checked in this order; the first category whose keyword appears in the text wins.
PS.KEYWORDS = {
  travel: ['travel', 'transport', 'commute', 'uber', 'ola', 'rapido', 'bus', 'train', 'metro', 'auto',
    'petrol', 'diesel', 'fuel', 'taxi', 'cab', 'flight', 'irctc', 'redbus', 'parking', 'toll', 'ride', 'trip'],
  bills: ['bill', 'rent', 'eb', 'electricity', 'water', 'gas', 'cylinder', 'recharge', 'mobile', 'internet',
    'broadband', 'wifi', 'dth', 'emi', 'maintenance', 'airtel', 'jio', 'bsnl', 'insurance'],
  health: ['health', 'medical', 'hospital', 'doctor', 'medicine', 'pharmacy', 'clinic', 'apollo', 'gym',
    'lab', 'checkup', 'dental'],
  entertainment: ['entertainment', 'fun', 'movie', 'netflix', 'prime', 'hotstar', 'spotify', 'cinema',
    'theatre', 'game', 'outing', 'concert', 'youtube', 'subscription', 'party'],
  shopping: ['shopping', 'shop', 'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'clothes', 'dress',
    'shoe', 'mall', 'gift', 'electronics', 'accessories', 'gadget'],
  food: ['food', 'eating', 'swiggy', 'zomato', 'restaurant', 'hotel', 'lunch', 'dinner', 'breakfast', 'tea',
    'coffee', 'snack', 'grocery', 'groceries', 'vegetable', 'milk', 'bakery', 'biryani', 'canteen', 'mess',
    'pizza', 'juice', 'fruit'],
  others: ['other', 'misc', 'miscellaneous', 'donation', 'stationery', 'charity']
};

PS.KEYWORD_PATTERNS = Object.keys(PS.KEYWORDS).map((id) => ({
  id,
  re: new RegExp('\\b(' + PS.KEYWORDS[id].join('|') + ')s?\\b', 'i')
}));

// A brand name is a stronger signal than a generic word.
PS.BRANDS = ['swiggy', 'zomato', 'uber', 'ola', 'rapido', 'irctc', 'redbus', 'amazon', 'flipkart', 'myntra',
  'meesho', 'ajio', 'netflix', 'prime', 'hotstar', 'spotify', 'youtube', 'airtel', 'jio', 'bsnl', 'apollo', 'eb'];

PS.CONFIDENCE = { brand: 95, keyword: 80, none: 40 };

PS.classify = function (text) {
  for (const p of PS.KEYWORD_PATTERNS) {
    const match = (text || '').match(p.re);
    if (match) {
      const keyword = match[1].toLowerCase();
      return {
        id: p.id,
        keyword,
        confidence: PS.BRANDS.includes(keyword) ? PS.CONFIDENCE.brand : PS.CONFIDENCE.keyword
      };
    }
  }
  return { id: 'others', keyword: null, confidence: PS.CONFIDENCE.none };
};

PS.detectCategory = function (text) {
  const c = PS.classify(text);
  return c.keyword ? c.id : null;
};

PS.categorize = function (text) {
  return PS.classify(text).id;
};

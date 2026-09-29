// Demo data: ₹30,000 monthly income, 5 previous months plus the current month (₹24,000 when complete).
PS.sampleData = function () {
  const U = PS.util;
  const cur = U.currentMonthKey();
  const today = new Date().getDate();

  // [day of month, description, share of the category's monthly total]
  const ITEMS = {
    bills: [[1, 'House rent', 0.7], [5, 'EB electricity bill', 0.14], [8, 'Airtel broadband & mobile recharge', 0.1], [14, 'Gas cylinder', 0.06]],
    food: [[2, 'Groceries - Reliance Fresh', 0.24], [6, 'Swiggy dinner', 0.14], [10, 'Office canteen', 0.18], [15, 'Vegetables & milk', 0.16], [20, 'Zomato biryani', 0.12], [25, 'Restaurant with family', 0.16]],
    travel: [[3, 'Petrol', 0.22], [9, 'Uber to office', 0.15], [13, 'Metro card recharge', 0.15], [18, 'Rapido rides', 0.13], [22, 'Bus to Madurai', 0.15], [27, 'Petrol', 0.2]],
    shopping: [[7, 'Amazon order', 0.4], [17, 'Clothes - T Nagar', 0.45], [24, 'Flipkart accessories', 0.15]],
    health: [[11, 'Pharmacy medicines', 0.6], [21, 'Gym membership', 0.4]],
    entertainment: [[4, 'Spotify premium', 0.1], [12, 'Netflix subscription', 0.2], [19, 'Movie tickets', 0.45], [26, 'Weekend outing', 0.25]],
    others: [[16, 'Temple donation', 0.6], [23, 'Stationery', 0.4]]
  };

  // Current month shopping includes one unusually large purchase for the unusual-spend alert.
  const CURRENT_OVERRIDES = {
    shopping: [[7, 'Amazon - Bluetooth headphones', 2499], [17, 'Clothes - T Nagar', 520], [24, 'Flipkart accessories', 281]]
  };

  // Index 0 = current month, 1 = last month, ...
  const MONTHS = [
    { bills: 8500, food: 5200, travel: 4500, shopping: 3300, health: 900, entertainment: 1100, others: 500 },
    { bills: 8400, food: 4900, travel: 3800, shopping: 2900, health: 1200, entertainment: 1000, others: 600 },
    { bills: 8300, food: 4700, travel: 3500, shopping: 2600, health: 700, entertainment: 1300, others: 400 },
    { bills: 8300, food: 4600, travel: 3200, shopping: 2400, health: 800, entertainment: 900, others: 500 },
    { bills: 8200, food: 4500, travel: 3100, shopping: 2300, health: 600, entertainment: 1000, others: 400 },
    { bills: 8200, food: 4400, travel: 3000, shopping: 2200, health: 900, entertainment: 800, others: 500 }
  ];

  const transactions = [];
  function add(key, day, description, amount, category) {
    transactions.push({ id: U.uid(), date: key + '-' + String(day).padStart(2, '0'), description, amount, category });
  }

  MONTHS.forEach((totals, back) => {
    const key = U.addMonths(cur, -back);
    Object.keys(ITEMS).forEach((cat) => {
      if (back === 0 && CURRENT_OVERRIDES[cat]) {
        CURRENT_OVERRIDES[cat].forEach(([day, description, amount]) => {
          if (day <= today) add(key, day, description, amount, cat);
        });
        return;
      }
      const items = ITEMS[cat];
      let left = totals[cat];
      items.forEach(([day, description, share], i) => {
        const amount = i === items.length - 1 ? left : Math.round((totals[cat] * share) / 10) * 10;
        left -= amount;
        if (back === 0 && day > today) return;
        add(key, day, description, amount, cat);
      });
    });
  });

  return {
    settings: PS.defaultSettings(),
    transactions,
    goals: [
      { id: U.uid(), name: 'Emergency fund', target: 50000, saved: 18000, deadline: U.addMonths(cur, 8) },
      { id: U.uid(), name: 'New laptop', target: 60000, saved: 12000, deadline: U.addMonths(cur, 6) }
    ]
  };
};

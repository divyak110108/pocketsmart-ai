PS.CATEGORIES = [
  { id: 'bills', name: 'Rent & Bills', color: '#6366F1', pct: 30, fixed: true },
  { id: 'food', name: 'Food', color: '#F59E0B', pct: 15 },
  { id: 'travel', name: 'Travel', color: '#0EA5E9', pct: 10 },
  { id: 'shopping', name: 'Shopping', color: '#EC4899', pct: 10 },
  { id: 'health', name: 'Health', color: '#10B981', pct: 5 },
  { id: 'entertainment', name: 'Entertainment', color: '#8B5CF6', pct: 5 },
  { id: 'others', name: 'Others', color: '#94A3B8', pct: 5 }
];

PS.SAVINGS = { id: 'savings', name: 'Savings', color: '#22C55E', pct: 20 };

PS.category = function (id) {
  return PS.CATEGORIES.find((c) => c.id === id) || PS.CATEGORIES[PS.CATEGORIES.length - 1];
};

PS.defaultPercents = function () {
  const out = {};
  PS.CATEGORIES.concat(PS.SAVINGS).forEach((c) => { out[c.id] = c.pct; });
  return out;
};

PS.defaultSettings = function () {
  return { income: 30000, percents: PS.defaultPercents() };
};

PS.emptyState = function () {
  return { settings: PS.defaultSettings(), transactions: [], goals: [] };
};

PS.store = {
  KEY: 'pocketsmart-ai-v2',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const base = PS.emptyState();
      return {
        settings: {
          income: Number(data.settings && data.settings.income) || 0,
          percents: Object.assign(base.settings.percents, data.settings && data.settings.percents)
        },
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        goals: Array.isArray(data.goals) ? data.goals : []
      };
    } catch (e) {
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('PocketSmart AI: could not save data', e);
    }
  }
};

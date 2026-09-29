PS.prediction = {
  // Most recent month first.
  WEIGHTS: [0.5, 0.3, 0.2],

  progress(monthKey) {
    const U = PS.util;
    const dim = U.daysInMonth(monthKey);
    const isCurrent = monthKey === U.currentMonthKey();
    return { isCurrent, daysElapsed: isCurrent ? new Date().getDate() : dim, daysInMonth: dim };
  },

  // Month-end estimate per category.
  // Fixed bills: the larger of spent so far and last month's bills.
  // Variable categories: spent so far + (share of month remaining) x last month's amount,
  // or the current daily pace when there is no data for last month.
  monthEnd(state, monthKey) {
    const U = PS.util;
    const p = this.progress(monthKey);
    const spent = PS.budget.spent(state.transactions, monthKey);
    const byCategory = {};

    if (!p.isCurrent) {
      Object.assign(byCategory, spent);
    } else {
      const prev = PS.budget.spent(state.transactions, U.addMonths(monthKey, -1));
      const remaining = (p.daysInMonth - p.daysElapsed) / p.daysInMonth;
      PS.CATEGORIES.forEach((c) => {
        const s = spent[c.id];
        const ref = prev[c.id];
        if (c.fixed) byCategory[c.id] = Math.max(s, ref);
        else if (ref > 0) byCategory[c.id] = s + remaining * ref;
        else byCategory[c.id] = (s / p.daysElapsed) * p.daysInMonth;
      });
    }

    return Object.assign({ byCategory, total: PS.budget.total(byCategory) }, p);
  },

  // Next month = weighted average of this month (projected) and the two previous months that have data.
  nextMonth(state) {
    const U = PS.util;
    const cur = U.currentMonthKey();
    const sources = [{ key: cur, data: this.monthEnd(state, cur).byCategory, projected: true }];

    for (let i = 1; i <= 3 && sources.length < this.WEIGHTS.length; i++) {
      const key = U.addMonths(cur, -i);
      const data = PS.budget.spent(state.transactions, key);
      if (PS.budget.total(data) > 0) sources.push({ key, data, projected: false });
    }

    const weights = this.WEIGHTS.slice(0, sources.length);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const byCategory = {};
    PS.CATEGORIES.forEach((c) => {
      byCategory[c.id] = sources.reduce((a, s, i) => a + weights[i] * s.data[c.id], 0) / weightSum;
    });

    return {
      key: U.addMonths(cur, 1),
      byCategory,
      total: PS.budget.total(byCategory),
      sources: sources.map((s, i) => ({ key: s.key, projected: s.projected, weight: weights[i] / weightSum }))
    };
  },

  history(state, months) {
    const U = PS.util;
    const cur = U.currentMonthKey();
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const key = U.addMonths(cur, -i);
      out.push({ key, total: PS.budget.total(PS.budget.spent(state.transactions, key)) });
    }
    return out;
  },

  // Confidence = 100 - coefficient of variation of the last 3 completed months, kept within 60–98%.
  confidence(state) {
    const U = PS.util;
    const cur = U.currentMonthKey();
    const totals = [1, 2, 3]
      .map((i) => PS.budget.total(PS.budget.spent(state.transactions, U.addMonths(cur, -i))))
      .filter((v) => v > 0);
    if (totals.length < 2) return { value: 60, variation: null };
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const sd = Math.sqrt(totals.reduce((a, v) => a + (v - mean) ** 2, 0) / totals.length);
    const variation = (sd / mean) * 100;
    return { value: Math.round(Math.min(98, Math.max(60, 100 - variation))), variation };
  },

  ANOMALY_RATIO: 2,

  // A transaction is unusual when it is more than 2x the average transaction in its category
  // over the previous 3 months. Fixed bills (rent) are skipped.
  anomalies(state, monthKey) {
    const U = PS.util;
    const key = monthKey || U.currentMonthKey();
    const from = U.addMonths(key, -3);
    const history = {};
    state.transactions.forEach((t) => {
      const k = t.date.slice(0, 7);
      if (k >= from && k < key) (history[t.category] = history[t.category] || []).push(t.amount);
    });

    return state.transactions
      .filter((t) => t.date.startsWith(key) && !PS.category(t.category).fixed)
      .map((t) => {
        const list = history[t.category] || [];
        if (list.length < 3) return null;
        const average = list.reduce((a, b) => a + b, 0) / list.length;
        const ratio = t.amount / average;
        return ratio > this.ANOMALY_RATIO ? { transaction: t, average, ratio } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.ratio - a.ratio);
  },

  basisText(forecast) {
    const U = PS.util;
    const parts = forecast.sources.map((s) =>
      U.monthLabel(s.key, true) + (s.projected ? ' (projected)' : '') + ' ' + Math.round(s.weight * 100) + '%'
    );
    if (parts.length === 1) return 'based on ' + parts[0].replace(/ 100%$/, '');
    return 'weighted average of ' + U.listJoin(parts) + ', so recent months count more';
  }
};

PS.STATUS = {
  over: { label: 'Over budget', cls: 'danger', order: 0 },
  risk: { label: 'Likely to overspend', cls: 'warning', order: 1 },
  near: { label: 'Near limit', cls: 'warning', order: 2 },
  ok: { label: 'On track', cls: 'success', order: 3 }
};

PS.budget = {
  NEAR_LIMIT: 0.8,

  amounts(settings) {
    const out = {};
    PS.CATEGORIES.concat(PS.SAVINGS).forEach((c) => {
      out[c.id] = (settings.income * (settings.percents[c.id] || 0)) / 100;
    });
    return out;
  },

  spent(transactions, monthKey) {
    const out = {};
    PS.CATEGORIES.forEach((c) => { out[c.id] = 0; });
    transactions.forEach((t) => {
      if (!t.date.startsWith(monthKey)) return;
      const id = t.category in out ? t.category : 'others';
      out[id] += Number(t.amount) || 0;
    });
    return out;
  },

  total(byCategory) {
    return Object.values(byCategory).reduce((a, b) => a + b, 0);
  },

  report(state, monthKey) {
    const U = PS.util;
    const key = monthKey || U.currentMonthKey();
    const settings = state.settings;
    const income = settings.income;
    const budgets = this.amounts(settings);
    const spent = this.spent(state.transactions, key);
    const proj = PS.prediction.monthEnd(state, key);

    const categories = PS.CATEGORIES.map((c) => {
      const sp = spent[c.id];
      const b = budgets[c.id];
      const pr = proj.byCategory[c.id];
      let status = 'ok';
      if (sp > b && sp > 0) status = 'over';
      else if (proj.isCurrent && pr > b && pr > 0) status = 'risk';
      else if (b > 0 && sp >= this.NEAR_LIMIT * b) status = 'near';
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        spent: sp,
        budget: b,
        budgetPct: settings.percents[c.id] || 0,
        projected: pr,
        over: Math.max(0, sp - b),
        pctOfIncome: U.ratio(sp, income),
        pctOfBudget: U.ratio(sp, b),
        status
      };
    });

    return {
      key,
      isCurrent: proj.isCurrent,
      daysElapsed: proj.daysElapsed,
      daysInMonth: proj.daysInMonth,
      income,
      totalSpent: this.total(spent),
      projectedTotal: proj.total,
      expectedSavings: income - proj.total,
      expectedRate: U.ratio(income - proj.total, income),
      savingsTarget: budgets.savings,
      savingsTargetPct: settings.percents.savings || 0,
      categories
    };
  }
};

PS.goals = {
  monthlySavings(state) {
    return Math.max(0, PS.budget.report(state).expectedSavings);
  },

  evaluate(goal, monthlySavings) {
    const U = PS.util;
    const cur = U.currentMonthKey();
    const remaining = Math.max(0, goal.target - goal.saved);
    const progress = Math.min(100, U.ratio(goal.saved, goal.target));
    const diff = U.monthDiff(cur, goal.deadline);
    const base = { remaining, progress, monthsLeft: 0, requiredMonthly: 0, finishKey: null };

    if (remaining === 0) return Object.assign(base, { status: 'done' });
    if (diff < 0) return Object.assign(base, { status: 'overdue', requiredMonthly: remaining });

    const monthsLeft = Math.max(1, diff);
    const requiredMonthly = remaining / monthsLeft;
    const monthsNeeded = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : null;
    return Object.assign(base, {
      status: monthlySavings >= requiredMonthly ? 'on-track' : 'behind',
      monthsLeft,
      requiredMonthly,
      finishKey: monthsNeeded ? U.addMonths(cur, monthsNeeded) : null
    });
  },

  STATUS: {
    'on-track': { label: 'On track', cls: 'success' },
    behind: { label: 'Behind', cls: 'warning' },
    done: { label: 'Completed', cls: 'success' },
    overdue: { label: 'Overdue', cls: 'danger' }
  }
};

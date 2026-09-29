// Financial health score (0–100):
// savings 40 + budget discipline 30 + goal progress 20 + spending trend 10.
PS.health = {
  LEVELS: [
    { min: 80, label: 'Excellent', cls: 'success', color: '#16A34A' },
    { min: 60, label: 'Good', cls: 'info', color: '#4F46E5' },
    { min: 0, label: 'Needs attention', cls: 'warning', color: '#D97706' }
  ],

  score(state) {
    const r = PS.budget.report(state);
    const fc = PS.prediction.nextMonth(state);

    const target = r.savingsTargetPct;
    const savings = target > 0
      ? Math.min(40, Math.max(0, (40 * r.expectedRate) / target))
      : (r.expectedSavings >= 0 ? 40 : 0);
    const within = r.categories.filter((c) => c.status !== 'over').length;
    const budget = (30 * within) / r.categories.length;
    // No goals yet counts as half marks.
    const goals = state.goals.length
      ? (20 * state.goals.reduce((a, g) => a + Math.min(1, g.saved / g.target), 0)) / state.goals.length
      : 10;
    const trend = fc.total <= r.projectedTotal ? 10 : 5;

    const score = Math.round(savings + budget + goals + trend);
    const level = this.LEVELS.find((l) => score >= l.min);
    return Object.assign({ score }, level, {
      parts: [
        { id: 'savings', name: 'Savings rate', value: savings, max: 40 },
        { id: 'budget', name: 'Budget discipline', value: budget, max: 30 },
        { id: 'goals', name: 'Goal progress', value: goals, max: 20 },
        { id: 'trend', name: 'Spending trend', value: trend, max: 10 }
      ]
    });
  }
};

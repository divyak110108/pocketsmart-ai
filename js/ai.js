PS.ai = (function () {
  const U = PS.util;
  const m = U.money;
  const pc = U.pct;

  const TIPS = {
    bills: ['Compare mobile and broadband plans and switch to a cheaper one', 'Switch off unused appliances to lower the EB bill', 'Pay bills on time to avoid late fees'],
    food: ['Cook at home 2–3 more days a week', 'Limit food delivery to once a week', 'Buy groceries in bulk from a fixed list'],
    travel: ['Use metro or bus for the daily commute', 'Share rides with colleagues', 'Combine errands into a single trip'],
    shopping: ['Wait 48 hours before any non-essential purchase', 'Set a fixed monthly shopping cap', 'Remove saved cards from shopping apps'],
    health: ['Ask for generic medicines', 'Use insurance or employer health cover', 'Pick a gym plan you actually use'],
    entertainment: ['Keep only one streaming subscription at a time', 'Choose weekday shows, which are cheaper', 'Plan free outings like parks and beaches'],
    others: ['Note every small miscellaneous spend', 'Set a small monthly cap for Others', 'Review this category once a week']
  };

  const TYPOS = [
    [/\bexpen[cs]es?\b/g, 'expense'],
    [/\b(buget|budjet|bugdet|budgt)\b/g, 'budget'],
    [/\b(savng|savngs|savigs|saveing|saveings|savins)\b/g, 'savings'],
    [/\b(grocries|grocerys|grocerie)\b/g, 'groceries'],
    [/\b(forcast|forecst|forcaste)\b/g, 'forecast'],
    [/\b(predicit|predic|pridict)\b/g, 'predict'],
    [/\b(recomend|reccomend|recommand|recomment)\w*/g, 'recommend'],
    [/\b(shoping|shoppin)\b/g, 'shopping'],
    [/\b(travell?ing|travl|travle)\b/g, 'travel'],
    [/\b(entertainement|entertaiment|entertainmnt)\b/g, 'entertainment'],
    [/\b(spnd|spned)\b/g, 'spend'],
    [/\b(overspnd|over spend(ing)?)\b/g, 'overspend']
  ];

  const INTENTS = [
    ['afford', /afford|can i (spend|buy|pay)|should i (spend|buy)|is it ok to (spend|buy)/],
    ['score', /score|financial health|health check|how healthy/],
    ['anomaly', /unusual|anomal|strange|suspicious|\bodd\b|abnormal|spike/],
    ['why', /^(why|how come|explain|reason)\b/],
    ['tips', /^(how|tips|any tips|how to do (it|that)|how can i (do|reduce|lower|cut|save on) (it|that|this))$/],
    ['recs', /recommend|suggest|advice|advise/],
    ['cut', /\b(cut|reduce|lower|decrease|minimi[sz]e|spend less|cut down)\b|save more|save money|saving tips|where can i/],
    ['overspend', /overspend|over budget|overbudget|exceed|too much|alert|warning|crossed/],
    ['forecast', /predict|forecast|next month|future|expect|upcoming|coming month|will i spend/],
    ['goals', /\bgoals?\b/],
    ['budget', /budget|plan|split|allocat|limit|left in/],
    ['savings', /sav(e|ing)|target/],
    ['summary', /summary|overview|how am i|status|report|doing|spent|expense|total|how much|this month/],
    ['greet', /^(hi|hello|hey|vanakkam|good (morning|afternoon|evening))\b/]
  ];

  let memory = { intent: null, category: null, amount: null };
  let insightVariant = -1;

  // ---------- Helpers ----------

  function pick(options) {
    return options[Math.floor(Math.random() * options.length)];
  }
  function fmt(s) {
    return U.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  function P(s) {
    return `<p>${fmt(s)}</p>`;
  }
  function UL(items) {
    return items.length ? `<ul>${items.map((i) => `<li>${fmt(i)}</li>`).join('')}</ul>` : '';
  }
  function lcFirst(s) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  function tipLine(id) {
    return `${TIPS[id][0]}, and ${lcFirst(TIPS[id][1])}.`;
  }
  function times(ratio) {
    return (Math.round(ratio * 10) / 10) + '×';
  }

  // Suggested cut: the overspend, capped at 25% of what was spent, rounded to a friendly figure.
  function cutFor(c) {
    const raw = Math.min(c.over, c.spent * 0.25);
    if (raw <= 0) return 0;
    return raw >= 1000 ? U.round(raw, 500) : Math.max(100, U.round(raw, 100));
  }

  function byStatus(a, b) {
    return PS.STATUS[a.status].order - PS.STATUS[b.status].order || b.over - a.over;
  }

  function overList(r) {
    return r.categories.filter((c) => c.status === 'over').sort(byStatus);
  }

  function alertText(c) {
    if (c.status === 'over') return `**${c.name}** is ${m(c.over)} over budget (${m(c.spent)} spent of ${m(c.budget)}).`;
    if (c.status === 'risk') return `**${c.name}** may reach ${m(c.projected)} by month-end, above its ${m(c.budget)} budget.`;
    if (c.status === 'near') return `**${c.name}** has used ${pc(c.pctOfBudget)} of its budget. Only ${m(c.budget - c.spent)} is left.`;
    return `**${c.name}** is within budget.`;
  }

  function anomalyText(a) {
    const t = a.transaction;
    return `**${m(t.amount)}** on "${t.description}" (${U.dateLabel(t.date)}) is ${times(a.ratio)} your usual ${PS.category(t.category).name} transaction of ${m(a.average)}.`;
  }

  function steadiness(variation) {
    if (variation === null) return 'limited history';
    if (variation < 5) return 'very steady';
    if (variation < 10) return 'fairly steady';
    return 'variable';
  }

  function context(state) {
    const r = PS.budget.report(state);
    return {
      state,
      r,
      fc: PS.prediction.nextMonth(state),
      monthly: Math.max(0, r.expectedSavings),
      month: U.monthLabel(r.key)
    };
  }

  // ---------- Recommendations (Dashboard card and chat) ----------

  function recommendations(state) {
    const { r, fc, monthly, month } = context(state);
    const out = [];

    if (r.expectedSavings < 0) {
      out.push({
        level: 'danger',
        title: 'You are spending more than you earn',
        text: `At this pace you'll spend ${m(r.projectedTotal)} in ${month}, ${m(-r.expectedSavings)} more than your income. Start with the cuts below.`
      });
    } else if (r.expectedRate >= r.savingsTargetPct) {
      out.push({
        level: 'success',
        title: 'Savings on target',
        text: `You're on track to save ${m(r.expectedSavings)} this month (${pc(r.expectedRate)} of income), which meets your ${r.savingsTargetPct}% savings target.`
      });
    } else {
      out.push({
        level: 'warning',
        title: 'Savings below target',
        text: `You're on track to save ${m(r.expectedSavings)} (${pc(r.expectedRate)} of income). That's ${m(r.savingsTarget - r.expectedSavings)} short of your ${r.savingsTargetPct}% target of ${m(r.savingsTarget)}.`
      });
    }

    const over = overList(r);
    over.forEach((c) => {
      const cut = cutFor(c);
      out.push({
        level: 'warning',
        cut,
        title: `Cut ${c.name} by ${m(cut)}`,
        text: `Your ${c.name} spending is ${m(c.spent)}, which is ${pc(c.pctOfIncome)} of your income and ${m(c.over)} over its ${m(c.budget)} budget. If you reduce it by ${m(cut)} next month, your savings can increase to ${m(monthly + cut)}.`
      });
    });

    if (over.length > 1) {
      const total = over.reduce((a, c) => a + cutFor(c), 0);
      out.push({
        level: 'tip',
        title: 'Combined savings potential',
        text: `Apply all ${over.length} cuts above (${m(total)} in total) and your monthly savings can grow from ${m(monthly)} to ${m(monthly + total)}, which is ${pc(U.ratio(monthly + total, r.income))} of your income.`
      });
    }

    const daysLeft = r.daysInMonth - r.daysElapsed;
    r.categories.filter((c) => c.status === 'risk').forEach((c) => {
      out.push({
        level: 'warning',
        title: `${c.name} may cross its budget`,
        text: `At your current pace, ${c.name} will reach about ${m(c.projected)} by month-end, ${m(c.projected - c.budget)} over its ${m(c.budget)} budget. Slow down here for the remaining ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
      });
    });

    r.categories.filter((c) => c.status === 'near').forEach((c) => {
      out.push({
        level: 'info',
        title: `${c.name} is close to its limit`,
        text: `You've used ${pc(c.pctOfBudget)} of your ${c.name} budget (${m(c.spent)} of ${m(c.budget)}). Only ${m(c.budget - c.spent)} is left for this month.`
      });
    });

    state.goals.forEach((g) => {
      const e = PS.goals.evaluate(g, monthly);
      if (e.status !== 'behind') return;
      const later = e.finishKey ? ` At your current savings you'd reach it in ${U.monthLabel(e.finishKey)}.` : '';
      out.push({
        level: 'tip',
        title: `Goal "${g.name}" needs ${m(e.requiredMonthly)}/month`,
        text: `To reach ${m(g.target)} by ${U.monthLabel(g.deadline)} you need ${m(e.requiredMonthly)} a month, but you're saving about ${m(monthly)}. Save ${m(e.requiredMonthly - monthly)} more each month or move the deadline.${later}`
      });
    });

    const spendBudget = r.income - r.savingsTarget;
    const topFc = PS.CATEGORIES.map((c) => ({ name: c.name, v: fc.byCategory[c.id] })).sort((a, b) => b.v - a.v)[0];
    out.push({
      level: 'info',
      title: `Next month forecast: ${m(fc.total)}`,
      text: `You're likely to spend about ${m(fc.total)} in ${U.monthLabel(fc.key)}. The biggest share is ${topFc.name} at ${m(topFc.v)}. ` +
        (fc.total > spendBudget
          ? `That's ${m(fc.total - spendBudget)} above your spending budget of ${m(spendBudget)}.`
          : `That's within your spending budget of ${m(spendBudget)}.`)
    });

    const healthy = r.categories.filter((c) => c.status === 'ok' && c.spent > 0).map((c) => c.name);
    if (healthy.length) {
      out.push({
        level: 'success',
        title: 'Well managed',
        text: `${U.listJoin(healthy)} ${healthy.length === 1 ? 'is' : 'are'} within budget this month. Keep it up.`
      });
    }

    return out;
  }

  // ---------- Monthly insight paragraph (Dashboard) ----------

  // Each call rotates to the next of 3 wordings; the numbers stay the same.
  function monthlyInsight(state) {
    const { r, fc, monthly, month } = context(state);
    if (r.totalSpent === 0) {
      return `You haven't recorded any expenses for ${month} yet. Add a few in **Transactions** and I'll analyse your spending.`;
    }
    insightVariant = (insightVariant + 1) % 3;
    const v = insightVariant;
    const share = pc(U.ratio(r.totalSpent, r.income));
    const over = overList(r);
    const top = over[0];

    const opening = [
      `In ${month} you've spent **${m(r.totalSpent)}** of your **${m(r.income)}** income (${share}).`,
      `Here's how ${month} looks so far: **${m(r.totalSpent)}** spent out of **${m(r.income)}** earned, which is ${share} of your income.`,
      `Quick take on ${month}: you've used ${share} of your income, spending **${m(r.totalSpent)}** of **${m(r.income)}**.`
    ][v];

    let problem;
    if (top) {
      const others = over.slice(1).map((c) => c.name);
      problem = [
        `**${top.name}** is the biggest concern at ${m(top.over)} over budget${others.length ? `, followed by ${U.listJoin(others)}` : ''}.`,
        `${over.length === 1 ? 'One category is' : `${over.length} categories are`} over budget: ${U.listJoin(over.map((c) => c.name))}. ${top.name} needs the most attention (${m(top.over)} over).`,
        `The main pressure point is **${top.name}**, which has crossed its budget by ${m(top.over)}${others.length ? `; ${U.listJoin(others)} ${others.length === 1 ? 'is' : 'are'} also over` : ''}.`
      ][v];
    } else {
      const watch = r.categories.filter((c) => c.status !== 'ok').map((c) => c.name);
      problem = watch.length
        ? [
          `Nothing is over budget, but ${U.listJoin(watch)} ${watch.length === 1 ? 'is' : 'are'} getting close.`,
          `All categories are within budget, though ${U.listJoin(watch)} ${watch.length === 1 ? 'needs' : 'need'} watching.`,
          `No overspending yet; keep an eye on ${U.listJoin(watch)}.`
        ][v]
        : [
          'Every category is within budget, which is great discipline.',
          'All seven categories are inside their limits so far.',
          'No category has crossed its budget this month.'
        ][v];
    }

    const gap = r.savingsTarget - r.expectedSavings;
    const savingsLine = gap > 0
      ? [
        `At the current pace you'll save about **${m(r.expectedSavings)}**, ${m(gap)} below your ${r.savingsTargetPct}% target.`,
        `Your expected savings are **${m(r.expectedSavings)}** (${pc(r.expectedRate)}), short of the ${m(r.savingsTarget)} goal by ${m(gap)}.`,
        `Savings are on course for **${m(r.expectedSavings)}**, which is ${m(gap)} under target.`
      ][v]
      : [
        `You're on track to save **${m(r.expectedSavings)}** (${pc(r.expectedRate)}), meeting your ${r.savingsTargetPct}% target.`,
        `Expected savings of **${m(r.expectedSavings)}** beat your ${m(r.savingsTarget)} target.`,
        `Savings look healthy at **${m(r.expectedSavings)}**, above the ${r.savingsTargetPct}% goal.`
      ][v];

    let action;
    if (top) {
      const cut = cutFor(top);
      const after = monthly + cut;
      action = after >= r.savingsTarget
        ? [
          `Cutting ${top.name} by ${m(cut)} would put you back on track.`,
          `A ${m(cut)} cut in ${top.name} is enough to hit your savings target.`,
          `Trim ${top.name} by ${m(cut)} next month and you'll reach your target.`
        ][v]
        : [
          `Cutting ${top.name} by ${m(cut)} would raise savings to ${m(after)}.`,
          `A ${m(cut)} cut in ${top.name} lifts savings to ${m(after)}.`,
          `Trim ${top.name} by ${m(cut)} to push savings up to ${m(after)}.`
        ][v];
    } else {
      action = [
        `Next month is forecast at ${m(fc.total)}.`,
        `I expect about ${m(fc.total)} of spending in ${U.monthLabel(fc.key)}.`,
        `Keep this up: next month looks like ${m(fc.total)}.`
      ][v];
    }

    return [opening, problem, savingsLine, action].join(' ');
  }

  // ---------- Chat answers ----------

  function noData(ctx) {
    return P(`You haven't added any expenses for ${ctx.month} yet. Add them in **Transactions** and ask me again.`);
  }

  function summary(ctx) {
    const { r, month } = ctx;
    const over = overList(r);
    const top = r.categories.slice().sort((a, b) => b.spent - a.spent)[0];
    return P(pick([
      `Here's your ${month} summary:`,
      `This is where ${month} stands right now:`,
      `A quick snapshot of ${month}:`
    ])) + UL([
      `Income: **${m(r.income)}**`,
      `Spent so far: **${m(r.totalSpent)}** (${pc(U.ratio(r.totalSpent, r.income))} of income), projected ${m(r.projectedTotal)} by month-end`,
      `Expected savings: **${m(r.expectedSavings)}** (${pc(r.expectedRate)}), target ${m(r.savingsTarget)}`,
      `Biggest expense: **${top.name}** at ${m(top.spent)}`,
      over.length ? `Over budget: ${U.listJoin(over.map((c) => `**${c.name}**`))}` : 'No category is over budget'
    ]);
  }

  function categoryDetail(ctx, id) {
    const { r, fc, monthly, month } = ctx;
    const c = r.categories.find((x) => x.id === id);
    let out = P(pick([
      `Here's your **${c.name}** picture for ${month}:`,
      `I checked your **${c.name}** spending for ${month}:`,
      `**${c.name}** in ${month}:`
    ])) + UL([
      `Spent: **${m(c.spent)}** of ${m(c.budget)} budget (${pc(c.pctOfBudget)} used)`,
      `Share of income: ${pc(c.pctOfIncome)} (your plan allows ${c.budgetPct}%)`,
      `Projected by month-end: ${m(c.projected)}`,
      `Next month forecast: ${m(fc.byCategory[id])}`,
      `Status: **${PS.STATUS[c.status].label}**`
    ]);
    if (c.status === 'over') {
      const cut = cutFor(c);
      out += P(`Cut ${m(cut)} from ${c.name} next month and your savings rise to **${m(monthly + cut)}**.`);
    }
    return out + P(`How to save on ${c.name}: ${lcFirst(tipLine(id))}`);
  }

  function tips(ctx, id) {
    const { r, monthly } = ctx;
    const c = r.categories.find((x) => x.id === id);
    const cut = cutFor(c);
    return P(pick([
      `Here's how to bring down your **${c.name}** spending:`,
      `A few practical ways to lower **${c.name}**:`,
      `To save on **${c.name}**, try this:`
    ])) + UL(TIPS[id]) +
      (cut ? P(`Aim to cut ${m(cut)} next month. That alone lifts your savings to **${m(monthly + cut)}**.`)
        : P(`${c.name} is within budget at ${m(c.spent)} of ${m(c.budget)}, so these tips help you build extra savings.`));
  }

  function cuts(ctx) {
    const { r, monthly, month } = ctx;
    const over = overList(r);
    if (over.length) {
      const total = over.reduce((a, c) => a + cutFor(c), 0);
      return P(pick([
        `These are the best places to cut spending in ${month}:`,
        `I compared every category with your budget. Here's where you can cut:`,
        `Based on your ${month} spending, these cuts will help most:`
      ])) +
        UL(over.map((c) => {
          const cut = cutFor(c);
          return `**${c.name}**: spent ${m(c.spent)} (${pc(c.pctOfIncome)} of income), ${m(c.over)} over budget. Cut ${m(cut)} next month and your savings rise to ${m(monthly + cut)}.`;
        })) +
        (over.length > 1 ? P(`Apply all of these cuts (${m(total)} in total) and your monthly savings can grow from ${m(monthly)} to **${m(monthly + total)}**.`) : '') +
        P(`Tip for ${over[0].name}: ${lcFirst(tipLine(over[0].id))}`);
    }

    const watch = r.categories.filter((c) => c.status === 'risk' || c.status === 'near').sort(byStatus);
    if (watch.length) {
      return P('Nothing is over budget yet, but keep an eye on these:') + UL(watch.map(alertText));
    }

    const flex = r.categories.filter((c) => c.id !== 'bills').sort((a, b) => b.spent - a.spent)[0];
    const trim = Math.max(100, U.round(flex.spent * 0.1, 100));
    return P(`Every category is within budget. Your largest flexible expense is **${flex.name}** (${m(flex.spent)}). Trimming it by 10% (${m(trim)}) would lift your expected savings to ${m(monthly + trim)}.`) +
      P(`Tip: ${lcFirst(tipLine(flex.id))}`);
  }

  function overspending(ctx) {
    const { r, month } = ctx;
    const flagged = r.categories.filter((c) => c.status !== 'ok').sort(byStatus);
    if (!flagged.length) {
      return P(pick([
        `Good news: every category is within budget in ${month}.`,
        `No overspending in ${month}. All categories are inside their limits.`
      ]));
    }
    return P(pick([
      `${flagged.length} categor${flagged.length === 1 ? 'y needs' : 'ies need'} attention:`,
      `I found ${flagged.length} categor${flagged.length === 1 ? 'y' : 'ies'} to watch in ${month}:`,
      `Here's where your spending is running hot:`
    ])) + UL(flagged.map(alertText));
  }

  function forecast(ctx) {
    const { r, fc } = ctx;
    const conf = PS.prediction.confidence(ctx.state);
    const spendBudget = r.income - r.savingsTarget;
    const top = PS.CATEGORIES.map((c) => ({ name: c.name, v: fc.byCategory[c.id] }))
      .sort((a, b) => b.v - a.v).slice(0, 4);
    return P(pick([
      `For **${U.monthLabel(fc.key)}** I expect you to spend about **${m(fc.total)}**. Top categories:`,
      `My forecast for **${U.monthLabel(fc.key)}** is **${m(fc.total)}**. The biggest parts:`,
      `Looking ahead to **${U.monthLabel(fc.key)}**, spending should land near **${m(fc.total)}**:`
    ])) +
      UL(top.map((t) => `${t.name}: ${m(t.v)}`)) +
      P(fc.total > spendBudget
        ? `That's ${m(fc.total - spendBudget)} above your spending budget of ${m(spendBudget)}, so you'd save about ${m(r.income - fc.total)}.`
        : `That keeps you within your spending budget of ${m(spendBudget)} and leaves about ${m(r.income - fc.total)} for savings.`) +
      P(`Forecast confidence: **${conf.value}%**, because your recent spending has been ${steadiness(conf.variation)}.`);
  }

  function goals(ctx) {
    const { state, monthly } = ctx;
    if (!state.goals.length) return P("You haven't set any savings goals yet. Add one in **Savings goals** and I'll track it for you.");
    let totalRequired = 0;
    const lines = state.goals.map((g) => {
      const e = PS.goals.evaluate(g, monthly);
      const name = `**${g.name}**`;
      if (e.status === 'done') return `${name}: completed, ${m(g.target)} saved.`;
      if (e.status === 'overdue') return `${name}: deadline passed with ${m(e.remaining)} still to go. Set a new deadline.`;
      totalRequired += e.requiredMonthly;
      if (e.status === 'on-track') return `${name}: ${pc(e.progress)} done. Needs ${m(e.requiredMonthly)}/month until ${U.monthLabel(g.deadline)}, and you're on track.`;
      return `${name}: needs ${m(e.requiredMonthly)}/month but you're saving about ${m(monthly)}.` +
        (e.finishKey ? ` At this pace you'll finish in ${U.monthLabel(e.finishKey)}.` : '');
    });
    return P(pick(['Your savings goals:', 'Here\'s how your goals are progressing:', 'Goal check-in:'])) + UL(lines) +
      (totalRequired ? P(`All active goals together need **${m(totalRequired)}/month**. Your expected savings this month are ${m(monthly)}.`) : '');
  }

  function budgetPlan(ctx) {
    const { r } = ctx;
    return P(`Your monthly budget for an income of ${m(r.income)}:`) +
      UL(r.categories.map((c) => `${c.name}: ${m(c.budget)} (${c.budgetPct}%), ${m(Math.max(0, c.budget - c.spent))} left`)
        .concat(`Savings: ${m(r.savingsTarget)} (${r.savingsTargetPct}%)`)) +
      P('You can change these percentages in **Monthly budget**.');
  }

  function savings(ctx) {
    const { r, monthly } = ctx;
    let out = P(`You're on track to save **${m(r.expectedSavings)}** this month, which is ${pc(r.expectedRate)} of your income. Your target is ${m(r.savingsTarget)} (${r.savingsTargetPct}%).`);
    const over = overList(r);
    if (over.length) {
      const cut = cutFor(over[0]);
      out += P(`Quickest win: cut ${over[0].name} by ${m(cut)} to raise savings to ${m(monthly + cut)}.`);
    }
    return out;
  }

  function roomiest(r, excludeId) {
    return r.categories.filter((c) => c.id !== excludeId)
      .sort((a, b) => (b.budget - b.spent) - (a.budget - a.spent))[0];
  }

  function afford(ctx, amount, catId) {
    const { r, monthly } = ctx;
    if (!amount) return P('How much are you planning to spend? For example: "Can I spend ₹1,500 on food?"');
    const after = monthly - amount;
    if (catId) {
      const c = r.categories.find((x) => x.id === catId);
      const left = c.budget - c.spent;
      if (amount <= left) {
        return P(`**Yes.** You have ${m(left)} left in your ${c.name} budget. After spending ${m(amount)}, ${m(left - amount)} will remain.`);
      }
      const room = roomiest(r, catId);
      return P(`**Not recommended.** ${left > 0 ? `${c.name} has only ${m(left)} left` : `${c.name} is already ${m(-left)} over budget`}. Spending ${m(amount)} would put it ${m(amount - left)} over budget and reduce your expected savings to ${m(after)}.`) +
        P(`If it's essential, take the money from a category with room to spare, such as ${room.name} (${m(room.budget - room.spent)} left).`);
    }
    if (after >= r.savingsTarget) return P(`**Yes.** Your expected savings would still be ${m(after)}, which meets your target of ${m(r.savingsTarget)}.`);
    if (after >= 0) return P(`**Possible, but careful.** Your expected savings would drop to ${m(after)}, below your target of ${m(r.savingsTarget)}.`);
    return P(`**No.** That would make you spend ${m(-after)} more than you earn this month.`);
  }

  function healthAnswer(ctx) {
    const h = PS.health.score(ctx.state);
    const weakest = h.parts.slice().sort((a, b) => (b.max - b.value) - (a.max - a.value))[0];
    const advice = {
      savings: 'Raise your savings rate, for example by applying the cuts I suggest.',
      budget: 'Bring over-budget categories back within their limits.',
      goals: 'Add money to your goals regularly, even small amounts.',
      trend: "Keep next month's spending at or below this month's."
    };
    return P(pick([
      `Your financial health score is **${h.score}/100** (${h.label}).`,
      `I rate your finances **${h.score}/100**, which is ${h.label.toLowerCase()}.`
    ])) + UL(h.parts.map((p) => `${p.name}: ${Math.round(p.value)} / ${p.max}`)) +
      P(`Biggest opportunity: **${weakest.name}**. ${advice[weakest.id]}`);
  }

  function anomalies(ctx) {
    const list = PS.prediction.anomalies(ctx.state);
    if (!list.length) {
      return P(pick([
        `I didn't find any unusual transactions in ${ctx.month}.`,
        `Everything in ${ctx.month} looks normal. No transaction stands out from your usual pattern.`
      ]));
    }
    return P(pick([
      `I found ${list.length} unusual transaction${list.length === 1 ? '' : 's'} in ${ctx.month}:`,
      `${list.length === 1 ? 'This transaction stands' : 'These transactions stand'} out from your usual pattern:`
    ])) + UL(list.map(anomalyText));
  }

  function recsAnswer(ctx) {
    return P(pick([
      'Here are my personalised recommendations:',
      'Based on your data, this is what I recommend:',
      'My recommendations for you this month:'
    ])) + UL(recommendations(ctx.state).map((x) => `**${x.title}**: ${x.text}`));
  }

  function why(ctx, catId) {
    const prev = memory.intent;
    if (prev === 'forecast') {
      const conf = PS.prediction.confidence(ctx.state);
      return P(`My forecast is a ${PS.prediction.basisText(ctx.fc)}.`) +
        P(`Confidence is **${conf.value}%** because your spending over the last few months has been ${steadiness(conf.variation)}` +
          (conf.variation === null ? '.' : ` (it varied by about ${Math.round(conf.variation)}%).`));
    }
    if (prev === 'overspend') {
      return P('I flag a category using three rules:') + UL([
        '**Over budget**: spent more than its budget',
        '**Likely to overspend**: the month-end estimate is above budget',
        '**Near limit**: 80% or more of the budget is already used'
      ]);
    }
    if (prev === 'goals') {
      return P(`For each goal I divide the amount still needed by the months left until the deadline, then compare it with your expected monthly savings (${m(ctx.monthly)}).`);
    }
    if (prev === 'score') {
      return P('The score adds up four parts:') + UL([
        'Savings rate: up to 40 points, full marks when you reach your savings target',
        'Budget discipline: up to 30 points, based on how many categories are within budget',
        'Goal progress: up to 20 points, based on average progress across goals',
        "Spending trend: 10 points if next month's forecast isn't higher than this month, otherwise 5"
      ]);
    }
    if (prev === 'anomaly') {
      return P(`I mark a transaction as unusual when it's more than ${PS.prediction.ANOMALY_RATIO}× the average transaction in its category over the previous 3 months. Fixed bills like rent are ignored.`);
    }
    if (catId) {
      const c = ctx.r.categories.find((x) => x.id === catId);
      if (c.status === 'over') {
        return P(`Because **${c.name}** takes ${pc(c.pctOfIncome)} of your income while your plan allows ${c.budgetPct}%. It's ${m(c.over)} over its ${m(c.budget)} budget, so reducing it moves money straight into savings.`) +
          P('I cap each suggested cut at 25% of what you spent, so the change stays realistic.');
      }
      return P(`${c.name} is at ${pc(c.pctOfBudget)} of its ${m(c.budget)} budget and ${pc(c.pctOfIncome)} of your income, compared with the ${c.budgetPct}% in your plan.`);
    }
    return P('Every answer I give is calculated from your own transactions, budget and goals.') + summary(ctx);
  }

  function help() {
    return P("I'm PocketSmart AI. I analyse your income, expenses, budget and goals. Try asking:") + UL([
      'Where can I cut spending this month?',
      'Am I overspending anywhere?',
      'How much did I spend on food?',
      'Predict my next month expenses',
      'Show my financial health score',
      'Can I spend ₹2,000 on shopping?'
    ]);
  }

  function fallback(ctx) {
    return P(pick([
      "I'm not completely sure what you meant, but here's where things stand:",
      "I didn't quite catch that. Here's a quick overview instead:"
    ])) + summary(ctx) + P('You can ask me about cutting spending, overspending, forecasts, goals or any category.');
  }

  // ---------- Thinking steps & follow-ups ----------

  function thinkingSteps(ctx, intent, catId) {
    const count = ctx.state.transactions.filter((t) => t.date.startsWith(ctx.r.key)).length;
    const read = `Reading ${count} transactions from ${ctx.month}`;
    const name = catId ? PS.category(catId).name : '';
    switch (intent) {
      case 'cut': return [read, `Comparing ${PS.CATEGORIES.length} categories with your budget`, 'Calculating the most effective cuts'];
      case 'overspend': return [read, 'Checking each category against its limit', 'Projecting month-end spending'];
      case 'forecast': return [`Analysing spending from ${U.listJoin(ctx.fc.sources.map((s) => U.monthLabel(s.key, true)))}`, 'Weighting recent months more heavily', 'Estimating forecast confidence'];
      case 'goals': return [`Checking ${ctx.state.goals.length} savings goal${ctx.state.goals.length === 1 ? '' : 's'}`, 'Matching goals with your expected savings'];
      case 'category':
      case 'tips': return [read, `Focusing on ${name} spending`, 'Preparing suggestions'];
      case 'afford': return [catId ? `Checking what's left in your ${name} budget` : 'Checking your expected savings', 'Estimating the impact on your savings'];
      case 'score': return [read, 'Scoring savings, budget, goals and trend', 'Calculating your health score'];
      case 'anomaly': return [read, 'Comparing each transaction with your 3-month average', 'Flagging unusual amounts'];
      case 'recs': return [read, 'Finding overspending and savings gaps', 'Generating personalised recommendations'];
      case 'why': return ['Reviewing my previous answer', 'Explaining the calculation'];
      case 'summary': return [read, 'Summarising income, spending and savings'];
      case 'budget': return ['Loading your budget plan', 'Checking what is left in each category'];
      case 'savings': return [read, 'Projecting month-end savings'];
      case 'greet': return ['Understanding your message'];
      default: return ['Understanding your question', read];
    }
  }

  function followUpsFor(ctx, intent, catId) {
    const over = overList(ctx.r);
    const otherOver = over.find((c) => c.id !== catId);
    switch (intent) {
      case 'cut': return [over.length ? 'How can I reduce it?' : null, 'Why?', 'Predict my next month expenses'];
      case 'category': return ['How can I reduce it?', otherOver ? `What about ${otherOver.name.toLowerCase()}?` : null, 'Predict my next month expenses'];
      case 'tips': return ['Why?', 'Where can I cut spending this month?', 'Show my financial health score'];
      case 'afford': {
        const room = roomiest(ctx.r, catId);
        return [`What about ${room.name.toLowerCase()}?`, 'Show my budget'];
      }
      case 'overspend': return ['Why?', 'Where can I cut spending this month?', 'Any unusual transactions?'];
      case 'forecast': return ['Why this forecast?', 'Where can I cut spending this month?'];
      case 'goals': return ['How can I save more?', 'Show my financial health score'];
      case 'score': return ['Why?', 'Give me recommendations'];
      case 'anomaly': return ['Why?', 'Am I overspending anywhere?'];
      case 'recs': return ['Show my financial health score', 'Predict my next month expenses'];
      case 'why': return ['Give me recommendations', 'Give me a summary'];
      case 'budget': return ['Am I overspending anywhere?', 'How can I save more?'];
      case 'savings': return ['How can I save more?', 'How are my savings goals?'];
      case 'summary': return ['Where can I cut spending this month?', 'Show my financial health score', 'Any unusual transactions?'];
      default: return ['Give me a summary', 'Where can I cut spending this month?', 'Show my financial health score'];
    }
  }

  // ---------- Understanding the question ----------

  function normalise(question) {
    let q = question.toLowerCase().trim().replace(/[?!.]+$/, '').trim();
    TYPOS.forEach(([re, word]) => { q = q.replace(re, word); });
    return q;
  }

  function parseAmount(text) {
    const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k\b)?/i);
    if (!match) return null;
    return parseFloat(match[1]) * (match[2] ? 1000 : 1);
  }

  function detectIntent(q) {
    const hit = INTENTS.find(([, re]) => re.test(q));
    return hit ? hit[0] : null;
  }

  function respond(state, question) {
    const q = normalise(question);
    const ctx = context(state);
    const words = q.split(/\s+/).filter(Boolean).length;
    const isFollowUp = /^(and|what about|how about|what of|same for|also)\b/.test(q);
    const pronoun = /\b(it|that|them)\b/.test(q) || /\bthis\b(?!\s+month)/.test(q);
    let intent = detectIntent(q);
    let cat = intent === 'score' ? null : PS.detectCategory(q);
    let amount = parseAmount(q);

    if (cat && (isFollowUp || (!intent && words <= 3)) && ['afford', 'cut', 'category', 'tips'].includes(memory.intent)) {
      intent = memory.intent === 'tips' || memory.intent === 'cut' ? 'category' : memory.intent;
    }
    if (!intent && cat) intent = 'category';
    if (intent === 'afford' && !amount) amount = memory.amount;
    if (!cat && memory.category && (intent === 'tips' || intent === 'why' || (pronoun && ['cut', 'category', 'afford'].includes(intent)))) {
      cat = memory.category;
    }
    if (cat && ['cut', 'summary', 'budget', 'savings', 'overspend', 'forecast'].includes(intent)) intent = 'category';

    const over = overList(ctx.r);
    if (intent === 'tips' && !cat) {
      cat = over.length ? over[0].id : ctx.r.categories.filter((c) => c.id !== 'bills').sort((a, b) => b.spent - a.spent)[0].id;
    }

    const needsData = ['cut', 'overspend', 'category', 'summary', 'tips', 'anomaly', 'recs', 'score'].includes(intent);
    let html;
    if (needsData && ctx.r.totalSpent === 0) html = noData(ctx);
    else {
      switch (intent) {
        case 'afford': html = afford(ctx, amount, cat); break;
        case 'score': html = healthAnswer(ctx); break;
        case 'anomaly': html = anomalies(ctx); break;
        case 'why': html = why(ctx, cat); break;
        case 'tips': html = tips(ctx, cat); break;
        case 'recs': html = recsAnswer(ctx); break;
        case 'cut': html = cuts(ctx); break;
        case 'overspend': html = overspending(ctx); break;
        case 'forecast': html = forecast(ctx); break;
        case 'goals': html = goals(ctx); break;
        case 'category': html = categoryDetail(ctx, cat); break;
        case 'budget': html = budgetPlan(ctx); break;
        case 'savings': html = savings(ctx); break;
        case 'summary': html = summary(ctx); break;
        case 'greet': html = P(pick(['Hi!', 'Hello!', 'Vanakkam!'])) + help(); break;
        default: html = ctx.r.totalSpent ? fallback(ctx) : help();
      }
    }

    const result = {
      steps: thinkingSteps(ctx, intent, cat),
      html,
      followUps: followUpsFor(ctx, intent, cat).filter(Boolean)
    };

    const primary = ['cut', 'overspend', 'recs'].includes(intent) && over.length ? over[0].id : null;
    memory = {
      intent: intent === 'why' ? memory.intent : (intent || memory.intent),
      category: cat || primary || memory.category,
      amount: amount || memory.amount
    };
    return result;
  }

  return { recommendations, monthlyInsight, respond, alertText, anomalyText, fmt, cutFor };
})();

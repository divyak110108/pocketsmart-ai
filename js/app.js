(function () {
  'use strict';

  const U = PS.util;
  const m = U.money;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const VIEWS = {
    dashboard: { title: 'Dashboard', sub: () => U.monthLabel(U.currentMonthKey()) + ' overview' },
    transactions: { title: 'Transactions', sub: 'Add and track your expenses' },
    budget: { title: 'Monthly budget', sub: 'Plan how your income is split across categories' },
    goals: { title: 'Savings goals', sub: 'Set targets and track your progress' },
    assistant: { title: 'AI assistant', sub: 'Ask anything about your budget' },
    settings: { title: 'Settings', sub: 'Manage your data' }
  };

  const ICONS = {
    danger: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    warning: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    tip: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    success: '<path d="M20 6 9 17l-5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
  };

  let state;
  let current = 'dashboard';

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  }

  function badge(label, cls) {
    return `<span class="badge ${cls}">${U.esc(label)}</span>`;
  }

  function statusBadge(status) {
    return badge(PS.STATUS[status].label, PS.STATUS[status].cls);
  }

  function catCell(c) {
    return `<span class="cat"><span class="dot" style="background:${c.color}"></span>${U.esc(c.name)}</span>`;
  }

  function recItem(r) {
    return `<li class="rec ${r.level}">
      <span class="rec-icon">${icon(r.level)}</span>
      <div><strong>${PS.ai.fmt(r.title)}</strong><p>${PS.ai.fmt(r.text)}</p></div>
    </li>`;
  }

  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || 'success');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function commit(msg, type) {
    PS.store.save(state);
    render();
    if (msg) toast(msg, type);
  }

  // ---------- Routing ----------

  function route() {
    const name = location.hash.slice(1);
    current = VIEWS[name] ? name : 'dashboard';
    document.body.dataset.view = current;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + current));
    $$('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.view === current));
    const nav = $('.nav');
    const link = $('.nav-link.active');
    if (link && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = link.offsetLeft - nav.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    }
    const v = VIEWS[current];
    $('#page-title').textContent = v.title;
    $('#page-sub').textContent = typeof v.sub === 'function' ? v.sub() : v.sub;
    $('#quick-add').hidden = current === 'transactions';
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const fn = RENDER[current];
    if (fn) fn();
  }

  // ---------- Dashboard ----------

  function budgetRow(c) {
    const width = c.budget ? Math.min(100, (c.spent / c.budget) * 100) : (c.spent ? 100 : 0);
    const fill = c.status === 'over' ? 'var(--danger)' : (c.status === 'ok' ? c.color : 'var(--warning)');
    return `<div class="brow">
      <div class="brow-top">
        ${catCell(c)}
        <span class="muted"><strong class="${c.status === 'over' ? 'text-danger' : ''}">${m(c.spent)}</strong> / ${m(c.budget)}</span>
      </div>
      <div class="bar"><span style="width:${width}%;background:${fill}"></span></div>
    </div>`;
  }

  function renderDashboard() {
    const r = PS.budget.report(state);

    $('#st-income').textContent = m(r.income);
    $('#st-income-sub').textContent = 'Per month';
    $('#st-expenses').textContent = m(r.totalSpent);
    $('#st-expenses-sub').textContent = `${U.pct(U.ratio(r.totalSpent, r.income))} of income · ${m(r.projectedTotal)} projected`;
    $('#st-savings').textContent = m(r.expectedSavings);
    $('#st-savings-sub').textContent = `By month-end · target ${m(r.savingsTarget)}`;
    $('#st-rate').textContent = U.pct(r.expectedRate);
    const onTarget = r.expectedRate >= r.savingsTargetPct;
    $('#st-rate-sub').innerHTML = badge(onTarget ? 'On target' : 'Below target', onTarget ? 'success' : 'warning') +
      ` Goal ${r.savingsTargetPct}%`;

    const segs = r.categories.filter((c) => c.spent > 0).map((c) => ({ label: c.name, value: c.spent, color: c.color }));
    PS.charts.donut($('#donut'), segs, 'Spent', m(r.totalSpent));
    $('#donut-legend').innerHTML = segs.length
      ? segs.map((s) => `<li>
          <span class="dot" style="background:${s.color}"></span>
          <span class="legend-name">${U.esc(s.label)}</span>
          <strong>${m(s.value)}</strong>
          <em>${U.pct(U.ratio(s.value, r.totalSpent))}</em>
        </li>`).join('')
      : '<li class="muted">No expenses this month yet.</li>';

    $('#budget-bars').innerHTML = r.categories.map(budgetRow).join('');

    const flagged = r.categories.filter((c) => c.status !== 'ok')
      .sort((a, b) => PS.STATUS[a.status].order - PS.STATUS[b.status].order || b.over - a.over);
    const alerts = flagged.map((c) => ({
      level: c.status === 'over' ? 'danger' : 'warning',
      title: `${PS.STATUS[c.status].label}: ${c.name}`,
      text: PS.ai.alertText(c)
    })).concat(PS.prediction.anomalies(state).map((a) => ({
      level: 'info',
      title: `Unusual spend: ${PS.category(a.transaction.category).name}`,
      text: PS.ai.anomalyText(a)
    })));
    $('#alerts').innerHTML = alerts.length
      ? alerts.map(recItem).join('')
      : recItem({ level: 'success', title: 'All good', text: 'Every category is within budget and nothing looks unusual.' });

    const recs = PS.ai.recommendations(state);
    const top = recs.find((x) => x.cut) || recs.find((x) => x.level === 'warning') || recs[0];
    const tip = recs.find((x) => x.level === 'tip' && x !== top);
    $('#top-tip').innerHTML = [top, tip].filter(Boolean).map(recItem).join('');

    const history = PS.prediction.history(state, 6);
    const fc = PS.prediction.nextMonth(state);
    const conf = PS.prediction.confidence(state);
    $('#trend-sub').textContent = `Last 6 months and ${U.monthLabel(fc.key)} forecast · ${conf.value}% confidence`;
    PS.charts.columns($('#trend'), history.map((h) => ({
      label: U.monthLabel(h.key, true),
      value: h.total,
      current: h.key === r.key
    })).concat({ label: U.monthLabel(fc.key, true), value: fc.total, forecast: true }), r.income);

    renderHealth();
    renderInsight(false);
  }

  function renderHealth() {
    const h = PS.health.score(state);
    PS.charts.gauge($('#gauge'), h.score, h.label, h.color);
    $('#health-parts').innerHTML = h.parts.map((p) => `<div class="brow">
        <div class="brow-top">
          <span>${p.name}</span>
          <span class="muted"><strong>${Math.round(p.value)}</strong> / ${p.max}</span>
        </div>
        <div class="bar"><span style="width:${(p.value / p.max) * 100}%;background:${h.color}"></span></div>
      </div>`).join('');
  }

  // Shows the shimmer and types a new insight when the data changed or on Regenerate;
  // otherwise shows the last insight instantly.
  const insight = { signature: null, html: '', writer: null, timer: null, busy: false };

  function renderInsight(regenerate) {
    const r = PS.budget.report(state);
    const count = state.transactions.filter((t) => t.date.startsWith(r.key)).length;
    const signature = [count, r.totalSpent, r.income, state.goals.length, JSON.stringify(state.settings.percents)].join('|');
    const box = $('#ai-summary');
    $('#ai-meta-text').textContent = `Based on ${count} transactions from ${U.monthLabel(r.key)}`;

    if (!regenerate && signature === insight.signature) {
      if (!insight.busy) box.innerHTML = insight.html;
      return;
    }

    if (insight.writer) insight.writer.finish();
    clearTimeout(insight.timer);
    insight.signature = signature;
    insight.html = `<p>${PS.ai.fmt(PS.ai.monthlyInsight(state))}</p>`;
    insight.writer = null;
    insight.busy = true;
    $('#regen').disabled = true;
    box.innerHTML = `<div class="shimmer-wrap" aria-label="Generating insight">
      <div class="shimmer-status"><span class="spinner"></span>Generating insights…</div>
      <div class="shimmer"></div><div class="shimmer"></div><div class="shimmer short"></div>
    </div>`;
    insight.timer = setTimeout(() => {
      insight.writer = PS.typewriter(box, insight.html, {
        speed: 28,
        onDone: () => {
          insight.busy = false;
          $('#regen').disabled = false;
        }
      });
    }, 1000);
  }

  // ---------- Transactions ----------

  function updateHint() {
    const desc = $('#tx-desc').value.trim();
    const hint = $('#tx-hint');
    if ($('#tx-cat').value !== 'auto' || !desc) {
      hint.innerHTML = 'Leave the category on <strong>Auto-detect</strong> and PocketSmart AI will pick it from the description.';
      return;
    }
    const guess = PS.classify(desc);
    const conf = guess.confidence >= 90 ? 'success' : (guess.confidence >= 70 ? 'info' : 'warning');
    hint.innerHTML = `<span class="spark"></span>AI detected ${catCell(PS.category(guess.id))}
      ${badge(guess.confidence + '% confidence', conf)}
      <span class="muted">${guess.keyword ? `matched “${U.esc(guess.keyword)}”` : 'no keyword matched. Pick a category if this is wrong.'}</span>`;
    fillSparks(hint);
  }

  function fillSparks(root) {
    (root || document).querySelectorAll('.spark:empty').forEach((s) => { s.innerHTML = PS.chat.SPARK; });
  }

  function renderTransactions() {
    const monthSel = $('#filter-month');
    const catSel = $('#filter-cat');
    const cur = U.currentMonthKey();
    const months = Array.from(new Set(state.transactions.map((t) => t.date.slice(0, 7)).concat(cur))).sort().reverse();
    const prevMonth = monthSel.value || cur;

    monthSel.innerHTML = '<option value="all">All months</option>' +
      months.map((k) => `<option value="${k}">${U.monthLabel(k)}</option>`).join('');
    monthSel.value = prevMonth === 'all' || months.includes(prevMonth) ? prevMonth : cur;

    const list = state.transactions
      .filter((t) => (monthSel.value === 'all' || t.date.startsWith(monthSel.value)) &&
        (catSel.value === 'all' || t.category === catSel.value))
      .sort((a, b) => b.date.localeCompare(a.date));
    const total = list.reduce((a, t) => a + t.amount, 0);

    $('#tx-summary').textContent = `${list.length} transaction${list.length === 1 ? '' : 's'} · ${m(total)}`;
    $('#tx-body').innerHTML = list.length
      ? list.map((t) => `<tr>
          <td class="nowrap">${U.dateLabel(t.date)}</td>
          <td>${U.esc(t.description)}</td>
          <td>${catCell(PS.category(t.category))}</td>
          <td class="num"><strong>${m(t.amount)}</strong></td>
          <td class="num"><button type="button" class="icon-btn" data-del-tx="${t.id}" aria-label="Delete transaction" title="Delete">${icon('trash')}</button></td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="empty">No transactions match this filter.</td></tr>';
  }

  function setupTransactions() {
    const catOptions = PS.CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    $('#tx-cat').innerHTML = '<option value="auto">Auto-detect</option>' + catOptions;
    $('#filter-cat').innerHTML = '<option value="all">All categories</option>' + catOptions;
    $('#tx-date').value = U.todayISO();
    $('#tx-date').max = U.todayISO();
    updateHint();

    $('#tx-desc').addEventListener('input', updateHint);
    $('#tx-cat').addEventListener('change', updateHint);
    $('#filter-month').addEventListener('change', renderTransactions);
    $('#filter-cat').addEventListener('change', renderTransactions);

    $('#tx-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const date = $('#tx-date').value;
      const description = $('#tx-desc').value.trim();
      const amount = parseFloat($('#tx-amount').value);
      if (!date || !description || !(amount > 0)) {
        toast('Enter a date, a description and an amount above ₹0.', 'error');
        return;
      }
      const sel = $('#tx-cat').value;
      const guess = PS.classify(description);
      const category = sel === 'auto' ? guess.id : sel;
      state.transactions.push({ id: U.uid(), date, description, amount: Math.round(amount * 100) / 100, category });

      const r = PS.budget.report(state);
      const c = r.categories.find((x) => x.id === category);
      let msg = sel === 'auto'
        ? `Added ${m(amount)}. AI categorised it as ${c.name} (${guess.confidence}% confidence).`
        : `Added ${m(amount)} to ${c.name}.`;
      let type = 'success';
      if (date.startsWith(r.key) && c.status === 'over') {
        msg += ` ${c.name} is now ${m(c.over)} over budget.`;
        type = 'warning';
      }

      $('#tx-desc').value = '';
      $('#tx-amount').value = '';
      $('#tx-cat').value = 'auto';
      updateHint();
      commit(msg, type);
      $('#tx-desc').focus();
    });

    $('#tx-body').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del-tx]');
      if (!btn) return;
      state.transactions = state.transactions.filter((t) => t.id !== btn.dataset.delTx);
      commit('Transaction deleted.');
    });
  }

  // ---------- Budget ----------

  function readBudgetForm() {
    const percents = {};
    $$('#budget-grid input').forEach((i) => { percents[i.dataset.cat] = Math.max(0, parseFloat(i.value) || 0); });
    return { income: Math.max(0, parseFloat($('#income').value) || 0), percents };
  }

  function updateBudgetPreview() {
    const s = readBudgetForm();
    const amounts = PS.budget.amounts(s);
    Object.keys(amounts).forEach((id) => { $('#amt-' + id).textContent = m(amounts[id]); });
    const total = Object.values(s.percents).reduce((a, b) => a + b, 0);
    const ok = Math.abs(total - 100) < 0.01;
    const el = $('#pct-total');
    el.className = 'badge ' + (ok ? 'success' : 'danger');
    el.textContent = ok ? 'Total: 100%' : `Total: ${Math.round(total * 10) / 10}% (must equal 100%)`;
    $('#budget-save').disabled = !ok || s.income <= 0;
  }

  function renderBudget() {
    $('#income').value = state.settings.income;
    $$('#budget-grid input').forEach((i) => { i.value = state.settings.percents[i.dataset.cat]; });
    updateBudgetPreview();

    const r = PS.budget.report(state);
    $('#budget-status-title').textContent = U.monthLabel(r.key) + ' status';
    const rows = r.categories.map((c) => {
      const left = c.budget - c.spent;
      return `<tr>
        <td>${catCell(c)}</td>
        <td class="num">${m(c.budget)}</td>
        <td class="num">${m(c.spent)}</td>
        <td class="num ${left < 0 ? 'text-danger' : ''}">${m(left)}</td>
        <td class="num">${U.pct(c.pctOfBudget)}</td>
        <td>${statusBadge(c.status)}</td>
      </tr>`;
    });
    const savingsOk = r.expectedSavings >= r.savingsTarget;
    rows.push(`<tr class="row-total">
      <td>${catCell(PS.SAVINGS)} <span class="muted small">(expected)</span></td>
      <td class="num">${m(r.savingsTarget)}</td>
      <td class="num">${m(r.expectedSavings)}</td>
      <td class="num ${savingsOk ? '' : 'text-danger'}">${m(r.expectedSavings - r.savingsTarget)}</td>
      <td class="num">${U.pct(U.ratio(r.expectedSavings, r.savingsTarget))}</td>
      <td>${badge(savingsOk ? 'On target' : 'Below target', savingsOk ? 'success' : 'warning')}</td>
    </tr>`);
    $('#budget-body').innerHTML = rows.join('');
  }

  function setupBudget() {
    $('#budget-grid').innerHTML = PS.CATEGORIES.concat(PS.SAVINGS).map((c) => `
      <div class="pct-row${c.id === 'savings' ? ' pct-savings' : ''}">
        <span class="dot" style="background:${c.color}"></span>
        <label for="pct-${c.id}">${c.name}</label>
        <div class="pct-input">
          <input type="number" id="pct-${c.id}" data-cat="${c.id}" min="0" max="100" step="1">
          <span>%</span>
        </div>
        <span class="pct-amt" id="amt-${c.id}"></span>
      </div>`).join('');

    $('#budget-form').addEventListener('input', updateBudgetPreview);
    $('#budget-reset').addEventListener('click', () => {
      const d = PS.defaultPercents();
      $$('#budget-grid input').forEach((i) => { i.value = d[i.dataset.cat]; });
      updateBudgetPreview();
      toast('Default split restored. Click Save budget to apply.', 'info');
    });
    $('#budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const s = readBudgetForm();
      const total = Object.values(s.percents).reduce((a, b) => a + b, 0);
      if (s.income <= 0 || Math.abs(total - 100) >= 0.01) {
        toast('Income must be above ₹0 and percentages must add up to 100%.', 'error');
        return;
      }
      state.settings = s;
      commit('Budget saved.');
    });
  }

  // ---------- Goals ----------

  function renderGoals() {
    const monthly = PS.goals.monthlySavings(state);
    const evals = state.goals.map((g) => ({ g, e: PS.goals.evaluate(g, monthly) }));
    const needed = evals.filter((x) => x.e.status === 'on-track' || x.e.status === 'behind')
      .reduce((a, x) => a + x.e.requiredMonthly, 0);

    $('#goals-summary').innerHTML = state.goals.length
      ? `You're expected to save <strong>${m(monthly)}</strong> this month. Your active goals need <strong>${m(needed)}/month</strong> in total.`
      : '';

    $('#goal-list').innerHTML = evals.length ? evals.map(({ g, e }) => {
      const st = PS.goals.STATUS[e.status];
      let note;
      if (e.status === 'done') note = 'Goal reached. Well done!';
      else if (e.status === 'overdue') note = `The deadline has passed and ${m(e.remaining)} is still to go. Add a new goal with a later deadline.`;
      else if (e.status === 'on-track') note = `At about ${m(monthly)}/month you'll reach this goal on time.`;
      else if (monthly <= 0) note = 'Start saving each month to make progress on this goal.';
      else note = `You're ${m(e.requiredMonthly - monthly)}/month short. At this pace you'll reach it in ${U.monthLabel(e.finishKey)}.`;

      return `<div class="card goal">
        <div class="goal-head"><h3>${U.esc(g.name)}</h3>${badge(st.label, st.cls)}</div>
        <div class="goal-amount"><strong>${m(g.saved)}</strong><span class="muted"> of ${m(g.target)}</span></div>
        <div class="bar bar-lg"><span style="width:${e.progress}%;background:var(--primary)"></span></div>
        <div class="goal-meta">
          <div><span>Progress</span><strong>${U.pct(e.progress)}</strong></div>
          <div><span>Deadline</span><strong>${U.monthLabel(g.deadline, true)}</strong></div>
          <div><span>Months left</span><strong>${e.monthsLeft}</strong></div>
          <div><span>Needed / month</span><strong>${m(e.requiredMonthly)}</strong></div>
        </div>
        <p class="goal-note ${st.cls}">${U.esc(note)}</p>
        <form class="goal-add" data-goal="${g.id}">
          <input type="number" min="1" step="1" placeholder="Amount (₹)" aria-label="Amount to add">
          <button type="submit" class="btn btn-soft">Add money</button>
          <button type="button" class="icon-btn" data-del-goal="${g.id}" aria-label="Delete goal" title="Delete goal">${icon('trash')}</button>
        </form>
      </div>`;
    }).join('') : '<div class="card empty">No savings goals yet. Add your first goal above.</div>';
  }

  function setupGoals() {
    const cur = U.currentMonthKey();
    $('#goal-deadline').min = cur;
    $('#goal-deadline').value = U.addMonths(cur, 6);

    $('#goal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#goal-name').value.trim();
      const target = parseFloat($('#goal-target').value);
      const saved = parseFloat($('#goal-saved').value) || 0;
      const deadline = $('#goal-deadline').value;
      if (!name || !(target > 0) || saved < 0 || !deadline) {
        toast('Enter a goal name, a target above ₹0 and a deadline.', 'error');
        return;
      }
      if (deadline < cur) {
        toast('The deadline must be this month or later.', 'error');
        return;
      }
      state.goals.push({ id: U.uid(), name, target, saved: Math.min(saved, target), deadline });
      $('#goal-name').value = '';
      $('#goal-target').value = '';
      $('#goal-saved').value = '';
      commit(`Goal "${name}" added.`);
    });

    $('#goal-list').addEventListener('submit', (e) => {
      const form = e.target.closest('.goal-add');
      if (!form) return;
      e.preventDefault();
      const amount = parseFloat(form.querySelector('input').value);
      if (!(amount > 0)) {
        toast('Enter an amount above ₹0.', 'error');
        return;
      }
      const g = state.goals.find((x) => x.id === form.dataset.goal);
      g.saved = Math.min(g.target, g.saved + amount);
      commit(g.saved >= g.target ? `"${g.name}" completed!` : `Added ${m(amount)} to "${g.name}".`);
    });

    $('#goal-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del-goal]');
      if (!btn) return;
      state.goals = state.goals.filter((g) => g.id !== btn.dataset.delGoal);
      commit('Goal deleted.');
    });
  }

  // ---------- Settings ----------

  function renderSettings() {
    const months = new Set(state.transactions.map((t) => t.date.slice(0, 7))).size;
    $('#data-stats').textContent = `${state.transactions.length} transactions across ${months} month${months === 1 ? '' : 's'}, ${state.goals.length} savings goal${state.goals.length === 1 ? '' : 's'}. Data is saved in this browser's local storage.`;
  }

  function setupSettings() {
    $('#btn-demo').addEventListener('click', () => {
      if (!confirm('Replace all current data with the demo data?')) return;
      state = PS.sampleData();
      commit('Demo data loaded.');
    });
    $('#btn-clear').addEventListener('click', () => {
      if (!confirm('Delete all transactions, goals and budget settings?')) return;
      state = PS.emptyState();
      commit('All data cleared.');
    });
    $('#btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pocketsmart-data-' + U.todayISO() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const RENDER = {
    dashboard: renderDashboard,
    transactions: renderTransactions,
    budget: renderBudget,
    goals: renderGoals,
    settings: renderSettings
  };

  function init() {
    state = PS.store.load();
    const firstRun = !state;
    if (firstRun) {
      state = PS.sampleData();
      PS.store.save(state);
    }

    setupTransactions();
    setupBudget();
    setupGoals();
    setupSettings();
    PS.chat.init(() => state);
    fillSparks();

    $('#regen').addEventListener('click', () => renderInsight(true));
    $('#ai-summary').addEventListener('click', () => { if (insight.writer) insight.writer.finish(); });
    $('#quick-add').addEventListener('click', () => setTimeout(() => $('#tx-desc').focus(), 0));
    $('#ask-cut').addEventListener('click', () => {
      location.hash = '#assistant';
      PS.chat.send('Where can I cut spending this month?');
    });

    window.addEventListener('hashchange', route);
    route();
    if (firstRun) toast('Demo data loaded. You can clear it in Settings.', 'info');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

PS.charts = {
  donut(el, segments, label, value) {
    const U = PS.util;
    const total = segments.reduce((a, s) => a + s.value, 0);
    const r = 52;
    const c = 2 * Math.PI * r;
    let offset = 0;

    const arcs = total ? segments.map((s) => {
      const len = (s.value / total) * c;
      const gap = segments.length > 1 ? Math.min(1.5, len / 2) : 0;
      const arc = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="18"
        stroke-dasharray="${len - gap} ${c - len + gap}" stroke-dashoffset="${-offset}">
        <title>${U.esc(s.label)}: ${U.money(s.value)}</title></circle>`;
      offset += len;
      return arc;
    }).join('') : '';

    el.innerHTML = `<svg viewBox="0 0 140 140" class="donut-svg" role="img" aria-label="Spending by category">
      <g transform="rotate(-90 70 70)">
        <circle r="${r}" cx="70" cy="70" fill="none" stroke="#EEF2F7" stroke-width="18"/>${arcs}
      </g>
      <text x="70" y="64" text-anchor="middle" class="donut-label">${U.esc(label)}</text>
      <text x="70" y="84" text-anchor="middle" class="donut-value">${U.esc(value)}</text>
    </svg>`;
  },

  gauge(el, score, label, color) {
    const len = Math.PI * 50;
    el.innerHTML = `<svg viewBox="0 0 120 72" class="gauge-svg" role="img" aria-label="Financial health score ${score} out of 100">
      <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#EEF2F7" stroke-width="12" stroke-linecap="round"/>
      <path class="gauge-fill" d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${len}" stroke-dashoffset="${len}"/>
      <text x="60" y="54" text-anchor="middle" class="gauge-value">${score}</text>
      <text x="60" y="68" text-anchor="middle" class="gauge-max">out of 100</text>
    </svg>
    <span class="badge gauge-label" style="background:${color}1A;color:${color}">${PS.util.esc(label)}</span>`;
    const fill = el.querySelector('.gauge-fill');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.strokeDashoffset = len * (1 - Math.min(100, Math.max(0, score)) / 100);
    }));
  },

  columns(el, items, reference) {
    const U = PS.util;
    const max = Math.max(reference || 0, ...items.map((i) => i.value), 1);
    const ref = reference
      ? `<div class="cols-ref" style="bottom:${(reference / max) * 100}%"><span>Income ${U.money(reference)}</span></div>`
      : '';

    el.innerHTML = `<div class="cols">
      <div class="cols-area">${ref}
        ${items.map((i) => `<div class="col">
          <div class="col-bar${i.forecast ? ' forecast' : ''}${i.current ? ' current' : ''}" style="height:${(i.value / max) * 100}%">
            <span class="col-val">${U.money(i.value)}</span>
          </div></div>`).join('')}
      </div>
      <div class="cols-labels">
        ${items.map((i) => `<span>${U.esc(i.label)}${i.forecast ? '<em>Forecast</em>' : ''}${i.current ? '<em>This month</em>' : ''}</span>`).join('')}
      </div>
    </div>`;
  }
};

window.PS = window.PS || {};

PS.util = (function () {
  const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  function money(n) {
    const v = Math.round(n || 0);
    return (v < 0 ? '-₹' : '₹') + inr.format(Math.abs(v));
  }

  function pct(n) {
    return Math.round(n || 0) + '%';
  }

  function ratio(part, whole) {
    return whole ? (part / whole) * 100 : 0;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d || 1);
  }

  function todayISO() {
    return toISO(new Date());
  }

  function currentMonthKey() {
    return todayISO().slice(0, 7);
  }

  function addMonths(key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function monthDiff(fromKey, toKey) {
    const [fy, fm] = fromKey.split('-').map(Number);
    const [ty, tm] = toKey.split('-').map(Number);
    return (ty - fy) * 12 + (tm - fm);
  }

  function daysInMonth(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function monthLabel(key, short) {
    return parseISO(key + '-01').toLocaleDateString('en-IN', {
      month: short ? 'short' : 'long',
      year: 'numeric'
    });
  }

  function dateLabel(iso) {
    return parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round(n, step) {
    return Math.round(n / step) * step;
  }

  function listJoin(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  return {
    money, pct, ratio, toISO, parseISO, todayISO, currentMonthKey, addMonths,
    monthDiff, daysInMonth, monthLabel, dateLabel, esc, uid, round, listJoin
  };
})();

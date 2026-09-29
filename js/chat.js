PS.chat = (function () {
  const SUGGESTIONS = [
    'Where can I cut spending this month?',
    'Am I overspending anywhere?',
    'Predict my next month expenses',
    'Show my financial health score',
    'Any unusual transactions?',
    'Can I spend ₹2,000 on shopping?'
  ];

  const STEP_MS = 420;
  const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.1 6.1 6.4 2.4-6.4 2.4L12 19.5l-2.1-6.1L3.5 11l6.4-2.4z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  let getState;
  let log;
  let input;
  let queue = Promise.resolve();

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function userMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `<div class="bubble">${PS.util.esc(text)}</div>`;
    log.appendChild(el);
    scrollDown();
  }

  function botMessage() {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = `<span class="avatar">${SPARK}</span><div class="msg-body"><div class="bubble"></div></div>`;
    log.appendChild(el);
    scrollDown();
    return el;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function think(bubble, steps) {
    bubble.classList.add('thinking');
    bubble.innerHTML = '<ul class="think-steps"></ul>';
    const list = bubble.firstChild;
    for (const step of steps) {
      const prev = list.lastElementChild;
      if (prev) {
        prev.classList.replace('active', 'done');
        prev.querySelector('.think-icon').innerHTML = CHECK;
      }
      const li = document.createElement('li');
      li.className = 'active';
      li.innerHTML = `<span class="think-icon"><span class="spinner"></span></span>${PS.util.esc(step)}…`;
      list.appendChild(li);
      scrollDown();
      await wait(STEP_MS);
    }
    bubble.classList.remove('thinking');
  }

  function stream(bubble, html) {
    return new Promise((resolve) => {
      const writer = PS.typewriter(bubble, html, { onProgress: scrollDown, onDone: resolve });
      bubble.addEventListener('click', writer.finish, { once: true });
    });
  }

  function showFollowUps(msg, followUps) {
    if (!followUps.length) return;
    const box = document.createElement('div');
    box.className = 'followups';
    box.innerHTML = followUps.map((f) => `<button type="button" class="chip chip-sm">${PS.util.esc(f)}</button>`).join('');
    msg.querySelector('.msg-body').appendChild(box);
    scrollDown();
  }

  function send(text) {
    const q = (text || '').trim();
    if (!q) return;
    input.value = '';
    queue = queue.then(async () => {
      log.querySelectorAll('.followups').forEach((f) => f.remove());
      userMessage(q);
      const reply = PS.ai.respond(getState(), q);
      const msg = botMessage();
      const bubble = msg.querySelector('.bubble');
      await think(bubble, reply.steps);
      await stream(bubble, reply.html);
      showFollowUps(msg, reply.followUps);
    });
  }

  function init(stateGetter) {
    getState = stateGetter;
    log = document.getElementById('chat-log');
    input = document.getElementById('chat-input');

    const chips = document.getElementById('chat-chips');
    chips.innerHTML = SUGGESTIONS.map((s) => `<button type="button" class="chip">${PS.util.esc(s)}</button>`).join('');
    chips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) send(chip.textContent);
    });
    log.addEventListener('click', (e) => {
      const chip = e.target.closest('.followups .chip');
      if (chip) send(chip.textContent);
    });
    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      send(input.value);
    });

    const welcome = botMessage();
    welcome.querySelector('.bubble').innerHTML = PS.ai.fmt(
      "Hi! I'm **PocketSmart AI**, your budget assistant. I've analysed your transactions, budget and goals. Ask me where to cut spending, whether anything looks unusual, what next month will cost, or how healthy your finances are."
    );
  }

  return { init, send, SPARK };
})();

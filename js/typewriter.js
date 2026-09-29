// Reveals HTML word by word, like a streamed AI response.
PS.typewriter = function (el, html, opts) {
  const options = Object.assign({ speed: 22 }, opts);
  el.innerHTML = html;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const items = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    items.push({ node, tokens: node.textContent.match(/\S+\s*|\s+/g) || [] });
  }
  items.forEach((it) => { it.node.textContent = ''; });

  const blocks = Array.from(el.querySelectorAll('p, li, ul, ol'));
  blocks.forEach((b) => b.classList.add('tw-hidden'));

  const cursor = document.createElement('span');
  cursor.className = 'tw-cursor';

  let i = 0;
  let j = 0;
  let done = false;

  function reveal(node) {
    for (let p = node.parentNode; p && p !== el; p = p.parentNode) p.classList.remove('tw-hidden');
  }

  function finish() {
    if (done) return;
    done = true;
    clearInterval(timer);
    items.forEach((it) => { it.node.textContent = it.tokens.join(''); });
    blocks.forEach((b) => b.classList.remove('tw-hidden'));
    cursor.remove();
    if (options.onDone) options.onDone();
  }

  function step() {
    while (i < items.length && !items[i].tokens.join('').trim()) {
      items[i].node.textContent = items[i].tokens.join('');
      i++;
    }
    if (i >= items.length) return finish();

    const it = items[i];
    if (j === 0) reveal(it.node);
    it.node.textContent += it.tokens[j++];
    it.node.parentNode.insertBefore(cursor, it.node.nextSibling);
    if (j >= it.tokens.length) { i++; j = 0; }
    if (options.onProgress) options.onProgress();
  }

  const timer = setInterval(step, options.speed);
  return { finish, isDone: () => done };
};

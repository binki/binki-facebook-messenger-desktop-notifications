// Nathan Phillip Brink (binki) (@ohnobinki)
(async () => {
  // Immediately ask for notification permission if we don’t have it yet and it’s not denied.
  if (Notification.permission === 'default') await Notification.requestPermission();
  // In case the user denied it but changes their mind later, just run our stuff anyway.
  const whenMutatedAsync = (() => {
    const last = new Map();
    return (selector) => {
      if (!last.has(selector)) {
        last.set(selector, new Promise(resolve => {
          new MutationObserver((mutations, observer) => {
            last.delete(selector);
            resolve();
            observer.disconnect();
          }).observe(document.querySelector(selector), {
            subtree: true,
            childList: true,
          });
        }));
      }
      return last.get(selector);
    };
  })();
  const delayAsync = (ms) => new Promise(resolve => {
    setTimeout(resolve, ms);
  });
  const getThreadInfos = () => {
    const dict = new Map();
    for (const threadElement of document.querySelectorAll('div[data-testid=MWJewelThreadListContainer] div[data-testid=mwthreadlist-item] a > div > div:nth-child(2)')) {
      const name = document.querySelector('span > span', threadElement).textContent;
      const message = document.querySelector('div > div:nth-child(2) div:nth-child(2) > span[dir=auto] span > span', threadElement).textContent;
      const key = `${name}> ${message}`;
      dict.set(key, {
        elem: threadElement,
      });
    }
    return dict;
  };
  let lastThreadInfos = getThreadInfos();
  while (true) {
    await whenMutatedAsync('div[data-testid=MWJewelThreadListContainer]');
    // Give a short delay so that other mutations can happen without a handler being installed.
    await delayAsync(100);
    const newThreadInfos = getThreadInfos();
    for (const [newThreadKey, newThreadInfo] of newThreadInfos) {
      if (!lastThreadInfos.has(newThreadKey)) {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission !== 'granted') continue;
        const notification = new Notification('Messenger', {
          body: newThreadKey,
          icon: 'https://static.xx.fbcdn.net/rsrc.php/yQ/r/mPS7QGFKKuf.ico',
        });
        notification.addEventListener('click', () => {
          newThreadInfo.elem.click();
        });
      }
    }
    lastThreadInfos = newThreadInfos;
  }
})();
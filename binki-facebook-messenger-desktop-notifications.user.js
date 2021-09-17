// ==UserScript==
// @name     binki-facebook-messenger-desktop-notifications
// @version  1.5
// @grant    none
// @author   Nathan Phillip Brink (binki) (@ohnobinki)
// @homepageURL https://github.com/binki/binki-facebook-messenger-desktop-notifications/
// @include  https://www.messenger.com/*
// @include  https://messenger.com/*
// ==/UserScript==
(async () => {
  // Immediately ask for notification permission if we don’t have it yet and it’s not denied.
  if (Notification.permission === 'default') await Notification.requestPermission();
  // In case the user denied it but changes their mind later, just run our stuff anyway.
  const whenMutatedAsync = (() => {
    return (target) => {
      return new Promise(resolve => {
        new MutationObserver((mutations, observer) => {
          resolve();
          observer.disconnect();
        }).observe(target, {
          subtree: true,
          childList: true,
        });
      });
    };
  })();
  const delayAsync = (ms) => new Promise(resolve => {
    setTimeout(resolve, ms);
  });
  // Wait for the ThreadListContainer to show up.
  const threadListContainerSelector = 'div[data-testid=MWJewelThreadListContainer]';
  while (!document.querySelector(threadListContainerSelector)) {
    await whenMutatedAsync(document.body);
    await delayAsync(100);
  }
  const getThreadInfos = () => {
    const dict = new Map();
    for (const threadElement of document.querySelectorAll(`${threadListContainerSelector} div[data-testid=mwthreadlist-item] a > div > div:nth-child(2)`)) {
      const name = threadElement.querySelector('span > span').textContent;
      const message = threadElement.querySelector('div > div:nth-child(2) div:nth-child(2) > span[dir=auto] span > span').textContent;
      const image = threadElement.parentElement.querySelector('svg').childNodes[1].childNodes[0].href.baseVal;
      const key = `${name}> ${message}`;
      dict.set(key, {
        image: image,
        elem: threadElement,
        rank: dict.size,
      });
    }
    return dict;
  };
  let lastThreadInfos = getThreadInfos();
  const threadListContainer = document.querySelector('div[data-testid=MWJewelThreadListContainer]');
  while (true) {
    await whenMutatedAsync(threadListContainer);
    // Give a short delay so that other mutations can happen without a handler being installed.
    await delayAsync(100);
    const newThreadInfos = getThreadInfos();
    for (const [newThreadKey, newThreadInfo] of newThreadInfos) {
      // If the user resizes the window, more things are loaded. For that reason, ignore anything beyond the first 4 threads
      // since all new stuff should be mostly up there anyway unless we’re terribly behind which… we don’t really
      // support anyway, especially since we can’t even tell yet if a conversation is muted.
      if (newThreadInfo.rank < 4 && !lastThreadInfos.has(newThreadKey)) {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission !== 'granted') continue;
        const notification = new Notification('Messenger', {
          body: newThreadKey,
          icon: newThreadInfo.image || 'https://static.xx.fbcdn.net/rsrc.php/yQ/r/mPS7QGFKKuf.ico',
        });
        notification.addEventListener('click', () => {
          newThreadInfo.elem.click();
        });
      }
    }
    lastThreadInfos = newThreadInfos;
  }
})();

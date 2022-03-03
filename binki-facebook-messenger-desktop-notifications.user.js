// ==UserScript==
// @name     binki-facebook-messenger-desktop-notifications
// @version  1.7
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
          characterData: true,
          childList: true,
          subtree: true,
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
    for (const threadElement of document.querySelectorAll(`${threadListContainerSelector} div[data-testid=mwthreadlist-item-open] a > div > div:nth-child(1)`)) {
      const name = threadElement.querySelector('span > span').textContent;
      const message = threadElement.querySelector('div > div:nth-child(2) div[class]:not(:nth-child(1)) > span[dir=auto] > span').textContent;
      const image = (() => {
        // Group conversations have multiple images stacked using CSS (rather than SVG).
        const groupImages = threadElement.parentElement.querySelectorAll('div[role=img] img');
        // TODO: Make a composite image from all of them (would be so nice x.x).
        if (groupImages[0]) return groupImages[0].src;
        // Otherwise, not a group conversation.
        return threadElement.parentElement.querySelector('svg').childNodes[1].childNodes[0].href.baseVal;
      })();
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
        // Do not notify if the focus is within the document. Note that this will only be true if
        // a text/input field is selected. This is the behavior that I (binki) wants—other things
        // like visibility API will tell you that the page is visible even when a different window
        // is focused.
        if (document.querySelector('body:focus-within')) continue;
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

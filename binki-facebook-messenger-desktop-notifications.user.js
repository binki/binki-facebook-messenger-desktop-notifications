// ==UserScript==
// @name     binki-facebook-messenger-desktop-notifications
// @version  1.11
// @grant    none
// @author   Nathan Phillip Brink (binki) (@ohnobinki)
// @homepageURL https://github.com/binki/binki-facebook-messenger-desktop-notifications/
// @include  https://www.messenger.com/*
// @include  https://messenger.com/*
// @require https://github.com/binki/binki-userscript-delay-async/raw/252c301cdbd21eb41fa0227c49cd53dc5a6d1e58/binki-userscript-delay-async.js
// @require https://github.com/binki/binki-userscript-when-element-changed-async/raw/88cf57674ab8fcaa0e86bdf5209342ec7780739a/binki-userscript-when-element-changed-async.js
// ==/UserScript==
(async () => {
  // Immediately ask for notification permission if we don’t have it yet and it’s not denied.
  if (Notification.permission === 'default') await Notification.requestPermission();
  // In case the user denied it but changes their mind later, just run our stuff anyway.

  // Wait for the ThreadListContainer to show up. However, it doesn’t have a proper name
  // these days. So instead we have to find an example of a conversation and then just grab
  // its parent.
  const threadListContainerChildSelector = 'div[data-testid=mwthreadlist-item-open]';
  while (!document.querySelector(threadListContainerChildSelector)) {
    await whenElementChangedAsync(document.body);
    await delayAsync(100);
  }
  const getThreadInfos = () => {
    const dict = new Map();
    for (const threadElement of document.querySelectorAll(`${threadListContainerChildSelector} a > div > div:nth-child(1)`)) {
      const nameElement = threadElement.querySelector('span > span');
      const messageElement = threadElement.querySelector('div > div:nth-child(2) div[class]:not(:nth-child(1)) > span[dir=auto] > span');
      // We might be in the middle of a render.
      if (!nameElement || !messageElement) {
        console.log(`Unable to find one of nameElement or messageElement. Assuming mid-render.`);
        continue;
      }
      const name = nameElement.textContent;
      const message = messageElement.textContent;
      const image = (() => {
        // Group conversations have multiple images stacked using CSS (rather than SVG).
        const groupImages = threadElement.parentElement.querySelectorAll('div[role=img] img');
        // TODO: Make a composite image from all of them (would be so nice x.x).
        if (groupImages[0]) return groupImages[0].src;
        // Otherwise, not a group conversation.
        return (((threadElement.parentElement.querySelector('svg') || {childNodes: []}).childNodes[1] || {childNodes: []}).childNodes[0] || {href:{}}).href.baseVal;
      })();
      if (!image) {
        console.log(`Unable to find image. Assuming mid-render.`);
        continue;
      }
      const statusIconsElement = threadElement.querySelector(':scope > div:nth-child(3) > div > div');
      if (!statusIconsElement) {
        console.log('Unable to find statusIconsElement. Assuming mid-render.', threadElement);
        continue;
      }
      const muted = !!statusIconsElement.querySelector(':scope > svg:nth-child(1)');
      const text = `${name}> ${message}`;
      const key = `${muted ? 'm' : ''}/${text}`;
      dict.set(key, {
        image: image,
        elem: threadElement,
        muted,
        rank: dict.size,
        text,
      });
    }
    return dict;
  };
  let lastThreadInfos = getThreadInfos();
  const threadListContainer = document.querySelector(threadListContainerChildSelector).parentElement;
  while (true) {
    await whenElementChangedAsync(threadListContainer);
    // Give a short delay so that other mutations can happen without a handler being installed.
    await delayAsync(100);
    const newThreadInfos = getThreadInfos();
    for (const [newThreadKey, newThreadInfo] of newThreadInfos) {
      // If the user resizes the window, more things are loaded. For that reason, ignore anything beyond the first 4 threads
      // since all new stuff should be mostly up there anyway unless we’re terribly behind which… we don’t really
      // support anyway, especially since we can’t even tell yet if a conversation is muted.
      if (newThreadInfo.rank < 4 && !lastThreadInfos.has(newThreadKey) && !newThreadInfo.muted) {
        if (Notification.permission === 'default') await Notification.requestPermission();
        // Do not notify if the focus is within the document. Note that this will only be true if
        // a text/input field is selected. This is the behavior that I (binki) wants—other things
        // like visibility API will tell you that the page is visible even when a different window
        // is focused.
        if (document.querySelector('body:focus-within')) continue;
        if (Notification.permission !== 'granted') continue;
        const notification = new Notification('Messenger', {
          body: newThreadInfo.text,
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

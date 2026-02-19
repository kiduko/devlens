// Runs in MAIN world to intercept fetch/XHR for m3u8/mpd stream URLs.
// Communicates with content.js via window.postMessage.

(function () {
  const push = (url) => {
    try { window.postMessage({ __devlens_stream: url }, '*'); } catch {}
  };

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (url && (url.includes('.m3u8') || url.includes('.mpd') || url.includes('manifest'))) push(url);
    return origFetch.apply(this, args);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (url && (url.includes('.m3u8') || url.includes('.mpd') || url.includes('manifest'))) push(url);
    return origOpen.apply(this, arguments);
  };
})();

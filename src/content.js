
var ExtID = chrome.extension.getURL('').match(/chrome-extension:\/\/([^\/]+)\//)[1];

document.addEventListener('DOMNodeInserted', handleInsert, false);
document.addEventListener('DOMAttrChanged', handleAttrChange, false);
(function() {
  var imgs = document.images;
  for (var i = 0; i < imgs.length; i++) {
    pauseAnimation(imgs[i]);
  }
})()

function handleInsert(ev) {
  ev.stopPropagation();
  setTimeout(function() {
    var node = ev.target;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === 'IMG' || node.nodeName === 'img') {
        pauseAnimation(node);
      } else {
        var imgs = node.getElementsByTagName('img');
        for (var i = 0; i < imgs.length; i++) {
          pauseAnimation(imgs[i]);
        }
      }
    }
  }, 10);
}

function handleAttrChange(ev) {
  ev.stopPropagation();
  setTimeout(function() {
    var node = ev.target;
    if (node.nodeName === 'IMG' || node.nodeName === 'img') {
      pauseAnimation(node);
    }
  }, 10);
}

function pauseAnimation(img) {
  if (!/^https?:\/\/.*\.gif\b/.test(img.src) || img.src === img.getAttribute('data-original-src')) return;

  img.setAttribute('data-original-src', img.src);
  chrome.extension.sendRequest(ExtID, img.src, function(res) {
    if (img.parentNode &&  // if img is still in the document
        res.lastIndexOf('ERROR: ', 0) !== 0) { // if no error occurred
      img.src = res;

      img.addEventListener('click', handleClick, false);
    } else { // release (probably not necessary)
      img = null;
    }
  });
}

function handleClick(ev) {
  ev.preventDefault();
  var img = ev.target;
  startAnimation(img);
  img.removeEventListener('click', handleClick, false);
}

function startAnimation(img) {
  img.src = img.getAttribute('data-original-src');
  img.removeAttribute('data-original-src');
}


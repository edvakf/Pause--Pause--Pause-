var ExtID = chrome.extension.getURL('').match(/chrome-extension:\/\/([^\/]+)\//)[1];

document.addEventListener('DOMNodeInserted', handleInsert, false);
document.addEventListener('DOMAttrChanged', handleAttrChange, false);
(function() {
  var imgs = document.images;
  for (var i = 0; i < imgs.length; i++) {
    pauseAnimationImg(imgs[i]);
  }
  var sheets = document.styleSheets;
  for (var i = 0; i < sheets.length; i++) {
    var rules = sheets[i].cssRules;
    if (!rules) { // cross origin request
      pauseAnimationCSS(sheets[i]);
      continue;
    }
    for (var j = 0; j < rules.length; j++) {
      var style = rules[j].style;
      for (var k = 0; k < style.length; k++) {
        var dec = style[k];
        if (/url\(\s*(\S+)\s*\)/.test(style[dec])) {
          var url = RegExp.$1;
          if (url.lastIndexOf('data:',0) !== 0 && !/\.(?:jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/.test(url)) {
            pauseAnimationStyleRule(style, dec, url);
          }
        }
      }
    }
  }
})()

function handleInsert(ev) {
  ev.stopPropagation();
  setTimeout(function() {
    var node = ev.target;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === 'IMG' || node.nodeName === 'img') {
        pauseAnimationImg(node);
      } else {
        var imgs = node.getElementsByTagName('img');
        for (var i = 0; i < imgs.length; i++) {
          pauseAnimationImg(imgs[i]);
        }
      }
    }
  }, 50);
}

function handleAttrChange(ev) {
  ev.stopPropagation();
  setTimeout(function() {
    var node = ev.target;
    if (node.nodeName === 'IMG' || node.nodeName === 'img') {
      pauseAnimationImg(node);
    }
  }, 50);
}

function pauseAnimationImg(img) {
  //console.log(img);
  if (/^http:\/\/.*\.(jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/.test(img.src) || img.src === img.getAttribute('data-original-src')) return;

  img.setAttribute('data-original-src', img.src);
  chrome.extension.sendRequest(ExtID, {type: 'img', src: img.src}, function(res) {
    //console.log([img.src, res]);
    if (img.parentNode) {  // if img is still in the document
      if (res.error) {
        img.removeAttribute('data-original-src');
      } else {
        img.src = res.dataUrl;
        img.addEventListener('click', handleClick, false);
      }
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

function pauseAnimationStyleRule(style, dec, url) {
  var a = document.createElement('a');
  a.setAttribute('href', url);

  chrome.extension.sendRequest(ExtID, {type: 'img', src: a.href} , function(res) {
    //console.log(res);
    if (res.error) { // if an error occurred
      //
    } else {
      style[dec] = style[dec].replace(new RegExp('url\\(\\s*'+url.replace(/\W/g,'\\$&')+'\\s*\\)', 'g'), 'url('+res.dataUrl+')');
    }
  });
}

function pauseAnimationCSS(sheet) {
  var a = document.createElement('a');
  a.setAttribute('href',sheet.href);

  var base = document.querySelector('base');
  if (base) base = base.href;
  else base = location.href.replace(/\?.*/,'').replace(/\/[^\/]*$/, '/');

  chrome.extension.sendRequest(ExtID, {type:'css', src:a.href, baseUrl: base}, function(res) {
    //console.log(res);
    var node = sheet.ownerNode;
    if (node && node.parentNode) {
      if (res.error) { // if an error occurred
        //
      } else {
        var style = document.createElement('style');
        style.textContent = res.cssText;
        node.parentNode.insertBefore(style, node.nextSibling);
      }
    }
  });
}

chrome.extension.onRequest.addListener(function(url, sender, response) {
  request(
    url,
    function(xhr) { // callback
      try {
        var singleImageSrc = getSingleImage(xhr);
        response(singleImageSrc);
      } catch(e) {
        console.log(e);
        response('ERROR: ' + e);
      }
    },
    function() { // errorback
      response('ERROR: Failed loading image.');
    }
  )
});

function request(url, callback, errorback) {
  var xhr = new XMLHttpRequest;
  xhr.open('GET', url, true);

  //XHR binary charset opt by Marcus Granado 2006 [http://mgran.blogspot.com]
  xhr.overrideMimeType('text/plain; charset=x-user-defined');

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        callback && callback(xhr);
      } else {
        errorback && errorback(xhr);
      }
    }
  }

  xhr.send(null);
}

function getSingleImage(xhr) {
  var type = xhr.getResponseHeader('Content-Type');
  var body = xhr.responseText.replace(/[\u0100-\uffff]/g, function(c){ 
    // remove undesiredly upper byte that jumped in during parsing binary as UTF-16 text
    return String.fromCharCode(c.charCodeAt(0) & 0xff);
  });

  if (type === 'image/gif') {
    // http://www.tohoho-web.com/wwwgif.htm
    // Animated GIF goes like
    //  - Gif Header starts with 'GIF89a', then follows 7-775 Bytes
    //  - Application Extension starts with 0x21 0xff 0x0b 
    //    then 'NETSCAPE2.0'
    //    then the Block Size #2 (1 Byte)
    //    then 0x01 
    //    then number of loops (2 Bytes)
    //    then the Block Terminator 0x00
    //  - Graphic Control starts with 0x21 0xf9, then 5 Bytes, then 0x00
    //    Image Block starts with 0x2c, then ends with 0x00
    //  - Graphic Control and Image Block repeats
    //  - Trailer 0x3b
    //
    // Normal GIF have neither the Application Extension nor the repeating part

    if (/^(GIF89a[\s\S]{7,775})(\x21\xff\x0bNETSCAPE2\.0[\s\S]\x01[\s\S]{2}\0)(\x21\xf9[\s\S]{5}\0)(\x2c[\s\S]*?\0)(\x21\xf9)/.test(body)) {
      var nonAnimatedGif = [
        RegExp.$1, // Gif Header
        RegExp.$3, // Graphic Control
        RegExp.$4, // Image Block
        String.fromCharCode(0x3b)  // ";"
      ].join('');

      var dataURL = 'data:image/gif;base64,' + btoa(nonAnimatedGif);
      //console.log(dataURL);
      return dataURL;
    } else {
      throw new Error('The GIF image is not animated.');
    }
  }
  throw new Error('ERROR: Image is not an animatable format.');
}


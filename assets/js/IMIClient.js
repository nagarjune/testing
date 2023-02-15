const JS_SDK_VERSION = "1.5.2.032";
if (typeof Function.prototype.bind === "undefined") {
  Function.prototype.bind = function (thisArg) {
    var fn = this,
      slice = Array.prototype.slice,
      args = slice.call(arguments, 1);
    return function () {
      return fn.apply(thisArg, args.concat(slice.call(arguments)));
    };
  };
}

Date.prototype.toUTCArray = function () {
  var D = this;
  return [
    D.getUTCFullYear(),
    D.getUTCMonth(),
    D.getUTCDate(),
    D.getUTCHours(),
    D.getUTCMinutes(),
    D.getUTCSeconds(),
  ];
};

Date.prototype.toISO = function () {
  var tem,
    A = this.toUTCArray(),
    i = 0;
  A[1] += 1;
  while (i++ < 7) {
    tem = A[i];
    if (tem < 10) A[i] = "0" + tem;
  }
  return A.splice(0, 3).join("-") + "T" + A.join(":");
};

function IMIClientStorage(namespace) {
  "use strict";
  var _db = {
    namespace: namespace,
    _get: function (key) {
      return localStorage.getItem(namespace + key);
    },
    get: function (key) {
      var obj = null;
      var raw = this._get(key);
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        IMI.log("caught exception in _db.get(" + key + "): " + e);
      }
      return obj;
    },
    _set: function (key, value) {
      localStorage.setItem(namespace + key, value);
    },
    set: function (key, value) {
      try {
        var stringified = JSON.stringify(value);
        this._set(key, stringified);
      } catch (e) {
        IMI.log("caught exception in _db.set(" + key + "): " + e);
      }
    },
    remove: function (key) {
      localStorage.removeItem(namespace + key);
      if (this.encryptDB) {
        localStorage.removeItem(namespace + key + "_hash");
      }
    },
    /* Remove a list of values from local storage.
     */
    removeAll: function (keys) {
      var self = this;
      if (keys) {
        $.each(keys, function (index, key) {
          self.remove(key);
          if (self.encryptDB) {
            self.remove(key + "_hash");
          }
        });
      }
    },
    generateMessageId: function (msg) {
      return [msg.getType(), msg.getDeviceId(), msg.getTransactionId()].join(
        "_"
      );
    },
    setTransId: function (msg) {
      try {
        var transId = this.generateMessageId(msg);
        var transIds = sessionStorage.getItem("transIds");
        if (transIds) {
          transIds = JSON.parse(transIds);
          if (transIds.length >= 500) {
            transIds.shift();
          }
        } else {
          transIds = [];
        }
        if (transIds.indexOf(transId) === -1) {
          transIds.push(transId);
          sessionStorage.setItem("transIds", JSON.stringify(transIds));
        }
      } catch (error) { }
    },
    getTransIds: function () {
      var transIds = [];
      try {
        transIds = sessionStorage.getItem("transIds");
        if (transIds) {
          transIds = JSON.parse(transIds);
        } else {
          transIds = [];
        }
      } catch (error) { }
      return transIds;
    },
    isDuplicateMessage: function (msg) {
      var transIds = this.getTransIds();
      var messageTransId = _db.generateMessageId(msg);
      return transIds.indexOf(messageTransId) !== -1;
    },
  };
  return _db;
}

var isLogEnabled = false;

var IMI = IMI || {
  extend: function (parent, child) {
    var i;
    child = child || {};
    for (i in parent) {
      if (parent.hasOwnProperty(i)) {
        child[i] = parent[i];
      }
    }
    return child;
  },
  namespace: function (ns_string) {
    var parts = ns_string.split("."),
      parent = IMI,
      i;
    // strip redundant leading global
    if (parts[0] === "IMI") {
      parts = parts.slice(1);
    }

    for (i = 0; i < parts.length; i += 1) {
      // create a property if it doesn't exist
      if (typeof parent[parts[i]] === "undefined") {
        parent[parts[i]] = {};
      }
      parent = parent[parts[i]];
    }

    return parent;
  },
  isString: function (s) {
    return typeof s === "string";
  },
  isObject: function (obj) {
    return typeof obj === "object";
  },
  isArray: function (obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  },
  isNumber: function (n) {
    return typeof n === "number";
  },
  defined: function (obj) {
    return typeof obj !== "undefined" && obj !== null && obj !== "";
  },
  isFunction: function (fun) {
    return fun && typeof fun === "function";
  },
  parseDate: function (dateObj) {
    var dateStr = "";
    try {
      if (dateObj instanceof String) {
        return dateObj;
      }
      dateStr = dateObj.toJSON();
    } catch (ex) {
      IMI.log(ex);
    }
    return dateStr;
  },
  getDate: function (strDate) {
    var dateStr = "";
    try {
      dateStr = new Date(strDate);
    } catch (ex) {
      IMI.log(ex);
    }
    return dateStr;
  },
  Post: function (url, reqdata, headers, callback) {
    var self = this;
    try {
      self.callMethod(url, "POST", reqdata, headers, callback);
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  Put: function (url, reqdata, headers, callback) {
    var self = this;
    try {
      self.callMethod(url, "PUT", reqdata, headers, callback);
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  Get: function (url, queryParam, headers, callback) {
    var self = this;
    try {
      self.callMethod(url, "GET", queryParam, headers, callback);
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  callMethod: function (url, method, data, headers, callback) {
    var self = this;
    try {
      var cbck = {};
      callback = callback || {};
      if (typeof callback === "function") {
        cbck.onSuccess = callback;
        cbck.onFailure = callback;
      } else {
        cbck.onSuccess =
          callback.onSuccess ||
          function (data) {
            IMI.log("onSuccess", data);
          };
        cbck.onFailure =
          callback.onFailure ||
          function (data) {
            IMI.log("onFailure", data);
          };
      }
      self.HttpAjaxCall(
        url,
        method,
        data,
        headers,
        cbck.onSuccess,
        cbck.onFailure
      );
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  //using ajax..
  HttpAjaxCall: function (url, method, data, headers, succes, errback) {
    headers = headers || {};
    $.ajax({
      url: url,
      type: method,
      headers: headers,
      data: data,
      success: function (resrmsg) {
        succes(resrmsg);
      },
      error: function (responseData, textStatus, errorThrown) {
        errback(responseData);
        IMI.log(errorThrown);
      },
    });
  },
  getBrowserName: function () {
    try {
      var ua = navigator.userAgent,
        tem,
        M =
          ua.match(
            /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
          ) || [],
        isiOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var browser = navigator.appName;
      var nameOffset, verOffset;
      if (ua.indexOf("Opera") !== -1) {
        browser = "Opera";
      }
      if (ua.indexOf('"CriOS"') !== -1) {
        browser = "chrome";
      } else if (ua.indexOf("OPR") !== -1) {
        // Opera Next
        browser = "Opera";
      }
      // Edge
      else if (ua.indexOf("Edge") !== -1) {
        browser = "MicrosoftEdge";
      }
      // MSIE
      else if (ua.indexOf("MSIE") !== -1) {
        browser = "IE";
      }
      // Chrome
      else if (ua.indexOf("Chrome") !== -1) {
        browser = "Chrome";
      }
      // Safari
      else if (ua.indexOf("Safari") !== -1) {
        browser = "Safari";
      }
      // Firefox
      else if (ua.indexOf("Firefox") !== -1) {
        browser = "Firefox";
      }
      // MSIE 11+
      else if (ua.indexOf("Trident/") !== -1) {
        browser = "IE";
      } else if (
        (nameOffset = ua.lastIndexOf(" ") + 1) <
        (verOffset = ua.lastIndexOf("/"))
      ) {
        browser = ua.substring(nameOffset, verOffset);
        if (browser.toLowerCase() == browser.toUpperCase()) {
          browser = navigator.appName;
        }
      }
      return browser.toLowerCase();
    } catch (ex) {
      IMI.log(ex);
    }
  },
  getbrowserVersion: function () {
    try {
      var ua = navigator.userAgent,
        tem,
        M =
          ua.match(
            /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
          ) || [],
        isiOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var verOffset;
      var version = "" + parseFloat(navigator.appVersion),
        nameOffset,
        ix;

      if ((verOffset = ua.indexOf("Opera")) !== -1) {
        version = ua.substring(verOffset + 6);
        if ((verOffset = ua.indexOf("Version")) !== -1) {
          version = ua.substring(verOffset + 8);
        }
      }
      //CriOS chrome in iphone
      if ((verOffset = ua.indexOf("CriOS")) !== -1) {
        version = ua.substring(verOffset + 6);
      }
      // Opera Next
      else if ((verOffset = ua.indexOf("OPR")) !== -1) {
        version = ua.substring(verOffset + 4);
      }
      // Edge
      else if ((verOffset = ua.indexOf("Edge")) !== -1) {
        version = ua.substring(verOffset + 5);
      }
      // MSIE
      else if ((verOffset = ua.indexOf("MSIE")) !== -1) {
        version = ua.substring(verOffset + 5);
      }
      // Chrome
      else if ((verOffset = ua.indexOf("Chrome")) !== -1) {
        version = ua.substring(verOffset + 7);
      }
      // Safari
      else if ((verOffset = ua.indexOf("Safari")) !== -1) {
        version = ua.substring(verOffset + 7);
        if ((verOffset = ua.indexOf("Version")) !== -1) {
          version = ua.substring(verOffset + 8);
        }
      }
      // Firefox
      else if ((verOffset = ua.indexOf("Firefox")) != -1) {
        version = ua.substring(verOffset + 8);
      }
      // MSIE 11+
      else if (ua.indexOf("Trident/") != -1) {
        version = ua.substring(ua.indexOf("rv:") + 3);
      }
      // Other browsers
      else if (
        (nameOffset = ua.lastIndexOf(" ") + 1) <
        (verOffset = ua.lastIndexOf("/"))
      ) {
        version = ua.substring(verOffset + 1);
      }
      if ((ix = version.indexOf(";")) != -1) version = version.substring(0, ix);
      if ((ix = version.indexOf(" ")) != -1) version = version.substring(0, ix);
      if ((ix = version.indexOf(")")) != -1) version = version.substring(0, ix);

      return version;
    } catch (ex) {
      IMI.log(ex);
    }
  },
  getSDKVersion: function () {
    var version = JS_SDK_VERSION.split(".");
    version.pop();
    return version.join(".");
  },
  log: function (msg) {
    if (isLogEnabled) {
      if (arguments.callee.caller.name) {
        console.log(arguments.callee.caller.name + ":", msg);
      } else {
        console.log(msg);
      }
    }
  },
};

var sdkversion = "2.0.0";
var protocol = location.protocol;
var webprefix = "v2_web_";
var isSSL = false;
if (protocol === "https:") {
  isSSL = true;
}

var port = 1884;
if (isSSL) {
  port = 8884;
}

var reconnectTimeout = 10000; //10 seconds for reconnect
var keepAliveInterval = 10; //keep alive 10 seocnds
var policyTimeInterval = 1800000; //evry 30 minutes
var timeStampInterval = 30000; //in milliseconds

(function (IMI) {
  var _util = {
    formatDate: function (milli) {
      var date = new Date(milli);
      date.setMilliseconds(0);
      return date.toISOString();
    },
    setCookie: function (cname, cvalue, exminutes) {
      var d = new Date();
      d.setTime(d.getTime() + exminutes * 60 * 1000);
      var expires = "expires=" + d.toUTCString();
      document.cookie = cname + "=" + cvalue + "; " + expires;
    },
    getCookie: function (cname) {
      var name = cname + "=";
      var ca = document.cookie.split(";");
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === " ") c = c.substring(1);
        if (c.indexOf(name) !== -1) return c.substring(name.length, c.length);
      }
      return null;
    },
    // Create a "guid"
    uuid: function () {
      var u = "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

      return u;
    },
    randomUUID: function (max) {
      var u = "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx";
      if (u.length < max) {
        var strLen = u.length;
        for (var i = strLen; i < max; i++) {
          u = u.concat("x");
        }
      }
      u = u.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      if (u.length >= max) {
        return u.substring(0, max - 1);
      }

      return u;
    },
    // Get users current location
    getLocation: function (callback) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function (position) {
            if ($.isFunction(callback)) {
              callback(position);
            }
          },
          function (error) {
            if ($.isFunction(callback)) {
              callback(null, error);
            }
          }
        );
      } else {
        if ($.isFunction(callback)) {
          callback(null, "GEO Location not enabled");
        }
      }
    },
    des: function (key, message, encrypt, mode, iv, padding) {
      //encryption
      var self = this;
      //declaring this locally speeds things up a bit
      var spfunction1 = new Array(
        0x1010400,
        0,
        0x10000,
        0x1010404,
        0x1010004,
        0x10404,
        0x4,
        0x10000,
        0x400,
        0x1010400,
        0x1010404,
        0x400,
        0x1000404,
        0x1010004,
        0x1000000,
        0x4,
        0x404,
        0x1000400,
        0x1000400,
        0x10400,
        0x10400,
        0x1010000,
        0x1010000,
        0x1000404,
        0x10004,
        0x1000004,
        0x1000004,
        0x10004,
        0,
        0x404,
        0x10404,
        0x1000000,
        0x10000,
        0x1010404,
        0x4,
        0x1010000,
        0x1010400,
        0x1000000,
        0x1000000,
        0x400,
        0x1010004,
        0x10000,
        0x10400,
        0x1000004,
        0x400,
        0x4,
        0x1000404,
        0x10404,
        0x1010404,
        0x10004,
        0x1010000,
        0x1000404,
        0x1000004,
        0x404,
        0x10404,
        0x1010400,
        0x404,
        0x1000400,
        0x1000400,
        0,
        0x10004,
        0x10400,
        0,
        0x1010004
      );
      var spfunction2 = new Array(
        -0x7fef7fe0,
        -0x7fff8000,
        0x8000,
        0x108020,
        0x100000,
        0x20,
        -0x7fefffe0,
        -0x7fff7fe0,
        -0x7fffffe0,
        -0x7fef7fe0,
        -0x7fef8000,
        -0x80000000,
        -0x7fff8000,
        0x100000,
        0x20,
        -0x7fefffe0,
        0x108000,
        0x100020,
        -0x7fff7fe0,
        0,
        -0x80000000,
        0x8000,
        0x108020,
        -0x7ff00000,
        0x100020,
        -0x7fffffe0,
        0,
        0x108000,
        0x8020,
        -0x7fef8000,
        -0x7ff00000,
        0x8020,
        0,
        0x108020,
        -0x7fefffe0,
        0x100000,
        -0x7fff7fe0,
        -0x7ff00000,
        -0x7fef8000,
        0x8000,
        -0x7ff00000,
        -0x7fff8000,
        0x20,
        -0x7fef7fe0,
        0x108020,
        0x20,
        0x8000,
        -0x80000000,
        0x8020,
        -0x7fef8000,
        0x100000,
        -0x7fffffe0,
        0x100020,
        -0x7fff7fe0,
        -0x7fffffe0,
        0x100020,
        0x108000,
        0,
        -0x7fff8000,
        0x8020,
        -0x80000000,
        -0x7fefffe0,
        -0x7fef7fe0,
        0x108000
      );
      var spfunction3 = new Array(
        0x208,
        0x8020200,
        0,
        0x8020008,
        0x8000200,
        0,
        0x20208,
        0x8000200,
        0x20008,
        0x8000008,
        0x8000008,
        0x20000,
        0x8020208,
        0x20008,
        0x8020000,
        0x208,
        0x8000000,
        0x8,
        0x8020200,
        0x200,
        0x20200,
        0x8020000,
        0x8020008,
        0x20208,
        0x8000208,
        0x20200,
        0x20000,
        0x8000208,
        0x8,
        0x8020208,
        0x200,
        0x8000000,
        0x8020200,
        0x8000000,
        0x20008,
        0x208,
        0x20000,
        0x8020200,
        0x8000200,
        0,
        0x200,
        0x20008,
        0x8020208,
        0x8000200,
        0x8000008,
        0x200,
        0,
        0x8020008,
        0x8000208,
        0x20000,
        0x8000000,
        0x8020208,
        0x8,
        0x20208,
        0x20200,
        0x8000008,
        0x8020000,
        0x8000208,
        0x208,
        0x8020000,
        0x20208,
        0x8,
        0x8020008,
        0x20200
      );
      var spfunction4 = new Array(
        0x802001,
        0x2081,
        0x2081,
        0x80,
        0x802080,
        0x800081,
        0x800001,
        0x2001,
        0,
        0x802000,
        0x802000,
        0x802081,
        0x81,
        0,
        0x800080,
        0x800001,
        0x1,
        0x2000,
        0x800000,
        0x802001,
        0x80,
        0x800000,
        0x2001,
        0x2080,
        0x800081,
        0x1,
        0x2080,
        0x800080,
        0x2000,
        0x802080,
        0x802081,
        0x81,
        0x800080,
        0x800001,
        0x802000,
        0x802081,
        0x81,
        0,
        0,
        0x802000,
        0x2080,
        0x800080,
        0x800081,
        0x1,
        0x802001,
        0x2081,
        0x2081,
        0x80,
        0x802081,
        0x81,
        0x1,
        0x2000,
        0x800001,
        0x2001,
        0x802080,
        0x800081,
        0x2001,
        0x2080,
        0x800000,
        0x802001,
        0x80,
        0x800000,
        0x2000,
        0x802080
      );
      var spfunction5 = new Array(
        0x100,
        0x2080100,
        0x2080000,
        0x42000100,
        0x80000,
        0x100,
        0x40000000,
        0x2080000,
        0x40080100,
        0x80000,
        0x2000100,
        0x40080100,
        0x42000100,
        0x42080000,
        0x80100,
        0x40000000,
        0x2000000,
        0x40080000,
        0x40080000,
        0,
        0x40000100,
        0x42080100,
        0x42080100,
        0x2000100,
        0x42080000,
        0x40000100,
        0,
        0x42000000,
        0x2080100,
        0x2000000,
        0x42000000,
        0x80100,
        0x80000,
        0x42000100,
        0x100,
        0x2000000,
        0x40000000,
        0x2080000,
        0x42000100,
        0x40080100,
        0x2000100,
        0x40000000,
        0x42080000,
        0x2080100,
        0x40080100,
        0x100,
        0x2000000,
        0x42080000,
        0x42080100,
        0x80100,
        0x42000000,
        0x42080100,
        0x2080000,
        0,
        0x40080000,
        0x42000000,
        0x80100,
        0x2000100,
        0x40000100,
        0x80000,
        0,
        0x40080000,
        0x2080100,
        0x40000100
      );
      var spfunction6 = new Array(
        0x20000010,
        0x20400000,
        0x4000,
        0x20404010,
        0x20400000,
        0x10,
        0x20404010,
        0x400000,
        0x20004000,
        0x404010,
        0x400000,
        0x20000010,
        0x400010,
        0x20004000,
        0x20000000,
        0x4010,
        0,
        0x400010,
        0x20004010,
        0x4000,
        0x404000,
        0x20004010,
        0x10,
        0x20400010,
        0x20400010,
        0,
        0x404010,
        0x20404000,
        0x4010,
        0x404000,
        0x20404000,
        0x20000000,
        0x20004000,
        0x10,
        0x20400010,
        0x404000,
        0x20404010,
        0x400000,
        0x4010,
        0x20000010,
        0x400000,
        0x20004000,
        0x20000000,
        0x4010,
        0x20000010,
        0x20404010,
        0x404000,
        0x20400000,
        0x404010,
        0x20404000,
        0,
        0x20400010,
        0x10,
        0x4000,
        0x20400000,
        0x404010,
        0x4000,
        0x400010,
        0x20004010,
        0,
        0x20404000,
        0x20000000,
        0x400010,
        0x20004010
      );
      var spfunction7 = new Array(
        0x200000,
        0x4200002,
        0x4000802,
        0,
        0x800,
        0x4000802,
        0x200802,
        0x4200800,
        0x4200802,
        0x200000,
        0,
        0x4000002,
        0x2,
        0x4000000,
        0x4200002,
        0x802,
        0x4000800,
        0x200802,
        0x200002,
        0x4000800,
        0x4000002,
        0x4200000,
        0x4200800,
        0x200002,
        0x4200000,
        0x800,
        0x802,
        0x4200802,
        0x200800,
        0x2,
        0x4000000,
        0x200800,
        0x4000000,
        0x200800,
        0x200000,
        0x4000802,
        0x4000802,
        0x4200002,
        0x4200002,
        0x2,
        0x200002,
        0x4000000,
        0x4000800,
        0x200000,
        0x4200800,
        0x802,
        0x200802,
        0x4200800,
        0x802,
        0x4000002,
        0x4200802,
        0x4200000,
        0x200800,
        0,
        0x2,
        0x4200802,
        0,
        0x200802,
        0x4200000,
        0x800,
        0x4000002,
        0x4000800,
        0x800,
        0x200002
      );
      var spfunction8 = new Array(
        0x10001040,
        0x1000,
        0x40000,
        0x10041040,
        0x10000000,
        0x10001040,
        0x40,
        0x10000000,
        0x40040,
        0x10040000,
        0x10041040,
        0x41000,
        0x10041000,
        0x41040,
        0x1000,
        0x40,
        0x10040000,
        0x10000040,
        0x10001000,
        0x1040,
        0x41000,
        0x40040,
        0x10040040,
        0x10041000,
        0x1040,
        0,
        0,
        0x10040040,
        0x10000040,
        0x10001000,
        0x41040,
        0x40000,
        0x41040,
        0x40000,
        0x10041000,
        0x1000,
        0x40,
        0x10040040,
        0x1000,
        0x41040,
        0x10001000,
        0x40,
        0x10000040,
        0x10040000,
        0x10040040,
        0x10000000,
        0x40000,
        0x10001040,
        0,
        0x10041040,
        0x40040,
        0x10000040,
        0x10040000,
        0x10001000,
        0x10001040,
        0,
        0x10041040,
        0x41000,
        0x41000,
        0x1040,
        0x1040,
        0x40040,
        0x10000000,
        0x10041000
      );

      //create the 16 or 48 subkeys we will need
      var keys = self.des_createKeys(key);
      var m = 0,
        i,
        j,
        temp,
        right1,
        right2,
        left,
        right,
        looping;
      var cbcleft, cbcleft2, cbcright, cbcright2;
      var endloop, loopinc;
      var len = message.length;
      var chunk = 0;
      //set up the loops for single and triple des
      var iterations = keys.length == 32 ? 3 : 9; //single or triple des
      if (iterations == 3) {
        looping = encrypt ? new Array(0, 32, 2) : new Array(30, -2, -2);
      } else {
        looping = encrypt
          ? new Array(0, 32, 2, 62, 30, -2, 64, 96, 2)
          : new Array(94, 62, -2, 32, 64, 2, 30, -2, -2);
      }

      //pad the message depending on the padding parameter
      if (padding == 2) message += "        ";
      //pad the message with spaces
      else if (padding == 1) {
        temp = 8 - (len % 8);
        message += String.fromCharCode(
          temp,
          temp,
          temp,
          temp,
          temp,
          temp,
          temp,
          temp
        );
        if (temp == 8) len += 8;
      } //PKCS7 padding
      else if (!padding) message += "\0\0\0\0\0\0\0\0"; //pad the message out with null bytes

      result = "";
      tempresult = "";

      if (mode == 1) {
        //CBC mode
        cbcleft =
          (iv.charCodeAt(m++) << 24) |
          (iv.charCodeAt(m++) << 16) |
          (iv.charCodeAt(m++) << 8) |
          iv.charCodeAt(m++);
        cbcright =
          (iv.charCodeAt(m++) << 24) |
          (iv.charCodeAt(m++) << 16) |
          (iv.charCodeAt(m++) << 8) |
          iv.charCodeAt(m++);
        m = 0;
      }
      //loop through each 64 bit chunk of the message
      while (m < len) {
        left =
          (message.charCodeAt(m++) << 24) |
          (message.charCodeAt(m++) << 16) |
          (message.charCodeAt(m++) << 8) |
          message.charCodeAt(m++);
        right =
          (message.charCodeAt(m++) << 24) |
          (message.charCodeAt(m++) << 16) |
          (message.charCodeAt(m++) << 8) |
          message.charCodeAt(m++);

        //for Cipher Block Chaining mode, xor the message with the previous result
        if (mode == 1) {
          if (encrypt) {
            left ^= cbcleft;
            right ^= cbcright;
          } else {
            cbcleft2 = cbcleft;
            cbcright2 = cbcright;
            cbcleft = left;
            cbcright = right;
          }
        }

        //first each 64 but chunk of the message must be permuted according to IP
        temp = ((left >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= temp;
        left ^= temp << 4;
        temp = ((left >>> 16) ^ right) & 0x0000ffff;
        right ^= temp;
        left ^= temp << 16;
        temp = ((right >>> 2) ^ left) & 0x33333333;
        left ^= temp;
        right ^= temp << 2;
        temp = ((right >>> 8) ^ left) & 0x00ff00ff;
        left ^= temp;
        right ^= temp << 8;
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;

        left = (left << 1) | (left >>> 31);
        right = (right << 1) | (right >>> 31);

        //do this either 1 or 3 times for each chunk of the message
        for (j = 0; j < iterations; j += 3) {
          endloop = looping[j + 1];
          loopinc = looping[j + 2];
          //now go through and perform the encryption or decryption
          for (i = looping[j]; i != endloop; i += loopinc) {
            //for efficiency
            right1 = right ^ keys[i];
            right2 = ((right >>> 4) | (right << 28)) ^ keys[i + 1];
            //the result is attained by passing these bytes through the S selection functions
            temp = left;
            left = right;
            right =
              temp ^
              (spfunction2[(right1 >>> 24) & 0x3f] |
                spfunction4[(right1 >>> 16) & 0x3f] |
                spfunction6[(right1 >>> 8) & 0x3f] |
                spfunction8[right1 & 0x3f] |
                spfunction1[(right2 >>> 24) & 0x3f] |
                spfunction3[(right2 >>> 16) & 0x3f] |
                spfunction5[(right2 >>> 8) & 0x3f] |
                spfunction7[right2 & 0x3f]);
          }
          temp = left;
          left = right;
          right = temp; //unreverse left and right
        } //for either 1 or 3 iterations

        //move then each one bit to the right
        left = (left >>> 1) | (left << 31);
        right = (right >>> 1) | (right << 31);

        //now perform IP-1, which is IP in the opposite direction
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;
        temp = ((right >>> 8) ^ left) & 0x00ff00ff;
        left ^= temp;
        right ^= temp << 8;
        temp = ((right >>> 2) ^ left) & 0x33333333;
        left ^= temp;
        right ^= temp << 2;
        temp = ((left >>> 16) ^ right) & 0x0000ffff;
        right ^= temp;
        left ^= temp << 16;
        temp = ((left >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= temp;
        left ^= temp << 4;

        //for Cipher Block Chaining mode, xor the message with the previous result
        if (mode == 1) {
          if (encrypt) {
            cbcleft = left;
            cbcright = right;
          } else {
            left ^= cbcleft2;
            right ^= cbcright2;
          }
        }
        tempresult += String.fromCharCode(
          left >>> 24,
          (left >>> 16) & 0xff,
          (left >>> 8) & 0xff,
          left & 0xff,
          right >>> 24,
          (right >>> 16) & 0xff,
          (right >>> 8) & 0xff,
          right & 0xff
        );

        chunk += 8;
        if (chunk == 512) {
          result += tempresult;
          tempresult = "";
          chunk = 0;
        }
      } //for every 8 characters, or 64 bits in the message
      return result + tempresult;
    }, //end of des
    des_createKeys: function (key) {
      //declaring this locally speeds things up a bit
      pc2bytes0 = new Array(
        0,
        0x4,
        0x20000000,
        0x20000004,
        0x10000,
        0x10004,
        0x20010000,
        0x20010004,
        0x200,
        0x204,
        0x20000200,
        0x20000204,
        0x10200,
        0x10204,
        0x20010200,
        0x20010204
      );
      pc2bytes1 = new Array(
        0,
        0x1,
        0x100000,
        0x100001,
        0x4000000,
        0x4000001,
        0x4100000,
        0x4100001,
        0x100,
        0x101,
        0x100100,
        0x100101,
        0x4000100,
        0x4000101,
        0x4100100,
        0x4100101
      );
      pc2bytes2 = new Array(
        0,
        0x8,
        0x800,
        0x808,
        0x1000000,
        0x1000008,
        0x1000800,
        0x1000808,
        0,
        0x8,
        0x800,
        0x808,
        0x1000000,
        0x1000008,
        0x1000800,
        0x1000808
      );
      pc2bytes3 = new Array(
        0,
        0x200000,
        0x8000000,
        0x8200000,
        0x2000,
        0x202000,
        0x8002000,
        0x8202000,
        0x20000,
        0x220000,
        0x8020000,
        0x8220000,
        0x22000,
        0x222000,
        0x8022000,
        0x8222000
      );
      pc2bytes4 = new Array(
        0,
        0x40000,
        0x10,
        0x40010,
        0,
        0x40000,
        0x10,
        0x40010,
        0x1000,
        0x41000,
        0x1010,
        0x41010,
        0x1000,
        0x41000,
        0x1010,
        0x41010
      );
      pc2bytes5 = new Array(
        0,
        0x400,
        0x20,
        0x420,
        0,
        0x400,
        0x20,
        0x420,
        0x2000000,
        0x2000400,
        0x2000020,
        0x2000420,
        0x2000000,
        0x2000400,
        0x2000020,
        0x2000420
      );
      pc2bytes6 = new Array(
        0,
        0x10000000,
        0x80000,
        0x10080000,
        0x2,
        0x10000002,
        0x80002,
        0x10080002,
        0,
        0x10000000,
        0x80000,
        0x10080000,
        0x2,
        0x10000002,
        0x80002,
        0x10080002
      );
      pc2bytes7 = new Array(
        0,
        0x10000,
        0x800,
        0x10800,
        0x20000000,
        0x20010000,
        0x20000800,
        0x20010800,
        0x20000,
        0x30000,
        0x20800,
        0x30800,
        0x20020000,
        0x20030000,
        0x20020800,
        0x20030800
      );
      pc2bytes8 = new Array(
        0,
        0x40000,
        0,
        0x40000,
        0x2,
        0x40002,
        0x2,
        0x40002,
        0x2000000,
        0x2040000,
        0x2000000,
        0x2040000,
        0x2000002,
        0x2040002,
        0x2000002,
        0x2040002
      );
      pc2bytes9 = new Array(
        0,
        0x10000000,
        0x8,
        0x10000008,
        0,
        0x10000000,
        0x8,
        0x10000008,
        0x400,
        0x10000400,
        0x408,
        0x10000408,
        0x400,
        0x10000400,
        0x408,
        0x10000408
      );
      pc2bytes10 = new Array(
        0,
        0x20,
        0,
        0x20,
        0x100000,
        0x100020,
        0x100000,
        0x100020,
        0x2000,
        0x2020,
        0x2000,
        0x2020,
        0x102000,
        0x102020,
        0x102000,
        0x102020
      );
      pc2bytes11 = new Array(
        0,
        0x1000000,
        0x200,
        0x1000200,
        0x200000,
        0x1200000,
        0x200200,
        0x1200200,
        0x4000000,
        0x5000000,
        0x4000200,
        0x5000200,
        0x4200000,
        0x5200000,
        0x4200200,
        0x5200200
      );
      pc2bytes12 = new Array(
        0,
        0x1000,
        0x8000000,
        0x8001000,
        0x80000,
        0x81000,
        0x8080000,
        0x8081000,
        0x10,
        0x1010,
        0x8000010,
        0x8001010,
        0x80010,
        0x81010,
        0x8080010,
        0x8081010
      );
      pc2bytes13 = new Array(
        0,
        0x4,
        0x100,
        0x104,
        0,
        0x4,
        0x100,
        0x104,
        0x1,
        0x5,
        0x101,
        0x105,
        0x1,
        0x5,
        0x101,
        0x105
      );

      var iterations = 1;
      //stores the return keys
      var keys = new Array(32 * iterations);
      //now define the left shifts which need to be done
      var shifts = new Array(0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0);
      //other variables
      var lefttemp,
        righttemp,
        m = 0,
        n = 0,
        temp;

      for (var j = 0; j < iterations; j++) {
        //either 1 or 3 iterations
        left =
          (key.charCodeAt(m++) << 24) |
          (key.charCodeAt(m++) << 16) |
          (key.charCodeAt(m++) << 8) |
          key.charCodeAt(m++);
        right =
          (key.charCodeAt(m++) << 24) |
          (key.charCodeAt(m++) << 16) |
          (key.charCodeAt(m++) << 8) |
          key.charCodeAt(m++);

        temp = ((left >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= temp;
        left ^= temp << 4;
        temp = ((right >>> -16) ^ left) & 0x0000ffff;
        left ^= temp;
        right ^= temp << -16;
        temp = ((left >>> 2) ^ right) & 0x33333333;
        right ^= temp;
        left ^= temp << 2;
        temp = ((right >>> -16) ^ left) & 0x0000ffff;
        left ^= temp;
        right ^= temp << -16;
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;
        temp = ((right >>> 8) ^ left) & 0x00ff00ff;
        left ^= temp;
        right ^= temp << 8;
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;

        //the right side needs to be shifted and to get the last four bits of the left side
        temp = (left << 8) | ((right >>> 20) & 0x000000f0);
        //left needs to be put upside down
        left =
          (right << 24) |
          ((right << 8) & 0xff0000) |
          ((right >>> 8) & 0xff00) |
          ((right >>> 24) & 0xf0);
        right = temp;

        //now go through and perform these shifts on the left and right keys
        for (var i = 0; i < shifts.length; i++) {
          //shift the keys either one or two bits to the left
          if (shifts[i]) {
            left = (left << 2) | (left >>> 26);
            right = (right << 2) | (right >>> 26);
          } else {
            left = (left << 1) | (left >>> 27);
            right = (right << 1) | (right >>> 27);
          }
          left &= -0xf;
          right &= -0xf;

          lefttemp =
            pc2bytes0[left >>> 28] |
            pc2bytes1[(left >>> 24) & 0xf] |
            pc2bytes2[(left >>> 20) & 0xf] |
            pc2bytes3[(left >>> 16) & 0xf] |
            pc2bytes4[(left >>> 12) & 0xf] |
            pc2bytes5[(left >>> 8) & 0xf] |
            pc2bytes6[(left >>> 4) & 0xf];
          righttemp =
            pc2bytes7[right >>> 28] |
            pc2bytes8[(right >>> 24) & 0xf] |
            pc2bytes9[(right >>> 20) & 0xf] |
            pc2bytes10[(right >>> 16) & 0xf] |
            pc2bytes11[(right >>> 12) & 0xf] |
            pc2bytes12[(right >>> 8) & 0xf] |
            pc2bytes13[(right >>> 4) & 0xf];
          temp = ((righttemp >>> 16) ^ lefttemp) & 0x0000ffff;
          keys[n++] = lefttemp ^ temp;
          keys[n++] = righttemp ^ (temp << 16);
        }
      } //for each iterations
      return keys;
    }, //end of des_createKeys

    decodeBase64: function (s) {
      var self = this;
      var _PADCHAR = "=";
      var pads = 0,
        i,
        b10,
        imax = s.length,
        x = [];

      s = String(s);
      if (imax === 0) return s;

      if (imax % 4 !== 0) {
        throw "Cannot decode base64";
      }
      if (s.charAt(imax - 1) === _PADCHAR) {
        pads = 1;

        if (s.charAt(imax - 2) === _PADCHAR) {
          pads = 2;
        }
        // either way, we want to ignore this last block
        imax -= 4;
      }

      for (i = 0; i < imax; i += 4) {
        b10 =
          (self._getbyte64(s, i) << 18) |
          (self._getbyte64(s, i + 1) << 12) |
          (self._getbyte64(s, i + 2) << 6) |
          self._getbyte64(s, i + 3);
        x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff, b10 & 0xff));
      }

      switch (pads) {
        case 1:
          b10 =
            (self._getbyte64(s, i) << 18) |
            (self._getbyte64(s, i + 1) << 12) |
            (self._getbyte64(s, i + 2) << 6);
          x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff));
          break;
        case 2:
          b10 =
            (self._getbyte64(s, i) << 18) | (self._getbyte64(s, i + 1) << 12);
          x.push(String.fromCharCode(b10 >> 16));
          break;
      }

      return x.join("");
    },
    _getbyte64: function (s, i) {
      var _ALPHA =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      var idx = _ALPHA.indexOf(s.charAt(i));
      if (idx === -1) {
        throw "Cannot decode base64";
      }
      return idx;
    },
    aes: function (message, key, type) {
      try {
        var secret_key = CryptoJS.enc.Base64.parse(key);
        if (type === 0) {
          //encrypt
          var iv = CryptoJS.lib.WordArray.random(16);
          var body = CryptoJS.AES.encrypt(message, secret_key, { iv: iv });
          var header = CryptoJS.enc.Utf8.parse("");
          header.concat(iv);
          header.concat(body.ciphertext);
          message = CryptoJS.enc.Base64.stringify(header);
        } else {
          //decrypt

          var packet = CryptoJS.enc.Base64.parse(message);
          //alert(secret_key)
          var iv = CryptoJS.lib.WordArray.random(16);
          var start = iv.words.length;
          var end = packet.words.length;
          var ciphertext = CryptoJS.lib.WordArray.create(
            packet.words.slice(start, end)
          );
          var parsed_iv = CryptoJS.lib.WordArray.create(
            packet.words.slice(0, iv.words.length + 1)
          );
          ciphertext = CryptoJS.enc.Base64.stringify(ciphertext);
          //decrypting
          var decrypted = CryptoJS.AES.decrypt(ciphertext, secret_key, {
            iv: parsed_iv,
          });
          //converting into string
          message = CryptoJS.enc.Utf8.stringify(decrypted);
        }
      } catch (ex) {
        IMI.log("failed to enc/dec ,please add aes library", ex);
      }
      return message;
    },
    getQueryString: function (url) {
      var temp = url
        .split("?")[1]
        .split("&")
        .map((bi) => bi.split("="));
      return Object.fromEntries(temp);
    },
  };
  var _db,
    _deviceId,
    _imiconnect,
    _messagingInstance,
    _isConnected,
    _traceEnabled = false,
    _connRandomUUID,
    _tabId;
  //IMIconnect
  var _dbKeys = {
    APP_REGISTERED: "appregistered",
    CURRENT_SDK_VERSION: "current_sdk_version",
  };
  IMI.namespace("IMI.IMIconnect");
  IMI.IMIconnect = (function () {
    var obj;
    obj = {
      isRegister: false,
      subscriptions: [],
      isDisconnected: false,
      isRTEnabled: false,
      isLocationEnabled: false,
      isEncryptionEnabled: false,
      isPushEnabled: false,
      webpush: undefined,
      icConfig: undefined,
      userId: undefined,
      iCDeviceProfile: undefined,
      clientId: undefined,
      encryptionType: "DES",
      encryptionKey: "",
      refreshToken: "",
      accessToken: "",
      serverInboxVersion: null,
      startupLogger: function () {
        isLogEnabled = true;
      },
      startup: function (callback) {
        _imiconnect = this;
        var config;
        if (window.imiEnvironments) {
          var env = imiEnvironments[imiEnvironments.target];
          config = new IMI.ICConfig(env);
        }
        if (
          config === null ||
          config === undefined ||
          !config instanceof IMI.ICConfig ||
          config.getAppID() === undefined ||
          config.getClientKey() === undefined
        ) {
          throw _imiconnect._getErrorWithDescription(IMI.ICErrorCodes.InvalidParameterValue,
            "Missing AppID/ClientKey in target environment. Please check imi-environment.js file");
        }
        _imiconnect.icConfig = config;
        if (_imiconnect.icConfig.apis) {
          Object.assign(window, _imiconnect.icConfig.apis);
          var domains = {
            apiProtocol: authdomain.split("://")[0],
            rtmsAPIURL: authdomain + "/api/v3",
            rtmsAPIURLV4: authdomain + "/api/v4",
            SERVER_INBOX_VERSION_TAG_FOR_V4: "server_inbox_version",
          };
          Object.assign(window, domains);
          var elbZeroRatingURLs = {
            elbZeroRatingURLTemplate:
              apiProtocol + "://$(domain)/rtmsAPI/api/v3",
            elbZeroRatingURLUploadFile:
              apiProtocol + "://$(domain)/rtmsAPI/api/v1",
            elbZeroRatingURL: rtmsAPIURL,
            elbZeroRatingURLV4: rtmsAPIURLV4,
            elbZeroRatingUploadURL: authdomain + "/api/v1",
          };
          Object.assign(window, elbZeroRatingURLs);
        }

        var appid = (_imiconnect.appName = config.getAppID());
        _imiconnect.appSecret = config.getClientKey();
        _imiconnect.isRegister = false;
        _imiconnect.webpush = new IMI.WebPushClient(this);
        _imiconnect.isTokenExpired = true;
        _imiconnect.registerListenerObjs = [];
        _db = new IMIClientStorage("IMI.Core." + appid + ".");
        _readReceiptDB = new IMISessionDB("read_receipts");
        try {
          _tabId = sessionStorage.getItem("_tabId");
          if (!_tabId) {
            _tabId = _util.uuid();
            sessionStorage.setItem("_tabId", _tabId);
          }
        } catch (err) { }

        //handle the events  for handling refresh/reload page
        IMI.ICMessaging.getInstance().handleEvents();
        _imiconnect.iCDeviceProfile = _imiconnect.loadDeviceProfiles();
        if (_imiconnect.iCDeviceProfile) {
          _imiconnect.clientId =
            appid +
            "/" +
            _imiconnect.iCDeviceProfile.userId +
            "/" +
            webprefix +
            _imiconnect.iCDeviceProfile.deviceId;
        }

        //migration
        var userCurrentSDKVersion = _db.get(_dbKeys.CURRENT_SDK_VERSION);
        switch (userCurrentSDKVersion) {
          case null:
            _imiconnect._migrateTov130();
            break;
          case "1.3.0":
            break;
          default:
            break;
        }

        _imiconnect._updatePolicyCheck(callback);
        var policyUpdateJSON = _db.get("policyUpdate");
        if (policyUpdateJSON && policyUpdateJSON.status === "Success") {
          _imiconnect._changePolicyDetails(policyUpdateJSON);
        }
      },
      loadDeviceProfiles: function () {
        var deviceId = _db.get("deviceId");
        var userId = _db.get("userId");
        var customerId = _db.get("customerId");
        var isSystemGenerated = _db.get("isSystemGenerated") || false;
        if (!IMI.defined(deviceId) || !IMI.defined(userId)) {
          return null;
        }
        return new IMI.ICDeviceProfile(
          deviceId,
          userId,
          customerId,
          isSystemGenerated
        );
      },
      shutdown: function () {
        try {
          try {
            if (_messagingInstance && _messagingInstance.isConnected()) {
              _messagingInstance.disconnect();
            }
          } catch (ex) {
            IMI.log(ex);
          }
          if (_db) {
            _db.remove("policyUpdate");
            _db.remove("isConnectionOpened");
          }
        } catch (ex) {
          IMI.log(ex);
          throw ex;
        }
      },
      isRegistered: function () {
        var appregistered = _db.get("appregistered");
        if (appregistered !== null && appregistered === true) {
          return true;
        }
        return false;
      },
      register: function (deviceProfile, callback) {
        var isRegistering = _db.get("isRegistering");

        if (isRegistering != null && isRegistering === "true") {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.AlreadyProcessing,
            "SDK registration already processing , you must wait for registration to complete");
        }
        var isUnRegistering = _db.get("isUnRegistering");
        if (isUnRegistering != null && isUnRegistering == true) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.AlreadyProcessing,
            "SDK unregister already processing , you must wait for unregister to complete");
        }

        try {
          var self = this;
          self._isInitialized();
          self.assertProfile(deviceProfile);
          var appId = _imiconnect.icConfig.getAppID();
          var appregistered = _db.get("appregistered");
          var pushRegistered = _db.get("pushRegistered");
          if (appregistered !== null && appregistered === true) {
            //check device register
            if (!pushRegistered) {
              //push is not registered
              if (
                _imiconnect.isPushEnabled &&
                _imiconnect.webpush &&
                deviceProfile.userId
              ) {
                _imiconnect.webpush.init(appId, deviceProfile.userId);
                self._updatePolicyCheck(callback);
              } else {
                throw IMI.ICErrorCodes.DeviceIdAlreadyRegistered;
              }
            } else {
              throw IMI.ICErrorCodes.DeviceIdAlreadyRegistered;
            }
          }

          var isunregister = false;
          //checking degister

          if (_imiconnect.iCDeviceProfile !== null) {
            if (
              deviceProfile.deviceId === _imiconnect.iCDeviceProfile.deviceId
            ) {
              //aleady register
              if (
                deviceProfile.userId === undefined ||
                deviceProfile.userId === "" ||
                deviceProfile.userId === null
              ) {
                deviceProfile._setUserId(
                  _imiconnect.iCDeviceProfile.userId,
                  _imiconnect.iCDeviceProfile.mIsAppUserSystemGenerated
                );
                if (callback && IMI.isFunction(callback.onSuccess)) {
                  if (_imiconnect.iCDeviceProfile.mIsAppUserSystemGenerated)
                    callback.onSuccess({ ic_app_user_id: _imiconnect.iCDeviceProfile.userId });
                }
                _imiconnect.clientId =
                  appId +
                  "/" +
                  _imiconnect.iCDeviceProfile.userId +
                  "/" +
                  webprefix +
                  _imiconnect.iCDeviceProfile.deviceId;
                return;
              }
            }
            //need to logic to un register
            isunregister =
              !_imiconnect.iCDeviceProfile.isAppUserSystemGenerated() &&
              _imiconnect.iCDeviceProfile.userId !== deviceProfile.userId;
          }
          if (isunregister) {
            //un-register and register
            _imiconnect.deRegisterDeviceProfile({
              onSuccess: function () {
                _imiconnect.registerWithServer(deviceProfile, callback);
              },
              onFailure: function () {
                if (callback && IMI.isFunction(callback.onFailure)) {
                  callback.onFailure();
                }
              },
            });
          } else {
            _db.set("isRegistering", "true");
            _imiconnect.registerWithServer(deviceProfile, callback);
          }
        } catch (ex) {
          IMI.log(ex);
          if (callback && IMI.isFunction(callback.onFailure)) {
            callback.onFailure(ex);
          } else {
            throw ex;
          }
        }
      },
      registerWithServer: function (deviceProfile, callback) {
        //regiter
        var self = this;
        _deviceId = deviceProfile.deviceId;
        _db.set("deviceId", _deviceId);
        var appId = _imiconnect.icConfig.getAppID();
        var clientKey = _imiconnect.icConfig.getClientKey();
        //registering user
        var userId = deviceProfile.userId || "";
        var registerURL = rtmsAPIURL + "/" + appId + "/register";
        var data = {
          tenant: "1",
          userId: userId,
          channel: "rt",
          channelType: "web",
          deviceId: _deviceId,
          data: {
            update: {
              useragent: navigator.userAgent,
              os: IMI.getBrowserName(),
              osversion: IMI.getbrowserVersion(),
              language: navigator.language,
            },
          },
        };
        var requestData = JSON.stringify(data);
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        $.ajax({
          url: registerURL,
          type: "POST",
          headers: headers,
          data: requestData,
          success: function (respObj) {
            _db.set("policyUpdate", respObj);
            _db.set(_dbKeys.CURRENT_SDK_VERSION, JS_SDK_VERSION);

            if (respObj.status === "Success") {
              var isSystemGenerated = false;
              if (userId === "" || userId === undefined || userId === null) {
                isSystemGenerated = true;
                userId = respObj.userId;
              }
              _imiconnect.iCDeviceProfile = new IMI.ICDeviceProfile(
                _deviceId,
                userId,
                null,
                isSystemGenerated
              );
              _db.set("isSystemGenerated", isSystemGenerated);
              _db.set("userId", userId);
              _db.set("appName", appId);
              _db.set("appSecret", clientKey);
              _db.set("appregistered", true);
              _db.set("regiterResp", respObj);
              self._changePolicyDetails(respObj);
              _imiconnect.clientId =
                appId +
                "/" +
                userId +
                "/" +
                webprefix +
                _imiconnect.iCDeviceProfile.deviceId;
              if (_imiconnect.isPushEnabled && _imiconnect.webpush) {
                try {
                  _imiconnect.webpush.init(appId, userId);
                } catch (ex) {
                  IMI.log(ex);
                }
              }
              _db.remove("isRegistering");
              if (callback && callback.onSuccess) {
                callback.onSuccess({ userId: userId });
              }
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(respObj.status);
              }
              _db.set("appregistered", false);
            }

          },
          error: function (responseData, textStatus, errorThrown) {
            IMI.log(responseData);
            if (callback && IMI.isFunction(callback.onFailure)) {
              callback.onFailure(errorThrown);
            }
          },
        });
      },
      _migrateTov130: function () {
        _db.set(_dbKeys.APP_REGISTERED, false);
      },

      _isInitialized: function () {
        if (
          _imiconnect.icConfig == null ||
          _imiconnect.icConfig == undefined ||
          !(_imiconnect.icConfig instanceof IMI.ICConfig)
        ) {
          throw IMI.ICErrorCodes.NotInitialized;
        }
        return true;
      },
      updateProfileData: function (deviceParam, value, callback) {
        var self = this;
        self._isInitialized();
        self.isDeviceRegistered();
        if (!IMI.defined(value)) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "Please provide the valid value");
        }
        if (deviceParam === IMI.ICDeviceProfileParam.UserId) {
          //update user Id
          self.updateUserId(value, callback);
        } else if (deviceParam === IMI.ICDeviceProfileParam.CustomerId) {
          //CustomerId
          self.updateCustomerId(value, callback);
        }
      },
      removeProfileData: function (deviceParam, callback) {
        var self = this;
        self._isInitialized();
        self.isDeviceRegistered();
        if (deviceParam === IMI.ICDeviceProfileParam.UserId) {
          //update user Id
          self.removeUserId(callback);
        } else if (deviceParam === IMI.ICDeviceProfileParam.CustomerId) {
          //CustomerId
          self.removeCustomerId(callback);
        }
      },
      updateUserId: function (userId, callback) {
        var self = this;
        var setUserIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/setUserId";
        var userUpdateJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
          userId: userId,
        };
        var requestData = _messagingInstance._getPayLoadMsg(
          JSON.stringify(userUpdateJSON)
        );
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }
        $.ajax({
          url: setUserIdURL,
          type: "POST",
          headers: headers,
          data: requestData,
          success: function (respObj) {
            if (respObj.status === "Success") {
              //actions after update userId

              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
              userId = userId || respObj.userId;
              //unscribe,disc,connect
              self.updateAppUser(userId, false);
              self._updateAccessToken(respObj);
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        });
      },
      _updateAccessToken: function (respObj) {
        if (respObj) {
          var registerResp = _db.get("regiterResp");
          if (respObj.accessToken) {
            _imiconnect.refreshToken = respObj.refreshToken;
            _imiconnect.accessToken = respObj.accessToken;
            _imiconnect.encryptionKey = respObj.encryptionKey;
            if (registerResp) {
              _imiconnect.encryptionType = registerResp.encryptionType || "DES";
              if (_imiconnect.encryptionType === "AES") {
                registerResp.encryptionKey = respObj.encryptionKey;
              } else {
                registerResp.encryptionKey =
                  _imiconnect.icConfig.getAppID().substring(0, 3) +
                  _imiconnect.icConfig.getClientKey();
              }

              registerResp.refreshToken = respObj.refreshToken;
              registerResp.accessToken = respObj.accessToken;
              _db.set("regiterResp", registerResp);
            }
          }
        }
      },
      updateCustomerId: function (customerId, callback) {
        var self = this;
        var setCustomerIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/setCustomerId";
        var customerUpdateJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
          customerId: customerId,
        };
        var requestData = _messagingInstance._getPayLoadMsg(
          JSON.stringify(customerUpdateJSON)
        );
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }
        $.ajax({
          url: setCustomerIdURL,
          type: "POST",
          headers: headers,
          data: requestData,
          success: function (respObj) {
            if (respObj.status === "Success") {
              //actions after update customerId
              _imiconnect.iCDeviceProfile.customerId = customerId;
              _db.set("customerId", customerId);
              //actions  need to do after customer id change
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        });
      },
      removeUserId: function (callback) {
        var self = this;
        var removeUserIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/removeUserId";
        var removeUserIdJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
        };
        var requestData = _messagingInstance._getPayLoadMsg(
          JSON.stringify(removeUserIdJSON)
        );
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }
        $.ajax({
          url: removeUserIdURL,
          type: "POST",
          headers: headers,
          data: requestData,
          success: function (respObj) {
            if (respObj.status === "Success") {
              //actions after update customerId
              var userId = respObj.userId;
              //actions  need to do after removing userId
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
              //unscribe,disc,connect
              self.updateAppUser(userId, true);
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        });
      },
      removeCustomerId: function (callback) {
        var self = this;
        var removeCustomerIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/removeCustomerId";
        var removeCustJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
        };
        var reqbody = _messagingInstance._getPayLoadMsg(JSON.stringify(removeCustJSON));
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }
        $.ajax({
          url: removeCustomerIdURL,
          type: "POST",
          headers: headers,
          data: reqbody,
          success: function (respObj) {
            if (respObj.status === "Success") {
              //actions after update customerId
              //actions  need to do after removing customerId
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        });
      },
      updateAppUser: function (newUserId, isSystemGenerated) {
        var self = this;
        try {
          var oldUserId = _imiconnect.iCDeviceProfile.userId;
          var isStarted = IMI.ICMessaging.isStarted();
          var isConnected = false;
          if (oldUserId !== null && oldUserId === newUserId) return;
          if (isStarted) {
            var messagingObj = IMI.ICMessaging.getInstance();
            isConnected = messagingObj.isConnected();
            if (isStarted && oldUserId && isConnected) {
              //unsubscribe to topics
              messagingObj.unsubscribeServer(oldUserId);
              messagingObj.unsubscribeServer("Updates/" + IMI.getBrowserName());
            }
            if (isStarted && isConnected) {
              messagingObj.disconnect();
            }
          }
          _imiconnect.iCDeviceProfile._setUserId(newUserId, isSystemGenerated);
          self.saveDeviceProfile();
          try {
            var _tabId = sessionStorage.getItem("_tabId");
            _db.set(
              "updateUserEvent",
              _tabId + "_updateuser_" + new Date().getTime()
            );
          } catch (err) { }
          var messagingObj = IMI.ICMessaging.getInstance();

          if (isStarted && isConnected) {
            messagingObj.isDisconnected = false;
            messagingObj.connect();
          }
        } catch (ex) {
          IMI.log(ex);
        }
      },
      setSecurityToken: function (token) {
        var self = this;
        self._isInitialized();
        if (token) {
          _imiconnect.isTokenExpired = false;
          _imiconnect.securedToken = "Bearer " + token;
        } else {
          _imiconnect.isTokenExpired = true;
          delete _imiconnect.securedToken;
        }
      },
      registerListener: function (callback) {
        var self = this;
        self._isInitialized();
        if (!callback || !IMI.isObject(callback)) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must not be undefined");
        }
        if (typeof callback.onFailure != 'function')
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must contain an onFailure handler");

        var isDupicateListener = false;
        for (var i = 0; i < _imiconnect.registerListenerObjs; i++) {
          var meth = _imiconnect.registerListenerObjs[i];
          if (meth === obj) {
            isDupicateListener = true;
          }
        }
        if (isDupicateListener) {
          throw IMI.ICErrorCodes.DuplicateRegisterListener;
        } else {
          _imiconnect.registerListenerObjs.push(callback);
        }
      },
      registerSecurityTokenListener: function (regObj) {
        var self = this;
        self._isInitialized();
        if (!callback || !IMI.isObject(callback)) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must not be undefined");
        }
        if (typeof callback.onFailure != 'function')
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must contain an onFailure handler");

        var isDupicateListener = false;
        for (var i = 0; i < _imiconnect.registerListenerObjs; i++) {
          var meth = _imiconnect.registerListenerObjs[i];
          if (meth === obj) {
            isDupicateListener = true;
          }
        }
        if (isDupicateListener) {
          throw IMI.ICErrorCodes.DuplicateRegisterListener;
        } else {
          _imiconnect.registerListenerObjs.push(regObj);
        }
      },
      unregisterListener: function (unRegObj) {
        var self = this;
        self._isInitialized();
        for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
          var listenerObj = _imiconnect.registerListenerObjs[i];
          if (listenerObj == unRegObj) {
            _imiconnect.registerListenerObjs.splice(i, 1);
            break;
          }
        }
      },
      unregisterSecurityTokenListener: function (unRegObj) {
        var self = this;
        self._isInitialized();
        for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
          var listenerObj = _imiconnect.registerListenerObjs[i];
          if (listenerObj == unRegObj) {
            _imiconnect.registerListenerObjs.splice(i, 1);
            break;
          }
        }
      },
      _invokeListeners: function (errorCode) {
        try {
          if (errorCode) {
            for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
              var listenerObj = _imiconnect.registerListenerObjs[i];
              if (listenerObj.onFailure) {
                listenerObj.onFailure(errorCode);
              }
            }
          }
        } catch (err) {
          IMI.log(err);
        }
      },
      _getErrorCode: function (code) {
        var errorCode;
        if (code === 38) {
          errorCode = IMI.ICErrorCodes.InvalidToken;
        } else if (code === 39) {
          errorCode = IMI.ICErrorCodes.TokenRequired;
        } else if (code === 40) {
          errorCode = IMI.ICErrorCodes.TokenExpired;
        } else if (code === 36) {
          errorCode = IMI.ICErrorCodes.InvalidContentType;
        } else if (code === 3) {
          errorCode = IMI.ICErrorCodes.InvalidParameterValue;
        } else if (code === 62) {
          errorCode = IMI.ICErrorCodes.FeatureNotSupported;
        } else {
          errorCode = IMI.ICErrorCodes.Unknown;
        }
        return errorCode;
      },
      _getErrorWithDescription: function (icErrorCode, detailedDescription) {
        let ex = new Object();
        Object.assign(ex, icErrorCode);
        ex.description = detailedDescription;
        return ex;
      },
      _updatePolicyCheck: function (callback) {
        try {
          var policyUpdateURL =
            rtmsAPIURL +
            "/" +
            _imiconnect.appName +
            "/verifyPolicy?os=" +
            IMI.getBrowserName() +
            "&secretKey=" +
            _imiconnect.appSecret;

          $.ajax({
            url: policyUpdateURL,
            type: "GET",
            success: function (resrmsg) {
              _db.set("policyUpdate", resrmsg);
              _imiconnect._changePolicyDetails(resrmsg);
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                callback.onSuccess();
              }
            },
            error: function (responseData, textStatus, errorThrown) {
              IMI.log("retriving policy failed", responseData);
              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure();
              }
            },
          });
        } catch (err) {
          IMI.log(err);
          throw err;
        }
      },
      deRegisterDeviceProfile: function (callback) {
        var self = this;
        self.isDeviceRegistered();
        _db.set("isUnRegistering", true);
        var deRegisterURL =
          rtmsAPIURL + "/" + _imiconnect.appName + "/unregister";
        var deRegisterJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
        };
        var unRegDevProfReq = _messagingInstance._getPayLoadMsg(
          JSON.stringify(deRegisterJSON)
        );
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }
        $.ajax({
          url: deRegisterURL,
          type: "POST",
          headers: headers,
          data: unRegDevProfReq,
          success: function (respObj) {
            _db.remove("isUnRegistering");
            if (respObj.status === "Success") {
              //actions need to take after degister
              _db.set("appregistered", false);
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                callback.onSuccess();
              }
            } else if (respObj && respObj.code != "0") {

              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure(respObj);
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            IMI.log("retriving policy failed");
            if (
              callback &&
              callback.onFailure &&
              IMI.isFunction(callback.onFailure)
            ) {
              callback.onFailure();
            }
          },
        });
      },
      _invokeFailureCallBack: function (callback, respObj) {
        if (
          callback &&
          callback.onFailure &&
          IMI.isFunction(callback.onFailure) &&
          respObj
        ) {
          var errorCode = _imiconnect._getErrorCode(respObj.code);
          callback.onFailure(errorCode);
        }
      },
      _getRtmsDomainUrl: function () {
        if (_imiconnect.serverInboxVersion) return elbZeroRatingURLV4;
        else return elbZeroRatingURL;
      },
      _changePolicyDetails: function (updatedData) {
        try {
          var policy = updatedData.policy || {};
          var features = policy.features || {};
          var broker = updatedData.broker || {};
          var appType = updatedData.appType || "";
          _imiconnect.appType = appType;
          //checking rt
          if (features.realtimemessaging === undefined) {
            features.realtimemessaging = "1";
            if (protocol === "https:") {
              isSSL = true;
              features.securedconnection = "1";
            }
          }
          if (features.realtimemessaging === "1") {
            _imiconnect.isRTEnabled = true;
          } else {
            //disable rt
            if (
              _imiconnect.isRTEnabled &&
              _messagingInstance &&
              _messagingInstance.isConnected()
            ) {
              try {
                _messagingInstance.disconnect();
              } catch (err) {
                IMI.log(err);
              }
            }
            _imiconnect.isRTEnabled = false;
          }
          //verify push
          if (features.basicpush === "1") {
            _imiconnect.isPushEnabled = true;
          } else {
            if (
              _imiconnect.isPushEnabled &&
              _messagingInstance &&
              _messagingInstance.webpush
            ) {
              try {
                _messagingInstance.webpush.unsubscribe();
              } catch (err) {
                IMI.log(err);
              }
            }
            _imiconnect.isPushEnabled = false;
          }
          _imiconnect.isEncryptionEnabled = features.encryption === "1";
          isSSL = features.securedconnection === "1";
          //check broker details
          if (isSSL) {
            port = broker.wss ? parseInt(broker.wss) : 8884;
          } else {
            port = broker.ws ? parseInt(broker.ws) : 1884;
          }
          rtmsdomain = broker.ip || rtmsdomain;
          var registerResp = _db.get("regiterResp");
          if (registerResp) {
            _imiconnect.encryptionType = registerResp.encryptionType || "DES";
            if (_imiconnect.encryptionType === "AES") {
              _imiconnect.encryptionKey = registerResp.encryptionKey;
            } else {
              _imiconnect.encriptionKey =
                _imiconnect.icConfig.getAppID().substring(0, 3) +
                _imiconnect.icConfig.getClientKey();
            }
            _imiconnect.refreshToken = registerResp.refreshToken;
            _imiconnect.accessToken = registerResp.accessToken;
            _imiconnect.appDomain = registerResp.appDomain;
            if (_imiconnect.appDomain) {
              elbZeroRatingURL = elbZeroRatingURLTemplate.replace(
                "$(domain)",
                _imiconnect.appDomain
              );
              elbZeroRatingUploadURL = elbZeroRatingURLUploadFile.replace(
                "$(domain)",
                _imiconnect.appDomain
              );
            }
            _imiconnect.serverInboxVersion =
              registerResp[SERVER_INBOX_VERSION_TAG_FOR_V4];
          } else {
            _imiconnect.encriptionKey =
              _imiconnect.icConfig.getAppID().substring(0, 3) +
              _imiconnect.icConfig.getClientKey();
          }
        } catch (ex) {
          IMI.log(ex);
        }
      },
      unregister: function (callback) {
        var isUnRegistering = _db.get("isUnRegistering");
        if (isUnRegistering != null && isUnRegistering == true) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.AlreadyProcessing,
            "SDK unregister already processing , you must wait for unregister to complete");
        }

        try {
          //removing profile
          _imiconnect.deRegisterDeviceProfile({
            onSuccess: function () {
              if (
                _messagingInstance &&
                _messagingInstance.isConnected() &&
                _imiconnect &&
                _imiconnect.iCDeviceProfile
              ) {
                _messagingInstance.unsubscribeServer(
                  _imiconnect.iCDeviceProfile.userId
                );
              }
              if (_messagingInstance && _messagingInstance.isConnected()) {
                _messagingInstance.disconnect();
              }

              //removing push subscription for chrome and firefox(for safari browser compatability is not there
              if (_imiconnect.webpush) {
                _imiconnect.webpush.unsubscribe();
              }
              _db.remove("appName");
              _db.remove("appSecret");
              _db.remove("userId");
              _db.remove("deviceId");
              _db.remove("policyUpdate");
              _db.remove("appregistered");
              _db.remove("regiterResp");
              _imiconnect.iCDeviceProfile = null;
              try {
                var _tabId = sessionStorage.getItem("_tabId");
                _db.set(
                  "deRegisterEvent",
                  _tabId + "_deregister_" + new Date().getTime()
                );
              } catch (err) { }
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                callback.onSuccess();
              }
            },
            onFailure: function (resp) {
              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure(resp);
              }
            },
          });
        } catch (ex) {
          IMI.log(ex);
          throw ex;
        }
      },
      getPushDetails: function (callbackfun) {
        if (_imiconnect.webpush) {
          _imiconnect.webpush.getWebSubscriptionDetials(callbackfun);
        } else {
          var Obj = {};
          Obj.status = "1";
          Obj.description = "app is not registered, please register";
          callbackfun(Obj);
        }
      },
      _encryptMsg: function (messagePaylod) {
        try {
          if (_imiconnect.isEncryptionEnabled) {
            if (_imiconnect.encryptionType === "DES") {
              messagePaylod = _util.des(
                _imiconnect.encriptionKey,
                messagePaylod,
                1,
                0,
                null,
                1
              );
              messagePaylod = btoa(messagePaylod);
            } else if (_imiconnect.encryptionType === "AES") {
              messagePaylod = _util.aes(
                messagePaylod,
                _imiconnect.encryptionKey,
                0
              );
            }
          }
        } catch (err) {
          IMI.log(err);
        }

        return messagePaylod;
      },
      _decryptMsg: function (messagePaylod) {
        try {
          if (_imiconnect.isEncryptionEnabled) {
            if (_imiconnect.encryptionType === "DES") {
              var text = atob(messagePaylod);
              messagePaylod = _util.des(
                _imiconnect.encriptionKey,
                text,
                0,
                0,
                null,
                1
              );
              messagePaylod = messagePaylod.substr(
                0,
                messagePaylod.lastIndexOf("}") + 1
              );
            } else if (_imiconnect.encryptionType === "AES") {
              messagePaylod = _util.aes(
                messagePaylod,
                _imiconnect.encryptionKey,
                1
              );
            }
          }
        } catch (err) {
          try {
            if (_imiconnect.isEncryptionEnabled) {
              if (_imiconnect.encryptionType === "DES") {
                messagePaylod = messagePaylod.replace(/\n/g, "");
                var text = _util.decodeBase64(messagePaylod);
                messagePaylod = _util.des(
                  _imiconnect.encriptionKey,
                  text,
                  0,
                  0,
                  null,
                  1
                );
                messagePaylod = messagePaylod.substr(
                  0,
                  messagePaylod.lastIndexOf("}") + 1
                );
              } else if (_imiconnect.encryptionType === "AES") {
                messagePaylod = _util.aes(
                  messagePaylod,
                  _imiconnect.encryptionKey,
                  1
                );
              }
            }
          } catch (err) {
            IMI.log(err);
          }
        }
        return messagePaylod;
      },
      saveDeviceProfile: function () {
        if (
          _imiconnect.iCDeviceProfile === null ||
          _imiconnect.iCDeviceProfile === undefined
        )
          return;
        _deviceId = _imiconnect.iCDeviceProfile.deviceId;
        var userId = _imiconnect.iCDeviceProfile.userId || "";
        var customerId = _imiconnect.iCDeviceProfile.customerId;
        var appId = _imiconnect.icConfig.getAppID();
        _imiconnect.clientId =
          appId +
          "/" +
          userId +
          "/" +
          webprefix +
          _imiconnect.iCDeviceProfile.deviceId;
        var appId = _imiconnect.appName;
        _db.set("deviceId", _deviceId);
        _db.set("customerId", customerId);
        _db.set("userId", userId);
        _db.set("uniqueClientId", appId + "/" + userId);
        _db.set("clientId", appId + "/" + userId + "/" + webprefix + _deviceId);
      },
      getDeviceProfile: function () {
        return _imiconnect.iCDeviceProfile;
      },
      assertProfile: function (deviceprofile) {
        if (deviceprofile === null || !(deviceprofile instanceof IMI.ICDeviceProfile))
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "Profile parameter must not be undefined"
          );
        if (!IMI.defined(deviceprofile.getDeviceId()))
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "Profile must contain a valid deviceId");
      },
      isDeviceRegistered: function () {
        var self = this;
        var deviceProfile = self.getDeviceProfile();
        if (
          deviceProfile === null ||
          deviceProfile === undefined ||
          deviceProfile.deviceId === undefined ||
          deviceProfile.deviceId === null ||
          deviceProfile.deviceId === ""
        ) {
          throw IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered;
        }
      },
    };
    return obj;
  })();

  //ICConfig  setting appid and clientkey
  IMI.namespace("IMI.ICConfig");
  IMI.ICConfig = (function () {
    var Constr;
    Constr = function (env) {
      var self = this;
      self.appid = env.asset.appId;
      self.clientKey = env.asset.appSecret;
      self.assetPath = window.location.origin + "/assets";
      pathConfig = env.asset.pathConfig;
      if (
        pathConfig &&
        pathConfig.assetPath &&
        pathConfig.assetPath.length > 0
      ) {
        self.assetPath = pathConfig.assetPath;
      }
      self.root = "/";
      if (pathConfig && pathConfig.root && pathConfig.root.length > 0) {
        self.root = pathConfig.root;
      }
      self.apis = env.imiclient;
      self.sw = env.sw;
    };
    Constr.prototype = {
      getAppID: function () {
        return this.appid;
      },
      getClientKey: function () {
        return this.clientKey;
      },
      getApis: function () {
        return this.apis;
      },
      getAssetPath: function () {
        return this.assetPath;
      },
      setAssetPath: function (path) {
        self.assetPath = path;
      },
      setRoot: function (folder) {
        self.root = folder;
      },
      getRoot: function () {
        return this.root;
      },
    };
    return Constr;
  })();
  //ICMessaging
  IMI.namespace("IMI.ICMessaging");
  IMI.ICMessaging = (function () {
    function init() {
      var messagingInstanceObj = {
        //define public methods and variable..
        messagecallback: new IMI.ICMessagingReceiver(),
        isDisconnected: false,
        _unloaded: false,
        storageEventEnabled: false,
        //current connection status
        connectionStatus: IMI.ICConnectionStatus.None,
        connect: function () {
          var self = this;
          try {
            if (!_imiconnect) {
              throw IMI.ICErrorCodes.NotInitialized;
            }
            //verifying whether initilized or not
            _imiconnect._isInitialized();
            //isRegistered
            _imiconnect.isDeviceRegistered();
            //checking connected/connecting
            if (
              self.isConnected() ||
              self.connectionStatus === IMI.ICConnectionStatus.Connecting
            ) {
              throw IMI.ICErrorCodes.ConnectionAlreadyExists;
            }

            //connecting to server
            self._connect();
          } catch (ex) {
            IMI.log("connect", ex);
            throw ex;
          }
        },
        _connect: function () {
          var self = this;
          try {
            if (!_imiconnect.isRTEnabled) {
              throw IMI.ICErrorCodes.FeatureNotSupported;
            }

            var icConfig = _imiconnect.icConfig;
            var appName = (self.appName = icConfig.getAppID());
            self.password = icConfig.getClientKey();
            self.userId =
              _imiconnect.iCDeviceProfile.userId || _db.get("userId");
            self.uniqueClientId = appName + "/" + self.userId;
            var connClientId = (self.clientId =
              self.uniqueClientId +
              "/" +
              webprefix +
              _imiconnect.iCDeviceProfile.deviceId);
            if (_imiconnect.accessToken) {
              connClientId += "/at_" + _imiconnect.accessToken;
            }
            //RandomUUID removed as per #CNCT-8951
            self.client = new Paho.MQTT.Client(rtmsdomain, port, connClientId);
            //Enabling tracing
            self.client.startTrace();

            if (!_traceEnabled) {
              _traceEnabled = true;
              setInterval(function () {
                _messagingInstance.client.stopTrace();

                _messagingInstance.client.startTrace();
              }, 30000);
            }
            self.client.onConnectionLost = self.connectionlost.bind(self);
            self.client.onMessageArrived = self.messagearrived.bind(self);
            var context = {};
            self.connectionStatus = IMI.ICConnectionStatus.Connecting;
            self.connectOptions = {
              invocationContext: context,
              onSuccess: self.onConnect.bind(self),
              timeout: 5,
              cleanSession: false,
              useSSL: isSSL,
              onFailure: self.onConnectFailure.bind(self),
              userName: self.uniqueClientId,
              password: self.password,
              keepAliveInterval: keepAliveInterval,
            };
            self.client.connect(self.connectOptions);
          } catch (ex) {
            IMI.log("_connect", ex);
            throw ex;
          }
        },
        onConnect: function (invocationContext) {
          var self = this;
          self.connectionStatus = IMI.ICConnectionStatus.Connected;
          var propsObj = { qos: 2 };
          //subscribe to userId for getting MT's
          self.subscribeServer(_imiconnect.iCDeviceProfile.userId, propsObj);
          //topic for getting app updates on RT
          var topic = "Updates/" + IMI.getBrowserName();
          self.subscribeServer(topic, propsObj);
          if (
            self.messagecallback &&
            self.messagecallback.onConnectionStatusChanged &&
            IMI.isFunction(self.messagecallback.onConnectionStatusChanged)
          ) {
            self.messagecallback.onConnectionStatusChanged(
              IMI.ICConnectionStatus.Connected
            );
          }
          //set the interval and set falg true
          _db.set("isConnectionOpened", true);
          _isConnected = true;
          self.isDisconnected = false;
        },
        onConnectFailure: function (invocationContext) {
          var self = this;
          try {
            self.connectionStatus = IMI.ICConnectionStatus.Error;
            if (
              self.messagecallback &&
              self.messagecallback.onConnectionStatusChanged &&
              IMI.isFunction(self.messagecallback.onConnectionStatusChanged)
            ) {
              self.messagecallback.onConnectionStatusChanged(
                IMI.ICConnectionStatus.Error
              );
            }
            if (!self.isDisconnected) {
              setTimeout(function () {
                self._connect.call(self);
              }, reconnectTimeout * 3);
            }
          } catch (ex) {
            IMI.log("error onConnectFailure::", ex);
          }
        },
        connectionlost: function (message) {
          var self = this;
          try {
            self.connectionStatus = IMI.ICConnectionStatus.Refused;
            if (
              self.messagecallback &&
              self.messagecallback.onConnectionStatusChanged &&
              IMI.isFunction(self.messagecallback.onConnectionStatusChanged)
            ) {
              self.messagecallback.onConnectionStatusChanged(
                self.connectionStatus
              );
            }
            //if connection lost try to re connect to server
            if (!self.isDisconnected) {
              setTimeout(function () {
                self._connect.call(self);
              }, reconnectTimeout);
            }
          } catch (ex) {
            IMI.log("error connectionlost :: " + message + " error" + ex);
          }
        },
        messagearrived: function (message) {
          var self = this;
          try {
            //decrypt message if encription enabled
            var payLoadStr = _imiconnect._decryptMsg(message.payloadString);
            payLoadStr = JSON.parse(payLoadStr);
            var msgObj = IMI.ICMessage.fromJSON(payLoadStr);
            if (
              msgObj &&
              msgObj.getTopic() &&
              msgObj.getTopic().indexOf("Updates/" + IMI.getBrowserName()) !==
              -1
            ) {
              //verify policy
              if (_imiconnect) {
                try {
                  _imiconnect._updatePolicyCheck();
                } catch (er) {
                  IMI.log(er);
                }
              }
            } else {
              var shouldSkipMessage =
                _imiconnect.appName === msgObj.getAppId() &&
                _imiconnect.iCDeviceProfile.userId === msgObj.getUserId() &&
                _imiconnect.iCDeviceProfile.deviceId === msgObj.getDeviceId() &&
                (msgObj.getType() === IMI.ICMessageType.Republish
                  || msgObj.getType() === IMI.ICMessageType.ClickedReceipt
                  || msgObj.getType() === IMI.ICMessageType.MessageDeleted
                  || msgObj.getType() === IMI.ICMessageType.ReadReceipt

                );

              if (shouldSkipMessage || _db.isDuplicateMessage(msgObj)) {
                return;
              } else {
                _db.setTransId(msgObj);
              }

              //sending Dr
              if (msgObj.getType() === IMI.ICMessageType.Message) {
                self.sendDRMessage(msgObj.getTransactionId(), {
                  onFailure: function (error) {
                    _imiconnect._invokeListeners(error);
                  },
                });
              }

              if (
                self.messagecallback &&
                self.messagecallback.onMessageReceived &&
                IMI.isFunction(self.messagecallback.onMessageReceived)
              ) {
                self.messagecallback.onMessageReceived(msgObj);
              }
            }
          } catch (err) {
            IMI.log(err);
          }
        },
        disconnect: function () {
          var self = this;
          try {
            _db.remove("isConnectionOpened");
            self.isDisconnected = true;
            if (self.isConnected()) {
              self.client.disconnect();
            }
            var _tabId = sessionStorage.getItem("_tabId");
            _db.set(
              "disconnectEvent",
              _tabId + "_disconnect_" + new Date().getTime()
            );
          } catch (er) {
            IMI.log("disconnect", er);
            throw er;
          }
        },
        fetchTopics: function (start, callback) {
          if (arguments.length === 1) {
            callback = start;
          }
          if (!IMI.isNumber(start)) {
            start = 0;
          }
          var user = _imiconnect.iCDeviceProfile.userId || "";
          var query = "start=" + start + "&subscribed=both";
          var topicsurl =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            user +
            "/topics";
          var headers = {};
          headers.secretKey = _imiconnect.appSecret;
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (topcisdata) {
                if (topcisdata && topcisdata.code == 0) {
                  if (
                    callback &&
                    callback.onSuccess &&
                    IMI.isFunction(callback.onSuccess)
                  ) {
                    //convert topics list
                    var topicsList = [];
                    try {
                      if (topcisdata && topcisdata.topics) {
                        var topics = topcisdata.topics;
                        for (var itm = 0; itm < topics.length; itm++) {
                          var topic = topics[itm];
                          topicsList.push(IMI.ICTopic.fromJSON(topic));
                        }
                      }
                      callback.onSuccess(topicsList);
                    } catch (ex) {
                      if (
                        callback &&
                        callback.onFailure &&
                        IMI.isFunction(callback.onFailure)
                      ) {
                        callback.onFailure(IMI.ICErrorCodes.Unknown);
                      }
                    }
                  }
                } else if (topcisdata && topcisdata.code != 0) {
                  _imiconnect._invokeFailureCallBack(callback, topcisdata);
                } else {
                  if (
                    callback &&
                    callback.onFailure &&
                    IMI.isFunction(callback.onFailure)
                  ) {
                    callback.onFailure(IMI.ICErrorCodes.Unknown);
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(IMI.ICErrorCodes.Unknown);
                }
              },
            };
            IMI.Get(topicsurl, query, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        createThread: function (thread, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must not be undefined");
          }
          if (!(thread instanceof IMI.ICThread)) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must be an instance of IMI.ICThread");
          }

          var createThreadUrl =
            elbZeroRatingURL + "/apps/" + _imiconnect.appName + "/threads";
          if (thread.getType()) {
            thread.setType(IMI.ICThreadType.Conversation);
          }

          var createThread = JSON.stringify(thread.toJSON());

          var headers = {
            "Content-Type": "application/json",
            secretKey: _imiconnect.appSecret,
            sdkversion: sdkversion,
          };
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (cratedThreadResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (cratedThreadResp && cratedThreadResp.thread) {
                    var threadResp = IMI.ICThread.fromJSON(
                      cratedThreadResp.thread
                    );
                    //copying existing properties
                    Object.assign(threadResp, thread);
                    callback.onSuccess(threadResp);
                  } else if (cratedThreadResp) {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      cratedThreadResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Post(createThreadUrl, createThread, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        updateThread: function (thread, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must not be undefined");
          }
          if (!(thread instanceof IMI.ICThread)) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must be an instance of IMI.ICThread");
          }
          if (thread.getId() === undefined) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "threadId parameter cannot be empty");
          }

          var user = _imiconnect.iCDeviceProfile.userId || "";
          var updateThreadUrl =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            user +
            "/threads/" +
            thread.getId();

          var updateThread = JSON.stringify(thread.toJSON());

          var headers = {
            "Content-Type": "application/json",
            secretKey: _imiconnect.appSecret,
            sdkversion: sdkversion,
          };
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (updateThreadResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (updateThreadResp && updateThreadResp.thread) {
                    var threadResp = IMI.ICThread.fromJSON(
                      updateThreadResp.thread
                    );
                    callback.onSuccess(threadResp);
                  } else if (updateThreadResp) {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      updateThreadResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Put(updateThreadUrl, updateThread, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        closeThread: function (icThreadObj, callback) {
          icThreadObj.setStatus(IMI.ICThreadStatus.Closed);
          IMI.ICMessaging.getInstance().updateThread(icThreadObj, callback);
        },
        _reopenThread: function (icThreadObj, callback) {
          icThreadObj.setStatus(IMI.ICThreadStatus.Active);
          IMI.ICMessaging.getInstance().updateThread(icThreadObj, callback);
        },
        fetchUnreadThreadCount: function (callback) {
          var fetchUnreadThreadsCountURL =
            elbZeroRatingURLV4 +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            _imiconnect.iCDeviceProfile.userId +
            "/unreadthreads";

          var headers = {};
          headers.secretKey = _imiconnect.appSecret;
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (fetchUnreadThreadsCountResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (
                    fetchUnreadThreadsCountResp &&
                    fetchUnreadThreadsCountResp.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchUnreadThreadsCountResp = JSON.parse(
                      _imiconnect._decryptMsg(
                        fetchUnreadThreadsCountResp.encrypted
                      )
                    );
                  }
                  if (fetchUnreadThreadsCountResp) {
                    if (fetchUnreadThreadsCountResp.code == "0") {
                      callback.onSuccess(
                        fetchUnreadThreadsCountResp.unread_thread_count
                      );
                    } else if (fetchUnreadThreadsCountResp.code == "1") {
                      callback.onSuccess("0");
                    } else {
                      _imiconnect._invokeFailureCallBack(
                        callback,
                        fetchUnreadThreadsCountResp
                      );
                    }
                  } else {
                    if (
                      callback &&
                      callback.onFailure &&
                      IMI.isFunction(callback.onFailure)
                    ) {
                      callback.onFailure(IMI.ICErrorCodes.Unknown);
                    }
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchUnreadThreadsCountURL, undefined, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },

        fetchThreads: function (offset, limit, callback) {
          if (!IMI.isNumber(offset)) {
            offset = 0;
          }
          //fetching user threads
          var fetchThreadsURL =
            _imiconnect._getRtmsDomainUrl() +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            _imiconnect.iCDeviceProfile.userId +
            "/threads?start=" +
            offset +
            "&limit=" +
            limit;

          fetchUnreadCount = true; //Defaulting to true
          if (_imiconnect.serverInboxVersion)
            fetchThreadsURL += "&fetchunreadcount=" + true;

          var headers = {};
          headers.secretKey = _imiconnect.appSecret;
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (fetchThredResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (
                    fetchThredResp &&
                    fetchThredResp.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchThredResp = JSON.parse(
                      _imiconnect._decryptMsg(fetchThredResp.encrypted)
                    );
                  }
                  if (fetchThredResp) {
                    if (fetchThredResp.code == "0") {
                      var threadsJson = fetchThredResp.threads;
                      if (threadsJson) {
                        var threadArrayRsp = [];
                        for (var itm = 0; itm < threadsJson.length; itm++) {
                          var thread = threadsJson[itm];
                          threadArrayRsp.push(IMI.ICThread.fromJSON(thread));
                        }
                        //Disabled as part of 1.2.0
                        var count = fetchThredResp.count || 0;
                        var total = fetchThredResp.total || 0;
                        var hashmore = total > count + offset;
                        callback.onSuccess(threadArrayRsp, hashmore);
                      } else {
                        callback.onSuccess([], 0);
                      }
                    } else if (fetchThredResp.code == "1") {
                      callback.onSuccess([], 0);
                    } else {
                      _imiconnect._invokeFailureCallBack(
                        callback,
                        fetchThredResp
                      );
                    }
                  } else {
                    if (
                      callback &&
                      callback.onFailure &&
                      IMI.isFunction(callback.onFailure)
                    ) {
                      callback.onFailure(IMI.ICErrorCodes.Unknown);
                    }
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchThreadsURL, undefined, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        fetchMessages: function (threadId, sinceDate, limit, callback) {
          if (arguments.length < 4) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters are missing");
          }
          if (threadId) {
            threadId = encodeURIComponent(threadId);
          }

          if (sinceDate && sinceDate instanceof Date) {
            sinceDate = IMI.parseDate(sinceDate);
          } else {
            sinceDate = "";
          }
          if (!limit || limit < 1)
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Please provide valid limit value");

              var fetchMessagesURL =
            _imiconnect._getRtmsDomainUrl() +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            _imiconnect.iCDeviceProfile.userId +
            "/threads/" +
            threadId +
            "/messages?from=" +
            sinceDate +
            "&limit=" +
            limit;
          var headers = {};
          headers.secretKey = _imiconnect.appSecret;
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }

          try {
            var mycallback = {
              onSuccess: function (fetchMessagesResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (
                    fetchMessagesResp &&
                    fetchMessagesResp.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchMessagesResp = JSON.parse(
                      _imiconnect._decryptMsg(fetchMessagesResp.encrypted)
                    );
                  }
                  if (fetchMessagesResp && fetchMessagesResp.code == "0") {
                    var messagesJson = fetchMessagesResp.messages;
                    var messagesArrayRsp = [];
                    if (messagesJson) {
                      for (var itm = 0; itm < messagesJson.length; itm++) {
                        var message = messagesJson[itm];
                        messagesArrayRsp.push(IMI.ICMessage.fromJSON(message));
                      }

                      callback.onSuccess(
                        messagesArrayRsp,
                        fetchMessagesResp.total
                      );
                    } else {
                      callback.onSuccess(
                        messagesArrayRsp,
                        fetchMessagesResp.total
                      );
                    }
                  } else {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      fetchMessagesResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchMessagesURL, undefined, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        getConnectionStatus: function () {
          return this.connectionStatus;
        },
        isConnected: function () {
          var self = this;
          return self.connectionStatus === IMI.ICConnectionStatus.Connected;
        },
        deleteMessage: function (tid, callback) {
          var deleteMessageUrl =
            elbZeroRatingURL + "/" + _imiconnect.appName + "/message";
          var postData = JSON.stringify({
            tid: tid,
            clientId: _imiconnect.clientId,
          });
          var headers = {
            "Content-Type": "application/json",
            secretKey: _imiconnect.appSecret,
            sdkversion: sdkversion,
          };
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          var mycallback = {
            onSuccess: function (response) {
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                //passing data back
                if (response.code === 0) {
                  callback.onSuccess(tid);
                } else {
                  _imiconnect._invokeFailureCallBack(callback, response);
                }
              }
            },
            onFailure: function (falureresp) {
              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure(falureresp);
              }
            },
          };
          IMI.Post(deleteMessageUrl, postData, headers, mycallback);
        },
        publishMessage: function (message, callback) {
          var self = this;
          try {
            //checking is registered
            var isRegEn = _imiconnect.isRegistered();
            if (!isRegEn) {
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(
                  IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered
                );
              }
              return;
            }
            //verifying instance
            if (!(message instanceof IMI.ICMessage)) {
              throw IMI.ICErrorCodes.PublishFailed;
            }
            if (!(message.getThread() && message.getThread() instanceof IMI.ICThread)) {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "message.getThread() must be an instance of ICThread");
            }

            if (!message.getThread() || !message.getThread().getId()) {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "thread.getId() property cannot be empty");
            }
            if (message.getThread().getType() === undefined) {
              message.getThread().setType(IMI.ICThreadType.Conversation);
            }
            //#1.3.0 Added in v1.3.0 - Activate Thread automatically
            var publishToBackend = function () {
              message.channel = "rt";
              message.setClientId(_imiconnect.clientId);
              //encrypt payload
              var messagePaylod = self._getPayLoadMsg(
                JSON.stringify(message.toJSON())
              );
              var moURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/mo";
              var headers = {};
              var headers = {
                "Content-Type": "application/json",
                secretKey: _imiconnect.appSecret,
                sdkversion: sdkversion,
              };
              if (_imiconnect.securedToken) {
                headers.Authorization = _imiconnect.securedToken;
              }
              if (_imiconnect.accessToken) {
                headers.accessToken = _imiconnect.accessToken;
              }
              $.ajax({
                url: moURL,
                type: "POST",
                headers: headers,
                data: messagePaylod,
                success: function (publishResp) {
                  if (publishResp && publishResp.code == "0") {
                    if (callback && typeof callback.onSuccess === "function") {
                      message.setStatus(IMI.MessageStatus.messagesuccess);
                      message.setTransactionId(publishResp.tid);
                      message.setSubmittedAt(IMI.getDate(publishResp.created_on));
                      message.setOutgoing(true);
                      callback.onSuccess(message, null);
                    }
                  } else {
                    _imiconnect._invokeFailureCallBack(callback, publishResp);
                  }
                },
                error: function (responseData, textStatus, errorThrown) {
                  if (callback && IMI.isFunction(callback.onFailure)) {
                    callback.onFailure(IMI.ICErrorCodes.PublishFailed);
                  }
                },
              });
            };
            if (message.getThread().getStatus() === IMI.ICThreadStatus.Closed) {
              var updateThreadCallback = {
                onSuccess: (res) => {
                  publishToBackend();
                },
                onFailure: (err) => IMI.log("onThreadUpdateFailure:", err),
              };
              IMI.ICMessaging.getInstance()._reopenThread(
                message.getThread(),
                updateThreadCallback
              );
            } else publishToBackend();
          } catch (ex) {
            IMI.log(ex);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
            throw ex;
          }
        },
        sendClickedEvent: function (messageTransactionId, icButton, callback) {
          var self = this;
          let icInteractiveData = new IMI.ICInteractiveData();
          icInteractiveData.setType(icButton.getType());
          icInteractiveData.setIdentifier(icButton.getIdentifier());
          icInteractiveData.setTitle(icButton.getTitle());
          icInteractiveData.setActionURL(icButton.getActionURL());
          icInteractiveData.setPayload(icButton.getPayload());

          let payload = {
            "tid": messageTransactionId,
            "status": 4,
            "clientId": _imiconnect.clientId,
            "interactiveData": icInteractiveData.toJSON()
          }

          try {
            //calling api update
            messagePaylod = JSON.stringify(payload);
            var deliveryUpdateURL =
              elbZeroRatingURL + "/" + _imiconnect.appName + "/deliveryupdate";

            var headers = {
              "Content-Type": "application/json",
              secretKey: _imiconnect.appSecret,
              sdkversion: sdkversion,
            };

            if (_imiconnect.securedToken) {
              headers.Authorization = _imiconnect.securedToken;
            }
            if (_imiconnect.accessToken) {
              headers.accessToken = _imiconnect.accessToken;
            }

            $.ajax({
              url: deliveryUpdateURL,
              type: "POST",
              headers: headers,
              data: messagePaylod,
              success: function (respObj) {
                if (respObj && respObj.code == "0") {
                  if (callback && typeof callback.onSuccess === "function") {
                    callback.onSuccess(icButton);
                  }
                } else if (respObj && respObj.code != "0") {
                  _imiconnect._invokeFailureCallBack(callback, respObj);
                } else {
                  if (callback && IMI.isFunction(callback.onFailure)) {
                    callback.onFailure(IMI.MessageStatus.messagefailed);
                  }
                }
              },
              error: function (responseData, textStatus, errorThrown) {
                if (callback && IMI.isFunction(callback.onFailure)) {
                  callback.onFailure(IMI.MessageStatus.messagefailed);
                }
              },
            });
          } catch (error) {
            IMI.log(error);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
          }
        },
        _getPayLoadMsg: function (payLoad) {
          if (_imiconnect.isEncryptionEnabled) {
            try {
              var encData = _imiconnect._encryptMsg(payLoad);
              payLoad = '{"encrypted":"' + encData + '"}';
            } catch (ex) {
              IMI.log(ex);
            }
          }
          return payLoad;
        },
        subscribeServer: function (topic, callback) {
          var self = this;
          try {
            self.client.subscribe(_imiconnect.appName + "/" + topic, callback);
          } catch (error) {
            IMI.log(error);
            throw IMI.ICErrorCodes.SubscribeFailed;
          }
        },
        unsubscribeServer: function (topic, callback) {
          try {
            this.client.unsubscribe(
              _imiconnect.appName + "/" + topic,
              callback
            );
          } catch (err) {
            throw IMI.ICErrorCodes.UnsubscribeFailed;
          }
        },
        //subscribe topic
        subscribeTopic: function (topicId, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters missing");
          }
          if (topicId) {
            topicId = encodeURIComponent(topicId);
          }
          var body =
            "['" +
            (_imiconnect.iCDeviceProfile
              ? _imiconnect.iCDeviceProfile.userId
              : _imiconnect.userId) +
            "']";
          var subscribeTopicURL =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/topics/" +
            topicId +
            "/users";
          var headers = {};
          var headers = {
            "Content-Type": "application/json",
            secretKey: _imiconnect.appSecret,
            sdkversion: sdkversion,
          };
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (subTopicResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (subTopicResp.code === 0) {
                    callback.onSuccess();
                  } else {
                    _imiconnect._invokeFailureCallBack(callback, subTopicResp);
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Post(subscribeTopicURL, body, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        //subscribe topic
        unsubscribeTopic: function (topicId, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters missing");
          }
          if (topicId) {
            topicId = encodeURIComponent(topicId);
          }
          var userId = _imiconnect.iCDeviceProfile
            ? _imiconnect.iCDeviceProfile.userId
            : _imiconnect.userId;
          //fetching user threads
          var unsubscribeTopicURL =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/topics/" +
            topicId +
            "/users/" +
            userId;
          var headers = {};
          var headers = {
            "Content-Type": "application/json",
            secretKey: _imiconnect.appSecret,
            sdkversion: sdkversion,
          };
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          try {
            var mycallback = {
              onSuccess: function (unSubTopicResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (unSubTopicResp.code === 0) {
                    callback.onSuccess();
                  } else {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      unSubTopicResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(unsubscribeTopicURL, undefined, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        setMessageAsRead: function (transId, callback) {
          var self = this;
          try {
            if (transId) {
              self.setMessagesAsRead(transId, callback);
            }
            else
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "transId parameter cannot be undefined");
          } catch (ex) {
            IMI.log(ex);
            throw ex;
          }
        },
        setMessagesAsRead: function (transactionIds, callback) {
          //might be single transid or multiple array
          var self = this;
          try {
            if (transactionIds) {
              if (!IMI.isArray(transactionIds))
                transactionIds = [transactionIds];
              transactionIds = [...new Set(transactionIds)];
              let transIdsNotSubmittedInThisSession = transactionIds.filter(id => !_readReceiptDB.exists(id));

              var msg = {};
              msg.tids = transIdsNotSubmittedInThisSession;
              _readReceiptDB.add(transIdsNotSubmittedInThisSession);
              msg.status = 3;
              msg.channel = "rt";
              msg.clientId = _imiconnect.clientId;

              var payload = JSON.stringify(msg);
              self._setStatus(payload, callback);

            } else {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "transactionIds parameter cannot be undefined");
            }
          } catch (ex) {
            IMI.log(ex);
            throw ex;
          }
        },
        sendDRMessage: function (transactionId, callback) {
          var self = this;
          try {
            if (transactionId) {
              var msg = {};
              msg.status = 2;
              //msg.topic = "DeliveryStatus";
              msg.channel = "rt";
              msg.clientId = _imiconnect.clientId;
              msg.tid = transactionId;
              var payload = JSON.stringify(msg);
              self._setStatus(payload, callback);
            } else {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "TransactionId parameter cannot be empty");
            }
          } catch (ex) {
            IMI.log(ex);
            throw ex;
          }
        },
        //for setting the callback, to recieve message and connection status change
        setICMessagingReceiver: function (icMsgReceiverCallback) {
          var self = this;
          self.messagecallback = icMsgReceiverCallback;
        },
        _setStatus: function (messagePaylod, callback) {
          try {
            var self = this;
            //calling api update
            messagePaylod = self._getPayLoadMsg(messagePaylod);
            var deliveryUpdateURL =
              elbZeroRatingURL + "/" + _imiconnect.appName + "/deliveryupdate";

            var headers = {
              "Content-Type": "application/json",
              secretKey: _imiconnect.appSecret,
              sdkversion: sdkversion,
            };

            if (_imiconnect.securedToken) {
              headers.Authorization = _imiconnect.securedToken;
            }
            if (_imiconnect.accessToken) {
              headers.accessToken = _imiconnect.accessToken;
            }

            $.ajax({
              url: deliveryUpdateURL,
              type: "POST",
              headers: headers,
              data: messagePaylod,
              success: function (respObj) {
                if (respObj && respObj.code == "0") {
                  if (callback && typeof callback.onSuccess === "function") {
                    callback.onSuccess(IMI.MessageStatus.messagesuccess);
                  }
                } else if (respObj && respObj.code != "0") {
                  _imiconnect._invokeFailureCallBack(callback, respObj);
                } else {
                  if (callback && IMI.isFunction(callback.onFailure)) {
                    callback.onFailure(IMI.MessageStatus.messagefailed);
                  }
                }
              },
              error: function (responseData, textStatus, errorThrown) {
                if (callback && IMI.isFunction(callback.onFailure)) {
                  callback.onFailure(IMI.MessageStatus.messagefailed);
                }
              },
            });
          } catch (error) {
            IMI.log(error);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
          }
        },
        createPostbackMessage: function (icMessage, icButton) {
          let postbackMO = new IMI.ICMessage();
          postbackMO.setRelatedTransactionId(icMessage.getTransactionId());
          postbackMO.setThread(icMessage.getThread());
          postbackMO.setMessage(icButton.getTitle());

          let icInteractiveData = new IMI.ICInteractiveData();
          icInteractiveData.setType(icButton.getType());
          icInteractiveData.setIdentifier(icButton.getIdentifier());
          icInteractiveData.setTitle(icButton.getTitle());
          icInteractiveData.setPayload(icButton.getPayload());
          let reference;
          switch (icButton.getType()) {
            case IMI.ICInteractiveDataType.TemplatePostback:
              if (icMessage.getAttachments() != null && icMessage.getAttachments().length > 0) {
                let genericTemplateAttachment = icMessage.getAttachments()[0];
                reference = genericTemplateAttachment.getReference();
              }
              break;
            case IMI.ICInteractiveDataType.QuickReplyPostback:
              reference = icMessage.getQuickReplyData().getReference();
              break;
          }
          icInteractiveData.setReference(reference);
          postbackMO.setInteractiveData(icInteractiveData)
          return postbackMO;
        },
        handleEvents: function () {
          var self = this;

          window.addEventListener("beforeunload", function () {
            if (!self._unloaded) {
              self.removeWindow();
            }
          });
          window.addEventListener("unload", function () {
            if (!self._unloaded) {
              self.removeWindow();
            }
          });
          //enable storage Event Raising
          if (!self.storageEventEnabled) {
            self.storageEventEnabled = true;
            window.addEventListener("storage", function (event) {
              var key = event.key;
              var eventValue = event.newValue;
              try {
                var tabId = sessionStorage.getItem("_tabId");

                if (key === _db.namespace + "disconnectEvent") {
                  if (tabId || eventValue || eventValue.indexOf(tabId) !== -1) {
                    if (_messagingInstance.isConnected()) {
                      _messagingInstance.disconnect();
                    }
                  }
                } else if (
                  key === _db.namespace + "deRegisterEvent" ||
                  key === _db.namespace + "updateUserEvent"
                ) {
                  if (tabId || eventValue || eventValue.indexOf(tabId) !== -1) {
                    if (_imiconnect) {
                      _imiconnect.iCDeviceProfile =
                        _imiconnect.loadDeviceProfiles();
                      _imiconnect.saveDeviceProfile();
                    }
                  }
                }
              } catch (error) {
                IMI.log(error);
              }
            });
          }
        },
        removeWindow: function () {
          var self = this;
          //update flag
          if (_isConnected && _messagingInstance) {
            _messagingInstance.disconnect();
          }
          if (_db) {
            _db.remove("isConnectionOpened");
          }
          self._unloaded = true;
        },
      };
      return messagingInstanceObj;
    }
    return {
      getInstance: function () {
        if (!_messagingInstance) {
          _messagingInstance = init();
        }
        return _messagingInstance;
      },
      isStarted: function () {
        return _messagingInstance !== null && _messagingInstance !== undefined;
      },
    };

  })();
  //message receiver object
  IMI.namespace("IMI.ICMessagingReceiver");
  IMI.ICMessagingReceiver = (function () {
    var Constr;
    Constr = function () {
      this.onConnectionStatusChanged = function (statuscode) {
      };
      this.onMessageReceived = function (message) {
        IMI.log(message);
      };
    };
    return Constr;
  })();

  //ICTopic
  IMI.namespace("IMI.ICTopic");
  IMI.ICTopic = (function () {
    function toTopicObj(jsonObject) {
      var topicObj = new IMI.ICTopic(jsonObject);
      if (!jsonObject) {
        return null;
      }
      topicObj.name = jsonObject.name;
      topicObj.subscribed = jsonObject.subscribed || false;
      topicObj.id = jsonObject.id;
      topicObj.title = jsonObject.ref;
      topicObj.group = jsonObject.topic_group;
      topicObj.description = jsonObject.description;
      if (jsonObject.created_on) {
        topicObj.createdDate = IMI.getDate(jsonObject.created_on);
      }
      return topicObj;
    }

    var topicConst = function () {
      var self = this;
      self.name = undefined;
      self.subscribed = undefined;
      self.accessLevel = undefined;
      self.createdBy = undefined;
      self.createdDate = undefined;
      self.updatedDate = undefined;
      self.group = undefined;
      self.title = undefined;
      self.id = undefined;
      self.description = undefined;
    };
    topicConst.fromJSON = function (jsonObject) {
      return toTopicObj(jsonObject);
    };
    topicConst.prototype = {
      getName: function () {
        return this.name;
      },
      isSubscribed: function () {
        return this.subscribed;
      },
      getCreatedDate: function () {
        return this.createdDate;
      },
      getTitle: function () {
        return this.title;
      },
      getDescription: function () {
        return this.description;
      },
      getId: function () {
        return this.id;
      },
      getGroup: function () {
        return this.group;
      },
    };
    return topicConst;
  })();
  //ICAttachment
  IMI.namespace("IMI.ICAttachment");
  IMI.ICAttachment = (function () {
    function AttachmentCon(jsonObject) {
      var attachObj = new IMI.ICAttachment();
      try {
        attachObj.setContentType(jsonObject.contentType);
        attachObj.setDuration(jsonObject.duration);
        attachObj.setLatitude(jsonObject.latitude);
        attachObj.setLongitude(jsonObject.longitude);
        attachObj.setSize(jsonObject.size);
        attachObj.setPreview(jsonObject.preview);
        attachObj.setURL(jsonObject.file);
        attachObj.setMediaId(jsonObject.mediaId || jsonObject.id);
      } catch (error) {
        IMI.log(error);
      }
      return attachObj;
    }

    var attchment = function () {
      var self = this;
      self.contentType;
      self.duration;
      self.latitude;
      self.longitude;
      self.preview;
      self.size;
      self.url;
      self.mediaId;
    };

    attchment.prototype = {
      getContentType: function () {
        return this.contentType;
      },
      setContentType: function (contentType) {
        this.contentType = contentType;
      },
      getDuration: function () {
        return this.duration;
      },
      setDuration: function (duration) {
        this.duration = duration;
      },
      getLatitude: function () {
        return this.latitude;
      },
      setLatitude: function (latitude) {
        this.latitude = latitude;
      },
      getLongitude: function () {
        return this.longitude;
      },
      setLongitude: function (longitude) {
        this.longitude = longitude;
      },
      getPreview: function () {
        return this.preview;
      },
      setPreview: function (preview) {
        this.preview = preview;
      },
      getSize: function () {
        return this.size;
      },
      setSize: function (size) {
        this.size = size;
      },
      getURL: function () {
        return this.url;
      },
      setURL: function (url) {
        this.url = url;
      },
      getMediaId: function () {
        return this.mediaId;
      },
      setMediaId: function (mediaId) {
        this.mediaId = mediaId;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        if (self.getContentType()) {
          jsonObject.contentType = self.getContentType();
        }
        if (self.getDuration()) {
          jsonObject.duration = self.getDuration();
        }
        if (self.getLatitude()) {
          jsonObject.latitude = self.getLatitude();
        }
        if (self.getLongitude()) {
          jsonObject.longitude = self.getLongitude();
        }
        if (self.getSize()) {
          jsonObject.size = self.getSize();
        }
        if (self.getPreview()) {
          jsonObject.preview = self.getPreview();
        }
        if (self.getURL()) {
          jsonObject.file = self.getURL();
        }
        if (self.getMediaId()) {
          jsonObject.id = self.getMediaId();
        }
        return jsonObject;
      },
    };
    attchment.fromJSON = function (jsonObject) {
      return AttachmentCon(jsonObject);
    };
    return attchment;
  })();
  IMI.namespace("IMI.ICMediaFile");
  IMI.ICMediaFile = function () { };
  IMI.ICMediaFile.prototype = new IMI.ICAttachment();

  //ICMessage
  IMI.namespace("IMI.ICMessage");
  IMI.ICMessage = (function () {
    var Constr;
    Constr = function () {
      var self = this;
      self.category = undefined;
      self.channel = undefined; //ICMessageChannel
      self.extras = undefined;
      self.media = self.attachments = undefined; //ICAttachment
      self.message = undefined;
      self.replyTo = undefined;
      self.conversationId = undefined;
      self.topic = undefined;
      self.transactionId = undefined;
      self.type = undefined; //ICMessageType
      self.userId = undefined;
      self.customTags = undefined;
      self.appId = undefined;
      self.deviceId = undefined;
      self.clientId = undefined;
      //new propeties
      self.deliveredAt = undefined;
      self.readAt = undefined;
      self.submittedAt = undefined;
      self.priority = undefined;
      self.thread = undefined;
      self.status = undefined;
      //added in 1.1.0
      self.outgoing = true;

      //added in 1.3.2
      self.relatedTid;
      self.interactiveData;
      self.quickReplyData;
    };
    Constr.prototype = {
      getAppId: function () {
        return this.appId;
      },
      setAppId: function (appId) {
        this.appId = appId;
      },
      getCategory: function () {
        return this.category;
      },
      setCategory: function (category) {
        this.category = category;
      },
      getChannel: function () {
        return this.channel;
      },
      setChannel: function (channel) {
        this.channel = channel;
      },
      getCustomTags: function () {
        return this.customTags;
      },
      setCustomTags: function (customTags) {
        this.customTags = customTags;
      },
      getExtras: function () {
        return this.extras;
      },
      setExtras: function (extras) {
        this.extras = extras;
      },
      getMedia: function () {
        return this.attachments;
      },
      setMedia: function (media) {
        this.media = this.attachments = media;
      },
      getAttachments: function () {
        return this.attachments;
      },
      setAttachments: function (attachments) {
        this.media = this.attachments = attachments;
      },
      getMessage: function () {
        return this.message;
      },
      setMessage: function (message) {
        this.message = message;
      },
      getReplyTo: function () {
        return this.replyTo;
      },
      setReplyTo: function (replyTo) {
        this.replyTo = replyTo;
      },
      getConversationId: function () {
        return this.conversationId;
      },
      setConversationId: function (conversationId) {
        this.conversationId = conversationId;
      },
      getTopic: function () {
        return this.topic;
      },
      setTopic: function (topic) {
        this.topic = topic;
      },
      getPriority: function () {
        return this.priority;
      },
      setPriority: function (priority) {
        this.priority = priority;
      },
      getTransactionId: function () {
        return this.transactionId;
      },
      setTransactionId: function (transactionId) {
        this.transactionId = transactionId;
      },
      getType: function () {
        return this.type;
      },
      setType: function (type) {
        this.type = type;
      },
      getUserId: function () {
        return this.userId;
      },
      setUserId: function (userId) {
        this.userId = userId;
      },
      getDeviceId: function () {
        return this.deviceId;
      },
      setDeviceId: function (deviceId) {
        this.deviceId = deviceId;
      },
      getClientId: function () {
        return this.clientId;
      },
      setClientId: function (clientId) {
        this.clientId = clientId;
      },
      getSubmittedAt: function () {
        return this.submittedAt;
      },
      setSubmittedAt: function (submittedAt) {
        this.submittedAt = submittedAt;
      },
      getReadAt: function () {
        return this.readAt;
      },
      setReadAt: function (readAt) {
        this.readAt = readAt;
      },
      getDeliveredAt: function () {
        return this.deliveredAt;
      },
      setDeliveredAt: function (deliveredAt) {
        this.deliveredAt = deliveredAt;
      },
      getThread: function () {
        return this.thread;
      },
      setThread: function (thread) {
        this.thread = thread;
      },
      getStatus: function () {
        return this.status;
      },
      setStatus: function (status) {
        this.status = status;
      },
      setOutgoing: function (outgoing) {
        this.outgoing = outgoing;
      },
      getOutgoing: function () {
        return this.outgoing;
      },
      setRelatedTransactionId: function (val) {
        this.relatedTid = val;
      },
      getRelatedTransactionId: function () {
        return this.relatedTid;
      },
      setInteractiveData: function (val) {
        this.interactiveData = val;
      },
      getInteractiveData: function () {
        return this.interactiveData;
      },
      setQuickReplyData: function (val) {
        this.quickReplyData = val;
      },
      getQuickReplyData: function () {
        return this.quickReplyData;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        jsonObject.appId = self.getAppId();
        jsonObject.deviceId = self.getDeviceId();
        jsonObject.clientId = self.getClientId();
        jsonObject.topic = self.getTopic();
        jsonObject.message = self.getMessage();
        if (self.getUserId()) {
          jsonObject.userId = self.getUserId();
        }
        if (self.getConversationId()) {
          jsonObject.senderId = self.getConversationId();
        }
        if (self.getTransactionId()) {
          jsonObject.tid = self.getTransactionId();
        }
        if (self.getType()) {
          jsonObject.type = self.getType();
        }
        if (self.getTopic()) {
          jsonObject.topic = self.getTopic();
        }
        if (self.getChannel()) {
          jsonObject.channel = self.getChannel();
        }
        if (self.getCategory()) {
          jsonObject.category = self.getCategory();
        }
        if (self.getThread()) {
          jsonObject.thread = self.getThread().toJSON();
        }
        var ex = {};
        if (self.getExtras()) {
          ex = self.getExtras();
        }
        if (self.getCustomTags()) {
          ex.customtags = self.getCustomTags();
        }
        jsonObject.extras = ex;

        if (self.getAttachments() && IMI.isArray(self.getAttachments())) {
          var attchArray = [];
          var attchs = self.getAttachments();
          for (var m = 0; m < attchs.length; m++) {
            var attch = attchs[m];
            attchArray.push(attch.toJSON());
          }
          jsonObject.media = attchArray;
        }
        if (self.getMedia() && IMI.isArray(self.getMedia())) {
          var attchArray = [];
          var attchs = self.getMedia();
          for (var m = 0; m < attchs.length; m++) {
            var attch = attchs[m];
            attchArray.push(attch.toJSON());
          }
          jsonObject.media = attchArray;
        }
        jsonObject.outgoing = self.getOutgoing();
        //added 1.3.2
        jsonObject.relatedTid = self.getRelatedTransactionId();
        if (self.interactiveData)
          jsonObject.interactiveData = self.interactiveData.toJSON();
        if (self.getQuickReplyData()) {
          jsonObject.quickReplies = self.getQuickReplyData().toJSON();
        }
        return jsonObject;
      },
    };
    Constr.fromJSON = function (jsonObject) {
      var msgObj = new IMI.ICMessage();
      msgObj.setCategory(jsonObject.category);
      msgObj.setChannel(jsonObject.channel); //rt //need to change
      msgObj.setMessage(jsonObject.message);
      msgObj.setReplyTo(jsonObject.replyTo);
      msgObj.setConversationId(jsonObject.senderId);
      msgObj.setTopic(jsonObject.topic);
      msgObj.setTransactionId(jsonObject.tid);
      msgObj.setDeviceId(jsonObject.deviceId || _imiconnect.getDeviceProfile().getDeviceId());
      msgObj.setAppId(jsonObject.appId || _imiconnect.icConfig.appid);
      msgObj.setUserId(jsonObject.userId || _imiconnect.getDeviceProfile().getUserId());
      msgObj.setClientId(jsonObject.clientId || _imiconnect.clientId);

      if (jsonObject.created_on || jsonObject.ts) {
        var createdOn = jsonObject.created_on || jsonObject.ts;
        msgObj.setSubmittedAt(IMI.getDate(createdOn));
      }
      if (jsonObject.delivered_at) {
        msgObj.setDeliveredAt(IMI.getDate(jsonObject.delivered_at));
        msgObj.setStatus(IMI.ICMessageStatus.Delivered);
      }
      if (jsonObject.read_at) {
        msgObj.setReadAt(IMI.getDate(jsonObject.read_at));
        msgObj.setStatus(IMI.ICMessageStatus.Read);
      }
      if (jsonObject.interactiveData && jsonObject.interactiveData.submitted_at && jsonObject.interactiveData.submitted_at != "") {
        msgObj.setStatus(IMI.ICMessageStatus.Clicked);
      }

      //set Thread object
      if (jsonObject.thread) {
        var icThread = IMI.ICThread.fromJSON(jsonObject.thread);

        msgObj.setThread(icThread);
      }

      var type = IMI.ICMessageType.Message;
      var payloadType = jsonObject.payload_type;
      if (payloadType === "sentByUser") {
        type = IMI.ICMessageType.Republish;
      } else if (payloadType === "messageRead") {
        type = IMI.ICMessageType.ReadReceipt;
      } else if (payloadType === "messageDelivered") {
        type = IMI.ICMessageType.MessageDelivered;
      } else if (payloadType === "reopenThread") {
        type = IMI.ICMessageType.ReopenThread;
      } else if (payloadType === "closeThread") {
        type = IMI.ICMessageType.CloseThread;
      } else if (payloadType === "updateThread") {
        type = IMI.ICMessageType.UpdateThread;
      } else if (payloadType === "typingStart") {
        type = IMI.ICMessageType.TypingStart;
      } else if (payloadType === "typingStop") {
        type = IMI.ICMessageType.TypingStop;
      } else if (payloadType === "messageDeleted") {
        type = IMI.ICMessageType.MessageDeleted;
      } else if (payloadType === "messageClicked") {
        type = IMI.ICMessageType.ClickedReceipt;
      }

      msgObj.setType(type);

      if (jsonObject.relatedTid)
        msgObj.setRelatedTransactionId(jsonObject.relatedTid);
      if (jsonObject.interactiveData)
        msgObj.setInteractiveData(
          IMI.ICInteractiveData.fromJSON(jsonObject.interactiveData)
        );

      msgObj.setUserId(jsonObject.userId || _imiconnect.iCDeviceProfile.userId);
      if (jsonObject.outgoing) msgObj.setOutgoing(jsonObject.outgoing);
      else msgObj.setOutgoing(msgObj.getType() == IMI.ICMessageType.Republish);

      if (
        jsonObject.media &&
        IMI.isArray(jsonObject.media) &&
        jsonObject.media.length > 0
      ) {
        var mediaArray = [];
        for (var m = 0; m < jsonObject.media.length; m++) {
          const media = jsonObject.media[m];
          if (media.contentType == IMI.ICContentType.Template) {
            switch (media.templateType) {
              case IMI.ICTemplateType.Form:
                mediaArray.push(IMI.ICFormTemplateAttachment.fromJSON(media));
                break;
              case IMI.ICTemplateType.Generic:
                mediaArray.push(new IMI.ICGenericTemplateAttachment(media));
                break;
            }
          }
          else mediaArray.push(IMI.ICAttachment.fromJSON(media));
          msgObj.setAttachments(mediaArray);
        }
      }

      if (jsonObject.extras) {
        var extras = jsonObject.extras;
        if (extras && extras.customtags) {
          msgObj.setCustomTags(extras.customtags);
          delete jsonObject.extras.customtags;
        }
        msgObj.setExtras(extras);
      }

      if (jsonObject.quickReplies) {
        msgObj.setQuickReplyData(new IMI.ICQuickReplyData(jsonObject.quickReplies));
      }
      return msgObj;
    };
    return Constr;
  })();

  IMI.ICGenericTemplateAttachment = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#contentType = jsonObject.contentType;
        this.#templateType = jsonObject.templateType;
        if (jsonObject.payload) this.#reference = jsonObject.payload.reference;
        this.#elements = [];
        jsonObject.payload.elements.forEach(ele => {
          this.#elements.push(new IMI.ICGenericTemplateElement(ele));
        });

      }
    }
    #contentType;
    #templateType;
    #elements;
    #reference;
    setReference(val) { this.#reference = val; };
    getReference() {
      return this.#reference;
    }
    getContentType() {
      return this.#contentType;
    }
    getTemplateType() {
      return this.#templateType;
    }
    getElements() {
      return this.#elements;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.contentType = this.#contentType;
      jsonObject.templateType = this.#templateType;
      jsonObject.payload = { "elements": [] };
      jsonObject.payload.reference = this.#reference;
      this.#elements.forEach(el => jsonObject.payload.elements.push(el.toJSON()));
      return jsonObject;
    }
  }

  IMI.ICGenericTemplateElement = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#title = jsonObject.title;
        this.#subtitle = jsonObject.subtitle;
        this.#imageURLs = jsonObject.imageUrls;
        this.#buttons = [];
        jsonObject.buttons.forEach(jsonButton => {
          this.#buttons.push(new IMI.ICButton(jsonButton))
        });
      }
    }
    #title;
    #subtitle;
    #imageURLs;
    #buttons;

    getTitle() {
      return this.#title;
    }
    getSubtitle() {
      return this.#subtitle;
    }
    getImageURLs() {
      return this.#imageURLs;
    }
    getButtons() {
      return this.#buttons;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.title = this.#title;
      jsonObject.subtitle = this.#subtitle;
      jsonObject.imageUrls = this.#imageURLs;
      jsonObject.buttons = [];
      this.#buttons.forEach(btn => {
        jsonObject.buttons.push(btn.toJSON())
      });
      return jsonObject;
    }
  }
  IMI.ICButton = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#identifier = jsonObject.identifier;
        this.#actionURL = jsonObject.url;
        this.#imageURL = jsonObject.imageUrl;
        this.#title = jsonObject.title;
        this.#payload = jsonObject.payload;
        this.#type = jsonObject.type;
        switch (jsonObject.type) {
          case IMI.ICInteractiveDataType.FormResponse:
            this.#type = IMI.ICInteractiveDataType.FormResponse;
            break;
          case IMI.ICInteractiveDataType.WebURL:
            this.#type = IMI.ICInteractiveDataType.WebURL;
            break;
          case IMI.ICInteractiveDataType.TemplatePostback:
            this.#type = IMI.ICInteractiveDataType.TemplatePostback;
            break;
          case IMI.ICInteractiveDataType.QuickReplyPostback:
            this.#type = IMI.ICInteractiveDataType.QuickReplyPostback;
            break;
        }

      }
    }
    #type;
    #identifier;
    #actionURL;
    #imageURL;
    #title;
    #payload;
    getType() {
      return this.#type;
    }
    getIdentifier() {
      return this.#identifier;
    }
    getImageURL() {
      return this.#imageURL;
    }
    getActionURL() {
      return this.#actionURL;
    }
    getTitle() {
      return this.#title;
    }
    getPayload() {
      return this.#payload;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.type = this.#type;
      jsonObject.identifier = this.#identifier;
      jsonObject.url = this.#actionURL;
      jsonObject.imageUrl = this.#imageURL;
      jsonObject.title = this.#title;
      jsonObject.payload = this.#payload;
      return jsonObject;
    }
  }

  IMI.ICQuickReplyData = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#reference = jsonObject.reference;
        this.#buttons = [];
        if (jsonObject.options)
          jsonObject.options.forEach(btn => {
            this.#buttons.push(new IMI.ICButton(btn));
          });
      }
    }
    #reference;
    #buttons;
    setReference(val) { this.#reference = val; };
    getReference() {
      return this.#reference;
    }
    setButtons(val) { this.#buttons = val; };
    getButtons() {
      return this.#buttons;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.reference = this.#reference;
      jsonObject.options = [];
      this.#buttons.forEach(btn => jsonObject.options.push(btn));
      return jsonObject;
    }
  }

  //ICMessageStatus object
  IMI.namespace("IMI.ICMessageStatus");
  IMI.ICMessageStatus = {
    None: 0,
    NotSent: 1,
    Sent: 2,
    Delivered: 3,
    Read: 4,
    Clicked: 5

  };
  IMI.namespace("IMI.ICFormFieldType");
  IMI.ICFormFieldType = {
    Text: "text",
    Name: "name",
    Email: "email",
    Integer: "integer",
    Decimal: "decimal",
    Date: "date",
    Dropdown: "dropdown",
    MultiSelectDropdown: "multiSelectDropdown"
  };

  IMI.namespace("IMI.ICFormField");
  IMI.ICFormField = (function () {
    var ICFormField = function () {
      var self = this;
      self.name;
      self.type;
      self.label;
      self.options;
      self.value;
      self.values;
      self.description;
      self.mandatory;
    };
    ICFormField.prototype = {
      getName: function () {
        return this.name;
      },
      setName: function (val) {
        this.name = val;
      },
      setType: function (val) {
        this.type = val;
      },
      getType: function () {
        return this.type;
      },
      getValue: function () {
        return this.value;
      },
      setValue: function (val) {
        this.value = val;
      },
      getValues: function () {
        return this.values;
      },
      setValues: function (val) {
        this.values = val;
      },
      getLabel: function () {
        return this.label;
      },
      setLabel: function (val) {
        this.label = val;
      },
      getOptions: function () {
        return this.options;
      },
      setOptions: function (val) {
        this.options = val;
      },
      setDescription: function (val) {
        this.description = val;
      },
      getDescription: function () {
        return this.description;
      },
      getMandatory: function () {
        return this.mandatory;
      },
      setMandatory: function (val) {
        this.mandatory = val;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        jsonObject.name = self.name;
        jsonObject.type = self.type;
        if (self.getType() == IMI.ICFormFieldType.Date && self.value)
          jsonObject.value = IMI.parseDate(new Date(self.value));
        else jsonObject.value = self.value;

        if (self.getType() == IMI.ICFormFieldType.MultiSelectDropdown)
          jsonObject.value = self.values;

        jsonObject.label = self.label;
        jsonObject.options = self.options;
        jsonObject.description = self.description;
        jsonObject.mandatory = self.mandatory;
        return jsonObject;
      },
    };
    ICFormField.fromJSON = function (jsonObject) {
      var formField = new IMI.ICFormField();
      formField.name = jsonObject.name;
      formField.type = jsonObject.type;
      formField.value = jsonObject.value;
      if (jsonObject.type == IMI.ICFormFieldType.MultiSelectDropdown)
        formField.values = jsonObject.value;
      formField.label = jsonObject.label;
      formField.options = jsonObject.options;
      formField.description = jsonObject.description;
      formField.mandatory = jsonObject.mandatory;
      return formField;
    };
    return ICFormField;
  })();
  IMI.namespace("IMI.ICInteractiveData");
  IMI.ICInteractiveData = (function () {
    var ICInteractiveData = function () {
      var self = this;
      self.submittedAt;
      self.type;
      self.tid;
      self.relatedTransactionId;
      self.payload;
      self.identifier;
      self.title;
      self.reference;
      self.actionURL;

    };
    ICInteractiveData.prototype = {
      getSubmittedAt: function () {
        return this.submittedAt;
      },
      setSubmittedAt: function (val) {
        this.submittedAt = val;
      },
      setType: function (val) {
        this.type = val;
      },
      getType: function () {
        return this.type;
      },
      setTid: function (val) {
        this.tid = val;
      },
      getTid: function () {
        return this.tid;
      },
      setIdentifier: function (val) {
        this.identifier = val;
      },
      getIdentifier: function () {
        return this.identifier;
      },
      setRelatedTransactionId: function (val) {
        this.relatedTransactionId = val;
      },
      getRelatedTransactionId: function () {
        return this.relatedTransactionId;
      },
      getPayload: function () {
        return this.payload;
      },
      setPayload: function (val) {
        this.payload = val;
      },
      getTitle: function () {
        return this.title;
      },
      setTitle: function (val) {
        this.title = val;
      },
      getReference: function () {
        return this.reference;
      },
      setReference: function (val) {
        this.reference = val;
      },
      getActionURL: function () {
        return this.actionURL;
      },
      setActionURL: function (val) {
        this.actionURL = val;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        if (self.submittedAt) jsonObject.submitted_at = self.submittedAt;
        if (self.type) jsonObject.type = self.type;
        if (self.relatedTransactionId) jsonObject.tid = self.relatedTransactionId;
        else if (self.tid) jsonObject.tid = self.tid;
        if (self.identifier) jsonObject.identifier = self.identifier;
        jsonObject.payload = self.payload ? self.payload : {};
        if (self.title) jsonObject.title = self.title;
        if (self.reference) jsonObject.reference = self.reference;
        jsonObject.url = self.actionURL || "";
        return jsonObject;
      },
    };
    ICInteractiveData.fromJSON = function (jsonObject) {
      var data = new IMI.ICInteractiveData();
      data.submittedAt = jsonObject.submitted_at;
      data.type = jsonObject.type;
      data.tid = jsonObject.tid;
      data.relatedTransactionId = jsonObject.tid;
      data.identifier = jsonObject.identifier;
      data.title = jsonObject.title;
      data.reference = jsonObject.reference;
      data.actionURL = jsonObject.url;
      if (jsonObject.payload) data.payload = jsonObject.payload;
      return data;
    };
    return ICInteractiveData;
  })();

  IMI.namespace("IMI.ICInteractiveDataType");
  IMI.ICInteractiveDataType = {
    FormResponse: "formResponse",
    WebURL: "webUrl",
    TemplatePostback: "templatePostback",
    QuickReplyPostback: "quickReplyPostback"

  };
  IMI.namespace("IMI.ICTemplateType");
  IMI.ICTemplateType = {
    Form: "form",
    Generic: "generic"
  };
  IMI.namespace("IMI.ICFormTemplateAttachment");
  IMI.ICFormTemplateAttachment = (function () {
    var ICFormTemplateAttachment = function () {
      var self = this;
      self.contentType;
      self.templateType;
      self.templateId;
      self.title;
      self.fields;
      self.reference;
    };
    ICFormTemplateAttachment.prototype = {
      getTitle: function () {
        return this.title;
      },
      setTitle: function (val) {
        this.title = val;
      },
      getFields: function () {
        return this.fields;
      },
      setFields: function (fields) {
        this.fields = fields;
      },
      getContentType: function () {
        return this.contentType;
      },
      setContentType: function (val) {
        this.contentType = val;
      },
      getTemplateType: function () {
        return this.templateType;
      },
      setTemplateType: function (val) {
        this.templateType = val;
      },
      getTemplateId: function () {
        return this.templateId;
      },
      setTemplateId: function (vals) {
        this.templateId = val;
      },
      getReference: function () {
        return this.reference;
      },
      setReference: function (val) {
        this.reference = val;
      },

      toJSON: function () {
        var jsonObject = {};
        jsonObject.contentType = this.contentType;
        jsonObject.templateType = this.templateType;
        jsonObject.templateId = this.templateId;
        jsonObject.reference = this.reference;
        jsonObject.payload = {};
        jsonObject.payload.title = this.title;
        if (this.fields && this.fields.length > 0) {
          jsonObject.payload.fields = [];
          for (let index = 0; index < this.fields.length; index++) {
            const field = this.fields[index];
            jsonObject.payload.fields.push(field.toJSON());
          }
        }
        return jsonObject;
      },
    };
    ICFormTemplateAttachment.fromJSON = function (jsonObject) {
      var formTemplateAttachment = new IMI.ICFormTemplateAttachment();
      formTemplateAttachment.contentType = jsonObject.contentType;
      formTemplateAttachment.templateType = jsonObject.templateType;
      formTemplateAttachment.templateId = jsonObject.templateId;
      formTemplateAttachment.reference = jsonObject.reference;
      formTemplateAttachment.title = jsonObject.payload.title;
      if (jsonObject.payload.fields && jsonObject.payload.fields.length > 0) {
        var formFields = [];
        for (let index = 0; index < jsonObject.payload.fields.length; index++) {
          formFields.push(
            IMI.ICFormField.fromJSON(jsonObject.payload.fields[index])
          );
        }
        formTemplateAttachment.fields = formFields;
      }
      return formTemplateAttachment;
    };
    return ICFormTemplateAttachment;
  })();

  IMI.namespace("IMI.ICContentType");
  IMI.ICContentType = {
    Audio: "audio",
    File: "file",
    Video: "video",
    Image: "image",
    Url: "url",
    Template: "template",
  };
  //ICDeviceProfile
  IMI.namespace("IMI.ICDeviceProfile");
  IMI.ICDeviceProfile = (function () {
    var Constr;
    //end user will set  deviceId and userId
    Constr = function (
      deviceId,
      userId,
      customerId,
      mIsAppUserSystemGenerated
    ) {
      var self = this;
      self.deviceId = deviceId;
      self.userId = userId;
      self.customerId = customerId;
      self.mIsAppUserSystemGenerated = mIsAppUserSystemGenerated || false;
    };
    Constr.prototype = {
      isAppUserSystemGenerated: function () {
        return this.mIsAppUserSystemGenerated;
      },
      getUserId: function () {
        return this.userId;
      },
      getDeviceId: function () {
        return this.deviceId;
      },
      _setDeviceId: function (deviceId) {
        this.deviceId = deviceId;
      },
      _setCustomerId: function (customerId) {
        this.customerId = customerId;
      },
      _setUserId: function (userId, mIsAppUserSystemGenerated) {
        this.userId = userId;
        this.mIsAppUserSystemGenerated = mIsAppUserSystemGenerated;
      },
    };
    //static method which gives default device ID
    Constr.getDefaultDeviceId = function () {
      var uuid = _util.uuid();
      if (_db) {
        var defDeviceId = _db.get("defDeviceId");
        if (IMI.defined(defDeviceId)) {
          uuid = defDeviceId;
        } else {
          _db.set("defDeviceId", uuid);
        }
      }

      return uuid;
    };

    return Constr;
  })();
  //ICThread obj

  IMI.namespace("IMI.ICThread");
  IMI.ICThread = (function () {
    function ThreadCon(jsonObject) {
      var threadObj = new IMI.ICThread();
      try {
        threadObj.setId(jsonObject.id);
        threadObj.setTitle(jsonObject.title);
        if (jsonObject.created_on) {
          threadObj.setCreatedAt(IMI.getDate(jsonObject.created_on));
        }
        if (jsonObject.updated_on) {
          threadObj.setUpdatedAt(IMI.getDate(jsonObject.updated_on));
        }
        if (jsonObject.stream_name) {
          threadObj.setStreamName(jsonObject.stream_name);
        }
        if (jsonObject.extras) {
          threadObj.setExtras(jsonObject.extras);
        }
        if (jsonObject.externalid) {
          threadObj.setExternalid(jsonObject.externalid);
        }
        if (jsonObject.type) {
          threadObj.setType(IMI.ICThreadType.getType(jsonObject.type));
        }
        if (jsonObject.unread_msg_count)
          threadObj.setUnreadMessageCount(jsonObject.unread_msg_count);

        if (jsonObject.status)
          threadObj.setStatus(
            IMI.ICThreadStatus.getThreadStatus(jsonObject.status)
          );

        if (jsonObject.reasonForStatusChange)
          threadObj.setReasonForStatusChange(jsonObject.reasonForStatusChange);
      } catch (error) {
        IMI.log(error);
      }
      return threadObj;
    }

    var thread = function () {
      var self = this;
      self.title;
      self.id;
      self.externalid;
      self.createdAt;
      self.updatedAt;
      self.type;
      self.category;
      self.extras;
      self.streamName;
      self.unreadMessageCount;
      self.status;
      self.reasonForStatusChange;
    };

    thread.prototype = {
      getId: function () {
        return this.id;
      },
      setId: function (id) {
        this.id = id;
      },
      getCreatedAt: function () {
        return this.createdAt;
      },
      setCreatedAt: function (createdAt) {
        this.createdAt = createdAt;
      },
      getUpdatedAt: function () {
        return this.updatedAt;
      },
      setUpdatedAt: function (updatedAt) {
        this.updatedAt = updatedAt;
      },
      getTitle: function () {
        return this.title;
      },
      setTitle: function (title) {
        this.title = title;
      },
      getExtras: function () {
        return this.extras;
      },
      setExtras: function (extras) {
        this.extras = extras;
      },
      getExternalid: function () {
        return this.externalid;
      },
      setExternalid: function (externalid) {
        this.externalid = externalid;
      },
      getType: function () {
        return this.type;
      },
      setType: function (type) {
        this.type = type;
      },
      getStreamName: function () {
        return this.streamName;
      },
      setStreamName: function (streamName) {
        this.streamName = streamName;
      },
      getCategory: function () {
        return this.category;
      },
      setCategory: function (category) {
        this.category = category;
      },
      setUnreadMessageCount: function (count) {
        this.unread_msg_count = count;
      },
      getUnreadMessageCount: function () {
        return this.unread_msg_count;
      },
      getStatus: function () {
        return this.status;
      },
      setStatus: function (status) {
        this.status = status;
      },
      setReasonForStatusChange: function (val) {
        this.reasonForStatusChange = val;
      },
      getReasonForStatusChange: function () {
        return this.reasonForStatusChange;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        if (self.getId()) {
          jsonObject.id = self.getId();
        }
        if (self.getTitle()) {
          jsonObject.title = self.getTitle();
        }
        if (self.getCreatedAt()) {
          jsonObject.createdAt = IMI.parseDate(self.getCreatedAt());
        }
        if (self.getUpdatedAt()) {
          jsonObject.updatedAt = IMI.parseDate(self.getUpdatedAt());
        }
        if (self.getStreamName()) {
          jsonObject.stream_name = self.getStreamName();
        }

        if (self.getExtras()) {
          jsonObject.extras = self.getExtras();
        }
        if (self.getExternalid()) {
          jsonObject.externalid = self.getExternalid();
        }
        if (self.getType()) {
          jsonObject.type = self.getType();
        }
        if (self.getStatus()) {
          jsonObject.status = self.getStatus();
        }
        if (self.getReasonForStatusChange())
          jsonObject.reasonForStatusChange = self.getReasonForStatusChange();
        return jsonObject;
      },
    };
    thread.fromJSON = function (jsonObject) {
      return ThreadCon(jsonObject);
    };
    return thread;
  })();

  //IMI.ICThreadType
  IMI.namespace("IMI.ICThreadType");
  IMI.ICThreadType = {
    Conversation: "Conversation",
    Announcement: "Announcement",
    getType: function (type) {
      if (type === "Conversation") {
        return this.Conversation;
      } else if (type === "Announcement") {
        return this.Announcement;
      }
    },
  };

  //ICThreadStatus object
  IMI.namespace("IMI.ICThreadStatus");
  IMI.ICThreadStatus = {
    Active: "Active",
    Closed: "Closed",
    getThreadStatus: function (status) {
      if (status === "Active") {
        return this.Active;
      } else if (status === "Closed") {
        return this.Closed;
      }
    },
  };

  //ICConnectionStatus object
  IMI.namespace("IMI.ICConnectionStatus");
  IMI.ICConnectionStatus = {
    None: 0,
    Connecting: 1,
    Connected: 2,
    Refused: 3,
    Closed: 4,
    Error: 6,
  };
  //MessageStatus object
  IMI.namespace("IMI.MessageStatus");
  IMI.MessageStatus = {
    messagesuccess: 0,
    messagefailed: 1,
  };
  //ICMessageType object
  IMI.namespace("IMI.ICMessageType");
  IMI.ICMessageType = {
    Message: "Message",
    MessageNotification: "MessageNotification",
    ReadReceipt: "ReadReceipt",
    MessageDelivered: "MessageDelivered",
    Republish: "Republish",
    CloseThread: "CloseThread",
    ReopenThread: "ReopenThread",
    UpdateThread: "UpdateThread",
    TypingStart: "TypingStart",
    TypingStop: "TypingStop",
    MessageDeleted: "MessageDeleted",
    ClickedReceipt: "ClickedReceipt"
  };
  //access level
  IMI.namespace("IMI.ICAccessLevel");
  IMI.ICAccessLevel = {
    ReadWrite: 0,
    Read: 1,
    Write: 2,
    getAccessLevel: function (level) {
      if (level == 0) {
        return this.ReadWrite;
      } else if (level == 1) {
        return this.Read;
      } else if (level == 2) {
        return this.Write;
      }
    },
  };
  IMI.namespace("IMI.ICErrorCodes");
  IMI.ICErrorCodes = {
    NotInitialized: { code: 6000, description: "Not initialized" },
    AlreadyInitialized: { code: 6001, description: "Aleady initialized" },
    NotRegistered: { code: 6002, description: "Not registered" },
    FeatureNotSupported: { code: 6003, description: "Feature not supported" },
    InvalidParameterValue: {
      code: 6004,
      description: "Invalid parameter value",
    },
    PermissionNotGranted: { code: 6005, description: "Permission not granted" },
    DeviceIdCurrentlyNotRegistered: {
      code: 6006,
      description: "DeviceId currently not registered",
    },
    AlreadyProcessing: {
      code: 6007,
      description: "AlreadyProcessing"
    },
    NotConnected: { code: 6200, description: "Not connected" },
    ConnectionFailure: { code: 6201, description: "Connection failure" },
    PublishFailed: { code: 6202, description: "Publish failed" },
    SubscribeFailed: { code: 6203, description: "Subscription failed" },
    UnsubscribeFailed: { code: 6204, description: "Unsubscription failed" },
    ConnectionAlreadyExists: {
      code: 6205,
      description: "Connection is already exists",
    },
    DuplicateRegisterListener: {
      code: 6026,
      description: "Duplicate register listener",
    },
    InvalidToken: { code: 6027, description: "Invalid token" },
    InvalidAuthorizationRequest: {
      code: 6028,
      description: "Invalid authorization request",
    },
    TokenExpired: { code: 6029, description: "Token is expired" },
    TokenRequired: { code: 6030, description: "Token is required" },
    InvalidContentType: { code: 6031, description: "Invalid content type" },
    InternalError: { code: 6032, description: "Internal error" },
    DeviceIdAlreadyRegistered: {
      code: 6033,
      description: "DeviceId already registered",
    },
    Unknown: { code: 6999, description: "Unknown error" },
  };
  //access filter
  IMI.namespace("IMI.ICAccessLevelFilter");
  IMI.ICAccessLevelFilter = {
    ReadWrite: 0,
    Read: 1,
    Write: 2,
    All: 3,
    getAccessLevel: function (level) {
      if (level == 0) {
        return this.ReadWrite;
      } else if (level == 1) {
        return this.Read;
      } else if (level == 2) {
        return this.Write;
      } else if (level == 3) {
        return this.All;
      }
    },
  };
  //device profile enum
  IMI.namespace("IMI.ICDeviceProfileParam");
  IMI.ICDeviceProfileParam = {
    UserId: 0,
    CustomerId: 1,
  };

  IMI.namespace("IMI.ICMediaFileManager");
  IMI.ICMediaFileManager = (function () {
    var Constr = function () { };
    Constr.uploadFile = function (file, mimeType, callback) {
      var isRegEn = _imiconnect.isRegistered();
      if (!isRegEn) {
        if (callback && IMI.isFunction(callback.onFailure)) {
          callback.onFailure(IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered);
        }
        return;
      }

      if (arguments.length === 2) {
        if (IMI.isObject(mimeType)) {
          callback = mimeType;
        }
      }
      if (!(file instanceof File)) {
        //checking given value is File or not
        if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
          //checking Callback is there or not
          callback.onFileUploadComplete(
            file,
            "",
            IMI.ICErrorCodes.InvalidParameterValue
          );
        }
      } else {
        if (!IMI.defined(mimeType) || !IMI.isString(mimeType)) {
          mimeType = file.type;
        }
        //upload file
        var headers = {
          secretKey: _imiconnect.appSecret,
          sdkversion: sdkversion,
        };
        if (_imiconnect.securedToken) {
          headers.Authorization = _imiconnect.securedToken;
        }
        if (mimeType) {
          headers["media-type"] = mimeType;
        }
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }
        var formData = new FormData();
        formData.append("media", file);
        var fileUploadURL =
          elbZeroRatingUploadURL +
          "/media/" +
          _imiconnect.appName +
          "/upload?previewRequired=true&fileUrlRequired=true";
        $.ajax({
          url: fileUploadURL,
          type: "POST",
          data: formData,
          contentType: false,
          cache: false,
          processData: false,
          headers: headers,
          xhr: function () {
            //upload Progress
            var xhr = $.ajaxSettings.xhr();
            if (xhr.upload) {
              xhr.upload.addEventListener(
                "progress",
                function (event) {
                  var position = event.loaded || event.position;
                  var total = event.total;
                  if (
                    callback &&
                    IMI.isFunction(callback.onFileUploadProgress)
                  ) {
                    callback.onFileUploadProgress(file, position, total);
                  }
                },
                true
              );
            }
            return xhr;
          },
          success: function (resp) {
            if (resp && resp.code === 36) {
              if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                //checking Callback is there or not
                callback.onFileUploadComplete(
                  file,
                  "",
                  IMI.ICErrorCodes.InvalidContentType
                );
              }
            } else if (resp.mediaId) {
              if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                callback.onFileUploadComplete(file, resp.mediaId, null, resp);
              }
            } else {
              if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                callback.onFileUploadComplete(
                  file,
                  "",
                  IMI.ICErrorCodes.InternalError
                );
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
              //checking Callback is there or not
              callback.onFileUploadComplete(
                file,
                "",
                IMI.ICErrorCodes.InternalError
              );
            }
          },
        });
      }
    };
    Constr.regenerateMediaURL = function (mediaUrl, callback) {
      var isRegEn = _imiconnect.isRegistered();
      if (!isRegEn) {
        if (callback && IMI.isFunction(callback.onFailure)) {
          callback.onFailure(IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered);
        }
        return;
      }
      if (mediaUrl.trim().length == 0) {
        if (callback && IMI.isFunction(callback.onFailure)) {
          callback.onFailure(IMI.ICErrorCodes.InvalidParameterValue);
        }
      }
      var qs = _util.getQueryString(mediaUrl);
      if (qs.exp) {
        let now = new Date().getTime();
        if (now < parseInt(qs.exp)) {
          if (callback && typeof callback.onSuccess == "function")
            callback.onSuccess(mediaUrl);
          return;
        }
      }

      var headers = {
        secretKey: _imiconnect.appSecret,
      };
      if (_imiconnect.securedToken)
        headers.Authorization = _imiconnect.securedToken;
      if (_imiconnect.accessToken)
        headers.accessToken = _imiconnect.accessToken;

      var postData = {
        url: mediaUrl,
      };
      var generateMediaApi = `${elbZeroRatingURL}/${_imiconnect.appName}/user/${_imiconnect.iCDeviceProfile.userId}/generatemedia`;
      var options = {
        url: generateMediaApi,
        type: "POST",
        data: JSON.stringify(postData),
        headers: headers,
        success: function (resp) {
          if (resp && resp.code == "0") {
            if (callback && typeof callback.onSuccess == "function")
              callback.onSuccess(resp.url);
            else _imiconnect._invokeFailureCallBack(callback, resp);
          } else if (resp && resp.code == "1") {
            if (callback && typeof callback.onFailure == "function")
              callback.onFailure(resp.status);
          } else _imiconnect._invokeFailureCallBack(callback, resp);
        },
        error: function (responseData, textStatus, errorThrown) {
          if (callback && IMI.isFunction(callback.onFailure)) {
            callback.onFailure(errorThrown);
          }
        },
      };
      $.ajax(options);
    };
    return Constr;
  })();

  IMI.namespace("IMI.ICFileUploadCallback");
  IMI.ICFileUploadCallback = (function () {
    var Constr;
    Constr = function () {
      this.onFileUploadComplete = function (file, mediaId, error) {
      };
      this.onFileUploadProgress = function (file, bytesUploaded, bytesTotal) {
      };
    };
    return Constr;
  })();

  //web push logic
  IMI.namespace("IMI.WebPushClient");
  IMI.WebPushClient = (function () {
    var Constr = function () {
      var self = this;
      self.isRegister = false;
      self.headers = { secretKey: _imiconnect.appSecret };
      var browserName = (self.browserName = IMI.getBrowserName());

      if (browserName === "chrome" || browserName === "firefox") {
        try {
          firebase.initializeApp(config);
          messaging = firebase.messaging();
        } catch (error) {
          IMI.log("please add firebase related resources ", error);
        }
      }
    };
    Constr.prototype = {
      init: function (appid, userId, callback) {
        var self = this;
        self.appid = appid;
        self.userId = userId;
        self.deviceId = _imiconnect.iCDeviceProfile.deviceId;
        self.regcallback = callback;
        var browserName = (self.browserName = IMI.getBrowserName());
        if (browserName === "chrome" || browserName === "firefox") {
          self.initFCM();
        } else if (browserName === "safari") {
          self.initSafari();
        } else {
          IMI.log("other browser... ");
        }
      },
      initFCM: function () {
        var self = this;
        try {
          if (Notification.permission === "denied") {
            return false;
          }

          // Check if push messaging is supported
          if (!("PushManager" in window)) {
            return false;
          }

          //add manifest file in header
          var head = document.head;
          var noManifest = true;
          // Walk through the head to check if a manifest already exists
          for (var i = 0; i < head.childNodes.length; i++) {
            if (head.childNodes[i].rel === "manifest") {
              noManifest = false;
              break;
            }
          }
          if (noManifest) {
            var manifest = document.createElement("link");

            manifest.href =
              _imiconnect.icConfig.getAssetPath() +
              "manifest/manifest_" +
              self.appid +
              ".json";
            manifest.rel = "manifest";
            document.head.appendChild(manifest);
          }

          self.FCMRegistartion();
        } catch (ex) {
          IMI.log("exception in chrome init :: ", ex);
        }
      },
      FCMRegistartion: function () {
        //registration code
        var self = this;
        var profileUpdateAPIURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/profileupdate";
        try {
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker
              .register(
                window.location.origin +
                _imiconnect.icConfig.getRoot() +
                "sw.js",
                { scope: _imiconnect.icConfig.getRoot() }
              )
              .then(function () {
                return navigator.serviceWorker.ready;
              })
              .then(function (registration) {
                messaging.useServiceWorker(registration);
                messaging
                  .requestPermission()
                  .then(function () {
                    messaging
                      .getToken()
                      .then(function (pushId) {
                        if (pushId) {
                          _db.set("pushRegistered", "true");
                          //update
                          var data = {
                            tenant: "1",
                            event: "ProfileUpdate",
                            channel: "rt",
                            channelType: "web",
                            clientId: _imiconnect.clientId,
                            data: {
                              update: {
                                pushId: pushId,
                                useragent: navigator.userAgent,
                                os: IMI.getBrowserName(),
                                osversion: IMI.getbrowserVersion(),
                                language: navigator.language,
                              },
                            },
                            state: "PROFILEUPDATE",
                          };

                          var reqdata = _messagingInstance._getPayLoadMsg(
                            JSON.stringify(data)
                          );
                          var headers = {
                            "Content-Type": "application/json",
                            secretKey: _imiconnect.appSecret,
                            sdkversion: sdkversion,
                          };
                          if (_imiconnect.securedToken) {
                            headers.Authorization = _imiconnect.securedToken;
                          }
                          if (_imiconnect.accessToken) {
                            headers.accessToken = _imiconnect.accessToken;
                          }
                          var callback = {
                            onFailure: function (error) {
                              _imiconnect._invokeListeners(error);
                            },
                          };
                          IMI.Post(
                            profileUpdateAPIURL,
                            reqdata,
                            headers,
                            callback
                          );
                          self.returnCallBack({ pushId: pushId });
                          self.onMessageHandler();
                        } else {
                          // Show permission request.
                          IMI.log(
                            "No Instance ID token available. Request permission to generate one."
                          );
                        }
                      })
                      .catch(function (err) {
                        IMI.log(
                          "An error occurred while retrieving token. ",
                          err
                        );
                      });
                  })
                  .catch(function (err) {
                    IMI.log("Unable to get permission to notify.", err);
                  });
              })
              .catch(function (error) {
                IMI.log("Service Worker Error :", error);
              });
            //on token refresh event
            messaging.onTokenRefresh(function () {
              messaging
                .getToken()
                .then(function (pushId) {
                  //update
                  _db.set("pushRegistered", "true");
                  var data = {
                    tenant: "1",
                    event: "ProfileUpdate",
                    channel: "rt",
                    channelType: "web",
                    clientId: _imiconnect.clientId,
                    data: {
                      update: {
                        pushId: pushId,
                        useragent: navigator.userAgent,
                        os: IMI.getBrowserName(),
                        osversion: IMI.getbrowserVersion(),
                        language: navigator.language,
                      },
                    },
                    state: "PROFILEUPDATE",
                  };
                  var reqdata = _messagingInstance._getPayLoadMsg(
                    JSON.stringify(data)
                  );
                  var headers = {
                    "Content-Type": "application/json",
                    secretKey: _imiconnect.appSecret,
                    sdkversion: sdkversion,
                  };
                  if (_imiconnect.securedToken) {
                    headers.Authorization = _imiconnect.securedToken;
                  }
                  if (_imiconnect.accessToken) {
                    headers.accessToken = _imiconnect.accessToken;
                  }
                  var callback = {
                    onFailure: function (error) {
                      _imiconnect._invokeListeners(error);
                    },
                  };
                  IMI.Post(profileUpdateAPIURL, reqdata, headers, callback);
                  self.returnCallBack({ pushId: pushId });
                  self.onMessageHandler();
                })
                .catch(function (err) {
                  IMI.log("Unable to retrieve refreshed token ", err);
                });
            });
          } else {
            IMI.log("ServiceWorker not supported :-(");
          }
        } catch (ex) {
          IMI.log("exception in chrome init :: ", ex);
        }
      },
      onMessageHandler: function () {
        if (messaging) {
          messaging.onMessage(function (payload) {
            IMI.log("Local Message received. ", payload);
            var dataObj = payload.data || {};
            var title = dataObj.title || "";
            var body = dataObj.alert || "";
            var extras = {};
            if (dataObj.extras) {
              extras = JSON.parse(dataObj.extras);
            }
            var icon = extras.iconurl;
            var tag = payload.collapse_key || dataObj.tid;
            var pushextras = {};
            var appId = dataObj.appId;
            pushextras.appId = appId;
            pushextras.tid = dataObj.tid;
            pushextras.url = extras.url;
            var notificationOptions = {
              body: body,
              icon: icon,
              tag: tag,
              requireInteration: true,
              data: pushextras,
            };
            var trackDeliveryURL =
              elbZeroRatingURL +
              "/" +
              _imiconnect.appName +
              "/trackDeliveryRequest" +
              "?tid=" +
              dataObj.tid +
              "&appId=" +
              _imiconnect.appName;
            //sendig DR
            fetch(trackDeliveryURL).catch(function (err) {
              IMI.log(err);
            });
            //showing local notification
            if ("PushManager" in window) {
              navigator.serviceWorker.ready.then(function (
                serviceWorkerRegistration
              ) {
                return serviceWorkerRegistration.showNotification(
                  title,
                  notificationOptions
                );
              });
            }
          });
        }
      },
      returnCallBack: function (obj) {
        var self = this;
        obj = obj || {};
        obj.appId = self.appid;
        obj.userId = self.userId;
        if (self.regcallback) {
          if (IMI.isFunction(self.regcallback)) {
            self.regcallback(obj);
          } else if (
            self.regcallback.onSuccess &&
            IMI.isFunction(self.regcallback.onSuccess)
          ) {
            self.regcallback.onSuccess(obj);
          }
        } else {
          IMI.log("callback is not set ", obj);
        }
      },
      initSafari: function () {
        safariself = this;
        var permissionData = window.safari.pushNotification.permission(
          imipush.safariWebPushId
        );
        safariself.checkRemotePermission(permissionData);
      },
      checkRemotePermission: function (permissionData) {
        var self = this;
        if (permissionData.permission === "default") {
          // This is a new web service URL and its validity is unknown.
          window.safari.pushNotification.requestPermission(
            safariRegisterURL, // The web service URL.//
            imipush.safariWebPushId, // The Website Push ID.
            {}, // Data used to help you identify the user.
            self.checkRemotePermission // The callback function.
          );
        } else if (permissionData.permission === "denied") {
          // The user said no. Talk to your UX expert to see what you can do to entice your
          // users to subscribe to push notifications.
        } else if (permissionData.permission === "granted") {
          var profileUpdateAPIURL =
            elbZeroRatingURL + "/" + _imiconnect.appName + "/profileupdate";
          _db.set("pushRegistered", "true");
          var data = {
            tenant: "1",
            event: "ProfileUpdate",
            clientId: _imiconnect.clientId,
            channel: "rt",
            channelType: "web",
            data: {
              update: {
                pushId: permissionData.deviceToken,
                useragent: navigator.userAgent,
                os: IMI.getBrowserName(),
                osversion: IMI.getbrowserVersion(),
                language: navigator.language,
              },
            },
            state: "PROFILEUPDATE",
          };
          var headers = {
            "Content-Type": "application/json",
            secretKey: _imiconnect.appSecret,
            sdkversion: sdkversion,
          };
          if (_imiconnect.securedToken) {
            headers.Authorization = _imiconnect.securedToken;
          }
          if (_imiconnect.accessToken) {
            headers.accessToken = _imiconnect.accessToken;
          }
          var reqdata = _messagingInstance._getPayLoadMsg(JSON.stringify(data));

          var callback = {
            onFailure: function (error) {
              _imiconnect._invokeListeners(error);
            },
          };
          IMI.Post(profileUpdateAPIURL, reqdata, headers, callback);
          safariself.returnCallBack({ pushId: permissionData.deviceToken });
        }
      },
      unsubscribe: function (callback) {
        var self = this;
        try {
          if (!self.browserName) {
            self.browserName = IMI.getBrowserName();
          }
          var browserName = self.browserName;
          if (
            browserName === "chrome" ||
            (browserName === "firefox" && navigator.serviceWorker)
          ) {
            navigator.serviceWorker.ready.then(function (
              serviceWorkerRegistration
            ) {
              messaging
                .getToken()
                .then(function (currentToken) {
                  if (currentToken) {
                    messaging
                      .deleteToken(currentToken)
                      .then(function () {
                        if (callback && IMI.isFunction(callback)) {
                          var Obj = {};
                          Obj.status = "0";
                          Obj.description =
                            "Webpush  successsfully unsubscribed";
                          callback(Obj);
                        }
                      })
                      .catch(function (err) {
                        IMI.log("Unable to delete token. ", err);
                      });
                  } else {
                    if (callback && IMI.isFunction(callback)) {
                      var Obj = {};
                      Obj.status = "1";
                      Obj.description = "Not yet registered!";
                      callback(Obj);
                    }
                  }
                })
                .catch(function (err) {
                  IMI.log("Error retrieving Instance ID token. ", err);
                });
            });
          } else if (browserName === "safari") {
          }
        } catch (ex) { }
      },
      getWebSubscriptionDetials: function (callback) {
        var self = this;
        if (!self.browserName) {
          self.browserName = IMI.getBrowserName();
        }
        var browserName = self.browserName;
        if (!IMI.isFunction(callback)) {
          callback = function (obj) {
            IMI.log("callback function not sent :: pushdetails", obj);
          };
        }
        if (browserName === "chrome" || browserName === "firefox") {
          self.getSubscriptionDetails(callback);
        } else if (browserName === "safari") {
          self.getSafariSubscriptionDetails(callback);
        } else {
          IMI.log("other browser... browserName ::", browserName);
        }
      },
      getSubscriptionDetails: function (callback) {
        var self = this;
        try {
          navigator.serviceWorker.ready.then(function (
            serviceWorkerRegistration
          ) {
            messaging
              .getToken()
              .then(function (pushId) {
                if (!pushId) {
                  var Obj = {};
                  Obj.status = "1";
                  Obj.description = "app is not registered, please register";
                  callback(Obj);
                }

                var Obj = {};
                Obj.status = "0";
                if (
                  self.browserName === "chrome" ||
                  self.browserName === "firefox"
                ) {
                  Obj.pushId = pushId;
                }
                callback(Obj);
              })
              .catch(function (err) {
                var Obj = {};
                Obj.status = "1";
                Obj.description = "app is not registered, please register";
                callback(Obj);
              });
          });
        } catch (ex) {
          var Obj = {};
          Obj.status = "1";
          Obj.description = "app is not registered, please register";
          callback(Obj);
        }
      },
      getSafariSubscriptionDetails: function (callback) {
        if ("safari" in window && "pushNotification" in window.safari) {
          var permissionData = window.safari.pushNotification.permission(
            imipush.safariWebPushId
          );
          if (permissionData && permissionData.permission === "granted") {
            var Obj = {};
            Obj.status = "0";
            Obj.pushId = permissionData.deviceToken;
            callback(Obj);
            return true;
          }
        }
        var Obj = {};
        Obj.status = "1";
        Obj.description = "app is not registered, please register";
        callback(Obj);
        return true;
      },
    };
    return Constr;
  })();
  class IMISessionDB {
    constructor(prefix) {
      if (!prefix) {
        throw "Please provide a unique prefix";
        return;
      }
      this.prefix = prefix;

      window.sessionStorage.setItem(this.prefix, JSON.stringify(this.getStore()));
    }
    add(v) {
      let temp = this.getStore();
      if (v instanceof Array)
        v.forEach(vi => temp.push(vi));
      else temp.push(v);

      window.sessionStorage.setItem(this.prefix, JSON.stringify(temp));
    }
    getStore() {
      let temp = window.sessionStorage.getItem(this.prefix);
      return temp ? JSON.parse(temp) : [];
    }
    exists(k) {
      return this.getStore().includes(k);
    }
    prefix;
  }
})(IMI);

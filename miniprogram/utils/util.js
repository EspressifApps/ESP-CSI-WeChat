
import { store } from './store'
const app = getApp()
var context;
var cx = 0;
var cy = 0;
var radius = 0;
var canvas;
var stepClear = 1;
 // 存储配网过的密码
const setWifiStorage = (name, pwd) => {
  var wifiStorage = getWifiStorage()
  wifiStorage[name] = pwd;
  wx.setStorage({
    key: "WIFISTORAGE",
    data: wifiStorage
  })
}
// 获取存储的WiFi信息
const getWifiStorage = () => {
  var wifiStorage = wx.getStorageSync("WIFISTORAGE");
  if (isEmpty(wifiStorage)) {
    wifiStorage = {};
  }
  return wifiStorage;
}
 // 调用云函数
const onGetOpenid = () => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log(res)
        app.globalData.openid = res.result.userInfo.openId
        resolve(res)
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err)
        reject(err)
      }
    })
  })
}
const setGlobalData = (userInfo) => {
  app.globalData.avatarUrl = userInfo.avatarUrl
  app.globalData.userInfo = userInfo
}
const jump = (isHome) => {
  if (isHome) {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  } else {
    store.appToken = wx.getStorageSync("appToken");
    wx.navigateBack({
      delta: 1
    })
  }
}
const getUserInfo = () => {
  return new Promise((resolve, reject) => {
    wx.getUserInfo({
      success(res) {
        console.log(res)
        setGlobalData(res.userInfo)
        resolve(res)
      },
      fail (err) {
        console.log(err);
        reject(err)
      }
    })
  })
}
// 创建色盘
const createCanvas = (color) => {
  const query = wx.createSelectorQuery()
  query.select('#firstCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      var width = res[0].width;
      var height = res[0].width;
      var radLarge = (width / 2) - 5;
      var radSmall = radLarge - 35;
      cx = width / 2;
      cy = height / 2;
      // segment construction
      canvas = res[0].node;
      context = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio
      canvas.width = res[0].width * dpr
      canvas.height = res[0].height * dpr
      context.scale(dpr, dpr)
      for (let i = 1; i <= 360; i++) {
        let a = i;
        let b = i - 1;
        radius = radSmall + (radLarge - radSmall) / 2;
        let x1 = Math.cos(toRadians(a)) * radius + cx;
        let y1 = Math.sin(toRadians(a)) * radius + cy;
        let x2 = Math.cos(toRadians(b)) * radius + cx;
        let y2 = Math.sin(toRadians(b)) * radius + cy;
        let g = context.createLinearGradient(x1, y1, x2, y2);
        var rgb1 = hsv2rgb(a, 100, 100);
        var rgb2 = hsv2rgb(b, 100, 100);
        g.addColorStop(0, 'rgb( ' + rgb1[0] + ', ' + rgb1[1] + ', ' + rgb1[2] + ')');
        g.addColorStop(1, 'rgb( ' + rgb2[0] + ', ' + rgb2[1] + ', ' + rgb2[2] + ')');
        let o = 0.002;
        context.beginPath();
        context.arc(cx, cy, radSmall, toRadians(b) - o, toRadians(a) + o, false);
        context.arc(cx, cy, radLarge, toRadians(a) + o, toRadians(b) - o, true);
        context.fillStyle = g;
        context.fill();
      }
      createArc(color);
    });
}
// 创建色盘圆心
const createArc = (color) => {
  context.beginPath();
  context.arc(cx, cy, radius * 0.52, 0, 2 * Math.PI);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = color;
  context.stroke();
  var img = canvas.createImage();
  img.src = '../../images/img-light.png'
  //图片加载完后，将其显示在canvas中
  img.onload = function(){
      context.drawImage(this, cx - 23, cy - 23, 46, 46)
  }
}
// 设置颜色
const setColor = (color) => {
  stepClear = 1;
  clearArc(cx, cy, radius * 0.54);
  createArc(color);
}
// 清除
const clearArc = (x, y, radius) => {
  var calcWidth = radius - stepClear;
  var calcHeight = Math.sqrt(radius * radius - calcWidth * calcWidth);
  var posX = x - calcWidth;
  var posY = y - calcHeight;
  var widthX = 2 * calcWidth;
  var heightY = 2 * calcHeight;
  if(stepClear <= radius){
    context.clearRect(posX, posY, widthX, heightY);
    stepClear += 1;
    clearArc(x, y, radius);
  }
}
const toRadians = (angle) => {
  return angle * (Math.PI / 180);
}
// 获取色盘选中的颜色
const getColor = (event, pixelRatio, currentLuminanceText) => {
  return new Promise((resolve, reject) => {
    try {
      var x = event.touches[0].x,
      y = event.touches[0].y;
      var da = context.getImageData(x * pixelRatio, y * pixelRatio, 1, 1).data;
      var r = da[0],
        g = da[1],
        b = da[2];
      // 特殊值过滤
      if ((r == 0 && g == 0 && b == 0) || (r == 18 && g == 21 && b == 30)) {
        return false;
      } else {
        var color = "rgba(" + r + ", " + g + ", " + b + ", " + currentLuminanceText / 100 + ")";
        setColor(color)
        resolve({r: r, g: g, b: b, color: color})
      }
    } catch (err) {
      reject(err)
    }
  })
}
// hsv 转 rgb
const hsv2rgb = (h, s, v) => {
  h = h / 360;
  s = s / 100;
  v = v / 100;
  var r, g, b;
  var i = Math.floor(h * 6);
  var f = h * 6 - i;
  var p = v * (1 - s);
  var q = v * (1 - f * s);
  var t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
// rgb 转 hsv
const rgb2hsv = (r, g, b) => {
  r = r / 255, g = g / 255, b = b / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, v = max;
  var d = max - min;
  s = max == 0 ? 0 : d / max;
  if (max == min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

//判断非空
const isEmpty = str => {
  if (str === "" || str === '""' || str === "''" || str === null || str === undefined || str === "null" || str === "undefined") {
    return true
  }
  return false
}
//转16进制
const ab2hex = buffer => {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr;
}
//16进制转字符串
const hexCharCodeToStr = hexCharCodeStr => {
  var trimedStr = hexCharCodeStr.trim()
  var rawStr = trimedStr.substr(0, 2).toLowerCase() === "0x" ? trimedStr.substr(2) : trimedStr
  var len = rawStr.length
  if (len % 2 !== 0) {
    alert("Illegal Format ASCII Code!")
    return ''
  }
  var curCharCode
  var resultStr = []
  for (var i = 0; i < len; i = i + 2) {
    curCharCode = parseInt(rawStr.substr(i, 2), 16) // ASCII Code Value
    resultStr.push(String.fromCharCode(curCharCode))
  }
  return resultStr.join('')
}
// 判断是否是JSON
const isJSON = str => {
  if (typeof str == 'string') {
    try {
      var obj = JSON.parse(str)
      if (typeof obj == 'object' && obj) {
        return true
      }
      return false
    } catch (e) {
      return false
    }
  }
}

const showToast = msg => {
  wx.showToast({
    title: msg,
    icon: 'none'
  })
}
const showLoading = msg => {
  wx.showLoading({
    title: msg,
    mask: true
  });
}
const showLoadingMask = msg => {
  wx.showLoading({
    title: msg,
    mask: false
  });
}
const showIconToast = (msg, icon) => {
  wx.showToast({
    title: msg,
    icon: icon
  })
}
const showConfirmModal = (content, confirmText, title) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title || '系统提示',
      content: content,
      showCancel: false,
      confirmText: confirmText || '确定',
      success(res) {
        if (res.confirm) {
          resolve()
        } else if (res.cancel) {
          reject()
        }
      }
    })
  })
}
const showCancelModal = (content, confirmText, title) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title || '系统提示',
      content: content,
      confirmText: confirmText || '确定',
      success(res) {
        if (res.confirm) {
          resolve()
        } else if (res.cancel) {
          reject()
        }
      }
    })
  })
}
const showModel = (title, content, flag) => {
  wx.hideLoading()
  wx.showModal({
    title: title,
    content: content,
    showCancel: flag,
    success(res) {
    }
  })
}
const wifiErrMsg = (errCode, errMsg) => {
  var text = "";
  switch (errCode) {
    case 12000: 
      text = '未先调用 startWifi 接口'
      break;
    case 12001:
      text = '当前系统不支持相关能力'
      break;
    case 12002:
      text = '密码错误'
      break;
    case 12003:
      text = '连接超时'
      break;
    case 12004:
      text = '重复连接 Wi-Fi'
      break;
    case 12005:
      text = 'Android 特有，未打开 Wi-Fi 开关'
      break;
    case 12006:
      text = 'Android 特有，未打开 GPS 定位开关'
      break;
    case 12007:
      text = '用户拒绝授权链接 Wi-Fi'
      break;
    case 12008:
      text = '无效 SSID'
      break;
    case 12009:
      text = '系统运营商配置拒绝连接 Wi-Fi'
      break;
    case 12010:
      text = '系统其他错误，需要在 errmsg 打印具体的错误原因'
      break;
    case 12011:
      text = '应用在后台无法配置 Wi-Fi'
      break;
    case 12013:
      text = '系统保存的 Wi-Fi 配置过期，建议忘记 Wi-Fi 后重试'
      break;
    default: 
      text = errMsg
      break;
  }
  return text;
}
const getSystemInfo = () => {
  const res = wx.getSystemInfoSync();
  console.log(res)
  app.globalData.platform = res.platform
  app.globalData.system = res.system.split(" ")[1];
  if (app.globalData.platform == "ios" && app.globalData.system < '11') {
    showCancelModal('当前手机系统版本过低不支持小程序内连接 Wi-Fi.').then(() => {
      getSystemInfo()
    });
  }
}
const BASE64 = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  encode: function(e) {
    var t = "";
    var n, r, i, s, o, u, a;
    var f = 0;
    e = this._utf8_encode(e);
    while (f < e.length) {
      n = e.charCodeAt(f++);
      r = e.charCodeAt(f++);
      i = e.charCodeAt(f++);
      s = n >> 2;
      o = (n & 3) << 4 | r >> 4;
      u = (r & 15) << 2 | i >> 6;
      a = i & 63;
      if (isNaN(r)) {
        u = a = 64
      } else if (isNaN(i)) {
        a = 64
      }
      t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a)
    }
    return t
  },
  decode: function(e) {
    var t = "";
    var n, r, i;
    var s, o, u, a;
    var f = 0;
    e = e.replace(/[^A-Za-z0-9+/=]/g, "");
    while (f < e.length) {
      s = this._keyStr.indexOf(e.charAt(f++));
      o = this._keyStr.indexOf(e.charAt(f++));
      u = this._keyStr.indexOf(e.charAt(f++));
      a = this._keyStr.indexOf(e.charAt(f++));
      n = s << 2 | o >> 4;
      r = (o & 15) << 4 | u >> 2;
      i = (u & 3) << 6 | a;
      t = t + String.fromCharCode(n);
      if (u != 64) {
        t = t + String.fromCharCode(r)
      }
      if (a != 64) {
        t = t + String.fromCharCode(i)
      }
    }
    t = this._utf8_decode(t);
    return t
  },
  _utf8_encode: function(e) {
    e = e.replace(/rn/g, "n");
    var t = "";
    for (var n = 0; n < e.length; n++) {
      var r = e.charCodeAt(n);
      if (r < 128) {
        t += String.fromCharCode(r)
      } else if (r > 127 && r < 2048) {
        t += String.fromCharCode(r >> 6 | 192);
        t += String.fromCharCode(r & 63 | 128)
      } else {
        t += String.fromCharCode(r >> 12 | 224);
        t += String.fromCharCode(r >> 6 & 63 | 128);
        t += String.fromCharCode(r & 63 | 128)
      }
    }
    return t
  },
  _utf8_decode: function(e) {
    var t = "";
    var n = 0;
    var r = 0;
    var c1 = 0;
    var c2 = 0;
    var c3 = 0;
    while (n < e.length) {
      r = e.charCodeAt(n);
      if (r < 128) {
        t += String.fromCharCode(r);
        n++
      } else if (r > 191 && r < 224) {
        c2 = e.charCodeAt(n + 1);
        t += String.fromCharCode((r & 31) << 6 | c2 & 63);
        n += 2
      } else {
        c2 = e.charCodeAt(n + 1);
        c3 = e.charCodeAt(n + 2);
        t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
        n += 3
      }
    }
    return t
  }
}
const formatNumber = (n) => {
  n = n.toString()
  return n[1] ? n : '0' + n
}
const isUndefined = (val) => {
  return val ? val : ''
}
module.exports = {
  onGetOpenid,
  setGlobalData,
  getUserInfo,
  showLoading,
  showLoadingMask,
  showToast,
  showIconToast,
  showModel,
  showConfirmModal,
  showCancelModal,
  createCanvas,
  getColor,
  hsv2rgb,
  rgb2hsv,
  isEmpty,
  ab2hex,
  hexCharCodeToStr,
  jump,
  isJSON,
  getWifiStorage,
  setWifiStorage,
  wifiErrMsg,
  getSystemInfo,
  BASE64,
  formatNumber,
  isUndefined
}
const app = getApp();
const aesjs = require('../js/aes.js');
const Sha256 = require('../js/sha256.js');
const curve25519 = require('../js/curve25519-js.js'); // 引入椭圆加密
const protobuf = require('../weichatPb/protobuf.js'); //引入protobuf模块
const sessionProto = require('../proto/session.js');
const wifiScanProto = require('../proto/wifi_scan.js');
const wifiConfigProto = require('../proto/wifi_config.js');
var aesCtr = "";
const requestBuffer = (url, buffer) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded', // 默认值
      },
      responseType: 'arraybuffer',
      data: buffer,
      success(res) {
        console.log("238:", res)
        resolve(res.data)
      },
      fail(res) {
        console.log(res)
        reject(res);
      }
    })
  })
  
}
const request = (url, data) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded', // 默认值
      },
      timeout: 150000,
      data: data,
      success(res) {
        console.log("65:", res)
        resolve(res.data)
      },
      fail(res) {
        reject(res)
      }
    })
  })
}
// 获取版本、是否加密等信息
const getSessionVer = () => {
  return new Promise((resolve, reject) => {
    request(app.globalData.sendVerurl, 'none').then(res => {
      console.log(res)
      resolve(res.prov && res.prov.cap && res.prov.cap.indexOf('no_sec') == -1)
    }).catch(err => {
      reject()
      console.info('getSessionVer-error', err)
    })
  })
}
// 
const protoSession = (isSec) => {
  var sessionRoot = protobuf.Root.fromJSON(sessionProto)
  var SessionData = sessionRoot.lookupType("SessionData")
  var payload = {}
  var key = ''
  if (isSec) {
    key = curve25519.generateKeyPair(new Uint8Array(rand()))
    var sec1 = require('../proto/sec1.js')
    var sec1Root = protobuf.Root.fromJSON(sec1)
    var Sec1Payload = sec1Root.lookupType("Sec1Payload")
    var SessionCmd0 = sec1Root.lookupType("SessionCmd0")
    var sessionCmd = { clientPubkey: key.public }
    sessionCmd = SessionCmd0.create(sessionCmd)
    var sec0bj = { sc0: sessionCmd }
    sec0bj = Sec1Payload.create(sec0bj)
    payload.secVer = 1
    payload.sec1 = sec0bj
  } else {
    var sec0 = require('../proto/sec0.js')
    var sec0Root = protobuf.Root.fromJSON(sec0)
    var Sec0Payload = sec0Root.lookupType("Sec0Payload")
    var S0SessionCmd = sec0Root.lookupType("S0SessionCmd")
    var sessionCmd = {}
    sessionCmd = S0SessionCmd.create(sessionCmd)
    var secObj = { sc: sessionCmd }
    secObj = Sec0Payload.create(secObj)
    payload.sec0 = secObj
  }
  payload = SessionData.create(payload)
  console.log("56", payload)
  return {key: key, buffer: toBuffer(SessionData.encode(payload).finish())};
}
const protobufSec1 = (pop, privateKey, devicePubkey, deviceRandom) => {
  var sessionRoot = protobuf.Root.fromJSON(sessionProto)
  var SessionData = sessionRoot.lookupType("SessionData")
  var Sec1Payload = SessionData.lookupType("Sec1Payload")
  var SessionCmd1 = SessionData.lookupType("SessionCmd1")
  console.log("private", privateKey)
  console.log("devicePubkey", devicePubkey)
  console.log("pop", pop)
  var secretKey = curve25519.sharedKey(privateKey, devicePubkey)
  if (!pop) {
    var v2 = new Uint8Array(Sha256.arrayBuffer(pop))
    const secret = new Uint8Array(32)
    for (let i = 0; i < 32; ++i) {
      secret[i] = secretKey[i] ^ v2[i]
    }
    secretKey = secret
  }
  var devRand = new Uint8Array(deviceRandom)
  aesCtr = new aesjs.ModeOfOperation.ctr(secretKey, new aesjs.Counter(devRand))
  var clientVerifyData = aesCtr.encrypt(devicePubkey)
  var sessionCmd = { clientVerifyData: clientVerifyData }
  sessionCmd = SessionCmd1.create(sessionCmd)
  var sec1bj = { msg: 2, sc1: sessionCmd }
  sec1bj = Sec1Payload.create(sec1bj)
  var payload = {}
  payload.secVer = 1
  payload.sec1 = sec1bj
  payload = SessionData.create(payload)
  console.log("336", payload)
  return {secretKey: secretKey, buffer: toBuffer(bufSessionData.encode(payload).finish())}
}
// 发送WiFi信息
const wifiConfig = (isSec, ssid, passwrod) => {
  var wifiConfigRoot = protobuf.Root.fromJSON(wifiConfigProto)
  var wiFiConfigPayload = wifiConfigRoot.lookupType("WiFiConfigPayload")
  var cmdSetConfig = wifiConfigRoot.lookupType("CmdSetConfig")
  var cmdPayload = {}
  cmdPayload.ssid = ssid
  cmdPayload.passphrase = passwrod
  cmdPayload = cmdSetConfig.create(cmdPayload)
  var payload = {}
  payload.msg = 2
  payload.cmdSetConfig = cmdPayload
  payload = wiFiConfigPayload.create(payload)
  console.log(payload)
  var buffer = wiFiConfigPayload.encode(payload).finish()
  if (isSec) {
    buffer = aesCtr.encrypt(buffer)
  }
  return toBuffer(buffer)
}
// 告知设备发送的凭据连接至 AP
const applyWifiConfig = (isSec) => {
  var wifiConfigRoot = protobuf.Root.fromJSON(wifiConfigProto)
  var wiFiConfigPayload = wifiConfigRoot.lookupType("WiFiConfigPayload")
  var payload = {}
  payload.msg = 4
  payload = wiFiConfigPayload.create(payload)
  var buffer = wiFiConfigPayload.encode(payload).finish()
  if (isSec) {
    buffer = aesCtr.encrypt(buffer)
  }
  return toBuffer(buffer)
}
// 获取设备连接状态的Buffer
const getApplyStatus = (isSec) => {
  var wifiConfigRoot = protobuf.Root.fromJSON(wifiConfigProto)
  var cmdGetStatusPayload= wifiConfigRoot.lookupType("CmdGetStatus")
  var wiFiConfigPayload = wifiConfigRoot.lookupType("WiFiConfigPayload")
  var cmdGetStatus = {}
  cmdGetStatus = cmdGetStatusPayload.create(cmdGetStatus)
  var payload = {}
  payload.cmdGetStatus = cmdGetStatus
  payload = wiFiConfigPayload.create(payload)
  console.log(payload)
  var buffer = wiFiConfigPayload.encode(payload).finish()
  if (isSec) {
    buffer = aesCtr.encrypt(buffer)
  }
  return toBuffer(buffer)
}
// 解析返回（若加密则有第二次返回）
const decodeSessionResp0 = (data) => {
  return new Promise((resolve, reject) => {
    try {
      var sessionRoot = protobuf.Root.fromJSON(sessionProto);
      var sessionData = sessionRoot.lookupType("SessionData");
      console.log("358", sessionData.decode(data));
      resolve(sessionData.decode(data))
    } catch (err) {
      console.log(err)
      reject(err)
    }
  })
}
// 解析ssid和password返回和解析查询连接结果
const decodeWiFiConfig = (data, isSec) => {
  return new Promise((resolve, reject) => {
    try {
      var wifiConfigRoot = protobuf.Root.fromJSON(wifiConfigProto)
      var wiFiConfigPayload = wifiConfigRoot.lookupType("WiFiConfigPayload")
      if (isSec) {
        data = aesCtr.decrypt(new Uint8Array(data))
      }
      console.log(wiFiConfigPayload.decode(data))
      resolve(wiFiConfigPayload.decode(data))
    } catch (err) {
      console.error(err)
      reject(err)
    }
  })
}
// 加密验证
const check = (deviceVerifyData, publicKey) => {
  return new Promise((resolve, reject) => {
    try {
      var decryptedBytes = aesCtr.decrypt(deviceVerifyData);
      resolve(JSON.stringify(decryptedBytes) == JSON.stringify(publicKey))
    }catch(err) {
      console.log(err)
      reject(err)
    }
  })
}
const wifiScanReq = (isSec) => {
  var wifiScanRoot = protobuf.Root.fromJSON(wifiScanProto);
  var wifiScanStartPayload = wifiScanRoot.lookupType("CmdScanStart");
  var wifiScanPayload = wifiScanRoot.lookupType("WiFiScanPayload");
  var wifiScanStart = { blocking: true, groupChannels: 5, periodMs: 120 }
  wifiScanStart = wifiScanStartPayload.create(wifiScanStart);
  var payload = {};
  payload.cmdScanStart = wifiScanStart;
  payload = wifiScanPayload.create(payload);
  console.log(payload);
  var buffer = wifiScanPayload.encode(payload).finish();
  console.log(buffer);
  if (isSec) {
    buffer = aesCtr.encrypt(buffer);
  }
  return toBuffer(buffer);
}
const wifiScanReq1 = (isSec) => {
  var wifiScanRoot = protobuf.Root.fromJSON(wifiScanProto);
  var wifiScanPayload = wifiScanRoot.lookupType("WiFiScanPayload");
  var payload = {};
  payload.msg = 2;
  payload = wifiScanPayload.create(payload);
  console.log(payload);
  var buffer = wifiScanPayload.encode(payload).finish();
  console.log(buffer);
  if (isSec) {
    buffer = aesCtr.encrypt(buffer);
  }
  return toBuffer(buffer);
}
const wifiScanReq2 = (count, isSec) => {
  var wifiScanRoot = protobuf.Root.fromJSON(wifiScanProto);
  var cmdScanResultPayload = wifiScanRoot.lookupType("CmdScanResult");
  var wifiScanPayload = wifiScanRoot.lookupType("WiFiScanPayload");
  var cmdScanResult = { count: count };
  cmdScanResult = cmdScanResultPayload.create(cmdScanResult);
  var payload = {};
  payload.msg = 4;
  payload.cmdScanResult = cmdScanResult
  payload = wifiScanPayload.create(payload);
  console.log(payload);
  var buffer = wifiScanPayload.encode(payload).finish();
  console.log(buffer);
  if (isSec) {
    buffer = aesCtr.encrypt(buffer);
  }
  return toBuffer(buffer);
}
const wifiScanRes1 = (data, isSec) => {
  return new Promise((resolve, reject) => {
    try {
      var wifiScanRoot = protobuf.Root.fromJSON(wifiScanProto)
      var wiFiScanPayload = wifiScanRoot.lookupType("WiFiScanPayload")
      if (isSec) {
        data = aesCtr.decrypt(new Uint8Array(data))
      }
      console.log(wiFiScanPayload.decode(data))
      resolve(wiFiScanPayload.decode(data))
    } catch (err) {
      console.log(err);
      reject(err)
    }
  })
}
const rand = () => {
  　var arr = [];
  for (var i = 0; i < 32; i++) {
    arr.push(Math.floor(Math.random() * (255 - 1) + 1));
  }
  return arr;
}

const toBuffer = (buffer) => {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}


module.exports = {
  requestBuffer,
  request,
  getSessionVer,
  wifiConfig,
  applyWifiConfig,
  getApplyStatus,
  protoSession,
  protobufSec1,
  decodeSessionResp0,
  decodeWiFiConfig,
  check,
  wifiScanReq,
  wifiScanReq1,
  wifiScanReq2,
  wifiScanRes1,
  toBuffer,
}
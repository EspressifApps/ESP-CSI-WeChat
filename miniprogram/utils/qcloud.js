const app = getApp();
const hmacSHA1 = require("../js/hmac-sha1.js");
const Base64 = require("../js/enc-base64.js");
import { store } from './store'
import {isEmpty, BASE64} from'../utils/util.js';
const requestApi = (api, params) => {
  return new Promise((resolve, reject) => {
    var data = params
    data.Action = api
    data.AccessToken = app.globalData.token
    data.RequestId = getUuid()
    wx.request({
      url: 'https://iot.cloud.tencent.com/api/exploreropen/tokenapi',
      method: 'POST',
      data: data,
      timeout: 150000,
      header: {
        'content-type': 'application/json' // 默认值
      },
      success(res) {
        resolve(res)
      },
      fail(res) {
        reject(res)
      }
    })
  })
}
// 生成UUID，请求的唯一标识
const getUuid = () => {
  var len = 32;//32长度
  var radix = 16;//16进制
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  var uuid = [], i;
  radix = radix || chars.length;
  if (len) {
    for (i = 0; i < len; i++)uuid[i] = chars[0 | Math.random() * radix];
  } else {
    var r;
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';
    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | Math.random() * 16;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
  }
  return uuid.join('');
}
// 登录云端
const login = () => {
  return new Promise((resolve, reject) => {
    app.globalData.requestId = getUuid();
    var data = {
      "Action": "AppGetTokenByWeiXin",
      "AppKey": app.globalData.appkey,
      "Avatar": app.globalData.avatarUrl,
      "Timestamp": getTimestamp(),
      "NickName": app.globalData.userInfo.nickName,
      "Nonce": getNonce(),
      "RequestId": app.globalData.requestId,
      "WxOpenID": app.globalData.openid,
    }
    data.Signature = getSignature(data);
    wx.request({
      url: 'https://iot.cloud.tencent.com/api/exploreropen/appapi',
      method: 'POST',
      data: data,
      header: {
        'content-type': 'application/json' // 默认值
      },
      success(res) {
        wx.hideLoading();
        res = res.data;
        if (res.code == 0) {
          app.globalData.token = res.data.Data.Token;
          wx.setStorage({
            key: 'appToken',
            data: app.globalData.token,
          })
          store.appToken = app.globalData.token
          resolve(res)
        }
      },
      fail (err) {
        console.error(err)
        reject(err)
      }
    })
  })
}
// 获取家庭列表
const getFamilyList = (isGetDevices) => {
  requestApi('AppGetFamilyList', {}).then(res => {
    var res = res.data;
    if (res.code == 0) {
      var list = res.data.FamilyList;
      if (list.length == 0) {
        addFamily(app.globalData.userInfo.nickName, app.globalData.userInfo.country);
      } else {
        var family = list[0];
        store.familyId = family.FamilyId;
        store.familyName = family.FamilyName;
        getRoomList(store.familyId);
        if (isGetDevices) {
          getDeviceList(store.familyId);
        } else {
          wx.hideLoading()
        }
      }
    } else {
      wx.hideLoading();
    }
  }).catch(err => {
    console.error(err)
    store.showAddBtn = true;
    wx.hideLoading();
  })
}
// 根据家庭获取房间列表
const getRoomList = (familyId) => {
  requestApi('AppGetRoomList', {"FamilyId": familyId}).then(res => {
    var res = res.data;
      if (res.code == 0) {
        var list = res.data.RoomList;
        if (list.length > 0) {
          store.roomId = list[0].RoomId
        } else {
          addRoom(familyId);
        }
      }
  }).catch(err => {
    console.error(err)
    store.showAddBtn = true;
    wx.hideLoading();
  })
}
// 添加家庭
const addFamily = (name, address) => {
  requestApi('AppCreateFamily', {"Name": name, "address": address}).then(res => {
    wx.hideLoading();
    res = res.data;
    if (res.code == 0) {
      store.familyId = res.data.Data.FamilyId;
      addRoom(store.familyId);
    }
  }).catch((err) => {
    console.error(err)
    store.showAddBtn = true;
    wx.hideLoading();
  });
}
// 给某个家庭添加房间
const addRoom = (familyId) => {
  requestApi('AppCreateRoom', {"FamilyId": familyId, "Name": 'test'}).then(res => {
    res = res.data;
    if (res.code == 0) {
      store.roomId = res.data.Data.RoomId;
    }
  }).catch((err) => {
    console.error(err)
    store.showAddBtn = true;
    wx.hideLoading();
  });
}
// 获取家庭绑定的设备列表
const getDeviceList = (familyId) => {
  requestApi('AppGetFamilyDeviceList', {"FamilyId": familyId, "RoomId": ""}).then(res => {
    
    res = res.data;
    store.showAddBtn = true;
    if (res.code == 0) {
      res = res.data;
      if (res.Total > 0) {
        store.showAddBtn = false;
        var deviceList = res.DeviceList;
        var deviceIds = [];
        var deviceNames = [];
        var productId = "";
        deviceList.forEach((item) => {
          deviceIds.push(item.DeviceId);
          deviceNames.push(item.DeviceName)
          productId = item.ProductId;
        })
        getDevicesStatus(deviceIds, productId, deviceList);
        getDevicesData(deviceNames, productId, deviceList);
      } else {
        wx.hideLoading();
      }
    }
  }).catch(err => {
    console.error(err)
    store.showAddBtn = true;
    wx.hideLoading();
  });
}
// 获取设备状态
const getDevicesStatus = (deviceIds, productId, deviceList) => {
  requestApi('AppGetDeviceStatuses', {"ProductId": productId, "DeviceIds": deviceIds}).then(res => {
    res = res.data;
    if (res.code == 0) {
      res = res.data;
      // var deviceList = res.DeviceStatuses
      var deviceIds = [];
      var deviceStatuses = res.DeviceStatuses;
      deviceStatuses.forEach((item, i) => {
        for (let j = 0; j < deviceList.length; j++) {
          if (deviceList[j].DeviceId === item.DeviceId) {
            deviceList[j].subType = item.Online === 1 ? '在线' : '离线';
            deviceIds.push(item.DeviceId);
            break;
          }
        }
      })
      activePush(deviceIds);
      store.deviceList = deviceList;
    }
    wx.hideLoading();
  }).catch((res) => {
    console.error(res);
    wx.hideLoading();
  });
  
}
const getDevicesData = (deviceNames, productId, deviceList) => {
  deviceNames.forEach((item) => {
    requestApi('AppGetDeviceData', {"ProductId": productId, "DeviceName": item}).then(res => {
      res = res.data;
      console.log(res);
      if (res.code === 0) {
        res = res.data;
        var data = JSON.parse(res.Data);
        for (let i = 0; i < deviceList.length; i++) {
          if (deviceList[i].DeviceName == item && !isEmpty(data['wifi_rader_status'])) {
            for (var j in data) {
              deviceList[i][j] = data[j].Value
            }
            break;
          }
        }
        store.deviceList = deviceList;
      }
    }).catch((res) => {
      console.error(res);
      wx.hideLoading();
    });
  })
}
const activePush = (deviceIds) => {
  wx.connectSocket({"url": "wss://iot.cloud.tencent.com/ws/explorer"  });
  wx.onSocketOpen(res => {
    var data = JSON.stringify({
      "action": "ActivePush",
      "reqId": getUuid(),
      "params": {
        "DeviceIds": deviceIds,
        "AccessToken": app.globalData.token
      }
    })
    wx.sendSocketMessage({
      data: data,
      success (res) {
      },
      fail(res) {
      }
    })
  })
  wx.onSocketMessage(res => {
    let data;
    try {
      data = JSON.parse(res.data);
    } catch (e) {
    }
    try {
      if (data.push) {
        data = data.params;
        var payLoad = BASE64.decode(data.Payload);
        var deviceId = data.DeviceId;
        var deviceList = store.deviceList;
        switch (data.Type) {
          case "StatusChange": //上线下线
            console.log(data);
            for (let i = 0; i < deviceList.length; i++) {
              var item = deviceList[i]
              if (item.DeviceId == deviceId) {
                item.subType = data.SubType == 'Online' ? '在线' : '离线';
                deviceList.splice(i, 1, item);
                break;
              }
            }
            break;
          case "Property": //属性
            if (data.SubType == "Report") {
              if (!isEmpty(payLoad)) {
                payLoad = JSON.parse(payLoad);
                console.log(payLoad)
                var params = payLoad.params;
                console.log(params);
                for (let i = 0; i < deviceList.length; i++) {
                  var item = deviceList[i]
                  if (item.DeviceId == deviceId) {
                    for (let j in params) {
                      item[j] = params[j]
                    }
                    deviceList.splice(i, 1, item);
                    break;
                  }
                }
                var deviceInfo = store.deviceInfo;
                if (JSON.stringify(deviceInfo) != '{}' && deviceInfo.DeviceId == deviceId) {
                  for (let j in params) {
                    deviceInfo[j] = params[j]
                  }
                  store.deviceInfo = {};
                  store.deviceInfo = deviceInfo;
                }
              }
            }
            break;
        }
        store.deviceList = [];
        store.deviceList = deviceList;
      }
    } catch (e) {
      console.error(e)
    }
  })
}
const postData = (data, productId, deviceName) => {
  requestApi('AppControlDeviceData', {"ProductId": productId, "DeviceName": deviceName, "Data": data}).then((res) => {
    console.info(res)
  })
}
const getSignature = (data) => {
  var secretKey = app.globalData.secretKey;
  var srcStr = "";
  var newData = {};
  Object.keys(data).sort().map(key => {
    newData[key] = data[key]
  })
  for (var i in newData) {
    srcStr += i + "=" + newData[i] + "&";
  }
  srcStr = srcStr.substr(0, srcStr.length -1);
  var signStr = hmacSHA1(srcStr, secretKey);
  return Base64.stringify(signStr);
}
const getNonce = () => {
  return Math.round(Math.random() * 1000);
}
const getTimestamp = () => {
  return parseInt((new Date().getTime() / 1000));
}
module.exports = {
  requestApi,
  getUuid,
  login,
  getFamilyList,
  getRoomList,
  addFamily,
  addRoom,
  getDeviceList,
  getDevicesStatus,
  getDevicesData,
  activePush,
  postData
}
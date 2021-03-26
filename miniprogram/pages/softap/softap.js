const app = getApp();
const qcloud = require('../../utils/qcloud.js');
const util = require('../../utils/util.js');
const computedBehavior = require('miniprogram-computed')
import { createStoreBindings } from 'mobx-miniprogram-bindings'
import { store } from '../../utils/store'
const custom = require('../../utils/proto-custom.js');
var WIFISTORAGE = {};
var getStatusNum = 0;
var getSessionNum = 0
Page({
  behaviors: [computedBehavior],
  /**
   * 页面的初始数据
   */
  data: {
    productId: "",
    ssid: "",
    password: "",
    deviceName: "",
    wifiName: "",
    wifiBssid: "",
    wifiPwd: "",
    wifiInfo: {},
    wifiList: [],
    appToken: "",
    is5G: false,
    secure: true,
    isShowModal: false,
    clientKey: {},
    sessionResp0: {},
    sessionResp1: {},
    pop: "",
    secretKey: "",
    isSec: false,
    isConnectSuc: true,
    isShow: false,
    isConnect: false,
    userLocation: false,
    isIosConnect: false
  },
  watch: {
    'appToken': function () {
      if (this.data.isShow) {
        this.getWifiToken();
      }
    },
  },
  bindNameInput(e) {
    this.setData({
      wifiName: e.detail.value
    });
  },
  bindPasswordInput (e) {
    this.setData({
      wifiPwd: e.detail.value
    });
  },
  showWifiList() {
    if (this.data.wifiList.length == 0) {
      this.getWifiListWay()
    }
    this.setData({
      isShowList: true,
      isStartConnect: false
    })
  },
  hideWifiList() {
    this.setData({
      isShowList: false
    })
  },
  connectDeviceWiFi () {
    const self = this;
    if (self.data.secure && self.data.wifiPwd.length < 8) {
      util.showConfirmModal("密码长度不能小于8位", "我知道了");
      return;
    }
    var is5G = this.data.is5G;
    if (is5G) {
      util.showCancelModal("当前为5G网络，请确保您的网络为混合网络", "继续").then(() => {
        self.startConnectDeviceWiFi()
      })
      return ;
    }
    self.startConnectDeviceWiFi()
    
  },
  startConnectDeviceWiFi () {
    const self = this
    util.showLoading("设备配网中...");
    wx.connectWifi({
      SSID: self.data.ssid,
      password: self.data.password,
      success(res) {
        console.log(res)
        self.setData({
          isConnect: false,
          isConnectSuc: true
        })
        self.startConnectWifi();
      },
      fail(res) {
        wx.hideLoading();
        if (res.errCode == 12010 && res.errMsg == "connectWifi:fail:can't gain current wifi") {
          self.setData({
            isConnect: false,
            isConnectSuc: true
          })
          return;
        }
        self.setData({
          isConnectSuc: false
        })
        util.showToast("手机连接设备WiFi失败，请检查设备WiFi后点击\"重连\"按钮！");
      }
    })
  },
  startConnectWifi() {
    const self = this;
    getSessionNum = 0;
    if (!self.data.isConnectSuc) {
      return;
    }
    setTimeout(() => {
      self.getSessionVer(self.startProtoWifi)
    }, 500)
  },
  // 获取设备版本、是否加密等信息
  getSessionVer (fun) {
    const self = this
    custom.getSessionVer().then(res => {
      console.log('isSec', res)
      self.setData({
        isSec: res
      })
      if (fun) {
        fun()
      }
    }).catch(err => {
      if (getSessionNum <= 2) {
        getSessionNum ++
        self.getSessionVer(fun);
        return;
      }
      console.info('getSessionVer-error', err)
      util.showModel("配网提示", "似乎与网络断开了，请稍后重试", false);
    })
  },
  // 开始是设备交互
  startProtoWifi () {
    const self = this;
    // util.showLoading("设备配网中...");
    // 添加延时防止部分机型出现连接失败的情况，原因暂时不知
    setTimeout(() => {
      self.sendSessionData();
     }, 1000)
  },
  // 创建session
  async sendSessionData() {
    console.log('sendSessionData')
    const self = this
    try {
      var isSec = self.data.isSec
      let {key, buffer} = custom.protoSession(isSec)
      self.setData({
        clientKey: key
      })
      console.log(buffer)
      var resp0 = await custom.requestBuffer(app.globalData.sendSessionurl, buffer)
      var sessionResp0 = await custom.decodeSessionResp0(resp0)
      console.log(sessionResp0)
      console.log(isSec)
      if (isSec) {
        let {secretKey, buffer} = custom.protobufSec1(self.data.pop, self.data.clientKey.private, sessionResp0.sec1.sr0.devicePubkey, sessionResp0.sec1.sr0.deviceRandom)
        self.setData({
          secretKey: secretKey
        })
        var resp1 = await custom.requestBuffer(app.globalData.sendSessionurl, buffer)
        var sessionResp1 =  await custom.decodeSessionResp0(resp1)
        var isCheck = await custom.check(sessionResp1.sec1.sr1.deviceVerifyData, self.data.clientKey.public);
        if (isCheck) {
          self.protoCustomData()
        }
      } else {
        self.protoCustomData()
      }
    } catch(err) {
      console.log(err)
      wx.hideLoading();
      util.showModel("配网提示", "设备配网失败", false);
    }
  },
  // 发送自定义数据，当前发送从云端获取的token
  protoCustomData () {
    const self = this
    var json = JSON.stringify({"token": store.wifiToken})
    custom.request(app.globalData.sendCustomData, json).then(res => {
      if (res && res.deviceName) {
        self.setData({
          deviceName: res.deviceName
        })
      }
      self.sendWiFiConfig();
    })
  },
  // 发送WiFi信息
  async sendWiFiConfig() {
    const self = this
    try {
      var isSec = self.data.isSec
      var buffer = custom.wifiConfig(isSec, self.data.wifiName, self.data.wifiPwd)
      var wifiConfig = await custom.requestBuffer(app.globalData.sendWiFiConfigurl, buffer)
      self.decodeWiFiConfig(wifiConfig)
    } catch(err) {
      console.error(err)
      wx.hideLoading();
      util.showModel("配网提示", "设备配网失败", false);
    }
  },
  async decodeWiFiConfig (wifiConfig) {
    const self = this
    var isSec = self.data.isSec
    var decodeWifiConfig = await custom.decodeWiFiConfig(wifiConfig, isSec)
    if (decodeWifiConfig.msg && decodeWifiConfig.msg == 3) {
      var applyBuffer = custom.applyWifiConfig(isSec)
      var applyWifiConfig = await custom.requestBuffer(app.globalData.sendWiFiConfigurl, applyBuffer)
      self.decodeWiFiConfig(applyWifiConfig)
      return
    }
    if (decodeWifiConfig.msg && decodeWifiConfig.msg == 5) {
      console.log('decodeWifiConfig.msg', decodeWifiConfig.msg)
      setTimeout(() => {
        self.getApplyWifiStatus();
      }, 1000)
    }
  },
  async getApplyWifiStatus () {
   const self = this
    try {
      var isSec = self.data.isSec
      var statusBuffer = custom.getApplyStatus(isSec)
      var statusData = await custom.requestBuffer(app.globalData.sendWiFiConfigurl, statusBuffer)
      var data = await custom.decodeWiFiConfig(statusData, isSec)
      console.log(data)
      var status = data.respGetStatus.staState
      var text = '设备配网失败, 连接断开'
      if (status == 0) {
        util.setWifiStorage(self.data.wifiName, self.data.wifiPwd)
        self.sendWifiSuc()
        return
      } 
      if (status == 1) {
        // 延时 1s 再次请求配网状态
        setTimeout(() => {
          self.getApplyWifiStatus()
        }, 1000)
        return 
      }
      if (status == 2) {
        text = '设备配网失败, 连接断开'
      } else if (status == 3) {
        var failReason = data.respGetStatus.failReason
        if (failReason == 0) {
          text = '设备配网失败, 路由密码错误'
        } else if (failReason == 1) {
          text = '设备配网失败, 没有发现对应路由'
        } else {
          text = '设备配网失败'
        }
      }
      util.showModel("配网提示", text, false)
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      util.showModel("配网提示", "设备配网失败", false);
    }
  },
  sendWifiSuc() {
    wx.hideLoading()
    util.showLoading("设备绑定中...");
    this.connectRouter()
  },
  connectRouter () {
    const self = this;
    wx.connectWifi({
      SSID: self.data.wifiName,
      password: self.data.wifiPwd,
      success(res) {
        console.log('connectRouter-suc', res)
        getStatusNum = 0;
        if (app.globalData.platform == 'ios') {
          setTimeout(() => {
            self.getWififTokenStatus();
          }, 2500)
        } else {
          self.getWififTokenStatus();
        }
      },
      fail(res) {
        console.log('connectRouter-fail', res)
        // if 处理一些特殊的机型错误
        if (res.errCode == 12010 && res.errMsg == "connectWifi:fail:can't gain current wifi") {
          getStatusNum = 0;
          self.getWififTokenStatus();
          return;
        }
        if (res.errCode == 12010 && app.globalData.platform == 'ios') {
          setTimeout(() => {
            getStatusNum = 0;
            self.getWififTokenStatus();
          }, 2000)
          return;
        }
        wx.hideLoading()
        util.showIconToast("设备配网失败", "error");
      }
    })
  },
  // 获取设备配网Token的状态
  getWififTokenStatus() {
    const self = this;
    qcloud.requestApi('AppGetDeviceBindTokenState', {"Token": store.wifiToken}).then((res) => {
      res = res.data;
      console.log(res);
      getStatusNum++;
      if (res.code == 0) {
        var data = res.data;
        if (data.State == 2) {
          self.bindDevice();
          return ;
        }
      } 
      if (getStatusNum < 200) {
        self.getWififTokenStatus()
      } else {
        util.showIconToast("设备绑定失败", "error");
      }
    }).catch((res) => {
      console.log('getWififTokenStatus-fail', res)
      util.showIconToast("设备绑定失败", "error");
    })
  },
  getWifiToken() {
    const self = this;
    if (self.data.isConnect) {
      return ;
    }
    self.setData({
      isConnect: true
    })
    qcloud.requestApi('AppCreateDeviceBindToken', {}).then((res) => {
      res = res.data;
      if (res.code == 0) {
        res = res.data;
        store.wifiToken = res.Token;
      } else {
      }
    }).catch((res) => {
      console.log(res);
    })
  },
  // 绑定设备
  bindDevice() {
    const self = this;
    qcloud.requestApi('AppTokenBindDeviceFamily', {"Token": store.wifiToken,"ProductId": self.data.productId, "DeviceName": self.data.deviceName,"FamilyId": store.familyId,"RoomId": store.roomId}).then((res) => {
      res = res.data;
      if (res.code == 0) {
        util.showIconToast("设备绑定成功", "success")
      } else {
        util.showIconToast("设备绑定失败", "error")
      }
      wx.stopWifi({})
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index'
        }, 5000)
      })
    }).catch((res) => {
      console.log(res)
      util.showIconToast("设备绑定失败", "error")
    })
  },
  initWifi () {
    const self = this
    wx.startWifi({
      success(res) {
        wx.getConnectedWifi({
          success(res) {
            console.log(res)
            wx.hideLoading()
            self.getCurrentWiFi(res)
          }
        })
      },
      fail(res) {
        wx.hideLoading();
        util.showIconToast("设置失败", 'error')
      }
    })
  },
  // 获取当前WiFi
  getCurrentWiFi(res) {
    const self = this;
    var wifi = res.wifi;
    if (self.data.ssid != wifi.SSID && !util.isEmpty(wifi.SSID)) {
      var is5G = wifi.frequency > 4900 && wifi.frequency < 5900;
      self.setData({
        wifiInfo: wifi,
        wifiName: wifi.SSID,
        wifiPwd: "",
        wifiBssid: wifi.BSSID,
        secure: wifi.secure,
        is5G: is5G
      })
      console.log('getCurrentWiFi', is5G)
      self.show5GModal(is5G);
      self.getPwd(wifi.SSID);
    }
  },
  // 获取配过的WiFi密码
  getPwd(ssid) {
    const self = this;
    WIFISTORAGE = wx.getStorageSync("WIFISTORAGE");
    if (util.isEmpty(WIFISTORAGE)) {
      WIFISTORAGE = {};
    }
    try {
      if (WIFISTORAGE[ssid]) {
        self.setData({
          wifiPwd: WIFISTORAGE[ssid]
        })
      }
    } catch (e) {
      console.log(e)
    }
  },
  show5GModal(is5G) {
    const self = this;
    console.log('show5GModal', self.data.isShowModal)
    if (is5G && !self.data.isShowModal) {
      self.setIsShowModel(true)
      util.showConfirmModal("当前为5G网络，请切换网络", "我知道了").then(() => {
        self.setIsShowModel(false)
      })
    }
  },
  setIsShowModel(flag) {
    this.setData({
      isShowModal: flag
    })
  },
  selectWifiInfo(e) {
    console.log(e)
    var wifi = this.data.wifiList[e.currentTarget.dataset.index];
    var pwd = ""
    if (WIFISTORAGE[wifi.SSID]) {
      pwd = WIFISTORAGE[wifi.SSID]
    }
    this.setData({
      wifiName: wifi.SSID,
      wifiPwd: pwd,
      wifiBssid: wifi.BSSID,
      secure: wifi.secure,
      isShowList: false,
      is5G: false
    })
  },
  getWifiByDevice () {
    this.getSessionVer(this.getWifiList)
  },
  connectWiFiByIos () {
    const self = this;
    wx.connectWifi({
      SSID: self.data.ssid,
      password: self.data.password,
      success(res) {
        console.log('connectWiFiByIos-suc', res)
        self.setData({
          isIosConnect: true
        })
        setTimeout(() => {
          self.getWifiByDevice()
        }, 2000);
      },
      fail(res) {
        console.log('connectWiFiByIos-fail', res)
        wx.hideLoading();
        if (res.errCode == 12010 && res.errMsg == "connectWifi:fail:can't gain current wifi") {
          self.setData({
            isIosConnect: true
          })
          self.getWifiByDevice()
          return;
        }
        self.setData({
          isIosConnect: false
        })
        util.showToast("获取 Wi-Fi 列表失败");
      }
    })
  },
  getWifiListWay() {
    util.showLoading("获取WiFi列表中...");
    this.setData({
      wifiList: []
    })
    if (app.globalData.platform == 'ios') {
      this.connectWiFiByIos()
    } else {
      if (this.data.userLocation) {
        this.getWifiListByAndroid();
      } else {
        this.getUserLocation(this.getWifiListByAndroid)
      }

    }
  },
  // IOS 获取 WiFi 信息
  async getWifiList() {
    const self = this
    try {
      var isSec = self.data.isSec
      let {key, buffer} = custom.protoSession(isSec)
      self.setData({
        clientKey: key
      })
      var resp0 = await custom.requestBuffer(app.globalData.sendSessionurl, buffer)
      var sessionResp0 = custom.decodeSessionResp0(resp0)
      if (isSec) {
        let {secretKey, buffer} = custom.protobufSec1(self.data.pop, self.data.clientKey.private, sessionResp0.sec1.sr0.devicePubkey, sessionResp0.sec1.sr0.deviceRandom)
        self.setData({
          secretKey: secretKey
        })
        var res0sec = await custom.requestBuffer(app.globalData.sendSessionurl, buffer)
        var sessionResp1 = custom.decodeSessionResp0(res0sec)
        var isCheck = custom.check(sessionResp1.sec1.sr1.deviceVerifyData, self.data.clientKey.public);
        if (isCheck) {
          self.getWifiScanReq()
        }
      } else {
        self.getWifiScanReq()
      }
    } catch (err) {
      console.error(err)
      custom.showToast("获取WiFi列表失败")
      wx.hideLoading()
    }
  },
  // 
  async getWifiScanReq () {
    const self = this
    try {
      var isSec = self.data.isSec
      var wifiScanReq = await custom.requestBuffer(app.globalData.sendScanWifiurl, custom.wifiScanReq(isSec))
      await custom.wifiScanRes1(wifiScanReq)
      var wifiScanReq1 = await custom.requestBuffer(app.globalData.sendScanWifiurl,  custom.wifiScanReq1(isSec))
      var wifiScanRes2 = await custom.wifiScanRes1(wifiScanReq1, isSec)
      if (wifiScanRes2.respScanStatus.resultCount && wifiScanRes2.respScanStatus.resultCount > 0) {
        var wifiScanReq2 = await custom.requestBuffer(app.globalData.sendScanWifiurl, custom.wifiScanReq2(wifiScanRes2.respScanStatus.resultCount, isSec))
        custom.wifiScanRes1(wifiScanReq2, isSec).then(data => {
          console.log(data)
          if (data.msg == 5 && data.respScanResult.entries) {
            data = data.respScanResult.entries;
            data.forEach((item, i) => {
              var ssid = util.hexCharCodeToStr( util.ab2hex(item.ssid).join(""))
              var bssid =  util.ab2hex(item.bssid).join("")
              item.SSID = ssid
              item.BSSID = bssid
              if (item.auth == 0) {
                item.secure = false
              } else {
                item.secure = true
              }
              data.splice(i, 1, item)
            })
            console.log(data)
            wx.hideLoading()
            self.setData({
              wifiList: data
            })
          }
        })
      } else {
        wx.hideLoading()
        self.setData({
          wifiList: []
        })
      }
    } catch (err) {
      wx.hideLoading()
      util.showToast("获取WiFi列表失败")
    }
   
  },
  // Android 获取 WiFi 信息
  getWifiListByAndroid() {
    const self = this;
    wx.getWifiList({
      success(res) {
      },
      fail(res) {
        console.log(res);
        wx.hideLoading();
        if (res.errCode) {
          util.showToast(util.wifiErrMsg(res.errCode));
        } 
      }
    })
    self.getOnWifiList();
    
  },
  getOnWifiList() {
    const self = this;
    wx.onGetWifiList((res) => {
      console.log(res)
      var list = [];
      var flag = false;
      console.log(self.data.ssid)
      res.wifiList.forEach((item) => {
        if ((item.frequency <= 4900 || item.frequency >= 5900) && item.SSID != "" && item.SSID != self.data.ssid) {
          if (app.globalData.platform != 'ios') {
            var signalStrength = item.signalStrength;
            var icon = '';
            if (item.secure) {
              if (signalStrength >= 66) {
                icon = "wifi-secret-3"
              } else if (signalStrength >= 33) {
                icon = "wifi-secret-2"
              } else {
                icon = "wifi-secret-1"
              } 
            } else {
              if (signalStrength >= 66) {
                icon = "wifi-no-3"
              } else if (signalStrength >= 33) {
                icon = "wifi-no-2"
              } else {
                icon = "wifi-no-1"
              } 
            }
          }
          item.icon = icon;
          list.push(item);
        }
        if (item.SSID == self.data.ssid) {
          flag = true;
        }
      })
      list.sort((a, b) => { return b.signalStrength - a.signalStrength});
      console.log(list);
      self.setData({
        wifiList: list
      })
      if (self.data.isStartConnect) {
        if (flag) {
          self.connectDeviceWiFi();
        } else {
          wx.hideLoading();
          util.showToast("没有扫描到AP，请检查AP是否开启");
        }
      } else {
        wx.hideLoading();
      }
      
    })
  },
  getUserLocation(fun) {
    const self = this;
    wx.getSetting({
      success(res) {
        console.log(res);
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success(res) {
              console.log(res);
              self.setData({
                userLocation: true
              })
              if (fun) {
                fun();
              }
            }
          })
        } else {
          self.setData({
            userLocation: res.authSetting['scope.userLocation']
          })
          if (app.globalData.platform != 'ios') {
            self.getWifiListByAndroid();
          }
          wx.getConnectedWifi({
            success(res) {
              self.getCurrentWiFi(res);
            },
            fail(res) {
              console.log("getConnectedWifi:fail", res)
            }
          })
        }
      }
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const self = this;
    console.log(options);
    util.getSystemInfo();
    WIFISTORAGE = wx.getStorageSync("WIFISTORAGE");
    if (util.isEmpty(WIFISTORAGE)) {
      WIFISTORAGE = {};
    }
    this.storeBindings = createStoreBindings(this, {
      store,
      fields: ['appToken'],
      actions: [],
    })
    console.log(options)
    this.setData({
      productId: options.productId,
      ssid: options.name,
      password: options.password
    })
    self.getUserLocation();
    // this.setData({
    //   productId: 'AVGLQX7FYB',
    //   ssid: 'tcloud_XXX',
    //   password: "",
    //   wifiName: "Huawei-Multi",
    //   wifiPwd: "espressifhf",
    // })
    self.initWifi();
    
    if (!wx.getStorageSync("appToken")) {
      wx.navigateTo({
        url: '/pages/authorize/authorize?flag=softap'
      })
    } else {
      app.globalData.token = wx.getStorageSync("appToken");
      if (store.familyId) {
        this.getWifiToken();
      }
    }
    
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.setData({
      isShow: true
    })
    console.log("familyId=" + store.familyId);
    if (wx.getStorageSync("appToken") && !store.familyId) {
      console.log(store.familyId);
      qcloud.getFamilyList(false);
      // this.getWifiToken();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    this.setData({
      isShow: false
    })
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.setData({
      isShow: false
    })
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})
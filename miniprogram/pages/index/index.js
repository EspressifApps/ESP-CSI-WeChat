//index.js
const app = getApp()
const qcloud = require('../../utils/qcloud.js');
const custom = require('../../utils/proto-custom.js');
const util = require('../../utils/util.js');
import { createStoreBindings } from 'mobx-miniprogram-bindings'
import { store } from '../../utils/store'
Page({
  data: {
    deviceList: [],
    searchList: [],
    familyList: [],
    deviceIndex: -1,
    familyId: "",
    roomId: "",
    showAddBtn: false,
    deviceInfo: {},
    familyName: "",
    searchName: "",
    isOperate: true,
  },
  //搜索
  bindViewSearch (e) {
    this.setData({
      searchName: e.detail.value
    })
    // this.getSearchList();
  },
  //设备控制,跳转控制界面
  showInfo: function (event) {
    var self = this,
      index = event.currentTarget.dataset.index,
      deviceInfo = self.data.deviceList[index];
    self.setData({
      deviceInfo: deviceInfo,
      deviceIndex: index
    })
    store.deviceInfo = deviceInfo
    wx.navigateTo({
      url: '/pages/operate/operate',
      success: function (res) {
        // 通过eventChannel向被打开页面传送数据
        res.eventChannel.emit('acceptData', {
          data: deviceInfo
        })
      }
    })
  },
  //显示设备操作列表
  showOperate: function (e) {
    var self = this,
      index = e.currentTarget.dataset.index,
      deviceInfo = self.data.deviceList[index];
    self.setData({
      isOperate: false,
      deviceInfo: deviceInfo,
      deviceIndex: index
    })

  },
  //隐藏操作列表
  hideOperate: function () {
    this.setData({
      isOperate: true
    })
  },
  // 设备重置
  delDevice () {
    const self = this;
    self.hideOperate();
    util.showCancelModal('确定要重置设备吗，重置后的设备需要重新配网进行绑定', '确定', '设备重置').then(() => {
      qcloud.requestApi("AppDeleteDeviceInFamily", {
        "FamilyId": store.familyId,
        "ProductId": self.data.deviceInfo.ProductId,
        "DeviceName": self.data.deviceInfo.DeviceName,
      }).then((res) => {
        res = res.data;
        wx.hideLoading();
        if (res.code == 0) {
          util.showToast("设备重置成功");
          var deviceList = self.data.deviceList;
          deviceList.splice(self.data.deviceIndex, 1);
          self.setData({
            deviceList: deviceList
          })
          store.deviceList = deviceList;
          if (deviceList.length == 0) {
            store.showAddBtn = true;
          }
        }
      }).catch(() => {
        util.showToast("设备重置失败");
        wx.hideLoading();
      })
    })
  },
  //处理设备列表
  getSearchList () {
    var searchList = [], list = this.data.deviceList;
    if (!util.isEmpty(this.data.searchName)) {
      list.forEach((item) => {
        if (item.DeviceName.indexOf(this.data.searchName) != -1) {
          searchList.push(item);
        }
      })
    } else {
      searchList = list;
    }
    this.setData({
      searchList: searchList
    })
  },
  addDevice () {
    if (!wx.getStorageSync("appToken")) {
      util.showCancelModal('乐鑫连连可远程操控智能设备，实现智能场景联动，使用前需要您授权登录', '前往授权', '授权提示').then(() => {
        wx.reLaunch({
          url: '/pages/authorize/authorize'
        })
      })
      return 
    }
    store.wifiToken = ""
    wx.scanCode({
      success(res) {
        console.log(res)
        if (res.result) {
          if (res.result.indexOf("/pages/softap/softap") != -1) {
            wx.navigateTo({
              url: res.result
            })
            return ;
          } 
          if (!util.isJSON(res.result)) {
            util.showToast("二维码内容错误，请检查并重新扫描设备二维码");
            return ;
          }
          res = JSON.parse(res.result);
          if (res.name && res.productId) {
            wx.navigateTo({
              url: '/pages/softap/softap?name=' + util.isUndefined(res.name) + '&password=' + util.isUndefined(res.password) + "&productId=" + util.isUndefined(res.productId)
            })
          } else {
            util.showToast("二维码内容错误，请检查并重新扫描设备二维码");
          }
        } else if (res.path) {
          wx.navigateTo({
            url: "/" + res.path
          })
        } else {
          util.showToast("二维码内容错误，请检查并重新扫描设备二维码");
        }
      }
    })
  },
  
  //关灯
  closeDevice: function (event) {
    const self = this,
      index = event.currentTarget.dataset.index;
    self.setStatus(0, index);
  },
  //开灯
  openDevice: function (event) {
    const self = this,
      index = event.currentTarget.dataset.index;
    self.setStatus(1, index);
  },
  setStatus(status, index) {
    var data = JSON.stringify({ "power_switch": status})
    var list = this.data.deviceList;
    var deviceInfo = list[index];
    deviceInfo.power_switch = status
    list.splice(index, 1, deviceInfo);
    this.setData({
      deviceList: list,
      deviceInfo: deviceInfo
    })
    qcloud.postData(data, deviceInfo.ProductId, deviceInfo.DeviceName);
  },
 
  async getSetting () {
    try {
      var res = await  wx.getSetting()
      if (res.authSetting['scope.userInfo']) {
        // 已经授权，可以直接调用 getUserInfo 获取头像昵称
        await util.getUserInfo()
        app.globalData.isLogin = true;
        await util.onGetOpenid()
        qcloud.login().then(res => {
          qcloud.getFamilyList(true)
        })
      }
    } catch (err) {
      console.log(err)
    }
  },
  onLoad () {
    
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    const self = this;
    util.getSystemInfo();
    if (wx.getStorageSync("appToken")) {
      app.globalData.token = wx.getStorageSync("appToken");
      util.showLoading("设备加载中...");
      this.storeBindings = createStoreBindings(this, {
        store,
        fields: ['deviceList', 'showAddBtn'],
        actions: [],
      })
      if (!app.globalData.isLogin) {
        self.getSetting()
      } else {
        setTimeout(() => {
          qcloud.getFamilyList(true);
        }, 2000)
      }
    } else {
      self.setData({
        showAddBtn: true
      })
    }
  },
  onShow () {
  },
  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    store.deviceList = [];
    wx.stopPullDownRefresh();
    util.showLoading("设备加载中...");
    qcloud.getFamilyList(true);
  },
})

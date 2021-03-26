const app = getApp();
const util = require('../../utils/util.js');
const qcloud = require('../../utils/qcloud.js');
Page({

  /**
   * 页面的初始数据
   */
  data: {
    logged: true,
    isHome: true,
  },
  // 用户授权回调
  onGetUserInfo: function (e) {
    if (!this.data.logged && e.detail.userInfo) {
      util.setGlobalData(e.detail.userInfo)
      this.isExistAppToken()
    }
  },
  isExistAppToken () {
    if (!wx.getStorageSync("appToken")) {
      this.onGetOpenid()
      return
    }
    app.globalData.token = wx.getStorageSync("appToken");
    util.jump(this.data.isHome);
  },
  async onGetOpenid () {
    const self = this
    if (self.data.isHome) {
      util.showLoading("正在授权登录云端...");
    }
    try {
     
      if (util.isEmpty(app.globalData.userInfo)) {
        console.log('getUserInfo')
        await util.getUserInfo()
      }
      await util.onGetOpenid()
      qcloud.login().then(() => {
        util.jump(self.data.isHome)
      })
    }catch(err) {
      util.showCancelModal('授权失败', '重新授权', '授权提示').then(() => {
        self.onGetOpenid()
      })
    }
  },
  async getSetting () {
    const self = this
    try {
      var res = await wx.getSetting()
      console.log(res)
      if (res.authSetting['scope.userInfo']) {
        // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
        util.getUserInfo()
        self.isExistAppToken()
      } else {
        self.setData({
          logged: false
        })
      }
    } catch (err) {
      console.log(err)
    }
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log(options)
    const self = this;
    options = JSON.stringify(options);
    if (options != "{}") {
      this.setData({
        isHome: false
      })
    }
    self.getSetting();
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

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

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
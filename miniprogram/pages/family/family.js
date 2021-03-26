// pages/family/family.js
const app = getApp()
const util = require('../../utils/util.js');
import { createStoreBindings } from 'mobx-miniprogram-bindings'
import { store } from '../../utils/store'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    familyId: "",
    familyName: "",
    userId: "",
    memberList: []
  },
  getFamilyMemberList () {
    const self = this;
    console.log(store.familyId)
    var data = {
      "AccessToken": app.globalData.token,
      "Action": "AppGetFamilyMemberList",
      "RequestId": util.getUuid(),
      "FamilyId": store.familyId
    }
    console.log(data);
    wx.request({
      url: 'https://iot.cloud.tencent.com/api/exploreropen/tokenapi',
      method: 'POST',
      data: data,
      header: {
        'content-type': 'application/json' // 默认值
      },
      success(res) {
        var res = res.data;
        console.log(res);
        if (res.code == 0) {
          var list = res.data.MemberList;
          self.setData({
            memberList: list
          })
          for (let i = 0; i < list.length; i++) {
            var item = list[i];
            if (item.NickName == app.globalData.userInfo.nickName) {
              self.setData({
                userId: item.UserID
              })
            }
          }
        }
      },
      fail(res) {
      }
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.storeBindings = createStoreBindings(this, {
      store,
      fields: ['familyId', 'familyName'],
      actions: [],
    })
    this.getFamilyMemberList();
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
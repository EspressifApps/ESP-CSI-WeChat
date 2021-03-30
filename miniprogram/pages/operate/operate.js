const app = getApp();
const qcloud = require('../../utils/qcloud.js');
const util = require('../../utils/util.js');
import { createStoreBindings } from 'mobx-miniprogram-bindings'
import { store } from '../../utils/store'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    inputLength: 6,
    height: 0,
    width: 0,
    deviceInfo: {},
    isType: 0,
    deviceName: "",
    productId: "",
    currentStatus: false,
    radarStatus: false,
    roomStatus: false,
    adjustThreshold: false,
    humanDetect: 0,
    humanMove: 0,
    awakeCount: 0,
    platform: "ios",
    pixelRatio: 1,
    color: "rgba(255, 0, 41, 1)",
    currentHue: 360,
    currentSaturation: 100,
    currentLuminance: 100,
    currentSaturationText: 100,
    currentLuminanceText: 100,
    isOperate: false,
    isCustom: false,
    apName: '路由 Mac',
    curMac: '24:00:00:00:00:00',
    curDataMac: '',
    dataMac: '',
    selectedMac: '',
    mac: '',
    apBssid: '', 
    ROOM_STATUS_TEXT: 'wifi_rader_room_status',
    AWAKE_COUNT_TEXT: 'wifi_rader_awake_count',
    inputFocus: [false, false, false, false, false, false],
    inputValue: ['', '', '', '', '', '']
  },
  // 初始化色彩
  initColor: function () {
    const self = this;
    var device = self.data.deviceInfo;
    console.log(device)
    var rgb = util.hsv2rgb(device.hue, device.saturation, device.value);
    console.log(rgb);
    self.setData({
      currentHue: device.hue,
      currentSaturation: device.saturation,
      currentLuminance: device.value,
      currentSaturationText: device.saturation,
      currentLuminanceText: device.value,
      color: "rgba(" + rgb.join(',') +  ", " + (device.value / 100) + ")"
    });
    console.log("rgba(" + rgb.join(',') +  ", " + (device.value / 100) + ")")
  },
  showDataList (event) {
    const self = this
    wx.navigateTo({
      url: '/pages/dataList/dataList?fieldName=' + event.currentTarget.dataset.value + '&productId=' + self.data.productId + '&deviceName=' + self.data.deviceName
    })
  },
  switchType (event) {
    var type = event.currentTarget.dataset.value;
    this.setData({
      isType: type
    })
    if (type == 0) {
      util.createCanvas(this, this.data.color);
    }
  },
  changeStatus(event) {
    console.log(event.detail.value)
    this.controlDeviceData({'power_switch': event.detail.value ? 1 : 0})
  },
  changeRadarStatus (event) {
    this.setData({
      radarStatus: event.detail.value
    })
    this.controlDeviceData({'wifi_rader_status': event.detail.value ? 1 : 0})
  },
  changeThresholdStatus (event) {
    this.controlDeviceData({'wifi_rader_adjust_threshold': event.detail.value ? 1 : 0})
  },
  editHumanDetect (e) {
    console.log(e.detail.value)
    this.setData({
      humanDetect: parseFloat(e.detail.value).toFixed(2)
    })
  },
  changHumanDetect () {
    var self = this
    wx.showModal({
      title: '系统提示',
      content: '确定修改 Wi-Fi 雷达人体检测阈值吗？',
      success(res) {
        if (res.confirm) {
          self.controlDeviceData({'wifi_rader_human_detect': parseFloat(self.data.humanDetect)})
        } else if (res.cancel) {
          self.setData({
            humanDetect: self.data.deviceInfo['wifi_rader_human_detect']
          })
        }
      }
    })
  },
  editHumanMove (e) {
    console.log(e.detail.value)
    this.setData({
      humanMove: parseFloat(e.detail.value).toFixed(2)
    })
  },
  changHumanMove (e) {
    var self = this
    this.setData({
      humanMove: parseFloat(e.detail.value).toFixed(2)
    })
    wx.showModal({
      title: '系统提示',
      content: '确定修改 Wi-Fi 雷达人体活动阈值吗？',
      success(res) {
        if (res.confirm) {
          self.controlDeviceData({'wifi_rader_human_move': parseFloat(self.data.humanMove)})
        } else if (res.cancel) {
          self.setData({
            humanMove: self.data.deviceInfo['wifi_rader_human_move']
          })
        }
      }
    })
  },
  // 获取点击色盘位置的颜色
  getColor(event) {
    const self = this
    util.getColor(event, this.data.pixelRatio, this.data.currentLuminanceText).then((res) => {
      var {r, g, b, color} = res
      console.log(res)
      self.setData({
        color: color,
        currentHue: util.rgb2hsv(r, g, b)[0]
      })
      self.controlDeviceData({ "hue": self.data.currentHue});
    });
  },
  // 拖动过程中修改亮度
  changeDeviceL(e) {
    console.log(e.detail.value)
    this.setData({
      currentLuminanceText: e.detail.value
    })
    this.setBgColor(this.data.currentHue, this.data.currentSaturationText, 100, e.detail.value);
  },
  // 拖动结束修改亮度
  editDeviceL: function (e) {
    const self = this;
    setTimeout(function () {
      self.changeDeviceL(e);
      self.controlDeviceData({ "value": self.data.currentLuminanceText});
    }, 200)
  },
  // 拖动过程中修改饱和度
  changeDeviceS(e) {
    this.setData({
      currentSaturationText: e.detail.value
    })
    this.setBgColor(this.data.currentHue, e.detail.value, 100, this.data.currentLuminanceText);
  },
  // 拖动结束修改饱和度
  editDeviceS: function (e) {
    const self = this;
    setTimeout(function () {
      self.changeDeviceS(e);
      self.controlDeviceData({"saturation": self.data.currentSaturationText});
    }, 200)
  },
  showRadarData () {
    const self = this
    wx.showModal({
      title: '',
      showCancel: false,
      content: self.data.deviceInfo['wifi_rader_data'],
      confirmText: '取消',
      success(res) {
      }
    })
  },
  // 设置中间小圆圈的背景色
  setBgColor: function (h, s, b, p) {
    var rgb = util.hsv2rgb(h, s, b);
    this.setData({
      color: "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + p / 100 + ")",
    })
  },
  controlDeviceData (data) {
    var deviceInfo = this.data.deviceInfo;
    for (var [key, value] of Object.entries(data)) {
      deviceInfo[key] = value;
    }
    this.setData({
      deviceInfo: deviceInfo
    })
    qcloud.postData(JSON.stringify(data), this.data.productId, this.data.deviceName);
  },
  inputChange (e) {
    let val = e.detail.value
    let index = e.target.dataset.value
    console.log(index)
    if (val.length >= 2 && (index+1) < 6) {
      this.setData({
        [`inputFocus[${index+1}]`]: true,
      })
    } else if (val.length == 0 && (index-1) >= 0) {
      this.setData({
        [`inputFocus[${index-1}]`]: true,
      })
    }
    this.setData({
      [`inputValue[${index}]`]: val
    })
  },
  radioChange (e) {
    this.setData({
      selectedMac: e.detail.value
    })
    if (this.data.selectedMac == 'custom') {
      this.setData({
        isCustom: true
      })
      return;
    }
    this.setData({
      isCustom: false
    })
  },
  hideSelectMac () {
    this.setData({
      isOperate: false
    })
  },
  showSelectMac () {
    this.setData({
      isOperate: true
    })
    if (this.data.dataMac !== this.data.apBssid && this.data.dataMac !== this.curMac) {
      var inputValue = this.data.dataMac.split(':')
      this.setData({
        inputValue: inputValue,
        selectedMac: 'custom',
        isCustom: true
      })
      return;
    }
    this.setData({
      inputValue: ['', '', '', '', '', '']
    })
    this.selectedMac = this.dataMac
  },
  confirmSelect () {
    var mac = ''
    if (this.data.selectedMac === 'custom') {
      var list = this.data.inputValue.filter(item => util.isEmpty(item))
      if(list.length > 0) {
        util.showToast('请输入正确的 Mac ')
        return
      }
      mac = this.data.inputValue.join(':')
    } else {
      mac = this.data.selectedMac
    }
    this.hideSelectMac();
    console.log({'wifi_rader_data_mac': mac})
    this.controlDeviceData({'wifi_rader_data_mac': mac});
    this.setData({
      dataMac: mac
    })
    this.showDatamac()
  },
  showDatamac () {
    if (this.data.dataMac === this.data.apBssid) {
      this.setData({
        curDataMac: this.data.apName
      })
      return;
    }
    this.setData({
      curDataMac: this.data.dataMac
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const self = this;
    wx.getSystemInfo({
      success: function (res) {
        console.log(res)
        self.setData({
          width: res.windowWidth,
          height: res.windowHeight,
          pixelRatio: res.pixelRatio,
          platform: res.platform,
        })
      },
    })
    this.storeBindings = createStoreBindings(this, {
      store,
      fields: ['deviceInfo'],
      actions: [],
    })
    const eventChannel = self.getOpenerEventChannel();
    eventChannel.on('acceptData', function (data) {
      console.log(data)
      var device = data.data;
      self.setData({
        deviceInfo: device,
        currentStatus: device['power_switch'] == 1 ? true : false,
        isType: device['wifi_rader_status'],
        radarStatus: device['wifi_rader_status'] == 1 ? true : false,
        adjustThreshold: device['wifi_rader_adjust_threshold'] == 1 ? true : false,
        humanDetect: parseFloat(device['wifi_rader_human_detect']).toFixed(2),
        humanMove: parseFloat(device['wifi_rader_human_move']).toFixed(2),
        deviceName: device['DeviceName'],
        productId: device['ProductId'],
        roomStatus: device['wifi_rader_room_status'] == 1 ? true : false,
        awakeCount: device['wifi_rader_awake_count'],
        dataMac: device['wifi_rader_data_mac'],
        selectedMac: device['wifi_rader_data_mac'],
        ma: device['mac'],
        apBssid: device['ap_bssid']
      })
      
      self.showDatamac();
      wx.setNavigationBarTitle({
        title: self.data.deviceInfo.DeviceName
      });
      self.initColor();
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    const self = this;
    setTimeout(() => {
      if (self.data.isType != 1) {
        util.createCanvas(self.data.color);
      }
    })
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
  onShareAppMessage: function (res) {
    return {
      title: 'ESP CSI',
      path: '/pages/index/index'
    }
  },
})

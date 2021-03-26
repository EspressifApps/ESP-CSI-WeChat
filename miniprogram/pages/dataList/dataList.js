// pages/dataList/dataList.js
const app = getApp();
import * as echarts from '../../ec-canvas/echarts';
const util = require('../../utils/util.js');
const qcloud = require('../../utils/qcloud.js');
var timerId = ''
var lineChart = ''
var barChartList = []
var pieChart = ''
const [ON, OFF] = [1, 0]
Page({

  /**
   * 页面的初始数据
   */
  data: {
    productId: '',
    deviceName: '',
    lineTitle: '',
    fieldName: '',
    fieldNameFlag: '',
    barTime: '',
    baseData: 0,
    TIME_DAY: 'day',
    TIME_WEEK: 'week',
    TIME_HOUR: 'hour',
    curType: '',
    dataList: [],
    totalList: [],
    barName: '分',
    isChangeType: true,
    ecLine: {
      onInit: function (canvas, width, height, dpr) {
        lineChart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr // new
        });
        canvas.setChart(lineChart);
        lineChart.setOption(initLineChart([],[]));
        return lineChart;
      }
    },
    ecBar: [],
    ecPie: {
      onInit: function (canvas, width, height, dpr) {
        pieChart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr // new
        });
        canvas.setChart(pieChart);
        pieChart.setOption(initPieChart([]));
        return pieChart;
      }
    },
  },
  getDataByTime (event) {
    const self = this
    var type = event.currentTarget.dataset.value
    if (self.data.curType !== type) {
      if (self.data.isChangeType) {
        util.showLoading("数据加载中...");
        setTimeout(() => {
          wx.hideLoading();
        }, 2000)
        return false
      }
      self.setData({
        curType: type
      })
      self.setData({
        ecBar: []
      })
      self.initStatusLine(self.data.totalList)
    }
  },
  getHistoryDataCount (fieldName, minTime, maxTime, flag) {
    const self = this
    var data = {
      FieldName: fieldName,
      MinTime: minTime,
      MaxTime: maxTime,
      Limit: 400
    }
    util.showLoading("数据加载中...");
    self.setData({
      totalList: [],
      isChangeType: true
    })
    self.getDeviceDataHistory(data, flag)
  },
  getDeviceDataHistory (data, flag) {
    const self = this
    self.getDeviceDataHistoryByUrl(data).then(res => {
      console.info(res)
      var totalList = self.data.totalList
      totalList = totalList.concat(res.Results)
      self.setData({
        totalList: totalList
      })
      if (!res.Listover && res.Results.length > 0) {
        data.Context = res.Context
        self.getDeviceDataHistory(data, flag)
      } else {
        if (flag) {
          self.initStatusLine(totalList)
          let {minTime, maxTime} = self.getCurTime(24 * 7)
          self.getHistoryDataCount(self.data.fieldName, minTime, maxTime, false)
        } else {
          self.setData({
            isChangeType: false
          })
        }
        setTimeout(() => {
          wx.hideLoading();
        }, 2000)
      }
    }).catch(res => {
      console.log(res)
      wx.hideLoading()
      wx.showModal({
        title: '系统提示',
        content: '数据加载失败',
        showCancel: false
      }).then(res => {
      })
    })
  },
  getHistoryData (fieldName) {
    const self = this
    var {minTime, maxTime} = self.getCurTime(1)
    var data = {
      FieldName: fieldName,
      MinTime: minTime,
      MaxTime: maxTime,
      Limit: 100
    }
    self.getDeviceDataHistoryByUrl(data).then(res => {
      console.info(res)
      self.initLine(res.Results)
      wx.hideLoading()
    }).catch(res => {
      console.log(res)
      wx.hideLoading()
    })
  },
  getDeviceDataHistoryByUrl (data) {
      const self = this;
      return new Promise((resolve, reject) => {
        data.Action = 'AppGetDeviceDataHistory';
        data.ProductId = self.data.productId;
        data.DeviceName = self.data.deviceName;
        data.AccessToken = app.globalData.token;
        data.RequestId = qcloud.getUuid();
        wx.request({
          url: 'https://iot.cloud.tencent.com/api/exploreropen/tokenapi',
          method: 'POST',
          data: data,
          header: {
            'content-type': 'application/json' // 默认值
          },
          success(res) {
            resolve(res.data.data)
          },
          fail(res) {
            reject(res)
          }
        })
      })
  },
  getCurTime (time) {
    var date = new Date()
    var maxTime = date.getTime()
    var minTime = maxTime - time * 3600 * 1000
    return {minTime: minTime, maxTime: maxTime}
  },
  getTodayTime () {
    var date = new Date()
    var maxTime = date.getTime()
    var hour = date.getHours()
    var minTime = maxTime - hour * 3600 * 1000
    return {minTime: minTime, maxTime: maxTime}
  },
  initStatusLine (list) {
    console.log(list)
    const self = this
    var obj = {}
    if (this.data.curType === this.data.TIME_HOUR) {
      let {minTime, maxTime} = this.getTodayTime()
      list = list.filter(item => {
        if (item.Time >= minTime && item.Time <= maxTime) {
          return item
        }
      })
    }
    var len = list.length - 1
    for (let i = len; i > -1; i--) {
      var item = list[i]
      var time = ''
      if (this.data.curType === this.data.TIME_HOUR) {
        time = self.getDateMinutes(item.Time)
      } else if (this.data.curType === this.data.TIME_DAY) {
        time = self.getDateHour(item.Time)
      } else if (this.data.curType === this.data.TIME_WEEK) {
        time = self.getDateWeek(item.Time)
      }
      var value = parseInt(item.Value)
      if (util.isEmpty(obj[time])) {
        obj[time] = 0
      }
      obj[time] += value
    }
    var newObj = {}
    var dataList = []
    if (this.data.curType === this.data.TIME_HOUR) {
      self.setData({
        barName: '分'
      })
      newObj = self.initDay(new Date().getHours() + 1, this.getCurDate())
      for (let [key, value] of Object.entries(obj)) {
        let keys = key.split(':')
        if (keys.length > 0) {
          let keys0 = keys[0] + ':00'
          let keys1 = keys[1]
          newObj[keys0][keys1] = value
        }
      }
      for (let [key, value] of Object.entries(newObj)) {
        dataList.push({id: new Date(key.replace(/-/g, '/')).getTime(), key: key, value: value})
      }
    } else if (this.data.curType === this.data.TIME_DAY) {
      self.setData({
        barName: '时'
      })
      for (let [key, value] of Object.entries(obj)) {
        let keys = key.split(' ')
        if (keys.length > 0) {
          let keys0 = keys[0]
          let keys1 = keys[1]
          if (util.isEmpty(newObj[keys0])) {
            newObj[keys0] = self.initHours(24)
          }
          newObj[keys0][keys1] = value
        }
      }
      for (let [key, value] of Object.entries(newObj)) {
        dataList.push({id: new Date(key.replace(/-/g, '/')).getTime(), key: key, value: value})
      }
    } else if (this.data.curType === this.data.TIME_WEEK) {
      self.setData({
        barName: '周'
      })
      let timeKeys = []
      for (let [key, value] of Object.entries(obj)) {
        let keys = key.split(' ')
        if (keys.length > 0) {
          timeKeys.push(keys[0])
          let keys1 = keys[0]
          if (util.isEmpty(newObj[keys1])) {
            newObj[keys1] = {}
          }
          newObj[keys1] = value
        }
      }
      timeKeys.sort()
      var newKeys = []
      let times = 24 * 3600 * 1000
      timeKeys.forEach((item, index) => {
        newKeys.push(item)
        if (index + 1 !== timeKeys.length) {
          let item1 = new Date(item.replace(/-/g, '/')).getTime()
          let item2 = new Date(timeKeys[index + 1].replace(/-/g, '/')).getTime()
          let difference = (item2 - item1) / times
          if (difference > 1) {
            for (let i = 1; i < difference; i++) {
              newKeys.push(self.getDateBystr(item1 + i * times))
            }
          }
        }
      })
      var lastWeek = self.getCurDate()
      if (newKeys.length > 0 && newKeys.length < 7) {
        lastWeek = newKeys[newKeys.length - 1]
      }
      newKeys.sort()
      for (var key of newKeys) {
        if (util.isEmpty(newObj[key])) {
          newObj[key] = 0
        }
      }
      if (newKeys.length < 7) {
        let len = 7 - newKeys.length
        for (let i = 1; i <= len; i++) {
          newObj[self.getDateBystr(new Date(lastWeek.replace(/-/g, '/')).getTime() + times)] = 0
        }
      }
      dataList.push({id: new Date().getTime() + 'week', key: '', value: newObj})
    }
    self.setData({
      dataList: dataList
    })
    dataList.forEach(item => {
      self.createBarChart(item.value, item.id, item.key)
    })
  },
  initMinutes (total) {
    var obj = {}
    for (let i = 0; i < total; i++) {
      obj[util.formatNumber(i)] = 0
    }
    return obj
  },
  initHours (total) {
    const self = this
    var obj = {}
    for (let i = 0; i < total; i++) {
      obj[util.formatNumber(i) + ':00'] = 0
    }
    return obj
  },
  initDay (total, str) {
    const self = this
    var obj = {}
    for (let i = 0; i < total; i++) {
      var time = util.formatNumber(i)
      time = str + ' ' + time + ':00'
      obj[time] = self.initMinutes(60)
    }
    return obj
  },
  createBarChart (item, id, time) {
    const self = this
    if (!util.isEmpty(item)) {
        var yData = []
        var xData = []
        if (self.data.curType !== self.data.TIME_WEEK) {
          xData = Object.keys(item).sort()
          for (let key of xData) {
            yData.push(item[key])
          }
        } else {
          var data = Object.keys(item).sort()
          for (let key of data) {
            xData.push(self.initWeek(new Date(key.replace(/-/g, '/')).getDay()))
            yData.push(item[key])
          }
        }
        var obj = {
          onInit: function (canvas, width, height, dpr) {
            var barChart = echarts.init(canvas, null, {
              width: width,
              height: height,
              devicePixelRatio: dpr // new
            });
            canvas.setChart(barChart);
            barChart.setOption(initBarChart(xData,yData));
            barChart.setOption({
              tooltip: {
                formatter: (params) => {
                  return self.initFormatter(params.name, params.seriesName, params.value, time)
                },
              },
              xAxis: {
                name: self.data.barName,
                data: xData
              },
              series: [{
                data: yData
              }]
            })
            return barChart;
          }
        }
        var ecBar = self.data.ecBar
        ecBar.push({key: time, obj: obj})
        self.setData({
          ecBar: ecBar
        })
    }
  },
  initFormatter (name, seriesName, value, time) {
    var formatter = name + '\r\n' + seriesName + ': ' + value
    try {
      if (this.data.curType === this.data.TIME_HOUR && !util.isEmpty(time)) {
        time = time.split(' ')
        let h = time[1].split(':')[0]
        let h2 = h
        let name1 = parseInt(name) + 1
        if (name1 === 60) {
          name1 = '00'
          h2 = util.formatNumber(parseInt(h) + 1)
        }
        formatter = '时间: ' + h + ':' + name + ' ~ ' + h2 + ':' + util.formatNumber(name1) + '\r\n' + seriesName + ': ' + value
      } else if (this.data.curType === this.data.TIME_DAY) {
        let h = parseInt(name.split(':')[0])
        h = util.formatNumber(h + 1)
        formatter = '时间: ' + name + ' ~ ' + h + ':00' + '\r\n' + seriesName + ': ' + value
      }
      return formatter
    } catch (e) {
  
    }
  },
  getDateHour (time) {
    var date = new Date(parseInt(time))
    var dayTime = date.getFullYear() + '-' + util.formatNumber(date.getMonth() + 1) + '-' + util.formatNumber(date.getDate())
    return dayTime + ' ' + util.formatNumber(date.getHours()) + ':00'
  },
  getCurDate () {
    var date = new Date()
    return date.getFullYear() + '-' + util.formatNumber(date.getMonth() + 1) + '-' + util.formatNumber(date.getDate())
  },
  getDateBystr (str) {
    var date = new Date(str)
    return date.getFullYear() + '-' + util.formatNumber(date.getMonth() + 1) + '-' + util.formatNumber(date.getDate())
  },
  getDateWeek (time) {
    var date = new Date(parseInt(time))
    var dayTime = date.getFullYear() + '-' + util.formatNumber(date.getMonth() + 1) + '-' + util.formatNumber(date.getDate()) + ' ' + this.initWeek(date.getDay())
    return dayTime
  },
  getDateMinutes (time) {
    var date = new Date(parseInt(time))
    var dayTime = date.getFullYear() + '-' + util.formatNumber(date.getMonth() + 1) + '-' + util.formatNumber(date.getDate())
    return dayTime + ' ' + util.formatNumber(date.getHours()) + ':' + util.formatNumber(date.getMinutes())
  },

  initWeek (day) {
    var week = '周日'
    switch (day) {
      case 0:
        week = '周日'
        break
      case 1:
        week = '周一'
        break
      case 2:
        week = '周二'
        break
      case 3:
        week = '周三'
        break
      case 4:
        week = '周四'
        break
      case 5:
        week = '周五'
        break
      case 6:
        week = '周六'
        break
      default:
        break
    }
    return week
  },
  initDate (time) {
    var date = new Date(parseInt(time))
    var month = date.getMonth() + 1
    var day = date.getDate()
    var hour = date.getHours()
    var minutes = date.getMinutes()
    var seconds = date.getSeconds()
    var dayTime = date.getFullYear() + '-' + util.formatNumber(month) + '-' + util.formatNumber(day)
    return {dayTime: dayTime, hourTime: util.formatNumber(hour) + ':' + util.formatNumber(minutes) + ':' + util.formatNumber(seconds)}
  },
  initLine (list) {
    const self = this
    var xData = []
    var yData = []
    var onCurTime = 0
    var offCurTime = 0
    var onTimeTotal = 0
    var offTimeTotal = 0
    var curStatus = 0
    var len = list.length - 1
    for (let i = len; i > -1; i--) {
      var item = list[i]
      var {hourTime} = self.initDate(item.Time)
      var value = parseInt(item.Value)
      if (i === len) {
        curStatus = value
      }
      xData.push(hourTime)
      yData.push(value)
      var time = parseInt(item.Time)
      if (value === ON) {
        if (onCurTime === 0) {
          onCurTime = time
        } else {
          if (curStatus === ON) {
            onTimeTotal += time - onCurTime
          } else {
            offTimeTotal += time - offCurTime
          }
        }
        curStatus = value
      } else {
        if (offCurTime === 0) {
          offCurTime = time
        } else {
          if (curStatus === OFF) {
            offTimeTotal += time - offCurTime
          } else {
            onTimeTotal += time - onCurTime
          }
          curStatus = value
        }
      }
    }
    var obj = {'有人': onTimeTotal, '没人': offTimeTotal}
    if (!util.isEmpty(pieChart)) {
      lineChart.setOption({
        xAxis: {
          data: xData
        },
        series: [{
          data: yData
        }]
      })
      var data = []
      for (let [key, value] of Object.entries(obj)) {
        data.push({
          value: value,
          name: key
        })
      }
      pieChart.setOption({
        series: [{
          data: data
        }]
      })
    }
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const self = this
    var lineTitle = '房间状态统计';
    var barTime = '房间状态占比';
    var title = '房间状态数据统计';
    var fieldNameFlag = true
    var fieldName = options.fieldName
    if (fieldName != 'wifi_rader_room_status') {
      lineTitle = '活动次数统计';
      title = '活动次数数据统计';
      barTime = '';
      fieldNameFlag = false
    }
    wx.setNavigationBarTitle({
      title: title
    })
    self.setData({
      lineTitle: lineTitle,
      barTime: barTime,
      fieldName: fieldName,
      fieldNameFlag: fieldNameFlag,
      productId: options.productId,
      deviceName: options.deviceName
    })
    if (self.data.fieldNameFlag) {
      self.getHistoryData(fieldName)
      if (!util.isEmpty(timerId)) {
        clearInterval(timerId)
        timerId = ''
      }
      // timerId = setInterval(() => {
      //   self.getHistoryData(fieldName)
      // }, 2000)
    } else {
      let {minTime, maxTime} = self.getCurTime(new Date().getHours())
      self.getHistoryDataCount(fieldName, minTime, maxTime, true)
      self.setData({
        curType: self.data.TIME_HOUR
      })
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
function initLineChart (xData, yData) {
  // 绘制图表
  return  {
    xAxis: {
      data: xData,
      axisTick: {
        show: false
      },
      axisLine: {
        show: false
      }
    },
    grid: {
      top: '4%',
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    yAxis: {
      minInterval: 1,
      axisTick: {
        show: false
      },
      axisLine: {
        show: false
      }
    },
    series: [ {
      name: 'Status',
      type: 'line',
      smooth: true,
      itemStyle: {
        color: '#72ccff'
      },
      data: yData
    }]
  }
}
function initPieChart (data) {
  return {
    'color': [
      '#fc97af',
      '#72ccff'
    ],
    legend: {
      top: '1%',
      left: 'center'
    },
    series: [
      {
        name: '统计',
        type: 'pie',
        radius: '70%',
        center: ['50%', '50%'],
        hoverAnimation: false,
        legendHoverLink: false,
        data: data,
        labelLine: {
          show: false
        },
        label: {
          show: true,
          position: 'inside',
          formatter: '{d}',
          color: '#333'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0)'
          }
        }
      }
    ]
  }
}
function initBarChart (xData, yData) {
  // 绘制图表
  return  {
    'color': [
      '#72ccff',
      '#fc97af'
    ],
    tooltip: {
      trigger: 'item',
      textStyle: {
        fontSize: 10
      },
      axisPointer: {
        type: 'none',
        label: {
          backgroundColor: '#6a7985'
        }
      }
    },
    xAxis: {
      name: '',
      data: xData,
      nameLocation: 'end',
      nameGap: 5,
      nameTextStyle: {
        fontSize: 8
      },
      axisTick: {
        show: false
      },
      axisLine: {
        show: false
      },
      axisLabel: {
        fontSize: 8,
        color: '#999'
      }
    },
    grid: {
      top: '4%',
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    yAxis: {
      minInterval: 50,
      axisLabel: {
        fontSize: 8,
        color: '#999'
      },
      axisTick: {
        show: false
      },
      axisLine: {
        show: false
      }
    },
    series: [ {
      name: '次数',
      type: 'bar',
      barMaxWidth: '12',
      smooth: true,
      data: yData
    }]
  }
}
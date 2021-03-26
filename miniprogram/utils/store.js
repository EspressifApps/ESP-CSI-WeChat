import { configure, observable, action } from 'mobx-miniprogram'

// 不允许在动作外部修改状态
configure({ enforceActions: 'never' });

export const store = observable({

  // 字段
  deviceList: [],
  familyId: "",
  familyName: "",
  roomId: "",
  wifiToken: "",
  showAddBtn: false,
  appToken: "",
  deviceInfo: {},
  // actions
  update: action(function () {
  })

})

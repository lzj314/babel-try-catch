class A extends React.Component {
  setInit(state, json) {
    if (state === String(FaceState['success'])) {
      this.facesubmit();
    } else {
      // 如果state返回1，需要根据错误码判断是是否向后端发起请求还是前端直接拦截
      if (json) {
        const obj = JSON.parse(json);
        const {
          msg
        } = obj; // 上报异常

        reportError(obj, this.faceOrderId); // 101向后端请求查询 http://wiki.58corp.com/index.php?title=Xxzl-android-sdk

        if (obj.state === '101') {
          this.facesubmit();
        } else {
          let errCode = sdkErrList.indexOf(obj.state) > -1 ? FaceErrorNumCode[obj.state] : obj.msg;
          errCode = errCode || 'UNKNOW'; // 未到后端的异常埋点

          this.sendWmdaData(true, {
            upload: '3',
            msg
          });

          if (errCode === 'AUTHENTICATION_FAIL') {
            wmdaReport.setWmdaReport({
              event_id: 501,
              event_name: '鉴权失败',
              timeStamp: new Date().getTime()
            });
          }

          this.faceInfoInit(this.faceSdkInit);
          this.goFailPage(errCode);
        }
      }
    }
  }

}
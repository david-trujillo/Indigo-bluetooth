# Indigo

The [Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) API provides the ability to connect and interact with Bluetooth Low Energy peripherals.

  - Request
  - Connect
  - Request and connect
  - Write
  - Notification handler

### Installation

Download and copy Indigo to your library folder.

### Development

Initialize Indigo
```js
const indigo = new Indigo();
```

Request and connect device:
```js
var prefix = ['Name1', 'Name1'];
indigo.requestAndConnectDevice(prefix)
    .then(device => {
        //device connected
    })
    .catch(error => {
        //error
        console.log("ERROR: " + error);
    });
```

Write and response handler:
```js
var callback = function(bytes){
// device response
};
var api = [0x00];
indigo.write(callback, api);
```

Check bluetooth state
```js
indigo.isAvailable();
```

Get device connected
```js
indigo.getDeviceConnected();
```

License
----

MIT

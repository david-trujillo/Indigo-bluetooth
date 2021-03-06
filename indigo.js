/* @preserve
* Indigo v1.0.7 - 2020-02-28
* (c) 2020 David Trujillo, (c) 2020 Geeksme
* Licensed MIT, GPL
*/

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else if (typeof exports === "object") {
        // Node. Does not work with strict CommonJS
        module.exports = factory();
    } else {
        // Browser globals with support for web workers (root is window)
        root.Indigo = factory();
    }
}(this, function() {

    var LOG_EVENT = "Indigo (e): "
    var LOG_OUTPUT = "Indigo (->): "
    var LOG_INPUT = "Indigo (<-): "

    var SERVICE_UUID = 0xFFF0;
    var NOTIFY_UUID = "0000fff7-0000-1000-8000-00805f9b34fb";
    var WRITE_RESPONSE_UUID = "0000fff6-0000-1000-8000-00805f9b34fb";

    var API_MAX_LENGTH = 20;

    var Indigo = /** @class */ (function (_super) {

        Indigo.EVENT_DISCONNECTED = "disconnected";

        function Indigo(delay) {
            var _this = this;

            if (delay === void 0) { delay = 0; }

            _this.delay = delay;
            _this.notifyChar = null;
            _this.writeReadChar = null;
            _this.device = null;
            _this.bluetooth = navigator.bluetooth;
            _this.events = {};
            _this.notifyFns = null;
            return _this;
        }

        Indigo.prototype.getDeviceConnected = function (event) {
            this.device = this.bluetooth.referringDevice;
            return this.device;
        };

        Indigo.prototype.isAvailable = function (event) {
            return this.bluetooth.getAvailability();
        };

        Indigo.prototype.addEventListener = function (event, listener) {
            if (typeof this.events[event] !== 'object') {
                this.events[event] = [];
            }

            this.events[event].push(listener);
        };

        Indigo.prototype.removeEventListener = function (event, listener) {
            var idx;

            if (typeof this.events[event] === 'object') {
                idx = indexOf(this.events[event], listener);

                if (idx > -1) {
                    this.events[event].splice(idx, 1);
                }
            }
        };

        Indigo.prototype.dispatchEvent = function (event) {
            var i, listeners, length, args = [].slice.call(arguments, 1);

            if (typeof this.events[event] === 'object') {
                listeners = this.events[event].slice();
                length = listeners.length;

                for (i = 0; i < length; i++) {
                    listeners[i].apply(this, args);
                }
            }
        };

        Indigo.prototype.requestDevice = function (prefix) {

            var options = {
                filters: [{
                    namePrefix: "[]",
                    services: [SERVICE_UUID]
                }],
                optionalServices: [SERVICE_UUID]
            };

            for(var p in prefix){
                options.filters.push({namePrefix : prefix[p]});
            }

            return this.bluetooth.requestDevice(options).then(function (device) {
                return device;
            });
        };

        Indigo.prototype.requestAndConnectDevice = function (prefix, onConnectCallback = null) {
            var _this = this;
            return _this.requestDevice(prefix)
            .then(device => {
                if(onConnectCallback != null){
                    onConnectCallback();
                }
                return _this.connect(device)
                .then(device => {
                    return device;
                });
            });
        };

        Indigo.prototype.connect = function (device) {
            var _this = this;
            _this.notifyChar = null;
            _this.writeReadChar = null;
            _this.device = null;

            device.addEventListener("gattserverdisconnected", function () {
                _this.notifyChar = null;
                _this.writeReadChar = null;
                _this.device = null;

                _this.eventDisconnected();
            });

            return this.gattConnect(device)
            .then(function (characteristics) {
                console.log(LOG_EVENT + "found " + characteristics.length + " characteristic(s)");
                _this.notifyChar = characteristics.find(function (characteristic) {
                    return (characteristic.uuid === NOTIFY_UUID);
                });
                _this.writeReadChar = characteristics.find(function (characteristic) {
                    return (characteristic.uuid === WRITE_RESPONSE_UUID);
                });

                if (_this.notifyChar && _this.writeReadChar) {
                    //return device;
                }

                //device.ongattserverdisconnected = _this.disconnect;
                if (!_this.notifyChar || !_this.writeReadChar) {
                    throw new Error("Unsupported device");
                }

                if (!_this.notifyChar.properties.notify) {
                    throw new Error("Control characteristic does not allow notifications");
                }

                return _this.notifyChar.startNotifications();
            }).then(function () {
                _this.notifyChar.addEventListener("characteristicvaluechanged", _this.handleNotification.bind(_this));
                console.log(LOG_EVENT + "enabled control notifications");
                _this.device = device;
                return device;
            });
        };

        Indigo.prototype.gattConnect  = function (device) {
            return Promise.resolve()
                .then(function () {
                if (device.gatt.connected)
                    return device.gatt;
                return device.gatt.connect();
            })
            .then(function (server) {
                console.log(LOG_EVENT + "connected to gatt server");
                return server.getPrimaryService(SERVICE_UUID);
            })
            .then(function (service) {
                console.log(LOG_EVENT + "found DFU service" + service.getCharacteristics());
                return service.getCharacteristics();
            });
        }

        Indigo.prototype.handleNotification = function (event) {
            var value = event.target.value;
            var len = value.byteLength;
            var bytes = [];
            for (var k = 0; k < len; k++)
            {
                var b = value.getUint8(k);
                bytes.push(b);
            }

            console.log(LOG_INPUT + bytes);

            if(this.notifyFns != null){
                this.notifyFns(bytes);
            }else{
                console.log(LOG_EVENT + "notification handler is null");
            }

        };

        Indigo.prototype.eventDisconnected = function () {
            this.dispatchEvent(Indigo.EVENT_DISCONNECTED, null);
        };

        Indigo.prototype._write = function (data) {
            var _this = this;
            return _this.delayPromise(_this.delay).then(function () {
                var bytes = new Uint8Array(API_MAX_LENGTH);
                bytes.set(data);
                console.log(LOG_OUTPUT + bytes);
                return _this.writeReadChar.writeValue(bytes);
            });
        };

        Indigo.prototype.write = function (callback, data) {
            var _this = this;
            _this.notifyFns = callback;
            return _this._write(data);
        };

        Indigo.prototype.disconnect = function () {
            console.log(LOG_EVENT + "Device disconnected");
            if(this.device != null && this.device.gatt != null){
                this.device.gatt.disconnect();
            }

            this.notifyChar = null;
            this.writeReadChar = null;
            this.device = null;
        };

        Indigo.prototype.delayPromise = function (delay) {
            return new Promise(function (resolve) {
                setTimeout(resolve, delay);
            });
        };

        return Indigo;
    }());
    return Indigo;
}));

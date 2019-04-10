/**
 Copyright (c) 2016, 2017 Alan Yorinks All right reserved.

 Python Banyan is free software; you can redistribute it and/or
 modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 Version 3 as published by the Free Software Foundation; either
 or (at your option) any later version.
 This library is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 General Public License for more details.

 You should have received a copy of the GNU AFFERO GENERAL PUBLIC LICENSE
 along with this library; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

new(function() {
  ext = this;
  var socket = null;

  var connected = false;

  var sonars = {};

  // an array to hold possible digital input values for the reporter block
  var digital_inputs = new Array(32);
  var myStatus = 1; // initially yellow
  var myMsg = 'not_ready';

  ext.cnct = function(callback) {
    window.socket = new WebSocket("ws://127.0.0.1:9000");
    window.socket.onopen = function() {
      var msg = JSON.stringify({
        "command": "ready"
      });
      window.socket.send(msg);
      myStatus = 2;

      // change status light from yellow to green
      myMsg = 'ready';
      connected = true;

      // initialize the reporter buffer
      digital_inputs.fill('0');

      // give the connection time establish
      window.setTimeout(function() {
        callback();
      }, 1000);

    };

    window.socket.onmessage = function(message) {
      var msg = JSON.parse(message.data);

      // handle the only reporter message from the server
      // for changes in digital input state
      var reporter = msg['report'];
      if (reporter === 'digital_input_change') {
        var pin = msg['pin'];
        digital_inputs[parseInt(pin)] = msg['level']
      } else if (reporter === "sonar_distance") {
        var name = msg['name'];
        var s = sonars[name];
        if (s) {
          s.distance = msg['distance'];
          s.distanceUpdate = true;
          s.updateTime = new Date().getTime();;
        }
      }
      console.log(message.data)
    };
    window.socket.onclose = function(e) {
      console.log("Connection closed.");
      socket = null;
      connected = false;
      myStatus = 1;
      myMsg = 'not_ready'
    };
  };

  // Cleanup function when the extension is unloaded
  ext._shutdown = function() {
    var msg = JSON.stringify({
      "command": "shutdown"
    });
    window.socket.send(msg);
  };

  // Status reporting code
  // Use this to report missing hardware, plugin or unsupported browser
  ext._getStatus = function(status, msg) {
    return {
      status: myStatus,
      msg: myMsg
    };
  };

  // when the connect to server block is executed
  ext.input = function(pin) {
    if (connected == false) {
      alert("Server Not Connected");
    }
    // validate the pin number for the mode
    if (validatePin(pin)) {
      var msg = JSON.stringify({
        "command": 'input',
        'pin': pin
      });
      window.socket.send(msg);
    }
  };

  // when the digital write block is executed
  ext.digital_write = function(pin, state) {
    if (connected == false) {
      alert("Server Not Connected");
    }
    console.log("digital write");
    // validate the pin number for the mode
    if (validatePin(pin)) {
      var msg = JSON.stringify({
        "command": 'digital_write',
        'pin': pin,
        'state': state
      });
      console.log(msg);
      window.socket.send(msg);
    }
  };

  // when the PWM block is executed
  ext.analog_write = function(pin, value) {
    if (connected == false) {
      alert("Server Not Connected");
    }
    console.log("analog write");
    // validate the pin number for the mode
    if (validatePin(pin)) {
      // validate value to be between 0 and 255
      if (value === 'VAL') {
        alert("PWM Value must be in the range of 0 - 255");
      } else {
        value = parseInt(value);
        if (value < 0 || value > 255) {
          alert("PWM Value must be in the range of 0 - 255");
        } else {
          var msg = JSON.stringify({
            "command": 'analog_write',
            'pin': pin,
            'value': value
          });
          console.log(msg);
          window.socket.send(msg);
        }
      }
    }
  };
  // ***Hackeduca --> when the Servo block is executed
  ext.servo = function(pin, value) {
    if (connected == false) {
      alert("Server Not Connected");
    }
    console.log("servo");
    // validate the pin number for the mode
    if (validatePin(pin)) {
      // validate value to be between 0° and 180°
      if (value === 'VAL') {
        alert("Servo Value must be in the range of 0° - 180°");
      } else {
        value = parseInt(value);
        if (value < 0 || value > 180) {
          alert("Servo Value must be in the range of 0° - 180°");
        } else {
          var msg = JSON.stringify({
            "command": 'servo',
            'pin': pin,
            'value': value
          });
          console.log(msg);
          window.socket.send(msg);
        }
      }
    }
  };

  // when the play tone block is executed
  ext.play_tone = function(pin, frequency) {
    if (connected == false) {
      alert("Server Not Connected");
    }
    // validate the pin number for the mode
    if (validatePin(pin)) {
      var msg = JSON.stringify({
        "command": 'tone',
        'pin': pin,
        'frequency': frequency
      });
      console.log(msg);
      window.socket.send(msg);
    }
  };

  // when the digital read reporter block is executed
  ext.digital_read = function(pin) {
    if (connected == false) {
      alert("Server Not Connected");
    } else {
      return digital_inputs[parseInt(pin)]

    }
  };


  //sonar
  ext.sonar_HCSR04 = function(name, trigPin, echoPin, interval) {
    console.log("sonar_report:" + name + " trig:" + trigPin + " echo:" + echoPin + " interval:" + interval);
    if (sonars[name]) {
      //already create;
      console.log(name + " already created");
      var s = sonars[name];
      s.trig = trigPin;
      s.echo = echoPin;
      s.checkInterval = interval;
    } else {
      //create new sonar;
      console.log("creating sonar " + name);
      var s = new HCSR04Sonar(name, trigPin, echoPin, interval);
      sonars[name] = s;
    }
    console.log(JSON.stringify(sonars));
  };

  ext.sonar_read = function(name) {
    var sonar = sonars[name];
    if (sonar) {
      var start = new Date().getTime();

      if (sonar.checkInterval > 0 && sonar.distanceUpdate && (new Date().getTime() - start) < 2 * sonar.checkInterval) {
        return sonar.distance;
      }

      //new checkDistance
      sonar.checkDistance();
      //wait for 1s
      while (new Date().getTime() - start < 1000) {
        if (sonar.distanceUpdate) {
          return sonar.distance;
        }
      }

    }
    return -1;
  };

  //when sonar distance
  ext.whenDistance = function(name, op, reference) {
    var sonar = sonars[name];
    //console.log("check whenDistance name:"+name+" op:"+op+" ref:"+reference);

    if (sonar) {
      var dist = ext.sonar_read(name);
      switch (op) {
        case strings.COMP_LESS:
          return dist >= 0 && dist < reference;
        case strings.COMP_MORE:
          return ext.sonar_read(name) > reference;
        default:
          console.log('Unknown operator in whenDistance: ' + op);
      }
    }
    return false;
  };

  //when pin high or low start
  ext.whenPinHigLow = function(pin, reference) {
    reference = reference || -2;
    if (validatePin(pin)) {


      var level = ext.digital_read(pin) || -1;

      console.log("whenPinHigLow pin:" + pin + " ref:" + reference + " level:" + level);
      return level == parseInt(reference);
    }
    return false;
  };
  // general function to validate the pin value
  function validatePin(pin) {
    var rValue = true;
    if (pin === 'PIN') {
      alert("Insert a valid BCM pin number.");
      rValue = false;
    } else {
      var pinInt = parseInt(pin);
      if (pinInt < 0 || pinInt > 31) {
        alert("BCM pin number must be in the range of 0-31.");
        rValue = false;
      }
    }
    return rValue;
  }


  var strings = {
    MOTOR_DEFAULT: 'motor',
    MOTOR_A: 'motor A',
    MOTOR_B: 'motor B',
    MOTOR_ALL: 'all motors',
    DIR_FORWARD: 'this way',
    DIR_BACK: 'that way',
    DIR_REV: 'reverse',
    TILT_UP: 'up',
    TILT_DOWN: 'down',
    TILT_LEFT: 'left',
    TILT_RIGHT: 'right',
    TILT_ANY: 'any',
    COMP_LESS: '<',
    COMP_MORE: '>',
    COMP_EQ: '=',
    COMP_NEQ: 'not ='
  };
  // Block and block menu descriptions
  var descriptor = {
    blocks: [
      // Block type, block name, function name
      ["w", 'Connect to s2_pi server.', 'cnct'],
      [" ", 'Set BCM %m.pins as an Input', 'input', 'PIN'],
      [" ", "Set BCM %m.pins Output to %m.high_low", "digital_write", "PIN", "0"],
      [" ", "Set BCM PWM Out %m.pins to %n", "analog_write", "PIN", "VAL"],
      [" ", "Set BCM %m.pins as Servo with angle = %n (0° - 180°)", "servo", "PIN", "0"], // ***Hackeduca --> Block for Servo
      [" ", "Tone: BCM %m.pins HZ: %n", "play_tone", "PIN", 1000],
      ["r", "Read Digital Pin %m.pins", "digital_read", "PIN"],
      [" ", 'HC-SR04 Sonar %m.sonar_id Trig Pin %m.pins and Echo Pin %m.pins', "sonar_HCSR04", "A", "PIN", "PIN"],
      ["r", 'Read HC-SR04 Sonar %m.sonar_id Distance', "sonar_read", "A"],
      ["h", 'Start at HC-SR04 Sonar %m.sonar_id Distance %m.lessMore %n cm', 'whenDistance', 'A', strings.COMP_LESS, 50],
      ["h", 'Start when %m.pins is %m.high_low', 'whenPinHigLow', 'PIN', '1']


    ],
    "menus": {
      "high_low": ["0", "1"],
      "pins": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
      "interval": [-1, 0, 100, 200, 500, 1000, 2000, 3000, 4000],
      "sonar_id": ["A", "B", "C", "D", "E", "F"],
      lessMore: [strings.COMP_LESS, strings.COMP_MORE],
      eNe: [strings.COMP_EQ, strings.COMP_NEQ]
    },
    url: 'http://MrYsLab.github.io/s2-pi'
  };

  // Register the extension
  ScratchExtensions.register('s2_pi', descriptor, ext);

  HCSR04Sonar = function(name, trigPin, echoPin, interval) {
    var sonar = this;
    sonar.ready = false;
    if (!trigPin) {
      alert("trig pin not set");
      return;
    }

    if (!echoPin) {
      alert("echo pin not set");
      return;
    }

    if (!name) {
      alert("sonar name is not set");
      return;
    }

    sonar.trig = trigPin;
    sonar.echo = echoPin;
    sonar.name = name;
    sonar.distanceUpdate = false;
    sonar.distance = -1;
    sonar.inited = false;
    sonar.checkInterval = interval || -1;
    sonar.intervalId;
    sonar.updateTime = 0;
    sonar.init();

  }
  HCSR04Sonar.prototype.init = function() {
    if (this.checkInterval >= 0) {
      if (connected == false) {
        alert("Server Not Connected");
        return;
      }
      // validate the pin number for the mode
      if (validatePin(this.trig) && validatePin(this.echo)) {
        var msg = JSON.stringify({
          "command": 'sonar',
          'trig': this.trig,
          'echo': this.echo,
          'name': this.name,
          'interval': this.checkInterval
        });
        console.log(msg);
        distanceUpdate = false;
        window.socket.send(msg);
      }
    }
  }
  HCSR04Sonar.prototype.checkDistance = function() {
    if (connected == false) {
      alert("Server Not Connected");
      return;
    }

    // validate the pin number for the mode
    if (validatePin(this.trig) && validatePin(this.echo)) {
      var msg = JSON.stringify({
        "command": 'sonar_read',
        'trig': this.trig,
        'echo': this.echo,
        'name': this.name
      });
      console.log(msg);
      distanceUpdate = false;
      window.socket.send(msg);
    }
  }
})();

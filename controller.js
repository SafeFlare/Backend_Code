const express = require('express');
const { initializeApp } = require('firebase-admin');
const app = express();
const port = 3000;
var path = require('path');
var admin = require("firebase-admin");
var bodyParser = require('body-parser');
const { execPath } = require('process');
const Proxy = require('http-proxy').createProxyServer();
const config = require(path.join(__dirname,"/global.json"));

const ProxyServer= 'http://localhost:'+ config.Proxy.settings.port;

const io = require('socket.io')(config.Server.settings.socket, {
  handlePreflightRequest: (req, res) => {
      const headers = {
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Origin": req.headers.origin,
          "Access-Control-Allow-Credentials": true,
          "Socket Powered By:":"Emiga Stream https://github.com/eminmuhammadi/emiga-stream.git"
      };
      res.writeHead(200, headers);
      res.end();
  },
  path: '/',
  serveClient: true,
  origins: '*:*',
  cookie: true,
  pingInterval: 1000,
  pingTimeout: 1000,
  upgradeTimeout: 1000,   
  allowUpgrades: true,
  cookie: 'emiga_stream',
  cookiePath:'/',
  cookieHttpOnly:true 
});

io.of('/stream').clients((error, clients) => {
  if (error) throw error;
    console.log(clients);
});

// Fetch the service account key JSON file contents
var serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // The database URL depends on the location of the database
  databaseURL: "https://safe-flare-default-rtdb.asia-southeast1.firebasedatabase.app"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();


function formatNumberToKD(number) {
  // Use padStart to add leading zeros to numbers
  const paddedNumber = String(number).padStart(4, '0');
  
  // Concatenate strings with the prefix "KD-"
  const formattedString = `KD-${paddedNumber}`;
  
  return formattedString;
}

//Function to register new devices that have been installed at a location
function addDevice(id="default",latitude=0,longitude=0,image){
  if (id === "default") {
    path = db.ref("/delete_id");
    path.once('value', (delete_id) => {
      if (delete_id.val() == null) {
        last_id_path = db.ref("/latest_id");
        last_id_path.once('value')
        .then((last_id) => {
          new_last_id = (last_id.val() === null) ? "KD-0000" : formatNumberToKD(parseInt(last_id.val().slice(3),10) + 1);
          console.log('Device has been added:', new_last_id);
          db.ref().child(new_last_id).set({lat:latitude,long:longitude});
          db.ref("/latest_id").set(new_last_id);
        })
        .catch((error) => {
          console.error('Error:', error);
        });
      } else {
        path.once('child_added', (first_id) => {
          db.ref().child(first_id.val()).set({lat:latitude,long:longitude});
        }).catch((error) => {
          console.error('Error:', error);
        });
      }
    }).catch((error) => {
      console.error('Error:', error);
    });
  } else {
    db.ref().child(id).set({lat:latitude,long:longitude});
  }
}

//function for add data device and sorted by timestamp
function addDataDevice(id,rain=0,temperature=0,air_quality=0,wind=0,wind_direct=0){
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  db.ref().child(id+"/censor/"+String(currentTimestampInSeconds)).set({rain:rain,temp:temperature,air_quality:air_quality,wind:wind,wind_direct:wind_direct});
  db.ref().child(id+"/censor/latest").set({rain:rain,temp:temperature,air_quality:air_quality,wind:wind,wind_direct:wind_direct});
}

app.get('/', (req, res) => {
  res.send('Google Hackfest 2024');
});

app.listen(port, () => {
  console.log(`Aplikasi berjalan di http://localhost:${port}`);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//API for add data censor from IOTS device
app.post('/api/add_censor', function (req, res) {
    var device = req.body;

    console.log('Censor device has been added:', device);
    if (device.id !== undefined){
      addDataDevice(device.id,device.rain,device.temp,device.air,device.wind,device.wind_direct);
      return res.send(device.id + ' device censor data has been added successfully');
    } else {
      return res.status(500).send('ID has not been received');
    }
});

// API for register IOTS device
app.post('/api/reg_device', function (req, res) {
  var reg = req.body;

  console.log('Device has been added:', reg);

  addDevice(reg.id,reg.lat,reg.long);
  return res.send('device has been registered successfully');
});

// iots device API to send fire alerts to the backend
app.post('/api/fire_alert', function (req, res) {
  var reg = req.body;
    if(reg.image != null){
    addDevice(reg.id,reg.lat,reg.long,reg.image);
    return res.send('device has been sended alert successfully');
  } else {
    return res.send('please insert image location device');
  }
});


/*
 * Generic serial-port setup tab
 * for devices which talk to a serial port directly attached to Vera
 * or which can open a TCP socket to an IPv4 host.
 *
 * How to use this tab in your plugin:
 *
 * 1. In your static JSON file, define a tab like this:
 * {
 *   "Label": { 
 *     "lang_tag": "connection", 
 *     "text": "Connection" 
 *   }, 
 *   "Position": "1", 
 *   "TabType": "javascript",
 *   "ScriptName": "J_SerialConnection.js",
 *   "Function": "serialConnection"
 * },
 *
 * 2. In your Lua code startup function:
 *    - Check for the "urn:micasaverde-com:serviceId:HaDevice1"/"IODevice" variable.
 *      If set and not empty, this means a "local" serial port has been assigned by
 *      the user (it may be IPSerial or a physical serial port).  Do nothing more.
 *    - Check for the "ip" special variable.
 *      If set and of the form "1.1.1.1:123", this means a TCP socket to an IPv4 host
 *      on the specified port should be opened using luup.io.open().
 *      If set and of the form "1.1.1.1", this means that the TCP port is a "default"
 *      value, which may mean something useful or not, depending on the plugin.
 *      Use luup.io.open() or signal an error.
 *      Other forms are reserved (for IPv6 or named hosts).
 *    - If neither is set, return false from the startup to signal an error.
 *
 * Copyright 2012 Deborah Pickett (futzle)
 * This is free software and may be used under GPLv2 or BSD licences.
 */

var numberPattern255 = "(\\d|[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])";
var numberPattern65535 = "(\\d|[1-9]\\d|[1-9]\\d\\d|[1-9]\\d\\d\\d|[1-5]\\d\\d\\\d\\d|6[0-4]\\d\\d\\d|65[0-4]\\d\\d|655[0-2]\\d|6553[0-5])";
var ipv4Pattern = new RegExp("^" + numberPattern255 + "\\." 
  + numberPattern255 + "\\." + numberPattern255 + "\\." + numberPattern255 + "$");
var ipv4PortPattern = new RegExp("^(" + numberPattern255 + "\\." 
  + numberPattern255 + "\\." + numberPattern255 + "\\." + numberPattern255 + "):("
  + numberPattern65535 + ")$");

function getConnectionType(deviceId)
{
  var ioDevice = get_device_state(deviceId, "urn:micasaverde-com:serviceId:HaDevice1", "IODevice", 0);
  var ipDevice = jsonp.get_device_by_id(deviceId);
  if (ioDevice != undefined && ioDevice != "") { return "ioDevice"; }
  if (ipDevice != undefined)
  {
    if (ipDevice.ip != "")
    {
      return "ip";
    }
  }
  return "none";
}

/* Get a list of all serial devices. */
function getSerialDevices(deviceId)
{
  return jsonp.ud.devices.findAll(function(d) {
    return d.device_type == "urn:micasaverde-org:device:SerialPort:1";
  } );
}

/* Find the device which has the given device ID
   as its "IODevice" variable.  This is the device
   that "owns" the given serial device. */
function getDeviceOfSerialDevice(serialDeviceId)
{
  var matches = jsonp.ud.devices.findAll(function(d) {
    return d.states.findAll(function(state) {
      return state.service == "urn:micasaverde-com:serviceId:HaDevice1" &&
        state.variable == "IODevice" &&
        state.value == serialDeviceId;
    } ).length > 0;
  } );
  if (matches.length > 0) { return matches[0]; }
  return undefined;
}

/* Get the IP address, coded in the ip special variable. */
function getIpAddress(deviceId)
{
  var ipDevice = jsonp.get_device_by_id(deviceId);
  var ip = ipDevice.ip;
  if (ip == undefined) { return undefined; }
  if (ip == "") { return undefined; }
  if (ipv4Pattern.test(ip)) { return ip; }
  var ipv4Match = ipv4PortPattern.exec(ip);
  if (ipv4Match != undefined) { return ipv4Match[1]; }
  return undefined;
}

/* Get the TCP port, coded in the ip special variable. */
function getTcpPort(deviceId)
{
  var ipDevice = jsonp.get_device_by_id(deviceId);
  var ip = ipDevice.ip;
  if (ip == undefined) { return undefined; }
  if (ip == "") { return undefined; }
  if (ipv4Pattern.test(ip)) { return undefined; }
  var ipv4Match = ipv4PortPattern.exec(ip);
  if (ipv4Match != undefined) { return ipv4Match[6]; }
  return undefined;
}

/* Mess with the DOM to disable parts of the UI. */
function enableSelectedOption(deviceId, currentConnectionType)
{
  $('serialDevice').disable();
  $('ipaddress').disable();
  $('tcpport').disable();

  if (currentConnectionType == "ioDevice")
  {
    $('serialDevice').enable();
  }
  if (currentConnectionType == "ip")
  {
    $('ipaddress').enable();
    $('tcpport').enable();
  }
}

/* Set the IODevice variable, when
   the radio button for "serial port" is selected,
   or when the dropdown changes. */
function setSerialDevice(deviceId, serialDeviceId)
{
  enableSelectedOption(deviceId,"ioDevice");
  set_device_state(deviceId, "urn:micasaverde-com:serviceId:HaDevice1", "IODevice", serialDeviceId, 0);
  jsonp.get_device_by_id(deviceId).ip = "";
}

/* Set the ip special variable, when
   the radio button for "serial proxy" is selected,
   or when the two text fields change. */
function setIPDevice(deviceId, ipAddress, tcpPort)
{
  enableSelectedOption(deviceId,"ip");
  if (tcpPort == undefined || tcpPort == "")
  {
    jsonp.get_device_by_id(deviceId).ip = ipAddress;
  }
  else
  {
    jsonp.get_device_by_id(deviceId).ip = ipAddress + ":" + tcpPort;
  }
  set_device_state(deviceId, "urn:micasaverde-com:serviceId:HaDevice1", "IODevice", "", 0);
}

/* Entry point.  This function sets the HTML for the tab. */
function serialConnection(deviceId)
{
  var currentConnectionType = getConnectionType(deviceId);
  
  var htmlResult = "<div>";
  htmlResult += "<form>";
  htmlResult += "<p>Select how the serial device is connected.</p>";

  /* Serial port (including IPSerial) */
  htmlResult += "<p><input type='radio' name='connectionType' value='serial' ";
  if (currentConnectionType == "ioDevice") htmlResult += "checked='checked' ";
  htmlResult += "onclick='setSerialDevice(" + deviceId + ",$F(serialDevice))'/>Serial port or IPSerial device ";
  htmlResult += "<select id='serialDevice' onchange='setSerialDevice(" + deviceId + ",$F(serialDevice))'>";
  htmlResult += "<option value=''>None</option>";
  var serialDevices = getSerialDevices(deviceId);
  htmlResult += serialDevices.inject("", function(htmlResult, d) {
    htmlResult += "<option value='" + d.id + "'";
    var deviceOwner = getDeviceOfSerialDevice(d.id);
    if (deviceOwner != undefined)
    {
      if (deviceId == deviceOwner.id)
      {
        // This is my serial device.
        htmlResult += " selected='selected'";
      }
      else
      {
        // Devices already owned by other plugins.
        htmlResult += " disabled='disabled'";
      }
    }
    htmlResult += ">" + d.name.escapeHTML();
    // Tell user who owns this device (if it's not us).
    if (deviceOwner != undefined && deviceOwner.id != deviceId)
    {
      htmlResult += " [" + deviceOwner.name.escapeHTML() + "]";
    }
    htmlResult += "</option>";
    return htmlResult;
  });
  htmlResult += "</select>";
  htmlResult += "</p>";

  /* Serial proxy over Ethernet. */
  htmlResult += "<p><input type='radio' name='connectionType' value='ip' ";
  if (currentConnectionType == "ip") htmlResult += "checked='checked' ";
  htmlResult += "onclick='setIPDevice(" + deviceId + ",$F(ipaddress),$F(tcpport))'/>Serial proxy on another machine ";
  var ipAddress = getIpAddress(deviceId);
  if (ipAddress == undefined) { ipAddress = ""; }
  htmlResult += "<p style='margin-left: 4em;'>IP address <input id='ipaddress' type='text' size='16' value='" + ipAddress.escapeHTML() + "' onchange='setIPDevice(" + deviceId + ",$F(ipaddress),$F(tcpport))' />";
  var tcpPort = getTcpPort(deviceId);
  if (tcpPort == undefined) { tcpPort = ""; }
  htmlResult += " TCP port <input id='tcpport' type='text' size='6' value='" + tcpPort.escapeHTML() + "' onchange='setIPDevice(" + deviceId + ",$F(ipaddress),$F(tcpport))' /></p> ";
  htmlResult += "</p>";

  htmlResult += "</form>";
  htmlResult += "</div>";
  set_panel_html(htmlResult);

  enableSelectedOption(deviceId, currentConnectionType);
}

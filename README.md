# CurrentCost EnviR power monitor 

The [EnviR](http://www.currentcost.com/product-envir.html) (CC128) is a wireless power monitor from [CurrentCost](http://www.currentcost.com/).  The console receives up to ten wirelessly-transmitted current signals from [transmitters](http://www.currentcost.com/product-transmitter.html).  Transmitters detect one- or three-phase alternating current with clamps.  Combined with a fixed nominal voltage programmed into the console, the EnviR calculates a wattage.

Discussion and support at the Micasaverde forum: http://forum.micasaverde.com/index.php?topic=6752.0

## Serial protocol 

The EnviR has an RJ45 port with nonstandard wiring, carrying a TTL serial signal.  A [data cable](http://www.currentcost.com/product-datacable.html) containing an inline Prolific PL-2303 chip transforms this signal into a USB serial signal.  The serial protocol is [documented](http://www.currentcost.com/cc128/xml.htm).

## Preparing the hardware 

You need a serial port in Vera's MiOS interface.  Two ways of doing this:
* Connect the EnviR to the Vera.
* Connect the EnviR to an always-on computer running serial-to-Ethernet gateway software, and use the [IPSerial](http://code.mios.com/trac/mios_ipserial/) to add a virtual serial port to the Vera.  (Note that the Windows serial driver provided by CurrentCost is known to produce [Error Code 10](http://www.prolific.com.tw/eng/FAQs.asp?ID=50) messages.  One user reported that a pre-installed driver for the Holux GPS worked in its place.

The serial parameters are: 57600 bps, 8 data bits, no parity, 1 stop bit.

## Installing the plugin files 

Install these files from the repository:
* D_CurrentCostEnviR1.json
* D_CurrentCostEnviR1.xml
* D_CurrentCostEnviRAppliance1.json
* D_CurrentCostEnviRAppliance1.xml
* D_CurrentCostEnviRAppliancePhase1.json
* D_CurrentCostEnviRAppliancePhase1.xml
* I_CurrentCostEnviR1.xml
* J_CurrentCostEnviR1.js
* J_SerialConnection.js
* L_CurrentCostEnviR1.lua
* S_CurrentCostEnviR1.xml

## Creating the device 

This device requires MiOS UI4 or UI5.

Select **MiOS Developers** > **Create Device**. Enter **D_CurrentCostEnviR1.xml** for **UpnpDevFilename**.  Enter a name for **Description**.  Click **Create Device**.

Select **MiOS Developers** > **Serial port configuration**.  Assign the serial port to the newly-created device.  Set the serial parameters (57600/8/N/1).  

Select **Save** to restart the Luup engine.  The device should appear.  By default it shows the power usage for the "whole-house" device.

The plugin creates child devices for additional appliances that the EnviR console detects.  These will first appear when you reload the Luup engine.  Child devices can be renamed and assigned to rooms after the plugin creates them.  (This behaviour can be disabled.  See the section *Customizing the plugin*.)

## Main device 

The main device's **Control** tab also shows the indoor temperature measured by the thermometer inside the console, as well as the console's idea of the current time.  This time can be set on the console; it should be kept roughly accurate to provide good history data.  The console does not know about dates, but it tracks the number of days since the console was first turned on ("Days since birth").

Notifications can be set for power usage or temperature on the **Notifications** tab.  (Note that the temperature is not very accurate.)

## Child devices for appliances 

Each appliance detected by the console is presented as a child device.  These devices can be moved to other rooms in the MiOS user interface.  The whole-house sensor is also presented as Appliance 0.

## History graphs 

The **History** tab on devices shows the appliance's historical power usage in kWh, in two-hourly, daily and monthly intervals.  This information is downloaded from the console after each odd-numbered hour.  If there is not enough history, the graphs are not shown.

On the parent device, the power formula is used to compute the history graph.

The graphs are generated using the [Google Chart Image API](http://code.google.com/apis/chart/image/).

## Customizing the plugin 

After the plugin has been installed, you can alter its configuration.  You may need an additional restart of the Luup Engine for these variables to appear.

### Main device power formula 

If you have additional transmitters, or you are not using the "whole-house" channel, you can nominate a formula to use to display the power in the main device.  The formula is a string of appliance numbers (1 to 9, or 0 for the "whole-house" channel), separated with **+** or **-** to add or subtract that appliance's power.  Subtraction is useful if an appliance is a generator such as a solar array.

Edit the formula in the **Advanced** tab of the main device.  Put the formula into the **Formula** variable.  By default it is "0", meaning the whole-house channel.

Example: You have your home's energy consumption transmitting on the "whole-house" channel.  You have a solar panel that feeds power into the grid on Appliance 1.  You have a workshop on your property with a separate power supply on Appliance 5.  Use the formula **0-1+5** to display the net power consumption of your property. 

### Automatic child device detection 

By default, the plugin creates child devices for each appliance transmitter that the EnviR console can detect.  If you want to stop this, edit the **ApplianceAutoDetect** variable in the **Advanced** tab of the parent device.  When set to "0", the plugin will no longer look for new appliances.  Existing appliances are unaffected. 

### Separate temperature child device 

If you set the **ChildTemperature** variable in the **Advanced** tab of the parent device to "1", the plugin will create a separate "Temperature Sensor" child device on the next reload.  The plugin will update the device's temperature from the thermometer built into the console.  The child device can be relocated to other rooms.

Irrespective of whether a separate child temperature device is present, the temperature is always set on the parent device and all children.

### Three-phase appliances 

If the appliance transmitter has multiple clamps it will transmit power for each clamp.  The plugin normally adds these values together and presents the sum as the total power for the appliance.

The plugin can be configured to also show each clamp in its own child device.  To configure this for (say) Appliance 5, set a variable with service **urn:futzle-com:serviceId:CurrentCostEnviR1** and name **Appliance5ThreePhase** to **1**.  Set the variable back to **0** to disable this feature.

Single-clamp child devices cannot be used in the Main device power formula.

The EnviR does not store individual phase power history, so single-clamp child devices do not have history graphs.

### History graph colouring 

If you pay different tariffs depending on time of use, you can define a snippet of code which assigns a colour to each bar in the history graphs of devices.

For the two-hourly graph, create a variable with service ID **urn:futzle-com:serviceId:CurrentCostEnviR1** and variable name **TwoHourlyHistoryColour**.  For the daily graph, create a variable with the same service ID and variable name **DailyHistoryColour**.  For the monthly graph, create a variable with the same service ID and variable name **MonthlyHistoryColour**.  (Americans take note at the spelling of these variables.)

The contents of the variable is a JavaScript fragment which evaluates to a string in the form **RRGGBB**.  A variable **time** contains a JavaScript **Date** object corresponding to the start time of that bar in the graph.

Examples:
* In the two-hourly graph, to display red from 7 am to 11 pm on weekdays, and blue at other times:
`time.getHours() >= 23 || !(time.getHours() >= 7) || time.getDay() == 0 || time.getDay() == 6 ?  '4D89F9' : 'CC5544'`
* In the daily graph, to display purple for weekdays, and blue on weekends:
`time.getDay() == 0 || time.getDay() == 6 ? '4D89F9' : 'AA55CC'`

Note how the logic has been written to avoid HTML-special characters **&**, **"** and **<**.  This prevents weird HTML injection artifacts on the device's Advanced tab.

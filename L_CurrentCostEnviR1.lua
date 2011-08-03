module ("L_CurrentCostEnviR1", package.seeall)

-- Power used/consumed by each appliance (0 is the "whole house" appliance).
APPLIANCE_POWER = { }
-- Service ID strings used by this device.
SERVICE_ID = "urn:futzle-com:serviceId:CurrentCostEnviR1"
ENERGY_SERVICE_ID = "urn:micasaverde-com:serviceId:EnergyMetering1"
TEMPERATURE_SERVICE_ID = "urn:upnp-org:serviceId:TemperatureSensor1"
-- Cache of child devices, maps appliance number to MiOS device ID.
CHILD_DEVICE = { }
-- History caches for each appliance, for three time scales.
TWOHOURLY_HISTORY = { ["0"] = { }, ["1"] = { }, ["2"] = { }, ["3"] = { }, ["4"] = { }, ["5"] = { }, ["6"] = { }, ["7"] = { }, ["8"] = { }, ["9"] = { } }
DAILY_HISTORY = { ["0"] = { }, ["1"] = { }, ["2"] = { }, ["3"] = { }, ["4"] = { }, ["5"] = { }, ["6"] = { }, ["7"] = { }, ["8"] = { }, ["9"] = { } }
MONTHLY_HISTORY = { ["0"] = { }, ["1"] = { }, ["2"] = { }, ["3"] = { }, ["4"] = { }, ["5"] = { }, ["6"] = { }, ["7"] = { }, ["8"] = { }, ["9"] = { } }
-- Set to the current Unix timestamp when history packets start coming in.
-- Used to determine when the history transmission has been exhausted,
-- and the history variables on the devices should be updated..
HISTORY_LAST_UPDATED = nil
-- Print lots of useless debugging information to the Luup log.
DEBUG = false

-- Run once at Luup engine startup.
function initialize(lul_device)
	luup.log("Initializing CurrentCost EnviR")

	-- Help prevent race condition
	luup.io.intercept()

	-- Create child devices for the attached appliances.
	-- The variables Appliance0 .. Appliance9 will have been created by the
	-- plugin on a previous execution based on the devices mentioned in the
	-- realtime XML output, so the plugin needs at least one
	-- restart in order to create child devices.
	local childDevices = luup.chdev.start(lul_device)
	for child = 0, 9 do
		if (luup.variable_get(SERVICE_ID, "Appliance" .. tostring(child), lul_device) or "0" ~= "0") then
			luup.chdev.append(lul_device, childDevices, "Appliance" .. tostring(child),
				"Appliance " .. child, "urn:schemas-futzle-com:device:CurrentCostEnvirAppliance:1",
				"D_CurrentCostEnviRAppliance1.xml", "", "", false)
		end
	end
	luup.chdev.sync(lul_device, childDevices)

	-- Compute total power use for the parent device using this formula.
	-- Formula string contains sequences of +n or -n,
	-- adding or subtracting the appliance to compute a total.
	-- Default formula (0, equivalently +0) ignores appliances 1-9
	-- and counts only the whole-house reading.
	FORMULA = luup.variable_get(SERVICE_ID, "Formula", lul_device)
	if (FORMULA == nil) then
		luup.variable_set(SERVICE_ID, "Formula", "0", lul_device)
		FORMULA = "+0"
	else
		if (FORMULA:find("^[-+]") == nil) then
			FORMULA = "+" .. FORMULA
		end
	end
	luup.log("Power formula: " .. FORMULA)

	-- Flag: automatically detect appliances and create child devices
	-- the next time that the Luup engine is reloaded.
	AUTO_DETECT = luup.variable_get(SERVICE_ID, "ApplianceAutoDetect", lul_device)
	if (AUTO_DETECT == nil) then
		luup.variable_set(SERVICE_ID, "ApplianceAutoDetect", "1", lul_device)
	end

	-- Cache the child device ids, and populate the history variables.
	for sensor = 0, 9 do
		for k, v in pairs(luup.devices) do
			if (v.device_num_parent == lul_device and v.id == "Appliance" .. sensor) then
				if (DEBUG) then luup.log("Child deviceId for Appliance " .. sensor .. " is " .. k) end
				CHILD_DEVICE[tostring(sensor)] = k
				TWOHOURLY_HISTORY[tostring(sensor)] = deserializeHistory(luup.variable_get(SERVICE_ID, "TwoHourlyHistory", k) or "")
				DAILY_HISTORY[tostring(sensor)] = deserializeHistory(luup.variable_get(SERVICE_ID, "DailyHistory", k) or "")
				MONTHLY_HISTORY[tostring(sensor)] = deserializeHistory(luup.variable_get(SERVICE_ID, "MonthlyHistory", k) or "")
			end
		end
	end

	-- Startup is done.
end

-- Compute parent device's display.
function calculateFormula(t)
	local total = 0
	local formula = FORMULA
	for sign, appliance in formula:gfind("([+-])%s-(%d)") do
		if (sign == "+") then
			total = total + (t[appliance] or 0)
		elseif (sign == "-") then
			total = total - (t[appliance] or 0)
		end
	end
	return total
end

-- Serialize an array to a string.
-- Used to store two-hourly, daily and monthly history.
function serializeHistory(t)
	local result = ""
	for k, v in pairs(t) do
		result = k .. "=" .. v .. ";" .. result
	end
	return result
end

-- Deserialize a string into an array.
-- Used to store two-hourly, daily and monthly history.
function deserializeHistory(s)
	local result = { }
	for k, v in s:gfind("(.-)=(.-);") do
		result[k] = tonumber(v)
	end
	return result
end	

-- 
-- Process elements in the <msg> part of a packet.
-- 

-- <src> contains version of the CurrentCost protocol.
function processMsgSrc(context, lul_device, source)
	context.version = source
	luup.variable_set(SERVICE_ID, "Version", source, lul_device)
	return context
end

-- <uid> contains a pseudo-unique string for this EnviR.
function processMsgUid(context, lul_device, uid)
	context.version = uid
	luup.variable_set(SERVICE_ID, "UID", uid, lul_device)
	return context
end

-- <dsb> ("Days Since Birth") is the nearest thing the EnviR has of a date.
function processMsgDsb(context, lul_device, dsb)
	context.dsb = dsb
	luup.variable_set(SERVICE_ID, "DaysSinceBirth", tonumber(dsb), lul_device)
	return context
end

-- <time> is the EnviR console's time of day.
function processMsgTime(context, lul_device, time)
	context.time = time
	luup.variable_set(SERVICE_ID, "Time", time, lul_device)
	return context
end

-- <tmpr> is temperature in Celsius.
function processMsgTmpr(context, lul_device, tmpr)
	context.tmpr = tmpr
	luup.variable_set(TEMPERATURE_SERVICE_ID, "CurrentTemperature", tmpr, lul_device)
	return context
end

-- <sensor> appears in realtime packets.
function processMsgSensor(context, lul_device, sensor)
	context.packetType = "realtime"
	context.sensor = sensor -- 0 to 9 as string
	return context
end

-- <ch1>, <ch2>, <ch3> are phase wattages for type-1 transmitters.
function processMsgChannel(context, lul_device, channelContent)
	local matched, watts
	matched, _, watts = channelContent:find("^<watts>(.-)</watts>$")
	if (matched) then
		context.watts = (context.watts or 0) + watts
	end
	return context
end

-- 
-- Process elements in the <hist> part of a packet.
-- 

-- <data> is a set of history data points for a sensor.
function processHistData(context, lul_device, dataContent)
	local matched, sensor, historyPoints
	matched, _, sensor, historyPoints = dataContent:find("^<sensor>(%d)</sensor>(.-)$")
	if (matched) then
		-- Look for two-hourly history datapoints in the form <h004>.
		for age, value in historyPoints:gfind("<h(%d-)>(.-)</h%d->") do
			if (DEBUG) then luup.log("Two-hour history for sensor " .. sensor .. " for time " .. age .. " hours ago: " .. value) end
			TWOHOURLY_HISTORY[sensor][age] = tonumber(value)
		end
		-- Look for daily history datapoints in the form <d001>.
		for age, value in historyPoints:gfind("<d(%d-)>(.-)</d%d->") do
			if (DEBUG) then luup.log("Daily history for sensor " .. sensor .. " for time " .. age .. " days ago: " .. value) end
			DAILY_HISTORY[sensor][age] = tonumber(value)
		end
		-- Look for monthly history datapoints in the form <m001>.
		for age, value in historyPoints:gfind("<m(%d-)>(.-)</m%d->") do
			if (DEBUG) then luup.log("Monthly history for sensor " .. sensor .. " for time " .. age .. " months ago: " .. value) end
			MONTHLY_HISTORY[sensor][age] = tonumber(value)
		end
	end
	return context
end

XML_HIST_DISPATCH = {
	data = processHistData,
}

-- Postprocess the history packet.
function processHistContext(context, lul_device)
	if (DEBUG) then luup.log("Postprocessing history") end
	HISTORY_LAST_UPDATED = os.date("%s")
	-- To do: store Days Since Wipe from <dsw>.  Suspect it's needed to know what a "month" is.
end

-- <hist> is a history packet.
function processMsgHist(context, lul_device, histContent)
	context.packetType = "history"
	for element, content in histContent:gfind("<(.+)>(.-)</%1>") do
		if (DEBUG) then luup.log("Processing element in <hist>: " .. element) end
		if (XML_HIST_DISPATCH[element]) then
			context = XML_HIST_DISPATCH[element](context, lul_device, content)
		else
			context[element] = content
		end
	end
	-- Postprocess the history packet.
	processHistContext(context, lul_device)
	return context
end

XML_MSG_DISPATCH = {
	src = processMsgSrc,
	uid = processMsgUid,
	dsb = processMsgDsb,
	time = processMsgTime,
	tmpr = processMsgTmpr,
	sensor = processMsgSensor,
	ch1 = processMsgChannel,
	ch2 = processMsgChannel,
	ch3 = processMsgChannel,
	hist = processMsgHist,
}

-- Postprocess the packet.  Do the things that couldn't be done
-- until the whole packet was parsed.
function processMsgContext(context, lul_device)
	if (DEBUG) then luup.log("Postprocessing message") end
	if (context.packetType == "realtime" and context.type == "1") then
		-- Clamp-type electricity meter.

		-- Log the child device's power (if there is a child device).
		local childDevice = CHILD_DEVICE[context.sensor]
		if (childDevice ~= nil) then
			luup.variable_set(ENERGY_SERVICE_ID, "Watts", context.watts, childDevice)
			luup.variable_set(SERVICE_ID, "DaysSinceBirth", context.dsb, childDevice)
			luup.variable_set(SERVICE_ID, "Time", context.time, childDevice)
			luup.variable_set(TEMPERATURE_SERVICE_ID, "CurrentTemperature", context.tmpr, childDevice)
			luup.variable_set(SERVICE_ID, "Version", context.version, childDevice)
			luup.variable_set(SERVICE_ID, "UID", uid, childDevice)
			luup.variable_set(SERVICE_ID, "DaysSinceBirth", tonumber(dsb), childDevice)
			luup.variable_set(SERVICE_ID, "Time", time, childDevice)
		end

		-- Note this appliance number, if permitted.
		if (AUTO_DETECT or "0" ~= "0") then
			luup.variable_set(SERVICE_ID, "Appliance" .. context.sensor, context.id, lul_device)
		end

		-- Compute parent device's reading, using its custom formula.
		APPLIANCE_POWER[context.sensor] = context.watts
		luup.variable_set(ENERGY_SERVICE_ID, "Watts", calculateFormula(APPLIANCE_POWER), lul_device)
	end
end

-- Calculate the parent-device formula for device history at some scale (two-hour, daily, monthly).
function formulaHistory(lul_device, scale)
	local pivot = { }
	local formulaHistory = { }
	-- History tables are in wrong direction, and have to be transposed.
	for sensor = 0, 9 do
		for age, value in pairs(scale[tostring(sensor)]) do
			if (pivot[age] == nil) then pivot[age] = {} end
			pivot[age][tostring(sensor)] = value
		end
	end
	for age, table in pairs(pivot) do
		formulaHistory[age] = calculateFormula(pivot[age])
	end
	return formulaHistory
end

-- Update the history of the main device and of children.
function updateHistory(lul_device)
	-- Each child device.
	for sensor = 0, 9 do
		local childDevice = CHILD_DEVICE[tostring(sensor)]
		if (childDevice ~= nil) then
			luup.variable_set(SERVICE_ID, "TwoHourlyHistory", serializeHistory(TWOHOURLY_HISTORY[tostring(sensor)]), childDevice)
			luup.variable_set(SERVICE_ID, "DailyHistory", serializeHistory(DAILY_HISTORY[tostring(sensor)]), childDevice)
			luup.variable_set(SERVICE_ID, "MonthlyHistory", serializeHistory(MONTHLY_HISTORY[tostring(sensor)]), childDevice)
			luup.variable_set(SERVICE_ID, "HistoryUpdateTimestamp", HISTORY_LAST_UPDATED, childDevice)
		end
	end
	-- Parent device.
	luup.variable_set(SERVICE_ID, "TwoHourlyHistory", serializeHistory(formulaHistory(lul_device, TWOHOURLY_HISTORY)), lul_device)
	luup.variable_set(SERVICE_ID, "DailyHistory", serializeHistory(formulaHistory(lul_device, DAILY_HISTORY)), lul_device)
	luup.variable_set(SERVICE_ID, "MonthlyHistory", serializeHistory(formulaHistory(lul_device, MONTHLY_HISTORY)), lul_device)
	luup.variable_set(SERVICE_ID, "HistoryUpdateTimestamp", HISTORY_LAST_UPDATED, lul_device)
end

-- Process a packet.  The packet might be real-time or history.
function processPacket(lul_device, lul_data)
	-- Extract the body from inside the <msg> tags.
	local matched, msgBody
	matched, _, msgBody = lul_data:find("^<msg>(.+)</msg>$")
	if (matched) then
		-- <msg> element contains the interesting stuff.
		local context = { }
		for element, content in msgBody:gfind("<(.+)>(.-)</%1>") do
			if (DEBUG) then luup.log("Processing element in <msg>: " .. element) end
			-- Call the handler for this element, or just note the string.
			if (XML_MSG_DISPATCH[element]) then
				context = XML_MSG_DISPATCH[element](context, lul_device, content)
			else
				context[element] = content
			end
		end
		-- Postprocess the information we learned from the packet.
		processMsgContext(context, lul_device)

		-- If it's been about 25 seconds since the last history packet,
		-- probably the history burst has finished.  Update the history
		-- variables on the parent and child devices.
		if (HISTORY_LAST_UPDATED and os.date("%s") - HISTORY_LAST_UPDATED > 25) then
			if (DEBUG) then luup.log("Updating history") end
			updateHistory(lul_device);
			-- Go silent until the next history burst, 2ish hours from now.
			HISTORY_LAST_UPDATED = nil
		end
	end
end

-- Called when a line of data comes in from the EnviR.
function incoming(lul_device, lul_data)
	if (DEBUG) then luup.log("CurrentCost incoming:" .. lul_data) end
	processPacket(lul_device, lul_data)
end


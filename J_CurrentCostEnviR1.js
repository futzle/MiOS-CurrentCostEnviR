/* Get the name of the child device for a given appliance. */
function getChildApplianceName(deviceId, a)
{
	var matches = jsonp.ud.devices.findAll(function(d) {
		return d.altid == "Appliance" + a && d.id_parent == deviceId
	} );
	if (matches.length > 0) { return matches[0].name; }
	return undefined;
}

function getFormula(deviceId)
{
	var formula = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "Formula", 0);
	if (formula == undefined) formula = "";
	if (/^[0-9]/.test(formula)) formula = "+" + formula;
	return formula;
}

function setFormula(deviceId, a, operation)
{
	var formula = getFormula(deviceId);
	formula = formula.replace("-" + a, "").replace("+" + a, "");
	if (operation == "add")
	{
		formula += "+" + a;
	}
	else if (operation == "subtract")
	{
		formula += "-" + a;
	}
	set_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "Formula", formula, 0);
}

/* Entry point for "Configuration" tab.
   Provide GUI for editing global and per-appliance settings. */
function setup(deviceId)
{
	var htmlResult = "";
	htmlResult += "<div>";
	htmlResult += "<table border='0' padding='0' width='100%'>";
	htmlResult += "<tr>";

	// Child temperature device (default off)
	htmlResult += "<td>Create a child device with console temperature</td>";
	var childTemperature = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "ChildTemperature", 0);
	if (childTemperature == undefined) childTemperature = 0;
	htmlResult += "<td><input type='checkbox' id='childTemperature' " + (childTemperature == "1" ? "checked='checked' " : "") + "onclick='set_device_state(" + deviceId + ", \"urn:futzle-com:serviceId:CurrentCostEnviR1\", \"ChildTemperature\", $F(\"childTemperature\") ? 1 : 0, 0)'/></td>";

	htmlResult += "</tr><tr>";

	// Autodetect appliances (default on)
	htmlResult += "<td>Automatically create child devices for appliances</td>";
	var applianceDetect = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "ApplianceAutoDetect", 0);
	if (applianceDetect == undefined) applianceDetect = 1;
	htmlResult += "<td><input type='checkbox' id='applianceDetect' " + (applianceDetect == "1" ? "checked='checked' " : "") + "onclick='set_device_state(" + deviceId + ", \"urn:futzle-com:serviceId:CurrentCostEnviR1\", \"ApplianceAutoDetect\", $F(\"applianceDetect\") ? 1 : 0, 0)'/></td>";

	htmlResult += "</tr>";
	htmlResult += "</table>";

	// Child device configuration.
	htmlResult += "<table border='0' padding='0' width='100%'>";
	htmlResult += "<tr>";
	htmlResult += "<th>Appliance</th><th>ID</th><th>Name</th><th>Separate Phases</th><th>Main power</th>";
	htmlResult += "</tr>";

	var formula = getFormula(deviceId);
	var a;
	for (a = 0; a < 10; a++)
	{
		var applianceId = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "Appliance" + a, 0);
		if (applianceId == undefined || applianceId == "" || applianceId == "0") continue;
		htmlResult += "<tr>";
		// Appliance number
		htmlResult += "<td>" + a + (a == 0 ? " (whole house)" : "") + "</td>";
		// Appliance unique identifier
		htmlResult += "<td>" + applianceId.escapeHTML() + "</td>";
		// Appliance name as set by the user
		var applianceName = getChildApplianceName(deviceId, a);
		htmlResult += "<td>" + applianceName + "</td>";
		// Create additional child devices for each phase?
		var applianceThreePhase = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "Appliance" + a + "ThreePhase", 0);
		if (applianceThreePhase == undefined) applianceThreePhase = 0;
		htmlResult += "<td><input type='checkbox' id='appliance" + a + "ThreePhase' " + (applianceThreePhase == "1" ? "checked='checked' " : "") + "onclick='set_device_state(" + deviceId + ", \"urn:futzle-com:serviceId:CurrentCostEnviR1\", \"Appliance" + a + "ThreePhase\", $F(\"appliance" + a + "ThreePhase\") ? 1 : 0, 0)'/></td>";
		// How does the child's energy contribute to the main device's energy (+ or -)?
		htmlResult += "<td>"
		htmlResult += "<select id='formula" + a + "' onchange='setFormula(" + deviceId + "," + a + ",$F(\"formula" + a + "\"))'>";
		htmlResult += "<option value='none' " + (formula.indexOf("+" + a) == -1 && formula.indexOf("-" + a) == -1 ? "selected='selected' " : "") + ">None</option>";
		htmlResult += "<option value='add' " + (formula.indexOf("+" + a) != -1 ? "selected='selected' " : "") + ">Add</option>";
		htmlResult += "<option value='subtract' " + (formula.indexOf("-" + a) != -1 ? "selected='selected' " : "") + ">Subtract</option>";
		htmlResult += "</select>";
		htmlResult += "</td>";
		htmlResult += "</tr>";
	}

	htmlResult += "</table>";

	htmlResult += "</div>";
	set_panel_html(htmlResult);
	return true;
}

/* Create an associative array from a serialized history string
   in key/value pairs of the form 001=123.45;002=6789; */
function deserializeHistory(s)
{
	var t = new Object();
	var matches = s.match(/[^;]+;/g);
	if (matches == undefined) { return t; }
	var i;
	for (i = 0; i < matches.length; i++)
	{
		var keyvaluepair = matches[i].match(/^([\d]+)=(.*);$/);
		t[keyvaluepair[1]] = keyvaluepair[2];
	}
	return t;
}

/* Given an associative array o with key-value pairs
   012 => 1.234
   find the ones with keys in the range increment to limit,
   and populate a flat array with the matching values. */
function getHistoryArray(o, start, increment, limit)
{
	var result = new Array();
	var past;
	for (past = start; past < limit; past+=increment)
	{
		// Prepad with zeroes.
		var formattedPast = "";
		formattedPast += (Math.floor(past % 1000 / 100)).toFixed();
		formattedPast += (Math.floor(past % 100 / 10)).toFixed();
		formattedPast += (past % 10).toFixed();
		if (formattedPast in o)
		{
			result.push(o[formattedPast]);
		}
		else
		{
			result.push(undefined);
		}
	}
	return result;
}

/* Map a real value to a chart value. */
function valueToChartSymbol(x)
{
	if (x == undefined)
	{
		return -1;
	}
	else
	{
		return x;
	}
}

/* Two-hourly history for the last 7 days. */
function showTwohourlyHistory(deviceId, l, width, height)
{
	var twohourlyHistoryString;
	twohourlyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "TwoHourlyHistory", 1);
	if (twohourlyHistoryString == undefined) { return ""; }
	var historyObject = deserializeHistory(twohourlyHistoryString);
	var historyArray = getHistoryArray(historyObject, 4, 2, 2*l);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));
	if (isNaN(max) || max < 0) { max = 0; }
	var min = Math.floor(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.min(a, b); }}));
	if (isNaN(min) || min > 0) { min = 0; }

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	var j;
	var historyUpdateTimestamp = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "HistoryUpdateTimestamp", 1);
	if (historyUpdateTimestamp == undefined) { return ""; }
	var today = new Date((historyUpdateTimestamp - 0) * 1000);
	today.setMilliseconds(0);
	today.setSeconds(0);
	today.setMinutes(0);
	today.setHours(today.getHours() + today.getHours() % 2);
	var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var dateLegendText = "";
	var datePosition = "";
	var hoursIntoToday = today.getHours();
	for (i = hoursIntoToday/2, j = 0; i < l + 6; i += 12, j++)
	{
		var time = new Date(today.getFullYear(), today.getMonth(), today.getDate() - j, 12, 0, 0, 0)

		dateLegendText += "|" + dayNames[time.getDay()] + "+" +time.getDate() + "|%C2%A0";
		datePosition += "," + (i-6) + "," + i;
	}
	uri += "&chxl=1:" + dateLegendText;
	uri += "&chxp=1" + datePosition;
	uri += "&chxr=0," + min + "," + max + "|1," + (l - 1.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767|1,676767,11.5,0,lt,676767";
	uri += "&chxtc=1,0,8";
	uri += "&chxt=y,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=" + width + "x" + height;
	uri += "&cht=bvs";
	var today = new Date((historyUpdateTimestamp - 0) * 1000);
	var barColours = new Array();
	var historyColour = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "TwoHourlyHistoryColour", 0);
	if (historyColour == undefined || historyColour == "") { historyColour = "'4D89F9'"; }
	for (i = 2; i < l*2-2; i += 2)
	{
		var time = new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours() - i, 0, 0, 0)
		barColours.push(eval(historyColour));
	}
	uri += "&chco=" + barColours.reverse().join("|");
	// Y scale.
	uri += "&chds=" + min + "," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Two-hourly+History";
	return uri;
}

/* Daily history for the last l days. */
function showDailyHistory(deviceId, l, width, height)
{
	var dailyHistoryString;
	dailyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "DailyHistory", 1);
	if (dailyHistoryString == undefined) { return ""; }
	var historyObject = deserializeHistory(dailyHistoryString);
	var historyArray = getHistoryArray(historyObject, 1, 1, l+1);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));
	if (isNaN(max) || max < 0) { max = 0; }
	var min = Math.floor(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.min(a, b); }}));
	if (isNaN(min) || min > 0) { min = 0; }

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	var historyUpdateTimestamp = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "HistoryUpdateTimestamp", 1);
	if (historyUpdateTimestamp == undefined) { return ""; }
	var today = new Date((historyUpdateTimestamp - 0) * 1000);
	// CurrentCost daily/monthly history counts days 11pm to 11 pm.
	if (today.getHours() >= 23) { today.setDate(today.getDate()+1); }
	// Around noon to avoid issues with daylight saving.
	today.setHours(12);
	var dayNames = ["S", "M", "T", "W", "T", "F", "S"];
	var dayOfWeekLegendText = "";
	var dateLegendText = "";
	var dayOfWeekPosition = "";
	var datePosition = "";
	var barColours = new Array();
	var historyColour = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "DailyHistoryColour", 0);
	if (historyColour == undefined || historyColour == "") { historyColour = "'4D89F9'"; }
	for (i = 1; i <= l; i++)
	{
		var time = new Date(today.getFullYear(), today.getMonth(),
			today.getDate() - i, 12, 0, 0, 0);
		dayOfWeekLegendText += "|" + dayNames[time.getDay()];
		dayOfWeekPosition += "," + i;
		barColours.push(eval(historyColour));
		if (i % 2 == 0) { continue; }
		dateLegendText += "|" + time.getDate();
		datePosition += "," + i;
	}
	uri += "&chxl=1:" + dayOfWeekLegendText + "|2:" + dateLegendText;
	uri += "&chxp=1" + dayOfWeekPosition + "|2" + datePosition;
	uri += "&chxr=0," + min + "," + max + "|1," + (l + 0.5) + ",0.5|2," + (l + 0.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767";
	uri += "&chxt=y,x,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=" + width + "x" + height;
	uri += "&cht=bvs";
	uri += "&chco=" + barColours.reverse().join("|");
	// Y scale.
	uri += "&chds=" + min + "," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Daily+History";
	return uri;
}

/* Monthly history for the last l months */
function showMonthlyHistory(deviceId, l, width, height)
{
	var monthlyHistoryString;
	monthlyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "MonthlyHistory", 1);
	if (monthlyHistoryString == undefined) { return ""; }
	var historyObject = deserializeHistory(monthlyHistoryString);
	var historyArray = getHistoryArray(historyObject, 1, 1, l+1);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));
	if (isNaN(max) || max < 0) { max = 0; }
	var min = Math.floor(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.min(a, b); }}));
	if (isNaN(min) || min > 0) { min = 0; }

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	var historyUpdateTimestamp = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "HistoryUpdateTimestamp", 1);
	if (historyUpdateTimestamp == undefined) { return ""; }
	var today = new Date((historyUpdateTimestamp - 0) * 1000);
	// CurrentCost daily/monthly history counts days 11pm to 11 pm.
	if (today.getHours() >= 23) { today.setDate(today.getDate()+1); }
	// Mid-month.
	today.setDate(15);
	var monthNames = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
	var monthLegendText = "";
	var monthPosition = "";
	var barColours = new Array();
	var historyColour = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "MonthlyHistoryColour", 0);
	if (historyColour == undefined || historyColour == "") { historyColour = "'4D89F9'"; }
	for (i = 1; i <= l; i++)
	{
		var time = new Date(today.getFullYear(), today.getMonth() - i,
			15, 12, 0, 0, 0);
		monthLegendText += "|" + monthNames[time.getMonth()];
		monthPosition += "," + i;
		barColours.push(eval(historyColour));
	}
	uri += "&chxl=1:" + monthLegendText;
	uri += "&chxp=1" + monthPosition;
	uri += "&chxr=0," + min + "," + max + "|1," + (l + 0.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767";
	uri += "&chxt=y,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=" + width + "x" + height;
	uri += "&cht=bvs";
	uri += "&chco=" + barColours.reverse().join("|");
	// Y scale.
	uri += "&chds=" + min + "," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Monthly+History";
	return uri;
}

function onHistoryDropdownChange(selection, imageId, f, deviceId, width, height)
{
	var myindex  = selection.selectedIndex;
	var SelValue = selection.options[myindex].value;
	var newUrl = f(deviceId, SelValue - 0, width, height);
	document.getElementById(imageId).src=newUrl;
	return false;
}

/* Entry function for history tab. */
function showHistory(deviceId)
{
	var historyUpdateTimestamp = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "HistoryUpdateTimestamp", 1);
	if (historyUpdateTimestamp == undefined)
	{
		set_panel_html("<p>History takes up to three hours to populate.</p>");
		return false;
	}
	var today = new Date((historyUpdateTimestamp - 0) * 1000);

	var width = 540;
	var height = 110;

	var htmlResult = "";
	
	htmlResult += "<p>";
	htmlResult += "History last updated: " + today.toLocaleString();
	htmlResult += "</p>";

	htmlResult += "<table border='0' padding='0'>";

	htmlResult += "<tr style='border-top: 1px black solid; padding: 2px 0;'>";
	htmlResult += "<td width='540px'>";
	htmlResult += "<img id='CurrentCostEnvir1_TwohourlyHistory' src='" + showTwohourlyHistory(deviceId, 84, width, 110) + "' width='100%' />";
	htmlResult += "</td><td>";
	htmlResult += "<form>";
	htmlResult += "<select name='CurrentCostEnvir1_select_TwohourlyHistory' onchange='onHistoryDropdownChange(this.form.CurrentCostEnvir1_select_TwohourlyHistory, \"CurrentCostEnvir1_TwohourlyHistory\", showTwohourlyHistory, " + deviceId + ", " + width + ", " + height + ")'>";
	htmlResult += "<option value='24'>2d</option>";
	htmlResult += "<option value='48'>4d</option>";
	htmlResult += "<option value='84' selected='selected'>7d</option>";
	htmlResult += "</select>";
	htmlResult += "</form>";
	htmlResult += "</td></tr>";	

	htmlResult += "<tr style='border-top: 1px black solid; padding: 2px 0;'>";
	htmlResult += "<td>";
	htmlResult += "<img id='CurrentCostEnvir1_DailyHistory' src='" + showDailyHistory(deviceId, 31, width, height) + "' width='100%' />";
	htmlResult += "</td><td>";
	htmlResult += "<form>";
	htmlResult += "<select name='CurrentCostEnvir1_select_DailyHistory' onchange='onHistoryDropdownChange(this.form.CurrentCostEnvir1_select_DailyHistory, \"CurrentCostEnvir1_DailyHistory\", showDailyHistory, " + deviceId + ", " + width + ", " + height + ")'>";
	htmlResult += "<option value='7'>7d</option>";
	htmlResult += "<option value='14'>14d</option>";
	htmlResult += "<option value='31' selected='selected'>31d</option>";
	htmlResult += "<option value='60'>60d</option>";
	htmlResult += "</select>";
	htmlResult += "</form>";
	htmlResult += "</td></tr>";	

	htmlResult += "<tr style='border-top: 1px black solid; border-top: 1px black solid; padding: 2px 0;'>";
	htmlResult += "<td>";
	htmlResult += "<img id='CurrentCostEnvir1_MonthlyHistory' src='" + showMonthlyHistory(deviceId, 24, width, height) + "' width='100%' />";
	htmlResult += "</td><td>";
	htmlResult += "<form>";
	htmlResult += "<select name='CurrentCostEnvir1_select_MonthlyHistory' onchange='onHistoryDropdownChange(this.form.CurrentCostEnvir1_select_MonthlyHistory, \"CurrentCostEnvir1_MonthlyHistory\", showMonthlyHistory, " + deviceId + ", " + width + ", " + height + ")'>";
	htmlResult += "<option value='12'>12m</option>";
	htmlResult += "<option value='24' selected='selected'>24m</option>";
	htmlResult += "<option value='48'>48m</option>";
	htmlResult += "</select>";
	htmlResult += "</form>";
	htmlResult += "</td></tr>";	

	htmlResult +="</table>";

	set_panel_html(htmlResult);
	return true;
}

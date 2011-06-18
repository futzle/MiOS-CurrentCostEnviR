/* Create an associative array from a serialized history string
   in key/value pairs of the form 001=123.45;002=6789; */
function deserializeHistory(s)
{
	var t = new Object();
	var matches = s.match(/[^;]+;/g);
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
function showTwohourlyHistory(deviceId, l)
{
	var twohourlyHistoryString;
	twohourlyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "TwoHourlyHistory", 1);
	if (twohourlyHistoryString == undefined) { return "No history yet"; }
	var historyObject = deserializeHistory(twohourlyHistoryString);
	var historyArray = getHistoryArray(historyObject, 4, 2, 2*l);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	var j;
	var today = new Date();
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
	uri += "&chxr=0,0," + max + "|1," + (l - 1.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767|1,676767,11.5,0,lt,676767";
	uri += "&chxtc=1,0,8";
	uri += "&chxt=y,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=620x130";
	uri += "&cht=bvs";
	today = new Date();
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
	uri += "&chds=0," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Two-hourly+History";
	return "<img src=\"" + uri + "\" width=\"100%\"/>";
}

/* Daily history for the last l days. */
function showDailyHistory(deviceId, l)
{
	var dailyHistoryString;
	dailyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "DailyHistory", 1);
	if (dailyHistoryString == undefined) { return ""; }
	var historyObject = deserializeHistory(dailyHistoryString);
	var historyArray = getHistoryArray(historyObject, 1, 1, l);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	var today = new Date();
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
	for (i = 1; i < l; i++)
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
	uri += "&chxr=0,0," + max + "|1," + (l - 0.5) + ",0.5|2," + (l - 0.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767";
	uri += "&chxt=y,x,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=620x130";
	uri += "&cht=bvs";
	uri += "&chco=" + barColours.reverse().join("|");
	// Y scale.
	uri += "&chds=0," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Daily+History";
	return "<img src=\"" + uri + "\" width=\"100%\"/>";
}

/* Monthly history for the last l months */
function showMonthlyHistory(deviceId, l)
{
	var monthlyHistoryString;
	monthlyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "MonthlyHistory", 1);
	if (monthlyHistoryString == undefined) { return ""; }
	var historyObject = deserializeHistory(monthlyHistoryString);
	var historyArray = getHistoryArray(historyObject, 1, 1, l);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	var today = new Date();
	// CurrentCost daily/monthly history counts days 11pm to 11 pm.
	if (today.getHours() >= 23) { today.setDate(today.getDate()+1); }
	// Mid-month.
	today.setDate(15);
	var monthNames = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
	var dateLegendText = "";
	var datePosition = "";
	var barColours = new Array();
	var historyColour = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "MonthlyHistoryColour", 0);
	if (historyColour == undefined || historyColour == "") { historyColour = "'4D89F9'"; }
	for (i = 1; i < l; i++)
	{
		var time = new Date(today.getFullYear(), today.getMonth() - i,
			today.getDate(), 12, 0, 0, 0);
		monthLegendText += "|" + monthNames[time.getMonth()];
		monthPosition += "," + i;
		barColours.push(eval(historyColour));
	}
	uri += "&chxl=1:" + monthLegendText;
	uri += "&chxp=1" + monthPosition;
	uri += "&chxr=0,0," + max + "|1," + (l - 0.5) + ",0.5|2," + (l - 0.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767";
	uri += "&chxt=y,x,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=620x130";
	uri += "&cht=bvs";
	uri += "&chco=" + barColours.reverse().join("|");
	// Y scale.
	uri += "&chds=0," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Monthly+History";
	return "<img src=\"" + uri + "\" width=\"100%\"/>";
}

/* Entry function for history tab. */
function showHistory(deviceId)
{
	var htmlResult = "";
	
	htmlResult += "<div>";
	htmlResult += showTwohourlyHistory(deviceId, 84);
	htmlResult +="</div>";	

	htmlResult += "<div>";
	htmlResult += showDailyHistory(deviceId, 31);
	htmlResult +="</div>";	

	htmlResult += "<div>";
	htmlResult += showMonthlyHistory(deviceId, 24);
	htmlResult +="</div>";	

	set_panel_html(htmlResult);
	return true;
}

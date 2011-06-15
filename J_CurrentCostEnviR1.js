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
function getHistoryArray(o, increment, limit)
{
	var result = new Array();
	var past;
	for (past = increment; past < limit; past+=increment)
	{
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
	_console("start showTwohourlyHistory");
	var twohourlyHistoryString;
	twohourlyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "TwoHourlyHistory", 1);
	var historyObject = deserializeHistory(twohourlyHistoryString);
	var historyArray = getHistoryArray(historyObject, 2, 2*l);

	_console("showTwohourlyHistory A");
	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	_console("showTwohourlyHistory C");
	// Axes and legend.
	var dates = new Array();
	var i;
	var j;
	var today = new Date();
	today.setMilliseconds(0);
	today.setSeconds(0);
	today.setMinutes(0);
	today.setHours(today.getHours() + today.getHours() % 2 + 2);
	_console("showTwohourlyHistory E");
	var dayNames = ["S", "M", "T", "W", "T", "F", "S"];
	var dateLegendText = "";
	var datePosition = "";
	_console("showTwohourlyHistory F");
	var hoursIntoToday = today.getHours();
	for (i = hoursIntoToday/2, j = 0; i < l + 6; i += 12, j++)
	{
	_console("showTwohourlyHistory G");
		var time = new Date(today.getFullYear(), today.getMonth(), today.getDate() - j, 12, 0, 0, 0)
	_console("showTwohourlyHistory H");

		dateLegendText += "|" + time.getDate() + "|%C2%A0";
	_console("showTwohourlyHistory I");
		datePosition += "," + (i-6) + "," + i;
	}
	_console("showTwohourlyHistory M");
	uri += "&chxl=1:" + dateLegendText;
	uri += "&chxp=1" + datePosition;
	uri += "&chxr=0,0," + max + "|1," + (l - 0.5) + ",0.5";
	uri += "&chxs=0,676767,10.5,1,l,676767|1,676767,11.5,0,lt,676767";
	uri += "&chxtc=1,0,5";
	uri += "&chxt=y,x";

	uri += "&chbh=a,1,0";
	uri += "&chs=620x130";
	uri += "&cht=bvs";
	uri += "&chco=4D89F9";
	// Y scale.
	uri += "&chds=0," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Two-hourly+History";
	_console("showTwohourlyHistory Z");
	return "<img src=\"" + uri + "\"/>";
}

/* Daily history for the last l days. */
function showDailyHistory(deviceId, l)
{
	_console("start showDailyHistory");
	var dailyHistoryString;
	dailyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "DailyHistory", 1);
	var historyObject = deserializeHistory(dailyHistoryString);
	var historyArray = getHistoryArray(historyObject, 1, l);

	var max = Math.ceil(historyArray.reduce(function (a, b) { if (a == undefined) return b; else { if (b == undefined) return a; else return Math.max(a, b); }}));

	var uri = "http://chart.apis.google.com/chart";
	uri += "?chxr=0,-11.667,160";

	// Axes and legend.
	var dates = new Array();
	var i;
	// Around noon to avoid issues with daylight saving.
	var today = new Date();
	today.setHours(12);
	var dayNames = ["S", "M", "T", "W", "T", "F", "S"];
	var dayOfWeekLegendText = "";
	var dateLegendText = "";
	var dayOfWeekPosition = "";
	var datePosition = "";
	for (i = 1; i < l; i++)
	{
		var dayOfWeek = new Date(today.getFullYear(), today.getMonth(),
			today.getDate() - i, 12, 0, 0, 0);
		dayOfWeekLegendText += "|" + dayNames[dayOfWeek.getDay()];
		dayOfWeekPosition += "," + i;
		if (i % 2 == 0) { continue; }
		dateLegendText += "|" + dayOfWeek.getDate();
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
	uri += "&chco=4D89F9";
	// Y scale.
	uri += "&chds=0," + max;
	// Data.
	uri += "&chd=t:"
		+ historyArray.map(valueToChartSymbol).reverse().join(",");
	uri += "&chg=-1,5,0,4";
	// Chart title.
	uri += "&chtt=Daily+History";
	return "<img src=\"" + uri + "\"/>";
}

/* Monthly history, to do */

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

	set_panel_html(htmlResult);
	return true;
}

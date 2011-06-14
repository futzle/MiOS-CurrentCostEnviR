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

/* Produce a Google Image Chart API image URI. */
function graphHistory(h)
{
	var uri = "http://chart.apis.google.com/chart?chxr=0,-11.667,160&chxs=0,676767,10.5,0,l,676767&chxt=y&chbh=a,0&chs=400x150&cht=bvs&chco=4D89F9&chds=0,25&chd=t:"
		+ h.map(valueToChartSymbol).reverse().join(",");
		+ "&chg=-1,0&chma=|7&chtt=History";
	return uri;
}

/* Two-hourly history for the last 7 days. */
function showTwohourlyHistory(deviceId)
{
	_console("start showTwohourlyHistory");
	var twohourlyHistoryString;
	twohourlyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "TwoHourlyHistory", 1);
	var historyObject = deserializeHistory(twohourlyHistoryString);
	var historyArray = getHistoryArray(historyObject, 2, 24*7+2);
	return "<img src=\"" + graphHistory(historyArray) + "\"/>";
}

/* Daily history for the last 31 days. */
function showDailyHistory(deviceId)
{
	_console("start showDailyHistory");
	var dailyHistoryString;
	dailyHistoryString = get_device_state(deviceId, "urn:futzle-com:serviceId:CurrentCostEnviR1", "DailyHistory", 1);
	var historyObject = deserializeHistory(dailyHistoryString);
	var historyArray = getHistoryArray(historyObject, 1, 31);
	return "<img src=\"" + graphHistory(historyArray) + "\"/>";
	return historyArray;
}

/* Monthly history, to do */

/* Entry function for history tab. */
function showHistory(deviceId)
{
	var htmlResult = "";
	
	htmlResult += "<div>";
	htmlResult += showTwohourlyHistory(deviceId);
	htmlResult +="</div>";	

	htmlResult += "<div>";
	htmlResult += showDailyHistory(deviceId);
	htmlResult +="</div>";	

	set_panel_html(htmlResult);
	return true;
}

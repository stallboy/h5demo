window.onload = function() {
	document.getElementById('eval1').onclick = function() {
		var bvps = + document.getElementById('bvps1').value;
		var roe = + document.getElementById('roe1').value;
		var year = + document.getElementById('year1').value;
		var dr = + document.getElementById('dr1').value;
        function setRes(str){
            document.getElementById('res1').innerHTML = str;
        }
		if (isNaN(bvps) || isNaN(roe) || isNaN(year) || isNaN(dr) ) {
            setRes('参数应都为数字');
		}

        var r = Math.pow( (1+roe/100) / (1+dr/100), year) * bvps;
        r = Math.round(r*100) / 100;
        setRes(r); 
	};

	document.getElementById('eval2').onclick = function() {
		var fcfps = + document.getElementById('fcfps').value;
		var rofcf = + document.getElementById('rofcf').value;
		var year = + document.getElementById('year2').value;
		var rofcfafter = + document.getElementById('rofcfafter').value;
		var dr = + document.getElementById('dr2').value;
        function setRes(str){
            document.getElementById('res2').innerHTML = str;
        }
		if (isNaN(fcfps) || isNaN(rofcf) || isNaN(year) || isNaN(dr) || isNaN(rofcfafter)) {
            setRes('参数应都为数字');
		}
       
        var nYearValueSum = 0;
        for(var i=0; i<year; i++){
            nYearValueSum += fcfps * Math.pow(1+rofcf/100, i) / Math.pow(1+dr/100, i+1);
        }
        //console.log(nYearValueSum);

        var nYearFCF = fcfps * Math.pow(1+rofcf/100, year-1);
        //console.log(nYearFCF);
        var afterNYearValueSum = nYearFCF * (1+rofcfafter/100) / (dr/100 - rofcfafter/100) /  Math.pow(1+dr/100, year);

        var r = nYearValueSum + afterNYearValueSum;
        r = Math.round(r*100) / 100;
        setRes(r); 
	};






};


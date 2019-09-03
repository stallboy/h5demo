var shell = function() {
	var history = [''];
	var historyCursor = 0;
	var DONE_STATE = 4;

	var getXmlHttpRequest = function() {
		if (window.XMLHttpRequest) {
			return new XMLHttpRequest();
		} else if (window.ActiveXObject) {
			try {
				return new ActiveXObject('Msxml2.XMLHTTP');
			} catch(e) {
				return new ActiveXObject('Microsoft.XMLHTTP');
			}
		}
		return null;
	};

    var addOutput = function(str){
		var output = document.getElementById('output');
        if ("\n" !== output.value[output.value.length - 1]) {
            output.value += "\n";
        }
        output.value += str;

        output.scrollTop = output.scrollHeight;
        if (output.createTextRange) {
            var range = output.createTextRange();
            range.collapse(false);
            range.select();
        }
    };

	var done = function(req) {
		if (req.readyState == DONE_STATE) {
			var output = document.getElementById('output');
			var statement = document.getElementById('statement');
			var result = req.responseText.replace(/^\s*|\s*$/g, ''); // trim whitespace
			if (result !== '') {
                addOutput(result);
				//自动补全
				if (result != '...' && statement.value && result.search(/\s/g) === - 1 && result.length < 40 && result.search(statement.value) === 0) {
					statement.value = result;
				}
			}
		}
	};

    //发服务器的3种协议
    //run statement
    //autocomplete statement
    //combine
	var runStatement = function(cmd, statement) {
		var session = document.getElementById("session").value;
		var statele = document.getElementById("statement");
		var output = document.getElementById('output');

        //打开多行编辑器
		if (statement === '!big') {
			var bigstatement = document.getElementById('bigstatement');
			bigstatement.innerHTML = "<textarea id='bigstat' style='height:400px'></textarea>";
			var bigstat = document.getElementById('bigstat');
			bigstat.addEventListener('keydown', function(event) {
				if (event.keyCode === 9) {
					bigstat.value += '    ';
					event.preventDefault();
					return false;
				}else if (event.keyCode === 27){ //esc
                    var big = document.getElementById("bigstatement");
                    big.innerHTML = "";
                    big.style.display = 'none';
                    statele.focus();
                    window.onresize();
                }else if(event.altKey && event.keyCode === 13) {
                    runStatement("run", document.getElementById("bigstat").value );
                }
			},
			false);
			window.onresize();
			bigstat.focus();
			statele.value = '';
			addOutput('<alt+enter> 执行, <esc> 取消\n');
			return;
		}
		if (statement === '!clr') {
			output.innerText = "";
			statele.value = '';
			return;
		}
		if (statement === '!exit') {
			window.opener = null;
			window.open('', '_self');
			window.close();
			return;
		}
		if (statement === '!combine') {
			cmd = 'combine';
            statement = '';
		}

		var req = getXmlHttpRequest();
		if (!req) {
			var st = document.getElementById('ajax-status');
			st.innerHTML = "<span class='error'>Your browser doesn't support AJAX. :(</span>";
			st.style.zindex = 2;
			st.style.bottom = 100;
			st.style.position = 'absolute';
			return false;
		}
		req.onreadystatechange = function() {
			done(req);
		};
        addOutput( '>>> ' + statement + '\n' );
        if (cmd !== 'autocomplete'){
		    statele.value = '';
        }
		history.push( statement );
		historyCursor = history.length;

		req.open("POST", "/shell.do", true);
		req.setRequestHeader('Content-type', 'application/json');

		var query = {session: session, cmd: cmd, statement: statement};
		req.send( JSON.stringify(query) );
		return false;
	};

	var onPromptKeyPress = function(event) {
		var statement = document.getElementById('statement');
		//alert(event.keyCode + " - ");
		if (event.keyCode === 38) { // up arrow 
			if (historyCursor > 0) {
				statement.value = history[--historyCursor];
			}
			return false;
		} else if (event.keyCode === 40) { // down arrow 
			if (historyCursor < history.length - 1) {
				statement.value = history[++historyCursor];
			}
			return false;
		} else if (event.keyCode === 27) { // esc
		    var bigstatement = document.getElementById('bigstatement');
            if (!bigstatement.innerHTML){
                runStatement("run", "!big");
            }
		} else if (event.keyCode === 13) { // enter 
			return runStatement("run", statement.value);
		} else if (event.keyCode === 9) { // tab 
			var stat = statement.value.replace(/\s*$/g, '');
			if (stat) {
				runStatement("autocomplete", stat);
			} else {
				statement.value += '    ';
			}
			event.preventDefault();
			return false;
		}

	};

	return {
        addOutput: addOutput,
		keyDown: onPromptKeyPress
	};
} ();

window.onload = function() {
	window.onresize = function() {
		var output = document.getElementById("output");
		var cmdheight = document.getElementById("cmd").clientHeight;
		var statement = document.getElementById("statement");
		statement.style.width = document.width - 120;
		var bigstatement = document.getElementById('bigstatement');
		if (bigstatement.innerHTML) {
			bigstatement.style.width = '100%';
			var h = 400;
			bigstatement.style.height = h;
			bigstatement.style.position = 'absolute';
			bigstatement.style.bottom = cmdheight + 6;
            bigstatement.style.display = 'block';
			output.style.height = document.height - cmdheight - 6 - h;
		} else {
			output.style.height = document.height - cmdheight - 6;
		}
        shell.addOutput('');
	};
	window.onresize();
};


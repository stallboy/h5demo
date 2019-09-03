var minesweeper = function(){
    //资源
    var canvas;
    var context;
    var faceImage;
    var tileImage;
    var clockImage;
    var tickAudio;
    var winAudio;
    var bombAudio;

    //资源描述
    var FACE = {SMILEDOWN:0, WIN:1, DIE:2, OOH:3, SMILE:4};
    var TILE = {BLANK:0, FLAG:1, QUES:2, BOMBDIE:3,
        MISFLAG:4, BOMBREVEAL:5, WHY:6, 8:7, 7:8,  
        6:9, 5:10, 4:11, 3:12, 2:13, 1:14, 0:15
    };
    var NUM = {NEG: 0, BLANK:1, 9:2, 8:3, 7:4, 6:5,
        5:6, 4:7, 3:8, 2:9, 1:10, 0:11, CNT:12
    };

    //ENUM
    var CELL={CLOSED:0, OPENED:1, FLAGED:2, QUESED:3};
    var STAT = {LOADING: 0, WAIT: 1, LEVELING: 2, TICKING:3, DIE: 4, WIN:5};

    //状态
    var itimer;
    var difficulty;
    var curState = STAT.LOADING; 
    var cellMap = [];   //[ {code:, stat:} ] .bombRemain .tick

    //画板内部状态
    var cellBoard = {}; //x, y, w, h
    var faceBoard = {};
    var tickBoard = {};
    var bombBoard = {};
    var faceDowning = false;
    var cellDowning = {x:-1, y:-1, button:-1};

    //chrome没实现dom3 mouseevent.buttons，这里模拟。
    var buttonPressed = {0:0, 1:0, 2:0};

    function debug(v){
        document.getElementById("debuginfo").innerText+=v+"\n";
    }

    function drawNum(num, cx, cy){
        var nh = clockImage.height / NUM.CNT;
        var nw = clockImage.width;
        var remain = num;
        var nc = 3;
        var pp, n;
        if (remain < 0){
            context.drawImage(clockImage, 0, NUM.NEG*nh, nw, nh, cx, cy, nw, nh );
            cx += nw;
            nc -= 1;
            remain = -remain;
        }
        for(var i=0; i<nc; i++){
            pp = Math.pow(10, nc-1-i);
            n = Math.floor( remain / pp );
            context.drawImage(clockImage, 0, NUM[n]*nh, nw, nh, cx, cy, nw, nh);
            cx += nw;
            remain -= n*pp;
        }
    }

    function initCanvas(){
        var tw = tileImage.width;
        var border = 10;
        var margin = 4;
        var nh = clockImage.height / NUM.CNT;
        var nw = clockImage.width;
        var fw = faceImage.width;

        faceDowning = false;
        cellDowning = {x:-1, y:-1, button:-1};

        cellBoard.tw = tw;
        cellBoard.x = border;
        cellBoard.y = faceImage.width + border*2 + margin*2;
        cellBoard.w = tw*cellMap.maxx;
        cellBoard.h = tw*cellMap.maxy;

        canvas.width  = cellBoard.x + cellBoard.w + border;
        canvas.height = cellBoard.y + cellBoard.h + border;

        bombBoard.x = border+margin;
        bombBoard.y = border+margin;
        bombBoard.w = nw*3;
        bombBoard.h = nh;

        tickBoard.x = canvas.width-border-margin-clockImage.width*3;
        tickBoard.y = border+margin;
        tickBoard.w = nw*3;
        tickBoard.h = nh;

        faceBoard.x = canvas.width/2-fw/2;
        faceBoard.y = border+margin;
        faceBoard.w = fw;
        faceBoard.h = fw;

    }

    function drawTick(){
        context.clearRect(tickBoard.x, tickBoard.y, tickBoard.w, tickBoard.h);
        drawNum(cellMap.tick, tickBoard.x, tickBoard.y); 
    }

    function drawFace(){
        context.clearRect(faceBoard.x, faceBoard.y, faceBoard.w, faceBoard.h);
        var fw = faceImage.width;
        var f = FACE.SMILE;
        if (curState === STAT.WIN){
            f = FACE.WIN;
        }else if (curState === STAT.DIE){
            f = FACE.DIE;
        }else if (faceDowning){
            f = FACE.SMILEDOWN;
        }else if (cellDowning.button !== -1){
            f = FACE.OOH;
        }
        context.drawImage(faceImage, 0, f*fw, fw, fw, 
                faceBoard.x, faceBoard.y, faceBoard.w, faceBoard.h);
        
    }

    function drawCellBoard(){
        var tw = tileImage.width;
        var x,y,ti,c;
        for(y=0; y<cellMap.maxy; y++){
            for(x=0; x<cellMap.maxx; x++){
                c = cellMap[y+1][x+1];
                if (c.stat === CELL.CLOSED){
                    ti = TILE.BLANK; 
                    if (curState === STAT.DIE && c.code === -1){
                        ti = TILE.BOMBREVEAL;
                    }else if (cellDowning.button === 0 &&
                            cellDowning.x === x+1 && cellDowning.y === y+1){
                        ti = TILE[0];
                    }else if (cellDowning.button === 1 && 
                            cellDowning.x-1 <= x+1 && x+1 <= cellDowning.x+1 &&
                            cellDowning.y-1 <= y+1 && y+1 <= cellDowning.y+1 ){
                        ti = TILE[0];
                    }
                }else if (c.stat === CELL.OPENED){
                    if (c.code === -1){
                        ti = TILE.BOMBDIE;
                    }else{
                        ti = TILE[c.code];
                    }
                }else if (c.stat === CELL.FLAGED){
                    if (curState === STAT.DIE && c.code !== -1){
                        ti = TILE.MISFLAG;
                    }else{
                        ti = TILE.FLAG;
                    }
                }else{
                    if (curState === STAT.DIE && c.code === -1){
                        ti = TILE.BOMBREVEAL;
                    }else{
                        ti = TILE.QUES;
                    }
                }
                context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                        cellBoard.x+x*tw, cellBoard.y+y*tw, tw, tw);
            }
        }
    }

    function drawCanvas() {
        context.fillStyle = "#000";
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawNum(cellMap.bombRemain, bombBoard.x, bombBoard.y);
        drawFace();
        drawTick();
        drawCellBoard();
    }

    function startCustom( gameh, gamew, bombs ){
        var x, y, placed, i;
        var s;

        cellMap = [];   //四周都加上，并标记上一打开，避免边界判断
        cellMap.tick = 0;
        cellMap.bombRemain = bombs; 
        cellMap.maxx = gamew;
        cellMap.maxy = gameh;
        for (y=0; y<gameh+2; y++){
            cellMap[y] = [];
            for(x=0; x<gamew+2; x++){
                s = ( (y===0) || (x===0) || (y===gameh+1) || (x===gamew+1) ) ? 
                    CELL.OPENED : CELL.CLOSED;
                cellMap[y][x] = {code: 0, stat: s};
            }
        }
        
        var cadd = function(c){
            if ( -1 !== c.code ){
                c.code += 1;
            }
        };
        for (i=0; i<bombs; i++){
            placed = false;
            while(!placed){
                x = 1 + Math.floor( gamew*Math.random() );
                y = 1 + Math.floor( gameh*Math.random() );
                if ( -1 !== cellMap[y][x].code ){
                    cellMap[y][x].code = -1 ;
                    cadd( cellMap[y-1][x-1] );
                    cadd( cellMap[y-1][x] );
                    cadd( cellMap[y-1][x+1] );
                    cadd( cellMap[y  ][x-1] );
                    cadd( cellMap[y  ][x+1] );
                    cadd( cellMap[y+1][x-1] );
                    cadd( cellMap[y+1][x  ] );
                    cadd( cellMap[y+1][x+1] );
                    placed = true;
                }
            }
        }
    }

    function startGame(){
        curState = STAT.LEVELING; 
        if (itimer){
            clearInterval(itimer);
        }
        if (difficulty === 'middle'){
            startCustom(16, 16, 40);
        }else if (difficulty === 'hard'){
            startCustom(16, 30, 99);
        }else{
            startCustom(9, 9, 10);
        }
        initCanvas();
        drawCanvas();
    }

    function refreshRecord(){
        var solutions =  "<table>";
        solutions += "<tr><td>easy</td><td>"+localStorage['minesweeper.easy']+"</td><tr>";
        solutions += "<tr><td>middle</td><td>"+localStorage['minesweeper.middle']+"</td><tr>";
        solutions += "<tr><td>hard</td><td>"+localStorage['minesweeper.hard']+"</td><tr>";
        solutions += "</table>";
        document.getElementById("record").innerHTML = solutions;
    }
    
    function toggleRecord(){
        var sol = document.getElementById("record");
        if (sol.innerHTML.length){
            sol.innerHTML = "";
        }else{
            refreshRecord();
        }
    }

    function getCursorPosition(e) {
        var x;
        var y;
        if (e.pageX || e.pageY) {
	        x = e.pageX;
	        y = e.pageY;
        }else {
            x = e.clientX + document.body.scrollLeft + 
                document.documentElement.scrollLeft;
            y = e.clientY + document.body.scrollTop + 
                document.documentElement.scrollTop;
        }
        x -= canvas.offsetLeft;
        y -= canvas.offsetTop;
        return {x:x, y:y};
    }

    function tickTimer(){
        if (cellMap.tick < 999){
            cellMap.tick += 1;
            tickAudio.play();
            drawTick();
        }
    }
    function autoExpand(x, y){
        var openlist = [[x,y]];
        var cc;
        var cell;
        while(openlist.length > 0){
            cc = openlist.shift();
            x = cc[0];
            y = cc[1];
            cell = cellMap[y][x];
            cell.stat = CELL.OPENED;
            for(var dy=-1; dy<2; dy++){
                for(var dx=-1; dx<2; dx++){
                    cell = cellMap[y+dy][x+dx];
                    if ( cell.stat !== CELL.OPENED ){
                        cell.stat = CELL.OPENED;
                        if (cell.code === 0){
                            openlist.push( [x+dx, y+dy] );
                        }
                    }
                }
            }
        }
    }

    function testPass(){
        var cs, cc;
        for(var y=1; y<cellMap.maxy+1; y++){
            for(var x=1; x<cellMap.maxx+1; x++){
                cc = cellMap[y][x].code;
                cs = cellMap[y][x].stat;
                if (cs === CELL.CLOSED || cs === CELL.QUESED ||
                        (cs === CELL.OPENED && cc === -1) ||
                        (cs === CELL.FLAGED && cc > -1)){
                    return false;
                }
            }
        }
        return true;
    }

    function onFace( ){
        startGame( );
    }


    function onCell(x, y, button, act){
        //debug("oncell x,y="+x+","+y);
        
        var tryPass= false;
        var redraw = false;
        var c = cellMap[y][x];
        if (button === 0 && c.stat === CELL.CLOSED && act === "mouseup"){
            c.stat = CELL.OPENED;
            if (curState === STAT.LEVELING){
                curState = STAT.TICKING;
                cellMap.tick = 1;
                tickAudio.play();
                itimer = setInterval(tickTimer, 1000);
            }
            if ( c.code > -1){
                if (c.code === 0){
                    autoExpand(x, y);
                }
                tryPass = true;
                redraw = true;
            }else{
                curState = STAT.DIE;
                redraw = true;
            }
        }else if (button === 2 && act === "mousedown"){
            if (c.stat === CELL.CLOSED){
                tryPass = true; 
                redraw = true; 
                c.stat = CELL.FLAGED;
                cellMap.bombRemain -= 1;
            }else if (c.stat === CELL.FLAGED ){
                c.stat = CELL.QUESED;
                cellMap.bombRemain += 1;
                redraw = true; 
            }else if (c.stat === CELL.QUESED){
                c.stat = CELL.CLOSED;
                redraw = true; 
            }
        }else if (button === 1 && c.stat === CELL.OPENED && 
                c.code && act === "mouseup"){
            var fsum = 0, fc;
            var dx, dy;
            for(dy=-1; dy<2; dy++){
                for(dx=-1; dx<2; dx++){
                    if ( cellMap[y+dy][x+dx].stat === CELL.FLAGED ){
                        fsum += 1;
                    }
                }
            }
            if ( fsum === c.code ){
                for(dy=-1; dy<2; dy++){
                    for(dx=-1; dx<2; dx++){
                        fc = cellMap[y+dy][x+dx];
                        if ( fc.stat === CELL.CLOSED ){
                            fc.stat = CELL.OPENED;
                            if (fc.code === -1){
                                curState = STAT.DIE;
                            }else if (fc.code === 0){
                                autoExpand(x+dx, y+dy);
                            }
                        }
                    }
                }
                tryPass = true;
                redraw = true;
            }
        }
        if ( curState === STAT.TICKING && tryPass && testPass()){
            curState = STAT.WIN;
        }

        if (curState === STAT.WIN){
            clearInterval(itimer);
            winAudio.play();
            var k = 'minesweeper.'+difficulty;
            if ( (!localStorage[k]) || localStorage[k] > cellMap.tick ){
                localStorage[k] = cellMap.tick;
                alert("恭喜你，你刷新了自己的记录");
                refreshRecord();
            }
        }else if (curState === STAT.DIE){
            clearInterval(itimer);
            bombAudio.play();
        }

        if (redraw){
            drawCanvas();
        }
    }

    function inBoard(e, b){
        return (b.x < e.x) && (e.x < b.x+b.w) && (b.y < e.y) && (e.y < b.y+b.h);
    }
    function calcCell(e){
        var x = Math.floor( (e.x-4 - cellBoard.x) / cellBoard.tw ); 
        var y = Math.floor( (e.y-4 - cellBoard.y) / cellBoard.tw ); 
        return {x:x+1, y:y+1};
    }


    function onMouseDown( event ) {
        if (!event) {event = window.event;}
        if (curState === STAT.WAIT){
            curState = STAT.LEVELING;
            startGame();
            return false;
        }
        var e = getCursorPosition(event);
        if ( inBoard(e, faceBoard) && event.button === 0 ){
            faceDowning = true;
            drawFace();
        }else if (inBoard(e, cellBoard) && (curState === STAT.LEVELING || 
                    curState === STAT.TICKING)){
            var c = calcCell(e);
            cellDowning.x = c.x;
            cellDowning.y = c.y;
            cellDowning.button = event.button;
            drawCellBoard();
            onCell(c.x, c.y, event.button, "mousedown");
        }
        return false;
    }

    function onMouseMove(event) {
        if (!event) {event = window.event;}
        if (curState === STAT.WAIT || (!buttonPressed[0] && !buttonPressed[1])){
            return false;
        }
        var e = getCursorPosition(event);
        if (  buttonPressed[0] ){
            var isin = inBoard(e, faceBoard) ;
            if (isin && !faceDowning){
                faceDowning = true;
                drawFace();
            }else if (!isin && faceDowning){
                faceDowning = false;
                drawFace();
            }
        }
        if ( curState === STAT.LEVELING || curState === STAT.TICKING ){
            if (inBoard(e, cellBoard)){
                var c = calcCell(e);
                cellDowning.x = c.x;
                cellDowning.y = c.y;
                if (buttonPressed[0]){
                    cellDowning.button = 0;
                }else if (buttonPressed[1]){
                    cellDowning.button = 1;
                }
                drawCellBoard();
            }else if( cellDowning.button !== -1 ){
                cellDowning.button = -1;
                drawCellBoard();
            }
        }
        return false;
    }
    function onMouseUp(event) {
        if (!event) {event = window.event;}
        if (curState === STAT.WAIT){
            return false;
        }
        var e = getCursorPosition(event);
        if ( faceDowning && inBoard(e, faceBoard) && event.button === 0 ){
            faceDowning = false;
            onFace();
        }else if (inBoard(e, cellBoard) && (curState === STAT.LEVELING || 
                    curState === STAT.TICKING)){
            var c = calcCell(e);
            cellDowning.button = -1;
            drawCellBoard();
            onCell(c.x, c.y, event.button, "mouseup");
        }
        return false;
    }

    function showLoading( percent ) {
        var drawPercent = function(percent, txt){
            var w = canvas.width;
            var h = canvas.height;
            context.clearRect(0, 0, w, h);
            context.textAlign = "center";
            context.font = "20px sans-serif bold";
            context.fillStyle = "silver";
            context.fillText(txt, w/2, h/2-20);
            context.fillRect(20, h-60, (w-40)*percent/100, 10);
        };
        if (percent < 100){
            drawPercent(percent, "扫雷");
        }else{
            canvas.onmousedown = onMouseDown;
            canvas.onmousemove = onMouseMove;
            canvas.onmouseup = onMouseUp;
            document.oncontextmenu = function(){return false;};
            document.onmousedown = function(e){
                if (!e) {e = window.event;}
                buttonPressed[e.button] = 1;
                //debug("down:"+e.button);
            };
            document.onmouseup = function(e){
                if (!e) {e = window.event;}
                buttonPressed[e.button] = 0;
                //debug("up:"+e.button);
            };

            curState = STAT.WAIT;
            drawPercent(100, "扫雷 鼠标点击继续");
        }
    }

    function loadAllResource(){
        var percent = 0;
        var loadImage = function ( _src, _per ){
            var img = new Image();
            img.onload = function(){
                percent += _per;
                showLoading(percent);
            };
            img.src = _src;
            return img;
        };
        canvas = document.getElementById("world");
        canvas.width = 300;
        canvas.height = 200;
        context = canvas.getContext("2d");
        showLoading(10);

        tileImage = loadImage("tile.png", 40);
        faceImage = loadImage("face.png", 30);
        clockImage  = loadImage("num.png", 30);

        tickAudio = document.getElementById("tickaudio");
        winAudio = document.getElementById("winaudio");
        bombAudio = document.getElementById("bombaudio");
    }

    function onDifficultyChange(){
        difficulty = this.options[this.options.selectedIndex].value;
        startGame();
    }

    function runGame(){
        loadAllResource();
        document.getElementById("togglerecord").onclick=toggleRecord;
        document.getElementById("screenshot").onclick=function(){
            window.open(canvas.toDataURL());
        };
        var d = document.getElementById("difficulty");
        difficulty = d.options[d.options.selectedIndex].value;
        d.onchange=onDifficultyChange;
        document.getElementById("help").onclick=function(){
            var c = document.getElementById("controls");
            if (c.style.display === 'none'){
                c.style.display = 'block';
            }else{
                c.style.display = 'none';
            }
        };
    }
    return {run: runGame};
}();

window.onload = function(){
    minesweeper.run();
};

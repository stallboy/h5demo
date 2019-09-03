var xq = function(){
    //资源
    var canvas;
    var context;
    var tileImage;
    var boardImage;
    var itimer;

    //ENUM & settings
    var STAT = {LOADING: 0, WAIT: 1, LEVELING: 2, AIING: 3, AIRETURNED:4, WIN: 6, DIE: 7};
    var CELL2TILEINDEX = {17:0, 18:1, 21:2, 16:3, 19:4, 22:5, 20:6,
        9:7, 10:8, 13:9, 8:10, 11:11, 14:12, 12:13
    };
    var SELTILEINDEX = 14;
    var MOVEDURATION = 3;
    var MILLISEC_PER_TICK = 50;

    //状态
    var thinker;
    var chessboard;
    var difficulty;
    var curXQPos = 0;
    var curMode;
    var curXQAIName;
    var curState = STAT.LOADING; 
    var curSelect = 0;

    var curMove = 0;
    var curMoveTick = 0;
    var nextAIMove = 0;
    
    var allMoves = []; //[[mv, eat], ...]


    function debug(v){
        document.getElementById("debuginfo").innerText+=v+"\n";
    }
    function xyToIndex(x, y){
        return (3+y)*16+(x+3);
    }
    function indexToxy(idx){
        var x = idx % 16 - 3;
        var y = Math.floor(idx / 16) - 3;
        return {x:x, y:y};
    }

    function initCanvas(){
        canvas.width  = boardImage.width;
        canvas.height = boardImage.height;
        var tw = tileImage.width;
        chessboard = {tw: tw, x:8, y:8, w:9*tw, h: 10*tw};
    }

    function drawCellBoard(){
        var x,y,ti,c, s, d, from, to, idx, per;
        var tw = tileImage.width;
        context.drawImage(boardImage, 0, 0, canvas.width, canvas.height );
        from = curMove >> 8; 
        for(y=0; y<10; y++){
            for(x=0; x<9; x++){
                idx = xyToIndex(x, y);
                c = curXQPos.cell( idx );
                if (c && !((curState === STAT.AIING || curState === STAT.AIRETURNED) && curMove && from === idx) ){
                    ti = CELL2TILEINDEX[c];
                    context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                        chessboard.x+x*tw, chessboard.y+y*tw, tw, tw);
                }
            }
        }
        if (curSelect){
            s = indexToxy(curSelect); 
            context.globalAlpha = 0.6;
            context.drawImage(tileImage, 0, SELTILEINDEX*tw, tw, tw, 
                        chessboard.x+s.x*tw, chessboard.y+s.y*tw, tw, tw);
            context.globalAlpha = 1.0;
        }else if(curMove){
            to = curMove % 256;
            s = indexToxy(from);
            d = indexToxy(to);
            per = curMoveTick / MOVEDURATION;
            x = s.x + (d.x-s.x)*per;
            y = s.y + (d.y-s.y)*per;
            ti = CELL2TILEINDEX[ curXQPos.cell(from) ];
            context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                        chessboard.x+x*tw, chessboard.y+y*tw, tw, tw);

            context.globalAlpha = 0.6;
            context.drawImage(tileImage, 0, SELTILEINDEX*tw, tw, tw, 
                        chessboard.x+s.x*tw, chessboard.y+s.y*tw, tw, tw);
            context.drawImage(tileImage, 0, SELTILEINDEX*tw, tw, tw, 
                        chessboard.x+x*tw, chessboard.y+y*tw, tw, tw);
            context.globalAlpha = 1.0;
        }
    }

    function drawCanvas() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawCellBoard();
    }

    function startGame(){
        if (curXQPos === 0)
            return;
        curState = STAT.LEVELING; 
        if (itimer){
            clearInterval(itimer);
        }
        setInterval(tickTimer, MILLISEC_PER_TICK);

        curXQPos.init();
        curSelect = 0;
        curMove = 0;
        curMoveTick = 0;
        allMoves = [];

        initCanvas();
        drawCanvas();
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

    function beginMove(mv){
        curSelect = 0;
        curMove = mv;
        curMoveTick = 0;
    }

    function clickOnCell(sx, sy){
        var idx = xyToIndex(sx, sy);
        var c = curXQPos.cell( idx );
        if ( c > 0 && curXQPos.isCellMySide( idx ) ){
            curSelect = idx;
            drawCanvas();
        }else if( curSelect > 0 && idx != curSelect ){
            var mv = ( curSelect << 8 ) + idx;
            if ( curXQPos.canMove( mv ) ){
                curState = STAT.AIING;
                if (curMode === "PvAI"){
                    var res = curXQPos.doMove(mv);
                    if (!res.win){
                        thinker.postMessage({ai: curXQAIName, 
                            pos: curXQPos.marshal()});
                    }
                    curXQPos.undoMove(mv, res.eat);
                }
                beginMove(mv);
                drawCanvas();
            }
        }
    }

    function inBoard(e, b){
        return (b.x < e.x) && (e.x < b.x+b.w) && (b.y < e.y) && (e.y < b.y+b.h);
    }
    function calcCell(e){
        var x = Math.floor( (e.x - chessboard.x) / chessboard.tw ); 
        var y = Math.floor( (e.y - chessboard.y) / chessboard.tw ); 
        return {x:x, y:y};
    }

    function showText(msg){
        var w = canvas.width;
        var h = canvas.height;
        context.clearRect(0, 0, w, h);
        context.textAlign = "center";
        context.font = "20px sans-serif bold";
        context.fillStyle = "silver";
        context.fillText(msg, w/2, h/2-20);
    }
    function showLoading( percent ) {
        var drawPercent = function(percent, txt){
            showText(txt);
            var w = canvas.width;
            var h = canvas.height;
            context.fillRect(20, h-60, (w-40)*percent/100, 10);
        };
        if (percent < 100){
            drawPercent(percent, "中国象棋 加载中...");
        }else{
            canvas.onmousedown = onMouseDown;
            curState = STAT.WAIT;
            drawPercent(100, "中国象棋 鼠标点击继续");
        }
    }
    function loadAllResource(){
        var percent = 30;
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
        showLoading(percent);

        tileImage = loadImage("xq.png", 40);
        boardImage = loadImage("board.png", 40);
    }

    function onMouseDown( event ) {
        if (curState === STAT.WAIT){
            curXQPos = xqPos();
            startGame();
            return;
        }
        if (event.button === 0 && curState === STAT.LEVELING){
            var e = getCursorPosition( event );
            if ( inBoard(e, chessboard) ){
                var c = calcCell(e);
                clickOnCell(c.x, c.y);
            }
        }
        return;
    }
    function onModeChange(){
        curMode = this.options[this.options.selectedIndex].value;
        if (curMode === "PvAI"){
            document.getElementById("diff").style.display="";
        }else{
            //hidden 在chrome中仍不支持
            document.getElementById("diff").style.display="none";
        }
        startGame();
    }
    function onDifficultyChange(){
        curXQAIName = this.options[this.options.selectedIndex].value;
        startGame();
    }
    function onThinkerMessage(e){
        if (e.data.type === "query"){
            var d = document.getElementById("difficulty");
            var k;
            for(var i=0; i<e.data.ais.length; i++) {
                k = e.data.ais[i];
                d.add(new Option(k, k), null);
            }
            d.onchange=onDifficultyChange;
            var op = d.options[d.options.length-1];
            op.selected = true;
            curXQAIName = op.value;
        }else{
            var m = e.data.mv[0];
            var info = e.data.mv[1];
            var stat = e.data.mv[2];
            if (m === 0){
                curState = STAT.WIN;
                showText( "AI 认输" );
            }else{
                curState = STAT.AIRETURNED;
                nextAIMove = m;
            }
            debug(info);
        }
    }
    function onUndo(){
        var idx, a;
        if (curState === STAT.LEVELING || curState === STAT.WIN ){
            curState = STAT.LEVELING;
            a = allMoves.pop();
            curXQPos.undoMove( a[0], a[1] );

            if (curMode === "PvAI" ){
                a = allMoves.pop();
                curXQPos.undoMove( a[0], a[1] );
                //todo:人胜利时出错。得加个判断
            }

            curSelect = 0;
            curMove = 0;
            if (allMoves.length){
                a = allMoves[allMoves.length-1];
                curMove = a[0];
            }

            drawCanvas();
        }
    }

    function runGame(){
        thinker = new Worker("xqai.js");
        thinker.onmessage = onThinkerMessage;
        thinker.postMessage("query");

        document.getElementById("restart").onclick=startGame;
        document.getElementById("undo").onclick=onUndo;

        var m = document.getElementById("mode");
        m.onchange=onModeChange;

        curMode = m.options[m.options.selectedIndex].value;

        document.getElementById("screenshot").onclick=function(){
            window.open(canvas.toDataURL());
        };

        loadAllResource();
    }

    function tickTimer(){
        if (curState !== STAT.AIING && curState !== STAT.AIRETURNED )
            return;
        if ( curMoveTick < MOVEDURATION ){
            curMoveTick ++;
            drawCanvas();
            if (curMoveTick === MOVEDURATION){
                var res = curXQPos.doMove(curMove);
                allMoves.push( [curMove, res.eat] );
                if(res.win){
                    showText( "恭喜 " + (curXQPos.side() ? "红":"黑") + "方获胜");
                    curState = STAT.WIN;
                    return;
                }
                if (curMode !== "PvAI"){
                    curState = STAT.LEVELING;
                    return;
                }
            }
        }
        
        if (curState === STAT.AIING){
            return;
        }
        if (curMoveTick === MOVEDURATION){
            if (nextAIMove){
                beginMove(nextAIMove);
                nextAIMove = 0;
            }else{
                curState = STAT.LEVELING;
            }
        }
    }
    return { run: runGame};
}();

window.onload = function(){
    xq.run();
};

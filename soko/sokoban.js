var sokoban = function(){
    var canvas;
    var context;
    var maps = {};      //maxx, maxy, maxlevel
    var tileImage;
    var boxmanAudio;
    var winAudio;

    //maxx, maxy, herox, heroy
    //leaveMan, enterMan, enterBox
    //hasSpace, hasBox, hasDest
    var curMap = [];    
    var curLevel = 0;

    var undoMapList = []; //undocnt, maxundo, addMap, undo
    
    var tiletypes = {
        WALL: '+', SPACE: ' ', OUTSIZE: '-', BOX: '#',
        BOXATDEST: '@', DEST: '.', MAN: '^', MANATDEST: '$'
    };
    var tileindexs = {};
    tileindexs[tiletypes.WALL] = 0;
    tileindexs[tiletypes.SPACE] = 1;
    tileindexs[tiletypes.OUTSIZE] = 2; 
    tileindexs[tiletypes.BOX] = 3; 
    tileindexs[tiletypes.BOXATDEST] = 4; 
    tileindexs[tiletypes.DEST] = 5; 
    tileindexs[tiletypes.MAN] = 6; 
    tileindexs[tiletypes.MANATDEST] = 7; 

    var keytypes = { "KeyA": 'l', "ArrowLeft": 'l', "KeyW": 'u', "ArrowUp": 'u', 
		"KeyD": 'r', "ArrowRight": 'r', "KeyS": 'd', "ArrowDown": 'd',
        "KeyB": 'b', "KeyM": 'm', "KeyR": 'r'};

    var heroMove = "";
    var bShowHeroMove = false;

    var states = {LOADING: 0, WAIT: 1, LEVELING: 2};
    var curState = states.LOADING; 

    function debug(v){
        document.getElementById("debuginfo").innerText+=v+"\n";
    }

    function debugHeroMove(v){
        document.getElementById("moves").innerText = bShowHeroMove ? "heroMove: "+v:"";
        document.getElementById("movecnt").innerText = v.length.toString();
    }
    function debugCurLevel(v){
        document.getElementById("curlevel").innerText = v;
    }

    function drawMap() {
        var tw = tileImage.height;
        var ti;
        //debug("tilew,tileh="+tileImage.width+","+tileImage.height);
        canvas.width = tw * curMap.maxx;
        canvas.height = tw * curMap.maxy;

        for(var y=0; y<curMap.maxy; y++){
            for(var x=0; x<curMap.maxx; x++){
                ti = tileindexs[ curMap[y][x] ];
                context.drawImage(tileImage, ti*tw, 0, tw, tw, x*tw, y*tw, tw, tw);
            }
        }
    }

    function loadMap( lvl ) {
        var row = 0;
        var col = 0;
        var mapstr = maps["M"+lvl];
        curMap = [];
        for (var i=0; i<mapstr.length; i++){
            if (mapstr[i] == '\r'){
                i++;
                row++;
                col=0;
                continue;
            }
			if (mapstr[i] == '\n'){
                row++;
                col=0;
                continue;
            }
            if (row >= curMap.length){
                curMap[row] = [];
            }
            curMap[row][col] = mapstr[i];
            col++;
        }
        
        curMap.leaveMan = function(x, y){
            switch( this[y][x] ){
                case tiletypes.MAN:
                    this[y][x] = tiletypes.SPACE;
                    break;
                case tiletypes.MANATDEST:
                    this[y][x] = tiletypes.DEST;
                    break;
                default:
                    break;
            }
        };
        curMap.enterMan = function(x, y){
            if ( this.hasDest(x, y) ){
                this[y][x] = tiletypes.MANATDEST;
            }else{
                this[y][x] = tiletypes.MAN;
            }
        };
        curMap.enterBox = function(x, y){
            if ( this.hasDest(x, y) ){
                this[y][x] = tiletypes.BOXATDEST;
            }else{
                this[y][x] = tiletypes.BOX;
            }
        };
        curMap.hasSpace = function(x, y){
            switch( this[y][x] ){
                case tiletypes.SPACE:
                    return true;
                case tiletypes.DEST:
                    return true;
                default:
                    return false;
            }
        };
        curMap.hasBox = function(x, y){
            switch( this[y][x] ){
                case tiletypes.BOX:
                    return true;
                case tiletypes.BOXATDEST:
                    return true;
                default:
                    return false;
            }
        };
        curMap.hasDest = function(x, y){
            var t = this[y][x];
            return t == tiletypes.DEST || 
                t == tiletypes.MANATDEST || t == tiletypes.BOXATDEST;
        };
        curMap.maxy = curMap.length;
        curMap.maxx = curMap[0].length;

        for(var y=0; y<curMap.maxy; y++){
            for(var x=0; x<curMap.maxx; x++){
                if (curMap[y][x] == tiletypes.MAN || 
                        curMap[y][x] == tiletypes.MANATDEST ) {
                    curMap.herox = x;
                    curMap.heroy = y;
                }
            }
        }

        undoMapList = [];
        undoMapList.maxundo = 30;
        undoMapList.undocnt = 0;
        undoMapList.addMap = function( map ){
            if (this.undocnt == this.maxundo){
                for(var i=0; i<this.undocnt-1; i++){
                    this[i] = this[i+1];
                }
                this.undocnt--;
            }
            this[this.undocnt] = [];
            copyMap(this[this.undocnt], map);
            this.undocnt++;
        };
        undoMapList.undo = function () {
            if (this.undocnt){
                this.undocnt--;
                return this[this.undocnt];
            }
            return false;
        };
    }

    function startLevel( lvl ){
        if (lvl > maps.maxlevel){
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.textAlign = "center";
            context.font = "20px sans-serif bold";
            context.strokeStyle = "silver";
            context.strokeText("恭喜，你通关了", w/2, h/2-20);
            return;
        }
        curLevel = lvl;
        localStorage['sokoban.level'] = lvl;
        loadMap( lvl );
        debugCurLevel( lvl );
        //debug("curLevel:" + curLevel + " curMap:" + 
        //        curMap.maxx + "," + curMap.maxy);
        heroMove = "";
        debugHeroMove(heroMove);
        drawMap();
    }

    function copyMap( dst, src ){
        dst.maxx = src.maxx;
        dst.maxy = src.maxy;
        dst.herox = src.herox;
        dst.heroy = src.heroy;
        for(var y=0; y<src.maxy; y++){
            dst[y] = [];
            for(var x=0; x<src.maxx; x++){
                dst[y][x] = src[y][x];
            }
        }
    }

    function testAndMakeMove( direction ){
        var det = {'l':[-1, 0], 'r':[1, 0], 'u':[0, -1], 'd':[0, 1]};
        var x = curMap.herox;
        var y = curMap.heroy;
        var nx = x + det[direction][0];
        var ny = y + det[direction][1];
        var nnx = x + 2*det[direction][0];
        var nny = y + 2*det[direction][1];
        var oldmap=[];

        copyMap(oldmap, curMap);
        if ( curMap.hasSpace(nx, ny) ){
            curMap.enterMan(nx, ny);
        }else if ( curMap.hasBox(nx, ny) && curMap.hasSpace(nnx, nny) ){
            curMap.enterBox(nnx, nny);
            curMap.enterMan(nx, ny);
        }else {
            return false;
        }
        curMap.leaveMan(x, y);
        curMap.herox = nx;
        curMap.heroy = ny;
        undoMapList.addMap(oldmap);
        return true;
    }

    function undoLastMove(){
        var oldmap = undoMapList.undo();
        if (oldmap)
        {
            copyMap(curMap, oldmap);
            return true;
        }
        return false;
    }
    function toggleMusic(){
        if (boxmanAudio.volume){
            boxmanAudio.volume = 0;
            winAudio.volume = 0;
        }else{
            boxmanAudio.volume = 0.5;
            winAudio.volume = 0.5;
        }

    }

    function testPassLevel(){
        for(var y=0; y<curMap.maxy; y++){
            for(var x=0; x<curMap.maxx; x++){
                if (curMap[y][x] == tiletypes.DEST || 
                        curMap[y][x] == tiletypes.MANATDEST ) {
                    return false;
                }
            }
        }
        return true;
    }

    function toggleSolutions(){
        var solutions="";
        var sol = document.getElementById("solutions");
        var csol = "";
        if (sol.innerHTML.length){
            sol.innerHTML = "";
        }else{
            solutions += "<table>";
            for (var i=1; i<localStorage["sokoban.level"]; i++){
                csol = localStorage["sokoban.M"+i];
                if (csol){
                    solutions += "<tr><td>"+i+"</td><td>"+csol+"</td><tr>";
                }
            }
            solutions += "</table>";
            sol.innerHTML = solutions;
        }
    }

    function onKeyDown(event) {
        if (curState === states.WAIT){
            curState = states.LEVELING;
            var slvl = localStorage['sokoban.level'];
            if ( slvl ){
                startLevel( parseInt(slvl, 10) );
            }else{
                startLevel( 1 );
            }
            return;
        }
        
        var key = keytypes[event.code];
        //debug(event.keyCode + '-' + key);
        var moveable;
        var undoable;
        if ( key ) {
            if ("lrud".indexOf(key) != -1 ){
                moveable = testAndMakeMove(key);
                if (moveable){
                    heroMove += key;
                    debugHeroMove(heroMove);
                    drawMap();
                    if (testPassLevel()){
                        winAudio.play();
                        localStorage["sokoban.M"+curLevel] = heroMove;
                        startLevel( curLevel+1 );
                    }
                }
            }else if (key === 'b'){
                undoable = undoLastMove();
                if (undoable){
                    heroMove = heroMove.substring(0, heroMove.length-1);
                    debugHeroMove(heroMove);
                    drawMap();
                }
            }else if (key === 'm'){
                toggleMusic();
            }else if (key === 'r'){
                if (curLevel){
                    startLevel(curLevel);
                }
            }

        }
    }

    function showLoading( percent ) {
        var drawPercent = function(percent, txt){
            var w = canvas.width;
            var h = canvas.height;
            context.clearRect(0, 0, w, h);
            context.textAlign = "center";
            context.font = "20px sans-serif bold";
            //context.strokeStyle = "silver";
            context.fillStyle = "silver";
            context.fillText(txt, w/2, h/2-20);
            context.fillRect(20, h-60, (w-40)*percent/100, 10);
        };
        if (percent < 100){
            drawPercent(percent, "推箱子");
        }else{
            //在chrome中设置onkeypress 不起作用
            document.body.onkeydown = onKeyDown;
            boxmanAudio.play();
            curState = states.WAIT;
            drawPercent(100, "推箱子 按任意键继续");
        }
    }

    function loadAllResource(){
        var percent = 0;
        canvas = document.getElementById("world");
        canvas.width = 300;
        canvas.height = 200;
        context = canvas.getContext("2d");
        showLoading(10);

        function loadRes(url, ready){
            var c = new XMLHttpRequest();
            c.onreadystatechange = function() {
                if (this.readyState==4 && this.status == 200){
                    ready(this.responseText);
                }
            };
            c.open("GET", url, true);
            c.send();
        }
        function parseMap( maptext ){
            var mark = "x = ";
            var sidx = mark.length + maptext.indexOf(mark);
            var eidx = maptext.indexOf("\n", sidx);
            var idx;
            maps.maxx = parseInt( maptext.substring(sidx, eidx), 10);
            mark = "y = ";
            sidx = mark.length + maptext.indexOf(mark, eidx);
            eidx = maptext.indexOf("\n", sidx);
            maps.maxy = parseInt( maptext.substring(sidx, eidx), 10);

            for (var i=1; ;i++){
                mark = "M" + i;
                idx = maptext.indexOf(mark, eidx);
                if (idx == -1){
                    maps.maxlevel = i-1;
                    break;
                }
                sidx = mark.length + 2 + idx;
                eidx = maptext.indexOf("M"+(i+1), sidx);
                if (eidx == -1){
                    eidx = maptext.length-7;
                }
                maps[mark] = maptext.substring(sidx, eidx);
                if (i == 125){
                    idx = maps[mark].indexOf("[");
                    maps[mark] = maps[mark].substring(0, idx-4);
                }
            }

            /*
             * map.txt的换行有2个字节0x0D 0x0A
            debug("maxx,maxy,level = "+ maps.maxx + "," + maps.maxy +
                    "," + maps.maxlevel);
            debug(maps.maxlevel);
            debug(maps.M125.length);
            debug(maps.M239.length);
            debug("M22:\n" + maps.M22);
            debug("M125:\n" + maps.M125);
            debug("M239:\n" + maps.M239);
            */
        }
        loadRes("map.txt", function(res){
            //debug("map loaded");
            percent += 20;
            showLoading(percent);
            parseMap(res);
            percent += 20;
            showLoading(percent);
            
        });

        tileImage = new Image();
        tileImage.onload = function(){
            //debug("tile load");
            percent += 60;
            showLoading(percent);
        };
        tileImage.src = "tile.png";

        boxmanAudio = document.getElementById("boxmanaudio");
        winAudio = document.getElementById("winaudio");
        boxmanAudio.volume=0.5;
        boxmanAudio.loop=true;
        winAudio.volume=0.5;
    }

    function runGame(){
        loadAllResource();
        document.getElementById("togglesolutions").onclick=toggleSolutions;
        document.getElementById("help").onclick=function(){
            var c = document.getElementById("controls");
            if (c.style.display === 'none'){
                c.style.display = 'block';
            }else{
                c.style.display = 'none';
            }
        };
        document.getElementById("screenshot").onclick=function(){
            window.open(canvas.toDataURL());
        };
        
    }

    return {run: runGame};
};

window.onload = function(){
    sokoban().run();
};

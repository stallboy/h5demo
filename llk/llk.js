var llk = function(){
    //资源
    var canvas;
    var context;
    var allTileImages = {};
    var curTileName;
    var tileImage;
    var tileNum;
    var itimer;

    //ENUM & settings
    var CELL = {CLOSED: 0, OPENED: 1};
    var STAT = {LOADING: 0, WAIT: 1, LEVELING: 2, WIN:3, DIE:4};
    var LINKDURATION = 2; //不要设置太长,在运动模式下link的消失阶段不允许右键选择
    var TIPDURATION = 5;
    var INIT_LIFE = 2; //刷新局面的次数
    var INIT_TICK = 1800; 
    var ADD_TICK_PER_LINK = 20;
    var MILLSEC_PER_TICK = 100; //0.1s刷一次

    var TOP_STATUSBAR = 20;


    //状态
    var difficulty;
    var curState = STAT.LOADING; 
    var curTick;
    var curMode;
    var curRemainTick;
    //在真正的cellmap四周加了2圈cell，里面1圈是空的，外面是实的
    var cellMap = [];   //[ {code:, stat:} ] .maxx .maxy 
    var cellSelected = {x:0, y:0, code:-1}; //{x, y, code}
    //运动模式下允许一个一个消了,此cellLinks只有1个
    var cellLinks = []; //{path:[], tick:}
    var cellTips = [];  //{p1:{x: y:} ,p2:, tick: }
    var cellBoard = {}; //tw, x, y, w, h

    function debug(v){
        document.getElementById("debuginfo").innerText+=v+"\n";
    }

    function initCanvas(){
        var tw = tileImage.width;
        cellBoard.tw = tw;
        cellBoard.x = tw;
        cellBoard.y = TOP_STATUSBAR+tw; 
        cellBoard.w = tw*cellMap.maxx;
        cellBoard.h = tw*cellMap.maxy;
        canvas.width  = tw * (cellMap.maxx+2);
        canvas.height  = TOP_STATUSBAR + tw * (cellMap.maxy+2);
    }

    function drawCellBoard(){
        var tw = tileImage.width;
        var x,y,ti,c;
        for(y=2; y<=cellMap.maxy+1; y++){
            for(x=2; x<=cellMap.maxx+1; x++){
                c = cellMap[y][x];
                if (c.stat === CELL.CLOSED ){
                    ti = c.code;
                    context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                        cellBoard.x+(x-2)*tw, cellBoard.y+(y-2)*tw, tw, tw);

                    if (cellSelected.code !== -1 && cellSelected.x === x && 
                            cellSelected.y === y){
                        context.globalAlpha = 0.6;
                        context.fillStyle = "#00ff00";
                        context.fillRect(
                                cellBoard.x+(x-2)*tw, cellBoard.y+(y-2)*tw, tw, tw);
                        context.globalAlpha = 1.0;
                    }
                }
            }
        }
        
        var convertToPoint = function (p){
            var tw = cellBoard.tw;
            return { x: cellBoard.x+tw/2+(p.x-2)*tw, y: cellBoard.y+tw/2+(p.y-2)*tw };
        };

        var i, lk, pt, sp, ep;
        for (i=0; i<cellTips.length; i++){
            lk = cellTips[i];
            sp = lk.p1;
            ep = lk.p2;

            ti = cellMap[sp.y][sp.x].code;
            context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                    cellBoard.x+(sp.x-2)*tw, cellBoard.y+(sp.y-2)*tw, tw, tw);
            ti = cellMap[ep.y][ep.x].code;
            context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                    cellBoard.x+(ep.x-2)*tw, cellBoard.y+(ep.y-2)*tw, tw, tw);

            context.globalAlpha = 0.5;
            context.fillStyle = "#00ff00";
            context.fillRect(
                    cellBoard.x+(sp.x-2)*tw, cellBoard.y+(sp.y-2)*tw, tw, tw);
            context.fillRect(
                    cellBoard.x+(ep.x-2)*tw, cellBoard.y+(ep.y-2)*tw, tw, tw);
            context.globalAlpha = 1.0;
        }


        for (i=0; i<cellLinks.length; i++){
            lk = cellLinks[i];
            sp = lk.path[0];
            ti = cellMap[sp.y][sp.x].code;
            context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                    cellBoard.x+(sp.x-2)*tw, cellBoard.y+(sp.y-2)*tw, tw, tw);
            ep = lk.path[lk.path.length-1];
            ti = cellMap[ep.y][ep.x].code;
            context.drawImage(tileImage, 0, ti*tw, tw, tw, 
                    cellBoard.x+(ep.x-2)*tw, cellBoard.y+(ep.y-2)*tw, tw, tw);

            context.globalAlpha = 0.5;
            context.fillStyle = "#aabbcc";
            context.fillRect(
                    cellBoard.x+(sp.x-2)*tw, cellBoard.y+(sp.y-2)*tw, tw, tw);
            context.fillRect(
                    cellBoard.x+(ep.x-2)*tw, cellBoard.y+(ep.y-2)*tw, tw, tw);
            context.globalAlpha = 1.0;

            context.beginPath();
            context.strokeStyle = '#aa2200';
            context.lineWidth = 4;
            pt = convertToPoint( lk.path[0] );
            context.moveTo(pt.x, pt.y);
            for (var j=1; j<lk.path.length; j++){
                pt = convertToPoint( lk.path[j] );
                context.lineTo(pt.x, pt.y);
            }
            context.stroke();
            context.closePath();
        }
    }

    function drawRemainTick(){
        var cw = canvas.width;
        var dw = 80;
        var dh = 12;
        var x=dw, y=dh, w=cw-2*dw, h=30-dh; 
        context.fillStyle = "#000";
        context.fillRect(x, y, w, h);
        context.strokeStyle = "#00a";
        context.lineWidth = 2;
        context.beginPath();
        context.rect(x, y, w, h);
        context.stroke();
        context.closePath();
        context.fillStyle = "#b00";
        var m=3;
        context.fillRect(x+m, y+m, (w-2*m)*curRemainTick/INIT_TICK, h-2*m);
    }

    function drawCanvas() {
        context.fillStyle = "#000";
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawRemainTick();
        drawCellBoard();
    }

    function fillCellMap( srcTiles ){
        //srcTiles: [tileidx,...]
        var src = [];
        for(var i=0; i<srcTiles.length; i++){
            src.push(srcTiles[i]);
        }
        var c, r, x, y; 
        for (y=2; y<=cellMap.maxy+1; y++){
            for(x=2; x<=cellMap.maxx+1; x++){
                c = cellMap[y][x];
                if (c.stat === CELL.CLOSED){
                    r = Math.floor(Math.random() * src.length);
                    c.code = src[r];
                    src.splice(r, 1);
                    if (src.length === 0){
                        return;
                    }
                }
            }
        }
    }

    function fillCellMapUntilOK( srcTiles ){
        fillCellMap(srcTiles);
        var tippair = [];
        var ok = getLinkTip(tippair);
        while (!ok){
            fillCellMap(srcTiles);
            tippair = [];
            ok = getLinkTip(tippair);
        }
    }

    function randSelN(n, maxc){
        //n < maxc
        var a = [];
        var r = [];
        var i, m;
        for (i=0; i<maxc; i++){ 
            a.push(i); 
        }
        for (i=0; i<n; i++){
            m = Math.floor(Math.random() * a.length);
            r.push(a[m]);
            a.splice(m, 1);
        }
        return r;
    }

    function mulArray(arr, c){
        var r=[];
        var i, j;
        for(i=0; i<c; i++){
            for(j=0; j<arr.length; j++){
                r.push(arr[j]);
            }
        }
        return r;
    }

    function startCustom( gamew, gameh, tileuse ){
        //gamew*gameh 能整除 tilecnt
        var x, y, s;
        cellMap = [];   //四周都加上，并标记上一打开，避免边界判断
        cellMap.maxx = gamew;
        cellMap.maxy = gameh;
        for (y=0; y<gameh+4; y++){
            cellMap[y] = [];
            for(x=0; x<gamew+4; x++){
                s = ( (y===1) || (x===1) || (y===gameh+2) || (x===gamew+2) ) ? 
                    CELL.OPENED : CELL.CLOSED;
                cellMap[y][x] = {code: 0, stat: s};
            }
        }
        //debug("w/h:"+gamew+"/"+gameh+" tile:"+tileuse+"/"+tileNum);
        var tiles = mulArray( randSelN(tileuse, tileNum), gamew*gameh/tileuse );
        fillCellMapUntilOK(tiles);

        cellLinks = [];
        cellSelected.code = -1;
    }

    function startGame(){
        curState = STAT.LEVELING; 
        if (itimer){
            clearInterval(itimer);
        }
        itimer = setInterval(tickTimer, MILLSEC_PER_TICK);
        curTick = 0;
        curRemainTick = INIT_TICK;

        tileImage = allTileImages[curTileName];
        tileNum = Math.floor(tileImage.height/tileImage.width);
        if (difficulty === 'veryeasy'){
            startCustom(8, 4, 8);
        }else if (difficulty === 'middle'){
            startCustom(14, 8, 28);
        }else if (difficulty === 'hard'){
            startCustom(16, 8, 32);
        }else if (difficulty === 'extrahard'){
            startCustom(18, 10, 30);
        }else{
            startCustom(12, 7, 21);
        }
        initCanvas();
        drawCanvas();
    }

    function refreshRecord(){
        var solutions =  "<table>";
        solutions += "<tr><td>veryeasy</td><td>"+localStorage['llk.veryeasy']+"</td><tr>";
        solutions += "<tr><td>easy</td><td>"+localStorage['llk.easy']+"</td><tr>";
        solutions += "<tr><td>middle</td><td>"+localStorage['llk.middle']+"</td><tr>";
        solutions += "<tr><td>hard</td><td>"+localStorage['llk.hard']+"</td><tr>";
        solutions += "<tr><td>extrahard</td><td>"+localStorage['llk.extrahard']+"</td><tr>";
        solutions += "</table>";
        document.getElementById("record").innerHTML = solutions;
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

    function testLineLink(aa, bb){
        //两点不会相同
        var a={x: aa.x, y: aa.y};
        var b={x: bb.x, y: bb.y};
        var t, i;
        if ( a.x === b.x ){
            if (a.y>b.y){t=a.y; a.y=b.y; b.y=t;}
            for(i=a.y+1; i<b.y; i++){
                if (cellMap[i][a.x].stat === CELL.CLOSED)
                    return false;
            }
            return true;
        }else if( a.y === b.y ){
            if (a.x>b.x){t=a.x; a.x=b.x; b.x=t;}
            for(i=a.x+1; i<b.x; i++){
                if (cellMap[a.y][i].stat === CELL.CLOSED)
                    return false;
            }
            return true;
        }
        return false;
    }

    function testFoldLink(a, b, adir, out){
        //返回能否用一个折点的线来连接
        //a，b不在一条直线上，
        //adir 是a点出发要寻找折点的方向,用此参数避免重复查找
        var c;
        if (adir === "lr"){ //left or right
            c = {x: b.x, y: a.y};
        }else{ //up or down
            c = {x: a.x, y: b.y};
        }
        if (cellMap[c.y][c.x].stat === CELL.CLOSED){
            return false;
        }
        var ok = testLineLink(a, c) && testLineLink(c, b);
        if (ok) out.push(c);
        return ok;
    }

    function testLink( a, b, out){
        //返回能否用2个以内折点的线来连接
        out.splice(0);
        if (testLineLink(a, b)) {
            return true;
        }
        if (testFoldLink(a, b, "lr", out)) return true;
        if (testFoldLink(a, b, "ud", out)) return true;

        var canstep = [true, true, true, true];
        var dirs = ["ud", "lr", "ud", "lr"]; //和以下的方向正好反着
        var det  = [[-1, 0], [0, -1], [1, 0], [0, 1]];
        var step = 1;
        var i, c;
        while ( canstep[0] || canstep[1] || canstep[2] || canstep[3] ){
            for (i=0; i<4; i++){
                if ( canstep[i] ){
                    c = { x: a.x + det[i][0] * step, y: a.y + det[i][1] * step };
                    out.splice(0);
                    out.push(c);
                    if ( cellMap[c.y][c.x].stat === CELL.CLOSED ){
                        canstep[i] = false;
                    }else if (testFoldLink( c, b, dirs[i], out )){
                        return true;
                    }
                }
            }
            step += 1;
        }
        return false;
    }

    function getLinkTip( matchs ){
        var x, y, c;
        var nx, ny, nc;
        var out;
        var a, b;
        for(y=2; y<=cellMap.maxy+1; y++){
            for(x=2; x<=cellMap.maxx+1; x++){
                c = cellMap[y][x];
                a = {x: x, y: y};
                if (c.stat === CELL.CLOSED){
                    ny = y;
                    for (nx=x+1; nx<=cellMap.maxx+1; nx++){
                        nc = cellMap[ny][nx];
                        if (nc.stat === CELL.CLOSED && c.code === nc.code){
                            out = [];
                            b = {x: nx, y: ny};
                            if (testLink(a, b, out)){
                                matchs.push( a );
                                matchs.push( b );
                                return true;
                            }
                        }
                    }
                    for(ny=y+1; ny<=cellMap.maxy+1; ny++){
                        for(nx=2; nx<=cellMap.maxx+1; nx++){
                            nc = cellMap[ny][nx];
                            if (nc.stat === CELL.CLOSED && c.code === nc.code){
                                out = [];
                                b = {x: nx, y: ny};
                                if (testLink(a, b, out)){
                                    matchs.push( a );
                                    matchs.push( b );
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    function getRemain(){
        var remain = [];
        for (y=2; y<=cellMap.maxy+1; y++){
            for(x=2; x<=cellMap.maxx+1; x++){
                c = cellMap[y][x];
                if (c.stat === CELL.CLOSED){
                    remain.push(c.code);
                }
            }
        }
        return remain;
    }

    function assureLinkable(){
        var tippair = [];
        var x, y;
        if ( getLinkTip(tippair) ){
            return false;
        }
        var remain = getRemain();
        if (remain.length > 0){
            fillCellMapUntilOK(remain);
            return true; 
        }
        return false;
    }

    function clickOnCell(sx, sy){
        var b = {x: sx, y: sy};
        var c = cellMap[sy][sx];
        var selectThis = function(){
            cellSelected.x = sx;
            cellSelected.y = sy;
            cellSelected.code = c.code;
        };

        if ( cellSelected.code === -1 || c.code != cellSelected.code ){
            selectThis();
            drawCanvas();
            return;
        }
        if (cellSelected.x === sx && cellSelected.y === sy){
            return;
        }

        var a = {x:cellSelected.x, y:cellSelected.y};
        var out = [];
        var path = [];
        var i;
        
        if ( !testLink(a, b, out) ){
            selectThis();
            drawCanvas();
            return;
        }

        cellMap[a.y][a.x].stat = CELL.OPENED;
        cellMap[b.y][b.x].stat = CELL.OPENED;
        path.push(a);
        for (i=0; i<out.length; i++){
            path.push(out[i]);
        }
        path.push(b);
        cellLinks.push( {path: path, tick: LINKDURATION} );
        cellSelected.code = -1;
        drawCanvas();
    }

    function inBoard(e, b){
        return (b.x < e.x) && (e.x < b.x+b.w) && (b.y < e.y) && (e.y < b.y+b.h);
    }
    function calcCell(e){
        var x = Math.floor( (e.x - cellBoard.x) / cellBoard.tw ); 
        var y = Math.floor( (e.y - cellBoard.y) / cellBoard.tw ); 
        return {x:x+2, y:y+2};
    }

    function showLoading( percent ) {
        var drawPercent = function(percent, txt){
            showText(txt);
            var w = canvas.width;
            var h = canvas.height;
            context.fillRect(20, h-60, (w-40)*percent/100, 10);
        };
        if (percent < 100){
            drawPercent(percent, "连连看 加载中...");
        }else{
            canvas.onmousedown = onMouseDown;
            curState = STAT.WAIT;
            drawPercent(100, "连连看 鼠标点击继续");
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

        var t = "countryflag.png";
        allTileImages[t] = loadImage(t, 40);
        t = "tile.png";
        allTileImages[t] = loadImage(t, 40);
    }

    function dragTo(sx, sy, sw, sh, dir, tips){
        var i,x,y,tx,ty,fy, c,nc,fc, found;
        if (dir === "down"){

            for(i=0; i<tips.length; i++){
                tx = tips[i];
                for(y=sy+sh-1; y>=sy; y--){
                    c = cellMap[y][tx];
                    if(c.stat === CELL.OPENED){
                        found = false;
                        for(fy=y-1; fy>=sy; fy--){
                            fc = cellMap[fy][tx];
                            if (fc.stat === CELL.CLOSED){
                                found = true;
                                break;
                            }
                        }
                        if (found){
                            c.code = fc.code;
                            c.stat = CELL.CLOSED;
                            fc.stat = CELL.OPENED;
                        }else{
                            break;
                        }
                    }
                }
            }

        }else if (dir === "up"){

            for(i=0; i<tips.length; i++){
                tx = tips[i];
                for(y=sy; y<sy+sh; y++){
                    c = cellMap[y][tx];
                    if(c.stat === CELL.OPENED){
                        found = false;
                        for(fy=y+1; fy<sy+sh; fy++){
                            fc = cellMap[fy][tx];
                            if (fc.stat === CELL.CLOSED){
                                found = true;
                                break;
                            }
                        }
                        if (found){
                            c.code = fc.code;
                            c.stat = CELL.CLOSED;
                            fc.stat = CELL.OPENED;
                        }else{
                            break;
                        }
                    }
                }
            }
            
        }else if (dir === "left"){

            for(i=0; i<tips.length; i++){
                ty = tips[i];
                for(x=sx; x<sx+sw; x++){
                    c = cellMap[ty][x];
                    if(c.stat === CELL.OPENED){
                        found = false;
                        for(fx=x+1; fx<sx+sw; fx++){
                            fc = cellMap[ty][fx];
                            if (fc.stat === CELL.CLOSED){
                                found = true;
                                break;
                            }
                        }
                        if (found){
                            c.code = fc.code;
                            c.stat = CELL.CLOSED;
                            fc.stat = CELL.OPENED;
                        }else{
                            break;
                        }
                    }
                }
            }
          
        }else if (dir === "right"){

            for(i=0; i<tips.length; i++){
                ty = tips[i];
                for(x=sx+sw-1; x>=sx; x--){
                    c = cellMap[ty][x];
                    if(c.stat === CELL.OPENED){
                        found = false;
                        for(fx=x-1; fx>=sx; fx--){
                            fc = cellMap[ty][fx];
                            if (fc.stat === CELL.CLOSED){
                                found = true;
                                break;
                            }
                        }
                        if (found){
                            c.code = fc.code;
                            c.stat = CELL.CLOSED;
                            fc.stat = CELL.OPENED;
                        }else{
                            break;
                        }
                    }
                }
            }
        }else{
            debug("dragTo "+dir);
        }
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

    function tickTimer(){
        var i, lk, lkchange=0, tipchange=0;
        var sp, ep, tips, tips2;
        var dw, dh, dx, dy;
        var dir1, dir2;
        var uniqpush = function (vec, o){
            if (vec.indexOf(o) === -1)
                vec.push(o);
            };
        curTick++;
        curRemainTick--;
        for (i=cellLinks.length-1; i>=0;  i--){
            lk = cellLinks[i];
            if (lk.tick > 0)
                lk.tick -= 1;
            if (lk.tick === 0){
                cellLinks.splice(i, 1);
                lkchange += 1;
                curRemainTick += ADD_TICK_PER_LINK;
                sp = lk.path[0];
                ep = lk.path[lk.path.length-1];
                if (curMode === "down"){
                    tips = [];
                    uniqpush(tips, sp.x);
                    uniqpush(tips, ep.x);
                    dragTo(2, 2, cellMap.maxx, cellMap.maxy, "down", tips);
                }else if (curMode === "left"){
                    tips = [];
                    uniqpush(tips, sp.y);
                    uniqpush(tips, ep.y);
                    dragTo(2, 2, cellMap.maxx, cellMap.maxy, "left", tips);
                }else if (curMode === "updown" || curMode === "downup" || curMode === "szxy"){
                    tips = [];
                    tips2 = [];
                    dh = Math.floor(cellMap.maxy/2);
                    dy = 2 + dh;
                    if (curMode === "updown"){
                        uniqpush( (sp.y < dy) ? tips : tips2, sp.x);
                        uniqpush( (ep.y < dy) ? tips : tips2, ep.x);
                        dir1 = "up";
                        dir2 = "down";
                    }else if(curMode === "downup"){
                        uniqpush( (sp.y < dy) ? tips : tips2, sp.x);
                        uniqpush( (ep.y < dy) ? tips : tips2, ep.x);
                        dir1 = "down";
                        dir2 = "up";
                    }else{
                        uniqpush( (sp.y < dy) ? tips : tips2, sp.y);
                        uniqpush( (ep.y < dy) ? tips : tips2, ep.y);
                        dir1 = "left";
                        dir2 = "right";
                    }
                    dragTo(2, 2, cellMap.maxx, dh, dir1, tips);
                    dragTo(2, dy, cellMap.maxx, cellMap.maxy-dh, dir2, tips2);

                }else if (curMode === "leftright" || curMode === "rightleft" || curMode === "zxys"){
                    tips = [];
                    tips2 = [];
                    dw = Math.floor(cellMap.maxx/2);
                    dx = 2 + dw;
                    if (curMode === "leftright"){
                        uniqpush( (sp.x < dx) ? tips : tips2, sp.y);
                        uniqpush( (ep.x < dx) ? tips : tips2, ep.y);
                        dir1 = "left";
                        dir2 = "right";
                    }else if (curMode === "rightleft"){
                        uniqpush( (sp.x < dx) ? tips : tips2, sp.y);
                        uniqpush( (ep.x < dx) ? tips : tips2, ep.y);
                        dir1 = "right";
                        dir2 = "left";
                    }else{
                        uniqpush( (sp.x < dx) ? tips : tips2, sp.x);
                        uniqpush( (ep.x < dx) ? tips : tips2, ep.x);
                        dir1 = "down";
                        dir2 = "up";
                    }
                    dragTo(2, 2, dw, cellMap.maxy, dir1, tips);
                    dragTo(dx,2, cellMap.maxx-dw, cellMap.maxy, dir2, tips2);
                }
            }
        }
        for (i=cellTips.length-1; i>=0;  i--){
            lk = cellTips[i];
            if (lk.tick > 0)
                lk.tick -= 1;
            if (lk.tick === 0){
                cellTips.splice(i, 1);
                tipchange += 1;
            }
        }

        drawRemainTick();

        if (curRemainTick < 0){
            curState = STAT.DIE; 
            showText("抱歉，你挂了");
            return;
        }
        if (lkchange ===  0 && tipchange === 0){
            return;
        }
        if ( lkchange === 0 ){
            drawCanvas();
            return;
        }

        var changed = assureLinkable();
        if (changed){
            drawCanvas();
            return;
        }
        var remain = getRemain();
        if (remain.length > 0){
            drawCanvas();
            return;
        }

        curState = STAT.WIN;
        clearInterval(itimer);
        //winAudio.play();
        var k = 'llk.'+difficulty;
        var usetime = Math.floor(curTick/10);
        var msg = "恭喜你，用时:"  + usetime;
        if ( (!localStorage[k]) || localStorage[k] > usetime ){
            localStorage[k] = usetime;
            msg += ",刷新了自己的记录";
            refreshRecord();
        }
        showText(msg);

    }
    function onMouseDown( event ) {
        if (curState === STAT.WAIT){
            startGame();
            return;
        }
        if (curMode !== "default" && cellLinks.length > 0){
            return;
        }
        if (event.button === 0){
            var e = getCursorPosition( event );
            if (inBoard(e, cellBoard) && curState === STAT.LEVELING ){
                var c = calcCell(e);
                if ( cellMap[c.y][c.x].stat === CELL.CLOSED ){
                    clickOnCell(c.x, c.y);
                }
            }
        }
        return;
    }
    function onToggleRecord(){
        var sol = document.getElementById("record");
        if (sol.innerHTML.length){
            sol.innerHTML = "";
        }else{
            refreshRecord();
        }
    }
    function onDifficultyChange(){
        difficulty = this.options[this.options.selectedIndex].value;
        startGame();
    }
    function onTileChange(){
        curTileName = this.options[this.options.selectedIndex].value;
        startGame();
    }
    function onModeChange(){
        curMode = this.options[this.options.selectedIndex].value;
        startGame();
    }
    function onTip(){
        var tippair = [];
        if ( getLinkTip(tippair) ){
            //debug(tippair);
            cellTips.push( {p1: tippair[0], p2: tippair[1], tick: TIPDURATION} );
            drawCanvas();
        }
    }
    function onRefreshCell(){
        var remain = getRemain();
        if (remain.length > 0){
            fillCellMapUntilOK(remain);
            drawCanvas();
        }
    }

    function runGame(){
        document.getElementById("togglerecord").onclick=onToggleRecord;
        document.getElementById("tip").onclick=onTip;
        document.getElementById("restart").onclick=startGame;
        document.getElementById("refresh").onclick=onRefreshCell;
        var d = document.getElementById("difficulty");
        difficulty = d.options[d.options.selectedIndex].value;
        d.onchange=onDifficultyChange;

        var t = document.getElementById("tile");
        curTileName = t.options[t.options.selectedIndex].value;
        t.onchange=onTileChange;

        var m = document.getElementById("mode");
        curMode = m.options[m.options.selectedIndex].value;
        m.onchange=onModeChange;

        document.getElementById("screenshot").onclick=function(){
            window.open(canvas.toDataURL());
        };
        loadAllResource();
    }
    return { run: runGame};
}();

window.onload = function(){
    llk.run();
};

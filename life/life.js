var life = function(){
    //资源
    var canvas;
    var context;
    var debugele;
    var genele;
    var denseele;
    //ENUM
    var SPEEDMAP = {"slow": 500, "high": 200, "veryhigh": 20};
    var STAT = {WAIT: 1, RUN: 2};

    //状态
    var itimer = null;
    var cellMap = []; 
    var generation = 0;
    var earth;
    var speed;
    var state;

    //画板内部状态
    var CELLW = 12;
    var width = 60;
    var height = 40;

    function debug(v){
        debugele.innerText+=v+"\n";
    }
    function drawCanvas() {
        var x, y, c;
        context.fillStyle = "#888";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.beginPath();
        for(y=1; y<height; y++){
            context.moveTo(0, 0.5+y*CELLW);
            context.lineTo(canvas.width, 0.5+y*CELLW);
        }
        for(x=1; x<width; x++){
            context.moveTo(0.5+x*CELLW, 0);
            context.lineTo(0.5+x*CELLW, canvas.height);
        }
        context.strokeStyle = "#999";
        context.stroke();
        context.closePath();
        
        for(y=0; y<height; y++){
            for(x=0; x<width; x++){
                c = cellMap[y+1][x+1];
                if (c === 1){
                    context.fillStyle = "yellow";
                    context.fillRect(x*CELLW+2, y*CELLW+2, CELLW-4, CELLW-4);
                }
            }
        }
    }
    function startGame(){
        var dense = +denseele.value/100;
        cellMap = [];
        var x, y, s, line;
        var half = Math.random()<0.5;
        for (y=0; y<height+2; y++){
            line = [];
            for (x=0; x<width+2; x++){
                if ( ( half && ( x<width/4 || y<height/4 || x>width*3/4 || y>height*3/4 )) ||
                        (x<1 || y<1 || x>width || y>height)){
                    s = 0;
                }else if (Math.random() < dense){
                    s = 1;
                }else{
                    s = 0;
                }
                line.push(s);
            }
            cellMap.push(line);
        }
        generation = 0;
        genele.innerHTML = generation;
        state = STAT.WAIT;
        if (itimer){
            clearInterval(itimer);
            itimer = null;
        }
        document.getElementById("start").innerHTML="start";
        drawCanvas();
    }

    function cloneCellMap(){
        var cm = [];
        var x, y, s, line;
        for (y=0; y<height+2; y++){
            cm.push( cellMap[y].slice() );
        }
        return cm;
    }

    function step(){
        var x, y, c, s, change=0;
        var xd, xa, yd, ya;
        var cm = cloneCellMap();
        for(y=1; y<height+1; y++){
            yd = y-1;
            ya = y+1;
            if (earth === "round"){
                yd = yd < 1 ? height : yd;
                ya = ya > height ? 1 : ya;
            }
            for(x=1; x<width+1; x++){
                c = cm[y][x];
                xd = x-1;
                xa = x+1;
                if (earth === "round"){
                    xd = xd < 1 ? width : xd;
                    xa = xa > width ? 1 : xa;
                }
                s = cm[yd][xd] + cm[yd][x] + cm[yd][xa] + 
                    cm[ y][xd] +             cm[ y][xa] + 
                    cm[ya][xd] + cm[ya][x] + cm[ya][xa];
                if (s === 3 && c === 0){
                    cellMap[y][x] = 1;
                    change++;
                }else if( c === 1 && (s < 2 || s > 3)  ){
                    cellMap[y][x] = 0;
                    change++;
                }
            }
        }
        generation++;
        genele.innerHTML = generation;
        if (change){
            drawCanvas();
        }
    }
    function onStep(){
        if (state === STAT.WAIT){
            step();
        }
    }
    function onStart(){
        if (state === STAT.WAIT){
            document.getElementById("start").innerHTML="stop";
            state = STAT.RUN;
        }else{
            document.getElementById("start").innerHTML="start";
            state = STAT.WAIT;
        }

        if (itimer){
            clearInterval(itimer);
            itimer = null;
        }
        if (state === STAT.RUN){
            itimer = setInterval(step, SPEEDMAP[speed]);
        }
    }
    function onSpeedChange(){
        speed = this.options[this.options.selectedIndex].value;
        if (state === STAT.RUN) {
            if (itimer){
                clearInterval(itimer);
                itimer = null;
            }
            itimer = setInterval(step, SPEEDMAP[speed]);
        }
    }
    function onEarthChange(){
        earth = this.options[this.options.selectedIndex].value;
    }
    function getCursorPosition(e) {
        var x, y;
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

    function runGame(){
        document.getElementById("step").onclick=onStep;
        document.getElementById("start").onclick=onStart;
        document.getElementById("restart").onclick=startGame;
        document.getElementById("screenshot").onclick=function(){
            window.open(canvas.toDataURL());
        };

        debugele = document.getElementById("debuginfo");
        genele = document.getElementById("gen");
        denseele = document.getElementById("dense");

        var d = document.getElementById("earth");
        earth = d.options[d.options.selectedIndex].value;
        d.onchange=onEarthChange;

        d = document.getElementById("speed");
        speed = d.options[d.options.selectedIndex].value;
        d.onchange=onSpeedChange;

        canvas = document.getElementById("world");
        canvas.width = width*CELLW;
        canvas.height = height*CELLW;
        context = canvas.getContext("2d");

        startGame();
    }
    return {run: runGame};
}();

window.onload = function(){
    life.run();
};

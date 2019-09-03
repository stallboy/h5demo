function xqPos(){
    var side = 0; //0是红方，1为黑方
    var board = [];
    var redValue, blackValue; //这个是纯位置静态得分，eval时加上链接得分
    var distance;

    function marshal(){
        return {side: side, board: board, redValue: redValue, 
            blackValue: blackValue, distance: distance};
    }
    function unmarshal(o){
        side = o.side;
        board = o.board.slice(0);
        redValue = o.redValue;
        blackValue = o.blackValue;
        distance = o.distance;
    }
    ///////////
    function cellType(idx){
        var c = board[idx];
        return c < 15? c-8 : c-16;
    }
    function inFort(idx){
        return xqCfg.inFort[idx] === 1;
    }
    function inBoard(idx){
        return xqCfg.inBoard[idx] === 1;
    }
    function sameHalf(si, di) {
        return (si < 128 && di < 128) || (si > 127 && di > 127);
    }
    function addPiece(i, c){
        board[i] = c;
        if (c < 15){
            redValue += xqCfg.piecePosValue[c-8][i];
        }else{
            blackValue += xqCfg.piecePosValue[c-16][254-i];
        }
    }
    function delPiece(i){
        var c = board[i];
        if (c === 0) return;
        board[i] = 0;
        if (c < 15){
            redValue -= xqCfg.piecePosValue[c-8][i];
        }else{
            blackValue -= xqCfg.piecePosValue[c-16][254-i];
        }
    }

    ///////////
    function init(){
        side = 0;
        redValue = 0;
        blackValue = 0;
        distance = 0;
        var c;
        for(var i=0; i<256; i++){
            c = xqCfg.startupBoard[i];
            if (c){
                addPiece(i, c);
            }else{
                board[i] = 0;
            }
        }
    }
    function curdistance(){
        return distance;
    }
    function cell(idx){
        return board[idx];
    }
    function curside(){
        return side;
    }
    function isCellMySide(idx){
        var c = board[idx];
        if (c === 0) return false;
        var s = c < 15 ? 0 : 1;
        return s === side;
    }
    function sideLinkValue( s ){
        var i, di;
        var link = 0;
        var linkscore = [];
        for (i=0; i<256; i++){
            linkscore[i] = 0;
        }
        var oldside = side;
        side = s;
        var mvs = generateMoves();
        for(i=0; i<mvs.length; i++){
            di = mvs[i] % 256;
            linkscore[di]++;
        }
        for (i=0; i<board.length; i++){
            c = board[i];
            if (c === 0) continue;
            if (c < 15 ){
                if (linkscore[i]) 
                    link += xqCfg.linkPosValue[c-8][i];
            }else{
                if (linkscore[i]) 
                    link += xqCfg.linkPosValue[c-16][254-i];
            }
        }
        side = oldside;
        return link;
    }
    function evaluate(){
        /*
        var rl = sideLinkValue(0);
        var bl = sideLinkValue(1);
        */
        var redv = redValue-blackValue ;//+ rl-bl;
        return (side === 0? redv : -redv) + xqCfg.orderValue;
    }
    
    function doMove(mv){
        var si = mv >> 8; 
        var di = mv % 256;
        var dc = board[di];
        var dt = cellType(di);
        delPiece(di);
        addPiece(di, board[si]);
        delPiece(si);
        distance++;
        side = 1-side;
        var win = ( dt === xqCfg.KING );
        return  {win: win, eat: dc};
    }
    function undoMove(mv, eat){
        side = 1-side;
        distance--;
        var si = mv >> 8; 
        var di = mv % 256;
        var dc = board[di];
        delPiece(di);
        addPiece(si, dc);
        if (eat){
            addPiece(di, eat);
        }
    }
    
    function generateMoves(){
        var mvs = [];
        var i, si,sc,di,dc, det;
        for(si=0; si<256; si++){
            if ( !isCellMySide(si) ) continue;
            switch ( cellType(si) ){
                case xqCfg.KING:
                    for(i=0; i<4; i++){
                        di = si + xqCfg.kingDelta[i];
                        if ( inFort(di) && !isCellMySide(di)){
                            mvs.push((si<<8)+di);
                        }
                    }
                    //这里加上将可以吃照面的将
                    det = side ? 16 : -16;
                    for(di=si+det; inBoard(di) && board[di] === 0;){
                        di += det;
                    }
                    if ( board[di] && cellType(di) === xqCfg.KING){
                        mvs.push((si<<8)+di);
                    }
                    break;
                case xqCfg.ADVISOR:
                    for(i=0; i<4; i++){
                        di = si + xqCfg.advisorDelta[i];
                        if ( inFort(di) && !isCellMySide(di)){
                            mvs.push((si<<8)+di);
                        }
                    }
                    break;
                case xqCfg.ELEPHANT:
                    for(i=0; i<4; i++){
                        di = si + xqCfg.elephantDelta[i];
                        if ( inBoard(di) && !isCellMySide(di) &&
                                sameHalf(si, di) && board[(si+di)/2] === 0){
                            mvs.push((si<<8)+di);
                        }
                    }
                    break;
                case xqCfg.HORSE:
                    for(i=0; i<8; i++){
                        di = si + xqCfg.horseDelta[i];
                        if ( inBoard(di) && !isCellMySide(di) &&
                                board[si+xqCfg.kingDelta[Math.floor(i/2)]] === 0){
                            mvs.push((si<<8)+di);
                        }
                    }
                    break;
                case xqCfg.ROOK:
                    for(i=0; i<4; i++){
                        det = xqCfg.kingDelta[i];
                        for(di=si+det; inBoard(di); di+=det){
                            dc = board[di];
                            if (dc === 0){
                                mvs.push((si<<8)+di);
                            }else{
                                if ( !isCellMySide(di) ){
                                    mvs.push((si<<8)+di);
                                }
                                break;
                            }
                        }
                    }
                    break;
                case xqCfg.CANNON:
                    for(i=0; i<4; i++){
                        det = xqCfg.kingDelta[i];
                        for(di=si+det; inBoard(di) && board[di] === 0; di += det){
                            mvs.push((si<<8)+di);
                        }
                        for(di+=det; inBoard(di) && board[di] === 0; ){
                            di += det;
                        }
                        if (board[di] && !isCellMySide(di)){
                            mvs.push((si<<8)+di);
                        }
                    }
                    break;
                case xqCfg.PAWN:
                    di = si + (side ? 16: -16); 
                    if (inBoard(di) && !isCellMySide(di)){
                        mvs.push((si<<8)+di);
                    }
                    if ( (si>127) && (side===1) || (si<128) && (side===0)){
                        di = si+1;
                        if (inBoard(di) && !isCellMySide(di)){
                            mvs.push((si<<8)+di);
                        }
                        di = si-1;
                        if (inBoard(di) && !isCellMySide(di)){
                            mvs.push((si<<8)+di);
                        }
                    }
                    break;
                default:
                    break;
            }
        }
        return mvs;
    }

    function canMove(mv){
        var mvs = generateMoves();
        return mvs.indexOf(mv) !== -1;
    }


    return {
        init: init, 
        cell: cell, 
        side: curside, 
        distance: curdistance,
        isCellMySide: isCellMySide,
        canMove: canMove,
        doMove: doMove, 
        generateMoves: generateMoves,
        undoMove: undoMove,
        evaluate: evaluate,
        marshal: marshal,
        unmarshal: unmarshal
    };
}




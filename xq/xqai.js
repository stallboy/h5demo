importScripts("xqcfg.js", "xqpos.js", "sprintf.js");

var xqAIManager = {};
//各个ai的返回为 [bestmove, debuginfo, stat]

//考虑1步用评价函数来下棋
(function () {
    function ai1GetBestMove(pos) {
        var mvs = pos.generateMoves();
        var mv, res, v;
        var best = 10000;
        var bestmv = 0;
        for (var i = 0; i < mvs.length; i++) {
            mv = mvs[i];
            res = pos.doMove(mv);
            if (res.win) {
                pos.undoMove(mv, res.eat);
                return mv;
            }
            v = pos.evaluate();
            if (v < best) {
                best = v;
                bestmv = mv;
            }
            pos.undoMove(mv, res.eat);
        }
        return [bestmv, "", {}];
    }

    xqAIManager['傻根'] = ai1GetBestMove;
})();


//考虑3步，用最大最小算法来下
(function () {
    function ai2GetBestMove(myPos) {
        var myBestMv = 0;
        var myDepth = 3;

        function negaMaxSearch(pos, depth) {
            if (depth === 0) {
                return pos.evaluate();
            }
            var mvs = pos.generateMoves();
            var mv, res, v;
            var best = -100000;
            var bestmv = 0;
            for (var i = 0; i < mvs.length; i++) {
                mv = mvs[i];
                res = pos.doMove(mv);
                if (res.win) {
                    best = 20000;
                    bestmv = mv;
                    pos.undoMove(mv, res.eat);
                    break;
                } else {
                    v = -negaMaxSearch(pos, depth - 1);
                    if (v > best) {
                        best = v;
                        bestmv = mv;
                    }
                    pos.undoMove(mv, res.eat);
                }
            }
            if (bestmv && depth === myDepth) {
                myBestMv = bestmv;
            }
            return best;
        }

        negaMaxSearch(myPos, myDepth);
        return [myBestMv, "", {}];
    }

    xqAIManager['想3步'] = ai2GetBestMove;
})();

//使用AlphaBeta来剪枝最大最小算法
(function () {
    function ai3GetBestMove(myPos) {
        var myBestMv = 0;
        var myDepth = 5;
        var evalCnt = 0;
        var betaCut = 0;

        function alphabetaSearch(pos, depth, alpha, beta) {
            if (depth === 0) {
                evalCnt++;
                return pos.evaluate();
            }
            var mvs = pos.generateMoves();
            var mv, res, v;
            var bestmv = 0;
            for (var i = 0; i < mvs.length; i++) {
                mv = mvs[i];
                res = pos.doMove(mv);
                if (res.win) {
                    v = 200000 + depth;
                } else {
                    v = -alphabetaSearch(pos, depth - 1, -beta, -alpha);
                }
                pos.undoMove(mv, res.eat);

                if (v >= beta) {
                    betaCut++;
                    return beta;
                }
                if (v > alpha) {
                    alpha = v;
                    bestmv = mv;
                }
            }
            if (bestmv && depth === myDepth) {
                myBestMv = bestmv;
            }
            return alpha;
        }

        alphabetaSearch(myPos, myDepth, -100000, 100000);
        var info = sprintf("%3d: eval-%8d, cut-%8d", myPos.distance(), evalCnt, betaCut);
        return [myBestMv, info, {}];
    }

    xqAIManager['想5步'] = ai3GetBestMove;
})();

//排序然后再用alphabeta，剪枝会更多
(function () {
    function ai4GetBestMove(myPos) {
        var myBestMv = 0;
        var myDepth = 6;
        var evalCnt = 0;
        var betaCut = 0;
        var historyTable = [];
        var i;
        for (i = 0; i < 65536; i++) {
            historyTable[i] = 0;
        }

        function compareMv(mv1, mv2) {
            return historyTable[mv2] - historyTable[mv1];
        }

        function alphabetaSearch(pos, depth, alpha, beta) {
            if (depth === 0) {
                evalCnt++;
                return pos.evaluate();
            }
            var mvs = pos.generateMoves();
            mvs.sort(compareMv);
            var mv, res, v;
            var bestmv = 0;
            for (var i = 0; i < mvs.length; i++) {
                mv = mvs[i];
                res = pos.doMove(mv);
                if (res.win) {
                    v = 200000 + depth;
                } else {
                    v = -alphabetaSearch(pos, depth - 1, -beta, -alpha);
                }
                pos.undoMove(mv, res.eat);

                if (v >= beta) {
                    bestmv = mv;
                    betaCut++;
                    return beta;
                }
                if (v > alpha) {
                    bestmv = mv;
                    alpha = v;
                }
            }
            if (bestmv) {
                historyTable[bestmv] += (depth * depth);
            }
            if (bestmv && depth === myDepth) {
                myBestMv = bestmv;
            }
            return alpha;
        }

        //迭代深入搜索,本来是应该用来使ai按时返回的。这里用来测试填充history导致的beta截断情况
        /*
        for (i=1; i<myDepth; i++){
            alphabetaSearch(myPos, i, -100000, 100000);
        }
        evalCnt = 0;
        betaCut = 0;
        */
        alphabetaSearch(myPos, myDepth, -100000, 100000);
        var info = sprintf("%3d: eval-%8d, cut-%8d", myPos.distance(), evalCnt, betaCut);
        return [myBestMv, info, {}];
    }

    xqAIManager['排序想6步'] = ai4GetBestMove;
})();


onmessage = function (e) {
    var k;
    var ais = [];
    if (e.data === "query") {
        //postMessage( this.toString() );
        for (k in xqAIManager) {
            ais.push(k);
        }
        postMessage({type: "query", ais: ais});
    } else {
        var pos = xqPos();
        pos.unmarshal(e.data.pos);
        var mv = xqAIManager[e.data.ai](pos);
        postMessage({type: "bestmv", mv: mv});
    }
};

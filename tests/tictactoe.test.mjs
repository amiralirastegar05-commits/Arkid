import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LINES,createMatch,bestMove,legalMoves,pickMove,result} from '../tictactoe-engine.js';
import {isGameKey} from '../cloud/snapshot.js';

test('wins are detected on rows, columns and both diagonals, and a full board draws',()=>{
 for(const line of LINES){
   const board=Array(9).fill(null);board[line[0]]=board[line[1]]=board[line[2]]='X';
   const outcome=result(board);assert.equal(outcome.winner,'X');assert.deepEqual(outcome.line,line);
 }
 const draw=['X','O','X','X','O','O','O','X','X'];assert.deepEqual(result(draw),{winner:null,line:null,draw:true});
 assert.equal(result(Array(9).fill(null)),null);
});

test('the hard opponent takes wins, blocks losses and can never be beaten',()=>{
 const win=Array(9).fill(null);win[0]=win[4]='O';win[1]='X';assert.equal(bestMove(win,'O'),8);
 const block=Array(9).fill(null);block[0]=block[1]='X';block[4]=block[8]='O';assert.equal(bestMove(block,'O'),2);
 const board=Array(9).fill(null);
 const playHuman=(board,mark,mark2,human)=>{
   for(const move of legalMoves(board)){
     board[move]=human;
     const outcome=result(board);
     if(outcome){if(outcome.winner===human)return true;board[move]=null;continue}
     const reply=bestMove(board,mark);board[reply]=mark;
     const after=result(board);
     if(after&&after.winner===mark){board[reply]=null;board[move]=null;continue}
     if(!after&&playHuman(board,mark,mark2,human)){board[reply]=null;board[move]=null;return true}
     board[reply]=null;board[move]=null;
   }
   return false;
 };
 assert.equal(playHuman(board,'O','X','X'),false);
 assert.equal(playHuman(Array(9).fill(null),'X','O','O'),false);
});

test('difficulty picks legal moves, and matches update turns, results and reset state',()=>{
 for(let roll=0;roll<1;roll+=.1){
   for(const difficulty of ['easy','normal','hard']){
     const move=pickMove(Array(9).fill(null),'X',difficulty,()=>roll);
     assert.ok(legalMoves(Array(9).fill(null)).includes(move),`${difficulty} ${roll}`);
   }
 }
 const match=createMatch({mode:'solo',difficulty:'hard',random:()=>.5});
 assert.equal(match.game.human,'X');assert.equal(match.game.ai,'O');assert.equal(match.play(4).ok,true);assert.equal(match.game.turn,'O');
 const ai=match.aiMove();assert.equal(match.game.board[ai],'O');assert.equal(match.play(ai).ok,false);
 assert.equal(match.play(99).ok,false);
 const duo=createMatch({mode:'duo'});
 assert.equal(duo.game.ai,null);assert.equal(duo.aiMove(),null);
 duo.play(0);duo.play(1);duo.play(3);duo.play(4);duo.play(6);
 assert.equal(duo.game.status,'done');assert.deepEqual(duo.game.result,{winner:'X',line:[0,3,6],draw:false});
});

test('the game is wired into the hub, the score backup, the guide and the offline cache',async()=>{
 const [hub,guides,sw,page,script]=await Promise.all(['../index.html','../hub-enhancements.js','../sw.js','../tictactoe.html','../tictactoe.js'].map(f=>readFile(new URL(f,import.meta.url),'utf8')));
 assert.match(hub,/id:'tictactoe'.*file:'tictactoe\.html'.*cover:'tic', fresh:true/);
 assert.match(guides,/'tictactoe':/);
 assert.equal(isGameKey('arcade_top_tictactoe'),true);
 for(const asset of ['tictactoe.html','tictactoe.css','tictactoe.js','tictactoe-engine.js','assets/game-covers/tictactoe.svg'])assert.ok(sw.includes(`'${asset}'`),asset);
 assert.match(page,/role="grid"/);assert.match(page,/data-difficulty/);assert.match(script,/arcade_top_tictactoe/);assert.match(script,/STATS='tictactoe_stats'/);assert.match(script,/localStorage\.setItem\(STATS,JSON\.stringify\(stats\)\)/);
});

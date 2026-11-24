// Pure tic-tac-toe rules with an unbeatable minimax opponent.
export const LINES=Object.freeze([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]);
export const DIFFICULTIES=Object.freeze({easy:'آسان',normal:'معمولی',hard:'سخت'});
const other=mark=>mark==='X'?'O':'X';
const pick=list=>list[Math.floor(Math.random()*list.length)];
export function result(board){
  for(const line of LINES){
    const [a,b,c]=line;
    if(board[a]&&board[a]===board[b]&&board[b]===board[c])return {winner:board[a],line,draw:false};
  }
  return board.every(Boolean)?{winner:null,line:null,draw:true}:null;
}
export function legalMoves(board){const moves=[];for(let i=0;i<9;i++)if(!board[i])moves.push(i);return moves}
export function bestMove(board,mark){
  let bestScore=-Infinity,best=null;
  for(const index of legalMoves(board)){
    board[index]=mark;
    const score=minimax(board,mark,1,other(mark));
    board[index]=null;
    if(score>bestScore){bestScore=score;best=index}
  }
  return best;
}
function minimax(board,mark,depth,current){
  const outcome=result(board);
  if(outcome)return outcome.winner===mark?10-depth:outcome.winner?depth-10:0;
  const moves=legalMoves(board);
  let best=current===mark?-Infinity:Infinity;
  for(const index of moves){
    board[index]=current;
    const score=minimax(board,mark,depth+1,other(current));
    board[index]=null;
    best=current===mark?Math.max(best,score):Math.min(best,score);
  }
  return best;
}
export function pickMove(board,mark,difficulty='normal',random=Math.random){
  const moves=legalMoves(board);
  if(!moves.length)return null;
  const sample=Number(random());
  const roll=Number.isFinite(sample)?Math.max(0,Math.min(.9999,sample)):.5;
  if(difficulty==='easy')return moves[Math.floor(roll*moves.length)];
  if(difficulty==='hard')return bestMove(board,mark);
  return roll<.7?bestMove(board,mark):moves[Math.floor(roll*moves.length)];
}
export function createMatch({mode='solo',difficulty='normal',starter='X',random=Math.random}={}){
  const game={mode,difficulty,starter,board:Array(9).fill(null),turn:starter,status:'playing',result:null,moves:0,human:mode==='solo'?starter:null,ai:mode==='solo'?other(starter):null};
  function play(index){
    if(game.status!=='playing'||!Number.isInteger(index)||index<0||index>8||game.board[index])return {ok:false};
    const mark=game.turn;
    game.board[index]=mark;game.moves++;
    const outcome=result(game.board);
    if(outcome){game.result=outcome;game.status='done'}
    else game.turn=other(mark);
    return {ok:true,mark,index};
  }
  function aiMove(){
    if(game.mode!=='solo'||game.status!=='playing'||game.turn!==game.ai)return null;
    const index=pickMove(game.board,game.ai,game.difficulty,random);
    return index===null?null:(play(index),index);
  }
  return {game,play,aiMove};
}

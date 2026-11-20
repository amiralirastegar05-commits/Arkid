// Experimental deterministic 2048 replay core; NOT a live scoring endpoint.
// A server must issue and bind seeds, limit attempts, enforce single use and
// verify a completed replay before this could ever award monthly points.
// Deterministic replay cannot prevent bots or collusion.
const MAX_MOVES = 4096;
const DIRECTIONS = new Set(['L','R','U','D']);

export function slideLine(line) {
  if (!Array.isArray(line) || line.length !== 4 || line.some(v => !Number.isSafeInteger(v) || v < 0 || (v !== 0 && (!Number.isInteger(Math.log2(v)) || v < 2)))) throw Error('invalid_board');
  const values=line.filter(Boolean), merged=[];
  let gained=0;
  for(let i=0;i<values.length;i++){
    let value=values[i];
    if(i+1<values.length && values[i+1]===value){value*=2;i++;gained+=value;}
    if(!Number.isSafeInteger(value)||!Number.isSafeInteger(gained))throw Error('score_overflow');
    merged.push(value);
  }
  while(merged.length<4)merged.push(0);
  return {line:merged,gained};
}
function rand(state){
  state.rng=(state.rng+0x6d2b79f5)>>>0;
  let t=state.rng;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}
function spawn(state){
  const empty=[];
  for(let i=0;i<16;i++)if(state.board[i]===0)empty.push(i);
  if(!empty.length)return;
  const cell=empty[Math.floor(rand(state)*empty.length)];
  state.board[cell]=rand(state)<0.1?4:2;
}
function indexes(direction,line){
  const a=[];
  for(let n=0;n<4;n++){
    if(direction==='L')a.push(line*4+n);
    else if(direction==='R')a.push(line*4+3-n);
    else if(direction==='U')a.push(n*4+line);
    else a.push((3-n)*4+line);
  }
  return a;
}
function move(state,direction){
  const board=state.board.slice();let gained=0;
  for(let l=0;l<4;l++){
    const positions=indexes(direction,l), output=slideLine(positions.map(i=>state.board[i]));
    gained+=output.gained;
    positions.forEach((index,j)=>{board[index]=output.line[j]});
  }
  if(board.every((x,i)=>x===state.board[i]))throw Error('invalid_move');
  state.board=board;
  state.score+=gained;
  if(!Number.isSafeInteger(state.score))throw Error('score_overflow');
  spawn(state);
}
export function canMove(board){
  if(board.some(x=>x===0))return true;
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const i=r*4+c;
    if(c<3 && board[i]===board[i+1])return true;
    if(r<3 && board[i]===board[i+4])return true;
  }
  return false;
}
export function replayRanked2048(seed,moves){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('invalid_seed');
  if(!Array.isArray(moves)||moves.length>MAX_MOVES)throw Error('invalid_transcript');
  // for...of also checks sparse array slots, unlike Array.prototype.some.
  for(const direction of moves)if(!DIRECTIONS.has(direction))throw Error('invalid_transcript');
  const state={board:Array(16).fill(0),score:0,rng:seed>>>0};
  spawn(state);spawn(state);
  for(const direction of moves){
    if(!canMove(state.board))throw Error('game_already_over');
    move(state,direction);
  }
  return {board:state.board,score:state.score,moves:moves.length,finished:!canMove(state.board)};
}

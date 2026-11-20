import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slideLine,canMove,replayRanked2048} from '../src/ranked-2048.js';

test('2048 merges each tile at most once and scores merged values',()=>{
  assert.deepEqual(slideLine([2,2,2,2]),{line:[4,4,0,0],gained:8});
  assert.deepEqual(slideLine([4,4,8,8]),{line:[8,16,0,0],gained:24});
  assert.deepEqual(slideLine([2,0,2,4]),{line:[4,4,0,0],gained:4});
  assert.throws(()=>slideLine([2,3,0,0]),/invalid_board/);
  assert.throws(()=>slideLine([2**52,2**52,0,0]),/score_overflow/);
  assert.equal(canMove([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]),false);
  assert.equal(canMove([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,4]),true);
});

test('server replay has stable seeded output and rejects forged transcripts',()=>{
  const moves='LLULLLLLLLLLLULLLRLLULRLLULLUUULLLLLLLLLLLLLLLLLLL'.split('');
  assert.equal(moves.length,50);
  const result=replayRanked2048(123456,moves);
  assert.deepEqual(result,{board:[4,16,8,2,32,8,2,0,8,4,2,0,16,4,0,0],score:280,moves:50,finished:false});
  assert.deepEqual(replayRanked2048(123456,moves),result);
  assert.throws(()=>replayRanked2048(-1,[]),/invalid_seed/);
  assert.throws(()=>replayRanked2048(1,['wat']),/invalid_transcript/);
  assert.throws(()=>replayRanked2048(1,new Array(4097).fill('L')),/invalid_transcript/);
  assert.throws(()=>replayRanked2048(1,new Array(1)),/invalid_transcript/);
  // A transcript at the size boundary passes length validation but must still
  // reject an impossible move instead of accepting its claimed result.
  assert.throws(()=>replayRanked2048(5,new Array(4096).fill('R')),/invalid_move/);
  assert.throws(()=>replayRanked2048(5,['R']),/invalid_move/);
});

test('completed games reject any further moves',()=>{
  const directions=['L','U','R','D'],moves=[];let state=replayRanked2048(9,moves);
  for(let i=0;i<700&&!state.finished;i++){
    let next;
    for(let j=0;j<4;j++){
      const direction=directions[(i+j)%4];
      try{next=replayRanked2048(9,[...moves,direction]);moves.push(direction);break}
      catch(error){if(error.message!=='invalid_move')throw error}
    }
    assert.ok(next);state=next;
  }
  assert.equal(state.finished,true);assert.equal(moves.length,132);assert.equal(state.score,1288);
  assert.throws(()=>replayRanked2048(9,[...moves,'L']),/game_already_over/);
});

test('replay never removes tile value and leaves caller transcript unchanged',()=>{
  const directions=['L','R','U','D'];
  for(let seed=0;seed<12;seed++){
    const moves=[];let prior=replayRanked2048(seed,moves);
    for(let turn=0;turn<40&&!prior.finished;turn++){
      let next=null,chosen;
      for(const d of directions){try{next=replayRanked2048(seed,[...moves,d]);chosen=d;break}catch(e){if(e.message!=='invalid_move')throw e}}
      assert.ok(next);const sum=a=>a.reduce((x,y)=>x+y,0);
      assert.ok([2,4].includes(sum(next.board)-sum(prior.board)));
      assert.ok(next.score>=prior.score);moves.push(chosen);prior=next;
    }
    const copy=moves.slice();replayRanked2048(seed,moves);assert.deepEqual(moves,copy);
  }
});

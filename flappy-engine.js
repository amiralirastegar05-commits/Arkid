// Pure game rules. Drawing uses these same dimensions for obstacles and collision.
export const WORLD = Object.freeze({width:360,height:600,ground:552,birdX:95,birdRadius:14,pipeWidth:64,gap:168,speed:125,gravity:1050,flap:-325,spacing:230,step:1/120});
export function createGame(random=Math.random){
  const game={state:'ready',y:265,velocity:0,score:0,pipes:[],distance:0};
  function reset(){Object.assign(game,{state:'ready',y:265,velocity:0,score:0,pipes:[{x:415,center:280,passed:false}],distance:0});return game}
  function flap(){if(game.state==='ready')game.state='playing';if(game.state!=='playing')return false;game.velocity=WORLD.flap;return true}
  function pause(){if(game.state!=='playing')return false;game.state='paused';return true}
  function resume(){if(game.state!=='paused')return false;game.state='playing';return true}
  function update(dt){
    if(game.state!=='playing'||!Number.isFinite(dt)||dt<=0)return game;
    dt=Math.min(dt,.05);
    game.velocity=Math.min(game.velocity+WORLD.gravity*dt,460);game.y+=game.velocity*dt;game.distance+=WORLD.speed*dt;
    if(game.y-WORLD.birdRadius<=0||game.y+WORLD.birdRadius>=WORLD.ground){game.y=Math.max(WORLD.birdRadius,Math.min(WORLD.ground-WORLD.birdRadius,game.y));game.state='gameover';return game}
    for(const pipe of game.pipes){
      pipe.x-=WORLD.speed*dt;
      const overlaps=WORLD.birdX+WORLD.birdRadius>pipe.x&&WORLD.birdX-WORLD.birdRadius<pipe.x+WORLD.pipeWidth;
      if(overlaps&&(game.y-WORLD.birdRadius<pipe.center-WORLD.gap/2||game.y+WORLD.birdRadius>pipe.center+WORLD.gap/2)){game.state='gameover';return game}
      if(!pipe.passed&&pipe.x+WORLD.pipeWidth<WORLD.birdX-WORLD.birdRadius){pipe.passed=true;game.score++}
    }
    game.pipes=game.pipes.filter(pipe=>pipe.x+WORLD.pipeWidth>0);
    const last=game.pipes[game.pipes.length-1];
    if(!last||last.x<=WORLD.width-WORLD.spacing){
      const sample=Number(random());const n=Number.isFinite(sample)?Math.max(0,Math.min(1,sample)):.5;
      game.pipes.push({x:last?last.x+WORLD.spacing:WORLD.width+WORLD.pipeWidth,center:170+n*205,passed:false});
    }
    return game;
  }
  reset();return {game,reset,flap,pause,resume,update};
}

// Pure game rules. Drawing uses the same world dimensions for obstacles and collision.
export const WORLD = Object.freeze({width:360,height:600,ground:552,birdX:95,birdRadius:14,pipeWidth:64,gap:168,speed:125,gravity:1050,flap:-325,spacing:230,step:1/120});
export const DIFFICULTIES = Object.freeze({
  easy:Object.freeze({gap:198,speed:110,spacing:244,label:'آرام'}),
  normal:Object.freeze({gap:168,speed:125,spacing:230,label:'معمولی'}),
  hard:Object.freeze({gap:142,speed:150,spacing:212,label:'سخت'})
});
export function createGame(random=Math.random, options={}){
  const tune=DIFFICULTIES[options&&options.difficulty]||{};
  const world=Object.freeze({...WORLD,gap:tune.gap||WORLD.gap,speed:tune.speed||WORLD.speed,spacing:tune.spacing||WORLD.spacing});
  const game={state:'ready',y:265,velocity:0,score:0,pipes:[],distance:0,world,difficulty:DIFFICULTIES[options&&options.difficulty]?options.difficulty:'normal'};
  function reset(){Object.assign(game,{state:'ready',y:265,velocity:0,score:0,pipes:[{x:415,center:280,passed:false}],distance:0});return game}
  function flap(){if(game.state==='ready')game.state='playing';if(game.state!=='playing')return false;game.velocity=world.flap;return true}
  function pause(){if(game.state!=='playing')return false;game.state='paused';return true}
  function resume(){if(game.state!=='paused')return false;game.state='playing';return true}
  function update(dt){
    if(game.state!=='playing'||!Number.isFinite(dt)||dt<=0)return game;
    dt=Math.min(dt,.05);
    game.velocity=Math.min(game.velocity+world.gravity*dt,460);game.y+=game.velocity*dt;game.distance+=world.speed*dt;
    if(game.y-world.birdRadius<=0||game.y+world.birdRadius>=world.ground){game.y=Math.max(world.birdRadius,Math.min(world.ground-world.birdRadius,game.y));game.state='gameover';return game}
    for(const pipe of game.pipes){
      pipe.x-=world.speed*dt;
      const overlaps=world.birdX+world.birdRadius>pipe.x&&world.birdX-world.birdRadius<pipe.x+world.pipeWidth;
      if(overlaps&&(game.y-world.birdRadius<pipe.center-world.gap/2||game.y+world.birdRadius>pipe.center+world.gap/2)){game.state='gameover';return game}
      if(!pipe.passed&&pipe.x+world.pipeWidth<world.birdX-world.birdRadius){pipe.passed=true;game.score++}
    }
    game.pipes=game.pipes.filter(pipe=>pipe.x+world.pipeWidth>0);
    const last=game.pipes[game.pipes.length-1];
    if(!last||last.x<=world.width-world.spacing){
      const sample=Number(random());const n=Number.isFinite(sample)?Math.max(0,Math.min(1,sample)):.5;
      game.pipes.push({x:last?last.x+world.spacing:world.width+world.pipeWidth,center:170+n*205,passed:false});
    }
    return game;
  }
  reset();return {game,reset,flap,pause,resume,update};
}

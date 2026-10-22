import { THREE, TAU, v, rng, studio, pbr, lacquer, mesh, ball, tube, ring, arch, candles, pumpkin, skull, cat, spider, eyeball, cauldron, sweet } from './halloween-kit.js?v=2';
import { music, bgClock } from './lib2.js';

// Six individually composed sets share only their asset/lighting vocabulary.
const wrap = x => ((x % 1) + 1) % 1;

function graveyard(k) {
  const hero = skull(k); hero.position.set(0, 0.6, 0); hero.scale.setScalar(1.7); k.scene.add(hero);
  arch(k.scene,k,{z:-10,scale:1.12}); arch(k.scene,k,{z:-21,scale:1.35});
  const random=rng(12), graves=[];
  for(const side of [-1,1])for(let i=0;i<8;i++) {
    const g=new THREE.Group();g.position.set(side*(8+i%2*3),k.floor,-3-i*3.8);g.rotation.y=side*(-0.12+random()*0.3);k.scene.add(g);
    const h=1.6+random()*1.2;
    mesh(g,new THREE.BoxGeometry(1.3,h,0.45),k.stone,[0,h/2,0]);
    const top=mesh(g,new THREE.CylinderGeometry(0.65,0.65,0.45,32),k.stone,[0,h,0]);top.rotation.x=Math.PI/2;
    mesh(g,new THREE.BoxGeometry(0.09,0.75,0.06),k.metal,[0,h-0.4,0.26]);mesh(g,new THREE.BoxGeometry(0.5,0.09,0.06),k.metal,[0,h-0.2,0.26]); graves.push(g);
  }
  // Antique headphones make the hero a DJ relic, rather than a floating anatomy model.
  const headphones=new THREE.Group();hero.add(headphones);
  tube(headphones,[[-2.1,0.5,0],[-2.2,2.4,-0.3],[0,3.25,-0.5],[2.2,2.4,-0.3],[2.1,0.5,0]],0.16,k.black);
  for(const side of [-1,1]) {
    ball(headphones,k.black,[side*2,0.5,0],[0.4,0.8,0.65]);
    const r=ring(headphones,0.45,0.055,k.glow,[side*2.3,0.5,0]);r.rotation.y=Math.PI/2;
  }
  const candleTick=candles(k.scene,k,Array.from({length:18},(_,i)=>[(i%2?1:-1)*(4.5+(i%3)*0.65),k.floor+0.7,-1-Math.floor(i/2)*1.15]));
  const bars=[];
  for(let i=0;i<32;i++) {const b=mesh(k.scene,new THREE.BoxGeometry(0.18,1,0.25),i%3?k.glow:k.glow2,[(i-15.5)*0.3,k.floor+1.5,-5]);bars.push(b);}
  return (a,m)=>{
    hero.rotation.y=0.24*Math.sin(a);hero.rotation.z=0.035*Math.sin(a*2);hero.position.y=0.6+0.12*Math.sin(a*2);
    hero.userData.jaw.rotation.x=0.1+0.16*m.beat; candleTick(a,m.beat);
    bars.forEach((b,i)=>{const band=m.env?.[Math.floor(i/2)]??(0.15+0.5*Math.sin(a*4+i*0.5)**2);b.scale.y=0.3+2.6*band;b.position.y=k.floor+0.8+b.scale.y/2;});
  };
}

function masquerade(k) {
  const hero=cat(k);hero.scale.setScalar(1.45);hero.position.set(0,0.2,1);k.scene.add(hero);
  // The moon is a solid brass crescent, extruded with a genuinely hollow centre.
  const shape=new THREE.Shape(), R=5.4, r=4.65, d=2.05;
  const ix=(R*R-r*r+d*d)/(2*d),iy=Math.sqrt(R*R-ix*ix),outer=Math.atan2(iy,ix),inner=Math.atan2(iy,ix-d);
  shape.absarc(0,0,R,outer,TAU-outer,false);
  shape.absarc(d,0,r,-inner,inner,true);shape.closePath();
  const crescent=mesh(k.scene,new THREE.ExtrudeGeometry(shape,{depth:0.45,bevelEnabled:true,bevelSize:0.12,bevelThickness:0.12,bevelSegments:3,curveSegments:60}),k.metal,[0,1,-4]);crescent.rotation.z=-0.2;
  const halo=ring(k.scene,6.4,0.055,k.glow2,[0,1,-5]);
  // Tall fluted columns frame the cat; their capitals and bases catch the warm key.
  for(const side of [-1,1])for(let i=0;i<4;i++) {
    const x=side*(8+i*1.4),z=-4-i*5;
    mesh(k.scene,new THREE.CylinderGeometry(0.55,0.7,11,20),k.stone,[x,1,z]);
    for(let j=0;j<8;j++){const a=j/8*TAU;mesh(k.scene,new THREE.CylinderGeometry(0.055,0.055,10,6),k.metal,[x+0.56*Math.cos(a),1,z+0.56*Math.sin(a)]);}
    for(const y of [-4,6])mesh(k.scene,new THREE.BoxGeometry(1.7,0.35,1.7),k.metal,[x,y,z]);
  }
  const cards=[];
  for(let i=0;i<8;i++) {
    const g=new THREE.Group();k.scene.add(g);
    mesh(g,new THREE.BoxGeometry(1.2,1.8,0.1),k.metal);
    mesh(g,new THREE.BoxGeometry(1.05,1.65,0.12),pbr(0x201628,0.7),[0,0,0.03]);
    const r=ring(g,0.32,0.025,k.glow,[0,0.15,0.11]);r.scale.y=1.1;
    for(const side of [-1,1])mesh(g,new THREE.OctahedronGeometry(0.09),k.metal,[side*0.4,side*0.65,0.15]);
    cards.push(g);
  }
  const candleTick=candles(k.scene,k,Array.from({length:16},(_,i)=>[(i%2?1:-1)*(5+(i%4)*0.45),k.floor+0.7,-Math.floor(i/2)*1.4]));
  return(a,m)=>{
    hero.rotation.y=0.15*Math.sin(a);hero.rotation.z=0.025*Math.sin(a*2);hero.userData.tail.rotation.y=0.08*Math.sin(a*2);candleTick(a,m.beat);
    halo.rotation.z=a;halo.scale.setScalar(1+0.015*m.bass);
    cards.forEach((g,i)=>{const p=a*(i%2?1:-1)+i/8*TAU;g.position.set(7.5*Math.cos(p),1.4+3.8*Math.sin(p),-3+1.4*Math.cos(p));g.rotation.set(0.1*Math.sin(p),0.4*Math.sin(p),0.12*Math.sin(p));});
  };
}

function carnival(k) {
  const hero=pumpkin(k,3.35);hero.position.set(0,0.25,0);k.scene.add(hero);
  // A pumpkin-powered carnival wheel: chunky metal spokes and real lantern gondolas.
  const wheel=new THREE.Group();wheel.position.set(0,1,-8);k.scene.add(wheel);
  for(const r of [6.8,7.25])ring(wheel,r,0.1,k.metal);
  ring(wheel,7,0.04,k.glow2);
  const lanterns=[];
  for(let i=0;i<12;i++) {
    const a=i/12*TAU;tube(wheel,[[0,0,0],[6.8*Math.cos(a),6.8*Math.sin(a),0]],0.055,k.metal,false,8);
    const g=new THREE.Group();g.position.set(7*Math.cos(a),7*Math.sin(a),0);wheel.add(g);
    tube(g,[[0,0,0],[0,-0.7,0]],0.035,k.metal,false,6);
    const p=pumpkin(k,0.6);p.position.y=-1.1;g.add(p);lanterns.push(g);
  }
  for(const side of [-1,1]) {
    const g=new THREE.Group();g.position.set(side*12,k.floor,-12);k.scene.add(g);
    mesh(g,new THREE.CylinderGeometry(3.3,3.3,5,12),pbr(side<0?0x4c183b:0x213342,0.7),[0,2.5,0]);
    mesh(g,new THREE.ConeGeometry(4,3,12),pbr(0x7e3319,0.6),[0,6.5,0]);
    for(let j=0;j<12;j++){const a=j/12*TAU;tube(g,[[0,8,0],[3.9*Math.cos(a),5,3.9*Math.sin(a)]],0.035,k.glow2,false,8);}
    mesh(g,new THREE.CylinderGeometry(0.06,0.06,2,8),k.metal,[0,9,0]);
  }
  const little=[];for(const side of [-1,1])for(let i=0;i<5;i++){const p=pumpkin(k,0.65+(i%2)*0.25);p.position.set(side*(5.5+i*1.3),k.floor+1,-i*2);p.rotation.y=-side*0.2;k.scene.add(p);little.push(p);}
  const bulbs=[];for(let j=0;j<41;j++){const x=(j-20)*0.85,y=7-2*Math.sin(j/40*Math.PI);bulbs.push(ball(k.scene,j%2?k.glow:k.glow2,[x,y,-3],[0.1,0.13,0.1]));}
  tube(k.scene,bulbs.map(b=>b.position.clone()),0.025,k.black);
  return(a,m)=>{hero.rotation.y=0.23*Math.sin(a);hero.position.y=0.25+0.14*Math.sin(a*2)+0.05*m.beat;hero.userData.fire.emissiveIntensity=2.1+0.7*m.beat;wheel.rotation.z=a;lanterns.forEach(g=>{g.rotation.z=-a+0.08*Math.sin(a*2);});bulbs.forEach((b,i)=>{const s=0.8+0.3*Math.sin(a*4-i*0.5)+0.25*m.beat;b.scale.set(0.1*s,0.13*s,0.1*s);});little.forEach((p,i)=>p.rotation.z=0.03*Math.sin(a*2+i));};
}

function web(k) {
  const hero=spider(k);hero.scale.setScalar(1.25);hero.position.set(0,1,1);k.scene.add(hero);
  arch(k.scene,k,{z:-9,scale:1.15});arch(k.scene,k,{z:-19,scale:1.4});
  // Slack strands have thickness, specular highlights, and depth between anchors.
  const silk=pbr(0xb9a0c8,0.28,0.55), web=new THREE.Group();web.position.set(0,1,-3);k.scene.add(web);
  for(let j=0;j<16;j++){
    const a=j/16*TAU;tube(web,[[0,0,0],[5*Math.cos(a),4*Math.sin(a),-0.4],[12*Math.cos(a),9*Math.sin(a),-1]],0.018,silk,false,16);
  }
  for(let i=1;i<=8;i++)for(let j=0;j<16;j++){
    const a=j/16*TAU,b=(j+1)/16*TAU,r=i*1.35;
    tube(web,[[r*Math.cos(a),r*0.75*Math.sin(a),-0.05*i],[(r-0.14)*Math.cos((a+b)/2),(r-0.14)*0.75*Math.sin((a+b)/2),-0.2-0.05*i],[r*Math.cos(b),r*0.75*Math.sin(b),-0.05*i]],0.013,silk,false,8);
  }
  tube(k.scene,[[0,12,-1],[0,3.2,0]],0.025,silk,false,8);
  const drops=[];
  for(let i=0;i<42;i++){const a=i*2.39996,r=3+(i%7)*1.1;drops.push(ball(web,lacquer(0xaac3e1,{roughness:0.1,metalness:0.25}),[r*Math.cos(a),r*0.75*Math.sin(a),-0.15],[0.045,0.065,0.045]));}
  const eggs=[];for(const side of [-1,1])for(let i=0;i<4;i++){const e=ball(k.scene,pbr(0x908394,0.8),[side*(7+i*0.7),k.floor+0.5,-1-i*2],[0.45,0.6,0.45]);eggs.push(e);}
  const candleTick=candles(k.scene,k,[[-5,k.floor+0.7,2],[5,k.floor+0.7,2],[-6,k.floor+0.7,-4],[6,k.floor+0.7,-4]]);
  return(a,m)=>{
    hero.position.set(0.7*Math.sin(a),1+0.3*Math.cos(a*2),1);hero.rotation.y=0.15*Math.sin(a);hero.rotation.z=0.06*Math.sin(a*2);
    hero.userData.legs.forEach((g,i)=>{g.rotation.z=0.04*Math.sin(a*4+i)+0.045*(i%2?1:-1)*m.beat;});web.rotation.z=0.025*Math.sin(a);candleTick(a,m.beat);
  };
}

function observatory(k) {
  const eye=eyeball(k);eye.scale.setScalar(3.2);eye.position.set(0,0.8,1);k.scene.add(eye);
  const rig=new THREE.Group();rig.position.set(0,0.8,0);k.scene.add(rig);
  const orbits=[];
  for(let i=0;i<3;i++){
    const g=new THREE.Group();g.rotation.set(i*0.7+0.2,i*0.55,0);rig.add(g);
    ring(g,4.5+i*0.5,0.1,k.metal);ring(g,4.65+i*0.5,0.025,i%2?k.glow:k.glow2);
    for(let j=0;j<36;j++){const a=j/36*TAU;const mark=mesh(g,new THREE.BoxGeometry(j%3?0.04:0.07,j%3?0.12:0.3,0.06),k.metal,[(4.5+i*0.5)*Math.cos(a),(4.5+i*0.5)*Math.sin(a),0.12]);mark.rotation.z=a-Math.PI/2;}
    orbits.push(g);
  }
  // Thick mechanical cradle and pedestal, instead of floating concentric outlines.
  for(const side of [-1,1])tube(k.scene,[[side*5.7,1,0],[side*5,-2.3,0],[side*2,-3.1,0],[0,-3.4,0]],0.22,k.metal);
  mesh(k.scene,new THREE.CylinderGeometry(1.5,2,0.6,48),k.black,[0,-3.5,0]);
  arch(k.scene,k,{z:-15,scale:1.4});
  const satellites=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const g=eyeball(k,i%2?'#b181cb':'#c6a64d');g.scale.setScalar(0.6+i*0.12);k.scene.add(g);satellites.push({g,side,i});
    const column=mesh(k.scene,new THREE.CylinderGeometry(0.5,0.75,2.5+i,16),k.stone,[side*(8+i*2),k.floor+1.25+i*0.5,-3-i*4]);
    ring(k.scene,0.55,0.04,k.glow2,[column.position.x,column.position.y+1.4+i*0.5,column.position.z]).rotation.x=Math.PI/2;
  }
  return(a,m)=>{
    eye.rotation.set(0.12*Math.sin(a*2),0.25*Math.sin(a),0);eye.scale.setScalar(3.2+0.03*m.bass);
    orbits.forEach((g,i)=>{g.rotation.set(0.25+i*0.7+0.18*Math.sin(a+i),i*0.55+0.25*Math.cos(a+i),a*(i%2?-1:1));});
    satellites.forEach(({g,side,i})=>{g.position.set(side*(8+i*2),-0.8+i*0.9+0.2*Math.sin(a+i),-3-i*4);g.lookAt(v(Math.sin(a)*4,1,25));});
  };
}

function candy(k) {
  const pot=cauldron(k);pot.scale.setScalar(1.5);pot.position.set(0,-1.2,0);k.scene.add(pot);
  const sweets=[],random=rng(93);
  for(let i=0;i<54;i++){
    const g=sweet(k,i),phase=random(),size=0.55+random()*0.5;k.scene.add(g);sweets.push({g,phase,size,i});
  }
  // Real stalls and striped roofs anchor the candy tornado in a haunted sweet shop.
  for(const side of [-1,1]){
    const g=new THREE.Group();g.position.set(side*10,k.floor,-7);k.scene.add(g);
    mesh(g,new THREE.BoxGeometry(5,3.5,2.6),pbr(0x341c32,0.6),[0,1.75,0]);
    mesh(g,new THREE.BoxGeometry(4.4,2.6,0.16),k.black,[0,2.0,1.4]);
    for(let j=0;j<7;j++){const m=mesh(g,new THREE.BoxGeometry(0.7,0.16,4),j%2?lacquer(0xd47f3c):lacquer(0x542255),[(j-3)*0.7,4,0.7]);m.rotation.x=0.12;}
    for(let j=0;j<4;j++){const p=pumpkin(k,0.4);p.position.set((j-1.5)*1.1,1.65,1.7);g.add(p);}
    for(const s of [-1,1])mesh(g,new THREE.CylinderGeometry(0.08,0.08,5.7,10),k.metal,[s*2.4,2.8,1.3]);
  }
  const bubbles=[];for(let i=0;i<14;i++)bubbles.push(ball(k.scene,lacquer(0x8dbb50,{roughness:0.1,metalness:0.15,clearcoat:1}),[0,0,0],[0.1,0.1,0.1]));
  const back=ring(k.scene,6,0.09,k.metal,[0,1,-7]);ring(k.scene,6.15,0.035,k.glow2,[0,1,-7]);
  const candleTick=candles(k.scene,k,[[-5,k.floor+0.7,1],[5,k.floor+0.7,1],[-6,k.floor+0.7,-2],[6,k.floor+0.7,-2]]);
  return(a,m,t)=>{
    pot.rotation.y=0.12*Math.sin(a);back.rotation.y=0.1*Math.sin(a);
    sweets.forEach(({g,phase,size,i})=>{
      // Fade by scale at the loop boundary: each sweet emerges from the pot,
      // spirals out in 3D, and disappears before returning to the source.
      const u=wrap(t+phase),p=u*TAU*2+i*2.39996,r=0.7+7.8*u;
      g.position.set(Math.cos(p)*r,-0.1+6.2*u+0.55*Math.sin(p),Math.sin(p)*r*0.55-0.7);
      g.rotation.set(a*2+i,p,a+i);g.scale.setScalar(size*Math.sin(Math.PI*u)**0.5*(1+0.05*m.beat));
    });
    bubbles.forEach((b,i)=>{const u=wrap(t*2+i/14),p=i*2.39996;b.position.set(Math.cos(p)*(0.6+u),0.3+u*4,Math.sin(p)*1.2);b.scale.setScalar(0.22*Math.sin(Math.PI*u));});candleTick(a,m.beat);
  };
}

const SETS = {
  graveyard: { accent:0x48cfa1,secondary:0x7152e5,bg:0x070c16,build:graveyard },
  masquerade: { accent:0xe9a147,secondary:0x9350e0,bg:0x100716,build:masquerade },
  carnival: { accent:0xf88623,secondary:0x9b38c8,bg:0x16080c,build:carnival },
  web: { accent:0xd35266,secondary:0x8154c8,bg:0x0b0813,build:web },
  observatory: { accent:0x47d0b7,secondary:0x8c5ac4,bg:0x061114,build:observatory },
  candy: { accent:0xf0a04a,secondary:0xb94ac9,bg:0x140819,build:candy },
};

export const cinemaScene = name => async(st,C) => {
  const cfg=SETS[name];if(!cfg)throw new Error('Unknown Halloween set: '+name);
  const k=studio(st,C,cfg),tick=cfg.build(k),clock=bgClock();
  return { update(t) {
    const bg=clock(t),a=TAU*bg,m=music(t);k.tick(wrap(bg),m);tick(a,m,bg);
    st.camera.position.set(3.2*Math.sin(a),2+0.4*Math.cos(a*2),26+0.6*Math.sin(a*2));
    st.camera.lookAt(0,0.7,-1);
  } };
};

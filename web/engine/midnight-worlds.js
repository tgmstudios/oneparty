import { THREE, TAU, makeEnv, extrudeText, rng } from './lib.js';
import { particles, haze, music, bgClock, brickTexture } from './lib2.js';
import { v, pbr, lacquer, emission, mesh, ball, tube, ring, extrude, pumpkin, skull } from './halloween-kit.js';

// Independent worlds: only lighting/model primitives are shared, never a stage layout.
const wrap = x => ((x % 1) + 1) % 1;
const band = (m, i, a) => m.env?.[i % 16] ?? m.bands?.[i % 16] ?? (0.16 + 0.5 * Math.sin(a * 4 + i * 0.7) ** 2) * (0.3 + m.level);
function rig(st, { bg, warm, cool, fog = 0.012 }) {
  const { scene, renderer } = st;
  scene.background = new THREE.Color(bg); scene.fog = new THREE.FogExp2(bg, fog);
  scene.environment = makeEnv(renderer, [
    { w: 25, h: 9, c: warm, i: 2.4, pos: [-8, 14, 12] },
    { w: 6, h: 28, c: cool, i: 2.5, pos: [18, 7, -4] },
    { w: 18, h: 8, c: 0xc3d6ef, i: 1.4, pos: [0, 10, -20] },
  ], bg); scene.environmentIntensity = 0.65;
  scene.add(new THREE.HemisphereLight(0xc5d5ec, bg, 0.65));
  const key = new THREE.DirectionalLight(warm, 3); key.position.set(-9, 16, 10); scene.add(key);
  const rim = new THREE.DirectionalLight(cool, 3.2); rim.position.set(9, 9, -10); scene.add(rim);
  const fill = new THREE.PointLight(warm, 170, 65, 1.35); fill.position.set(-7, 4, 12); scene.add(fill);
  const edge = new THREE.PointLight(cool, 100, 60, 1.4); edge.position.set(10, 4, 6); scene.add(edge);
  st.camera.fov = 37; st.camera.updateProjectionMatrix();
  st.bloom.strength = 0.34; st.bloom.radius = 0.55; st.bloom.threshold = 1.05;
  return { scene, metal: pbr(0x9d794b, 0.3, 0.85), dark: pbr(0x171720, 0.5, 0.4), stone: pbr(0x41404a, 0.85), glow: emission(warm, 2.2), glow2: emission(cool, 2.4) };
}
function lettering(parent, C, text, width, material, pos, size = 1) {
  const g = extrudeText(C.fonts.block, text, { size, track: 0.08, targetWidth: width, depth: 0.22, bevel: 0.035, material }).group;
  const height = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y;
  if (height > size * 1.4) g.scale.multiplyScalar(size * 1.4 / height);
  g.position.set(...pos); parent.add(g); return g;
}
function motes(k, C, color, center, box, count = 180) {
  const p = particles({ count, seed: 293, box, center, color, size: 0.055, travel: 14, sway: 0.8, opacity: 0.65, H: C.H }); k.scene.add(p); return p;
}
function loop(st, tick, camera) {
  const clock = bgClock(); return { update(t) { const bg = clock(t), a = TAU * bg, m = music(t); tick(a, m, bg); camera(a, m); } };
}
function ghost(parent, mat, size = 1) {
  const g = new THREE.Group();
  const profile = [[0,1.2],[0.45,1.07],[0.8,0.75],[0.94,0.3],[0.97,-0.25],[1.06,-0.8],[1.22,-1.1],[0.9,-0.92],[0,-0.85]].map(([r,y])=>new THREE.Vector2(r,y));
  const geo = new THREE.LatheGeometry(profile,48), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const skirt = Math.max(0, -y - 0.4); p.setXYZ(i, x, y - 0.24 * Math.cos(a * 6) * skirt, z);
  }
  geo.computeVertexNormals(); mesh(g, geo, mat);
  const black = pbr(0x0b1820, 0.7);
  for (const x of [-0.3, 0.3]) ball(g, black, [x, 0.22, 0.91], [0.13, 0.2, 0.06]);
  ball(g, black, [0, -0.2, 0.98], [0.13, 0.18, 0.06]);
  g.scale.setScalar(size); parent.add(g); return g;
}

export async function ghostShip(st, C) {
  const k = rig(st, { bg: 0x030e1a, warm: 0x8fc8c7, cool: 0x276dbe, fog: 0.009 });
  const seaGeo = new THREE.PlaneGeometry(170, 150, 100, 80); seaGeo.rotateX(-Math.PI / 2);
  const sea = mesh(k.scene, seaGeo, lacquer(0x052f43, { roughness: 0.42, metalness: 0.08, clearcoat: 0.35 }), [0, -3.5, -30]);
  const base = seaGeo.attributes.position.array.slice(), p = seaGeo.attributes.position;
  const ship = new THREE.Group(); ship.position.set(-1, -1.4, 0); ship.rotation.y = -0.23; k.scene.add(ship);
  const timber = pbr(0x49322a, 0.65), trim = pbr(0x8f8b62, 0.38, 0.7);
  // Long pointed hull with raised bow and stern, visible deck and plank seams.
  const hull = extrude(ship, [[-9,0],[-7,-2.1],[-3,-2.7],[5,-2.4],[8,-1],[9,1],[6,0.4],[-5,0.4],[-8,1.6]], 3.3, timber, 0.22); hull.position.z = -1.65;
  mesh(ship, new THREE.BoxGeometry(14, 0.18, 3.2), timber, [0, 0.35, 0]);
  for (let j = 0; j < 4; j++) tube(ship, [[-8,0.7-j*0.55,1.8],[-4,-j*0.55,1.85],[4,-j*0.55,1.85],[8,0.4-j*0.35,1.5]], 0.035, trim);
  const windows = [];
  for (let i = 0; i < 10; i++) { const x = (i - 4.5) * 1.25; ring(ship, 0.22, 0.055, trim, [x, -0.7, 1.85]); windows.push(ball(ship, k.glow2.clone(), [x, -0.7, 1.83], [0.17,0.17,0.06])); }
  const sails = [];
  for (let j = 0; j < 3; j++) {
    const x = (j - 1) * 4.4, h = j === 1 ? 11 : 8.8;
    mesh(ship, new THREE.CylinderGeometry(0.09, 0.18, h, 12), timber, [x, h / 2, 0]);
    for (let r = 0; r < 2; r++) {
      const y = h - 2 - r * 3, width = j === 1 ? 4.4 : 3.7;
      mesh(ship, new THREE.CylinderGeometry(0.065,0.065,width+0.8,8), trim, [x,y+1.3,0]).rotation.z = Math.PI/2;
      const geo = new THREE.PlaneGeometry(width,2.5,16,10), pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const sx=pos.getX(i),sy=pos.getY(i);pos.setZ(i,0.65*Math.sin((sx/width+0.5)*Math.PI)*Math.cos(sy/2.5));if(sy< -1.2)pos.setY(i,sy+0.2*Math.sin(sx*7));}geo.computeVertexNormals();
      const sail=mesh(ship,geo,new THREE.MeshStandardMaterial({color:0x9db6ac,roughness:0.9,side:THREE.DoubleSide,emissive:0x216e65,emissiveIntensity:0.16}),[x,y,0.15]);sails.push(sail);
    }
    for(const side of [-1,1])tube(ship,[[x,h-0.5,0],[x+side*2.6,0.5,side*1.4]],0.026,trim,false,8);
  }
  const emblem=skull(k);emblem.scale.setScalar(0.5);emblem.position.set(0,7.6,0.95);ship.add(emblem);
  lettering(ship,C,(C.event.title||'HALLOWEEN').toUpperCase(),8,trim,[-0.5,-1.5,1.9]);
  const moon=ball(k.scene,emission(0xacc8c6,0.4),[25,12,-65],[7,7,2]);
  const craters=pbr(0x839d9d,0.9);for(let i=0;i<20;i++){const a=i*2.39996,r=0.15+0.65*((i*13)%19)/19;const c=ball(moon,craters,[Math.cos(a)*r,Math.sin(a)*r,Math.sqrt(1-r*r)],[0.035+(i%3)*0.015,0.025+(i%3)*0.015,0.008]);}
  const fog=haze(0x307a98,85,0.12,[0,-0.5,-50]);k.scene.add(fog);
  const crew=[];for(let i=0;i<5;i++){const g=ghost(ship,lacquer(0x9de2cd,{emissive:0x278e7f,emissiveIntensity:0.3}),0.55);g.position.set((i-2)*2.5,1.2,1);crew.push(g);}
  const spray=motes(k,C,0x90e7e6,[0,0,-10],[55,12,35],220);
  return loop(st,(a,m,bg)=>{
    for(let i=0;i<p.count;i++){const x=base[i*3],z=base[i*3+2];p.setY(i,0.38*Math.sin(x*0.22+z*0.12+a*2)+0.22*Math.cos(z*0.4-a*3)+0.08*m.bass*Math.sin(x*0.6+a*4));}p.needsUpdate=true;seaGeo.computeVertexNormals();
    ship.rotation.z=0.045*Math.sin(a*2)+0.02*m.bass;ship.rotation.x=0.035*Math.cos(a);ship.position.y=-1.1+0.25*Math.sin(a*2);
    sails.forEach((s,i)=>s.rotation.y=0.08*Math.sin(a*2+i)+0.035*m.beat);crew.forEach((g,i)=>g.position.y=1.2+0.22*Math.sin(a*4+i)+0.15*band(m,i*3,a));
    windows.forEach((w,i)=>w.material.emissiveIntensity=1.6+1.2*band(m,i,a));spray.userData.u.uT.value=wrap(bg);
  },a=>{st.camera.position.set(0,6+Math.cos(a),27);st.camera.lookAt(0,2,0);});
}

export async function phantomOrgan(st, C) {
  const k=rig(st,{bg:0x0b0714,warm:0xd0a25e,cool:0x7644cc,fog:0.015});
  const stoneTex=brickTexture({base:[45,38,56],rows:12,cols:7});k.stone.map=stoneTex;
  mesh(k.scene,new THREE.PlaneGeometry(100,110),pbr(0x211d29,0.5),[0,-4.2,-25]).rotation.x=-Math.PI/2;
  mesh(k.scene,new THREE.BoxGeometry(60,30,1),k.stone,[0,10,-18]);
  const pipes=[],brass=pbr(0xbaa781,0.26,0.9);
  for(let i=0;i<35;i++) {
    const x=(i-17)*0.61,h=4+8*(0.5+0.5*Math.cos((i-17)/17*Math.PI));
    mesh(k.scene,new THREE.CylinderGeometry(0.23,0.23,h,20),brass,[x,h/2-2,-6]);
    mesh(k.scene,new THREE.CylinderGeometry(0.19,0.19,0.4,20),k.dark,[x,h-1.95,-6]);
    mesh(k.scene,new THREE.BoxGeometry(0.23,0.5,0.04),k.dark,[x,-0.4,-5.76]);
    const light=mesh(k.scene,new THREE.BoxGeometry(0.12,0.37,0.05),emission(0x8150cb,1.5),[x,-0.4,-5.72]);pipes.push(light);
  }
  const organ=mesh(k.scene,new THREE.BoxGeometry(15,2.2,3.7),pbr(0x351e1b,0.45),[0,-2.4,-1]);
  for(let j=0;j<3;j++)mesh(k.scene,new THREE.BoxGeometry(15.4,0.12,3.8),k.metal,[0,-3.3+j*0.8,-1]);
  const keys=[];for(let r=0;r<2;r++)for(let i=0;i<36;i++){
    const g=new THREE.Group();g.position.set((i-17.5)*0.37,-0.65+r*0.35,0.3-r*0.65);k.scene.add(g);
    mesh(g,new THREE.BoxGeometry(0.34,0.13,1.05),pbr(0xe4d5ba,0.3),[0,0,0.5]);if(![2,6].includes(i%7))mesh(g,new THREE.BoxGeometry(0.18,0.15,0.57),k.dark,[0.18,0.14,0.2]);keys.push(g);
  }
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const x=side*(13+i*2.7),z=-6-i*4;
    mesh(k.scene,new THREE.CylinderGeometry(0.65,0.85,22,12),k.stone,[x,6,z]);
    tube(k.scene,[[x,-4,z],[x,10,z],[side*8,16,z],[0,19,z]],0.22,k.stone);
  }
  const glassMat=emission(0xc44783,0.75);const window=ring(k.scene,5.4,0.2,k.metal,[0,9,-16.9]);
  for(let i=0;i<12;i++){const a=i/12*TAU;const petal=mesh(k.scene,new THREE.CircleGeometry(1.9,6),glassMat,[3.4*Math.cos(a),9+3.4*Math.sin(a),-16.8]);petal.rotation.z=a;}
  ring(k.scene,2,0.12,k.metal,[0,9,-16.6]);
  const spirits=[];for(let i=0;i<5;i++)spirits.push(ghost(k.scene,lacquer(0xa18cc7,{emissive:0x573782,emissiveIntensity:0.25}),0.6));
  lettering(k.scene,C,(C.event.title||'HALLOWEEN').toUpperCase(),10,k.metal,[0,-2.4,0.95]);
  const dust=motes(k,C,0xd4b885,[0,6,-8],[38,28,30]);
  return loop(st,(a,m,bg)=>{keys.forEach((g,i)=>g.rotation.x=-0.17*band(m,i,a));pipes.forEach((p,i)=>{const e=band(m,i,a);p.material.emissiveIntensity=0.8+3*e;p.scale.y=1+8*e;p.position.y=-0.6+0.185*p.scale.y;});spirits.forEach((g,i)=>{const p=a+i/5*TAU;g.position.set(9*Math.cos(p),3+2*Math.sin(p*2),-3+2*Math.sin(p));g.rotation.y=-0.2*Math.sin(p);});glassMat.emissiveIntensity=0.6+0.5*m.bass;dust.userData.u.uT.value=wrap(bg);},a=>{st.camera.position.set(0,2+0.8*Math.cos(a),25);st.camera.lookAt(0,3,-5);});
}

export async function pumpkinEncounter(st,C) {
  const k=rig(st,{bg:0x030b14,warm:0x9adea3,cool:0x5176b8,fog:0.009});
  const groundGeo=new THREE.PlaneGeometry(350,350,70,50);groundGeo.rotateX(-Math.PI/2);const gp=groundGeo.attributes.position;
  for(let i=0;i<gp.count;i++)gp.setY(i,0.18*Math.sin(gp.getX(i)*0.2)*Math.cos(gp.getZ(i)*0.2));groundGeo.computeVertexNormals();mesh(k.scene,groundGeo,pbr(0x15241a,0.95),[0,-4,-30]);
  const saucer=new THREE.Group();saucer.position.set(0,8,-4);k.scene.add(saucer);
  const profile=[[0,0.7],[2,0.7],[4,0.25],[5.5,-0.2],[5.7,-0.4],[4,-0.8],[2,-1],[0,-0.8]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(saucer,new THREE.LatheGeometry(profile,96),pbr(0x7b8993,0.22,0.95));
  ball(saucer,lacquer(0x19504b,{metalness:0.5,roughness:0.12}),[0,0.7,0],[2.3,1.2,2.3]);
  const lamps=[];for(let i=0;i<24;i++){const a=i/24*TAU;lamps.push(ball(saucer,emission(i%3?0x7affbc:0xffa65a,2),[5.25*Math.cos(a),-0.35,5.25*Math.sin(a)],[0.14,0.1,0.14]));}
  // Layered transparent cone sides form a readable tractor beam without hiding its cargo.
  const beamMat=new THREE.MeshBasicMaterial({color:0x5affad,transparent:true,opacity:0.065,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const beam=mesh(k.scene,new THREE.CylinderGeometry(1.8,4.5,11,64,1,true),beamMat,[0,1.5,-4]);
  const beams=[];for(let i=0;i<12;i++){const r=ring(k.scene,1,0.025,k.glow,[0,0,-4]);r.rotation.x=Math.PI/2;beams.push(r);}
  const cargo=[];for(let i=0;i<7;i++){const p=pumpkin(k,0.5+(i%3)*0.12);k.scene.add(p);cargo.push(p);}
  for(const side of [-1,1])for(let i=0;i<14;i++){const p=pumpkin(k,0.5+(i%3)*0.17);p.position.set(side*(6+i%4*2.4),-3.4,-i*2);p.rotation.y=i*0.7;k.scene.add(p);}
  // Crooked barn and fence form an asymmetric rural silhouette.
  const barn=new THREE.Group();barn.position.set(-17,-4,-22);barn.rotation.y=0.25;k.scene.add(barn);
  mesh(barn,new THREE.BoxGeometry(7,6,6),pbr(0x492827,0.9),[0,3,0]);const roof=extrude(barn,[[-4,6],[0,9],[4,6]],7,pbr(0x252a34,0.8));roof.position.z=-3.5;
  mesh(barn,new THREE.BoxGeometry(2.5,4,0.1),k.dark,[0,2,3.1]);mesh(barn,new THREE.BoxGeometry(0.08,4,0.12),k.metal,[0,2,3.2]);
  // A ranch gate sign gives the pumpkin field a Dawghouse name within the alien encounter.
  const fieldSign=new THREE.Group();fieldSign.position.set(0,-1.8,3.2);k.scene.add(fieldSign);
  mesh(fieldSign,new THREE.BoxGeometry(4.4,1.25,0.22),pbr(0x17241e,0.72,0.12),[0,0,0]);
  for(const x of [-1.95,1.95])mesh(fieldSign,new THREE.BoxGeometry(0.16,2.35,0.2),pbr(0x57402c,0.82),[x,-1.15,0]);
  const fieldWord=lettering(fieldSign,C,'DAWGHOUSE',3.6,emission(0x7affbc,1.5),[0,0,0.15],0.88);
  const fieldWordBase=fieldWord.scale.clone();
  for(const x of [-2.1,2.1])ball(fieldSign,emission(0xffa65a,1.5),[x,0,0.16],[0.075,0.075,0.05]);
  for(let i=0;i<18;i++){const x=(i-9)*2.4;mesh(k.scene,new THREE.BoxGeometry(0.15,1.8,0.15),pbr(0x51452f,0.9),[x,-3.2,-13]);}for(const y of [-3.3,-2.5])mesh(k.scene,new THREE.BoxGeometry(44,0.13,0.15),pbr(0x51452f,0.9),[0,y,-13]);
  const stars=motes(k,C,0x9acdb7,[0,14,-40],[110,42,50],260);
  return loop(st,(a,m,bg)=>{saucer.position.set(0.8*Math.sin(a),8+0.3*Math.cos(a*2),-4);saucer.rotation.set(0.07*Math.sin(a),a,0.05*Math.cos(a));const pulse=1+0.025*m.beat;fieldWord.scale.set(fieldWordBase.x*pulse,fieldWordBase.y*pulse,fieldWordBase.z*pulse);beam.position.x=saucer.position.x;beamMat.opacity=0.04+0.025*(m.kick??m.beat);lamps.forEach((l,i)=>l.material.emissiveIntensity=1.5+2*band(m,i,a));
    cargo.forEach((p,i)=>{const u=wrap(bg+i/7),th=a*2+i*2.4;p.position.set(saucer.position.x+Math.cos(th)*(1.5-u),-3+u*10,-4+Math.sin(th)*(1.5-u));p.rotation.set(0.3*Math.sin(th),th,0.1*Math.sin(th));p.scale.setScalar((0.5+(i%3)*0.12)*Math.sin(Math.PI*u)**0.3);});
    beams.forEach((r,i)=>{const u=wrap(bg*2+i/12);r.position.set(saucer.position.x,-3.8+u*11,-4);r.scale.setScalar(4.5-u*2.7);r.material.emissiveIntensity=1.2+0.35*m.bass;});stars.userData.u.uT.value=wrap(bg);
  },a=>{st.camera.position.set(0,5.5,26+2*Math.cos(a));st.camera.lookAt(0,2,-5);});
}

export async function midnightClock(st,C) {
  const k=rig(st,{bg:0x100913,warm:0xdfa35a,cool:0x885291,fog:0.008});
  const clock=new THREE.Group();clock.rotation.y=-0.08;k.scene.add(clock);
  const wood=pbr(0x3c2224,0.48),face=pbr(0xd6c2a2,0.6),black=pbr(0x21171d,0.6);
  // A towering clock case, with open machinery below its enamel face.
  mesh(clock,new THREE.BoxGeometry(8,0.7,3),wood,[0,-4.2,0]);mesh(clock,new THREE.BoxGeometry(7.3,0.5,3.2),k.metal,[0,8.7,0]);
  for(const side of [-1,1]){mesh(clock,new THREE.BoxGeometry(0.7,13,2.7),wood,[side*3.3,2,0]);mesh(clock,new THREE.CylinderGeometry(0.2,0.3,12,16),k.metal,[side*3.1,2,1.55]);}
  const faceMesh=mesh(clock,new THREE.CylinderGeometry(3.1,3.1,0.35,96),face,[0,5,1.3]);faceMesh.rotation.x=Math.PI/2;ring(clock,3.25,0.16,k.metal,[0,5,1.55]);
  const roman=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  for(let i=0;i<12;i++){const a=i/12*TAU;lettering(clock,C,roman[i],i===0?0.85:0.6,black,[2.5*Math.sin(a),5+2.5*Math.cos(a),1.52],0.4);}
  const hands=[];for(const [length,width] of [[1.6,0.15],[2.2,0.09]]){const g=new THREE.Group();g.position.set(0,5,1.8);mesh(g,new THREE.BoxGeometry(width,length,0.06),black,[0,length/2,0]);clock.add(g);hands.push(g);}ball(clock,k.metal,[0,5,1.9],[0.19,0.19,0.1]);
  const pendulum=new THREE.Group();pendulum.position.set(0,2,0.9);clock.add(pendulum);mesh(pendulum,new THREE.CylinderGeometry(0.045,0.045,4.4,12),k.metal,[0,-2.2,0]);
  const bob=mesh(pendulum,new THREE.CylinderGeometry(0.85,0.85,0.2,48),k.metal,[0,-4.25,0]);bob.rotation.x=Math.PI/2;ring(pendulum,0.65,0.035,k.glow,[0,-4.25,0.13]);
  const gears=[];for(let i=0;i<11;i++){
    const g=new THREE.Group(),r=0.4+(i%3)*0.17;g.position.set((i%3-1)*1.75,-2.7+Math.floor(i/3)*1.3,0.3);clock.add(g);ring(g,r,0.12,k.metal);
    for(let j=0;j<12;j++){const a=j/12*TAU;const tooth=mesh(g,new THREE.BoxGeometry(0.17,0.28,0.16),k.metal,[r*Math.cos(a),r*Math.sin(a),0]);tooth.rotation.z=a-Math.PI/2;}
    for(let j=0;j<4;j++){const spoke=mesh(g,new THREE.BoxGeometry(r*1.9,0.08,0.12),k.metal);spoke.rotation.z=j*Math.PI/4;}gears.push(g);
  }
  const clouds=[];for(let i=0;i<8;i++){const c=haze(i%2?0x924c80:0xc68c46,40,0.07,[(i-3.5)*9,7+(i%3)*3,-20-i%3*7]);k.scene.add(c);clouds.push(c);}
  const floats=[];for(let i=0;i<14;i++){const g=new THREE.Group();g.position.set((i%2?1:-1)*(7+(i%4)*2),-4+(i%7)*2.3,-5-(i%3)*4);k.scene.add(g);ring(g,0.7+(i%3)*0.2,0.08,k.metal);for(let j=0;j<8;j++){const a=j/8*TAU;const b=mesh(g,new THREE.BoxGeometry(0.15,0.3,0.1),k.metal,[(0.7+(i%3)*0.2)*Math.cos(a),(0.7+(i%3)*0.2)*Math.sin(a),0]);b.rotation.z=a;}floats.push(g);}
  mesh(clock,new THREE.BoxGeometry(6.4,1.05,0.16),black,[0,8.7,1.68]);
  lettering(clock,C,'DAWGHOUSE',5,k.metal,[0,8.7,1.78]);
  const dust=motes(k,C,0xdbaa71,[0,5,-10],[65,32,40]);
  return loop(st,(a,m,bg)=>{hands[0].rotation.z=-a;hands[1].rotation.z=-a*12;pendulum.rotation.z=0.28*Math.sin(a*8)*(1+0.15*m.bass);gears.forEach((g,i)=>g.rotation.z=(i%2?1:-1)*(a*(i%3+1)+0.08*(m.snare??m.beat)));floats.forEach((g,i)=>{g.rotation.z=a*(i%2?1:-1);g.position.y=-4+(i%7)*2.3+0.3*Math.sin(a*2+i);});dust.userData.u.uT.value=wrap(bg);},a=>{st.camera.position.set(0,3.2,28+Math.cos(a)*2);st.camera.lookAt(0,2.4,0);});
}

export async function ghostCarousel(st,C) {
  const k=rig(st,{bg:0x130b1d,warm:0xf2ad61,cool:0xb94b93,fog:0.012});
  mesh(k.scene,new THREE.PlaneGeometry(240,300),pbr(0x262030,0.7),[0,-4.1,-25]).rotation.x=-Math.PI/2;
  const ride=new THREE.Group();ride.position.set(0,-3.8,-2);k.scene.add(ride);
  mesh(ride,new THREE.CylinderGeometry(8,8.5,0.7,96),pbr(0x612942,0.4),[0,0,0]);
  for(const y of [0.35,8.5]){const r=ring(ride,8.1,0.12,k.metal,[0,y,0]);r.rotation.x=Math.PI/2;}
  mesh(ride,new THREE.CylinderGeometry(0.55,0.75,10,24),k.metal,[0,4.5,0]);
  const cream=lacquer(0xd4aa76,{roughness:0.5}),purple=lacquer(0x662f5c,{roughness:0.5});
  for(let i=0;i<16;i++){
    const sector=new THREE.ConeGeometry(8.7,4,64,1,true,i/16*TAU,TAU/16);mesh(ride,sector,i%2?cream:purple,[0,10,0]);
  }
  const roofRim=ring(ride,8.6,0.18,k.metal,[0,8,0]);roofRim.rotation.x=Math.PI/2;
  mesh(ride,new THREE.ConeGeometry(0.35,1.3,12),k.metal,[0,12.6,0]);
  const riders=[],lights=[];
  for(let i=0;i<10;i++){
    const a=i/10*TAU,x=6.1*Math.cos(a),z=6.1*Math.sin(a);
    mesh(ride,new THREE.CylinderGeometry(0.055,0.055,8,12),k.metal,[x,4,z]);
    const rider=ghost(ride,lacquer(0xb9cfd1,{emissive:0x355b7b,emissiveIntensity:0.12}),1);rider.position.set(x,2.8,z);rider.rotation.y=-a+Math.PI/2;riders.push(rider);
    const saddle=mesh(rider,new THREE.BoxGeometry(1.8,0.18,0.8),purple,[0,-0.8,0]);
  }
  for(let i=0;i<64;i++){const a=i/64*TAU;lights.push(ball(ride,emission(i%2?0xf5b261:0xdd739c,1.6),[8.5*Math.cos(a),7.85,8.5*Math.sin(a)],[0.085,0.085,0.085]));}
  // Empty ticket booth and bare trees make it an abandoned midway, not a stage.
  const booth=new THREE.Group();booth.position.set(-15,-4,-7);booth.rotation.y=0.2;k.scene.add(booth);mesh(booth,new THREE.BoxGeometry(4,5.5,3),purple,[0,2.75,0]);mesh(booth,new THREE.BoxGeometry(3,2,0.12),k.dark,[0,3.6,1.56]);mesh(booth,new THREE.ConeGeometry(3.5,2,4),cream,[0,6.5,0]).rotation.y=Math.PI/4;
  lettering(booth,C,'TICKETS',3,k.metal,[0,5,1.65]);
  // A suspended marquee stays readable while the ghost carousel spins behind it.
  mesh(k.scene,new THREE.BoxGeometry(4.2,1.08,.22),k.dark,[0,2.35,6.42]);
  const rideWord=lettering(k.scene,C,'DAWGHOUSE',3.2,emission(0xffb45e,1.7),[0,2.35,6.58],0.78),rideWordBase=rideWord.scale.clone();
  for(const x of [-1.8,1.8])tube(k.scene,[[x,5.7,6.7],[x,2.92,6.55]],.055,k.metal,false,12);
  for(const side of [-1,1])for(let i=0;i<5;i++){const x=side*(13+i*3),z=-16-i*4;tube(k.scene,[[x,-4,z],[x-0.4,2,z],[x+0.5,8+i%2*3,z]],0.22,k.dark);for(const s of [-1,1])tube(k.scene,[[x,1,z],[x+s*2,5,z],[x+s*3.2,7,z]],0.1,k.dark);}
  const fog=haze(0xb581be,65,0.10,[0,-1,-28]);k.scene.add(fog);const dust=motes(k,C,0xefcaa6,[0,6,-12],[65,28,35]);
  return loop(st,(a,m,bg)=>{ride.rotation.y=a;const pulse=1+0.025*m.beat;rideWord.scale.set(rideWordBase.x*pulse,rideWordBase.y*pulse,rideWordBase.z*pulse);riders.forEach((r,i)=>r.position.y=2.8+0.9*Math.sin(a*2+i*TAU/10)+0.28*band(m,i,a));lights.forEach((l,i)=>l.material.emissiveIntensity=1.2+1.4*band(m,i%16,a));dust.userData.u.uT.value=wrap(bg);},a=>{st.camera.position.set(0,7,25+2*Math.cos(a));st.camera.lookAt(0,1,-2);});
}

export async function vampireCrypt(st,C) {
  const k=rig(st,{bg:0x11040b,warm:0xd56852,cool:0x7359ad,fog:0.013});
  k.stone.map=brickTexture({base:[48,38,47],rows:9,cols:6});mesh(k.scene,new THREE.PlaneGeometry(90,120),k.stone,[0,-4.5,-30]).rotation.x=-Math.PI/2;
  const crypt=new THREE.Group();crypt.position.set(0,-0.1,-1);crypt.rotation.y=-0.12;k.scene.add(crypt);
  const outline=[[-1.6,-3.5],[1.6,-3.5],[2.5,1.5],[1.5,3.7],[-1.5,3.7],[-2.5,1.5]];
  const coffin=extrude(crypt,outline,1.2,pbr(0x331723,0.45),0.12);coffin.position.z=-0.7;
  const lining=extrude(crypt,outline.map(([x,y])=>[x*0.9,y*0.93]),0.08,pbr(0x680c2a,0.85),0.06);lining.position.z=0.55;
  const lidPivot=new THREE.Group();lidPivot.position.set(-2.4,0,0.65);crypt.add(lidPivot);
  const lid=extrude(lidPivot,outline,0.22,k.dark,0.1);lid.position.x=2.4;
  const cross=mesh(lidPivot,new THREE.BoxGeometry(0.15,2,0.09),k.metal,[2.4,0.5,0.4]);mesh(lidPivot,new THREE.BoxGeometry(1.2,0.15,0.09),k.metal,[2.4,0.9,0.4]);
  const head=skull(k);head.scale.setScalar(0.58);head.position.set(0,2,1.2);crypt.add(head);
  // A blood-red enamel nameplate crowns the crypt's arch above the vampire's wings.
  mesh(crypt,new THREE.BoxGeometry(6.3,1.04,0.18),pbr(0x211018,0.25,0.74),[0,6.1,0.9]);
  const cryptWord=lettering(crypt,C,'DAWGHOUSE',4.8,emission(0xd56852,1.7),[0,6.1,1.02],0.8);
  const cryptWordBase=cryptWord.scale.clone();
  const robe=extrude(crypt,[[-0.65,1.5],[0.65,1.5],[1.35,-2.9],[-1.35,-2.9]],0.3,pbr(0x15101f,0.8),0.06);robe.position.z=0.95;
  for(const side of [-1,1]){const fang=mesh(crypt,new THREE.ConeGeometry(0.07,0.3,12),pbr(0xe8d6bd,0.4),[side*0.25,1.25,2.05]);fang.rotation.z=Math.PI;}
  const wings=[];for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*1,0.9,0.4);crypt.add(pivot);
    const shape=[[0,0],[side*1.5,2.6],[side*4.7,4],[side*4.2,1.8],[side*6.5,0.6],[side*4.8,0.2],[side*5,-1.6],[side*3.2,-0.8],[side*2.5,-2.6],[side*1.3,-1.2]];
    extrude(pivot,shape,0.05,new THREE.MeshStandardMaterial({color:0x542039,roughness:0.75,side:THREE.DoubleSide}),0.025);
    for(const tip of [shape[2],shape[4],shape[6],shape[8]])tube(pivot,[[0,0,0.08],[side*1.5,0.5,0.1],[tip[0],tip[1],0.08]],0.045,k.metal,false,16);wings.push(pivot);
  }
  // A long corridor of burial niches, overhead ribs and a blood moon at its end.
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const z=-7-i*5;mesh(k.scene,new THREE.BoxGeometry(3,14,4.6),k.stone,[side*11,2,z]);
    mesh(k.scene,new THREE.BoxGeometry(0.15,3,2.4),k.dark,[side*9.4,1,z]);
    tube(k.scene,[[side*9,-4,z],[side*9,7,z],[side*5,11,z],[0,13,z]],0.24,k.stone);
    const torch=new THREE.PointLight(0xca5b39,35,14,1.5);torch.position.set(side*8,2,z+1);k.scene.add(torch);ball(k.scene,k.glow,[side*8,2,z+1],[0.13,0.45,0.13]);
  }
  ball(k.scene,emission(0x8b2030,0.8),[0,7,-50],[8,8,1]);
  const bats=[];for(let i=0;i<16;i++){const b=new THREE.Group();k.scene.add(b);const mat=pbr(0x17101d,0.8);ball(b,mat,[0,0,0],[0.1,0.25,0.1]);const parts=[];for(const side of [-1,1]){const w=extrude(b,[[0,0],[side*0.3,0.5],[side*0.9,0.2],[side*0.6,-0.15],[side*0.3,0]],0.025,mat,0.01);parts.push(w);}b.userData.wings=parts;bats.push(b);}
  const dust=motes(k,C,0xc98f9a,[0,4,-12],[42,25,35]);
  return loop(st,(a,m,bg)=>{lidPivot.rotation.y=-1.5+0.1*Math.sin(a);const pulse=1+0.025*m.beat;cryptWord.scale.set(cryptWordBase.x*pulse,cryptWordBase.y*pulse,cryptWordBase.z*pulse);wings.forEach((w,i)=>w.rotation.y=(i?1:-1)*(0.16+0.16*Math.sin(a*4)+0.18*m.beat));head.userData.jaw.rotation.x=0.1+0.1*m.beat;crypt.position.y=-0.1+0.16*Math.sin(a*2);bats.forEach((b,i)=>{const p=a+i/16*TAU;b.position.set(10*Math.cos(p),4+4*Math.sin(p*2+i),-6-14*(i%4)/4);b.rotation.z=0.2*Math.cos(p);b.userData.wings.forEach((w,j)=>w.rotation.y=(j?1:-1)*(0.4*Math.sin(a*16+i)+0.3*(m.hat??m.high)));});dust.userData.u.uT.value=wrap(bg);},a=>{st.camera.position.set(0,1.7,25+1.2*Math.cos(a));st.camera.lookAt(0,1.2,-2);});
}

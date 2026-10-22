import { THREE, TAU, rng } from './halloween-kit.js';
import { makeEnv, extrudeText } from './lib.js';
import { music, particles } from './lib2.js';

const M = (color, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const L = (color, power = 1.8) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, roughness: 0.34 });
const ball = (p, mat, pos, s) => { const o = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat); o.position.set(...pos); o.scale.set(...s); p.add(o); return o; };
const box = (p, mat, pos, s) => { const o = new THREE.Mesh(new THREE.BoxGeometry(...s), mat); o.position.set(...pos); p.add(o); return o; };
const tube = (p, mat, pts, r = 0.05, seg = 36) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(x => new THREE.Vector3(...x))), seg, r, 6, false), mat); p.add(o); return o; };
function lettering(parent,C,mat,pos,width,size=1){const text=extrudeText(C.fonts.block,String(C.event.title||'DAWGHOUSE').toUpperCase(),{size,track:.11,depth:.22,bevel:.035,targetWidth:width,material:mat}).group;text.position.set(...pos);parent.add(text);return text;}
function cinematic(st, bg, warm, cool, fog = 0.012) {
  const { scene, renderer } = st;
  scene.background = new THREE.Color(bg); scene.fog = new THREE.FogExp2(bg, fog);
  scene.environment = makeEnv(renderer, [
    { w: 26, h: 8, c: warm, i: 2.2, pos: [-9, 14, 12] },
    { w: 7, h: 24, c: cool, i: 2.4, pos: [15, 7, -7] },
    { w: 18, h: 5, c: 0xd1d8ea, i: 1.2, pos: [0, 8, -22] },
  ], bg); scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight(0xc9d8ed, bg, 0.72));
  const a = new THREE.DirectionalLight(warm, 2.8); a.position.set(-8, 13, 12); scene.add(a);
  const b = new THREE.DirectionalLight(cool, 3); b.position.set(10, 7, -9); scene.add(b);
  st.camera.fov = 39; st.camera.updateProjectionMatrix();
  st.bloom.strength = 0.3; st.bloom.radius = 0.55; st.bloom.threshold = 1.05;
  return scene;
}

// A layered paper theatre: a huge yellow moon, cut-paper landscape, and an ink-black thorn tree.
export function paperMoon(st, C) {
  const scene = cinematic(st, 0x100d23, 0xffd17d, 0x947bdb, 0.006);
  const ink = M(0x111326, 0.92), ink2 = M(0x28233b, 0.85), rose = M(0x693b68, 0.8), amber = M(0xe9b75c, 0.48);
  const moonMat = M(0xffd778, 0.76), moon = ball(scene, moonMat, [8, 5.2, -23], [7.8, 7.8, 1.1]);
  const crater = M(0xc99555, 0.9);
  for (const [x,y,r] of [[5.1,7.3,.8],[9.8,8.2,.48],[10.3,3.4,.72],[6.4,2.6,.37],[12.4,5.6,.3],[7.7,10,.28]]) {
    ball(scene, crater, [x,y,-21.83], [r,r*0.76,0.035]);
  }
  // Large scalloped foreground hills, deliberately flat like layered stage paper.
  const hill = (z, color, y, bump, phase) => {
    const shape = new THREE.Shape(); shape.moveTo(-100,-10); shape.lineTo(-100,y);
    for(let x=-100;x<=100;x+=5) shape.lineTo(x, y + Math.sin(x*0.16+phase)*bump + Math.sin(x*0.39-phase)*bump*0.24);
    shape.lineTo(100,-10); shape.closePath();
    const o = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), color); o.position.z = z; scene.add(o); return o;
  };
  hill(-16, rose, -1.5, 1.0, 0.7); hill(-9, ink2, -2.7, 1.35, 1.4); hill(1, ink, -3.7, 1.2, 0.2);
  // Papercut tree trunk and curling branches cross the moon edge as a strong silhouette.
  const tree = new THREE.Group(); tree.position.set(-7,-3.8,2); scene.add(tree);
  tube(tree, ink, [[0,0,0],[0.3,2,0],[0,4,0],[-0.5,6.1,0],[-1.8,8,0]], .43, 42);
  const limbs = [
    [[0,3,0],[-2,4,0],[-3.3,5.6,0],[-5.5,6.3,0]], [[-.3,4.7,0],[1.6,5.7,0],[2.6,7.4,0],[4.1,8.2,0]],
    [[-1.2,6.4,0],[-1.4,8.4,0],[-.6,9.6,0]], [[1.1,5.2,0],[3.1,5,0],[4.5,5.9,0],[6.3,6,0]],
    [[-2.3,5.7,0],[-4.3,5.3,0],[-5.6,4.1,0]], [[2.2,7,0],[2.1,8.8,0],[3.3,9.5,0]],
  ]; limbs.forEach((pts,i)=>tube(tree,i%2?ink2:ink,pts,i===0?.25:.16,32));
  // A ramshackle Dawghouse sits in the moon's light, with a legible sign and warm windows.
  const manor=new THREE.Group();manor.position.set(0,-2.2,-6);scene.add(manor);
  box(manor,ink2,[0,1,0],[5.4,4.2,1.15]);
  const roofShape=new THREE.Shape();roofShape.moveTo(-3,3);roofShape.lineTo(0,5.4);roofShape.lineTo(3,3);roofShape.closePath();
  const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape,{depth:1.35,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:2}),ink);roof.position.z=-.65;manor.add(roof);
  const windowM=L(0xf5ae45,1.15), windows=[];
  for(const x of [-1.65,1.65])for(const y of [.4,1.9]){box(manor,ink,[x,y,.6],[.92,1.05,.1]);const w=box(manor,windowM,[x,y,.67],[.67,.79,.08]);windows.push(w);box(manor,amber,[x,y,.72],[.035,.8,.025]);box(manor,amber,[x,y,.72],[.68,.035,.025]);}
  box(manor,ink,[0,-.3,.64],[1.05,2.0,.14]);
  const sign=box(manor,L(0xffc767,.7),[0,3.05,.74],[4.35,.68,.12]);
  const houseName=lettering(manor,C,M(0x251b2b,.4,.2),[0,3.05,.83],3.7,.8);
  const houseNameBase=houseName.scale.clone();
  const pumpkins=[];
  for(let i=0;i<7;i++){const x=-10+i*3.4,z=3+(i%2)*.6;const p=ball(scene,M(0xd86b25,.52),[x,-2.8,z],[.52,.48,.48]);for(let n=0;n<7;n++){const a=n/7*TAU;const rib=ball(scene,M(0xa34820,.65),[x+.42*Math.cos(a),-2.8,z+.42*Math.sin(a)],[.1,.42,.1]);rib.rotation.z=.18*Math.cos(a);}const stem=box(scene,ink,[x,-2.27,z],[.12,.25,.12]);pumpkins.push(p);}
  // The house mascot is a shadow-puppet dog with a bright collar tag.
  const hound=new THREE.Group();hound.position.set(8,-2.2,3.2);scene.add(hound);
  ball(hound,ink,[0,0,0],[1.2,.78,.55]);ball(hound,ink,[.72,.55,.05],[.64,.62,.5]);
  for(const s of [-1,1]){const ear=ball(hound,ink,[.62+s*.38,1.04,.05],[.2,.52,.18]);ear.rotation.z=s*.35;ball(hound,amber,[.9,.61,.49],[.095,.095,.045]);box(hound,ink,[.93,.18,.48],[.58,.09,.08]);box(hound,ink,[s*.72,-.75,0],[.25,.64,.28]);}
  const collar= new THREE.Mesh(new THREE.TorusGeometry(.42,.075,8,32),windowM);collar.position.set(.34,.15,.38);collar.rotation.x=Math.PI/2;hound.add(collar);
  const tag=ball(hound,amber,[.5,-.32,.52],[.17,.2,.08]),tagBase=tag.scale.clone();
  // Hanging paper stars and little folded bats give foreground, middle and moon depth.
  const stars=[];
  for(let i=0;i<9;i++) {
    const x=-12+i*3.1, y=6+(i%3)*1.3, z=-4-(i%2)*2;
    const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
    const wire=tube(g,ink2,[[0,1.7,0],[0,0.8,0]],.025,8);
    const geo=new THREE.OctahedronGeometry(.26+(i%3)*.08,0);const s=new THREE.Mesh(geo,i%2?amber:rose);s.position.y=.35;g.add(s);stars.push(g);
  }
  const birds=[];
  for(let i=0;i<12;i++){
    const g=new THREE.Group();g.position.set(-13+(i*2.37)%26,2+Math.sin(i*7)*4,-7-(i%4)*2);scene.add(g);
    const body=ball(g,ink,[0,0,0],[.26,.11,.13]);
    const wings=[];for(const s of [-1,1]){const w=ball(g,ink,[s*.26,.06,0],[.31,.07,.08]);w.rotation.z=s*.22;wings.push({w,s});}
    birds.push({g,wings});
  }
  const flecks=particles({count:72,seed:400,box:[32,17,8],center:[0,4,-5],color:0xffd989,size:.035,opacity:.55,H:C.H,travel:5,sway:.4});scene.add(flecks);
  return { update(t) {
    const a=TAU*t,m=music(t),kick=m.kick??m.beat; moon.position.y=5.2+.18*Math.sin(a);moon.scale.set(7.8*(1+.035*kick),7.8*(1+.035*kick),1.1);tree.rotation.z=.018*Math.sin(a)+.015*kick;
    stars.forEach((s,i)=>{s.rotation.y=.24*Math.sin(a+i);s.rotation.z=.12*Math.sin(a*2+i);s.scale.setScalar(1+.13*m.beat);});
    birds.forEach(({g,wings},i)=>{const p=a*(i%2?1:2)+i*.7;g.position.x=-13+(i*2.37)%26+.55*Math.sin(p);g.position.y=2+Math.sin(i*7)*4+.35*Math.sin(p);g.rotation.z=.12*Math.sin(p);wings.forEach(({w,s})=>w.rotation.z=s*(.2+.5*Math.sin(a*16+i)));});
    manor.scale.y=1+.025*kick;windows.forEach((w,i)=>w.material.emissiveIntensity=.9+1.4*kick+.2*Math.sin(a+i));const wordPulse=1+.025*kick;houseName.scale.set(houseNameBase.x*wordPulse,houseNameBase.y*wordPulse,houseNameBase.z*wordPulse);sign.material.emissiveIntensity=.55+.7*kick;
    hound.position.y=-2.2+.15*Math.max(0,m.beat);hound.rotation.z=.025*Math.sin(a*2);tag.scale.set(tagBase.x*(1+.15*m.beat),tagBase.y*(1+.15*m.beat),tagBase.z*(1+.15*m.beat));
    pumpkins.forEach((p,i)=>p.scale.set(.52*(1+.09*m.beat),.48*(1+.09*m.beat),.48*(1+.09*m.beat)));
    st.camera.position.set(0,2.3+.28*Math.sin(a*2),25);st.camera.lookAt(0,2,-8);
    flecks.userData.u.uT.value=t;
  }};
}

// A moving, impossible hotel corridor with checkerboard stone and repeating amber doorways.
export function impossibleHall(st, C) {
  const scene=cinematic(st,0x11101c,0xe0a95d,0x586fa5,0.018);
  const plaster=M(0x453d47,.9), shadow=M(0x201f2b,.82), brass=M(0xb78648,.28,.78), light=L(0xf5c879,2.4), doorGlow=L(0x8e82ed,1.4);
  // Tile atlas keeps the long floor cheap to render while retaining a clear vanishing point.
  const cv=document.createElement('canvas');cv.width=cv.height=256;const cx=cv.getContext('2d');
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){cx.fillStyle=(x+y)%2?'#39333d':'#55464a';cx.fillRect(x*32,y*32,32,32);cx.strokeStyle='#85705d';cx.lineWidth=1;cx.strokeRect(x*32,y*32,32,32);}
  const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(3,22);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,100),new THREE.MeshStandardMaterial({map:tex,roughness:.84}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-3,-29);scene.add(floor);
  box(scene,plaster,[-9,3,-28],[.5,13,65]);box(scene,shadow,[9,3,-28],[.5,13,65]);
  // Perspective rails and ribs telescope toward the vanishing point.
  const portals=[];
  for(let i=0;i<15;i++){
    const z=7-i*4.7, s=Math.max(.16,1-i*.055), w=7.7,h=5.7,y=-.2;
    const g=new THREE.Group();g.position.set(0,y,z);g.scale.setScalar(s);scene.add(g);
    for(const side of [-1,1]){
      box(g,plaster,[side*w/2,0,0],[.34,h,.5]);box(g,brass,[side*(w/2-.15),0,.3],[.07,h-.1,.08]);
    }
    box(g,plaster,[0,h/2,0],[w,.34,.5]);box(g,plaster,[0,-h/2,0],[w,.34,.5]);
    const door=new THREE.Group();door.position.set(i%2?2.2:-2.2,-.2,.35);g.add(door);
    box(door,shadow,[0,0,0],[1.55,3.75,.14]);
    box(door,brass,[0,0,.09],[1.36,3.55,.045]);
    box(door,shadow,[0,0,.13],[1.22,3.38,.06]);
    const portal=new THREE.Mesh(new THREE.PlaneGeometry(.82,2.45),doorGlow);portal.position.set(0,.14,.17);door.add(portal);
    box(door,brass,[.48,-.25,.2],[.06,.12,.05]);
    portals.push({g,door,i});
    if(i<9){
      for(const side of [-1,1]){
        const lamp=ball(g,light,[side*(w/2-.5),1.45,.2],[.1,.24,.11]);
      }
    }
  }
  // A brass hotel plaque is fixed to the nearest arch so the name belongs to this corridor.
  box(scene,shadow,[0,1.85,7.45],[2.5,.92,.2]);
  const hotelWord=lettering(scene,C,light,[0,1.85,7.58],1.8,.82);
  const hotelWordBase=hotelWord.scale.clone();
  // A few wall clocks tick backwards at different angles.
  const clocks=[];
  for(let i=0;i<5;i++){
    const z=-2-i*12, side=i%2?1:-1, g=new THREE.Group();g.position.set(side*(7.9-i*.2),2,z);g.rotation.y=-side*Math.PI/2;scene.add(g);
    const face=ball(g,M(0xd6c39c,.72),[0,0,0],[1.05,1.05,.12]);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.08,.09,8,48),brass);g.add(rim);
    for(let n=0;n<12;n++){const a=n/12*TAU;ball(g,shadow,[.79*Math.sin(a),.79*Math.cos(a),.13],[.045,.045,.025]);}
    const hands=new THREE.Group();g.add(hands);box(hands,shadow,[0,.31,.17],[.055,.62,.04]);const h2=box(hands,shadow,[.21,0,.2],[.42,.05,.04]);h2.rotation.z=-.3;clocks.push({g,hands});
  }
  const motes=particles({count:92,seed:411,box:[15,10,45],center:[0,2,-18],color:0xd7b67b,size:.04,opacity:.42,H:C.H,travel:9,sway:.28});scene.add(motes);
  const chandeliers=[];
  for(let i=0;i<7;i++){
    const z=3-i*8,g=new THREE.Group();g.position.set(0,5.3,z);scene.add(g);
    tube(g,brass,[[0,2.3,0],[0,0,0]],.055,12);const hoop=new THREE.Mesh(new THREE.TorusGeometry(1.25,.07,8,32),brass);hoop.rotation.x=Math.PI/2;g.add(hoop);
    for(let j=0;j<6;j++){const q=j/6*TAU;ball(g,light,[1.1*Math.cos(q),-.18,1.1*Math.sin(q)],[.12,.22,.12]);}
    chandeliers.push(g);
  }
  const portraits=[];
  for(let i=0;i<8;i++){
    const side=i%2?1:-1,z=2-Math.floor(i/2)*11,y=1.8+(i%3)*.3,g=new THREE.Group();g.position.set(side*8.55,y,z);g.rotation.y=-side*Math.PI/2;scene.add(g);
    box(g,brass,[0,0,0],[1.7,2.2,.12]);box(g,shadow,[0,0,.09],[1.45,1.95,.08]);
    const portrait=ball(g,i%2?M(0x694a59,.6):M(0x334654,.72),[0,.05,.16],[.48,.7,.08]);portrait.material.emissive.set(i%2?0x28101a:0x10232f);ball(g,light,[0,.45,.25],[.18,.2,.07]);portraits.push(portrait);
  }
  return {update(t){
    const a=TAU*t,m=music(t),kick=Math.max(Math.pow(.5+.5*Math.cos(a*16),3),.28*(m.kick??m.beat));
    portals.forEach(({g,door,i})=>{const s=Math.max(.16,1-i*.055);g.position.z=7-i*4.7+0.22*Math.sin(a+i*.4);g.scale.setScalar(s*(1+.012*kick));door.rotation.y=.18*Math.sin(a+i)+.24*m.beat;});
    const pulse=1+.025*m.beat;hotelWord.scale.set(hotelWordBase.x*pulse,hotelWordBase.y*pulse,hotelWordBase.z*pulse);
    clocks.forEach(({g,hands},i)=>{hands.rotation.z=-a*(i%2?1:2);g.rotation.z=.08*Math.sin(a+i);});
    chandeliers.forEach((g,i)=>{g.rotation.z=.08*Math.sin(a*2+i)+.06*m.beat;g.children.forEach(o=>{if(o.material===light)o.material.emissiveIntensity=1.5+kick;});});
    portraits.forEach(p=>{p.material.emissiveIntensity=.3+.4*m.beat;});
    st.camera.position.set(0,.15+.12*Math.sin(a*2),16+.9*Math.sin(a));st.camera.rotation.z=.008*Math.sin(a);st.camera.lookAt(0,.05,-8);
    motes.userData.u.uT.value=t;
  }};
}

// A quiet abyss filled with luminous jellyfish and a loose shoal; no floor, podium or lettering.
export function abyssGarden(st,C) {
  const scene=cinematic(st,0x031624,0x2abfbd,0x5864c9,0.009);
  const deep=M(0x062838,.8), coral=M(0x102f46,.92), brass=M(0xa77a47,.28,.75), teal=L(0x43e4d0,2.1), pink=L(0xe89de5,1.8), blue=L(0x8498ff,2);
  const jelly=[];
  const palette=[teal,pink,blue,teal,pink];
  for(let i=0;i<5;i++){
    const baseZ=i===2?2:-3-i*4, g=new THREE.Group();g.position.set((i-2)*5.3,1+(i%3)*1.45,baseZ);g.scale.setScalar(i===2?1.55:i%2?.9:1.05);scene.add(g);
    const capMat=new THREE.MeshPhysicalMaterial({color:i%2?0x654f9d:0x318c9b,roughness:.22,metalness:.08,clearcoat:.9,emissive:i%2?0x301548:0x0d4243,emissiveIntensity:.48});
    const cap=new THREE.Mesh(new THREE.SphereGeometry(1,32,20,0,TAU,0,Math.PI*.62),capMat);cap.scale.set(1.55-(i%2)*.25,1.12,1);g.add(cap);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.48-(i%2)*.24,.09,8,64),palette[i]);rim.rotation.x=Math.PI/2;rim.position.y=-.28;g.add(rim);
    const strings=[];
    for(let j=0;j<9;j++){
      const x=((j%3)-1)*.55, z=(Math.floor(j/3)-1)*.44;
      const pts=[];for(let n=0;n<7;n++)pts.push([x+.22*Math.sin(n*.7+j),-.27-n*.38,z+.11*Math.cos(n*.4+j)]);
      const s=tube(g,palette[i],pts,.028+(j%3)*.008,26);strings.push({s,x,z,j});
    }
    const pearls=[];for(let n=0;n<5;n++)pearls.push(ball(g,palette[i],[Math.cos(n*TAU/5)*.95,-.25,Math.sin(n*TAU/5)*.95],[.09,.09,.09]));
    jelly.push({g,cap,strings,pearls,i,baseZ});
  }
  // Fine branching coral occupies only the bottom edge, framing the open water.
  const coralGroups=[];const rand=rng(424);
  for(let i=0;i<17;i++){
    const x=-15+i*1.85,z=-4-rand()*8,g=new THREE.Group();g.position.set(x,-5.4,z);scene.add(g);
    const h=1.4+rand()*3.0, lean=(rand()-.5)*1.2;
    tube(g,coral,[[0,0,0],[lean*.3,h*.35,0],[lean,h*.7,0],[lean*.7,h,0]],.09+rand()*.08,20);
    for(let j=0;j<3;j++){
      const y=h*(.35+j*.19), side=j%2?1:-1;
      tube(g,j%2?deep:coral,[[lean*(y/h),y,0],[lean*(y/h)+side*.38,y+.35,0],[lean*(y/h)+side*.56,y+.95+rand()*.4,0]],.055,16);
    }
    coralGroups.push(g);
  }
  const fish=[];
  for(let i=0;i<22;i++){
    const g=new THREE.Group();const color=i%3?M(0x4e9fb5,.34,.15):M(0xe0b578,.4,.1);
    ball(g,color,[0,0,0],[.38,.16,.12]);const tail=new THREE.Mesh(new THREE.ConeGeometry(.17,.32,3),color);tail.position.x=-.39;tail.rotation.z=Math.PI/2;g.add(tail);
    ball(g,L(0xdffff0,1),[.2,.045,.105],[.035,.035,.025]);scene.add(g);fish.push({g,i});
  }
  // A small wrecked Dawghouse observatory gives the reef a story and a clear identity.
  const wreck=new THREE.Group();wreck.position.set(0,-1.2,-8);scene.add(wreck);
  box(wreck,deep,[0,0,0],[8,4.8,2.2]);box(wreck,coral,[0,2.2,0],[8.7,.32,2.55]);
  for(const s of [-1,1]){const roof=box(wreck,coral,[s*2,3,0],[4.7,.26,2.6]);roof.rotation.z=s*.23;}
  const houseWins=[];
  for(const x of [-2.7,0,2.7]){
    const win=new THREE.Mesh(new THREE.CircleGeometry(.66,32),teal);win.position.set(x,.25,1.13);wreck.add(win);
    const r=new THREE.Mesh(new THREE.TorusGeometry(.72,.11,8,40),brass);r.position.set(x,.25,1.17);wreck.add(r);houseWins.push(win);
    box(wreck,brass,[x,.25,1.22],[.05,1.3,.045]);box(wreck,brass,[x,.25,1.22],[1.3,.05,.045]);
  }
  box(wreck,brass,[0,-.35,1.28],[6.4,.9,.2]);box(wreck,M(0x12323a,.58,.32),[0,-.35,1.42],[6.12,.66,.08]);
  const houseName=lettering(wreck,C,L(0x98ffe8,1.05),[0,-.35,1.62],5.35,.96),houseNameBase=houseName.scale.clone();
  for(let i=0;i<5;i++){
    const x=-3.2+i*1.6;const rib=box(wreck,coral,[x,-.1,-1.2],[.13,4,.18]);rib.rotation.z=(i-2)*.09;
  }
  const bubbles=particles({count:190,seed:425,box:[34,22,28],center:[0,0,-6],color:0x8de9eb,size:.045,opacity:.6,H:C.H,travel:15,sway:.8});scene.add(bubbles);
  return {update(t){
    const a=TAU*t,m=music(t),kick=Math.max(Math.pow(.5+.5*Math.cos(a*16),3),.28*(m.kick??m.beat));
    jelly.forEach(({g,cap,strings,pearls,i,baseZ})=>{const p=a*(i%2?1:2)+i;g.position.y=1+(i%3)*1.45+.48*Math.sin(p)+.12*kick;g.position.x=(i-2)*5.3+.45*Math.sin(p*.7);g.position.z=baseZ+.35*Math.sin(p*.5);g.rotation.z=.08*Math.sin(p);cap.scale.y=1.12+.1*Math.sin(p*2)+.16*kick;cap.material.emissiveIntensity=.48+.9*kick;strings.forEach(({s,x,z,j})=>{s.position.x=.1*Math.sin(p+j);s.rotation.z=.09*Math.sin(p+j*.8)+.035*kick;});pearls.forEach((o,j)=>o.material.emissiveIntensity=1.2+1.4*kick+.35*Math.sin(p*2+j));});
    fish.forEach(({g,i})=>{const p=a*(i%3?1:2)+i*1.7;g.position.set(13*Math.sin(p),2.5*Math.sin(p*.63+i)+1,-8-8*Math.cos(p*.5+i));g.rotation.y=Math.cos(p)>0?0:Math.PI;g.rotation.z=.08*Math.sin(p);});
    coralGroups.forEach((g,i)=>{g.rotation.z=.025*Math.sin(a+i)+.035*kick;});houseWins.forEach((w,i)=>w.material.emissiveIntensity=1.4+1.5*kick+.2*Math.sin(a+i));const namePulse=1+.025*kick;houseName.scale.set(houseNameBase.x*namePulse,houseNameBase.y*namePulse,houseNameBase.z*namePulse);
    st.camera.position.set(0,.8*Math.sin(2*a),22+.7*Math.sin(a));st.camera.lookAt(0,0,-5);bubbles.userData.u.uT.value=t;
  }};
}

import { THREE, TAU, studio, pbr, lacquer, emission, mesh, ball, tube, ring, spider } from './halloween-kit.js?v=2';
import { music, particles, haze, bgClock } from './lib2.js';
import { extrudeText } from './lib.js';

const mat = pbr;
const motion = (st, update, camera) => ({ update(t) { const a = TAU * t, m = music(t); update(a, m, t); camera(a, m); } });
function name(parent,C,width,material,pos,size=0.82){const g=extrudeText(C.fonts.block,'DAWGHOUSE',{size,track:.08,targetWidth:width,depth:.16,bevel:.035,material}).group;g.position.set(...pos);parent.add(g);return g;}

export async function clockworkOwl(st, C) {
  const k = studio(st, C, { accent: 0xf2a849, secondary: 0x47b9ce, bg: 0x080d18, title: false });
  const brass = mat(0xa97737, 0.28, 0.82), iron = mat(0x242a35, 0.34, 0.72), feather = lacquer(0x342b40, { roughness: 0.36 });
  const perch = new THREE.Group(); perch.position.set(0, 0.15, 0); k.scene.add(perch);
  mesh(perch,new THREE.BoxGeometry(5.6,0.96,0.24),pbr(0x171923,0.28,0.72),[0,-1.35,1.48]);
  const owlWord=name(perch,C,4.6,k.glow,[0,-1.35,1.64],0.78);
  const owlWordBase=owlWord.scale.clone();
  tube(perch, [[-5,-0.8,0],[-3,-0.45,0.2],[0,-0.7,0],[3,-0.35,-0.2],[5,-0.7,0]], 0.27, mat(0x42332b, 0.75), false, 60);
  for (const x of [-2.5, 0, 2.5]) tube(perch, [[x,-1,0],[x-0.3,-2.5,0.2],[x+0.25,-3.7,0.3]], 0.09, brass, false, 28);
  const body = ball(perch, feather, [0, 2.25, 0], [2.05, 2.55, 1.45]);
  const breast = ball(perch, lacquer(0x8a5b40, { roughness: 0.56 }), [0,1.75,1.05], [1.36,1.78,0.6]);
  for (let row=0; row<5; row++) for (let col=-2; col<=2; col++) {
    const f=ball(perch, row%2?iron:brass,[col*0.47,2.75-row*0.48,1.42-Math.abs(col)*0.07],[0.18,0.27,0.055]);
    f.rotation.z=col*0.12;
  }
  const head=new THREE.Group();head.position.set(0,4.1,0.15);perch.add(head);
  ball(head,iron,[0,0.3,0],[1.67,1.5,1.3]);
  for(const side of [-1,1]) {
    const horn=mesh(head,new THREE.ConeGeometry(0.62,1.5,5),feather,[side*1.02,1.18,0]);horn.rotation.z=-side*0.35;
    ball(head,brass,[side*0.71,0.05,1.02],[0.79,0.86,0.3]);
    ball(head,k.glow,[side*0.71,0.04,1.28],[0.52,0.56,0.16]);
    ball(head,mat(0x10131c,0.12),[side*0.71,0.04,1.43],[0.17,0.32,0.08]);
    ring(head,0.55,0.075,brass,[side*0.71,0.04,1.38]);
  }
  const beak=mesh(head,new THREE.ConeGeometry(0.3,0.85,5),mat(0xd58032,0.32,0.35),[0,-0.72,1.25]);beak.rotation.x=-0.28;
  const wings=[];
  for(const side of [-1,1]) {
    const wing=new THREE.Group();wing.position.set(side*1.3,2.8,0);perch.add(wing);wings.push({wing,side});
    for(let i=0;i<7;i++){const f=ball(wing,i%3===0?brass:feather,[side*(0.48+i*0.26),-0.06-i*0.31,0.35],[0.28,0.62,0.15]);f.rotation.z=side*(0.18+i*0.045);}
    tube(wing,[[0,0,0.4],[side*1.5,-0.9,0.45],[side*2.2,-2.25,0.4]],0.09,brass,false,30);
  }
  const gears=[];
  for(let i=0;i<5;i++){
    const x=(i-2)*2.9, z=-4-i%2*2, y=2+i%3;
    const g=ring(k.scene,1.0+(i%2)*0.35,0.075,i%2?brass:k.glow,[x,y,z]);
    g.rotation.x=Math.PI/2+(i%2)*0.4;gears.push({g,dir:i%2?1:-1});
    for(let n=0;n<12;n++){const a=n/12*TAU;ball(g,i%2?brass:k.glow,[Math.cos(a)*(1.08+(i%2)*0.35),Math.sin(a)*(1.08+(i%2)*0.35),0],[0.08,0.08,0.08]);}
  }
  const motes=particles({count:110,seed:535,box:[28,15,14],center:[0,3,-5],color:0xf7c879,size:0.045,opacity:0.45,H:C.H,travel:7,sway:0.3});k.scene.add(motes);
  return motion(st,(a,m,t)=>{
    head.rotation.y=0.24*Math.sin(a)+0.09*Math.sin(a*2);head.rotation.z=0.035*Math.sin(a*2);
    const pulse=1+0.025*m.beat;owlWord.scale.set(owlWordBase.x*pulse,owlWordBase.y*pulse,owlWordBase.z*pulse);
    wings.forEach(({wing,side},i)=>wing.rotation.z=side*(0.03+0.13*Math.sin(a*2+i*Math.PI)+0.12*m.beat));
    gears.forEach(({g,dir},i)=>g.rotation.z=dir*a*(i%2?1:2));
    k.glow.emissiveIntensity=2.2+1.2*m.high;motes.userData.u.uT.value=t;
  },a=>{st.camera.position.set(0,5.5+0.2*Math.cos(a),22);st.camera.lookAt(0,1.2,-1);});
}

export async function bellTower(st,C) {
  const k=studio(st,C,{accent:0xf0a342,secondary:0x678ecb,bg:0x100a12,title:false});
  const stone=mat(0x393542,0.8), bronze=mat(0x9c6934,0.26,0.82), deep=mat(0x24202a,0.35,0.55);
  const tower=new THREE.Group();tower.position.set(0,-2.4,-3);k.scene.add(tower);
  for(const side of [-1,1]){
    const x=side*4.3;
    mesh(tower,new THREE.BoxGeometry(1.25,13,1.3),stone,[x,4.2,0]);
    for(const y of [-1.6,1.8,7.8,10.5])mesh(tower,new THREE.BoxGeometry(1.75,0.3,1.8),bronze,[x,y,0]);
    const roof=mesh(tower,new THREE.ConeGeometry(1.18,3.2,4),deep,[x,12.2,0]);roof.rotation.y=Math.PI/4;
    for(const side2 of [-1,1])mesh(tower,new THREE.BoxGeometry(0.16,7.4,0.2),bronze,[x+side2*0.48,4.4,0.74]);
  }
  mesh(tower,new THREE.BoxGeometry(9.3,0.55,1.4),bronze,[0,8.2,0]);
  mesh(tower,new THREE.BoxGeometry(8.1,1.05,0.22),deep,[0,10.05,0.86]);
  const towerWord=name(tower,C,6.2,k.glow,[0,10.05,1],0.83);
  const towerWordBase=towerWord.scale.clone();
  const frame=new THREE.Group();frame.position.set(0,5.4,0);tower.add(frame);
  const profile=[[0,2.6],[0.22,2.48],[0.43,1.9],[0.8,0.85],[1.35,0.12],[1.5,-0.22],[1.35,-0.38],[0.4,-0.2],[0,-0.18]].map(([r,y])=>new THREE.Vector2(r,y));
  const bell=mesh(frame,new THREE.LatheGeometry(profile,72),bronze);
  for(const y of [-0.17,0.12,0.44,2.34]){const r=y<0.5?1.38:0.28;const rim=ring(frame,r,0.095,mat(0xd5a24e,0.22,0.8),[0,y,0]);}
  const clapper=new THREE.Group();clapper.position.set(0,2.5,0);frame.add(clapper);
  mesh(clapper,new THREE.CylinderGeometry(0.075,0.11,3.0,12),deep,[0,-1.35,0]);ball(clapper,mat(0xd8a24b,0.2,0.8),[0,-2.95,0],[0.27,0.34,0.27]);
  const strikerLights=[];
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const light=ball(tower,k.glow,[side*(2.0+i*0.46),3.0+(i%2)*0.8,0.9],[0.09,0.18,0.08]);strikerLights.push(light);
  }
  const birds=[];
  for(let i=0;i<5;i++){
    const bird=new THREE.Group(), feather=mat(0x161522,0.72);
    ball(bird,feather,[0,0,0],[0.38,0.32,0.67]);ball(bird,feather,[0,0.28,0.36],[0.29,0.29,0.31]);
    const beak=mesh(bird,new THREE.ConeGeometry(0.1,0.42,5),bronze,[0,0.23,0.7]);beak.rotation.x=Math.PI/2;
    for(const side of [-1,1]){const w=ball(bird,feather,[side*0.48,0.07,0],[0.62,0.11,0.3]);w.rotation.z=side*0.2;}
    k.scene.add(bird);birds.push(bird);
  }
  const fog=haze(0x6f7fab,52,0.075,[0,1,-22]);k.scene.add(fog);
  const dust=particles({count:95,seed:937,box:[30,20,25],center:[0,5,-6],color:0xe5b878,size:0.05,opacity:0.5,H:C.H,travel:8,sway:0.4});k.scene.add(dust);
  return motion(st,(a,m,t)=>{
    frame.rotation.z=0.16*Math.sin(a*2);clapper.rotation.z=-0.35*Math.sin(a*2+0.4);
    const pulse=1+0.025*m.beat;towerWord.scale.set(towerWordBase.x*pulse,towerWordBase.y*pulse,towerWordBase.z*pulse);
    bell.material.emissive.setHex(0x68411c);bell.material.emissiveIntensity=0.05+0.32*m.bass;
    strikerLights.forEach((l,i)=>l.material.emissiveIntensity=0.8+1.5*(0.5+0.5*Math.sin(a*4+i*0.7))+m.beat);
    birds.forEach((b,i)=>{const p=a+i*TAU/5;b.position.set(10*Math.cos(p),5+4*Math.sin(p),-5-2*Math.sin(p));b.rotation.y=-p+Math.PI/2;});
    dust.userData.u.uT.value=t;
  },a=>{st.camera.position.set(0,7.2,24);st.camera.lookAt(0,3,-2);});
}

export async function nightBloom(st,C) {
  const k=studio(st,C,{accent:0xdd62ba,secondary:0x70c99a,bg:0x0b1012,title:false});
  const gardenSign=new THREE.Group();gardenSign.position.set(0,0.1,3.2);k.scene.add(gardenSign);
  // Raised wooden frame and a separate inset face make the lettering read as mounted.
  mesh(gardenSign,new THREE.BoxGeometry(6.05,1.42,0.24),mat(0x68472f,0.56,0.48),[0,0,0]);
  mesh(gardenSign,new THREE.BoxGeometry(5.72,1.1,0.12),pbr(0x17221b,0.58,0.28),[0,0,0.17]);
  for(const x of [-2.45,2.45]){
    mesh(gardenSign,new THREE.BoxGeometry(0.14,3.0,0.16),mat(0x493a2b,0.64),[x,-2.15,-0.08]);
    ball(gardenSign,mat(0xc29655,0.28,0.72),[x,0.48,0.27],[0.09,0.09,0.055]);
    mesh(gardenSign,new THREE.BoxGeometry(0.34,0.12,0.2),mat(0x785738,0.48,0.55),[x,0.8,-0.02]);
  }
  const gardenWord=name(gardenSign,C,4.8,emission(0xa6dc9a,1.15),[0,0,0.26],0.74);
  const gardenWordBase=gardenWord.scale.clone();
  const leafMat=lacquer(0x295f47,{roughness:0.34}), vein=mat(0x8bb877,0.5), petalMat=lacquer(0xbe539b,{roughness:0.26,clearcoat:0.8}), centerMat=emission(0xf6aa43,2.1);
  const stems=[], flowers=[], fireflies=[];
  for(let x=-11;x<=11;x+=5.5){
    const tall=x===0, h=tall?8.2:4.5+(Math.abs(x)%3)*0.4, z=x===0?0:-4-Math.abs(x)*0.55;
    tube(k.scene,[[x,-3.9,z],[x+0.15,h*0.3-2.4,z],[x-0.12,h*0.7-1,z],[x,h,z]],0.16,tall?mat(0x376b45,0.56):leafMat,false,40);
    for(let j=0;j<4;j++){
      const side=j%2?1:-1, y=-2.5+j*(h-1)/4, leaf=new THREE.Group();leaf.position.set(x,y,z);leaf.rotation.z=side*0.2;k.scene.add(leaf);
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(side*1.8,0.25,side*2.9,1.6,side*3.7,1.3);shape.bezierCurveTo(side*2.6,0.15,side*1.1,-0.4,0,0);shape.closePath();
      mesh(leaf,new THREE.ExtrudeGeometry(shape,{depth:0.12,bevelEnabled:true,bevelSize:0.045,bevelThickness:0.035,bevelSegments:2}),leafMat,[0,0,0.15]);
      tube(leaf,[[0,0,0.32],[side*1.2,0.2,0.36],[side*2.3,0.65,0.34],[side*3.3,1.1,0.26]],0.035,vein,false,24);
      stems.push(leaf);
    }
    const bloom=new THREE.Group();bloom.position.set(x,h,z+0.25);k.scene.add(bloom);
    const core=ball(bloom,centerMat,[0,0,0.55],[0.9,0.85,0.66]);
    for(let j=0;j<9;j++){
      const a=j/9*TAU, petal=new THREE.Group();petal.rotation.z=a; bloom.add(petal);
      const g=ball(petal,petalMat,[0,1.65,0],[0.58,1.8,0.24]);g.rotation.x=-0.22;
      tube(petal,[[0,0.65,0.22],[0,1.7,0.23],[0,2.75,0.08]],0.025,vein,false,22);
      flowers.push({petal,index:j,offset:Math.abs(x)*0.2});
    }
    for(let j=0;j<5;j++){
      const g=ball(k.scene,emission(j%2?0xffca68:0xb1e879,1.7),[x+(j-2)*0.65,-1.2+j%2*1.3,z+1.5],[0.09,0.13,0.09]);fireflies.push(g);
    }
  }
  const dome=[];
  for(const side of [-1,1]){
    const x=side*14;for(let i=0;i<3;i++){
      const a=ring(k.scene,10+i*2,0.045,mat(0x66816f,0.35,0.75),[x,0,-7]);a.scale.y=0.92;dome.push(a);
    }
    for(const y of [-4,5,11])mesh(k.scene,new THREE.BoxGeometry(0.14,0.16,36),mat(0x667969,0.4,0.72),[x,y,-8]);
  }
  const mothDust=particles({count:135,seed:3636,box:[35,17,34],center:[0,2,-5],color:0xbfe4b0,size:0.045,opacity:0.52,H:C.H,travel:10,sway:0.65});k.scene.add(mothDust);
  return motion(st,(a,m,t)=>{
    const pulse=1+0.025*m.beat;gardenWord.scale.set(gardenWordBase.x*pulse,gardenWordBase.y*pulse,gardenWordBase.z*pulse);
    stems.forEach((leaf,i)=>leaf.rotation.z=(i%2?1:-1)*(0.17+0.08*Math.sin(a*2+i*0.4)+0.08*m.bass));
    flowers.forEach(({petal,index,offset})=>{petal.rotation.x=0.12*Math.sin(a*2+offset);petal.scale.y=0.93+0.08*Math.sin(a*2+index*0.18);});
    fireflies.forEach((f,i)=>f.material.emissiveIntensity=1.1+1.1*(0.5+0.5*Math.sin(a*3+i*1.8))+0.35*m.high);
    dome.forEach((g,i)=>g.rotation.y=0.015*Math.sin(a+i));mothDust.userData.u.uT.value=t;
  },a=>{st.camera.position.set(0,5,25);st.camera.lookAt(0,1,-2);});
}

import { THREE, TAU, makeEnv, extrudeText, rng } from './lib.js';
import { particles, haze } from './lib2.js';

// Sculpted assets and a lighting rig for Halloween motion-graphics scenes.
// All geometry is local and procedural; nothing is fetched from an asset service.
export { THREE, TAU, rng };
export const v = (x, y, z) => new THREE.Vector3(x, y, z);
export const pbr = (color, roughness = 0.35, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const lacquer = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.18, ...extra });
export const emission = (color, power = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, roughness: 0.35 });
export function mesh(parent, geo, mat, pos = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (scale) m.scale.set(...scale); parent.add(m); return m;
}
export function ball(parent, mat, pos, scale = [1, 1, 1]) { return mesh(parent, new THREE.SphereGeometry(1, 40, 28), mat, pos, scale); }
export function tube(parent, points, radius, mat, closed = false, segments = 48) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? v(...p) : p), closed, 'catmullrom', 0.35), segments, radius, 7, closed), mat);
}
export function ring(parent, r, thickness, mat, pos = [0, 0, 0]) { return mesh(parent, new THREE.TorusGeometry(r, thickness, 10, 120), mat, pos); }
export function extrude(parent, points, depth, mat, bevel = 0.08) {
  const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  return mesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3 }), mat);
}

function stoneTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(256, 256), random = rng(340);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    const n = 100 + 16 * Math.sin(x * 0.09 + Math.sin(y * 0.05) * 4) + random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}

export function studio(st, C, { accent = 0xff792a, secondary = 0x714bff, bg = 0x080610, floor = -4.5, title = true } = {}) {
  const { scene, renderer } = st;
  scene.background = new THREE.Color(bg); scene.fog = new THREE.FogExp2(bg, 0.018);
  st.bloom.strength = 0.38; st.bloom.radius = 0.55; st.bloom.threshold = 1.05;
  scene.environment = makeEnv(renderer, [
    { w: 22, h: 8, c: 0xffe2bf, i: 2.2, pos: [-8, 14, 14] },
    { w: 5, h: 22, c: accent, i: 2.5, pos: [-17, 4, 3] },
    { w: 7, h: 22, c: secondary, i: 2.8, pos: [16, 6, -4] },
    { w: 22, h: 4, c: 0xbcdfff, i: 1.5, pos: [0, 6, -18] },
  ], bg);
  scene.environmentIntensity = 0.65;
  scene.add(new THREE.HemisphereLight(0xc6d4ff, 0x16101e, 0.75));
  const key = new THREE.DirectionalLight(0xffe4cd, 3.2); key.position.set(-7, 12, 14); scene.add(key);
  const rim = new THREE.DirectionalLight(secondary, 3.8); rim.position.set(9, 6, -5); scene.add(rim);
  const fill = new THREE.PointLight(accent, 180, 45, 1.5); fill.position.set(-9, 2, 8); scene.add(fill);
  const under = new THREE.PointLight(secondary, 100, 40, 1.5); under.position.set(8, -2, 3); scene.add(under);
  const noise = stoneTexture(), stone = pbr(0x33313d, 0.82); stone.bumpMap = noise; stone.bumpScale = 0.16;
  const metal = pbr(0x88745b, 0.31, 0.85), black = pbr(0x14131e, 0.34, 0.65);
  const glow = emission(accent, 2.7), glow2 = emission(secondary, 2.5);
  const floorMat = pbr(0x15131d, 0.42, 0.4); floorMat.bumpMap = noise; floorMat.bumpScale = 0.035;
  mesh(scene, new THREE.PlaneGeometry(180, 160), floorMat, [0, floor - 0.04, -35]).rotation.x = -Math.PI / 2;
  // Subtle masonry seams make the floor's perspective legible on a wide screen.
  const grout = pbr(0x08080c, 0.9);
  for (let i = -8; i <= 8; i++) mesh(scene, new THREE.BoxGeometry(0.025, 0.008, 90), grout, [i * 3, floor - 0.03, -26]);
  for (let i = 0; i < 24; i++) mesh(scene, new THREE.BoxGeometry(60, 0.008, 0.025), grout, [0, floor - 0.03, 12 - i * 3]);
  // A broad three-tier plinth gives the hero a physical place in the set.
  for (let i = 0; i < 3; i++) mesh(scene, new THREE.CylinderGeometry(8.1 - i * 0.5, 8.4 - i * 0.5, 0.26, 96), i === 2 ? black : stone, [0, floor + i * 0.26, 0]);
  const floorRing = ring(scene, 7.7, 0.045, glow, [0, floor + 0.65, 0]); floorRing.rotation.x = Math.PI / 2;
  // Broad pools of light read as stage illumination rather than a foreground veil.
  const h1 = haze(accent, 42, 0.09, [-13, 3, -22]);
  const h2 = haze(secondary, 46, 0.11, [13, 6, -25]); scene.add(h1, h2);
  const dust = particles({ count: 220, seed: 340, box: [46, 22, 35], center: [0, 4, -10], color: 0xffd6a0, size: 0.055, opacity: 0.55, H: C.H, travel: 18, sway: 0.6 }); scene.add(dust);
  if (title) {
    // Wide, bevelled event lettering on the shared low sign.
    const titleMat = pbr(0xdfb985, 0.26, 0.65);
    const titleMesh = extrudeText(C.fonts.block, (C.event.title || 'HALLOWEEN').toUpperCase(), { size: 1.6, depth: 0.4, bevel: 0.07, track: 0.1, targetWidth: 17.5, material: titleMat }).group;
    titleMesh.position.set(0, floor + 1.35, 8); scene.add(titleMesh);
  }
  return { scene, floor, stone, metal, black, glow, glow2, accent, secondary,
    tick(t, m) { dust.userData.u.uT.value = t; fill.intensity = 160 + 55 * m.bass; under.intensity = 90 + 40 * m.beat; glow.emissiveIntensity = 2 + 1.1 * m.beat; glow2.emissiveIntensity = 2 + 0.8 * m.beat; },
  };
}

export function arch(parent, k, { x = 0, z = -10, scale = 1, glow = true } = {}) {
  const g = new THREE.Group(); g.position.set(x, k.floor, z); g.scale.setScalar(scale); parent.add(g);
  const points = [[-6, 0, 0], [-6, 7, 0], [-4.8, 10, 0], [0, 14, 0], [4.8, 10, 0], [6, 7, 0], [6, 0, 0]];
  tube(g, points, 0.42, k.stone, false, 72);
  tube(g, points.map(([a,b,c]) => [a * 0.93, b * 0.96, c + 0.38]), 0.035, glow ? k.glow2 : k.metal, false, 72);
  for (const side of [-1, 1]) {
    mesh(g, new THREE.BoxGeometry(1.3, 0.45, 1.4), k.stone, [side * 6, 0.3, 0]);
    for (let i = 0; i < 3; i++) mesh(g, new THREE.CylinderGeometry(0.55, 0.55, 0.18, 16), k.metal, [side * 6, 1.2 + i * 2.3, 0]);
    mesh(g, new THREE.ConeGeometry(0.55, 2, 5), k.black, [side * 6, 9, 0]);
  }
  return g;
}

export function candles(parent, k, positions) {
  const flames = [], wax = pbr(0xd8ba84, 0.6), fire = emission(0xffa63c, 3.2);
  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i], h = 0.65 + (i % 4) * 0.23;
    mesh(parent, new THREE.CylinderGeometry(0.22, 0.27, 0.13, 16), k.metal, [x, y, z]);
    mesh(parent, new THREE.CylinderGeometry(0.12, 0.14, h, 16), wax, [x, y + h / 2, z]);
    // Wax drips catch the key light.
    for (let j = 0; j < 3; j++) ball(parent, wax, [x + 0.12 * Math.cos(j * 2), y + h - 0.12 * j, z + 0.12 * Math.sin(j * 2)], [0.035, 0.14 + 0.06 * j, 0.035]);
    flames.push(ball(parent, fire, [x, y + h + 0.17, z], [0.07, 0.22, 0.07]));
  }
  return (a, beat) => flames.forEach((f, i) => { f.scale.y = 0.2 + 0.03 * Math.sin(a * 8 + i * 2) + 0.04 * beat; });
}

export function pumpkin(k, size = 1) {
  const g = new THREE.Group(), geo = new THREE.SphereGeometry(1, 80, 48), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), theta = Math.atan2(z, x);
    const rib = 1 + 0.10 * Math.cos(theta * 10) * Math.sqrt(Math.max(0, 1 - y * y));
    pos.setXYZ(i, x * rib, y * 0.88, z * rib);
  }
  geo.computeVertexNormals();
  const skin = lacquer(0xd94e08, { roughness: 0.36, clearcoat: 0.4 });
  mesh(g, geo, skin);
  const stem = tube(g, [[0, 0.8, 0], [0.04, 1.07, 0], [0.23, 1.28, -0.08]], 0.12, pbr(0x43502b, 0.85), false, 16);
  stem.rotation.y = 0.4;
  // Bevelled inlaid carvings follow the curved front, backed by warm fire.
  const cut = pbr(0x211006, 0.8), flame = emission(0xff9c12, 2.5);
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(side * 0.36, 0.18, 0.85); eye.rotation.y = side * 0.32;
    extrude(eye, [[-0.22,-0.13],[0.23,-0.08],[side * 0.12,0.24]], 0.035, cut, 0.035);
    const inner = extrude(eye, [[-0.16,-0.09],[0.17,-0.05],[side * 0.09,0.17]], 0.015, flame, 0.015); inner.position.z = 0.08; g.add(eye);
  }
  const mouth = new THREE.Group(); mouth.position.set(0, -0.37, 0.89);
  const mouthShape = [[-0.58,0.16],[-0.34,0.06],[-0.22,0.15],[-0.08,0.01],[0.07,0.13],[0.24,0.03],[0.38,0.13],[0.57,0.2],[0.35,-0.18],[0.16,-0.23],[0,-0.16],[-0.16,-0.23],[-0.37,-0.14]];
  extrude(mouth, mouthShape, 0.025, cut, 0.025); const inner = extrude(mouth, mouthShape.map(([x,y])=>[x*0.88,y*0.65]), 0.02, flame, 0.01); inner.position.z = 0.055; g.add(mouth);
  g.scale.setScalar(size); g.userData.fire = flame; return g;
}

export function skull(k) {
  const g = new THREE.Group(), bone = lacquer(0xccbfa7, { roughness: 0.45, clearcoat: 0.18 }), socket = pbr(0x09070b, 0.95);
  // Sockets are actual deep cups, with an outer bone ridge and recessed eye core.
  ball(g, bone, [0, 0.8, -0.42], [2, 2.1, 1.5]);
  ball(g, bone, [-1.35, -0.35, 0.05], [0.65, 0.7, 0.75]); ball(g, bone, [1.35, -0.35, 0.05], [0.65, 0.7, 0.75]);
  for (const side of [-1, 1]) {
    ball(g, socket, [side * 0.83, 0.5, 1], [0.71, 0.77, 0.38]);
    const rim = ring(g, 0.7, 0.12, bone, [side * 0.83, 0.5, 1.15]); rim.scale.set(1, 1.1, 1); rim.rotation.z = side * -0.12;
    ball(g, k.glow, [side * 0.83, 0.48, 1.35], [0.15, 0.19, 0.12]);
    tube(g, [[side*0.2,1.25,1.1],[side*0.9,1.5,1.1],[side*1.55,1.12,0.85]], 0.19, bone);
  }
  const nose = extrude(g, [[-0.23,-0.3],[0,-0.03],[0.23,-0.3],[0.12,-0.62],[-0.12,-0.62]], 0.1, socket, 0.06); nose.position.z = 1.05;
  const jaw = new THREE.Group(); jaw.position.set(0, -1.15, 0.3); g.add(jaw);
  tube(jaw, [[-1.3,0.3,0],[-1.2,-0.45,0.3],[0,-0.65,0.65],[1.2,-0.45,0.3],[1.3,0.3,0]], 0.22, bone);
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * 0.28, z = 1.02 - 0.2 * x * x;
    ball(g, bone, [x, -0.93, z], [0.115, 0.28, 0.16]); ball(jaw, bone, [x, -0.17, z - 0.3], [0.11, 0.23, 0.15]);
  }
  // Crown seams make the skull read as a sculpt instead of overlapping primitives.
  tube(g, [[-0.5,2.6,0.15],[-0.3,2.35,0.5],[-0.45,2.15,0.78],[-0.2,1.95,0.9]], 0.015, socket, false, 16);
  g.userData.jaw = jaw; return g;
}

export function cat(k) {
  const g = new THREE.Group(), fur = lacquer(0x171421, { roughness: 0.38, clearcoat: 0.35 }), inner = pbr(0x4c2248, 0.7);
  ball(g, fur, [0,-0.9,0], [1.35,2.0,1]); ball(g, fur, [0,1.3,0.15], [1.55,1.3,1.05]);
  for (const side of [-1,1]) {
    const ear = extrude(g, [[side*0.6,2],[side*1.52,3.3],[side*1.62,1.5]], 0.55, fur, 0.14); ear.position.z = -0.2;
    const pink = extrude(g, [[side*0.87,2.08],[side*1.4,2.95],[side*1.43,1.84]], 0.03, inner, 0.03); pink.position.z = 0.38;
    ball(g, k.glow, [side*0.66,1.45,1.02], [0.47,0.24,0.12]); ball(g, fur, [side*0.66,1.45,1.14], [0.055,0.23,0.025]);
    ball(g, fur, [side*0.6,-2.55,0.7], [0.5,0.35,0.75]);
    for (let j=0;j<3;j++) tube(g, [[side*0.35,0.65,1.1],[side*1.25,0.65+j*0.12,1.14],[side*2.2,0.45+j*0.27,1.1]], 0.016, k.metal, false, 16);
  }
  const nose = extrude(g, [[-0.17,0.82],[0.17,0.82],[0,0.64]], 0.08, pbr(0xb76980,0.4), 0.035); nose.position.z = 1.17;
  const tail = tube(g, [[1,-2,0],[2.3,-2.1,0.2],[2.9,-0.8,0.3],[2.6,0.3,0.25],[2.2,0.1,0.3]], 0.25, fur);
  const collar = ring(g, 1.03, 0.11, k.metal, [0,0.15,0.05]); collar.rotation.x = Math.PI/2;
  ball(g, k.glow2, [0,-0.02,1.15], [0.19,0.25,0.09]);
  g.userData.tail = tail; return g;
}

export function spider(k) {
  const g = new THREE.Group(), shell = lacquer(0x252033, { roughness: 0.25, metalness: 0.15, clearcoat: 1 }), joint = pbr(0x8a6a45, 0.3, 0.85);
  ball(g, shell, [0,0.65,-0.5], [1.25,1.65,1.05]); ball(g, shell, [0,-0.75,0.15], [0.9,0.85,0.8]);
  // Copper bands and a glowing hourglass on the abdomen.
  for (let i=0;i<4;i++) { const r = ring(g, 1.02, 0.035, joint, [0,0.3+i*0.37,-0.5]); r.rotation.x=Math.PI/2; r.scale.x=1.12; }
  const mark = extrude(g, [[-0.35,1.3],[0.35,1.3],[0,0.82],[0.35,0.35],[-0.35,0.35],[0,0.82]], 0.035, k.glow,0.025); mark.position.z=0.56;
  for (const side of [-1,1]) for (let i=0;i<3;i++) ball(g,k.glow,[side*(0.2+i*0.22),-0.6+(i%2)*0.22,0.9],[0.1,0.13,0.09]);
  const legs=[];
  for (const side of [-1,1]) for (let i=0;i<4;i++) {
    const pivot=new THREE.Group(), root=[side*0.5,0.2-i*0.35,0], elbow=[side*(2.3+i*0.13),1.4-i*0.65,0.35], tip=[side*(3.7+i*0.15),-1.1-i*0.4,1];
    tube(pivot,[root,elbow,tip],0.09,shell,false,24); ball(pivot,joint,elbow,[0.16,0.16,0.16]);
    tube(pivot,[[elbow[0],elbow[1],elbow[2]+0.08],[tip[0]*0.94,tip[1]+0.2,tip[2]+0.05]],0.022,k.glow2,false,12);
    g.add(pivot); legs.push(pivot);
  }
  for (const side of [-1,1]) tube(g,[[side*0.3,-1.15,0.6],[side*0.5,-1.7,0.9],[side*0.23,-1.85,1.1]],0.08,joint,false,16);
  g.userData.legs=legs; return g;
}

export function eyeball(k, color = '#75b99c') {
  const g = new THREE.Group(), cv=document.createElement('canvas'); cv.width=cv.height=512;
  const c=cv.getContext('2d'), random=rng(71); c.fillStyle='#172c29'; c.fillRect(0,0,512,512);
  const grad=c.createRadialGradient(256,256,20,256,256,250); grad.addColorStop(0,'#c39d47'); grad.addColorStop(0.34,color); grad.addColorStop(0.86,color); grad.addColorStop(1,'#071210'); c.fillStyle=grad; c.fillRect(0,0,512,512);
  for(let i=0;i<850;i++) {
    const a=i/850*TAU,r1=65+random()*20,r2=210+random()*36;
    c.strokeStyle=i%3?'rgba(5,24,24,0.4)':'rgba(224,231,159,0.5)'; c.lineWidth=0.7+random()*1.2;
    c.beginPath();c.moveTo(256+Math.cos(a)*r1,256+Math.sin(a)*r1);c.quadraticCurveTo(256+Math.cos(a+0.02)*140,256+Math.sin(a+0.02)*140,256+Math.cos(a)*r2,256+Math.sin(a)*r2);c.stroke();
  }
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const white=lacquer(0xe2ddd1,{roughness:0.22,clearcoat:1}); ball(g,white,[0,0,0],[1,1,1]);
  const irisMat=lacquer(0xffffff,{map:tex,roughness:0.3,clearcoat:0.6});
  // A spherical cap, including its own UVs, sits above the sclera. No flat decal.
  const geo=new THREE.SphereGeometry(1.014,64,24,0,TAU,0,0.64); geo.rotateX(Math.PI/2);
  const p=geo.attributes.position, uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,0.5+p.getX(i)/1.22,0.5+p.getY(i)/1.22);
  // +90 degrees around X turns the sphere's north pole toward +Z.
  mesh(g,geo,irisMat);
  ball(g,pbr(0x010305,0.12),[0,0,1.013],[0.235,0.235,0.045]);
  // Fine branching vessels are surface tubes, avoiding a flat white ball.
  const vein=pbr(0x984c59,0.6);
  for(let j=0;j<12;j++) {
    const a=j/12*TAU, pts=[];
    for(let s=0;s<6;s++){const r=0.69+s*0.05,ang=a+0.035*Math.sin(s*2+j);pts.push([r*Math.cos(ang),r*Math.sin(ang),Math.sqrt(Math.max(0,1-r*r))+0.006]);}
    tube(g,pts,0.004,vein,false,16);
  }
  return g;
}

export function cauldron(k) {
  const g=new THREE.Group();
  const profile=[[0,-1.5],[0.9,-1.5],[1.8,-1.1],[2.2,-0.4],[2.3,0.4],[2.05,1],[1.85,1.1],[1.8,0.95],[1.95,0.35],[1.75,-0.7],[0,-1.2]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(g,new THREE.LatheGeometry(profile,80),pbr(0x29242c,0.35,0.8));
  const lip=ring(g,1.95,0.12,k.metal,[0,1.06,0]);lip.rotation.x=Math.PI/2;
  const liquid=mesh(g,new THREE.CircleGeometry(1.82,64),lacquer(0x68ca54,{emissive:0x347a14,emissiveIntensity:0.7,roughness:0.15}),[0,0.87,0]);liquid.rotation.x=-Math.PI/2;
  for(const side of [-1,1]) { const h=ring(g,0.5,0.1,k.metal,[side*2.2,0.3,0]);h.rotation.y=Math.PI/2; }
  for(let i=0;i<3;i++){const a=i/3*TAU;ball(g,k.black,[1.5*Math.cos(a),-1.5,1.5*Math.sin(a)],[0.32,0.6,0.32]);}
  for(let i=0;i<18;i++){const a=i/18*TAU;ball(g,k.metal,[2.22*Math.cos(a),0.25,2.22*Math.sin(a)],[0.07,0.07,0.07]);}
  return g;
}

export function sweet(k, i) {
  const g=new THREE.Group(), colors=[0xe76e19,0x8c38c8,0x57b862,0xce3972], paint=lacquer(colors[i%4],{roughness:0.2,clearcoat:1}), cream=lacquer(0xf5d49a);
  if(i%3===0) {
    mesh(g,new THREE.SphereGeometry(0.55,24,16),paint,[0,0,0],[1.5,0.8,0.8]);
    for(const s of [-1,1]) { const end=mesh(g,new THREE.ConeGeometry(0.4,0.55,8),paint,[s*0.96,0,0]);end.rotation.z=s*Math.PI/2; }
    const stripe=ring(g,0.44,0.075,cream);stripe.rotation.y=Math.PI/2;
  } else if(i%3===1) {
    mesh(g,new THREE.CylinderGeometry(0.7,0.7,0.2,40),paint).rotation.x=Math.PI/2;
    const points=[];for(let j=0;j<100;j++){const a=j/99*TAU*3,r=j/99*0.62;points.push([r*Math.cos(a),r*Math.sin(a),0.13]);}
    tube(g,points,0.055,cream,false,80);mesh(g,new THREE.CylinderGeometry(0.055,0.055,1.7,8),k.metal,[0,-1.25,0]);
  } else {
    const prof=[[0,0.8],[0.17,0.65],[0.4,0.05],[0.58,-0.65],[0,-0.65]].map(([x,y])=>new THREE.Vector2(x,y));
    const geo=new THREE.LatheGeometry(prof,3), attr=geo.attributes.position, cols=[];
    for(let j=0;j<attr.count;j++){const y=attr.getY(j),c=new THREE.Color(y>0.45?0xffe9bc:y> -0.2?0xeab32a:0xe35b0c);cols.push(c.r,c.g,c.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));mesh(g,geo,lacquer(0xffffff,{vertexColors:true,roughness:0.35}));
  }
  return g;
}

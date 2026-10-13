import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import fs from 'node:fs/promises';
// Node adapter for the browser exporter; generated assets have no external dependencies.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(result).toString('base64'); this.onloadend?.(); }); }
};
const out = new URL('../assets/models/campaign/', import.meta.url);
await fs.mkdir(out, { recursive: true });
function material(color, emissive = false) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...(emissive ? { emissive: color, emissiveIntensity: 0.55 } : {}) }); }
function part(group, geometry, color, x, y, z, scale, emissive = false) {
  const mesh = new THREE.Mesh(geometry, material(color, emissive)); mesh.position.set(x,y,z);
  if (scale) mesh.scale.set(...scale); group.add(mesh); return mesh;
}
const ball = (r=1) => new THREE.IcosahedronGeometry(r, 1);
const box = () => new THREE.BoxGeometry(1,1,1);
const cone = () => new THREE.ConeGeometry(1,1,6);
function eyes(g,y,z,spread=.18) { for (const x of [-spread,spread]) { part(g,ball(), '#f6e7b3',x,y,z,[.10,.12,.06]); part(g,ball(),'#11160f',x,y,z+.052,[.035,.065,.025]); } }
function makeModel(name) {
  const root = new THREE.Group(); root.name='Creature'; const g = new THREE.Group(); g.name='Body'; root.add(g);
  if(name==='moss-slime') {
    part(g,ball(),'#679b42',0,.35,0,[.55,.38,.48]); part(g,ball(),'#98bc59',-.15,.57,-.12,[.24,.16,.22]); eyes(g,.43,.40);
    for (const x of [-.18,.14]) part(g,cone(),'#a9d571',x,.79,-.12,[.1,.3,.08]);
  } else if(name==='root-guardian') {
    part(g,box(),'#685039',0,.6,0,[.55,.8,.4]);part(g,ball(),'#748249',0,1.08,0,[.36,.34,.32]);eyes(g,1.09,.29);
    for(const side of [-1,1]) {
      part(g,box(),'#55422f',side*.22,.12,.08,[.23,.3,.36]);
      const arm=part(g,box(),'#82663e',side*.45,.65,0,[.23,.66,.23]);arm.rotation.z=side*.25;
      part(g,ball(),'#5f833e',side*.31,1.25,-.04,[.26,.18,.25]);
      part(g,cone(),'#b5aa69',side*.3,1.48,0,[.07,.45,.08]);
    }
  } else if(name==='eclipse-warden') {
    part(g,box(),'#353b35',0,.72,0,[.66,.92,.43]);part(g,ball(),'#6c7061',0,1.37,0,[.33,.34,.29]);
    for (const side of [-1,1]) {
      part(g,box(),'#252b28',side*.22,.16,.06,[.28,.36,.4]);part(g,ball(),'#74715b',side*.51,1.0,0,[.32,.27,.28]);
      part(g,box(),'#4e5549',side*.51,.61,0,[.26,.58,.28]);part(g,cone(),'#d39b32',side*.23,1.72,0,[.12,.46,.1]);
      part(g,box(),'#efb047',side*.12,1.4,.27,[.13,.045,.025],true);
    }
    part(g,new THREE.OctahedronGeometry(.2),'#e1a848',0,.85,.27,[.8,1.4,.7],true);
    const blade=part(g,box(),'#9d9c81',.72,.6,.1,[.13,1.1,.1]);blade.rotation.z=-.2;
  } else if(name==='campfire') {
    for(let i=0;i<8;i++){const a=i*Math.PI/4;part(g,ball(),'#777567',Math.sin(a)*.37,.1,Math.cos(a)*.37,[.14,.1,.13]);}
    for(const a of [-.7,.7]){const log=part(g,box(),'#58412c',0,.14,0,[.65,.12,.15]);log.rotation.y=a;}
    part(g,cone(),'#c65e25',0,.4,0,[.25,.62,.25],true);part(g,cone(),'#f8cb65',.03,.3,.07,[.13,.37,.13],true);
  } else {
    part(g,box(),'#6e735e',0,.34,0,[.45,.7,.28]);part(g,box(),'#d39b32',0,.48,.15,[.3,.04,.02],true);
    part(g,box(),'#d39b32',0,.4,.15,[.04,.2,.02],true);part(g,ball(),'#6d8343',.23,.1,0,[.2,.13,.18]);
  }
  const animations = name==='campfire'||name==='waystone' ? [] : [
    new THREE.AnimationClip('Idle_A',2,[new THREE.NumberKeyframeTrack('Body.position[y]',[0,1,2],[0,.035,0])]),
    new THREE.AnimationClip('Walking_A',.5,[new THREE.NumberKeyframeTrack('Body.position[y]',[0,.25,.5],[0,.10,0])]),
    new THREE.AnimationClip('Hit_A',.6,[new THREE.QuaternionKeyframeTrack('Body.quaternion',[0,.2,.6],[0,0,0,1, Math.sin(.15),0,0,Math.cos(.15), 0,0,0,1])]),
    new THREE.AnimationClip('Hit_B',.5,[new THREE.QuaternionKeyframeTrack('Body.quaternion',[0,.15,.5],[0,0,0,1, 0,0,-Math.sin(.1),Math.cos(.1), 0,0,0,1])]),
    new THREE.AnimationClip('Death_A',.8,[new THREE.NumberKeyframeTrack('Body.scale[y]',[0,.8],[1,.05])]),
  ];
  return {root, animations};
}
for (const name of ['campfire','waystone']) {
  const {root,animations}=makeModel(name);
  const result=await new GLTFExporter().parseAsync(root,{binary:true,animations});
  await fs.writeFile(new URL(name+'.glb',out),Buffer.from(result));
  console.log(name, result.byteLength);
}

let map, geo, selectedIndex=-1, polygon=null, vertexMarkers=[], centerMarker=null;
let coords=[], undoStack=[], mode="view";

const $=id=>document.getElementById(id);
function status(t){$("status").textContent=t}
function loadKakao(){
 return new Promise((res,rej)=>{
  if(window.kakao?.maps)return kakao.maps.load(res);
  const key=window.MAP_CONFIG?.kakaoJavaScriptKey;
  if(!key)return rej(new Error("map-config.js의 카카오 JavaScript 키를 확인하세요."));
  const s=document.createElement("script");
  s.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
  s.onload=()=>kakao.maps.load(res); s.onerror=()=>rej(new Error("카카오맵 SDK 로드 실패"));
  document.head.appendChild(s);
 });
}
function initMap(){
 map=new kakao.maps.Map($("map"),{center:new kakao.maps.LatLng(37.15,127.05),level:7});
}
function clearOverlays(){
 if(polygon) polygon.setMap(null); polygon=null;
 vertexMarkers.forEach(m=>m.setMap(null)); vertexMarkers=[];
 if(centerMarker)centerMarker.setMap(null); centerMarker=null;
}
function ll(c){return new kakao.maps.LatLng(c[1],c[0])}
function clone(a){return JSON.parse(JSON.stringify(a))}
function normalizeRing(r){
 let a=clone(r);
 if(a.length>1 && a[0][0]===a[a.length-1][0] && a[0][1]===a[a.length-1][1]) a.pop();
 return a;
}
function closed(a){let r=clone(a); if(r.length)r.push(clone(r[0])); return r}
function getName(f,i){
 const p=f.properties||{};
 return p.zoneName||p.displayName||p.name||p.districtName||`Feature ${i+1}`;
}
function selectFeature(i){
 clearOverlays(); mode="view"; setActive();
 selectedIndex=Number(i); const f=geo.features[selectedIndex];
 if(!f?.geometry || f.geometry.type!=="Polygon"){status("현재 편집기는 Polygon 형식만 지원합니다.");return}
 coords=normalizeRing(f.geometry.coordinates[0]); undoStack=[];
 drawPolygon(true); enableButtons(true);
 status(`${getName(f,selectedIndex)} 선택됨. '경계 편집'을 누르면 꼭짓점을 움직일 수 있습니다.`);
}
function drawPolygon(fit=false){
 if(polygon)polygon.setMap(null);
 polygon=new kakao.maps.Polygon({
  map, path:coords.map(ll), strokeWeight:3, strokeColor:"#d33", strokeOpacity:.9,
  fillColor:"#ffcc66", fillOpacity:.28
 });
 if(fit){
  const b=new kakao.maps.LatLngBounds(); coords.forEach(c=>b.extend(ll(c))); map.setBounds(b,40,40,40,40);
 }
 if(mode!=="view") rebuildHandles();
}
function pushUndo(){undoStack.push(clone(coords)); if(undoStack.length>50)undoStack.shift(); $("undoBtn").disabled=false}
function rebuildHandles(){
 vertexMarkers.forEach(m=>m.setMap(null)); vertexMarkers=[];
 if(centerMarker){centerMarker.setMap(null);centerMarker=null}
 if(mode==="edit" || mode==="delete"){
  coords.forEach((c,idx)=>{
   const m=new kakao.maps.Marker({map,position:ll(c),draggable:mode==="edit"});
   m.__idx=idx;
   if(mode==="edit"){
    kakao.maps.event.addListener(m,"dragstart",()=>pushUndo());
    kakao.maps.event.addListener(m,"dragend",()=>{
     const p=m.getPosition(); coords[m.__idx]=[p.getLng(),p.getLat()];
     polygon.setPath(coords.map(ll)); rebuildHandles();
     status(`꼭짓점 ${m.__idx+1} 이동 완료`);
    });
   }else{
    kakao.maps.event.addListener(m,"click",()=>{
     if(coords.length<=3){status("폴리곤은 최소 3개의 꼭짓점이 필요합니다.");return}
     pushUndo(); coords.splice(m.__idx,1); drawPolygon(); status("꼭짓점을 삭제했습니다.");
    });
   }
   vertexMarkers.push(m);
  });
 }
 if(mode==="move"){
  const c=center(coords);
  centerMarker=new kakao.maps.Marker({map,position:ll(c),draggable:true});
  kakao.maps.event.addListener(centerMarker,"dragstart",()=>{pushUndo(); centerMarker.__start=centerMarker.getPosition()});
  kakao.maps.event.addListener(centerMarker,"dragend",()=>{
   const s=centerMarker.__start, e=centerMarker.getPosition();
   const dx=e.getLng()-s.getLng(), dy=e.getLat()-s.getLat();
   coords=coords.map(p=>[p[0]+dx,p[1]+dy]); drawPolygon();
   status("폴리곤 전체를 이동했습니다.");
  });
 }
}
function center(a){return [a.reduce((s,p)=>s+p[0],0)/a.length,a.reduce((s,p)=>s+p[1],0)/a.length]}
function nearestSegment(pt){
 let best=0,bd=Infinity;
 for(let i=0;i<coords.length;i++){
  const a=coords[i],b=coords[(i+1)%coords.length];
  const vx=b[0]-a[0],vy=b[1]-a[1], wx=pt[0]-a[0],wy=pt[1]-a[1];
  const vv=vx*vx+vy*vy; let t=vv?((wx*vx+wy*vy)/vv):0; t=Math.max(0,Math.min(1,t));
  const x=a[0]+t*vx,y=a[1]+t*vy,d=(pt[0]-x)**2+(pt[1]-y)**2;
  if(d<bd){bd=d;best=i}
 } return best;
}
kakaoAddListenerReady=false;
function setMode(m){
 mode=m; setActive(); drawPolygon();
 if(m==="edit")status("꼭짓점을 드래그해 경계를 수정하세요.");
 if(m==="move")status("폴리곤 중앙의 마커를 드래그하면 전체 경계가 이동합니다.");
 if(m==="add")status("지도에서 경계선 근처 원하는 위치를 클릭하면 가장 가까운 선 사이에 꼭짓점이 추가됩니다.");
 if(m==="delete")status("삭제할 꼭짓점 마커를 클릭하세요.");
}
function setActive(){
 ["editBtn","moveBtn","addBtn","delBtn"].forEach(id=>$(id).classList.remove("active"));
 const ids={edit:"editBtn",move:"moveBtn",add:"addBtn",delete:"delBtn"}; if(ids[mode])$(ids[mode]).classList.add("active");
}
function enableButtons(v){["editBtn","moveBtn","addBtn","delBtn","saveBtn"].forEach(id=>$(id).disabled=!v)}
$("file").addEventListener("change",async e=>{
 const f=e.target.files[0]; if(!f)return;
 try{
  geo=JSON.parse(await f.text());
  if(!Array.isArray(geo.features))throw new Error("FeatureCollection이 아닙니다.");
  const s=$("featureSelect"); s.innerHTML="";
  geo.features.forEach((ft,i)=>{
   if(ft.geometry?.type==="Polygon"){
    const o=document.createElement("option");o.value=i;o.textContent=getName(ft,i);s.appendChild(o);
   }
  });
  s.disabled=false;
  if(s.options.length){selectFeature(s.value)} else status("편집 가능한 Polygon이 없습니다.");
 }catch(err){status("GeoJSON 읽기 실패: "+err.message)}
});
$("featureSelect").addEventListener("change",e=>selectFeature(e.target.value));
$("editBtn").onclick=()=>setMode("edit");
$("moveBtn").onclick=()=>setMode("move");
$("addBtn").onclick=()=>setMode("add");
$("delBtn").onclick=()=>setMode("delete");
$("undoBtn").onclick=()=>{
 if(!undoStack.length)return; coords=undoStack.pop(); drawPolygon(); $("undoBtn").disabled=!undoStack.length; status("한 단계 되돌렸습니다.");
};
$("saveBtn").onclick=()=>{
 if(selectedIndex>=0)geo.features[selectedIndex].geometry.coordinates[0]=closed(coords);
 const blob=new Blob([JSON.stringify(geo,null,2)],{type:"application/geo+json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="development.geojson";a.click();URL.revokeObjectURL(a.href);
 status("수정된 development.geojson을 저장했습니다. 기존 public/development/data/development.geojson에 덮어쓰세요.");
};
(async()=>{
 try{
  await loadKakao(); initMap();
  kakao.maps.event.addListener(map,"click",e=>{
   if(mode!=="add"||selectedIndex<0)return;
   const p=[e.latLng.getLng(),e.latLng.getLat()],i=nearestSegment(p);
   pushUndo(); coords.splice(i+1,0,p); drawPolygon(); status(`꼭짓점을 ${i+2}번째 위치에 추가했습니다.`);
  });
 }catch(e){status("지도 초기화 실패: "+e.message+" (편집기는 배포된 사이트의 public/tools/ 위치에서 실행하세요.)")}
})();
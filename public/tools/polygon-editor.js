let map, geo, selectedIndex=-1, polygon=null, vertexMarkers=[], centerMarker=null;
let coords=[], undoStack=[], mode="view", drawingCoords=[];

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
function initMap(){map=new kakao.maps.Map($("map"),{center:new kakao.maps.LatLng(37.15,127.05),level:7});}
function clearOverlays(){if(polygon)polygon.setMap(null);polygon=null;vertexMarkers.forEach(m=>m.setMap(null));vertexMarkers=[];if(centerMarker)centerMarker.setMap(null);centerMarker=null;}
function ll(c){return new kakao.maps.LatLng(c[1],c[0])}
function clone(a){return JSON.parse(JSON.stringify(a))}
function normalizeRing(r){let a=clone(r||[]);if(a.length>1&&a[0][0]===a[a.length-1][0]&&a[0][1]===a[a.length-1][1])a.pop();return a}
function closed(a){let r=clone(a);if(r.length)r.push(clone(r[0]));return r}
function projectName(f){const p=f.properties||{};return p.district||p.zoneName||"(이름 없음)"}
function featureLabel(f,i){
 const p=f.properties||{};
 if(p.featureType==="district") return "지구 전체 경계";
 if(p.featureType==="block") return `블록 · ${p.blockName||("Feature "+(i+1))}${p.blockType?" · "+p.blockType:""}`;
 return `${p.featureType||"기타"} · ${p.blockName||p.name||("Feature "+(i+1))}`;
}
function populateProjects(){
 const s=$("projectSelect"), names=[...new Set(geo.features.filter(f=>f.geometry?.type==="Polygon").map(projectName))].sort((a,b)=>a.localeCompare(b,"ko"));
 s.innerHTML='<option value="">① 개발사업 선택</option>';
 names.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;s.appendChild(o)});
 s.disabled=false;$("featureSelect").disabled=true;$("newBtn").disabled=false;
}
function populateFeatures(name){
 const s=$("featureSelect");s.innerHTML='<option value="">② 경계/블록 선택</option>';
 geo.features.forEach((f,i)=>{if(f.geometry?.type==="Polygon"&&projectName(f)===name){const o=document.createElement("option");o.value=i;o.textContent=featureLabel(f,i);s.appendChild(o)}});
 s.disabled=false; clearOverlays(); selectedIndex=-1; enableEdit(false);
 status(`${name}: 수정할 '지구 전체 경계' 또는 블록을 선택하세요.`);
}
function selectFeature(i){
 clearOverlays();mode="view";setActive();selectedIndex=Number(i);const f=geo.features[selectedIndex];
 coords=normalizeRing(f.geometry.coordinates[0]);undoStack=[];drawPolygon(true);enableEdit(true);
 status(`${projectName(f)} / ${featureLabel(f,selectedIndex)} 선택됨.`);
}
function drawPolygon(fit=false){
 if(polygon)polygon.setMap(null);
 if(!coords.length)return;
 polygon=new kakao.maps.Polygon({map,path:coords.map(ll),strokeWeight:3,strokeColor:"#d33",strokeOpacity:.9,fillColor:"#ffcc66",fillOpacity:.28});
 if(fit){const b=new kakao.maps.LatLngBounds();coords.forEach(c=>b.extend(ll(c)));map.setBounds(b,40,40,40,40)}
 if(mode!=="view"&&mode!=="new")rebuildHandles();
}
function pushUndo(){undoStack.push(clone(coords));if(undoStack.length>50)undoStack.shift();$("undoBtn").disabled=false}
function rebuildHandles(){
 vertexMarkers.forEach(m=>m.setMap(null));vertexMarkers=[];if(centerMarker){centerMarker.setMap(null);centerMarker=null}
 if(mode==="edit"||mode==="delete"){
  coords.forEach((c,idx)=>{
   const m=new kakao.maps.Marker({map,position:ll(c),draggable:mode==="edit"});m.__idx=idx;
   if(mode==="edit"){kakao.maps.event.addListener(m,"dragstart",()=>pushUndo());kakao.maps.event.addListener(m,"dragend",()=>{const p=m.getPosition();coords[m.__idx]=[p.getLng(),p.getLat()];polygon.setPath(coords.map(ll));rebuildHandles();status(`꼭짓점 ${m.__idx+1} 이동 완료`);});}
   else{kakao.maps.event.addListener(m,"click",()=>{if(coords.length<=3){status("폴리곤은 최소 3개의 꼭짓점이 필요합니다.");return}pushUndo();coords.splice(m.__idx,1);drawPolygon();status("꼭짓점을 삭제했습니다.");});}
   vertexMarkers.push(m);
  });
 }
 if(mode==="move"){
  const c=center(coords);centerMarker=new kakao.maps.Marker({map,position:ll(c),draggable:true});
  kakao.maps.event.addListener(centerMarker,"dragstart",()=>{pushUndo();centerMarker.__start=centerMarker.getPosition()});
  kakao.maps.event.addListener(centerMarker,"dragend",()=>{const s=centerMarker.__start,e=centerMarker.getPosition(),dx=e.getLng()-s.getLng(),dy=e.getLat()-s.getLat();coords=coords.map(p=>[p[0]+dx,p[1]+dy]);drawPolygon();status("폴리곤 전체를 이동했습니다.");});
 }
}
function center(a){return[a.reduce((s,p)=>s+p[0],0)/a.length,a.reduce((s,p)=>s+p[1],0)/a.length]}
function nearestSegment(pt){let best=0,bd=Infinity;for(let i=0;i<coords.length;i++){const a=coords[i],b=coords[(i+1)%coords.length],vx=b[0]-a[0],vy=b[1]-a[1],wx=pt[0]-a[0],wy=pt[1]-a[1],vv=vx*vx+vy*vy;let t=vv?((wx*vx+wy*vy)/vv):0;t=Math.max(0,Math.min(1,t));const x=a[0]+t*vx,y=a[1]+t*vy,d=(pt[0]-x)**2+(pt[1]-y)**2;if(d<bd){bd=d;best=i}}return best}
function setMode(m){mode=m;setActive();drawPolygon();const msg={edit:"꼭짓점을 드래그해 경계를 수정하세요.",move:"중앙 마커를 드래그하면 전체 경계가 이동합니다.",add:"지도에서 원하는 위치를 클릭하면 가장 가까운 선 사이에 꼭짓점이 추가됩니다.",delete:"삭제할 꼭짓점 마커를 클릭하세요."};status(msg[m]||"")}
function setActive(){["editBtn","moveBtn","addBtn","delBtn","newBtn"].forEach(id=>$(id).classList.remove("active"));const ids={edit:"editBtn",move:"moveBtn",add:"addBtn",delete:"delBtn",new:"newBtn"};if(ids[mode])$(ids[mode]).classList.add("active")}
function enableEdit(v){["editBtn","moveBtn","addBtn","delBtn","saveBtn"].forEach(id=>$(id).disabled=!v)}
function startNew(){
 clearOverlays();selectedIndex=-1;coords=[];drawingCoords=[];mode="new";setActive();
 $("finishBtn").hidden=false;$("cancelNewBtn").hidden=false;enableEdit(false);$("saveBtn").disabled=true;
 status("새 지구경계 그리기: 지도에서 경계 꼭짓점을 순서대로 클릭하세요. 3개 이상 찍은 뒤 '그리기 완료'.");
}
function drawDraft(){
 coords=clone(drawingCoords);drawPolygon();
 vertexMarkers.forEach(m=>m.setMap(null));vertexMarkers=[];
 drawingCoords.forEach((c,i)=>{const m=new kakao.maps.Marker({map,position:ll(c)});vertexMarkers.push(m)});
}
function finishNew(){
 if(drawingCoords.length<3){status("최소 3개의 꼭짓점을 찍어주세요.");return}
 const name=prompt("새 개발사업/지구 이름을 입력하세요. 예: 원동8구역");
 if(!name)return;
 const city=prompt("도시를 입력하세요. (화성 또는 오산)","오산")||"";
 const feature={type:"Feature",properties:{featureType:"district",zoneName:name,city:city,source:"manual-editor",geometry_accuracy:"수동 작성"},geometry:{type:"Polygon",coordinates:[closed(drawingCoords)]}};
 geo.features.push(feature); mode="view";$("finishBtn").hidden=true;$("cancelNewBtn").hidden=true;populateProjects();
 $("projectSelect").value=name;populateFeatures(name);
 const idx=geo.features.length-1;$("featureSelect").value=String(idx);selectFeature(idx);
 $("saveBtn").disabled=false;status(`${name} 새 지구경계를 만들었습니다. 필요하면 꼭짓점을 더 수정한 뒤 GeoJSON 저장을 누르세요.`);
}
function cancelNew(){drawingCoords=[];coords=[];clearOverlays();mode="view";$("finishBtn").hidden=true;$("cancelNewBtn").hidden=true;setActive();status("새 경계 그리기를 취소했습니다.");}

$("file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{geo=JSON.parse(await f.text());if(!Array.isArray(geo.features))throw new Error("FeatureCollection이 아닙니다.");populateProjects();$("saveBtn").disabled=false;status(`GeoJSON ${geo.features.length}개 Feature를 불러왔습니다. 개발사업을 선택하세요.`)}catch(err){status("GeoJSON 읽기 실패: "+err.message)}});
$("projectSelect").addEventListener("change",e=>{if(e.target.value)populateFeatures(e.target.value)});
$("featureSelect").addEventListener("change",e=>{if(e.target.value!=="")selectFeature(e.target.value)});
$("editBtn").onclick=()=>setMode("edit");$("moveBtn").onclick=()=>setMode("move");$("addBtn").onclick=()=>setMode("add");$("delBtn").onclick=()=>setMode("delete");
$("newBtn").onclick=startNew;$("finishBtn").onclick=finishNew;$("cancelNewBtn").onclick=cancelNew;
$("undoBtn").onclick=()=>{if(!undoStack.length)return;coords=undoStack.pop();drawPolygon();$("undoBtn").disabled=!undoStack.length;status("한 단계 되돌렸습니다.");};
$("saveBtn").onclick=()=>{if(selectedIndex>=0)geo.features[selectedIndex].geometry.coordinates[0]=closed(coords);const blob=new Blob([JSON.stringify(geo,null,2)],{type:"application/geo+json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="development.geojson";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);status("수정된 development.geojson을 저장했습니다.");};

(async()=>{try{await loadKakao();initMap();kakao.maps.event.addListener(map,"click",e=>{const p=[e.latLng.getLng(),e.latLng.getLat()];if(mode==="new"){drawingCoords.push(p);drawDraft();status(`새 경계: 꼭짓점 ${drawingCoords.length}개. 계속 클릭하거나 '그리기 완료'를 누르세요.`);return}if(mode!=="add"||selectedIndex<0)return;const i=nearestSegment(p);pushUndo();coords.splice(i+1,0,p);drawPolygon();status(`꼭짓점을 ${i+2}번째 위치에 추가했습니다.`);});}catch(e){status("지도 초기화 실패: "+e.message)}})();
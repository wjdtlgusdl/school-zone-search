let map, geo, selectedIndex=-1, polygon=null, vertexMarkers=[], centerMarker=null;
let coords=[], undoStack=[], mode="view", drawingCoords=[];
let backgroundPolygons=[], backgroundVisible=true, schoolGeo=null, selectedSource="development", drawingType="district";

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
function clearBackground(){backgroundPolygons.forEach(p=>p.setMap(null));backgroundPolygons=[];}
function drawBackground(){
 clearBackground();if(!backgroundVisible||!geo)return;
 const entries=[...geo.features.map((f,i)=>({f,i,source:"development"})),...(schoolGeo?.features||[]).map((f,i)=>({f,i,source:"school"}))];
 const current=$('projectSelect').value;
 entries.forEach(({f,i,source})=>{
  if(source===selectedSource&&i===selectedIndex||f.geometry?.type!=="Polygon")return;
  const p=f.properties||{}, name=projectName(f);
  if(current&&name!==current)return;
  const ring=normalizeRing(f.geometry.coordinates[0]);if(ring.length<3)return;
  const isSchool=source==="school",isDistrict=p.featureType==="district";
  backgroundPolygons.push(new kakao.maps.Polygon({map,path:ring.map(ll),strokeWeight:isDistrict?2:2.5,strokeColor:isSchool?"#1463ed":isDistrict?"#54728f":"#d44747",strokeOpacity:.85,fillColor:isSchool?"#60a5fa":isDistrict?"#8fa9bd":"#f59e7a",fillOpacity:isDistrict?.06:.16,clickable:false}));
 });
}
function refreshBackground(){drawBackground();$("bgBtn").textContent=backgroundVisible?"주변 경계 숨기기":"주변 경계 보기";}
function ll(c){return new kakao.maps.LatLng(c[1],c[0])}
function clone(a){return JSON.parse(JSON.stringify(a))}
function normalizeRing(r){let a=clone(r||[]);if(a.length>1&&a[0][0]===a[a.length-1][0]&&a[0][1]===a[a.length-1][1])a.pop();return a}
function closed(a){let r=clone(a);if(r.length)r.push(clone(r[0]));return r}
function projectName(f){const p=f.properties||{};return p.district||p.zoneName||"(이름 없음)"}
function featureLabel(f,i){
 const p=f.properties||{};
 if(p.status==="미설립"&&p.level) return `학교용지 · ${p.label||p.school_name||"이름 없음"}`;
 if(p.featureType==="district") return "지구 전체 경계";
 if(p.featureType==="block") return `블록 · ${p.blockName||("Feature "+(i+1))}${p.blockType?" · "+p.blockType:""}`;
 return `${p.featureType||"기타"} · ${p.blockName||p.name||("Feature "+(i+1))}`;
}
function populateProjects(){
 const s=$("projectSelect"), names=[...new Set([...geo.features,...(schoolGeo?.features||[])].filter(f=>f.geometry?.type==="Polygon").map(projectName))].sort((a,b)=>a.localeCompare(b,"ko"));
 s.innerHTML='<option value="">① 개발사업 선택</option>';
 names.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;s.appendChild(o)});
 s.disabled=false;$("featureSelect").disabled=true;$("newBtn").disabled=false;$("bgBtn").disabled=false;refreshBackground();
}
function populateFeatures(name){
 commitSelected();const s=$("featureSelect");s.innerHTML='<option value="">② 경계/블록/학교 선택</option>';
 for(const [source,items] of [["development",geo.features],["school",schoolGeo?.features||[]]])items.forEach((f,i)=>{if(f.geometry?.type==="Polygon"&&projectName(f)===name){const o=document.createElement("option");o.value=`${source}:${i}`;o.textContent=featureLabel(f,i);s.appendChild(o)}});
 s.disabled=false;clearOverlays();selectedIndex=-1;enableEdit(false);refreshBackground();status(`${name}: 편집할 경계·공동주택·학교용지를 선택하거나 새로 그리세요.`);
}
function activeCollection(){return selectedSource==="school"?schoolGeo:geo}
function commitSelected(){if(selectedIndex<0||!coords.length)return;const f=activeCollection()?.features[selectedIndex];if(f)f.geometry.coordinates[0]=closed(coords)}
function selectFeature(key){
 commitSelected();clearOverlays();mode="view";setActive();const [source,index]=String(key).split(":");selectedSource=source;selectedIndex=Number(index);const f=activeCollection().features[selectedIndex];
 coords=normalizeRing(f.geometry.coordinates[0]);undoStack=[];$("undoBtn").disabled=true;refreshBackground();drawPolygon(true);enableEdit(true);
 status(`${projectName(f)} / ${featureLabel(f,selectedIndex)} 선택됨.`);
}
function drawPolygon(fit=false){
 if(polygon)polygon.setMap(null);
 if(!coords.length)return;
 const school=selectedSource==="school";polygon=new kakao.maps.Polygon({map,path:coords.map(ll),strokeWeight:3,strokeColor:school?"#1463ed":"#d33",strokeOpacity:.9,fillColor:school?"#93c5fd":"#ffcc66",fillOpacity:.28});
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
 if(!geo){status("개발사업 GeoJSON을 먼저 불러오세요.");return;}
 commitSelected();drawingType=$("newType").value; if(drawingType==="school"&&!schoolGeo){status("학교용지 파일을 먼저 불러오거나 ‘학교용지 새 파일 생성’을 누르세요.");return;}
 clearOverlays();selectedIndex=-1;selectedSource=drawingType==="school"?"school":"development";coords=[];drawingCoords=[];mode="new";setActive();refreshBackground();
 $("finishBtn").hidden=false;$("cancelNewBtn").hidden=false;enableEdit(false);$("saveBtn").disabled=true;
 status("새 "+({district:"지구 경계",block:"공동주택 블록",school:"학교용지"}[drawingType])+" 그리기: 지도에서 꼭짓점을 순서대로 클릭하세요. 3개 이상 찍은 뒤 그리기 완료.");
}
function drawDraft(){
 coords=clone(drawingCoords);drawPolygon();
 vertexMarkers.forEach(m=>m.setMap(null));vertexMarkers=[];
 drawingCoords.forEach((c,i)=>{const m=new kakao.maps.Marker({map,position:ll(c)});vertexMarkers.push(m)});
}
function finishNew(){
 if(drawingCoords.length<3){status("최소 3개의 꼭짓점을 찍어주세요.");return}
 const existing=$('projectSelect').value;
 const name=existing||prompt("개발사업/지구 이름을 입력하세요. 예: 원동8구역");if(!name)return;
 const city=existing?(geo.features.find(f=>projectName(f)===name)?.properties?.city||""):(prompt("도시를 입력하세요. (화성 또는 오산)","화성")||"");
 let props;
 if(drawingType==="district")props={featureType:"district",zoneName:name,city,source:"manual-editor",geometry_accuracy:"수동 작성"};
 else if(drawingType==="block"){
  const blockName=prompt("공동주택 블록 이름 (예: A1)","A1");if(!blockName)return;
  props={featureType:"block",zoneName:name,district:name,city,blockName,blockType:"공동주택용지",source:"manual-editor",geometry_accuracy:"수동 작성"};
 }else{
  const label=prompt("학교용지 표시 이름 (예: 초1, 중1, 고1)","초1");if(!label)return;
  const level=label.startsWith("중")?"중학교":label.startsWith("고")?"고등학교":label.startsWith("유")?"유치원":"초등학교";
  props={label,school_name:"",level,status:"미설립",district:name,city,geometry_basis:"폴리곤 편집기 수동 작성",source:"manual-editor"};
 }
 const target=drawingType==="school"?schoolGeo:geo;
 target.features.push({type:"Feature",properties:props,geometry:{type:"Polygon",coordinates:[closed(drawingCoords)]}});
 mode="view";$("finishBtn").hidden=true;$("cancelNewBtn").hidden=true;
 populateProjects();$("projectSelect").value=name;populateFeatures(name);
 const idx=target.features.length-1;$("featureSelect").value=`${drawingType==="school"?"school":"development"}:${idx}`;selectFeature($("featureSelect").value);
 status(`${name}의 ${featureLabel(target.features[idx],idx)} 추가 완료. 각 GeoJSON을 저장하세요.`);
}
function cancelNew(){drawingCoords=[];coords=[];clearOverlays();mode="view";$("finishBtn").hidden=true;$("cancelNewBtn").hidden=true;setActive();status("새 경계 그리기를 취소했습니다.");}

$("file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{geo=JSON.parse(await f.text());if(!Array.isArray(geo.features))throw new Error("FeatureCollection이 아닙니다.");populateProjects();$("saveBtn").disabled=false;status(`GeoJSON ${geo.features.length}개 Feature를 불러왔습니다. 개발사업을 선택하세요.`)}catch(err){status("GeoJSON 읽기 실패: "+err.message)}});
$("projectSelect").addEventListener("change",e=>{if(e.target.value)populateFeatures(e.target.value)});
$("featureSelect").addEventListener("change",e=>{if(e.target.value!=="")selectFeature(e.target.value)});
$("editBtn").onclick=()=>setMode("edit");$("moveBtn").onclick=()=>setMode("move");$("addBtn").onclick=()=>setMode("add");$("delBtn").onclick=()=>setMode("delete");
$("newBtn").onclick=startNew;$("finishBtn").onclick=finishNew;$("cancelNewBtn").onclick=cancelNew;
$("bgBtn").onclick=()=>{backgroundVisible=!backgroundVisible;refreshBackground();status(backgroundVisible?"선택한 사업지구의 경계·공동주택·학교용지를 참고용으로 표시합니다.":"참고용 폴리곤을 숨겼습니다.");};
$("undoBtn").onclick=()=>{if(!undoStack.length)return;coords=undoStack.pop();drawPolygon();$("undoBtn").disabled=!undoStack.length;status("한 단계 되돌렸습니다.");};
function downloadGeo(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/geo+json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("saveBtn").onclick=()=>{commitSelected();downloadGeo(geo,"development.geojson");status("development.geojson을 저장했습니다. 학교용지를 수정했다면 학교용지 파일도 별도로 저장하세요.")};
$("schoolFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.features))throw Error("FeatureCollection이 아닙니다.");commitSelected();schoolGeo=data;$("schoolSaveBtn").disabled=false;populateProjects();status(`학교용지 ${data.features.length}개를 불러왔습니다. 개발사업을 다시 선택하세요.`)}catch(err){status("학교용지 파일 읽기 실패: "+err.message)}});
$("newSchoolFileBtn").onclick=()=>{if(schoolGeo&&!confirm("현재 불러온 학교용지 데이터를 새 빈 파일로 교체할까요?"))return;commitSelected();schoolGeo={type:"FeatureCollection",features:[]};$("schoolSaveBtn").disabled=false;populateProjects();status("빈 학교용지 파일을 준비했습니다. 개발사업을 선택하고 새 학교용지를 그리세요.")};
$("schoolSaveBtn").onclick=()=>{if(!schoolGeo)return;commitSelected();downloadGeo(schoolGeo,"planned-schools-additional.geojson");status("학교용지 파일을 저장했습니다. GitHub에 별도로 덮어쓰세요.")};

(async()=>{try{await loadKakao();initMap();kakao.maps.event.addListener(map,"click",e=>{const p=[e.latLng.getLng(),e.latLng.getLat()];if(mode==="new"){drawingCoords.push(p);drawDraft();status(`새 경계: 꼭짓점 ${drawingCoords.length}개. 계속 클릭하거나 '그리기 완료'를 누르세요.`);return}if(mode!=="add"||selectedIndex<0)return;const i=nearestSegment(p);pushUndo();coords.splice(i+1,0,p);drawPolygon();status(`꼭짓점을 ${i+2}번째 위치에 추가했습니다.`);});}catch(e){status("지도 초기화 실패: "+e.message)}})();
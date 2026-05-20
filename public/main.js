const APP_VERSION = "20260520-osm-hwaseong-osan";

const DATA_PATHS = {
  core: `/data/core.json?v=${APP_VERSION}`,
  roads: `/data/roads.json?v=${APP_VERSION}`,
  suggestions: `/data/suggestions.json?v=${APP_VERSION}`,
  osmBuildings: [`/data/hwaseong.geojson?v=${APP_VERSION}`, `/data/osan.geojson?v=${APP_VERSION}`],
};

const APT_ALIAS = {
  "대방엘리움레이크파크": ["대방엘리움", "대방 엘리움 레이크파크"],
  "동탄파크릭스": ["파크릭스", "동탄파크릭스"],
  "호반써밋동탄": ["호반써밋", "호반써밋동탄"],
  "동탄역반도유보라아이비파크2.0": ["A13블록", "반도유보라2차", "반도유보라아이비파크2차"],
  "동탄역시범반도유보라아이비파크4.0": ["C15블록", "반도유보라4차", "반도유보라아이비파크4차"],
};

const state = {
  core: null,
  roads: null,
  roadsPromise: null,
  suggestions: null,
  suggestionsPromise: null,
  addressSuggestionMatches: [],
  schoolSuggestionMatches: [],
  activeSuggestionIndex: -1,
  activeSchoolSuggestionIndex: -1,
  activeMode: "address",
  regionMap: {},
  mapItems: [],
  selectedMapKey: "",
  osmBuildings: null,
  osmBuildingsPromise: null,
  osmFeatureMatches: [],
  selectedOsmFeatureIndex: -1,
  lastAddressMapQuery: "",
  lastAddressMapResult: null,
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  collectElements();
  applyInitialTheme();
  bindEvents();

  try {
    state.core = await fetchJson(DATA_PATHS.core);
    updateDataChip();
    populateRegionFilters();
    populateSchoolSuggestions();
    buildTongbanMapItems();
    populateMapFilters();
    renderTongbanMap();
    await ensureOsmBuildings();
    renderOsmBuildingMap();
  } catch (error) {
    renderError("자료를 불러오지 못했습니다.", "새로고침 후에도 같은 문제가 있으면 배포된 data 파일을 확인해 주세요.");
    console.error(error);
  }
}

function collectElements() {
  els.homeNavButton = document.querySelector("#homeNavButton");
  els.mapNavButton = document.querySelector("#mapNavButton");
  els.backToSearchButton = document.querySelector("#backToSearchButton");
  els.workspace = document.querySelector(".workspace");
  els.mapPage = document.querySelector("#mapPage");
  els.mapAddressMode = document.querySelector("#mapAddressMode");
  els.mapAddressInput = document.querySelector("#mapAddressInput");
  els.mapCitySelect = document.querySelector("#mapCitySelect");
  els.mapEupSelect = document.querySelector("#mapEupSelect");
  els.tongbanMapCanvas = document.querySelector("#tongbanMapCanvas");
  els.mapInfoPanel = document.querySelector("#mapInfoPanel");
  els.mapTitle = document.querySelector("#mapTitle");
  els.mapCount = document.querySelector("#mapCount");
  els.osmBuildingMap = document.querySelector("#osmBuildingMap");
  els.osmMapInfo = document.querySelector("#osmMapInfo");
  els.osmMapCount = document.querySelector("#osmMapCount");
  els.themeToggle = document.querySelector("#themeToggle");
  els.dataChip = document.querySelector("#dataChip");
  els.addressTab = document.querySelector("#addressTab");
  els.schoolTab = document.querySelector("#schoolTab");
  els.addressMode = document.querySelector("#addressMode");
  els.schoolMode = document.querySelector("#schoolMode");
  els.citySelect = document.querySelector("#citySelect");
  els.eupSelect = document.querySelector("#eupSelect");
  els.addressInput = document.querySelector("#addressInput");
  els.clearAddressInput = document.querySelector("#clearAddressInput");
  els.addressSuggestions = document.querySelector("#addressSuggestions");
  els.schoolInput = document.querySelector("#schoolInput");
  els.clearSchoolInput = document.querySelector("#clearSchoolInput");
  els.schoolSuggestions = document.querySelector("#schoolSuggestions");
  els.emptyState = document.querySelector("#emptyState");
  els.loadingState = document.querySelector("#loadingState");
  els.results = document.querySelector("#results");
}

function bindEvents() {
  els.homeNavButton?.addEventListener("click", showSearchPage);
  els.mapNavButton?.addEventListener("click", showMapPage);
  els.backToSearchButton?.addEventListener("click", showSearchPage);
  els.mapCitySelect?.addEventListener("change", () => { populateMapEupOptions(); renderTongbanMap(); });
  els.mapEupSelect?.addEventListener("change", () => renderTongbanMap());
  els.mapAddressMode?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleMapAddressSearch(els.mapAddressInput.value);
  });
  els.tongbanMapCanvas?.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-map-key]");
    if (!tile) return;
    const item = state.mapItems.find((row) => row.mapKey === tile.dataset.mapKey);
    if (item) selectTongbanMapItem(item);
  });
  els.osmBuildingMap?.addEventListener("click", (event) => {
    const shape = event.target.closest("[data-osm-feature]");
    if (!shape) return;
    selectOsmFeature(Number(shape.dataset.osmFeature));
  });

  els.themeToggle.addEventListener("click", toggleTheme);
  els.addressTab.addEventListener("click", () => switchMode("address"));
  els.schoolTab.addEventListener("click", () => switchMode("school"));
  els.citySelect.addEventListener("change", () => { populateEupOptions(); handleAddressSuggestionInput(); });
  els.eupSelect.addEventListener("change", () => handleAddressSuggestionInput());

  els.addressMode.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAddressSuggestions();
    await handleAddressSearch(els.addressInput.value);
  });

  els.addressInput.addEventListener("input", () => {
    updateClearButtons();
    handleAddressSuggestionInput();
  });
  els.addressInput.addEventListener("focus", handleAddressSuggestionInput);
  els.addressInput.addEventListener("keydown", handleAddressSuggestionKeys);
  els.addressInput.addEventListener("blur", () => {
    window.setTimeout(hideAddressSuggestions, 120);
  });

  els.addressSuggestions.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const option = event.target.closest("[data-suggestion-index]");
    if (!option) return;
    selectAddressSuggestion(Number(option.dataset.suggestionIndex));
  });

  els.schoolMode.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideSchoolSuggestions();
    await handleSchoolSearch(els.schoolInput.value);
  });

  els.schoolInput.addEventListener("input", () => {
    updateClearButtons();
    handleSchoolSuggestionInput();
  });
  els.schoolInput.addEventListener("focus", handleSchoolSuggestionInput);
  els.schoolInput.addEventListener("keydown", handleSchoolSuggestionKeys);
  els.schoolInput.addEventListener("blur", () => {
    window.setTimeout(hideSchoolSuggestions, 120);
  });

  els.clearAddressInput?.addEventListener("click", () => {
    els.addressInput.value = "";
    hideAddressSuggestions();
    updateClearButtons();
    els.addressInput.focus({ preventScroll: true });
  });

  els.clearSchoolInput?.addEventListener("click", () => {
    els.schoolInput.value = "";
    hideSchoolSuggestions();
    updateClearButtons();
    els.schoolInput.focus({ preventScroll: true });
  });

  els.schoolSuggestions.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const option = event.target.closest("[data-school-suggestion-index]");
    if (!option) return;
    selectSchoolSuggestion(Number(option.dataset.schoolSuggestionIndex));
  });

  els.results.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "search-again") {
      const targetInput = state.activeMode === "school" ? els.schoolInput : els.addressInput;
      targetInput.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (action === "open-tongban-map") {
      showMapPage().then(() => {
        if (state.lastAddressMapResult) {
          highlightAddressOnOsmMap(state.lastAddressMapQuery || state.lastAddressMapResult.input || "", state.lastAddressMapResult, { renderPanel: false });
        }
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#addressAutocomplete")) {
      hideAddressSuggestions();
    }
    if (!event.target.closest("#schoolAutocomplete")) {
      hideSchoolSuggestions();
    }
  });
}

function applyInitialTheme() {
  const saved = localStorage.getItem("theme");
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = saved || (systemDark ? "dark" : "light");
  updateThemeLabel();
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  updateThemeLabel();
}

function updateThemeLabel() {
  const isDark = document.documentElement.dataset.theme === "dark";
  els.themeToggle.setAttribute("aria-label", isDark ? "라이트모드 전환" : "다크모드 전환");
}

function switchMode(mode) {
  state.activeMode = mode;
  const isAddress = mode === "address";
  hideAddressSuggestions();
  hideSchoolSuggestions();

  els.addressTab.classList.toggle("is-active", isAddress);
  els.schoolTab.classList.toggle("is-active", !isAddress);
  els.addressTab.setAttribute("aria-selected", String(isAddress));
  els.schoolTab.setAttribute("aria-selected", String(!isAddress));
  els.addressMode.hidden = !isAddress;
  els.schoolMode.hidden = isAddress;

  const input = isAddress ? els.addressInput : els.schoolInput;
  input.focus({ preventScroll: true });
}

function updateClearButtons() {
  if (els.clearAddressInput) {
    els.clearAddressInput.hidden = !els.addressInput.value;
  }
  if (els.clearSchoolInput) {
    els.clearSchoolInput.hidden = !els.schoolInput.value;
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }
  return response.json();
}

async function ensureCore() {
  if (state.core) return state.core;
  state.core = await fetchJson(DATA_PATHS.core);
  updateDataChip();
  populateRegionFilters();
  populateSchoolSuggestions();
  return state.core;
}

async function loadRoads() {
  if (state.roads) return state.roads;
  if (!state.roadsPromise) {
    state.roadsPromise = fetchJson(DATA_PATHS.roads).then((payload) => payload.roads || []);
  }
  state.roads = await state.roadsPromise;
  return state.roads;
}

async function loadSuggestions() {
  if (state.suggestions) return state.suggestions;
  if (!state.suggestionsPromise) {
    state.suggestionsPromise = fetchJson(DATA_PATHS.suggestions).then((payload) => payload.suggestions || []);
  }
  state.suggestions = await state.suggestionsPromise;
  return state.suggestions;
}

async function ensureOsmBuildings() {
  if (state.osmBuildings) return state.osmBuildings;
  if (!state.osmBuildingsPromise) {
    state.osmBuildingsPromise = Promise.all(DATA_PATHS.osmBuildings.map(async (url) => {
      const data = await fetchJson(url);
      const sourceCity = url.includes("osan") ? "오산시" : url.includes("hwaseong") ? "화성시" : "";
      const features = Array.isArray(data.features) ? data.features.map((feature) => ({
        ...feature,
        properties: { ...(feature.properties || {}), __sourceCity: sourceCity },
      })) : [];
      return features;
    })).then((featureGroups) => ({ type: "FeatureCollection", features: featureGroups.flat() }));
  }
  state.osmBuildings = await state.osmBuildingsPromise;
  buildOsmFeatureMatches();
  return state.osmBuildings;
}


function updateDataChip() {
  if (!state.core) return;
  const meta = state.core.meta || {};
  els.dataChip.textContent = `${meta.dataYear || "현재"} 자료 · ${formatNumber(state.core.schools.length)}개 구역`;
}

function populateRegionFilters() {
  if (!state.core || !els.citySelect || !els.eupSelect) return;
  const map = {};
  for (const row of state.core.tongban || []) {
    const city = row.sigun || "";
    const eup = row.eup || "";
    if (!city || !eup) continue;
    if (!map[city]) map[city] = new Set();
    map[city].add(eup);
  }
  state.regionMap = map;
  const current = els.citySelect.value;
  const cities = Object.keys(map).sort((a, b) => a.localeCompare(b, "ko"));
  els.citySelect.innerHTML = `<option value="">전체</option>${cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join("")}`;
  if (current && cities.includes(current)) els.citySelect.value = current;
  populateEupOptions();
}


function showSearchPage() {
  if (els.workspace) els.workspace.hidden = false;
  if (els.mapPage) els.mapPage.hidden = true;
  els.homeNavButton?.classList.add("is-active");
  els.mapNavButton?.classList.remove("is-active");
}

async function showMapPage() {
  if (els.workspace) els.workspace.hidden = true;
  if (els.mapPage) els.mapPage.hidden = false;
  els.homeNavButton?.classList.remove("is-active");
  els.mapNavButton?.classList.add("is-active");
  try {
    await ensureCore();
    if (!state.mapItems.length) buildTongbanMapItems();
    populateMapFilters();
    renderTongbanMap();
    await ensureOsmBuildings();
    renderOsmBuildingMap();
  } catch (error) {
    console.error(error);
  }
}

function buildTongbanMapItems() {
  const rows = groupTongbanRows(state.core?.tongban || []);
  state.mapItems = rows.map((row, index) => {
    const schools = findSchoolByTongban([row]);
    const schoolNames = Array.isArray(schools) ? unique(schools.map((item) => item.school)) : [];
    const key = [row.sigun, row.eup, row.tongri, row.ban, row.area, index].map((value) => normalizeText(value || "")).join("|");
    return {
      ...row,
      mapKey: key,
      colorIndex: index % 12,
      schoolNames,
      schoolDetails: Array.isArray(schools) ? schools : [],
    };
  });
}

function populateMapFilters() {
  if (!els.mapCitySelect || !state.core) return;
  const currentCity = els.mapCitySelect.value;
  const cities = Object.keys(state.regionMap || {}).sort((a, b) => a.localeCompare(b, "ko"));
  els.mapCitySelect.innerHTML = `<option value="">전체</option>${cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join("")}`;
  if (currentCity && cities.includes(currentCity)) els.mapCitySelect.value = currentCity;
  populateMapEupOptions();
}

function populateMapEupOptions() {
  if (!els.mapEupSelect) return;
  const city = els.mapCitySelect?.value || "";
  const current = els.mapEupSelect.value;
  const eups = city ? [...(state.regionMap[city] || [])].sort((a, b) => a.localeCompare(b, "ko")) : [];
  els.mapEupSelect.innerHTML = `<option value="">전체</option>${eups.map((eup) => `<option value="${escapeHtml(eup)}">${escapeHtml(eup)}</option>`).join("")}`;
  if (current && eups.includes(current)) els.mapEupSelect.value = current;
}

function getFilteredMapItems() {
  const city = els.mapCitySelect?.value || "";
  const eup = els.mapEupSelect?.value || "";
  return state.mapItems.filter((item) => {
    if (city && item.sigun !== city) return false;
    if (eup && item.eup !== eup) return false;
    return true;
  });
}

function renderTongbanMap(highlightKeys = []) {
  if (!els.tongbanMapCanvas || !state.mapItems.length) return;
  const rows = getFilteredMapItems();
  const highlightSet = new Set(highlightKeys);
  const maxRows = 900;
  const visibleRows = rows.slice(0, maxRows);
  const selectedCity = els.mapCitySelect?.value || "전체";
  const selectedEup = els.mapEupSelect?.value || "";
  if (els.mapTitle) els.mapTitle.textContent = `${selectedCity}${selectedEup ? ` ${selectedEup}` : ""} 통리반 지도`;
  if (els.mapCount) els.mapCount.textContent = `${formatNumber(rows.length)}개 통리반${rows.length > maxRows ? ` · ${formatNumber(maxRows)}개 표시` : ""}`;
  els.tongbanMapCanvas.innerHTML = visibleRows.map((item) => renderTongbanMapTile(item, highlightSet.has(item.mapKey))).join("");
}

function renderTongbanMapTile(item, isHighlighted = false) {
  const label = [item.tongri, item.ban].filter(Boolean).join(" ") || "통리반";
  const schoolLabel = item.schoolNames.length ? item.schoolNames.join(", ") : "학교 확인 필요";
  return `
    <button class="map-tile color-${item.colorIndex}${isHighlighted ? " is-highlighted" : ""}" type="button" data-map-key="${escapeHtml(item.mapKey)}" role="listitem" title="${escapeHtml([item.eup, label, schoolLabel].join(" · "))}">
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(schoolLabel)}</small>
    </button>
  `;
}

function selectTongbanMapItem(item) {
  state.selectedMapKey = item.mapKey;
  const label = [item.sigun, item.eup, item.tongri, item.ban].filter(Boolean).join(" ");
  const schoolNames = item.schoolNames.length ? item.schoolNames : ["통학구역표에서 학교 확인 필요"];
  if (els.mapInfoPanel) {
    els.mapInfoPanel.innerHTML = `
      <strong>${escapeHtml(label)}</strong>
      <dl class="map-info-list">
        <div><dt>관할구역</dt><dd>${escapeHtml(item.area || "관할구역 상세 문구 없음")}</dd></div>
        <div><dt>배정 초등학교</dt><dd>${escapeHtml(schoolNames.join(", "))}</dd></div>
      </dl>
      ${item.schoolDetails.length ? `<div class="map-school-list">${item.schoolDetails.map(renderMapSchoolDetail).join("")}</div>` : ""}
    `;
  }
  renderTongbanMap([item.mapKey]);
  selectOsmByMapKeys([item.mapKey]);
}

function renderMapSchoolDetail(item) {
  return `
    <article>
      <strong>${escapeHtml(item.school)}</strong>
      ${item.schoolArea ? `<p>통학구역: ${escapeHtml(item.schoolArea)}</p>` : ""}
      ${item.note ? `<p>비고: ${escapeHtml(item.note)}</p>` : ""}
    </article>
  `;
}

function buildOsmFeatureMatches() {
  const features = state.osmBuildings?.features || [];
  state.osmFeatureMatches = features.map((feature, index) => {
    const props = feature.properties || {};
    const buildingName = String(props.name || props["name:ko"] || "").trim();
    const buildingNo = extractBuildingNo(buildingName);
    const matches = buildingNo
      ? state.mapItems.filter((item) => isOsmTongbanMatch(item, entryCityFromFeature(feature), buildingName, buildingNo))
      : [];
    return { feature, index, buildingName, buildingNo, matches };
  });
}

function extractBuildingNo(value) {
  const match = String(value || "").match(/(\d{2,4})\s*동/);
  return match ? `${match[1]}동` : "";
}

function entryCityFromFeature(feature) {
  return feature?.properties?.__sourceCity || "";
}

function isOsmTongbanMatch(item, sourceCity, buildingName, buildingNo) {
  const area = normalizeSearchKey(item.area || "");
  const target = normalizeSearchKey(buildingNo);
  if (!target || !area.includes(target)) return false;
  if (sourceCity && item.sigun !== sourceCity) return false;

  const nameKey = normalizeSearchKey(buildingName || "");
  // OSM 건물명이 "101동"처럼 동번호만 있는 경우에는 같은 시 안의 동번호 후보가 너무 많아진다.
  // 그래서 통리반 자동 매칭은 보수적으로 처리하고, 주소 검색 시에는 별도 점수 로직으로 1개를 자동 선택한다.
  if (!nameKey || nameKey === target) return false;
  return area.includes(nameKey) || nameKey.includes(target);
}

function renderOsmBuildingMap(highlightKeys = []) {
  if (!els.osmBuildingMap) return;
  const entries = state.osmFeatureMatches || [];
  if (!entries.length) {
    els.osmBuildingMap.innerHTML = `<div class="osm-empty">OSM 건물도형 GeoJSON을 불러오지 못했습니다.</div>`;
    return;
  }
  const bounds = getOsmBounds(entries.map((entry) => entry.feature));
  const tileViewport = buildTileViewport(bounds);
  const tileImages = renderOsmTiles(tileViewport);
  const paths = entries.map((entry) => renderOsmPath(entry, tileViewport, highlightKeys)).join("");
  els.osmBuildingMap.innerHTML = `
    <svg class="osm-svg" viewBox="${tileViewport.viewBox}" aria-hidden="false" role="img" aria-label="OpenStreetMap 배경 위 건물도형 통리반 지도">
      <rect class="osm-map-bg" x="${tileViewport.minX}" y="${tileViewport.minY}" width="${tileViewport.width}" height="${tileViewport.height}" rx="0"></rect>
      ${tileImages}
      <g class="osm-building-layer">${paths}</g>
    </svg>
    <div class="osm-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · 건물도형: OpenStreetMap ODbL, 참고용</div>
  `;
  const matchedCount = entries.filter((entry) => entry.matches.length).length;
  if (els.osmMapCount) els.osmMapCount.textContent = `${formatNumber(entries.length)}개 건물 · ${formatNumber(matchedCount)}개 자동 매칭`;
}

function renderOsmTiles(viewport) {
  const tiles = [];
  for (let x = viewport.tileMinX; x <= viewport.tileMaxX; x += 1) {
    for (let y = viewport.tileMinY; y <= viewport.tileMaxY; y += 1) {
      const href = `https://tile.openstreetmap.org/${viewport.zoom}/${x}/${y}.png`;
      tiles.push(`<image class="osm-tile" href="${href}" x="${x * 256}" y="${y * 256}" width="256" height="256" preserveAspectRatio="none"></image>`);
    }
  }
  return tiles.join("");
}

function renderOsmPath(entry, viewport, highlightKeys = []) {
  const d = featureToSvgPath(entry.feature, viewport.zoom);
  if (!d) return "";
  const matchKeys = entry.matches.map((item) => item.mapKey);
  const isMatched = entry.matches.length > 0;
  const hasSelectedFeature = Number.isInteger(state.selectedOsmFeatureIndex) && state.selectedOsmFeatureIndex >= 0;
  const isHighlighted = hasSelectedFeature
    ? entry.index === state.selectedOsmFeatureIndex
    : highlightKeys.length
      ? matchKeys.some((key) => highlightKeys.includes(key))
      : false;
  const classes = ["osm-building", isMatched ? "is-matched" : "", isHighlighted ? "is-highlighted" : ""].filter(Boolean).join(" ");
  const label = entry.buildingName || entry.feature.properties?.["@id"] || `건물 ${entry.index + 1}`;
  return `<path class="${classes}" d="${d}" data-osm-feature="${entry.index}" tabindex="0"><title>${escapeHtml(label)}</title></path>`;
}

function getOsmBounds(features) {
  const points = [];
  for (const feature of features) {
    points.push(...getFeaturePoints(feature));
  }
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function getFeaturePoints(feature) {
  const geometry = feature?.geometry || {};
  if (geometry.type === "Polygon") return geometry.coordinates.flat(1);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function buildTileViewport(bounds) {
  const zoom = chooseTileZoom(bounds);
  const nw = lonLatToWorld(bounds.minLon, bounds.maxLat, zoom);
  const se = lonLatToWorld(bounds.maxLon, bounds.minLat, zoom);
  const pad = 256;
  const minX = Math.floor(Math.min(nw.x, se.x) - pad);
  const maxX = Math.ceil(Math.max(nw.x, se.x) + pad);
  const minY = Math.floor(Math.min(nw.y, se.y) - pad);
  const maxY = Math.ceil(Math.max(nw.y, se.y) + pad);
  return {
    zoom,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    tileMinX: Math.floor(minX / 256),
    tileMaxX: Math.floor(maxX / 256),
    tileMinY: Math.floor(minY / 256),
    tileMaxY: Math.floor(maxY / 256),
  };
}

function chooseTileZoom(bounds) {
  for (let zoom = 15; zoom >= 10; zoom -= 1) {
    const nw = lonLatToWorld(bounds.minLon, bounds.maxLat, zoom);
    const se = lonLatToWorld(bounds.maxLon, bounds.minLat, zoom);
    const tileCols = Math.ceil(Math.abs(se.x - nw.x) / 256) + 2;
    const tileRows = Math.ceil(Math.abs(se.y - nw.y) / 256) + 2;
    if (tileCols * tileRows <= 80) return zoom;
  }
  return 10;
}

function lonLatToWorld(lon, lat, zoom) {
  const sinLat = Math.sin((Math.max(Math.min(lat, 85.05112878), -85.05112878) * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function featureToSvgPath(feature, zoom) {
  const geometry = feature?.geometry || {};
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.map((polygon) => polygon.map((ring) => ringToSvgPath(ring, zoom)).join(" ")).join(" ");
}

function ringToSvgPath(ring, zoom) {
  const points = ring.map(([lon, lat]) => lonLatToWorld(lon, lat, zoom));
  if (!points.length) return "";
  return `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")} Z`;
}

function selectOsmFeature(index, options = {}) {
  const entry = state.osmFeatureMatches?.[index];
  if (!entry) return;
  state.selectedOsmFeatureIndex = index;
  const label = entry.buildingName || entry.feature.properties?.["@id"] || `건물 ${index + 1}`;
  const matched = entry.matches || [];
  const schoolNames = unique(matched.flatMap((item) => item.schoolNames || []));
  const shouldRenderPanel = options.renderPanel !== false;
  if (els.osmMapInfo && shouldRenderPanel) {
    els.osmMapInfo.innerHTML = `
      <strong>${escapeHtml(label)}${options.source === "address" ? " · 주소검색 자동 선택" : ""}</strong>
      ${matched.length ? `
        <dl class="map-info-list">
          <div><dt>매칭 통리반</dt><dd>${escapeHtml(matched.map((item) => [item.tongri, item.ban].filter(Boolean).join(" ")).join(" / "))}</dd></div>
          <div><dt>배정 초등학교</dt><dd>${escapeHtml(schoolNames.length ? schoolNames.join(", ") : "학교 확인 필요")}</dd></div>
          <div><dt>관할구역</dt><dd>${escapeHtml(matched.map((item) => item.area).filter(Boolean).join(" / "))}</dd></div>
        </dl>
      ` : `
        <p>이 건물은 현재 테스트 매칭 규칙에서 통리반 데이터와 연결되지 않았습니다.</p>
        <p class="result-note">건물명·동번호·지번 매칭 규칙을 확대하면 연결 범위를 늘릴 수 있습니다.</p>
      `}
    `;
  }
  // 클릭/검색 선택에서는 같은 통리반 후보 전체가 아니라 이 feature 하나만 다시 칠한다.
  renderOsmBuildingMap();
}

function selectOsmByMapKeys(mapKeys) {
  if (!mapKeys.length || !state.osmFeatureMatches?.length) return null;
  const index = state.osmFeatureMatches.findIndex((entry) => entry.matches.some((item) => mapKeys.includes(item.mapKey)));
  if (index >= 0) {
    selectOsmFeature(index);
    return state.osmFeatureMatches[index];
  }
  renderOsmBuildingMap(mapKeys);
  return null;
}

async function highlightAddressOnOsmMap(query, result, options = {}) {
  await ensureOsmBuildings();
  const mapKeys = getMapKeysFromTongban(result?.tongban);
  const best = findBestOsmFeatureForAddress(query, result, mapKeys);
  if (best) {
    selectOsmFeature(best.index, {
      source: "address",
      query,
      renderPanel: options.renderPanel !== false,
    });
    return best;
  }
  state.selectedOsmFeatureIndex = -1;
  renderOsmBuildingMap(mapKeys);
  return null;
}

function inferCityFromTongban(tongbanRows) {
  const rows = Array.isArray(tongbanRows) ? tongbanRows : [];
  const city = rows.map((row) => row.sigun).find(Boolean);
  return city || "";
}

function normalizedCityName(value) {
  const text = String(value || "");
  if (text.includes("오산")) return "오산시";
  if (text.includes("화성")) return "화성시";
  return "";
}

function findBestOsmFeatureForAddress(query, result, mapKeys = []) {
  const entries = state.osmFeatureMatches || [];
  if (!entries.length) return null;
  const haystack = [
    query,
    result?.input,
    result?.road,
    result?.jibun,
    result?.building,
    result?.admin,
    result?.legal,
    ...(Array.isArray(result?.tongban) ? result.tongban.map((item) => item.area || "") : []),
  ].filter(Boolean).join(" ");
  const requestedBuildingNo = extractBuildingNo(haystack);
  const requestedCity = result?.sigun || result?.city || inferCityFromTongban(result?.tongban) || (normalizedCityName(haystack));
  const normalizedHaystack = normalizeSearchKey(haystack);
  let best = null;
  let bestScore = 0;
  for (const entry of entries) {
    let score = 0;
    const entryName = normalizeSearchKey(entry.buildingName || "");
    const sourceCity = entryCityFromFeature(entry.feature);
    if (requestedCity && sourceCity && requestedCity !== sourceCity) continue;
    const entryNo = normalizeSearchKey(entry.buildingNo || "");
    const entryMapKeys = entry.matches.map((item) => item.mapKey);
    if (mapKeys.length && entryMapKeys.some((key) => mapKeys.includes(key))) score += 100;
    if (requestedBuildingNo && entry.buildingNo && normalizeSearchKey(requestedBuildingNo) === entryNo) score += 80;
    if (entryName && normalizedHaystack.includes(entryName)) score += 30;
    if (entryNo && normalizedHaystack.includes(entryNo)) score += 30;
    if (entry.matches.length) score += 5;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore >= 80 ? best : null;
}


async function handleMapAddressSearch(rawQuery) {
  const query = cleanText(rawQuery);
  if (!query) return;
  await ensureCore();
  const result = await searchAddress(query);
  state.lastAddressMapQuery = query;
  state.lastAddressMapResult = result;
  const matchKeys = getMapKeysFromTongban(result.tongban);
  await showMapPage();
  renderTongbanMap(matchKeys);
  const selectedEntry = await highlightAddressOnOsmMap(query, result, { renderPanel: true });
  renderMapAddressResult(query, result, matchKeys, selectedEntry);
}

function getMapKeysFromTongban(tongbanRows) {
  const tongban = Array.isArray(tongbanRows) ? groupTongbanRows(tongbanRows) : [];
  const matchKeys = [];
  for (const row of tongban) {
    const found = state.mapItems.find((item) => sameTongbanMapItem(item, row));
    if (found) matchKeys.push(found.mapKey);
  }
  return unique(matchKeys);
}

function sameTongbanMapItem(a, b) {
  return normalizeText(a.sigun) === normalizeText(b.sigun)
    && normalizeText(a.eup) === normalizeText(b.eup)
    && normalizeText(a.tongri) === normalizeText(b.tongri)
    && normalizeText(a.ban) === normalizeText(b.ban)
    && normalizeText(a.area) === normalizeText(b.area);
}

function renderMapAddressResult(query, result, matchKeys, selectedEntry = null) {
  const schools = Array.isArray(result.school) ? unique(result.school.map((item) => item.school)) : [];
  const tongban = Array.isArray(result.tongban) ? groupTongbanRows(result.tongban) : [];
  if (!els.mapInfoPanel) return;
  els.mapInfoPanel.innerHTML = `
    <strong>주소 조회 결과</strong>
    <p class="map-query">${escapeHtml(query)}</p>
    <dl class="map-info-list">
      <div><dt>배정 초등학교</dt><dd>${escapeHtml(schools.length ? schools.join(", ") : "확인 필요")}</dd></div>
      <div><dt>통리반</dt><dd>${escapeHtml(tongban.length ? tongban.map((item) => [item.eup, item.tongri, item.ban].filter(Boolean).join(" ")).join(" / ") : "확인 필요")}</dd></div>
      <div><dt>색칠 영역</dt><dd>${escapeHtml(selectedEntry ? `${selectedEntry.buildingName || `건물 ${selectedEntry.index + 1}`} 자동 선택` : (matchKeys.length ? `${formatNumber(matchKeys.length)}개 후보 영역` : "일치하는 지도 영역 없음"))}</dd></div>
    </dl>
    ${tongban.length ? `<div class="address-map-preview">${tongban.map(renderAddressMapPreview).join("")}</div>` : ""}
  `;
}

function renderAddressMapPreview(item) {
  return `
    <article class="address-map-card">
      <div class="mini-map" aria-hidden="true"><span></span></div>
      <div>
        <strong>${escapeHtml([item.eup, item.tongri, item.ban].filter(Boolean).join(" "))}</strong>
        <p>${escapeHtml(item.area || "관할구역 상세 문구 없음")}</p>
      </div>
    </article>
  `;
}

function populateEupOptions() {
  if (!els.eupSelect) return;
  const selectedCity = els.citySelect?.value || "";
  const eups = selectedCity
    ? [...(state.regionMap[selectedCity] || [])]
    : unique(Object.values(state.regionMap || {}).flatMap((set) => [...set]));
  const current = els.eupSelect.value;
  const sorted = eups.sort((a, b) => a.localeCompare(b, "ko"));
  els.eupSelect.innerHTML = `<option value="">전체</option>${sorted.map((eup) => `<option value="${escapeHtml(eup)}">${escapeHtml(eup)}</option>`).join("")}`;
  els.eupSelect.value = current && sorted.includes(current) ? current : "";
}

function getSelectedRegion() {
  return {
    sigun: els.citySelect?.value || "",
    eup: els.eupSelect?.value || "",
  };
}

function applySelectedRegionToTongban(rows) {
  const region = getSelectedRegion();
  return rows.filter((row) => {
    if (region.sigun && row.sigun !== region.sigun) return false;
    if (region.eup && row.eup !== region.eup) return false;
    return true;
  });
}


function rowMatchesSelectedRegion(row) {
  const region = getSelectedRegion();
  if (!row) return true;

  if (region.sigun) {
    if (row.sigun && row.sigun !== region.sigun) return false;

    // 통학구역(schools) 데이터에는 시군 컬럼이 없으므로,
    // core.tongban에서 만든 시군-읍면동 맵으로 소속 시군을 판정한다.
    const eupsInCity = state.regionMap?.[region.sigun];
    if (!row.sigun && eupsInCity && row.eup && !eupsInCity.has(row.eup)) return false;
  }

  if (region.eup && row.eup !== region.eup) return false;
  return true;
}

function filterResultsBySelectedRegion(results) {
  if (!Array.isArray(results)) return results;
  return results.filter((row) => rowMatchesSelectedRegion(row));
}

function selectedRegionLabel() {
  const region = getSelectedRegion();
  return [region.sigun, region.eup].filter(Boolean).join(" ") || "전체 지역";
}

function populateSchoolSuggestions() {
  if (!state.core) return;
  const names = unique(state.core.schools.map((item) => item.school)).sort((a, b) => a.localeCompare(b, "ko"));
  state.schoolNames = names;
}

async function handleAddressSuggestionInput() {
  const query = cleanText(els.addressInput.value);
  if (normalizeSearchKey(query).length < 2) {
    hideAddressSuggestions();
    return;
  }

  try {
    const suggestions = await loadSuggestions();
    state.addressSuggestionMatches = findAddressSuggestions(query, suggestions);
    state.activeSuggestionIndex = -1;
    renderAddressSuggestions();
  } catch (error) {
    hideAddressSuggestions();
    console.warn("address suggestions failed", error);
  }
}

function handleAddressSuggestionKeys(event) {
  if (els.addressSuggestions.hidden && event.key !== "ArrowDown") return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (els.addressSuggestions.hidden) {
      handleAddressSuggestionInput();
      return;
    }
    moveAddressSuggestion(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveAddressSuggestion(-1);
  } else if (event.key === "Enter") {
    if (state.activeSuggestionIndex >= 0 && !els.addressSuggestions.hidden) {
      event.preventDefault();
      selectAddressSuggestion(state.activeSuggestionIndex);
    }
  } else if (event.key === "Escape") {
    hideAddressSuggestions();
  }
}

function findAddressSuggestions(query, suggestions) {
  const normalizedQuery = normalizeSearchKey(query);
  const region = getSelectedRegion();
  const kindWeight = {
    건물명: 0,
    도로명: 1,
    읍면동: 2,
    지번지역: 3,
  };

  return suggestions
    .map((item) => {
      const value = item.v || "";
      if (region.sigun && value.includes("시") && !value.includes(region.sigun)) return null;
      if (region.eup && /[가-힣0-9]+(?:읍|면|동)/.test(value) && !value.includes(region.eup) && (item.k === "읍면동" || item.k === "지번지역")) return null;
      const normalizedValue = normalizeSearchKey(value);
      const index = normalizedValue.indexOf(normalizedQuery);
      if (index < 0) return null;
      return {
        value,
        kind: item.k || "추천",
        score: index * 10 + (kindWeight[item.k] ?? 4),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.value.length - b.value.length || a.value.localeCompare(b.value, "ko"))
    .slice(0, 8);
}

function renderAddressSuggestions() {
  const matches = state.addressSuggestionMatches;
  if (!matches.length) {
    hideAddressSuggestions();
    return;
  }

  els.addressSuggestions.innerHTML = matches
    .map((item, index) => {
      const active = index === state.activeSuggestionIndex;
      return `
        <button class="suggestion-option${active ? " is-active" : ""}" type="button" role="option" aria-selected="${active}" data-suggestion-index="${index}">
          <span>${escapeHtml(item.value)}</span>
          <small>${escapeHtml(item.kind)}</small>
        </button>
      `;
    })
    .join("");
  els.addressSuggestions.hidden = false;
  els.addressInput.setAttribute("aria-expanded", "true");
}

function hideAddressSuggestions() {
  if (!els.addressSuggestions) return;
  els.addressSuggestions.hidden = true;
  els.addressSuggestions.innerHTML = "";
  els.addressInput.setAttribute("aria-expanded", "false");
  state.activeSuggestionIndex = -1;
}

function moveAddressSuggestion(direction) {
  const count = state.addressSuggestionMatches.length;
  if (!count) return;
  state.activeSuggestionIndex = (state.activeSuggestionIndex + direction + count) % count;
  renderAddressSuggestions();
}

function selectAddressSuggestion(index) {
  const item = state.addressSuggestionMatches[index];
  if (!item) return;
  els.addressInput.value = item.value;
  updateClearButtons();
  hideAddressSuggestions();
}

async function handleSchoolSuggestionInput() {
  await ensureCore();
  const query = cleanText(els.schoolInput.value);
  if (normalizeSchoolName(query).length < 1) {
    hideSchoolSuggestions();
    return;
  }

  state.schoolSuggestionMatches = findSchoolSuggestions(query);
  state.activeSchoolSuggestionIndex = -1;
  renderSchoolSuggestions();
}

function handleSchoolSuggestionKeys(event) {
  if (els.schoolSuggestions.hidden && event.key !== "ArrowDown") return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (els.schoolSuggestions.hidden) {
      handleSchoolSuggestionInput();
      return;
    }
    moveSchoolSuggestion(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSchoolSuggestion(-1);
  } else if (event.key === "Enter") {
    if (state.activeSchoolSuggestionIndex >= 0 && !els.schoolSuggestions.hidden) {
      event.preventDefault();
      selectSchoolSuggestion(state.activeSchoolSuggestionIndex);
    }
  } else if (event.key === "Escape") {
    hideSchoolSuggestions();
  }
}

function findSchoolSuggestions(query) {
  const normalizedQuery = normalizeSchoolName(query);
  return (state.schoolNames || [])
    .map((name) => {
      const normalizedName = normalizeSchoolName(name);
      const index = normalizedName.indexOf(normalizedQuery);
      if (index < 0) return null;
      return {
        value: name,
        kind: "초등학교",
        score: index * 10 + name.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.value.localeCompare(b.value, "ko"))
    .slice(0, 8);
}

function renderSchoolSuggestions() {
  const matches = state.schoolSuggestionMatches;
  if (!matches.length) {
    hideSchoolSuggestions();
    return;
  }

  els.schoolSuggestions.innerHTML = matches
    .map((item, index) => {
      const active = index === state.activeSchoolSuggestionIndex;
      return `
        <button class="suggestion-option${active ? " is-active" : ""}" type="button" role="option" aria-selected="${active}" data-school-suggestion-index="${index}">
          <span>${escapeHtml(item.value)}</span>
          <small>${escapeHtml(item.kind)}</small>
        </button>
      `;
    })
    .join("");
  els.schoolSuggestions.hidden = false;
  els.schoolInput.setAttribute("aria-expanded", "true");
}

function hideSchoolSuggestions() {
  if (!els.schoolSuggestions) return;
  els.schoolSuggestions.hidden = true;
  els.schoolSuggestions.innerHTML = "";
  els.schoolInput.setAttribute("aria-expanded", "false");
  state.activeSchoolSuggestionIndex = -1;
}

function moveSchoolSuggestion(direction) {
  const count = state.schoolSuggestionMatches.length;
  if (!count) return;
  state.activeSchoolSuggestionIndex = (state.activeSchoolSuggestionIndex + direction + count) % count;
  renderSchoolSuggestions();
}

function selectSchoolSuggestion(index) {
  const item = state.schoolSuggestionMatches[index];
  if (!item) return;
  els.schoolInput.value = item.value;
  updateClearButtons();
  hideSchoolSuggestions();
}

async function handleAddressSearch(rawQuery) {
  const query = cleanText(rawQuery);
  if (!query) {
    renderWarning("주소를 입력해 주세요.", ["도로명주소, 지번주소, 아파트명 중 하나로 검색할 수 있습니다."]);
    return;
  }

  setLoading(true);
  try {
    await ensureCore();
    const result = await searchAddress(query);
    state.lastAddressMapQuery = query;
    state.lastAddressMapResult = result;
    renderAddressResult(result);
  } catch (error) {
    renderError("주소 조회 중 문제가 발생했습니다.", "자료 파일이나 브라우저 콘솔의 오류 내용을 확인해 주세요.");
    console.error(error);
  } finally {
    setLoading(false);
  }
}

async function handleSchoolSearch(rawQuery) {
  const query = cleanText(rawQuery);
  if (!query) {
    renderWarning("학교명을 입력해 주세요.", ["예: 동탄초등학교, 동탄초, 세미초"]);
    return;
  }

  setLoading(true);
  try {
    await ensureCore();
    const result = searchSchoolArea(query);
    renderSchoolAreaResult(query, result);
  } catch (error) {
    renderError("학교명 조회 중 문제가 발생했습니다.", "자료 파일이나 브라우저 콘솔의 오류 내용을 확인해 주세요.");
    console.error(error);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  els.emptyState.hidden = true;
  els.loadingState.hidden = !isLoading;
  els.results.hidden = isLoading;
  if (isLoading) {
    els.results.innerHTML = "";
  }
}

function renderAddressResult(result) {
  const schools = Array.isArray(result.school) ? result.school : [];
  const tongban = Array.isArray(result.tongban) ? result.tongban : [];
  const schoolNames = unique(schools.map((item) => item.school));
  const primarySchool = schoolNames.length === 1 ? schoolNames[0] : `${schoolNames.length || 0}개 후보`;
  const matchLabel = result.road ? "도로명주소 매칭" : "입력값 기반 검색";

  let html = `
    <div class="summary-grid">
      ${summaryTile("배정 초등학교", schoolNames.length ? primarySchool : "확인 필요", schoolNames.length > 1 ? "복수 후보가 있어 상세 확인이 필요합니다." : "")}
      ${summaryTile("매칭 방식", matchLabel, result.road ? result.road : result.input)}
      ${summaryTile("검색 지역", result.regionLabel || "전체 지역", "선택 필터 기준")}
    </div>
  `;

  html += renderMatchedAddressCard(result);
  html += renderAddressSchoolCard(schools, result.school, result.matchMethod, tongban);
  html += renderAddressTongbanCard(tongban, result.input);
  html += renderAddressInlineMapCard(tongban, schools);

  showResults(html);
}

function renderSchoolAreaResult(query, result) {
  if (typeof result === "string") {
    showResults(`
      ${summaryBlock("학교명 조회", "확인 필요", query)}
      ${alertCard("warning", result, ["학교명 일부만 입력하거나, '초등학교' 대신 '초'로 다시 검색해 보세요."])}
    `);
    return;
  }

  const groupedSchools = groupSchoolAreaBySchool(result);
  const schoolNames = groupedSchools.map((group) => group.school);
  const totalZones = groupedSchools.reduce((sum, group) => sum + group.zones.length, 0);
  const html = `
    <div class="summary-grid">
      ${summaryTile("조회 학교", schoolNames.join(", "), `${formatNumber(totalZones)}개 통학구역`)}
      ${summaryTile("검색어", query, "학교명 기준")}
      ${summaryTile("자료 기준", `${state.core.meta?.dataYear || "현재"}학년도`, "보유 자료 기준")}
    </div>
    ${groupedSchools.map(renderSchoolLookupGroup).join("")}
  `;

  showResults(html);
}

function renderMatchedAddressCard(result) {
  const details = [
    result.regionLabel ? detailItem("검색 지역", result.regionLabel) : "",
    result.input ? detailItem("입력 주소", result.input) : "",
    result.road ? detailItem("도로명주소", result.road) : "",
    result.jibun ? detailItem("변환 지번주소", result.jibun) : "",
    result.building ? detailItem("건물명", result.building) : "",
    result.admin ? detailItem("행정동명", result.admin) : "",
    result.legal ? detailItem("법정동명", result.legal) : "",
  ].join("");

  return `
    <div class="result-card">
      <div class="card-header">
        <div class="card-title">
          <span>주소 매칭 정보</span>
          <strong>${escapeHtml(result.road || result.input)}</strong>
        </div>
        <span class="badge">${escapeHtml(result.road ? "주소 DB" : "직접 검색")}</span>
      </div>
      <div class="detail-grid">${details}</div>
    </div>
  `;
}

function renderAddressSchoolCard(schools, message, matchMethod, tongban = []) {
  if (!schools.length) {
    return alertCard("warning", typeof message === "string" ? message : "통학구역 자료에서 학교를 찾지 못했습니다.", [
      "주소에 읍면동 또는 아파트명을 함께 입력해 보세요.",
      "검색 결과는 자료 기준에 따라 달라질 수 있습니다.",
    ]);
  }

  const groupedSchools = groupAddressSchools(schools);
  const names = groupedSchools.map((group) => group.school);
  const isCandidate = schools.some((item) => item.score) || String(matchMethod || "").includes("유사");
  const matchedCount = Array.isArray(tongban) ? tongban.length : 0;
  const duplicateNotice = matchedCount > groupedSchools.length
    ? `<p class="result-note">같은 학교로 배정되는 여러 동·통리반 결과를 하나로 묶어 표시했습니다.${matchedCount ? ` 원자료 기준 ${formatNumber(matchedCount)}건이 확인되었습니다.` : ""}</p>`
    : "";

  if (isCandidate) {
    return `
      <div class="result-card primary">
        <div class="card-header">
          <div class="card-title">
            <span>주소 기준 학교 후보</span>
            <strong>${escapeHtml(names.join(", "))}</strong>
          </div>
          <span class="badge orange">세부 확인 필요</span>
        </div>
        <p class="candidate-guide">정확한 배정이 아닐 수 있어요. 통·반까지 하나로 좁혀지지 않아 가능한 학교 후보를 보여드립니다. 건물번호, 동 이름, 아파트명, 블록명을 더 구체적으로 입력하면 정확도가 높아집니다.</p>
        <div class="detail-grid">
          ${detailItem("매칭 방식", matchMethod || "키워드 매칭")}
          ${detailItem("확인 안내", "입력 주소가 통리반 하나로 직접 좁혀지지 않아 학교 후보만 표시합니다.")}
          <div class="detail-item wide">
            <span>다음 검색 방법</span>
            <p>건물번호, 동 이름, 아파트명, 블록명을 더 구체적으로 입력하거나 학교명 조회에서 해당 학교의 전체 통리반 정보를 확인해 주세요.</p>
          </div>
        </div>
        ${duplicateNotice}
        <div class="card-list school-candidate-list">
          ${groupedSchools.map(renderAddressSchoolRow).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="result-card primary">
      <div class="assigned-school-highlight">
        <span>주소 기준 배정 초등학교</span>
        <strong>${escapeHtml(names.join(", "))}</strong>
      </div>
      ${duplicateNotice}
      <div class="card-list">
        ${groupedSchools.map(renderAddressSchoolRow).join("")}
      </div>
    </div>
  `;
}

function renderAddressTongbanCard(tongban, input = "") {
  if (!Array.isArray(tongban) || !tongban.length) return "";

  const groups = groupTongbanRows(tongban);
  const countLabel = groups.length === 1 ? "1개 통리반" : `${formatNumber(groups.length)}개 통리반`;
  const guidance = groups.length === 1
    ? "입력 주소가 속하는 통·반입니다."
    : "같은 도로명주소에 포함된 세부 동·구역별 통·반을 함께 표시합니다.";

  return `
    <div class="result-card tongban-summary-card">
      <div class="card-header">
        <div class="card-title">
          <span>통리반 관할구역</span>
          <strong>${escapeHtml(countLabel)}</strong>
        </div>
      </div>
      <p class="result-note">${escapeHtml(guidance)}</p>
      <div class="tongban-list">
        ${groups.map(renderAddressTongbanRow).join("")}
      </div>
    </div>
  `;
}


function renderAddressInlineMapCard(tongban, schools = []) {
  if (!Array.isArray(tongban) || !tongban.length) return "";
  const groups = groupTongbanRows(tongban).slice(0, 6);
  const schoolNames = unique((schools || []).map((item) => item.school));
  return `
    <div class="result-card address-inline-map-card">
      <div class="card-header">
        <div class="card-title">
          <span>통리반지도 미리보기</span>
          <strong>${escapeHtml(groups.map((item) => [item.tongri, item.ban].filter(Boolean).join(" ")).join(" / "))}</strong>
        </div>
        <span class="badge green">참고 지도</span>
      </div>
      <div class="inline-map-shell">
        <div class="inline-map-canvas" aria-hidden="true">
          ${groups.map((item, index) => `<div class="inline-map-area area-${index % 6}"><span>${escapeHtml([item.tongri, item.ban].filter(Boolean).join(" "))}</span></div>`).join("")}
        </div>
        <div class="inline-map-detail">
          <strong>${escapeHtml(schoolNames.length ? schoolNames.join(", ") : "학교 확인 필요")}</strong>
          <p>${escapeHtml(groups[0]?.area || "관할구역 상세 문구 없음")}</p>
          <button class="secondary-button" type="button" data-action="open-tongban-map">통리반지도에서 전체 보기</button>
        </div>
      </div>
      <p class="result-note">통리반지도 섹션에서 업로드한 OSM 건물도형 기반 실제 좌표 색칠 테스트를 확인할 수 있습니다.</p>
    </div>
  `;
}

function groupTongbanRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = [row.sigun, row.eup, row.tongri, row.ban, row.area].map((value) => normalizeText(value || "")).join("|");
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()].sort((a, b) => {
    const left = [a.eup, a.tongri, a.ban, a.area].filter(Boolean).join(" ");
    const right = [b.eup, b.tongri, b.ban, b.area].filter(Boolean).join(" ");
    return left.localeCompare(right, "ko", { numeric: true });
  });
}

function renderAddressTongbanRow(item) {
  const label = [item.eup, item.tongri, item.ban].filter(Boolean).join(" ") || firstTongbanLabel(item) || "통리반 정보";
  return `
    <article class="tongban-item">
      <div class="tongban-item-main">
        <span>통·반</span>
        <strong>${escapeHtml(label)}</strong>
      </div>
      <div class="tongban-item-area">
        <span>관할구역</span>
        <p>${escapeHtml(item.area || "관할구역 상세 문구가 없습니다.")}</p>
      </div>
    </article>
  `;
}

function renderTongbanCard(tongban, message) {
  if (!tongban.length) {
    return alertCard("warning", typeof message === "string" ? message : "통리반 검색 결과가 없습니다.", [
      "도로명주소로 입력했다면 건물번호까지 입력해 보세요.",
      "아파트명은 단지명 또는 블록명을 함께 입력하면 매칭률이 올라갑니다.",
    ]);
  }

  return `
    <div class="result-card">
      <div class="card-header">
        <div class="card-title">
          <span>통리반 결과</span>
          <strong>${formatNumber(tongban.length)}건 확인</strong>
        </div>
        <span class="badge">${formatNumber(tongban.length)}건</span>
      </div>
      <div class="card-list">
        ${tongban.map(renderTongbanRow).join("")}
      </div>
    </div>
  `;
}

function renderAddressSchoolRow(item) {
  const info = getSchoolInfo(item.school);
  const areaCount = Array.isArray(item.items) ? item.items.length : 1;
  const notes = unique((item.items || [item]).map((row) => row.note).filter(Boolean));
  return `
    <article class="compact-row">
      <div class="compact-row-title">
        <strong>${escapeHtml(item.school)}</strong>
      </div>
      ${areaCount > 1 ? `<div class="meta-line">같은 학교로 배정되는 세부 주소 ${formatNumber(areaCount)}건을 묶어서 표시했습니다.</div>` : ""}
      <details>
        <summary>학교 관련 정보 보기</summary>
        <div class="details-body">
          ${renderSchoolInfoDetails(info)}
          ${notes.length ? `<div><strong>비고</strong><br>${escapeHtml(notes.join(" / "))}</div>` : ""}
        </div>
      </details>
    </article>
  `;
}

function groupAddressSchools(schools) {
  const map = new Map();
  for (const item of schools || []) {
    const school = item.school || "학교명 미상";
    if (!map.has(school)) {
      map.set(school, { ...item, school, items: [] });
    }
    map.get(school).items.push(item);
  }
  return [...map.values()].sort((a, b) => a.school.localeCompare(b.school, "ko"));
}

function groupSchoolAreaBySchool(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const school = row.school || "학교명 미상";
    if (!map.has(school)) map.set(school, { school, rows: [], zones: [] });
    map.get(school).rows.push(row);
  }
  for (const group of map.values()) {
    group.zones = groupSchoolZones(group.rows);
  }
  return [...map.values()].sort((a, b) => a.school.localeCompare(b.school, "ko"));
}

function groupSchoolZones(rows) {
  const map = new Map();

  for (const row of rows || []) {
    const expandedRows = expandSchoolZoneWithTongban(row);
    for (const item of expandedRows) {
      const area = item.area || item.schoolArea || "";
      const key = [item.eup, item.tongri, item.ban, area, item.note].map((value) => normalizeText(value || "")).join("|");
      if (!map.has(key)) map.set(key, { ...item, area });
    }
  }

  return [...map.values()].sort((a, b) => {
    const left = [a.eup, a.tongri, a.ban, a.area].filter(Boolean).join(" ");
    const right = [b.eup, b.tongri, b.ban, b.area].filter(Boolean).join(" ");
    return left.localeCompare(right, "ko", { numeric: true });
  });
}

function expandSchoolZoneWithTongban(row) {
  const hasSpecificSchoolArea = Boolean(cleanText(row.area || row.schoolArea));
  const hasSpecificBan = Boolean(cleanText(row.ban));

  if (hasSpecificSchoolArea || hasSpecificBan || !row.eup || !row.tongri) {
    return [{ ...row, area: row.area || row.schoolArea || "" }];
  }

  const eupKey = normalizeText(row.eup);
  const tongriKey = normalizeText(row.tongri);
  const matchedTongban = (state.core.tongban || []).filter((item) => {
    return normalizeText(item.eup) === eupKey && normalizeText(item.tongri) === tongriKey;
  });

  if (!matchedTongban.length) {
    return [{ ...row, area: row.area || row.schoolArea || "" }];
  }

  return matchedTongban.map((item) => ({
    ...row,
    sigun: item.sigun || row.sigun,
    eup: item.eup || row.eup,
    tongri: item.tongri || row.tongri,
    ban: item.ban || row.ban,
    area: item.area || row.area || row.schoolArea || "",
    schoolNote: row.note || "",
    note: row.note || ""
  }));
}

function renderSchoolLookupGroup(group) {
  const info = getSchoolInfo(group.school);
  return `
    <div class="school-lookup-stack">
      <div class="result-card primary school-info-card">
        <div class="card-header">
          <div class="card-title">
            <span>조회 학교</span>
            <strong>${escapeHtml(group.school)}</strong>
          </div>
        </div>
        <details>
          <summary>학교 관련 정보 보기</summary>
          <div class="details-body">
            ${renderSchoolInfoDetails(info)}
          </div>
        </details>
      </div>
      <div class="result-card school-zone-card">
        <div class="card-header">
          <div class="card-title">
            <span>통학구역 전체</span>
            <strong>${escapeHtml(group.school)}</strong>
          </div>
          <span class="badge green">${formatNumber(group.zones.length)}건</span>
        </div>
        <p class="result-note">학교 자료에 등록된 읍면동·통리반별 관할구역입니다.</p>
        <div class="school-zone-list">
          ${group.zones.map(renderSchoolZoneItem).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderSchoolZoneItem(item) {
  const label = [item.eup, item.tongri, item.ban].filter(Boolean).join(" ") || "통학구역";
  const areaText = item.area || item.schoolArea || "";
  const note = item.note ? `<p class="zone-note">${escapeHtml(item.note)}</p>` : "";

  return `
    <article class="tongban-row school-zone-item">
      <div class="tongban-row-main">
        <strong>${escapeHtml(label)}</strong>
      </div>
      <div class="tongban-row-detail">
        <span>관할구역</span>
        <p>${escapeHtml(areaText || "관할구역 상세 문구가 없습니다.")}</p>
      </div>
      ${note}
    </article>
  `;
}

function renderSchoolAreaRow(item) {
  const info = getSchoolInfo(item.school);
  return `
    <article class="compact-row">
      <div class="compact-row-title">
        <strong>${escapeHtml(item.school)}</strong>
        <span class="badge">${escapeHtml([item.eup, item.tongri].filter(Boolean).join(" "))}</span>
      </div>
      <div class="meta-line">${escapeHtml([item.eup, item.tongri, item.ban].filter(Boolean).join(" "))}</div>
      ${renderSchoolInfoSummary(info)}
      <details>
        <summary>통리반 정보 보기</summary>
        <div class="details-body">
          ${item.schoolArea ? `<div><strong>관할구역</strong><br>${escapeHtml(item.schoolArea)}</div>` : "<div>관할구역 상세 문구가 없습니다.</div>"}
          ${renderSchoolInfoDetails(info)}
          ${item.note ? `<div><strong>비고</strong><br>${escapeHtml(item.note)}</div>` : ""}
        </div>
      </details>
    </article>
  `;
}

function renderTongbanRow(item) {
  return `
    <article class="compact-row">
      <div class="compact-row-title">
        <strong>${escapeHtml(firstTongbanLabel(item))}</strong>
        <span class="badge">${escapeHtml(item.sigun || "지역")}</span>
      </div>
      <div class="meta-line">${escapeHtml(item.area || "관할구역 상세 문구가 없습니다.")}</div>
    </article>
  `;
}

function getSchoolInfo(schoolName) {
  const key = normalizeSchoolName(schoolName);
  return state.core?.schoolInfo?.[key] || null;
}

function renderSchoolInfoSummary(info) {
  if (!info) {
    return `<div class="school-info-panel muted">학교 기본정보가 없습니다.</div>`;
  }
  const homepage = info.homepage ? normalizeHomepage(info.homepage) : "";
  const phone = stripHtmlBreaks(info.phone || "");
  return `
    <div class="school-info-panel">
      <div class="school-info-item">
        <span>학교 주소</span>
        <strong>${escapeHtml(info.address || "-")}</strong>
      </div>
      <div class="school-info-item">
        <span>전화번호</span>
        <strong>${escapeHtml(phone || "-")}</strong>
      </div>
      ${homepage ? `<div class="school-info-item">
        <span>홈페이지</span>
        <strong><a href="${escapeHtml(homepage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(info.homepage)}</a></strong>
      </div>` : ""}
    </div>
  `;
}

function renderSchoolInfoDetails(info) {
  if (!info) return "";
  const homepage = info.homepage ? normalizeHomepage(info.homepage) : "";
  return `
    <div><strong>학교 주소</strong><br>${escapeHtml(info.address || "-")}</div>
    <div><strong>전화번호</strong><br>${escapeHtml(stripHtmlBreaks(info.phone || "-"))}</div>
    ${homepage ? `<div><strong>홈페이지</strong><br><a href="${escapeHtml(homepage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(info.homepage)}</a></div>` : ""}
  `;
}

function normalizeHomepage(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function stripHtmlBreaks(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, " / ").replace(/\s+/g, " ").trim();
}

function summaryBlock(label, value, hint) {
  return `<div class="summary-grid">${summaryTile(label, value, hint)}</div>`;
}

function summaryTile(label, value, hint) {
  return `
    <div class="summary-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
    </div>
  `;
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function alertCard(type, title, lines = []) {
  return `
    <div class="alert-card ${escapeHtml(type)}">
      <strong>${escapeHtml(title)}</strong>
      ${lines.length ? `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
    </div>
  `;
}

function renderWarning(title, lines) {
  showResults(alertCard("warning", title, lines));
}

function renderError(title, detail) {
  showResults(alertCard("error", title, detail ? [detail] : []));
}

function showResults(html) {
  els.emptyState.hidden = true;
  els.loadingState.hidden = true;
  els.results.hidden = false;
  els.results.innerHTML = `${html}${renderResultFooter()}`;
}

function renderResultFooter() {
  const dataYear = state.core?.meta?.dataYear || "현재";
  return `
    <div class="result-footer">
      <p>자료 기준: ${escapeHtml(dataYear)}학년도 · 최종 확인은 경기도화성오산교육지원청 학생배치과 안내를 따르세요.</p>
      <button class="secondary-button" type="button" data-action="search-again">다른 주소·학교 다시 검색하기</button>
    </div>
  `;
}

async function searchAddress(address) {
  const original = cleanText(address);
  let roadInfo = null;

  try {
    roadInfo = await roadToJibun(original);
  } catch (error) {
    console.warn("roads lookup failed", error);
  }

  const road = roadInfo?.road || "";
  const jibun = roadInfo?.jibun || "";
  const building = roadInfo?.building || "";
  const admin = roadInfo?.admin || "";
  const legal = roadInfo?.legal || "";
  const selectedRegion = getSelectedRegion();
  const sigun = road ? road.split(" ")[0] : selectedRegion.sigun;

  const searchQuery = roadInfo
    ? [sigun, admin, jibun, legal, building, original].filter(Boolean).join(" ")
    : original;

  let tongban = findTongban(searchQuery);

  // 도로명 주소만 입력한 경우(예: 동탄반석로 277) 같은 도로명 주소 안에
  // 여러 동이 있는 아파트는 기존 키워드 매칭만으로 누락될 수 있다.
  // 도로명 DB가 지번/건물명을 알려주면, 해당 지번과 건물명 기준으로
  // 통리반 자료를 한 번 더 찾아 대표 후보를 보여준다.
  if (typeof tongban === "string" && roadInfo) {
    const roadTongban = findTongbanByRoadInfo(roadInfo, original);
    if (Array.isArray(roadTongban) && roadTongban.length) {
      tongban = roadTongban;
    }
  }

  let school = findSchoolByTongban(tongban);
  let matchMethod = Array.isArray(school) ? "통리반 매칭" : "";

  // A21처럼 같은 블록명이 여러 지역/자료 행에 동시에 존재하는 경우,
  // 통리반 매칭이 먼저 성공하면 기존 로직은 키워드 매칭 결과를 더 보지 않아
  // 통학구역표에만 있는 향남읍 A21 같은 항목이 누락될 수 있다.
  // 블록 코드 검색에서는 통리반 결과와 통학구역 키워드 결과를 함께 보여준다.
  if (Array.isArray(school) && extractBlockCode(original)) {
    const keywordSchool = findSchoolByKeyword(original);
    if (Array.isArray(keywordSchool)) {
      school = mergeSchoolResults(school, keywordSchool);
      matchMethod = "통리반·키워드 병합 매칭";
    }
  }

  if (typeof school === "string" && building) {
    school = findSchoolByKeyword(building);
    matchMethod = Array.isArray(school) ? "건물명 유사 매칭" : "";
  }

  if (typeof school === "string") {
    school = findSchoolByKeyword(original);
    matchMethod = Array.isArray(school) ? "키워드 유사 매칭" : "";
  }

  if (Array.isArray(school)) {
    school = filterResultsBySelectedRegion(school);
    if (!school.length) {
      school = "선택한 지역 안에서는 검색 결과가 없습니다.";
      matchMethod = "";
    }
  }

  return {
    input: original,
    regionLabel: selectedRegionLabel(),
    road,
    jibun: jibun || original,
    building,
    admin,
    legal,
    tongban,
    school,
    matchMethod,
  };
}

async function roadToJibun(address) {
  const query = normalizeSearchKey(address);
  if (query.length < 4) return null;

  const roads = await loadRoads();
  const exact = roads.find((row) => row.k && row.k.includes(query));
  const reverse = exact || roads.find((row) => row.k && query.includes(row.k) && row.k.length >= 5);
  const row = reverse || findRoadByTokens(roads, query);

  if (!row) return null;
  return {
    jibun: row.j || "",
    road: row.r || "",
    building: row.b || "",
    admin: row.a || "",
    legal: row.l || "",
  };
}

function findRoadByTokens(roads, query) {
  const tokens = query.match(/[가-힣a-z0-9-]{2,}/g) || [];
  const usefulTokens = tokens.filter((token) => !["경기도", "화성시", "오산시"].includes(token) && token.length >= 3);
  if (!usefulTokens.length) return null;

  let best = null;
  let bestScore = 0;
  for (const row of roads) {
    const key = row.k || "";
    let score = 0;
    for (const token of usefulTokens) {
      if (key.includes(token)) score += token.length;
    }
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  return bestScore >= 4 ? best : null;
}

function parseAddress(address) {
  const cleaned = cleanText(address);
  const match = cleaned.match(/(?:경기도\s*)?([가-힣]+(?:시|군))?\s*([가-힣0-9]+(?:읍|면|동))?\s*([가-힣0-9]+(?:동|리))\s+(산)?\s*(\d+)(?:-(\d+))?/);

  if (match) {
    return {
      sigun: match[1] || "",
      eup: match[2] || "",
      legalArea: match[3],
      isMountain: Boolean(match[4]),
      mainNo: Number(match[5]),
      subNo: match[6] ? Number(match[6]) : null,
      original: cleaned,
    };
  }

  const hints = [
    ["비봉", "비봉면"],
    ["남양", "남양읍"],
    ["봉담", "봉담읍"],
    ["향남", "향남읍"],
    ["세마", "세마동"],
    ["동탄9", "동탄9동"],
    ["동탄8", "동탄8동"],
    ["동탄7", "동탄7동"],
    ["동탄6", "동탄6동"],
    ["동탄5", "동탄5동"],
    ["동탄4", "동탄4동"],
    ["동탄3", "동탄3동"],
    ["동탄2", "동탄2동"],
    ["동탄1", "동탄1동"],
  ];
  const regionHint = hints.find(([token]) => cleaned.includes(token))?.[1] || "";
  const sigunMatch = cleaned.match(/(?:경기도\s*)?([가-힣]+(?:시|군))/);
  const eupMatch = cleaned.match(/([가-힣]+(?:읍|면|동))/);

  return {
    sigun: sigunMatch ? sigunMatch[1] : "",
    eup: eupMatch ? eupMatch[1] : regionHint,
    legalArea: "",
    isMountain: false,
    mainNo: null,
    subNo: null,
    original: cleaned,
  };
}

function findTongban(address) {
  const parsed = parseAddress(address);
  let rows = applySelectedRegionToTongban(state.core.tongban || []);

  if (parsed.sigun) {
    rows = rows.filter((row) => (row.sigun || "").includes(parsed.sigun));
  }

  if (parsed.eup) {
    rows = rows.filter((row) => (row.eup || "").includes(parsed.eup));
  }

  const explicitBlock = extractBlockCode(address);
  const results = [];
  for (const row of rows) {
    const jibunMatch = parsed.legalArea && parsed.mainNo !== null
      ? containsJibun(row.area, parsed.legalArea, parsed.mainNo, parsed.subNo, parsed.isMountain)
      : false;

    const blockMatch = containsBlock(row.area, address) || containsBlockFlexible(row.area, address);
    const apartmentDongMatch = containsApartmentDong(row.area, address);
    const preciseApartmentMatch = containsPreciseApartmentKeyword(row.area, address);
    const broadMatchAllowed = !explicitBlock && !extractBuildingDong(address) && !hasPreciseApartmentIdentifier(address);

    if (
      jibunMatch ||
      apartmentDongMatch ||
      blockMatch ||
      preciseApartmentMatch ||
      (broadMatchAllowed && (containsDistrictName(row.area, address) || containsAreaKeyword(row.area, address)))
    ) {
      results.push(row);
    }
  }

  return results.length ? results : "검색 결과가 없습니다. 예외 규칙 추가가 필요할 수 있습니다.";
}


function findTongbanByRoadInfo(roadInfo, originalInput = "") {
  if (!roadInfo) return [];

  const jibun = cleanText(roadInfo.jibun || "");
  const building = cleanText(roadInfo.building || "");
  const admin = cleanText(roadInfo.admin || "");
  const legal = cleanText(roadInfo.legal || "");
  const originalDong = extractBuildingDong(originalInput);
  const parsed = parseAddress([admin, jibun, legal].filter(Boolean).join(" "));

  let rows = applySelectedRegionToTongban(state.core.tongban || []);
  if (admin) {
    const adminNorm = normalizeText(admin);
    rows = rows.filter((row) => normalizeText(row.eup || "").includes(adminNorm));
  }

  const aliasTexts = getApartmentAliases(building);
  const buildingTokens = unique(
    [building, ...aliasTexts]
      .flatMap((value) => splitMeaningfulKeywords(value))
      .filter((token) => token.length >= 2)
  );
  const blockCodes = unique([building, ...aliasTexts].flatMap((value) => extractBlockCodes(value)));
  const buildingNorm = looseNormalize([building, ...aliasTexts].join(" "));
  const results = [];

  for (const row of rows) {
    const area = row.area || "";
    const areaNorm = looseNormalize(area);

    const jibunMatch = parsed.legalArea && parsed.mainNo !== null
      ? containsJibun(area, parsed.legalArea, parsed.mainNo, parsed.subNo, parsed.isMountain)
      : false;

    const blockMatch = blockCodes.length ? blockCodes.some((code) => areaNorm.includes(looseNormalize(code))) : false;
    const tokenMatches = buildingTokens.filter((token) => areaNorm.includes(token));
    const buildingMatch = tokenMatches.length >= 2 || blockMatch || hasSharedApartmentBrand(areaNorm, buildingNorm);
    const dongMatch = originalDong ? normalizeForApartment(area).includes(originalDong) : true;

    if (dongMatch && (jibunMatch || buildingMatch)) {
      results.push({ row, score: (blockMatch ? 100 : 0) + (jibunMatch ? 50 : 0) + tokenMatches.length * 10 });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .filter((item, _index, array) => !array.length || item.score >= Math.max(20, array[0].score - 10))
    .map((item) => item.row);
}

function getApartmentAliases(name) {
  const nameNorm = looseNormalize(name);
  const aliases = [];

  for (const [aptName, aptAliases] of Object.entries(APT_ALIAS)) {
    const aptNorm = looseNormalize(aptName);
    if (nameNorm.includes(aptNorm) || aptNorm.includes(nameNorm)) {
      aliases.push(...aptAliases);
    }
  }

  // 도로명주소 건물명은 “동탄역반도유보라아이비파크2.0”처럼 들어오지만,
  // 통학구역 자료는 “A13블록 반도유보라2차”처럼 표기되는 경우가 많다.
  // 이런 계열명 차이를 자동으로 보완한다.
  const ivypackMatch = nameNorm.match(/반도유보라아이비파크(\d)(?:0)?/);
  if (ivypackMatch) {
    const order = ivypackMatch[1];
    aliases.push(`반도유보라${order}차`, `반도유보라아이비파크${order}차`);
  }

  return unique(aliases);
}

function mergeSchoolResults(primary, secondary) {
  const merged = [];
  const seen = new Set();

  for (const item of [...(primary || []), ...(secondary || [])]) {
    const key = [
      item.school || "",
      item.eup || "",
      item.tongri || "",
      item.ban || "",
      item.schoolArea || "",
      item.tongbanArea || "",
    ].map((value) => normalizeText(value || "")).join("|");

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

function findSchoolByTongban(tongbanResult) {
  if (!Array.isArray(tongbanResult)) return tongbanResult;

  const finalResults = [];
  for (const item of tongbanResult) {
    const eup = normalizeText(item.eup);
    const tongri = normalizeText(item.tongri);
    const ban = normalizeText(item.ban);
    let matchedForItem = false;

    for (const row of state.core.schools) {
      if (row.eupKey === eup && row.tongriKey === tongri && banMatches(row.ban, ban)) {
        matchedForItem = true;
        finalResults.push({
          school: row.school,
          sigun: item.sigun || "",
          eup: item.eup,
          tongri: item.tongri,
          ban: item.ban,
          tongbanArea: item.area,
          schoolArea: row.area,
          note: row.note,
          match: "통리반",
        });
      }
    }

    // 통리·반이 비어 있거나 "미정"인 행은 통학구역표와 직접 연결되지 않을 수 있다.
    // 이때는 같은 읍면동 안에서 관할구역 설명(블록명, 단지명, 행복주택 등)을
    // 통학구역표의 관할구역/비고와 다시 비교해 후보 학교를 보완한다.
    if (!matchedForItem) {
      const areaOnlySchools = findSchoolsByTongbanAreaKeyword(item);
      for (const areaOnly of areaOnlySchools) {
        finalResults.push(areaOnly);
      }

      const specialSchools = findSpecialSchoolsForTongban(item);
      for (const special of specialSchools) {
        finalResults.push(special);
      }
    }
  }

  return finalResults.length ? mergeSchoolResults([], finalResults) : "통리반은 찾았지만, 통학구역 자료에서 학교를 찾지 못했습니다.";
}

function findSchoolsByTongbanAreaKeyword(item) {
  const eup = normalizeText(item.eup || "");
  const area = cleanText(item.area || "");
  if (!eup || !area) return [];

  const areaNorm = looseNormalize(area);
  const areaTokens = splitMeaningfulKeywords(area).filter((token) => token.length >= 2);
  const areaBlocks = extractBlockCodes(area);
  const results = [];

  for (const row of state.core.schools || []) {
    if (row.eupKey !== eup) continue;

    const schoolText = [row.area, row.note, row.tongri, row.ban].filter(Boolean).join(" ");
    const schoolNorm = looseNormalize(schoolText);
    const schoolBlocks = extractBlockCodes(schoolText);
    let score = 0;
    const matchedTokens = [];

    const sharedBlocks = areaBlocks.filter((block) => schoolBlocks.includes(block));
    if (sharedBlocks.length) {
      score += 80 * sharedBlocks.length;
      matchedTokens.push(...sharedBlocks);
    }

    for (const token of areaTokens) {
      if (isWeakAreaToken(token)) continue;
      if (schoolNorm.includes(token)) {
        score += token.length >= 4 ? 35 : 20;
        matchedTokens.push(token);
      }
    }

    const sim = similarity(areaNorm, schoolNorm);
    if (areaNorm.length >= 4 && sim >= 0.25) {
      score += sim * 40;
    }

    if (score >= 55) {
      results.push({
        score: Math.round(score * 100) / 100,
        tokens: unique(matchedTokens).join(", "),
        school: row.school,
        sigun: item.sigun || "",
        eup: item.eup || row.eup,
        tongri: item.tongri || "",
        ban: item.ban || "",
        tongbanArea: item.area || "",
        schoolArea: row.area || "",
        note: row.note || "",
        match: "관할구역 설명",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

function isWeakAreaToken(token) {
  return new Set([
    "행복주택", "공동주택", "단독주택", "택지", "지구", "블록", "BL",
    "아파트", "주택", "단지", "마을", "영구임대", "LH",
  ]).has(token);
}

function findSpecialSchoolsForTongban(item) {
  const eup = normalizeText(item.eup);
  const tongri = normalizeText(item.tongri);
  const areaNorm = looseNormalize(item.area || "");
  const results = [];

  if (eup === "향남읍" && tongri === "미정" && areaNorm.includes("A21") && areaNorm.includes("행복주택")) {
    results.push({
      school: "화원초",
      sigun: item.sigun || "화성시",
      eup: item.eup || "향남읍",
      tongri: item.tongri || "미정",
      ban: item.ban || "미정",
      tongbanArea: item.area || "A21, A22 행복주택",
      schoolArea: "향남읍 A21 행복주택",
      note: "통리반 자료의 미정 행 기준 후보",
      match: "예외 규칙",
    });
  }

  return results;
}

function findSchoolByKeyword(keyword) {
  const keywordNorm = looseNormalize(keyword);
  let keywordTokens = splitMeaningfulKeywords(keyword);

  for (const [aptName, aliases] of Object.entries(APT_ALIAS)) {
    const aptNorm = looseNormalize(aptName);
    if (keywordNorm.includes(aptNorm)) {
      for (const alias of aliases) {
        keywordTokens = keywordTokens.concat(splitMeaningfulKeywords(alias));
      }
    }
  }

  keywordTokens = unique(keywordTokens);
  if (!keywordNorm && !keywordTokens.length) {
    return "통학구역 자료에서 검색할 키워드가 없습니다.";
  }

  const results = [];
  for (const row of state.core.schools) {
    if (!rowMatchesSelectedRegion(row)) continue;
    const searchText = [row.school, row.eup, row.tongri, row.ban, row.area, row.note].join(" ");
    const searchNorm = looseNormalize(searchText);
    let score = 0;
    const matchedTokens = [];

    if (keywordNorm && searchNorm.includes(keywordNorm)) {
      score += 100;
    }

    for (const token of keywordTokens) {
      if (searchNorm.includes(token)) {
        score += 25;
        matchedTokens.push(token);
      }
    }

    const sim = similarity(keywordNorm, searchNorm);
    if (sim >= 0.15) {
      score += sim * 30;
    }

    if (score >= 25) {
      results.push({
        score: Math.round(score * 100) / 100,
        tokens: matchedTokens.join(", "),
        school: row.school,
        sigun: "",
        eup: row.eup,
        tongri: row.tongri,
        ban: row.ban,
        tongbanArea: "",
        schoolArea: row.area,
        note: row.note,
        match: "키워드",
      });
    }
  }

  if (!results.length) {
    return "통학구역 자료에서 키워드로도 찾지 못했습니다.";
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

function searchSchoolArea(schoolName) {
  const keyword = normalizeSchoolName(schoolName);
  const results = state.core.schools
    .filter((row) => rowMatchesSelectedRegion(row))
    .filter((row) => row.schoolKey.includes(keyword))
    .map((row) => ({
      school: row.school,
      eup: row.eup,
      tongri: row.tongri,
      ban: row.ban,
      schoolArea: row.area,
      note: row.note,
    }));

  return results.length ? results : "해당 학교명을 찾지 못했습니다.";
}

function containsJibun(areaText, legalArea, mainNo, subNo = null, isMountain = false) {
  let area = cleanText(areaText);
  if (!legalArea || !area.includes(legalArea)) return false;

  area = area.replace(/\([^)]*\)/g, " ");
  let text = area.replaceAll(legalArea, "");
  text = text.replace(/\d+\s*호/g, " ");
  text = text.replace(/\d{3,4}\s*동/g, " ");
  text = text.replace(/\d+\s*층/g, " ");

  const target = { main: Number(mainNo), sub: subNo === null ? null : Number(subNo) };
  const parts = text.split(/[,，/ㆍ]/);
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    const partHasMountain = part.includes("산");
    if (isMountain !== partHasMountain) continue;

    part = part.replaceAll("산", "").trim();
    if (jibunPartMatches(part, target)) return true;
  }

  return false;
}

function jibunPartMatches(part, target) {
  // 예: 49∼52-1, 34-1∼5, 391-1~391-13, 상리 27부터 39까지
  const rangePattern = /(\d+(?:-\d+)?)\s*(?:[~∼〜－–—]|부터)\s*(\d+(?:-\d+)?)(?:\s*까지)?/g;
  const rangeMatches = [...part.matchAll(rangePattern)];
  if (rangeMatches.some((match) => {
    const start = parseJibunToken(match[1]);
    const end = parseJibunRangeEnd(match[2], start);
    return isJibunInRange(target, start, end);
  })) {
    return true;
  }

  const withoutRanges = part.replace(rangePattern, " ");
  const tokens = withoutRanges.match(/\d+(?:-\d+)?/g) || [];
  return tokens.some((token) => isSameJibun(target, parseJibunToken(token)));
}

function parseJibunToken(token, defaultMain = null) {
  const [first, second] = String(token).split("-").map((value) => Number(value));
  if (second === undefined) {
    // 34-1∼5 같은 표기에서는 오른쪽 5가 본번이 아니라 부번 5입니다.
    return defaultMain !== null ? { main: defaultMain, sub: first } : { main: first, sub: null };
  }
  return { main: first, sub: second };
}

function parseJibunRangeEnd(token, start) {
  const value = String(token);
  if (value.includes("-")) return parseJibunToken(value);

  const number = Number(value);
  // 34-1∼5처럼 오른쪽 숫자가 시작 본번보다 작으면 같은 본번의 부번 범위로 봅니다.
  // 623-1부터 629까지처럼 오른쪽 숫자가 시작 본번 이상이면 본번 범위로 봅니다.
  if (start.sub !== null && number < start.main) {
    return { main: start.main, sub: number };
  }
  return { main: number, sub: null };
}

function compareJibun(a, b) {
  if (a.main !== b.main) return a.main - b.main;
  return (a.sub || 0) - (b.sub || 0);
}

function isJibunInRange(target, start, end) {
  return compareJibun(start, target) <= 0 && compareJibun(target, end) <= 0;
}

function isSameJibun(target, item) {
  return target.main === item.main && (target.sub || 0) === (item.sub || 0);
}

function containsApartmentDong(areaText, address) {
  const areaNorm = normalizeForApartment(areaText);
  const addrNorm = normalizeForApartment(address);
  const buildingDong = extractBuildingDong(address);
  if (!buildingDong || !areaNorm.includes(buildingDong)) return false;

  const words = addrNorm.match(/[가-힣A-Za-z]{2,}/g) || [];
  const stopwords = new Set([
    "경기도", "화성시", "오산시", "동탄", "동탄동",
    "동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동",
    "동탄6동", "동탄7동", "동탄8동", "동탄9동",
    "아파트", "마을", "단지", "센트럴", "파크", "블록",
  ]);
  const keywords = words.filter((word) => !stopwords.has(word));
  if (keywords.some((word) => areaNorm.includes(word))) return true;

  // 같은 브랜드(e편한세상 등)와 같은 동 번호만으로는 서로 다른 단지가
  // 잘못 잡힐 수 있다. 예: "세마e편한세상 101동" → "오산세교대림e편한세상 101동".
  // 따라서 동 번호 매칭에서는 브랜드 공유만으로는 후보로 인정하지 않는다.
  return false;
}

function containsBlock(areaText, address) {
  const blockCode = extractBlockCode(address);
  if (!blockCode) return false;
  return extractBlockCodes(areaText).includes(blockCode);
}

function containsBlockFlexible(areaText, address) {
  const blockCode = extractBlockCode(address);
  if (!blockCode) return false;
  return extractBlockCodes(areaText).includes(blockCode);
}

function hasPreciseApartmentIdentifier(address) {
  const addrNorm = normalizeForApartment(address).toUpperCase();
  return /LH\d{1,2}/.test(addrNorm) || /[A-Z]\d{1,2}블록/.test(addrNorm) || /\d{1,2}단지/.test(addrNorm) || Boolean(extractBuildingDong(address));
}

function containsPreciseApartmentKeyword(areaText, address) {
  const areaNorm = normalizeForApartment(areaText).toUpperCase();
  const addrNorm = normalizeForApartment(address).toUpperCase();
  const tokens = [];

  const patterns = [
    /LH\d{1,2}/g,
    /[A-Z]\d{1,2}블록/g,
    /\d{1,2}단지/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(addrNorm)) !== null) {
      tokens.push(match[0]);
    }
  }

  return unique(tokens).some((token) => areaNorm.includes(token));
}

function containsDistrictName(areaText, address) {
  const areaNorm = normalizeText(areaText).replace("(2)", "2");
  const addrNorm = normalizeText(address).replace("(2)", "2");
  const districtKeywords = [
    "비봉공공주택지구",
    "남양뉴타운",
    "동탄2택지개발지구",
    "동탄(2)택지개발지구",
    "동탄택지개발지구",
    "향남택지개발지구",
    "봉담택지개발지구",
    "봉담2지구",
    "태안택지개발지구",
  ];

  return districtKeywords.some((keyword) => {
    const normalized = normalizeText(keyword).replace("(2)", "2");
    return areaNorm.includes(normalized) && addrNorm.includes(normalized);
  });
}

function containsAreaKeyword(areaText, address) {
  const areaNorm = looseNormalize(areaText);
  let addrNorm = looseNormalize(address);
  const removeWords = ["경기도", "화성시", "오산시", "아파트", "단지", "마을"];

  for (const word of removeWords) {
    addrNorm = addrNorm.replaceAll(looseNormalize(word), "");
  }

  const tokens = addrNorm.match(/[가-힣A-Z0-9]{2,}/g) || [];
  const stopwords = new Set([
    "동탄", "동탄동", "동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동",
    "동탄6동", "동탄7동", "동탄8동", "동탄9동", "동탄2", "택지개발지구",
    "공공주택지구", "뉴타운", "블록", "BL",
  ]);
  const meaningfulTokens = tokens.filter((token) => !stopwords.has(token) && token.length >= 3);

  if (meaningfulTokens.some((token) => areaNorm.includes(token))) {
    return true;
  }

  return addrNorm.length >= 3 && areaNorm.includes(addrNorm);
}

function cleanText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replaceAll("～", "~")
    .replaceAll("?", "~")
    .replaceAll("부터", "~")
    .replaceAll("까지", "")
    .replaceAll("번지", "");
}

function normalizeText(value) {
  return cleanText(value).replace(/\s+/g, "");
}

function normalizeSearchKey(value) {
  return normalizeApartmentName(cleanText(value))
    .toLowerCase()
    .replace(/\s+/g, "")
    .replaceAll("경기도", "");
}

function normalizeApartmentName(value) {
  return cleanText(value).replace(/(?:이|e)\s*[-~]?\s*편한세상/gi, "e편한세상");
}

function normalizeForApartment(value) {
  return normalizeApartmentName(value)
    .replace(/\s+/g, "")
    .replaceAll("엘에이치", "LH")
    .replaceAll("엘에치", "LH")
    .replaceAll("에이치엘", "HL")
    .replaceAll("～", "~")
    .replaceAll("아파트", "")
    .replaceAll("APT", "");
}

function looseNormalize(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replaceAll("-", "")
    .replaceAll("_", "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll("블럭", "블록")
    .replaceAll("BL.", "BL")
    .replaceAll("BLOCK", "BL")
    .replaceAll("아파트", "")
    .replaceAll("APT", "");
}

function normalizeBan(value) {
  return normalizeText(value).replaceAll("제", "");
}

function normalizeSchoolName(value) {
  return normalizeText(value).replaceAll("초등학교", "초").replaceAll("초교", "초");
}

function banMatches(schoolBan, foundBan) {
  const normalizedSchoolBan = normalizeBan(schoolBan);
  const normalizedFoundBan = normalizeBan(foundBan);

  if (!normalizedSchoolBan) return true;

  const foundMatch = normalizedFoundBan.match(/(\d+)/);
  if (!foundMatch) return false;
  const foundNumber = Number(foundMatch[1]);

  if (normalizedSchoolBan === normalizedFoundBan) return true;

  const rangeMatch = normalizedSchoolBan.match(/(\d+)반?\s*~\s*(\d+)반?/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    return start <= foundNumber && foundNumber <= end;
  }

  const numbers = normalizedSchoolBan.match(/\d+/g) || [];
  return numbers.map(Number).includes(foundNumber);
}

function extractBuildingDong(value) {
  const match = normalizeForApartment(value).match(/(\d{2,4})동/);
  return match ? `${match[1]}동` : "";
}

function extractBlockCode(value) {
  return extractBlockCodes(value)[0] || "";
}

function extractBlockCodes(value) {
  const text = normalizeForApartment(value).toUpperCase().replaceAll("블럭", "블록");
  const codes = [];
  const patterns = [
    /([A-Z])[-\s]?(\d{1,2})\s*(?:블록|BL)?/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      codes.push(`${match[1]}${Number(match[2])}블록`);
    }
  }
  return unique(codes);
}

function hasSharedApartmentBrand(areaNorm, addrNorm) {
  const brands = ["e편한세상", "우미린", "롯데캐슬", "반도유보라", "호반", "자이", "푸르지오", "힐스테이트", "아이파크", "더샵", "트루엘"];
  return brands.some((brand) => areaNorm.includes(brand) && addrNorm.includes(brand));
}

function splitMeaningfulKeywords(value) {
  let text = looseNormalize(value);
  const removeWords = [
    "경기도", "화성시", "오산시",
    "아파트", "APT", "단지", "마을",
    "동탄", "동탄2", "동탄신도시", "동탄2신도시",
    "더", "THE",
  ];

  for (const word of removeWords) {
    text = text.replaceAll(looseNormalize(word), "");
  }

  return (text.match(/[가-힣A-Z0-9]{2,}/g) || []).filter((token) => token.length >= 2);
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const aSet = new Set(toBigrams(a));
  const bSet = new Set(toBigrams(b));
  if (!aSet.size || !bSet.size) return 0;

  let intersection = 0;
  for (const item of aSet) {
    if (bSet.has(item)) intersection += 1;
  }

  return (2 * intersection) / (aSet.size + bSet.size);
}

function toBigrams(value) {
  const text = String(value);
  if (text.length < 2) return text ? [text] : [];
  const grams = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    grams.push(text.slice(i, i + 2));
  }
  return grams;
}

function firstTongbanLabel(item) {
  if (!item) return "";
  return [item.sigun, item.eup, item.tongri, item.ban].filter(Boolean).join(" ");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

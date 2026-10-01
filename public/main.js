const APP_VERSION = "20260929-v35-gis-mismatch-notice";

const DATA_PATHS = {
  core: `/data/core.json?v=${APP_VERSION}`,
  roads: `/data/roads.json?v=${APP_VERSION}`,
  suggestions: `/data/suggestions.json?v=${APP_VERSION}`,
  searchIndex: `/data/search_index.json?v=${APP_VERSION}`,
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
  searchIndex: null,
  searchIndexPromise: null,
  addressSuggestionMatches: [],
  schoolSuggestionMatches: [],
  activeSuggestionIndex: -1,
  activeSchoolSuggestionIndex: -1,
  activeMode: "address",
  regionMap: {},
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
  } catch (error) {
    renderError("자료를 불러오지 못했습니다.", "새로고침 후에도 같은 문제가 있으면 배포된 data 파일을 확인해 주세요.");
    console.error(error);
  }
}

function collectElements() {
  els.themeToggle = document.querySelector("#themeToggle");
  els.dataChip = document.querySelector("#dataChip");
  els.addressTab = document.querySelector("#addressTab");
  els.schoolTab = document.querySelector("#schoolTab");
  els.mapTab = document.querySelector("#mapTab");
  els.addressMode = document.querySelector("#addressMode");
  els.schoolMode = document.querySelector("#schoolMode");
  els.mapMode = document.querySelector("#mapMode");
  els.fullMapPanel = document.querySelector("#fullMapPanel");
  els.zoneSchoolInput = document.querySelector("#zoneSchoolInput");
  els.zoneSchoolList = document.querySelector("#zoneSchoolList");
  els.zoneSchoolSearchButton = document.querySelector("#zoneSchoolSearchButton");
  els.zoneMapResetButton = document.querySelector("#zoneMapResetButton");
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
  els.themeToggle.addEventListener("click", toggleTheme);
  els.addressTab.addEventListener("click", () => switchMode("address"));
  els.schoolTab?.addEventListener("click", () => switchMode("school"));
  els.mapTab?.addEventListener("click", () => switchMode("map"));
  els.zoneSchoolSearchButton?.addEventListener("click", focusFullMapSchool);
  els.zoneMapResetButton?.addEventListener("click", resetFullMapView);
  els.zoneSchoolInput?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); focusFullMapSchool(); } });
  els.citySelect?.addEventListener("change", () => { populateEupOptions(); handleAddressSuggestionInput(); });
  els.eupSelect?.addEventListener("change", () => handleAddressSuggestionInput());

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

  els.schoolMode?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideSchoolSuggestions();
    await handleSchoolSearch(els.schoolInput.value);
  });

  els.schoolInput?.addEventListener("input", () => {
    updateClearButtons();
    handleSchoolSuggestionInput();
  });
  els.schoolInput?.addEventListener("focus", handleSchoolSuggestionInput);
  els.schoolInput?.addEventListener("keydown", handleSchoolSuggestionKeys);
  els.schoolInput?.addEventListener("blur", () => {
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

  els.schoolSuggestions?.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const option = event.target.closest("[data-school-suggestion-index]");
    if (!option) return;
    selectSchoolSuggestion(Number(option.dataset.schoolSuggestionIndex));
  });

  els.results.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "search-again") {
      const targetInput = state.activeMode === "school" && els.schoolInput ? els.schoolInput : els.addressInput;
      targetInput?.focus({ preventScroll: true });
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
  const isSchool = mode === "school";
  const isMap = mode === "map";
  hideAddressSuggestions();
  hideSchoolSuggestions();

  els.addressTab.classList.toggle("is-active", isAddress);
  els.schoolTab?.classList.toggle("is-active", isSchool);
  els.mapTab?.classList.toggle("is-active", isMap);
  els.addressTab.setAttribute("aria-selected", String(isAddress));
  els.schoolTab?.setAttribute("aria-selected", String(isSchool));
  els.mapTab?.setAttribute("aria-selected", String(isMap));
  els.addressMode.hidden = !isAddress;
  if (els.schoolMode) els.schoolMode.hidden = !isSchool;
  if (els.mapMode) els.mapMode.hidden = !isMap;
  if (els.fullMapPanel) els.fullMapPanel.hidden = !isMap;
  const resultPanel = document.querySelector(".result-panel");
  if (resultPanel) resultPanel.hidden = isMap;
  document.querySelector(".workspace")?.classList.toggle("is-map-mode", isMap);

  if (isMap) {
    window.setTimeout(initFullSchoolZoneMap, 0);
    return;
  }
  const input = isAddress ? els.addressInput : els.schoolInput;
  input?.focus({ preventScroll: true });
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

async function loadSearchIndex() {
  if (state.searchIndex) return state.searchIndex;
  if (!state.searchIndexPromise) {
    state.searchIndexPromise = fetchJson(DATA_PATHS.searchIndex).then((payload) => payload.index || payload || {});
  }
  state.searchIndex = await state.searchIndexPromise;
  return state.searchIndex;
}

async function loadSuggestions() {
  if (state.suggestions) return state.suggestions;
  if (!state.suggestionsPromise) {
    state.suggestionsPromise = fetchJson(DATA_PATHS.suggestions).then((payload) => payload.suggestions || []);
  }
  state.suggestions = await state.suggestionsPromise;
  return state.suggestions;
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

  let html = renderAddressSchoolCard(schools, result.school, result.matchMethod, tongban);
  if (result.tongbanSourceUnconfirmed && schoolNames.length) {
    html += `
      <div class="result-card">
        <div class="card-header">
          <div class="card-title">
            <span>확인 필요</span>
            <strong>통리반 원자료 미확인 주소</strong>
          </div>
          <span class="badge">참고</span>
        </div>
        <p class="result-note">해당 주소는 통리반 원자료에서 확인되지 않아 배정학교를 확정할 수 없습니다. 위 학교는 현재 공공 학구도 GIS에서 검색 주소가 포함되는 통학구역을 기준으로 표시한 참고 결과입니다.</p>
      </div>`;
  }

  if (result.sourceOverridesGisBoundary && !result.tongbanSourceUnconfirmed) {
    html += `
      <div class="result-card">
        <div class="card-header">
          <div class="card-title">
            <span>지도 안내</span>
            <strong>통학구역 경계 보정 테스트</strong>
          </div>
          <span class="badge">원자료 우선</span>
        </div>
        <p class="result-note">현재 공공데이터의 통학구역 경계와 2026학년도 통학구역 원자료가 일치하지 않습니다. 반송초 지적도 기반 1차 보정안이 확인된 주소는 지도에 보정 경계를 표시하며, 그 외 충돌 주소는 기존 GIS 경계를 표시하지 않습니다. 배정학교는 2026학년도 통학구역 원자료를 기준으로 확인해 주세요.</p>
      </div>`;
  }

  html += renderAddressTongbanCard(tongban, result.input);

  // 주소 매칭 정보 카드는 화면에서 제거한다.
  // 학교가 하나 이상 확정되면 공동학구를 포함해 결과 지도를 표시한다.
  const canShowMap = schoolNames.length >= 1 && Boolean(result.road || result.input);
  if (canShowMap) html += renderMapCard();

  showResults(html);

  if (canShowMap) {
    const schoolItems = schoolNames.map((name) => {
      const info = getSchoolInfo(name);
      return { name, address: info?.mapAddress || info?.address || "" };
    });
    window.setTimeout(() => initResultMap(result.road || result.input, schoolItems, { hideGisBoundary: Boolean(result.sourceOverridesGisBoundary) }), 0);
  }
}

function renderMapCard() {
  return `
    <div class="result-card map-result-card">
      <div class="card-header">
        <div class="card-title">
          <span>위치 확인</span>
          <strong>검색 주소와 배정학교 위치·통학구역</strong>
        </div>
        <span class="badge">지도</span>
      </div>
      <p class="result-note">카카오맵을 활용한 지도입니다.</p>
      <div id="resultMap" class="result-map" aria-label="검색 주소와 배정학교 위치 지도"></div>
      <p id="mapStatus" class="map-status">지도를 불러오는 중입니다.</p>
    </div>
  `;
}

function cleanGeocodeAddress(value) {
  let cleaned = cleanText(String(value || "")
    .replace(/^\(\d{5}\)\s*/, "")
    .replace(/\([^)]*\)\s*$/, "")
    .replace(/[.]/g, " "));

  // 학교 기본정보에 "동탄반석로 84. 84"처럼 도로번호가 중복된 경우
  // 카카오 주소검색이 실패할 수 있으므로 마지막 중복 번호를 하나로 정리한다.
  cleaned = cleaned.replace(/((?:대로|로|길)\s*\d+(?:-\d+)?)\s+\d+(?:-\d+)?$/, "$1");
  return cleaned;
}

function loadKakaoMapSdk() {
  if (window.kakao?.maps?.services) return Promise.resolve();
  if (window.__kakaoMapSdkPromise) return window.__kakaoMapSdkPromise;

  const key = String(window.MAP_CONFIG?.kakaoJavaScriptKey || "").trim();
  if (!key || key === "여기에_JAVASCRIPT_키를_붙여넣으세요") {
    return Promise.reject(new Error("KAKAO_KEY_MISSING"));
  }

  window.__kakaoMapSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.onload = () => {
      if (!window.kakao?.maps) return reject(new Error("KAKAO_SDK_LOAD_FAILED"));
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = () => reject(new Error("KAKAO_SDK_LOAD_FAILED"));
    document.head.appendChild(script);
  });
  return window.__kakaoMapSdkPromise;
}

function geocodeAddressOnce(geocoder, address) {
  return new Promise((resolve, reject) => {
    geocoder.addressSearch(address, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK && result?.length) {
        resolve(new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x)));
      } else {
        reject(new Error(`GEOCODE_FAILED:${address}`));
      }
    });
  });
}

async function geocodeAddress(geocoder, address) {
  const original = cleanText(address);
  const candidates = unique([
    original,
    // 읍면동+지번만 입력한 경우(예: 신동 874) 화성시 주소로 한 번 더 조회한다.
    /^[가-힣]+(?:동|읍|면|리)\s+산?\s*\d/.test(original) ? `경기도 화성시 ${original}` : "",
    // 2026년 신설 구 명칭이 카카오 주소 DB에 아직 반영되지 않은 경우를 대비.
    original.replace(/(경기도\s+화성시)\s+(?:동탄구|만세구|효행구|병점구)\s+/, "$1 "),
    original.replace(/(화성시)\s+(?:동탄구|만세구|효행구|병점구)\s+/, "$1 "),
  ].filter(Boolean));

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return await geocodeAddressOnce(geocoder, candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`GEOCODE_FAILED:${original}`);
}

let schoolZoneGeoJsonPromise = null;
let correctedElementaryZoneGeoJsonPromise = null;
let middleZoneGeoJsonPromise = null;
let publicSchoolPointsPromise = null;

function loadPublicSchoolPoints() {
  if (!publicSchoolPointsPromise) {
    publicSchoolPointsPromise = fetch(`/data/schools_hwaseong_osan_20260320.json?v=${APP_VERSION}`)
      .then((response) => {
        if (!response.ok) throw new Error("PUBLIC_SCHOOL_POINTS_LOAD_FAILED");
        return response.json();
      });
  }
  return publicSchoolPointsPromise;
}

let middleSchoolInfoPromise = null;
function loadMiddleSchoolInfoForAddressResult() {
  if (!middleSchoolInfoPromise) {
    middleSchoolInfoPromise = fetch(`/data/middle_school_info_2026.json?v=${APP_VERSION}`)
      .then((response) => {
        if (!response.ok) throw new Error("MIDDLE_SCHOOL_INFO_LOAD_FAILED");
        return response.json();
      });
  }
  return middleSchoolInfoPromise;
}

function ensureAddressMapPopupStyle() {
  if (document.querySelector("#addressMapPopupStyle")) return;
  const style = document.createElement("style");
  style.id = "addressMapPopupStyle";
  style.textContent = `
    .address-map-school-popup{
      box-sizing:border-box;
      width:min(290px,calc(100vw - 48px));
      max-width:290px;
      padding:12px 14px;
      border:1px solid #d9e2ec;
      border-radius:12px;
      background:rgba(255,255,255,.98);
      box-shadow:0 6px 20px rgba(15,23,42,.18);
      color:#1f2937;
      font-size:12px;
      line-height:1.45;
      text-align:left;
      white-space:normal;
      overflow-wrap:anywhere;
      word-break:keep-all;
    }
    #middleResultMap{position:relative;}
    #middleResultMap .zone-map-marker--elementary-result .zone-map-marker__icon{
      background:#16a34a !important;
      border-color:#166534 !important;
      color:#fff !important;
    }
    #middleResultMap .zone-map-marker--middle-result .zone-map-marker__icon{
      background:#f97316 !important;
      border-color:#c2410c !important;
      color:#fff !important;
    }
    .middle-result-marker-legend{
      position:absolute;z-index:5;left:10px;bottom:10px;
      display:flex;gap:10px;flex-wrap:wrap;padding:7px 9px;
      border:1px solid #dbe3ef;border-radius:9px;
      background:rgba(255,255,255,.94);box-shadow:0 2px 8px rgba(15,23,42,.12);
      color:#334155;font-size:11px;line-height:1;pointer-events:none;
    }
    .middle-result-marker-legend span{display:flex;align-items:center;gap:4px;}
    .middle-result-dot{width:10px;height:10px;border-radius:50%;display:inline-block;box-sizing:border-box;}
    .middle-result-dot--elementary{background:#16a34a;border:1px solid #166534;}
    .middle-result-dot--middle{background:#f97316;border:1px solid #c2410c;}
    .schoolzone-map-info.zone-area-popup{
      width:max-content;min-width:150px;max-width:320px;padding:9px 12px;
      border-radius:10px;white-space:normal;word-break:keep-all;
      overflow-wrap:normal;box-sizing:border-box;
    }
    .schoolzone-map-info.zone-area-popup strong{
      display:block;margin:0;font-size:13px;line-height:1.35;
      white-space:nowrap;word-break:keep-all;
    }
    .schoolzone-map-info.zone-area-popup .zone-area-popup__schools{
      display:block;margin-top:5px;font-size:11px;line-height:1.4;color:#475569;
    }
    .legend-normal,.legend-shared,.legend-middle-group,.legend-middle-zone,.legend-middle-shared{
      display:inline-block;
      width:14px;
      height:10px;
      margin-right:5px;
      border-radius:3px;
      vertical-align:-1px;
      box-sizing:border-box;
    }
    .legend-normal{background:#60a5fa;border:2px solid #1d4ed8;}
    .legend-shared{background:#c084fc;border:2px dashed #7e22ce;}
    .legend-middle-group{background:#fb923c;border:2px dashed #c2410c;}
    .legend-middle-zone{background:#34d399;border:2px solid #047857;}
    .legend-middle-shared{background:#fb7185;border:2px dashed #be123c;}
    .address-map-school-popup__close{
      position:absolute;
      top:7px;
      right:8px;
      width:24px;
      height:24px;
      padding:0;
      border:0;
      border-radius:50%;
      background:#f1f5f9;
      color:#64748b;
      font-size:18px;
      line-height:22px;
      text-align:center;
      cursor:pointer;
    }
    .address-map-school-popup__close:hover{
      background:#e2e8f0;
      color:#0f172a;
    }
    .address-map-school-popup{
      position:relative;
      padding-right:40px;
    }
    .address-map-school-popup__title{
      display:inline;
      font-size:14px;
      line-height:1.35;
      color:#0f172a;
    }
    .address-map-school-popup__type{
      display:inline-block;
      margin-left:6px;
      padding:1px 6px;
      border-radius:999px;
      background:#f1f5f9;
      color:#475569;
      font-size:10px;
      vertical-align:1px;
    }
    .address-map-school-popup__row{
      display:block;
      margin-top:6px;
      min-width:0;
    }
    .address-map-school-popup__row b{
      display:inline-block;
      margin-right:6px;
      color:#475569;
      font-size:11px;
    }
    .address-map-school-popup__phone span{
      overflow-wrap:anywhere;
      word-break:break-word;
    }
    .address-map-school-popup__link{
      margin-top:8px;
      padding-top:7px;
      border-top:1px solid #eef2f7;
    }
    .address-map-school-popup__link a{
      color:#2563eb;
      font-weight:700;
      text-decoration:none;
    }
    @media(max-width:720px){
      .address-map-school-popup{
        width:min(260px,calc(100vw - 36px));
        max-width:260px;
        padding:10px 12px;
        font-size:11px;
      }
    }
  `;
  document.head.appendChild(style);
}

function bindSchoolPopupClose(overlay) {
  window.setTimeout(() => {
    document.querySelectorAll(".address-map-school-popup").forEach(card => {
      if (card.dataset.popupBound === "1") return;
      card.dataset.popupBound = "1";

      // 팝업 내부 조작이 지도 클릭으로 전달되지 않게 한다.
      ["click", "mousedown", "touchstart"].forEach(eventName => {
        card.addEventListener(eventName, event => {
          event.stopPropagation();
        });
      });

      const closeButton = card.querySelector(".address-map-school-popup__close");
      if (closeButton) {
        closeButton.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          overlay?.setMap(null);
        });
      }

      // 홈페이지 링크는 지도 이벤트와 분리해 정상적으로 새 탭에서 연다.
      const homepageLink = card.querySelector(".address-map-school-popup__link a");
      if (homepageLink) {
        homepageLink.addEventListener("click", event => {
          event.stopPropagation();
        });
      }
    });
  }, 0);
}


function compactSchoolPhone(rawPhone) {
  const raw = stripHtmlBreaks(rawPhone || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";

  const phonePattern = /0\d{1,2}[-)\s]?\d{3,4}[-\s]?\d{4}/g;
  const normalizeNumber = value => String(value || "")
    .replace(/\)/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // FAX/팩스가 붙은 구간은 표시 대상에서 제외한다.
  const withoutFax = raw
    .replace(/(?:FAX|팩스)\s*[:：]?\s*0\d{1,2}[-)\s]?\d{3,4}[-\s]?\d{4}/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const labeled = [];
  for (const label of ["교무실", "행정실"]) {
    const rx = new RegExp(label + "\\s*[:：]?\\s*(0\\\\d{1,2}[-)\\\\s]?\\\\d{3,4}[-\\\\s]?\\\\d{4})", "i");
    const match = withoutFax.match(rx);
    if (match?.[1]) labeled.push(`${label} ${normalizeNumber(match[1])}`);
  }
  if (labeled.length) return labeled.join(" · ");

  // 라벨이 없는 자료는 중복을 제거한 뒤 첫 전화번호 하나만 표시한다.
  const numbers = [...new Set((withoutFax.match(phonePattern) || []).map(normalizeNumber))];
  return numbers[0] || "";
}


function markerSchoolInfoHtml(title, info, establishedDate = "") {
  const homepageRaw = info?.homepage || "";
  const homepage = homepageRaw ? normalizeHomepage(homepageRaw) : "";
  const phone = compactSchoolPhone(info?.phone || "");
  const type = info?.school_type || "";
  return `<div class="address-map-school-popup">
    <button type="button" class="address-map-school-popup__close" aria-label="학교 정보 닫기">×</button>
    <strong class="address-map-school-popup__title">${escapeHtml(title)}</strong>
    ${type ? `<span class="address-map-school-popup__type">${escapeHtml(type)}</span>` : ""}
    ${info?.address ? `<div class="address-map-school-popup__row">${escapeHtml(info.address)}</div>` : ""}
    ${establishedDate ? `<div class="address-map-school-popup__row"><b>설립일</b><span>${escapeHtml(establishedDate)}</span></div>` : ""}
    ${phone ? `<div class="address-map-school-popup__row address-map-school-popup__phone"><b>전화</b><span>${escapeHtml(phone)}</span></div>` : ""}
    ${homepage ? `<div class="address-map-school-popup__link"><a href="${escapeHtml(homepage)}" target="_blank" rel="noopener noreferrer">홈페이지 바로가기 ↗</a></div>` : ""}
  </div>`;
}

function loadSchoolZoneGeoJson() {
  if (!schoolZoneGeoJsonPromise) {
    schoolZoneGeoJsonPromise = fetch("/data/schoolzones_map_20260320.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("SCHOOLZONE_GEOJSON_LOAD_FAILED");
        return response.json();
      });
  }
  return schoolZoneGeoJsonPromise;
}

function loadCorrectedElementaryZoneGeoJson() {
  if (!correctedElementaryZoneGeoJsonPromise) {
    correctedElementaryZoneGeoJsonPromise = fetch(`/data/bansong_corrected_overlay_v1.geojson?v=${APP_VERSION}`)
      .then((response) => {
        if (!response.ok) throw new Error("CORRECTED_ELEMENTARY_GEOJSON_LOAD_FAILED");
        return response.json();
      });
  }
  return correctedElementaryZoneGeoJsonPromise;
}

function loadMiddleZoneGeoJson() {
  if (!middleZoneGeoJsonPromise) {
    middleZoneGeoJsonPromise = fetch("/data/middlezones_map_20260320.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("MIDDLEZONE_GEOJSON_LOAD_FAILED");
        return response.json();
      });
  }
  return middleZoneGeoJsonPromise;
}

function geoRingToKakaoPath(ring) {
  return (ring || []).map(([lng, lat]) => new window.kakao.maps.LatLng(Number(lat), Number(lng)));
}

function geoPolygonToKakaoPaths(coordinates) {
  return (coordinates || []).map(geoRingToKakaoPath);
}

function featurePolygonParts(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates || [];
  return [];
}


function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoordinates(lng, lat, polygonCoords) {
  if (!Array.isArray(polygonCoords) || !polygonCoords.length) return false;
  if (!pointInRing(lng, lat, polygonCoords[0] || [])) return false;
  for (let i = 1; i < polygonCoords.length; i += 1) {
    if (pointInRing(lng, lat, polygonCoords[i] || [])) return false;
  }
  return true;
}

function featureContainsPoint(feature, lng, lat) {
  const geometry = feature?.geometry;
  if (!geometry) return false;
  if (geometry.type === "Polygon") return pointInPolygonCoordinates(lng, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || []).some((coords) => pointInPolygonCoordinates(lng, lat, coords));
  }
  return false;
}

function shortElementarySchoolName(value) {
  return cleanText(String(value || "")).replace(/초등학교$/, "초").replace(/초교$/, "초");
}

async function findElementarySchoolsByGis(address) {
  try {
    await loadKakaoMapSdk();
    const geocoder = new window.kakao.maps.services.Geocoder();
    const pos = await geocodeAddress(geocoder, cleanGeocodeAddress(address));
    const lat = Number(pos.getLat());
    const lng = Number(pos.getLng());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const geojson = await loadSchoolZoneGeoJson();
    const features = (geojson?.features || []).filter((feature) => featureContainsPoint(feature, lng, lat));
    if (!features.length) return { lat, lng, features: [], schools: [] };

    const schools = [];
    const seen = new Set();
    for (const feature of features) {
      const props = feature.properties || {};
      for (const linked of props.schools || []) {
        const school = shortElementarySchoolName(linked.school_name || "");
        if (!school || seen.has(school)) continue;
        seen.add(school);
        schools.push({
          school,
          sigun: props.city || "",
          eup: "",
          tongri: "",
          ban: "",
          tongbanArea: "",
          schoolArea: props.HAKGUDO_NM || props.zone_type || "공공 학구도",
          note: `공공 학구도 GIS · ${props.base_date || "2026-03-20"} 기준`,
          match: "GIS",
        });
      }
    }
    return { lat, lng, features, schools };
  } catch (error) {
    console.warn("GIS school-zone lookup failed", error);
    return null;
  }
}

async function drawSchoolZoneLayer(map, homePos) {
  const geojson = await loadSchoolZoneGeoJson();
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const overlays = [];
  let infoOverlay = null;

  for (const feature of features) {
    if (!isMiddleMode && isSourceConflictElementaryZone(feature)) continue;
    const props = feature.properties || {};
    const isShared = String(props.HAKGUDO_GB || "") === "1" || props.zone_type === "공동통학구역";
    for (const polygonCoords of featurePolygonParts(feature)) {
      const paths = geoPolygonToKakaoPaths(polygonCoords);
      if (!paths.length || !paths[0]?.length) continue;
      const polygon = new window.kakao.maps.Polygon({
        map,
        path: paths,
        strokeWeight: isShared ? 3 : 2,
        strokeColor: isShared ? "#7c3aed" : "#2563eb",
        strokeOpacity: 0.72,
        strokeStyle: isShared ? "dash" : "solid",
        fillColor: isShared ? "#a78bfa" : "#60a5fa",
        fillOpacity: isShared ? 0.10 : 0.07,
      });
      overlays.push(polygon);

      window.kakao.maps.event.addListener(polygon, "click", (mouseEvent) => {
        if (infoOverlay) infoOverlay.setMap(null);
        const name = escapeHtml(props.HAKGUDO_NM || props.name || "학구 정보");
        const type = escapeHtml(props.zone_type || (isShared ? "공동통학구역" : "통학구역"));
        infoOverlay = new window.kakao.maps.CustomOverlay({
          map,
          position: mouseEvent.latLng,
          yAnchor: 1.15,
          content: `<div class="schoolzone-map-info"><strong>${name}</strong><span>${type}</span></div>`,
        });
      });
    }
  }

  return overlays;
}


let fullZoneMap = null;
let fullZoneMode = "elementary";
let fullZoneFeaturesByMode = { elementary: [], middle: [] };
let fullZonePolygonsByMode = { elementary: [], middle: [] };
let fullZoneInfoOverlay = null;
let fullZonePolygonClickAt = 0;
let fullSchoolMarkers = [];
let fullSchoolLabels = [];
let fullSchoolPointData = [];

function featureBoundsPoints(feature) {
  const points = [];
  for (const polygon of featurePolygonParts(feature)) {
    for (const ring of polygon || []) {
      for (const coord of ring || []) {
        if (Array.isArray(coord) && coord.length >= 2) points.push(coord);
      }
    }
  }
  return points;
}

function schoolNameFromZone(feature) {
  return String(feature?.properties?.HAKGUDO_NM || "")
    .replace(/공동통학구역/g, "")
    .replace(/통학구역/g, "")
    .replace(/학교군/g, "")
    .replace(/중학구/g, "")
    .trim();
}

function activeFullZoneFeatures() {
  const features = fullZoneFeaturesByMode[fullZoneMode] || [];
  if (fullZoneMode !== "elementary") return features;
  return features.filter((feature) => !isSourceConflictElementaryZone(feature));
}

function populateZoneSchoolList(features) {
  if (!els.zoneSchoolList) return;
  const zoneNames = features.flatMap(feature => {
    const linked = Array.isArray(feature?.properties?.school_names) ? feature.properties.school_names : [];
    return [...linked, schoolNameFromZone(feature)].filter(Boolean);
  });
  // 공공 GIS 학구명뿐 아니라 실제 지도에 표시 중인 학교 마커도 검색 후보에 포함한다.
  // 다올초처럼 GIS 기준일 이후 개교하여 아직 학구 폴리곤에 없는 학교도 검색 가능해진다.
  const markerNames = fullSchoolPointData
    .filter(school => school.school_level === schoolLevelForFullMap())
    .map(school => school.school_name)
    .filter(Boolean);
  const names = [...new Set([...zoneNames, ...markerNames])].sort((a,b)=>a.localeCompare(b,"ko"));
  els.zoneSchoolList.innerHTML = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function schoolLevelForFullMap() {
  return fullZoneMode === "middle" ? "중학교" : "초등학교";
}

function updateFullSchoolLabels() {
  if (!fullZoneMap) return;
  const show = fullZoneMap.getLevel() <= 5;
  const level = schoolLevelForFullMap();
  for (const item of fullSchoolLabels) {
    item.overlay.setMap(show && item.school.school_level === level ? fullZoneMap : null);
  }
}

function updateFullSchoolMarkers() {
  if (!fullZoneMap) return;
  const level = schoolLevelForFullMap();
  for (const item of fullSchoolMarkers) {
    item.marker.setMap(item.school.school_level === level ? fullZoneMap : null);
  }
  updateFullSchoolLabels();
}

async function fullMapSchoolDetailHtml(school) {
  const schoolName = school?.school_name || "학교";
  const established = school?.established_date
    ? String(school.established_date).replace(/-/g, ". ")
    : "";

  if (school?.school_level === "중학교") {
    const middleInfo = await loadMiddleSchoolInfoForAddressResult().catch(() => ({}));
    const detail = middleInfo?.[schoolName] || {
      address: school?.current_address || school?.road_address || school?.jibun_address || "",
      phone: school?.phone || "",
      homepage: school?.homepage || ""
    };
    return markerSchoolInfoHtml(schoolName, detail, established);
  }

  const detail = getSchoolInfo(schoolName) || {
    address: school?.current_address || school?.road_address || school?.jibun_address || "",
    phone: school?.phone || "",
    homepage: school?.homepage || ""
  };
  return markerSchoolInfoHtml(schoolName, detail, established);
}

async function drawFullSchoolPoints(schools) {
  const candidates = (schools || []).filter(s => ["초등학교", "중학교"].includes(s.school_level));
  const geocoder = new window.kakao.maps.services.Geocoder();

  // 2026-03-20 공공 학교위치 자료 이후 개교한 학교(예: 다올초)는
  // 좌표가 비어 있어도 최신 도로명주소를 이용해 지도 표시 좌표를 보완한다.
  for (const school of candidates) {
    const hasValidCoordinates =
      school.lat !== null && school.lat !== "" &&
      school.lng !== null && school.lng !== "" &&
      Number.isFinite(Number(school.lat)) &&
      Number.isFinite(Number(school.lng)) &&
      Number(school.lat) >= 33 && Number(school.lat) <= 39 &&
      Number(school.lng) >= 124 && Number(school.lng) <= 132;
    if (hasValidCoordinates) continue;
    const address = school.road_address || school.jibun_address || "";
    if (!address) continue;
    try {
      const pos = await geocodeAddress(geocoder, cleanGeocodeAddress(address));
      school.lat = Number(pos.getLat());
      school.lng = Number(pos.getLng());
    } catch (error) {
      console.warn("school marker geocode failed", school.school_name, error);
    }
  }

  fullSchoolPointData = candidates.filter(s =>
    s.lat !== null && s.lat !== "" &&
    s.lng !== null && s.lng !== "" &&
    Number.isFinite(Number(s.lat)) &&
    Number.isFinite(Number(s.lng)) &&
    Number(s.lat) >= 33 && Number(s.lat) <= 39 &&
    Number(s.lng) >= 124 && Number(s.lng) <= 132
  );
  for (const school of fullSchoolPointData) {
    const pos = new window.kakao.maps.LatLng(Number(school.lat), Number(school.lng));
    const marker = new window.kakao.maps.Marker({ position: pos, title: school.school_name || "학교" });
    fullSchoolMarkers.push({ marker, school });
    const label = new window.kakao.maps.CustomOverlay({
      position: pos, yAnchor: -0.45, clickable: false,
      content: `<div class="full-school-label">${escapeHtml(school.school_name || "")}</div>`,
    });
    fullSchoolLabels.push({ overlay: label, school });
    window.kakao.maps.event.addListener(marker, "click", async () => {
      if (fullZoneInfoOverlay) fullZoneInfoOverlay.setMap(null);
      ensureAddressMapPopupStyle();
      fullZoneInfoOverlay = new window.kakao.maps.CustomOverlay({
        map: fullZoneMap, position: pos, yAnchor: 1.35,
        clickable: true,
        content: await fullMapSchoolDetailHtml(school),
      });
      bindSchoolPopupClose(fullZoneInfoOverlay);
    });
  }
  window.kakao.maps.event.addListener(fullZoneMap, "zoom_changed", updateFullSchoolLabels);
  updateFullSchoolMarkers();
}

function fitFullMapToFeatures(features) {
  if (!fullZoneMap || !features?.length) return;
  const bounds = new window.kakao.maps.LatLngBounds();
  let count = 0;
  for (const feature of features) {
    for (const [lng, lat] of featureBoundsPoints(feature)) {
      bounds.extend(new window.kakao.maps.LatLng(Number(lat), Number(lng)));
      count++;
    }
  }
  if (count) fullZoneMap.setBounds(bounds, 36, 36, 36, 36);
}

function setFullMapHighlight(matchedFeatures) {
  const ids = new Set((matchedFeatures || []).map(f => f?.properties?.HAKGUDO_ID));
  for (const mode of ["elementary", "middle"]) {
    for (const item of fullZonePolygonsByMode[mode]) {
      const active = ids.has(item.feature?.properties?.HAKGUDO_ID);
      const props = item.feature?.properties || {};
      const isShared = mode === "elementary" && (String(props.HAKGUDO_GB || "") === "1" || props.zone_type === "공동통학구역");
      const isMiddleShared = mode === "middle" && (
        String(props.HAKGUDO_GB || "") === "1" ||
        String(props.zone_type || "").includes("공동") ||
        String(props.HAKGUDO_NM || "").includes("공동")
      );
      const isMiddleGroup = mode === "middle" && !isMiddleShared && String(props.HAKGUDO_NM || "").includes("학교군");
      item.polygon.setOptions({
        strokeWeight: active ? 5 : (isMiddleShared ? 4 : (isShared ? 4 : (isMiddleGroup ? 3 : 2))),
        strokeOpacity: active ? 1 : ((isShared || isMiddleShared) ? 0.95 : 0.82),
        fillOpacity: active ? 0.36 : ((isShared || isMiddleShared) ? 0.30 : (isMiddleGroup ? 0.22 : 0.10)),
      });
    }
  }
}

function resetFullMapView() {
  if (!fullZoneMap) return;
  if (els.zoneSchoolInput) els.zoneSchoolInput.value = "";
  setFullMapHighlight([]);
  fitFullMapToFeatures(activeFullZoneFeatures());
  if (fullZoneInfoOverlay) fullZoneInfoOverlay.setMap(null);
  const status = document.querySelector("#fullMapStatus");
  if (status) status.textContent = fullZoneMode === "middle" ? "학교군·중학구를 클릭하면 연결된 중학교를 확인할 수 있습니다." : "학구를 클릭하면 학구명과 연결된 초등학교를 확인할 수 있습니다.";
}

function focusFullMapSchool() {
  if (!fullZoneMap) return;
  const query = normalizeText(els.zoneSchoolInput?.value || "").replace(/초등학교/g,"초").replace(/중학교/g,"중");
  if (!query) return resetFullMapView();

  const matches = activeFullZoneFeatures().filter(feature => {
    const name = normalizeText(feature?.properties?.HAKGUDO_NM || "").replace(/초등학교/g,"초").replace(/중학교/g,"중");
    const linkedNames = (feature?.properties?.school_names || []).map(name => normalizeText(name).replace(/초등학교/g,"초").replace(/중학교/g,"중"));
    return name.includes(query) || query.includes(normalizeText(schoolNameFromZone(feature))) || linkedNames.some(name => name.includes(query) || query.includes(name));
  });

  const status = document.querySelector("#fullMapStatus");

  if (matches.length) {
    setFullMapHighlight(matches);
    fitFullMapToFeatures(matches);
    if (status) status.textContent = `${matches.map(f=>f.properties?.HAKGUDO_NM).filter(Boolean).join(", ")} 표시`;
    return;
  }

  // GIS 학구 폴리곤에 아직 없는 신규 학교는 학교 마커 위치로 검색한다.
  // 예: 2026-03-20 기준일 이후 개교한 다올초.
  const level = schoolLevelForFullMap();
  const schoolMatch = fullSchoolPointData.find(school => {
    if (school.school_level !== level) return false;
    const name = normalizeText(school.school_name || "").replace(/초등학교/g,"초").replace(/중학교/g,"중");
    return name.includes(query) || query.includes(name);
  });

  if (schoolMatch) {
    setFullMapHighlight([]);
    const position = new window.kakao.maps.LatLng(Number(schoolMatch.lat), Number(schoolMatch.lng));
    fullZoneMap.setCenter(position);
    fullZoneMap.setLevel(4);
    if (status) {
      status.textContent = `${schoolMatch.school_name} 위치 표시 · 현재 공공 GIS 학구도에는 별도 학구 폴리곤이 없습니다.`;
    }
    return;
  }

  if (status) status.textContent = fullZoneMode === "middle"
    ? "해당 중학교의 학교군·중학구를 찾지 못했습니다."
    : "해당 학교의 통학구역 또는 학교 위치를 찾지 못했습니다.";
}

function updateFullMapModeUI() {
  const isMiddle = fullZoneMode === "middle";
  document.querySelector("#elementaryZoneButton")?.classList.toggle("is-active", !isMiddle);
  document.querySelector("#middleZoneButton")?.classList.toggle("is-active", isMiddle);
  document.querySelector("#elementaryZoneButton")?.setAttribute("aria-pressed", String(!isMiddle));
  document.querySelector("#middleZoneButton")?.setAttribute("aria-pressed", String(isMiddle));
  const title = document.querySelector("#fullMapTitle");
  if (title) title.textContent = isMiddle ? "화성·오산 중학군(구) 지도" : "화성·오산 초등학교 통학구역 지도";
  if (els.zoneSchoolInput) els.zoneSchoolInput.placeholder = isMiddle ? "중학교명 검색 (예: 동탄중)" : "학교명 검색 (예: 솔빛초)";
  const legend = document.querySelector("#fullMapLegend");
  if (legend) legend.innerHTML = isMiddle
    ? `<span><i class="legend-middle-zone"></i>중학군(구)</span><span><i class="legend-middle-shared"></i>공동학구</span><span>📍 중학교 위치</span><span class="full-map-count" id="zoneMapCount"></span>`
    : `<span><i class="legend-normal"></i>일반 통학구역</span><span><i class="legend-shared"></i>공동통학구역</span><span>📍 초등학교 위치</span><span class="full-map-count" id="zoneMapCount"></span>`;
  const countEl = document.querySelector("#zoneMapCount");
  const schoolCount = fullSchoolPointData.filter(s => s.school_level === schoolLevelForFullMap()).length;
  if (countEl) countEl.textContent = isMiddle ? `총 ${activeFullZoneFeatures().length}개 학교군·중학구 · 중학교 ${schoolCount}개` : `총 ${activeFullZoneFeatures().length}개 학구 · 초등학교 ${schoolCount}개`;
  populateZoneSchoolList(activeFullZoneFeatures());
}

function switchFullZoneMode(mode) {
  if (!fullZoneMap || !["elementary", "middle"].includes(mode)) return;
  fullZoneMode = mode;
  if (els.zoneSchoolInput) els.zoneSchoolInput.value = "";
  if (fullZoneInfoOverlay) fullZoneInfoOverlay.setMap(null);
  setFullMapHighlight([]);
  for (const item of fullZonePolygonsByMode.elementary) item.polygon.setMap(mode === "elementary" ? fullZoneMap : null);
  for (const item of fullZonePolygonsByMode.middle) item.polygon.setMap(mode === "middle" ? fullZoneMap : null);
  updateFullSchoolMarkers();
  updateFullMapModeUI();
  fitFullMapToFeatures(activeFullZoneFeatures());
  const status = document.querySelector("#fullMapStatus");
  if (status) status.textContent = mode === "middle" ? "학교군·중학구를 클릭하면 연결된 중학교를 확인할 수 있습니다." : "학구를 클릭하면 학구명과 연결된 초등학교를 확인할 수 있습니다.";
}

const SOURCE_CONFLICT_ELEMENTARY_ZONE_NAMES = new Set([
  "반송초반석초공동통학구역",
]);

function isSourceConflictElementaryZone(feature) {
  return SOURCE_CONFLICT_ELEMENTARY_ZONE_NAMES.has(cleanText(feature?.properties?.HAKGUDO_NM || ""));
}

function drawFullZonePolygons(features, mode) {
  const isMiddleMode = mode === "middle";
  for (const feature of features) {
    const props = feature.properties || {};
    const isShared = !isMiddleMode && (String(props.HAKGUDO_GB || "") === "1" || props.zone_type === "공동통학구역");
    const middleName = String(props.HAKGUDO_NM || "");
    // 중학교 자료의 공식 명칭을 기준으로 학교군과 중학구를 구분한다.
    // 학교군은 여러 중학교가 연결되는 영역이므로 중학구와 시각적으로 확실히 분리한다.
    const isMiddleShared = isMiddleMode && (
      String(props.HAKGUDO_GB || "") === "1" ||
      String(props.zone_type || "").includes("공동") ||
      middleName.includes("공동")
    );
    const isMiddleGroup = isMiddleMode && !isMiddleShared && middleName.includes("학교군");
    const isMiddleZone = isMiddleMode && !isMiddleShared && !isMiddleGroup;
    for (const polygonCoords of featurePolygonParts(feature)) {
      const paths = geoPolygonToKakaoPaths(polygonCoords);
      if (!paths.length || !paths[0]?.length) continue;
      const polygon = new window.kakao.maps.Polygon({
        map: mode === fullZoneMode ? fullZoneMap : null, path: paths,
        strokeWeight: isMiddleShared ? 4 : (isShared ? 4 : (isMiddleGroup ? 3 : 2)),
        strokeColor: isMiddleMode
          ? (isMiddleShared ? "#be123c" : (isMiddleGroup ? "#c2410c" : "#047857"))
          : (isShared ? "#7e22ce" : "#1d4ed8"),
        strokeOpacity: (isShared || isMiddleShared) ? 0.95 : 0.82,
        strokeStyle: (isShared || isMiddleShared || isMiddleGroup) ? "dash" : "solid",
        fillColor: isMiddleMode
          ? (isMiddleShared ? "#fb7185" : (isMiddleGroup ? "#fb923c" : "#34d399"))
          : (isShared ? "#c084fc" : "#60a5fa"),
        fillOpacity: (!isMiddleMode && isSourceConflictElementaryZone(feature))
          ? 0
          : ((isShared || isMiddleShared) ? 0.30 : (isMiddleGroup ? 0.22 : 0.10)),
      });
      fullZonePolygonsByMode[mode].push({ polygon, feature });
      window.kakao.maps.event.addListener(polygon, "click", (mouseEvent) => {
        fullZonePolygonClickAt = Date.now();
        if (fullZoneInfoOverlay) fullZoneInfoOverlay.setMap(null);
        const linked = (props.school_names || props.schools || [props.school || ""]).filter(Boolean).join(", ");
        fullZoneInfoOverlay = new window.kakao.maps.CustomOverlay({
          map: fullZoneMap, position: mouseEvent.latLng, yAnchor: 1.15,
          content: `<div class="schoolzone-map-info zone-area-popup"><strong>${escapeHtml(props.HAKGUDO_NM || "학구 정보")}</strong>${isMiddleMode && linked ? `<span class="zone-area-popup__schools">${escapeHtml(linked)}</span>` : ""}</div>`,
        });
      });
    }
  }
}

async function initFullSchoolZoneMap() {
  const mapEl = document.querySelector("#fullSchoolZoneMap");
  const statusEl = document.querySelector("#fullMapStatus");
  if (!mapEl || !statusEl) return;
  if (fullZoneMap) {
    fullZoneMap.relayout();
    window.setTimeout(() => fitFullMapToFeatures(activeFullZoneFeatures()), 30);
    return;
  }
  try {
    await loadKakaoMapSdk();
    const [elementaryGeojson, middleGeojson, schoolPointJson] = await Promise.all([loadSchoolZoneGeoJson(), loadMiddleZoneGeoJson(), loadPublicSchoolPoints()]);
    fullZoneFeaturesByMode.elementary = Array.isArray(elementaryGeojson?.features) ? elementaryGeojson.features : [];
    fullZoneFeaturesByMode.middle = Array.isArray(middleGeojson?.features) ? middleGeojson.features : [];
    fullZoneMap = new window.kakao.maps.Map(mapEl, {
      center: new window.kakao.maps.LatLng(37.17, 127.00),
      level: 9,
    });
  window.kakao.maps.event.addListener(fullZoneMap, "click", () => {
    // 폴리곤을 누른 동일 클릭 이벤트가 지도까지 전달된 경우에는
    // 방금 연 학구정보 팝업을 닫지 않는다.
    if (Date.now() - fullZonePolygonClickAt < 250) return;
    if (fullZoneInfoOverlay) {
      fullZoneInfoOverlay.setMap(null);
      fullZoneInfoOverlay = null;
    }
  });
    fullZoneMap.addControl(new window.kakao.maps.ZoomControl(), window.kakao.maps.ControlPosition.RIGHT);
    drawFullZonePolygons(fullZoneFeaturesByMode.elementary, "elementary");
    drawFullZonePolygons(fullZoneFeaturesByMode.middle, "middle");
    await drawFullSchoolPoints(Array.isArray(schoolPointJson?.schools) ? schoolPointJson.schools : []);
    document.querySelector("#elementaryZoneButton")?.addEventListener("click", () => switchFullZoneMode("elementary"));
    document.querySelector("#middleZoneButton")?.addEventListener("click", () => switchFullZoneMode("middle"));
    updateFullMapModeUI();
    fullZoneMap.relayout();
    fitFullMapToFeatures(activeFullZoneFeatures());
    statusEl.textContent = "학구를 클릭하면 학구명과 연결된 초등학교를 확인할 수 있습니다.";
  } catch (error) {
    console.warn("full schoolzone map load failed", error);
    statusEl.textContent = "통학구역 지도를 불러오지 못했습니다.";
  }
}

async function initResultMap(homeAddress, schoolItems, options = {}) {
  ensureAddressMapPopupStyle();
  const mapEl = document.querySelector("#resultMap");
  const statusEl = document.querySelector("#mapStatus");
  if (!mapEl || !statusEl) return;

  const schools = Array.isArray(schoolItems) ? schoolItems.filter(item => item?.name) : [];
  mapEl.hidden = false;
  mapEl.style.display = "block";
  mapEl.style.width = "100%";
  mapEl.style.height = window.matchMedia("(max-width: 720px)").matches ? "340px" : "460px";
  mapEl.style.minHeight = window.matchMedia("(max-width: 720px)").matches ? "340px" : "420px";

  try {
    await loadKakaoMapSdk();
    const geocoder = new window.kakao.maps.services.Geocoder();
    const homeQuery = cleanGeocodeAddress(homeAddress).replace(/^(화성시|오산시)\s/, "경기도 $1 ");
    const homePos = await geocodeAddress(geocoder, homeQuery);

    const locatedSchools = [];
    for (const item of schools) {
      if (!item.address) continue;
      try {
        const pos = await geocodeAddress(geocoder, cleanGeocodeAddress(item.address));
        locatedSchools.push({ ...item, pos });
      } catch (error) {
        console.warn("school geocode failed", item.name, error);
      }
    }

    const map = new window.kakao.maps.Map(mapEl, { center: homePos, level: 5 });
    const bounds = new window.kakao.maps.LatLngBounds();
    bounds.extend(homePos);

    // 검색 주소가 실제로 들어 있는 공개 GIS 학구만 표시한다.
    let zoneCount = 0;
    try {
      const geojson = await loadSchoolZoneGeoJson();
      const lat = Number(homePos.getLat());
      const lng = Number(homePos.getLng());
      let matchedFeatures = options.hideGisBoundary
        ? []
        : (geojson?.features || []).filter(feature => featureContainsPoint(feature, lng, lat));

      // 2026 원자료와 공개 GIS가 충돌하는 주소는 공개 GIS를 숨긴다.
      // 반송초 지적도 기반 1차 보정안에 실제 검색 좌표가 포함되는 경우에만
      // 검증용 보정 경계를 대신 표시한다. 다른 충돌 주소는 기존처럼 경계를 표시하지 않는다.
      if (options.hideGisBoundary) {
        try {
          const corrected = await loadCorrectedElementaryZoneGeoJson();
          matchedFeatures = (corrected?.features || []).filter(feature => featureContainsPoint(feature, lng, lat));
        } catch (correctedError) {
          console.warn("corrected elementary zone layer load failed", correctedError);
          matchedFeatures = [];
        }
      }
      zoneCount = matchedFeatures.length;
      let infoOverlay = null;

      for (const feature of matchedFeatures) {
        const props = feature.properties || {};
        const isShared = String(props.HAKGUDO_GB || "") === "1" || props.zone_type === "공동통학구역";
        for (const polygonCoords of featurePolygonParts(feature)) {
          const paths = geoPolygonToKakaoPaths(polygonCoords);
          if (!paths.length || !paths[0]?.length) continue;
          const polygon = new window.kakao.maps.Polygon({
            map,
            path: paths,
            strokeWeight: isShared ? 4 : 3,
            strokeColor: isShared ? "#7c3aed" : "#2563eb",
            strokeOpacity: 0.85,
            strokeStyle: isShared ? "dash" : "solid",
            fillColor: isShared ? "#a78bfa" : "#60a5fa",
            fillOpacity: isShared ? 0.16 : 0.11,
          });
          for (const path of paths) for (const p of path) bounds.extend(p);
          window.kakao.maps.event.addListener(polygon, "click", (mouseEvent) => {
            if (infoOverlay) infoOverlay.setMap(null);
            const linked = (props.school_names || []).join(", ");
            infoOverlay = new window.kakao.maps.CustomOverlay({
              map,
              position: mouseEvent.latLng,
              yAnchor: 1.15,
              content: `<div class="schoolzone-map-info"><strong>${escapeHtml(props.HAKGUDO_NM || "학구 정보")}</strong><span>${escapeHtml(isShared ? "공동통학구역" : (props.zone_type || "통학구역"))}</span>${linked ? `<span>${escapeHtml(linked)}</span>` : ""}</div>`,
            });
          });
        }
      }
    } catch (zoneError) {
      console.warn("school zone layer load failed", zoneError);
    }

    new window.kakao.maps.CustomOverlay({
      map,
      position: homePos,
      yAnchor: 1,
      content: '<div class="zone-map-marker zone-map-marker--home"><span class="zone-map-marker__icon">⌂</span><span class="zone-map-marker__label">검색 주소</span></div>',
    });

    let schoolInfoOverlay = null;
    const pointJson = await loadPublicSchoolPoints().catch(() => ({ schools: [] }));
    const pointRows = Array.isArray(pointJson) ? pointJson : (pointJson?.schools || []);

    for (const item of locatedSchools) {
      bounds.extend(item.pos);
      const markerEl = document.createElement("button");
      markerEl.type = "button";
      markerEl.className = "zone-map-marker zone-map-marker--school";
      markerEl.style.border = "0";
      markerEl.style.background = "transparent";
      markerEl.style.cursor = "pointer";
      markerEl.innerHTML = `<span class="zone-map-marker__icon">S</span><span class="zone-map-marker__label">${escapeHtml(item.name)}</span>`;

      const markerOverlay = new window.kakao.maps.CustomOverlay({
        map,
        position: item.pos,
        yAnchor: 1,
        content: markerEl,
      });

      markerEl.addEventListener("click", () => {
        if (schoolInfoOverlay) schoolInfoOverlay.setMap(null);
        const info = getSchoolInfo(item.name);
        const point = pointRows.find(s => normalizeSchoolName(s.school_name) === normalizeSchoolName(item.name));
        const established = point?.established_date || "";
        schoolInfoOverlay = new window.kakao.maps.CustomOverlay({
          map,
          position: item.pos,
          yAnchor: 1.35,
          clickable: true,
          content: markerSchoolInfoHtml(item.name, info, established),
        });
        bindSchoolPopupClose(schoolInfoOverlay);
      });
    }

    map.setBounds(bounds, 70, 70, 70, 70);
    window.setTimeout(() => {
      map.relayout();
      map.setBounds(bounds, 70, 70, 70, 70);
    }, 0);

    window.kakao.maps.event.addListener(map, "click", () => {
      if (schoolInfoOverlay) {
        schoolInfoOverlay.setMap(null);
        schoolInfoOverlay = null;
      }
    });

    const schoolText = locatedSchools.length > 1
      ? `초록 마커 ${locatedSchools.length}곳은 공동학구 배정학교입니다.`
      : "초록 마커는 배정학교입니다.";
    const zoneText = zoneCount
      ? "색칠된 경계는 검색 주소가 포함된 공공 GIS 통학구역입니다."
      : "현재 공공 GIS에 별도 경계가 없는 최신 부서자료 구역은 학교 위치만 표시될 수 있습니다.";
    statusEl.textContent = `파란 마커는 검색 주소, ${schoolText} ${zoneText}`;
  } catch (error) {
    console.warn("map load failed", error);
    mapEl.hidden = true;
    statusEl.textContent = error?.message === "KAKAO_KEY_MISSING"
      ? "지도 테스트용 JavaScript 키가 아직 입력되지 않았습니다."
      : "지도 정보를 불러오지 못했습니다. 통학구역 조회 결과에는 영향이 없습니다.";
  }
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
  // 여러 세부주소/통리반이 매칭되더라도 최종 배정학교가 하나뿐이면
  // 정상 확정 결과로 처리한다. "유사 매칭" 플래그는 복수 학교 후보가
  // 실제로 남아 있을 때만 세부 확인 필요로 표시한다.
  const isCandidate = groupedSchools.length > 1 &&
    (schools.some((item) => item.score) || String(matchMethod || "").includes("유사"));
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
  // 주소조회 상단에 이미 배정 초등학교명이 표시되고,
  // 지도 마커에서 학교 상세정보를 확인할 수 있으므로 중복 학교 카드는 표시하지 않는다.
  return "";
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
      <p>자료 기준: ${escapeHtml(dataYear)}학년도</p>
      <button class="secondary-button" type="button" data-action="search-again">다른 주소 검색하기</button>
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

  // 2026-03-20 공공 학구도 GIS를 이용한 좌표 기반 판정.
  // 도로명주소를 카카오 주소검색으로 좌표화한 뒤 실제 학구 폴리곤에 포함되는지 확인한다.
  // 정확히 한 학교로 연결되면 기존 문자열/통리반 fallback보다 우선 사용한다.
  // 건물명도 roads.json에서 주소가 유일하게 확정되면 그 도로명주소로 GIS 판정한다.
  const gisAddress = roadInfo?.road || roadInfo?.jibun || original;
  const gisLookup = await findElementarySchoolsByGis(gisAddress);

  let tongban = [];
  if (roadInfo?.jibun) {
    // 도로명주소는 roads.json이 확정한 지번만 사용한다.
    // 원래 입력 문자열/건물명/search_index로 통리반을 다시 찾지 않는다.
    const exactRoadTongban = findTongbanByRoadInfo(roadInfo, roadInfo.jibun);
    tongban = Array.isArray(exactRoadTongban) ? exactRoadTongban : [];
  } else {
    // 지번주소는 입력된 지번 자체로만 통리반을 찾는다.
    // search_index의 부분키/건물명/행정동 후보는 학교 판정에 사용하지 않는다.
    const parsedDirect = parseAddress(jibun || original || searchQuery);
    if (parsedDirect.legalArea && parsedDirect.mainNo !== null) {
      tongban = applySelectedRegionToTongban(state.core.tongban || []).filter((row) =>
        containsJibun(
          row.area || "",
          parsedDirect.legalArea,
          parsedDirect.mainNo,
          parsedDirect.subNo,
          parsedDirect.isMountain
        )
      );
    }
  }

  let school = findSchoolByTongban(tongban);
  let matchMethod = Array.isArray(school) ? "통리반 매칭" : "";

  // 같은 통·반 안에서 통학구역이 다시 나뉘는 경우에는 실제 주소의 지번/동 정보를
  // 통학구역표의 관할구역과 한 번 더 비교한다.
  // 예: 동탄2동 4통 1반은 쌍용예가 441동(솔빛초)과 반송동 219~221(반송초)이 함께 있으므로
  //     반송동 219 주소는 통·반만으로 후보를 남기지 않고 반송초로 좁힌다.
  if (Array.isArray(school) && unique(school.map((item) => item.school)).length > 1) {
    const refinedSchool = refineSchoolsByExactAddress(school, roadInfo, original);
    if (refinedSchool.length && unique(refinedSchool.map((item) => item.school)).length < unique(school.map((item) => item.school)).length) {
      school = refinedSchool;
      matchMethod = "통리반·세부주소 매칭";
    }
  }

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
    const looksLikeAddressInput = /\d/.test(normalizeSearchKey(original));
    if (roadInfo || looksLikeAddressInput) {
      school = findSchoolByKeyword(original);
      matchMethod = Array.isArray(school) ? "키워드 유사 매칭" : "";
    } else {
      school = "건물명만으로 주소를 특정할 수 없습니다. 도로명주소 또는 지번주소를 입력해 주세요.";
      matchMethod = "";
    }
  }

  if (Array.isArray(school)) {
    school = filterResultsBySelectedRegion(school);
    if (!school.length) {
      school = "선택한 지역 안에서는 검색 결과가 없습니다.";
      matchMethod = "";
    }
  }

  // 2026.8.20 다올초 조기 개교 반영.
  // 2026-03-20 공공 GIS에는 다올초가 없으므로, 최신 부서 통학구역 자료에서
  // 다올초 관할로 확인되는 주소는 공공 GIS보다 우선한다.
  // A61(힐스테이트 동탄포레)은 화성신동초와 공동학구이므로 두 학교를 함께 유지한다.
  let hasLatestDepartmentOverride = false;
  if (Array.isArray(school)) {
    const daolRows = school.filter((item) => item.school === "다올초");
    if (daolRows.length) {
      const isA61Shared = daolRows.some((item) => /A-?61|힐스테이트.*포레/i.test(String(item.schoolArea || item.area || "")));
      const latest = [...daolRows];
      if (isA61Shared) {
        const sindong = school.filter((item) => item.school === "화성신동초");
        latest.push(...sindong);
      }
      school = mergeSchoolResults([], latest);
      matchMethod = isA61Shared ? "최신 부서자료 공동학구 보정" : "최신 부서자료 다올초 보정";
      hasLatestDepartmentOverride = true;
    }
  }

  // 2026년 다올초 개교 후 최신 부서자료 전체 보정.
  // 2026-03-20 공공 GIS는 개교 전 자료이므로 아래 5개 단지는
  // 도로명/지번 어느 형식으로 입력해도 최신 부서자료를 우선한다.
  const daolAddressKey = normalizeText([original, road, jibun].filter(Boolean).join(" "));

  const daolSingleRules = [
    // A57-1 행복주택(동탄2 LH40단지) : 신동 818 / 동탄신리천로8길 15
    { re: /(?:신동818|동탄신리천로8길15)/, tongri: "신3통", area: "A57-1블록 행복주택" },
    // A60 제일풍경채 퍼스티어 : 신동 874 / 동탄신리천로 618
    { re: /(?:신동874|동탄신리천로618)/, tongri: "신10통", area: "A60블록 제일풍경채 퍼스티어" },
    // A57-2 금강펜테리움7차 센트럴파크 : 신동 820 / 동탄신리천로8길 17
    { re: /(?:신동820|동탄신리천로8길17)/, tongri: "", area: "A57-2블록 금강펜테리움7차 센트럴파크" },
    // A59 금강펜테리움6차 센트럴파크 : 신동 822 / 동탄신리천로8길 46
    { re: /(?:신동822|동탄신리천로8길46)/, tongri: "신19통", area: "A59블록 금강펜테리움6차 센트럴파크" },
  ];

  const daolSingleRule = daolSingleRules.find((rule) => rule.re.test(daolAddressKey));
  if (daolSingleRule) {
    school = [{
      school: "다올초",
      sigun: "화성시",
      eup: "동탄9동",
      tongri: daolSingleRule.tongri,
      ban: "",
      tongbanArea: daolSingleRule.area,
      schoolArea: daolSingleRule.area,
      note: "2026.8.20 다올초 조기 개교 반영",
      match: "최신 부서자료",
    }];
    matchMethod = "최신 부서자료 다올초 보정";
    hasLatestDepartmentOverride = true;
  }

  // A61 힐스테이트 동탄포레 공동학구 :
  // 신동 880 / 동탄신리천로4길 47 → 다올초 + 화성신동초
  if (/(?:신동880|동탄신리천로4길47)/.test(daolAddressKey)) {
    school = [
      {
        school: "다올초",
        sigun: "화성시",
        eup: "동탄9동",
        tongri: "신9통",
        ban: "",
        tongbanArea: "A61블록 힐스테이트 동탄포레",
        schoolArea: "A61블록 힐스테이트 동탄포레",
        note: "화성신동초 공동학구",
        match: "최신 부서자료",
      },
      {
        school: "화성신동초",
        sigun: "화성시",
        eup: "동탄9동",
        tongri: "신9통",
        ban: "",
        tongbanArea: "A61블록 힐스테이트 동탄포레",
        schoolArea: "A61블록 힐스테이트 동탄포레",
        note: "다올초 공동학구",
        match: "최신 부서자료",
      },
    ];
    matchMethod = "최신 부서자료 공동학구 보정";
    hasLatestDepartmentOverride = true;
  }

  // 2026학년도 부서 원자료 우선 원칙.
  // 통리반 자료와 2026 통학구역표가 실제로 연결된 경우에는 공공데이터 GIS보다
  // 최신 원자료의 판정을 우선한다. 공공 GIS는 원자료에서 학교를 확정하지 못했을 때만 fallback으로 사용한다.
  // 예: 반송동 216은 공공 GIS의 오래된 공동통학 폴리곤에 걸리더라도
  //     2026 원자료의 9통 1반 / 반송동 216~218 조건에 따라 반송초로 판정한다.
  // 2026 원자료에 지번이 직접 명시된 경우에는 통리반 검색 경로와 무관하게
  // 해당 지번 조건을 최우선으로 사용한다.
  // 예: 반송동 216 -> 반송초(반송동 216~218).
  const exactSourceParsed = parseAddress([jibun || original, legal].filter(Boolean).join(" "));
  if (exactSourceParsed.legalArea && exactSourceParsed.mainNo !== null) {
    const exactSourceRows = (state.core.schools || []).filter((row) =>
      containsJibun(row.area || "", exactSourceParsed.legalArea, exactSourceParsed.mainNo, exactSourceParsed.subNo, exactSourceParsed.isMountain)
    );
    if (exactSourceRows.length) {
      school = mergeSchoolResults([], exactSourceRows.map((row) => ({
        school: row.school,
        sigun: sigun || "",
        eup: row.eup || admin || "",
        tongri: row.tongri || "",
        ban: row.ban || "",
        tongbanArea: Array.isArray(tongban) && tongban.length ? (tongban[0].area || "") : "",
        schoolArea: row.area || "",
        note: row.note || "",
        match: "2026 원자료 지번",
      })));
      matchMethod = "2026 원자료 세부주소 우선";
      hasLatestDepartmentOverride = true;
    }
  }

  // 도로명 DB에서 지번까지 정확히 확인됐지만 통리반 원자료에는 그 지번이 전혀 없으면
  // 검색색인/유사매칭이나 오래된 GIS만으로 학교를 확정하지 않는다.
  // 대표 사례: 오산동 540-15.
  let tongbanSourceUnconfirmed = false;
  const resolvedRoadParsed = parseAddress([legal, jibun].filter(Boolean).join(" "));
  const hasExactTongbanCoverage = Array.isArray(tongban) && tongban.length
    ? true
    : (resolvedRoadParsed.legalArea && resolvedRoadParsed.mainNo !== null
      ? applySelectedRegionToTongban(state.core.tongban || []).some((row) =>
          containsJibun(row.area || "", resolvedRoadParsed.legalArea, resolvedRoadParsed.mainNo, resolvedRoadParsed.subNo, resolvedRoadParsed.isMountain)
        )
      : true);
  if (roadInfo && resolvedRoadParsed.legalArea && resolvedRoadParsed.mainNo !== null && !hasExactTongbanCoverage) {
    // 통학구역표에 직접 지번 조건이 있더라도 tongban 원자료에 주소가 없으면
    // 사용자가 요청한 정책상 '확정'으로 보지 않는다.
    // 학교는 GIS 참고 결과로만 보여주고 통리반 미확인 경고를 반드시 표시한다.
    tongban = [];
    school = [];
    matchMethod = "";
    tongbanSourceUnconfirmed = true;
    hasLatestDepartmentOverride = false;
  }

  const sourceSchoolNames = Array.isArray(school) ? unique(school.map((item) => item.school).filter(Boolean)) : [];
  const has2026SourceDecision =
    sourceSchoolNames.length > 0 &&
    Array.isArray(tongban) && tongban.length > 0 &&
    /^통리반/.test(String(matchMethod || ""));

  const gisSchoolNames = unique((gisLookup?.schools || []).map((item) => item.school));
  const normalizeSchoolSetForBoundary = (values) =>
    unique((values || []).map((value) => shortElementarySchoolName(value)).filter(Boolean)).sort().join("|");
  const sourceOverridesGisBoundary =
    Array.isArray(school) &&
    sourceSchoolNames.length > 0 &&
    gisSchoolNames.length > 0 &&
    (hasLatestDepartmentOverride || has2026SourceDecision) &&
    normalizeSchoolSetForBoundary(sourceSchoolNames) !== normalizeSchoolSetForBoundary(gisSchoolNames);

  if (!hasLatestDepartmentOverride && !has2026SourceDecision && gisSchoolNames.length === 1) {
    school = gisLookup.schools;
    matchMethod = tongbanSourceUnconfirmed ? "공공 학구도 GIS 참고 결과 · 통리반 미확인" : "공공 학구도 GIS 좌표 매칭";
    tongban = [];
  } else if (!hasLatestDepartmentOverride && !has2026SourceDecision && gisSchoolNames.length > 1) {
    school = gisLookup.schools;
    matchMethod = tongbanSourceUnconfirmed ? "공공 학구도 GIS 참고 결과 · 통리반 미확인" : "공공 학구도 GIS 공동·중첩구역 매칭";
    tongban = [];
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
    sourceOverridesGisBoundary,
    tongbanSourceUnconfirmed,
  };
}

async function roadToJibun(address) {
  const query = normalizeSearchKey(address);
  if (query.length < 2) return null;

  const roads = await loadRoads();
  const direct = roads.filter((row) => {
    const key = normalizeSearchKey(row.k || "");
    const building = normalizeSearchKey(row.b || "");
    return (key && key.includes(query)) || (building && building.includes(query));
  });

  // 지번주소를 직접 입력한 경우 roads.json의 지번과 정확히 연결한다.
  // 기존에는 도로명/건물명 키만 보아 "오산동 540-15"가 roads.json의
  // "역광장로 90"으로 연결되지 못하고 잘못된 검색색인 fallback으로 빠질 수 있었다.
  const directJibun = roads.filter((item) => normalizeSearchKey(item.j || "") === query);

  const looksLikeAddress = /\d/.test(query);
  let row = directJibun.length === 1 ? directJibun[0] : null;

  // 건물명-only 검색은 후보가 딱 하나일 때만 주소로 변환한다.
  if (!row && direct.length === 1) {
    row = direct[0];
  } else if (!row && direct.length > 1 && looksLikeAddress) {
    row = direct.find((item) => normalizeSearchKey(item.k || "") === query)
      || direct.find((item) => normalizeSearchKey(item.k || "").includes(query))
      || null;
  }

  // 기존 fuzzy 토큰 검색은 주소형 입력에서만 허용한다.
  if (!row && looksLikeAddress) {
    const reverse = roads.find((item) => {
      const key = normalizeSearchKey(item.k || "");
      return key && query.includes(key) && key.length >= 5;
    });
    row = reverse || findRoadByTokens(roads, query);
  }

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


function findTongbanBySearchIndex(values) {
  if (!state.searchIndex) return "검색 결과가 없습니다. 예외 규칙 추가가 필요할 수 있습니다.";
  const queries = Array.isArray(values) ? values : [values];
  const ids = new Set();

  for (const value of queries) {
    const raw = cleanText(value || "");
    const candidates = makeSearchIndexCandidates(raw);
    for (const candidate of candidates) {
      const key = normalizeSearchKey(candidate);
      if (!key || key.length < 2) continue;
      const matched = state.searchIndex[key];
      if (Array.isArray(matched)) {
        matched.forEach((id) => ids.add(Number(id)));
      }
    }
  }

  if (!ids.size) return "검색 결과가 없습니다. 예외 규칙 추가가 필요할 수 있습니다.";

  let rows = Array.from(ids)
    .map((id) => (state.core.tongban || [])[id])
    .filter(Boolean);

  const selectedRows = applySelectedRegionToTongban(rows);
  if (selectedRows.length) rows = selectedRows;

  return rows.length ? rows : "선택한 지역 안에서는 검색 결과가 없습니다.";
}

function makeSearchIndexCandidates(value) {
  const text = cleanText(value || "");
  const candidates = new Set();
  if (!text) return [];
  candidates.add(text);

  const roadMatches = text.match(/(?:화성시|오산시)?\s*[가-힣0-9]+(?:로|길|대로|번길)\s*\d+(?:-\d+)?/g) || [];
  roadMatches.forEach((item) => candidates.add(item));

  const jibunMatches = text.match(/[가-힣0-9]+(?:읍|면|동|리)\s+(?:산\s*)?\d+(?:-\d+)?/g) || [];
  jibunMatches.forEach((item) => candidates.add(item));

  const parts = text.split(/[|,;/\n]+/).map((item) => item.trim()).filter(Boolean);
  parts.forEach((item) => candidates.add(item));

  return Array.from(candidates);
}


function filterTongbanByRoadContext(rows, roadInfo) {
  if (!Array.isArray(rows) || !rows.length || !roadInfo) return rows;

  const admin = normalizeText(roadInfo.admin || "");
  const legal = cleanText(roadInfo.legal || "");
  const parsed = parseAddress([legal, roadInfo.jibun || ""].filter(Boolean).join(" "));

  // 행정동은 후보를 좁히는 용도로만 사용하고, 도로명 DB에서 지번까지 확인된 경우에는
  // 실제 지번이 관할구역에 포함되는지까지 확인해야 통리반으로 확정한다.
  let candidates = rows;
  if (admin) {
    const byAdmin = candidates.filter((row) => normalizeText(row.eup || "") === admin);
    if (byAdmin.length) candidates = byAdmin;
  }

  if (parsed.legalArea && parsed.mainNo !== null) {
    const byJibun = candidates.filter((row) => containsJibun(row.area || "", parsed.legalArea, parsed.mainNo, parsed.subNo, parsed.isMountain));
    // 지번이 확인됐는데 후보 관할구역 어디에도 그 지번이 없으면 행정동만 같은 후보를
    // 확정 결과로 사용하지 않는다. (엉뚱한 통·반 fallback 방지)
    return byJibun;
  }

  return candidates;
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

function refineSchoolsByExactAddress(schools, roadInfo, originalInput = "") {
  if (!Array.isArray(schools) || schools.length <= 1) return schools || [];

  const parsed = parseAddress([roadInfo?.jibun || "", roadInfo?.legal || ""].filter(Boolean).join(" "));

  // 1순위: 통학구역 관할구역에 실제 지번이 명시되어 있으면 가장 강한 근거로 사용한다.
  // "반송동 219~221"처럼 범위로 적힌 경우도 containsJibun이 처리한다.
  if (parsed.legalArea && parsed.mainNo !== null) {
    const jibunMatched = schools.filter((item) =>
      containsJibun(item.schoolArea || "", parsed.legalArea, parsed.mainNo, parsed.subNo, parsed.isMountain)
    );
    if (jibunMatched.length) return mergeSchoolResults([], jibunMatched);
  }

  // 2순위: 매칭된 통리반 관할구역에 아파트 동이 명시되어 있으면 그 동을
  // 통학구역의 세부 동 범위와 대조한다.
  // 예: 동탄반석로 71 -> 반송동 135 -> 4통 1반 관할구역의 441동
  //     -> 솔빛초 관할구역의 441~448동과 일치 -> 솔빛초.
  const tongbanDongMatched = schools.filter((item) => {
    const dongs = extractExplicitBuildingDongs(item.tongbanArea || "");
    return dongs.some((dong) => schoolAreaContainsBuildingDong(item.schoolArea || "", dong));
  });
  if (tongbanDongMatched.length) return mergeSchoolResults([], tongbanDongMatched);

  // 3순위: 사용자가 아파트 동까지 직접 입력했거나 도로명주소 건물명에 동 정보가 있는 경우
  // 통학구역의 "441~448동" 같은 세부 동 조건과 비교한다.
  const detailText = [originalInput, roadInfo?.building || ""].filter(Boolean).join(" ");
  const buildingDong = extractBuildingDong(detailText);
  if (buildingDong) {
    const dongMatched = schools.filter((item) => schoolAreaContainsBuildingDong(item.schoolArea || "", buildingDong));
    if (dongMatched.length) return mergeSchoolResults([], dongMatched);
  }

  return schools;
}

function extractExplicitBuildingDongs(text) {
  const value = cleanText(text || "");
  const found = [];

  // 지번 숫자를 아파트 동으로 오인하지 않도록 반드시 '동'이 붙은 숫자만 사용한다.
  for (const match of value.matchAll(/(\d{2,4})\s*동/g)) {
    found.push(Number(match[1]));
  }

  // "441~448동"처럼 범위가 통리반 관할구역에 직접 적힌 경우도 펼쳐서 사용한다.
  for (const match of value.matchAll(/(\d{2,4})\s*(?:~|∼|〜|－|–|—)\s*(\d{2,4})\s*동/g)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start > 0 && end >= start && end - start <= 200) {
      for (let dong = start; dong <= end; dong += 1) found.push(dong);
    }
  }

  return unique(found.filter(Boolean));
}

function schoolAreaContainsBuildingDong(areaText, buildingDong) {
  const target = Number(String(buildingDong).replace(/[^0-9]/g, ""));
  if (!target) return false;

  const text = cleanText(areaText || "");
  const rangePattern = /(\d{2,4})\s*(?:~|∼|〜|－|–|—)\s*(\d{2,4})\s*동/g;
  for (const match of text.matchAll(rangePattern)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start <= target && target <= end) return true;
  }

  const singleDongs = [...text.matchAll(/(\d{2,4})\s*동/g)].map((match) => Number(match[1]));
  return singleDongs.includes(target);
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
  let text = area;

  // 호수/층수 범위를 '전체' 제거한 뒤 지번 범위를 해석한다.
  // 기존처럼 끝의 "2006호"만 지우면 "106∼2006호 920-1"이
  // "106∼ 920-1"로 변해 865-1 같은 전혀 다른 지번이 범위 안으로 오인될 수 있다.
  text = text.replace(/\d+\s*(?:[~∼〜－–—])\s*\d+\s*호/g, " ");
  text = text.replace(/\d+\s*호/g, " ");
  text = text.replace(/\d+\s*(?:[~∼〜－–—])\s*\d+\s*층/g, " ");
  text = text.replace(/\d+\s*층/g, " ");

  // 아파트 동번호만 제거한다. 뒤에 한글이 이어지는 "135 동탄..."은
  // 지번 135 + 단지명 시작이므로 절대 '135동'으로 지우지 않는다.
  text = text.replace(/\d{2,4}\s*동(?![가-힣])/g, " ");
  text = text.replaceAll(legalArea, "");

  const target = { main: Number(mainNo), sub: subNo === null ? null : Number(subNo) };
  const parts = text.split(/[,，/ㆍ]/);
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    // 산번지는 "산"이 실제 지번 숫자 바로 앞에 붙는 경우만 인정한다.
    // "부산동", "고산아트빌라"처럼 명칭 안에 들어 있는 '산'을
    // 산번지 표지로 오인하면 일반지번이 통리반 0건으로 빠질 수 있다.
    const mountainMarkerPattern = /(^|[^가-힣0-9])산\s*(?=\d)/;
    const partHasMountain = mountainMarkerPattern.test(part);
    if (isMountain !== partHasMountain) continue;

    if (partHasMountain) {
      part = part.replace(mountainMarkerPattern, "$1").trim();
    }
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

// ===== 초등 통학구역 + 2027학년도 중학군(구) 통합 조회 =====
function normalizeIntegratedSchool(value) {
  return String(value || "").replace(/\s/g, "").replace(/초등학교$/, "초");
}

function populateCurrentSchoolList() {
  const list = document.querySelector("#currentSchoolList");
  if (!list || typeof GROUPS === "undefined") return;
  const names = [...new Set(GROUPS.flatMap((g) => g[3] || []))].sort((a,b)=>a.localeCompare(b,"ko"));
  list.innerHTML = names.map((s) => `<option value="${escapeHtml(String(s).replace(/초등학교$/, "초"))}"></option>`).join("");
}

document.addEventListener("DOMContentLoaded", () => window.setTimeout(populateCurrentSchoolList, 0));

function canonicalIntegratedSchool(value) {
  if (typeof GROUPS === "undefined") return "";
  const all = [...new Set(GROUPS.flatMap((g) => g[3] || []))];
  const q = normalizeIntegratedSchool(value);
  return all.find((s) => normalizeIntegratedSchool(s) === q) || "";
}

function middleGroupsForSchool(school) {
  if (typeof GROUPS === "undefined") return [];
  const q = normalizeIntegratedSchool(school);
  return GROUPS.filter((g) => (g[3] || []).some((s) => normalizeIntegratedSchool(s) === q));
}

function integratedAreaRule(school) {
  if (typeof AREA_RULES === "undefined") return null;
  const key = Object.keys(AREA_RULES).find((k) => normalizeIntegratedSchool(k) === normalizeIntegratedSchool(school));
  return key ? AREA_RULES[key] : null;
}

function renderMiddleAssignmentForIntegrated(school) {
  const groups = middleGroupsForSchool(school);
  const rule = integratedAreaRule(school);
  if (!groups.length) {
    return `<div class="integrated-alert integrated-warn"><strong>중입배정 자료에서 학교를 찾지 못했습니다.</strong><span>2027학년도 중학교 학교군 및 중학구 확정 자료를 확인해 주세요.</span></div>`;
  }

  if (rule?.type === "fixed") {
    const allowed = new Set(rule.schools || []);
    const blocks = groups.filter(g => (g[2] || []).some(m => allowed.has(m))).map(g => {
      const schools = (g[2] || []).filter(m => allowed.has(m));
      return `<div class="integrated-middle-group"><strong>${escapeHtml(g[0])}</strong><span>${escapeHtml(g[1])}</span><div class="integrated-tags">${schools.map(m=>`<em>${escapeHtml(m)}</em>`).join("")}</div></div>`;
    }).join("");
    return `<div class="integrated-alert integrated-ok"><strong>${escapeHtml(String(school).replace(/초등학교$/, "초"))} 혼합지원 규칙</strong><span>${escapeHtml(rule.text || "혼합지원")}</span></div>${blocks}${rule.deny?.length?`<p class="integrated-note">지원 제한: ${escapeHtml(rule.deny.join(", "))}</p>`:""}`;
  }

  if (groups.length === 1) {
    const g = groups[0];
    return `<div class="integrated-alert integrated-ok"><strong>${escapeHtml(g[0])}</strong><span>${escapeHtml(g[1])} 기준</span></div><div class="integrated-middle-group"><div class="integrated-tags">${(g[2]||[]).map(m=>`<em>${escapeHtml(m)}</em>`).join("")}</div>${g[4]?`<p class="integrated-note">※ ${escapeHtml(g[4])}</p>`:""}</div>`;
  }

  return `<div class="integrated-alert integrated-warn"><strong>주소 세부 확인이 필요한 학교입니다.</strong><span>현재 재학학교가 둘 이상의 중학군(구)에 연결되어 있어, 2027학년도 확정 자료 기준으로 가능한 범위를 모두 표시합니다.</span></div>${groups.map(g=>`<div class="integrated-middle-group"><strong>${escapeHtml(g[0])}</strong><span>${escapeHtml(g[1])}</span><div class="integrated-tags">${(g[2]||[]).map(m=>`<em>${escapeHtml(m)}</em>`).join("")}</div>${g[4]?`<p class="integrated-note">※ ${escapeHtml(g[4])}</p>`:""}</div>`).join("")}`;
}

function renderEnrollmentComparison(addressSchoolNames) {
  const input = document.querySelector("#currentSchoolInput");
  if (!input) return "";
  const entered = input.value.trim();
  if (!entered) {
    return `<div class="result-card integrated-card"><div class="card-header"><div class="card-title"><span>재학학교 비교</span><strong>현재 재학 중인 초등학교를 입력해 주세요.</strong></div></div><p class="result-note">재학학교를 입력하면 주소상 통학구역과 비교하고 중입배정 범위를 이어서 확인합니다.</p></div>`;
  }
  const current = canonicalIntegratedSchool(entered);
  if (!current) {
    return `<div class="result-card integrated-card"><div class="card-header"><div class="card-title"><span>재학학교 비교</span><strong>등록된 초등학교명을 확인해 주세요.</strong></div></div><div class="integrated-alert integrated-warn"><strong>${escapeHtml(entered)}</strong><span>2027학년도 중학군(구) 학교 목록에서 정확히 일치하는 학교를 찾지 못했습니다.</span></div></div>`;
  }
  const addressSet = new Set((addressSchoolNames || []).map(normalizeIntegratedSchool));
  const matched = addressSet.has(normalizeIntegratedSchool(current));
  const addressText = addressSchoolNames.length ? addressSchoolNames.map(s=>String(s).replace(/초등학교$/, "초")).join(", ") : "확인 필요";
  const compare = matched
    ? `<div class="integrated-alert integrated-ok"><strong>통학구역 일치</strong><span>학구 일치로 판단됩니다.</span></div>`
    : `<div class="integrated-alert integrated-warn"><strong>통학구역 불일치 · 학구위반 여부 확인 필요</strong><span>학구 위반으로 판단됩니다.</span></div>`;
  return `<div class="result-card integrated-card"><div class="card-header"><div class="card-title"><span>통합 확인</span><strong>재학학교 비교 → 중입배정</strong></div></div><div class="integrated-compare"><div><small>주소상 초등학교</small><strong>${escapeHtml(addressText)}</strong></div><div><small>현재 재학학교</small><strong>${escapeHtml(String(current).replace(/초등학교$/, "초"))}</strong></div></div>${compare}<h3 class="integrated-heading">현재 재학학교 기준 중입배정 범위</h3>${renderMiddleAssignmentForIntegrated(current)}<h3 class="integrated-heading">중학군(구) 지도</h3><div id="middleResultMap" class="result-map" aria-label="중학군(구) 경계와 중학교 위치 지도"></div><p id="middleMapStatus" class="map-status">중학군 지도를 불러오는 중입니다.</p></div>`;
}

async function initMiddleResultMap(elementarySchool, homeAddress) {
  ensureAddressMapPopupStyle();
  const mapEl = document.querySelector("#middleResultMap");
  const statusEl = document.querySelector("#middleMapStatus");
  if (!mapEl || !statusEl) return;

  const groups = middleGroupsForSchool(elementarySchool);
  if (!groups.length) {
    mapEl.hidden = true;
    statusEl.textContent = "표시할 중학교 학교군·중학구 자료가 없습니다.";
    return;
  }

  mapEl.hidden = false;
  mapEl.style.display = "block";
  mapEl.style.width = "100%";
  mapEl.style.height = window.matchMedia("(max-width: 720px)").matches ? "340px" : "460px";
  mapEl.style.minHeight = window.matchMedia("(max-width: 720px)").matches ? "340px" : "420px";

  try {
    await loadKakaoMapSdk();
    const [geojson, pointJson, middleInfo] = await Promise.all([
      loadMiddleZoneGeoJson(),
      loadPublicSchoolPoints(),
      loadMiddleSchoolInfoForAddressResult().catch(() => ({}))
    ]);
    const geocoder = new window.kakao.maps.services.Geocoder();

    const wantedGroupNames = new Set(groups.map(g => normalizeText(g[0] || "")));
    const rule = integratedAreaRule(elementarySchool);
    const allowed = rule?.type === "fixed" ? new Set(rule.schools || []) : null;
    const wantedSchools = new Set(groups.flatMap(g => g[2] || []).filter(name => !allowed || allowed.has(name)));

    const features = (geojson?.features || []).filter(feature => {
      const props = feature?.properties || {};
      const featureName = normalizeText(props.HAKGUDO_NM || "");
      const linked = (props.school_names || []).some(name => wantedSchools.has(name));
      return wantedGroupNames.has(featureName) || linked;
    });

    const schoolRows = Array.isArray(pointJson) ? pointJson : (pointJson?.schools || []);
    const schoolPoints = schoolRows.filter(s => {
      if (s.school_level !== "중학교" || !wantedSchools.has(s.school_name)) return false;
      const lat = Number(s.lat), lng = Number(s.lng);
      return s.lat !== null && s.lng !== null && s.lat !== "" && s.lng !== "" &&
        Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
    });

    let homePos = null;
    if (homeAddress) {
      try {
        const q = cleanGeocodeAddress(homeAddress).replace(/^(화성시|오산시)\s/, "경기도 $1 ");
        homePos = await geocodeAddress(geocoder, q);
      } catch (error) {
        console.warn("middle map home geocode failed", error);
      }
    }

    let elementaryPos = null;
    const elementaryInfo = getSchoolInfo(elementarySchool);
    const elementaryAddress = elementaryInfo?.mapAddress || elementaryInfo?.address || "";
    if (elementaryAddress) {
      try {
        elementaryPos = await geocodeAddress(geocoder, cleanGeocodeAddress(elementaryAddress));
      } catch (error) {
        console.warn("middle map elementary geocode failed", error);
      }
    }

    let center = homePos || elementaryPos || new window.kakao.maps.LatLng(37.15, 127.05);
    if (!homePos && !elementaryPos && schoolPoints.length) {
      center = new window.kakao.maps.LatLng(Number(schoolPoints[0].lat), Number(schoolPoints[0].lng));
    }
    const map = new window.kakao.maps.Map(mapEl, { center, level: 7 });

    const oldLegend = mapEl.querySelector(".middle-result-marker-legend");
    if (oldLegend) oldLegend.remove();
    const markerLegend = document.createElement("div");
    markerLegend.className = "middle-result-marker-legend";
    markerLegend.innerHTML = `<span><i class="middle-result-dot middle-result-dot--elementary"></i>현재 초등학교</span><span><i class="middle-result-dot middle-result-dot--middle"></i>배정 대상 중학교</span>`;
    mapEl.appendChild(markerLegend);
    const bounds = new window.kakao.maps.LatLngBounds();
    let boundCount = 0;
    let infoOverlay = null;

    for (const feature of features) {
      const props = feature.properties || {};
      for (const polygonCoords of featurePolygonParts(feature)) {
        const paths = geoPolygonToKakaoPaths(polygonCoords);
        if (!paths.length || !paths[0]?.length) continue;
        const polygon = new window.kakao.maps.Polygon({
          map,
          path: paths,
          strokeWeight: 3,
          strokeColor: "#0f766e",
          strokeOpacity: 0.85,
          strokeStyle: "solid",
          fillColor: "#2dd4bf",
          fillOpacity: 0.12,
        });
        for (const path of paths) for (const p of path) { bounds.extend(p); boundCount += 1; }
        window.kakao.maps.event.addListener(polygon, "click", (mouseEvent) => {
          if (infoOverlay) infoOverlay.setMap(null);
          const linked = (props.school_names || []).join(", ");
          infoOverlay = new window.kakao.maps.CustomOverlay({
            map,
            position: mouseEvent.latLng,
            yAnchor: 1.15,
            content: `<div class="schoolzone-map-info"><strong>${escapeHtml(props.HAKGUDO_NM || "학교군·중학구")}</strong><span>중학교 학교군·중학구</span>${linked ? `<span>${escapeHtml(linked)}</span>` : ""}</div>`,
          });
        });
      }
    }

    // 입력 주소
    if (homePos) {
      bounds.extend(homePos); boundCount += 1;
      new window.kakao.maps.CustomOverlay({
        map,
        position: homePos,
        yAnchor: 1,
        content: '<div class="zone-map-marker zone-map-marker--home"><span class="zone-map-marker__icon">⌂</span><span class="zone-map-marker__label">검색 주소</span></div>',
      });
    }

    // 현재 재학 중인 초등학교
    if (elementaryPos) {
      bounds.extend(elementaryPos); boundCount += 1;
      const elemEl = document.createElement("button");
      elemEl.type = "button";
      elemEl.className = "zone-map-marker zone-map-marker--school zone-map-marker--elementary-result";
      elemEl.style.border = "0";
      elemEl.style.background = "transparent";
      elemEl.style.cursor = "pointer";
      elemEl.innerHTML = `<span class="zone-map-marker__icon">초</span><span class="zone-map-marker__label">${escapeHtml(String(elementarySchool).replace(/초등학교$/, "초"))}</span>`;
      new window.kakao.maps.CustomOverlay({ map, position: elementaryPos, yAnchor: 1, content: elemEl });
      elemEl.addEventListener("click", () => {
        if (infoOverlay) infoOverlay.setMap(null);
        const point = schoolRows.find(s => normalizeSchoolName(s.school_name) === normalizeSchoolName(elementarySchool));
        infoOverlay = new window.kakao.maps.CustomOverlay({
          map,
          position: elementaryPos,
          yAnchor: 1.35,
          clickable: true,
          content: markerSchoolInfoHtml(elementarySchool, elementaryInfo, point?.established_date || ""),
        });
        bindSchoolPopupClose(infoOverlay);
      });
    }

    // 배정 대상 중학교: 클릭하면 업로드된 학교현황 정보 표시
    for (const school of schoolPoints) {
      const pos = new window.kakao.maps.LatLng(Number(school.lat), Number(school.lng));
      bounds.extend(pos); boundCount += 1;

      const markerEl = document.createElement("button");
      markerEl.type = "button";
      markerEl.className = "zone-map-marker zone-map-marker--school zone-map-marker--middle-result";
      markerEl.style.border = "0";
      markerEl.style.background = "transparent";
      markerEl.style.cursor = "pointer";
      markerEl.innerHTML = `<span class="zone-map-marker__icon">중</span><span class="zone-map-marker__label">${escapeHtml(school.school_name)}</span>`;

      new window.kakao.maps.CustomOverlay({ map, position: pos, yAnchor: 1, content: markerEl });
      markerEl.addEventListener("click", () => {
        if (infoOverlay) infoOverlay.setMap(null);
        const detail = middleInfo?.[school.school_name] || {};
        infoOverlay = new window.kakao.maps.CustomOverlay({
          map,
          position: pos,
          yAnchor: 1.35,
          clickable: true,
          content: markerSchoolInfoHtml(school.school_name, detail, school.established_date || ""),
        });
        bindSchoolPopupClose(infoOverlay);
      });
    }

    if (boundCount) map.setBounds(bounds, 70, 70, 70, 70);
    window.setTimeout(() => {
      map.relayout();
      if (boundCount) map.setBounds(bounds, 70, 70, 70, 70);
    }, 0);

    window.kakao.maps.event.addListener(map, "click", () => {
      if (infoOverlay) {
        infoOverlay.setMap(null);
        infoOverlay = null;
      }
    });

    const groupText = groups.map(g => g[0]).join(", ");
    statusEl.textContent = `${groupText} 경계 · 검색 주소 · 재학 초등학교 · 해당 중학교 ${schoolPoints.length}곳을 표시합니다. 학교 마커를 누르면 상세정보를 확인할 수 있습니다.`;
  } catch (error) {
    console.warn("middle result map load failed", error);
    mapEl.hidden = true;
    statusEl.textContent = "중학교 학교군·중학구 지도를 불러오지 못했습니다.";
  }
}

// 기존 주소 결과 렌더링을 감싸 통합 비교 카드를 추가한다.
const originalRenderAddressResultIntegrated = renderAddressResult;
renderAddressResult = function(result) {
  const schools = Array.isArray(result.school) ? result.school : [];
  const schoolNames = unique(schools.map((item) => item.school));
  originalRenderAddressResultIntegrated(result);
  if (els.results && !els.results.hidden) {
    els.results.insertAdjacentHTML("beforeend", renderEnrollmentComparison(schoolNames));
    const current = canonicalIntegratedSchool(document.querySelector("#currentSchoolInput")?.value?.trim() || "");
    if (current && document.querySelector("#middleResultMap")) {
      window.setTimeout(() => initMiddleResultMap(current, result.road || result.input || ""), 0);
    }
  }
};

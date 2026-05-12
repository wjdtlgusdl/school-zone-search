const DATA_PATHS = {
  core: "/data/core.json",
  roads: "/data/roads.json",
  suggestions: "/data/suggestions.json",
};

const APT_ALIAS = {
  "대방엘리움레이크파크": ["대방엘리움", "대방 엘리움 레이크파크"],
  "동탄파크릭스": ["파크릭스", "동탄파크릭스"],
  "호반써밋동탄": ["호반써밋", "호반써밋동탄"],
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
  els.addressMode = document.querySelector("#addressMode");
  els.schoolMode = document.querySelector("#schoolMode");
  els.citySelect = document.querySelector("#citySelect");
  els.eupSelect = document.querySelector("#eupSelect");
  els.addressInput = document.querySelector("#addressInput");
  els.addressSuggestions = document.querySelector("#addressSuggestions");
  els.schoolInput = document.querySelector("#schoolInput");
  els.schoolSuggestions = document.querySelector("#schoolSuggestions");
  els.emptyState = document.querySelector("#emptyState");
  els.loadingState = document.querySelector("#loadingState");
  els.results = document.querySelector("#results");
}

function bindEvents() {
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

  els.addressInput.addEventListener("input", handleAddressSuggestionInput);
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

  els.schoolInput.addEventListener("input", handleSchoolSuggestionInput);
  els.schoolInput.addEventListener("focus", handleSchoolSuggestionInput);
  els.schoolInput.addEventListener("keydown", handleSchoolSuggestionKeys);
  els.schoolInput.addEventListener("blur", () => {
    window.setTimeout(hideSchoolSuggestions, 120);
  });

  els.schoolSuggestions.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const option = event.target.closest("[data-school-suggestion-index]");
    if (!option) return;
    selectSchoolSuggestion(Number(option.dataset.schoolSuggestionIndex));
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
  hideAddressSuggestions();
  els.addressInput.focus({ preventScroll: true });
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
  hideSchoolSuggestions();
  els.schoolInput.focus({ preventScroll: true });
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
          <span class="badge orange">후보 결과</span>
        </div>
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
      <div class="card-header">
        <div class="card-title">
          <span>주소 기준 배정 초등학교</span>
          <strong>${escapeHtml(names.join(", "))}</strong>
        </div>
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
  els.results.innerHTML = html;
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

  const buildingTokens = splitMeaningfulKeywords(building).filter((token) => token.length >= 2);
  const buildingNorm = looseNormalize(building);
  const results = [];

  for (const row of rows) {
    const area = row.area || "";
    const areaNorm = looseNormalize(area);

    const jibunMatch = parsed.legalArea && parsed.mainNo !== null
      ? containsJibun(area, parsed.legalArea, parsed.mainNo, parsed.subNo, parsed.isMountain)
      : false;

    const buildingMatch = buildingTokens.length
      ? buildingTokens.some((token) => areaNorm.includes(token)) || hasSharedApartmentBrand(areaNorm, buildingNorm)
      : false;

    const dongMatch = originalDong ? normalizeForApartment(area).includes(originalDong) : true;

    if (jibunMatch && dongMatch && (!buildingTokens.length || buildingMatch)) {
      results.push(row);
    }
  }

  return results;
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
  const rangePattern = /(\d+(?:-\d+)?)\s*(?:[~∼〜－–—-]|부터)\s*(\d+(?:-\d+)?)(?:\s*까지)?/g;
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
  return hasSharedApartmentBrand(areaNorm, addrNorm);
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
  return cleanText(value).toLowerCase().replace(/\s+/g, "").replaceAll("경기도", "");
}

function normalizeForApartment(value) {
  return cleanText(value)
    .replace(/\s+/g, "")
    .replaceAll("엘에이치", "LH")
    .replaceAll("엘에치", "LH")
    .replaceAll("에이치엘", "HL")
    .replaceAll("～", "~")
    .replaceAll("이편한세상", "e편한세상")
    .replaceAll("E편한세상", "e편한세상")
    .replaceAll("e~편한세상", "e편한세상")
    .replaceAll("이-편한세상", "e편한세상")
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
  const brands = ["e편한세상", "우미린", "롯데캐슬", "호반", "자이", "푸르지오", "힐스테이트", "아이파크", "더샵", "트루엘"];
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

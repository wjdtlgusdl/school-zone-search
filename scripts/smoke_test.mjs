import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("public/main.js", "utf8");
const core = JSON.parse(fs.readFileSync("public/data/core.json", "utf8"));
const roads = JSON.parse(fs.readFileSync("public/data/roads.json", "utf8")).roads;
const suggestions = JSON.parse(fs.readFileSync("public/data/suggestions.json", "utf8")).suggestions;

const context = vm.createContext({
  console,
  Intl,
  document: {
    addEventListener() {},
    documentElement: { dataset: {} },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  },
  window: {
    matchMedia() {
      return { matches: false };
    },
  },
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
});

vm.runInContext(source, context);
context.__core = core;
context.__roads = roads;
context.__suggestions = suggestions;

const result = await vm.runInContext(
  `(async () => {
    state.core = __core;
    state.roads = __roads;
    populateSchoolSuggestions();

    const address = await searchAddress("봉담읍 상리 150");
    const road = await searchAddress("동탄신리천로3길 59");
    const school = searchSchoolArea("동탄초등학교");
    const suggestion = findAddressSuggestions("양산로", __suggestions);
    const schoolSuggestion = findSchoolSuggestions("동탄");

    return {
      addressSchool: Array.isArray(address.school) ? address.school.length : 0,
      addressTongban: Array.isArray(address.tongban) ? address.tongban.length : 0,
      roadSchool: Array.isArray(road.school) ? road.school.length : 0,
      schoolRows: Array.isArray(school) ? school.length : 0,
      suggestions: suggestion.length,
      schoolSuggestions: schoolSuggestion.length
    };
  })()`,
  context,
);

const failures = Object.entries(result).filter(([, value]) => value <= 0);
if (failures.length) {
  console.error(result);
  throw new Error(`Smoke test failed: ${failures.map(([key]) => key).join(", ")}`);
}

console.log(result);

#!/usr/bin/env python3
import csv
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = ROOT / "public" / "data"

TONGBAN_FILE = ROOT / "source_data" / "tongban.csv"
SCHOOL_FILE = ROOT / "source_data" / "school_zones_2026.xlsx"
ROAD_FILE = ROOT / "source_data" / "road_osan_hwaseong.csv"
SCHOOL_INFO_FILE = ROOT / "school 2026.csv"

SCHOOL_HEADERS = ["학교명", "읍면동", "통리", "반", "관할구역", "비고"]


def clean_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    text = text.replace("～", "~")
    text = text.replace("?", "~")
    text = text.replace("부터", "~")
    text = text.replace("까지", "")
    text = text.replace("번지", "")
    return text


def normalize_text(value):
    return clean_text(value).replace(" ", "")


def normalize_search_key(value):
    return clean_text(value).lower().replace(" ", "").replace("경기도", "")


def normalize_num(value):
    text = str(value or "").strip()
    if text in {"", "0", "nan", "None"}:
        return ""
    return str(int(text)) if text.isdigit() else text


def make_road_addr(row):
    main = normalize_num(row.get("건물본번"))
    sub = normalize_num(row.get("건물부번"))
    number = main if not sub else f"{main}-{sub}"
    return f"{row.get('시군구명', '')} {row.get('도로명', '')} {number}".strip()


def make_jibun_addr(row):
    main = normalize_num(row.get("지번본번"))
    sub = normalize_num(row.get("지번부번"))
    number = main if not sub else f"{main}-{sub}"
    san = "산 " if str(row.get("산여부", "")).strip() == "1" else ""
    legal_area = row.get("법정읍면동명", "")
    if row.get("법정리명"):
        legal_area = f"{legal_area} {row.get('법정리명')}"
    return f"{legal_area} {san}{number}".strip()


def normalize_school_name(value):
    return normalize_text(value).replace("초등학교", "초").replace("초교", "초")


def read_school_info_rows():
    if not SCHOOL_INFO_FILE.exists():
        return {}

    encodings = ("utf-8-sig", "cp949")
    last_error = None
    for encoding in encodings:
        try:
            with SCHOOL_INFO_FILE.open("r", encoding=encoding, newline="") as source:
                reader = csv.DictReader(source)
                info = {}
                for row in reader:
                    school = clean_text(row.get("학교명"))
                    if not school:
                        continue
                    key = normalize_school_name(school)
                    info[key] = {
                        "school": school,
                        "address": clean_text(row.get("주소")),
                        "phone": clean_text(row.get("전화번호")),
                        "homepage": clean_text(row.get("홈페이지")),
                    }
                return info
        except UnicodeDecodeError as exc:
            last_error = exc

    raise last_error


def read_tongban_rows():
    encodings = ("utf-8-sig", "cp949")
    last_error = None

    for encoding in encodings:
        try:
            with TONGBAN_FILE.open("r", encoding=encoding, newline="") as source:
                reader = csv.DictReader(source)
                rows = []
                for row in reader:
                    item = {
                        "sigun": clean_text(row.get("시군")),
                        "eup": clean_text(row.get("읍면동")),
                        "tongri": clean_text(row.get("통리")),
                        "ban": clean_text(row.get("반")),
                        "area": clean_text(row.get("관할구역")),
                    }
                    if item["eup"] == "읍면동" or item["tongri"] == "통리":
                        continue
                    if item["eup"] and item["tongri"]:
                        item["eupKey"] = normalize_text(item["eup"])
                        rows.append(item)
                return rows
        except UnicodeDecodeError as exc:
            last_error = exc

    raise last_error


def parse_shared_strings(zip_file):
    try:
        xml = zip_file.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    root = ET.fromstring(xml)
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    strings = []
    for si in root.findall("x:si", ns):
        parts = []
        for text in si.findall(".//x:t", ns):
            parts.append(text.text or "")
        strings.append("".join(parts))
    return strings


def column_index(cell_ref):
    letters = re.sub(r"[^A-Z]", "", cell_ref)
    index = 0
    for char in letters:
        index = index * 26 + ord(char) - ord("A") + 1
    return index - 1


def read_xlsx_rows():
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rows = []

    with zipfile.ZipFile(SCHOOL_FILE) as xlsx:
        shared_strings = parse_shared_strings(xlsx)
        sheet_xml = xlsx.read("xl/worksheets/sheet1.xml")

    root = ET.fromstring(sheet_xml)
    for row in root.findall(".//x:sheetData/x:row", ns):
        row_number = int(row.attrib.get("r", "0"))
        if row_number <= 4:
            continue

        values = [""] * len(SCHOOL_HEADERS)
        for cell in row.findall("x:c", ns):
            idx = column_index(cell.attrib.get("r", ""))
            if idx >= len(SCHOOL_HEADERS):
                continue

            value_node = cell.find("x:v", ns)
            inline_node = cell.find("x:is/x:t", ns)
            value = ""
            if value_node is not None:
                value = value_node.text or ""
                if cell.attrib.get("t") == "s":
                    value = shared_strings[int(value)] if value else ""
            elif inline_node is not None:
                value = inline_node.text or ""

            values[idx] = clean_text(value)

        item = dict(zip(SCHOOL_HEADERS, values))
        if item["학교명"] and item["읍면동"] and item["통리"]:
            rows.append(
                {
                    "school": item["학교명"],
                    "eup": item["읍면동"],
                    "tongri": item["통리"],
                    "ban": item["반"],
                    "area": item["관할구역"],
                    "note": item["비고"],
                    "schoolKey": normalize_text(item["학교명"])
                    .replace("초등학교", "초")
                    .replace("초교", "초"),
                    "eupKey": normalize_text(item["읍면동"]),
                    "tongriKey": normalize_text(item["통리"]),
                }
            )

    return rows


def read_road_rows():
    rows = []
    with ROAD_FILE.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter="|")
        for row in reader:
            sigungu = row.get("시군구명", "")
            if "오산" not in sigungu and "화성" not in sigungu:
                continue

            road_addr = make_road_addr(row)
            building = clean_text(row.get("시군구용건물명"))
            item = {
                "r": road_addr,
                "j": make_jibun_addr(row),
                "b": building,
                "a": clean_text(row.get("행정동명")),
                "l": clean_text(row.get("법정읍면동명")),
            }
            key = normalize_search_key(f"{road_addr} {building}")
            if key:
                item["k"] = key
                rows.append(item)

    return rows


def is_useful_building_name(value):
    text = clean_text(value)
    compact = normalize_text(text)
    if len(compact) < 4:
        return False
    if not re.search(r"[가-힣]", text):
        return False
    if re.fullmatch(r"[A-Za-z0-9동호층\-_. ]+", text):
        return False
    if text in {".", "건물", "상가", "관리사무소"}:
        return False
    return True


def add_suggestion(bucket, value, kind, weight=1):
    value = clean_text(value)
    if len(normalize_text(value)) < 2:
        return

    key = (kind, value)
    if key not in bucket:
        bucket[key] = {"v": value, "k": kind, "w": 0}
    bucket[key]["w"] += weight


def build_suggestions(tongban_rows, road_rows):
    bucket = {}

    for row in tongban_rows:
        add_suggestion(bucket, row.get("eup"), "읍면동", 20)

    for row in road_rows:
        road_address = row.get("r", "")
        if road_address and " " in road_address:
            add_suggestion(bucket, road_address.rsplit(" ", 1)[0], "도로명", 3)

        jibun = row.get("j", "")
        if jibun and " " in jibun:
            jibun_area = re.sub(r"\s+산$", "", jibun.rsplit(" ", 1)[0])
            add_suggestion(bucket, jibun_area, "지번지역", 2)

        building = row.get("b", "")
        if is_useful_building_name(building):
            add_suggestion(bucket, building, "건물명", 8)

    suggestions = sorted(
        bucket.values(),
        key=lambda item: (-item["w"], item["k"], item["v"]),
    )

    for item in suggestions:
        item.pop("w", None)

    return suggestions[:5000]


def write_json(path, payload):
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main():
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    tongban_rows = read_tongban_rows()
    school_rows = read_xlsx_rows()
    road_rows = read_road_rows()
    school_info = read_school_info_rows()

    core = {
        "meta": {
            "title": "화성·오산 초등학교 통학구역 조회",
            "dataYear": "2026",
            "generatedFrom": [
                TONGBAN_FILE.name,
                SCHOOL_FILE.name,
                ROAD_FILE.name,
                SCHOOL_INFO_FILE.name,
            ],
        },
        "tongban": tongban_rows,
        "schools": school_rows,
        "schoolInfo": school_info,
    }
    roads = {"roads": road_rows}
    suggestions = {"suggestions": build_suggestions(tongban_rows, road_rows)}

    write_json(PUBLIC_DATA / "core.json", core)
    write_json(PUBLIC_DATA / "roads.json", roads)
    write_json(PUBLIC_DATA / "suggestions.json", suggestions)

    print(f"core: {len(core['tongban'])} tongban, {len(core['schools'])} school rows, {len(core['schoolInfo'])} school info rows")
    print(f"roads: {len(roads['roads'])} rows")
    print(f"suggestions: {len(suggestions['suggestions'])} rows")


if __name__ == "__main__":
    main()

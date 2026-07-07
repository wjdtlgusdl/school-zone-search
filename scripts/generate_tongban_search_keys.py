#!/usr/bin/env python3
"""
통리반 검색키 자동 생성기

입력:
  - source_data/tongban.csv
  - source_data/road_osan_hwaseong.csv

출력:
  - source_data/tongban_with_search_keys.csv
  - source_data/tongban_search_key_report.csv

원칙:
  1. 지번으로 통리반이 안전하게 매칭되는 도로명주소만 자동 검색키로 추가합니다.
  2. 건물명만 비슷한 경우는 자동으로 붙이지 않습니다. 오탐 방지를 위해 보고서에서 검토 대상으로만 남깁니다.
  3. 원본 관할구역 컬럼은 유지하고, 검색용 컬럼(검색키)만 추가합니다.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


def clean_text(value: object) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    text = text.replace("～", "~")
    text = text.replace("?", "~")
    text = text.replace("부터", "~")
    text = text.replace("까지", "")
    text = text.replace("번지", "")
    return text


def normalize_text(value: object) -> str:
    return clean_text(value).replace(" ", "")


def normalize_num(value: object) -> str:
    text = str(value or "").strip()
    if text in {"", "0", "nan", "None"}:
        return ""
    return str(int(text)) if text.isdigit() else text


def normalize_key(value: object) -> str:
    return normalize_text(value).upper().replace("-", "")


def is_useful_building_name(value: object) -> bool:
    text = clean_text(value)
    compact = normalize_text(text)
    if len(compact) < 3:
        return False
    if not re.search(r"[가-힣]", text):
        return False
    if re.fullmatch(r"[A-Za-z0-9동호층\-_. ]+", text):
        return False
    if text in {".", "건물", "상가", "관리사무소"}:
        return False
    return True


def read_csv_auto(path: Path, delimiter: str = ",") -> Tuple[List[Dict[str, str]], str]:
    last_error: Optional[Exception] = None
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            with path.open("r", encoding=encoding, newline="") as f:
                rows = list(csv.DictReader(f, delimiter=delimiter))
            return rows, encoding
        except UnicodeDecodeError as exc:
            last_error = exc
    raise last_error or RuntimeError(f"cannot read {path}")


def write_csv(path: Path, rows: List[Dict[str, object]], fieldnames: List[str], encoding: str = "cp949") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding=encoding, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def make_jibun_parts(road_row: Dict[str, str]) -> Dict[str, object]:
    main = normalize_num(road_row.get("지번본번"))
    sub = normalize_num(road_row.get("지번부번"))
    if not main:
        return {}
    legal_dong = clean_text(road_row.get("법정읍면동명"))
    legal_ri = clean_text(road_row.get("법정리명"))
    legal_area = legal_ri or legal_dong
    full_legal_area = f"{legal_dong} {legal_ri}".strip() if legal_ri else legal_dong
    is_mountain = str(road_row.get("산여부", "")).strip() == "1"
    number = main if not sub else f"{main}-{sub}"
    san = "산 " if is_mountain else ""
    sigun = clean_text(road_row.get("시군구명"))
    return {
        "sigun": sigun,
        "legal_area": legal_area,
        "full_legal_area": full_legal_area,
        "main": int(main),
        "sub": int(sub) if sub else None,
        "is_mountain": is_mountain,
        "jibun": f"{full_legal_area} {san}{number}".strip(),
        "jibun_with_sigun": f"{sigun} {full_legal_area} {san}{number}".strip(),
    }


def make_road_addr(road_row: Dict[str, str]) -> str:
    main = normalize_num(road_row.get("건물본번"))
    sub = normalize_num(road_row.get("건물부번"))
    if not main:
        return ""
    number = main if not sub else f"{main}-{sub}"
    return f"{clean_text(road_row.get('시군구명'))} {clean_text(road_row.get('도로명'))} {number}".strip()


def parse_jibun_token(token: str, default_main: Optional[int] = None) -> Dict[str, Optional[int]]:
    parts = str(token).split("-")
    if len(parts) == 1:
        first = int(parts[0])
        return {"main": default_main, "sub": first} if default_main is not None else {"main": first, "sub": None}
    return {"main": int(parts[0]), "sub": int(parts[1])}


def parse_jibun_range_end(token: str, start: Dict[str, Optional[int]]) -> Dict[str, Optional[int]]:
    if "-" in token:
        return parse_jibun_token(token)
    number = int(token)
    if start.get("sub") is not None and start.get("main") is not None and number < int(start["main"]):
        return {"main": start["main"], "sub": number}
    return {"main": number, "sub": None}


def compare_jibun(a: Dict[str, Optional[int]], b: Dict[str, Optional[int]]) -> int:
    if int(a["main"] or 0) != int(b["main"] or 0):
        return int(a["main"] or 0) - int(b["main"] or 0)
    return int(a.get("sub") or 0) - int(b.get("sub") or 0)


def is_jibun_in_range(target: Dict[str, Optional[int]], start: Dict[str, Optional[int]], end: Dict[str, Optional[int]]) -> bool:
    return compare_jibun(start, target) <= 0 and compare_jibun(target, end) <= 0


def is_same_jibun(target: Dict[str, Optional[int]], item: Dict[str, Optional[int]]) -> bool:
    return int(target["main"] or 0) == int(item["main"] or 0) and int(target.get("sub") or 0) == int(item.get("sub") or 0)


def jibun_part_matches(part: str, target: Dict[str, Optional[int]]) -> bool:
    range_pattern = re.compile(r"(\d+(?:-\d+)?)\s*(?:[~∼〜－–—]|부터)\s*(\d+(?:-\d+)?)(?:\s*까지)?")
    for match in range_pattern.finditer(part):
        start = parse_jibun_token(match.group(1))
        end = parse_jibun_range_end(match.group(2), start)
        if is_jibun_in_range(target, start, end):
            return True

    without_ranges = range_pattern.sub(" ", part)
    for token in re.findall(r"\d+(?:-\d+)?", without_ranges):
        if is_same_jibun(target, parse_jibun_token(token)):
            return True
    return False


def contains_jibun(area_text: str, legal_area: str, main_no: int, sub_no: Optional[int], is_mountain: bool) -> bool:
    area = clean_text(area_text)
    if not legal_area or legal_area not in area:
        return False
    area = re.sub(r"\([^)]*\)", " ", area)
    text = area.replace(legal_area, "")
    text = re.sub(r"\d+\s*호", " ", text)
    text = re.sub(r"\d{3,4}\s*동", " ", text)
    text = re.sub(r"\d+\s*층", " ", text)

    target = {"main": int(main_no), "sub": int(sub_no) if sub_no is not None else None}
    for raw_part in re.split(r"[,，/ㆍ]", text):
        part = raw_part.strip()
        if not part:
            continue
        part_has_mountain = "산" in part
        if is_mountain != part_has_mountain:
            continue
        part = part.replace("산", "").strip()
        if jibun_part_matches(part, target):
            return True
    return False


def add_unique(bucket: List[str], value: str, max_len: int = 80, seen: Optional[set] = None) -> bool:
    value = clean_text(value)
    if not value or len(value) > max_len:
        return False
    key = normalize_key(value)
    if not key:
        return False
    if seen is None:
        seen = {normalize_key(item) for item in bucket}
    if key not in seen:
        bucket.append(value)
        seen.add(key)
        return True
    return False


def split_existing_keys(value: str) -> List[str]:
    keys: List[str] = []
    seen: set = set()
    for part in re.split(r"[;；\n|]", clean_text(value)):
        add_unique(keys, part, seen=seen)
    return keys


def extract_jibun_specs(area_text: str, legal_area: str) -> List[Tuple[bool, Dict[str, Optional[int]], Dict[str, Optional[int]]]]:
    """관할구역 문구에서 특정 법정동/리에 대한 지번 단건/범위를 미리 추출한다."""
    area = clean_text(area_text)
    if not legal_area or legal_area not in area:
        return []
    area = re.sub(r"\([^)]*\)", " ", area)
    text = area.replace(legal_area, "")
    text = re.sub(r"\d+\s*호", " ", text)
    text = re.sub(r"\d{3,4}\s*동", " ", text)
    text = re.sub(r"\d+\s*층", " ", text)
    specs: List[Tuple[bool, Dict[str, Optional[int]], Dict[str, Optional[int]]]] = []
    range_pattern = re.compile(r"(\d+(?:-\d+)?)\s*(?:[~∼〜－–—]|부터)\s*(\d+(?:-\d+)?)(?:\s*까지)?")

    for raw_part in re.split(r"[,，/ㆍ]", text):
        part = raw_part.strip()
        if not part:
            continue
        part_has_mountain = "산" in part
        part = part.replace("산", "").strip()

        consumed = []
        for match in range_pattern.finditer(part):
            start = parse_jibun_token(match.group(1))
            end = parse_jibun_range_end(match.group(2), start)
            specs.append((part_has_mountain, start, end))
            consumed.append(match.span())

        without_ranges = range_pattern.sub(" ", part)
        for token in re.findall(r"\d+(?:-\d+)?", without_ranges):
            item = parse_jibun_token(token)
            specs.append((part_has_mountain, item, item))
    return specs


def build_tongban_index(tongban_rows: List[Dict[str, str]]) -> Dict[str, List[Dict[str, object]]]:
    """법정동/리명 -> 통리반 후보와 지번 범위 인덱스."""
    index: Dict[str, List[Dict[str, object]]] = defaultdict(list)
    for i, row in enumerate(tongban_rows):
        area = clean_text(row.get("관할구역"))
        # 101동, 102동처럼 건물 동번호는 법정동/리 인덱스에서 제외한다.
        tokens = [t for t in set(re.findall(r"[가-힣0-9]+(?:동|리)", area)) if not re.match(r"^\d", t)]
        for token in tokens:
            specs = extract_jibun_specs(area, token)
            if specs:
                index[token].append({"row_index": i, "specs": specs})
    return index


def target_matches_specs(main_no: int, sub_no: Optional[int], is_mountain: bool, specs: Iterable[Tuple[bool, Dict[str, Optional[int]], Dict[str, Optional[int]]]]) -> bool:
    target = {"main": int(main_no), "sub": int(sub_no) if sub_no is not None else None}
    for spec_mountain, start, end in specs:
        if bool(spec_mountain) != bool(is_mountain):
            continue
        if is_jibun_in_range(target, start, end):
            return True
    return False

def main() -> None:
    parser = argparse.ArgumentParser(description="tongban.csv 검색키 자동 생성")
    parser.add_argument("--tongban", default="source_data/tongban.csv")
    parser.add_argument("--roads", default="source_data/road_osan_hwaseong.csv")
    parser.add_argument("--output", default="source_data/tongban_with_search_keys.csv")
    parser.add_argument("--report", default="source_data/tongban_search_key_report.csv")
    parser.add_argument("--encoding", default="cp949", help="출력 CSV 인코딩, 기본 cp949")
    parser.add_argument("--include-road-addresses", action="store_true", help="검색키에 도로명주소도 자동 추가합니다. 행이 매우 길어질 수 있어 기본값은 꺼져 있습니다.")
    parser.add_argument("--include-jibun-addresses", action="store_true", help="검색키에 지번주소도 자동 추가합니다. 지번은 기존 관할구역에 이미 있으므로 기본값은 꺼져 있습니다.")
    args = parser.parse_args()

    tongban_path = Path(args.tongban)
    road_path = Path(args.roads)
    out_path = Path(args.output)
    report_path = Path(args.report)

    tongban_rows, tongban_enc = read_csv_auto(tongban_path)
    road_rows, _road_enc = read_csv_auto(road_path, delimiter="|")

    original_fields = list(tongban_rows[0].keys()) if tongban_rows else ["시군", "읍면동", "통리", "반", "관할구역"]
    key_col = "검색키"
    count_col = "자동검색키수"
    if key_col not in original_fields:
        original_fields.append(key_col)
    if count_col not in original_fields:
        original_fields.append(count_col)

    search_keys: List[List[str]] = [split_existing_keys(row.get(key_col, "")) for row in tongban_rows]
    search_key_sets = [{normalize_key(item) for item in keys} for keys in search_keys]
    matched_road_count = [0 for _ in tongban_rows]
    index = build_tongban_index(tongban_rows)
    report_rows: List[Dict[str, object]] = []

    for road in road_rows:
        sigun = clean_text(road.get("시군구명"))
        if "화성" not in sigun and "오산" not in sigun:
            continue

        parts = make_jibun_parts(road)
        if not parts:
            continue
        road_addr = make_road_addr(road)
        building = clean_text(road.get("시군구용건물명"))
        legal_area = str(parts["legal_area"])
        candidate_indexes = index.get(legal_area, [])
        if not candidate_indexes:
            continue

        matched_indexes: List[int] = []
        for candidate in candidate_indexes:
            i = int(candidate["row_index"])
            if target_matches_specs(int(parts["main"]), parts["sub"], bool(parts["is_mountain"]), candidate["specs"]):
                matched_indexes.append(i)

        if not matched_indexes:
            continue

        # 한 지번이 여러 통반에 걸리는 경우가 있으면 자동 검색키는 넣되 보고서에 표시한다.
        match_status = "지번매칭" if len(matched_indexes) == 1 else "지번복수매칭"
        for i in matched_indexes:
            keys = search_keys[i]
            before = len(keys)
            seen = search_key_sets[i]
            if args.include_jibun_addresses:
                add_unique(keys, parts["jibun"], seen=seen)
                add_unique(keys, parts["jibun_with_sigun"], seen=seen)
            if args.include_road_addresses and road_addr:
                add_unique(keys, road_addr, seen=seen)
                # 시군명 없는 도로명도 허용
                road_without_sigun = road_addr.replace(f"{sigun} ", "", 1) if sigun else road_addr
                add_unique(keys, road_without_sigun, seen=seen)
            if is_useful_building_name(building):
                add_unique(keys, building, seen=seen)
            matched_road_count[i] += 1
            after = len(keys)
            report_rows.append({
                "상태": match_status,
                "시군": tongban_rows[i].get("시군", ""),
                "읍면동": tongban_rows[i].get("읍면동", ""),
                "통리": tongban_rows[i].get("통리", ""),
                "반": tongban_rows[i].get("반", ""),
                "관할구역": tongban_rows[i].get("관할구역", ""),
                "도로명주소": road_addr,
                "지번주소": parts["jibun_with_sigun"],
                "건물명": building,
                "추가검색키수": after - before,
            })

    output_rows: List[Dict[str, object]] = []
    for i, row in enumerate(tongban_rows):
        out = dict(row)
        out[key_col] = "; ".join(search_keys[i])
        out[count_col] = matched_road_count[i]
        output_rows.append(out)

    write_csv(out_path, output_rows, original_fields, encoding=args.encoding)
    report_fields = ["상태", "시군", "읍면동", "통리", "반", "관할구역", "도로명주소", "지번주소", "건물명", "추가검색키수"]
    write_csv(report_path, report_rows, report_fields, encoding=args.encoding)

    rows_with_keys = sum(1 for keys in search_keys if keys)
    total_keys = sum(len(keys) for keys in search_keys)
    print(f"tongban input: {len(tongban_rows):,} rows ({tongban_enc})")
    print(f"road input: {len(road_rows):,} rows")
    print(f"rows with search keys: {rows_with_keys:,}")
    print(f"total search keys: {total_keys:,}")
    print(f"output: {out_path}")
    print(f"report: {report_path}")


if __name__ == "__main__":
    main()

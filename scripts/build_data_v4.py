#!/usr/bin/env python3
"""Build v4 JSON files.

가장 안전한 전환용 빌더입니다.
1) 기존 public/data/core.json 안의 searchKeys를 public/data/search_index.json으로 분리합니다.
2) core.json은 searchKeys를 제거한 가벼운 구조로 다시 저장합니다.
3) roads.json, suggestions.json은 그대로 유지합니다.

기존 v2/v3 빌드 흐름을 쓰는 경우:
    python scripts/generate_tongban_search_keys.py
    python scripts/build_data.py

이 v4 빌더는 위 과정으로 만들어진 core.json을 다시 최적화합니다.
"""
from __future__ import annotations
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'

def clean_text(value: object) -> str:
    s = str(value or '').strip()
    s = re.sub(r'\s+', ' ', s)
    for a,b in [('～','~'), ('?','~'), ('부터','~'), ('까지',''), ('번지','')]:
        s=s.replace(a,b)
    return s

def normalize(value: object) -> str:
    s=clean_text(value)
    s=re.sub(r'(?:이|e)\s*[-~]?\s*편한세상', 'e편한세상', s, flags=re.I)
    return re.sub(r'\s+','',s).replace('경기도','').lower()

def build():
    core_path=DATA/'core.json'
    if not core_path.exists():
        raise SystemExit('public/data/core.json이 없습니다. 먼저 기존 build_data.py를 실행해 주세요.')
    core=json.loads(core_path.read_text(encoding='utf-8'))
    index={}
    compact=[]
    for i,row in enumerate(core.get('tongban', [])):
        item={k:v for k,v in row.items() if k!='searchKeys'}
        item['id']=i
        compact.append(item)
        keys=list(row.get('searchKeys') or [])
        keys.append(' '.join(str(row.get(k,'') or '') for k in ['sigun','eup','tongri','ban','area']))
        for key in keys:
            nk=normalize(key)
            if len(nk)<2: continue
            index.setdefault(nk, set()).add(i)
    index={k: sorted(v) for k,v in index.items()}
    core['tongban']=compact
    core.setdefault('meta', {})['structureVersion']='v4'
    core['meta']['searchIndex']='search_index.json'
    core['meta']['note']='searchKeys are separated from core.json'
    core_path.write_text(json.dumps(core, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    (DATA/'search_index.json').write_text(json.dumps({'meta':{'structureVersion':'v4','keyCount':len(index)}, 'index': index}, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    print(f'core rows: {len(compact):,}')
    print(f'search index keys: {len(index):,}')
    print('output: public/data/core.json')
    print('output: public/data/search_index.json')
if __name__=='__main__': build()

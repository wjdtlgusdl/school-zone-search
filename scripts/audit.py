#!/usr/bin/env python3
"""도로명주소 품질 점검 도구(v4).

현재 public/data/core.json, roads.json, search_index.json을 기준으로 랜덤 주소를 점검하고
source_data/audit_result.csv를 생성합니다.
"""
from __future__ import annotations
import csv, json, random, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public'/'data'
OUT=ROOT/'source_data'/'audit_result.csv'
RESIDENTIAL_RE=re.compile(r'아파트|빌라|연립|주택|타운|맨션|하우스|빌|APT|apt|자이|푸르지오|힐스테이트|롯데캐슬|호반|우미|중흥|한신|신동아|대우|현대|삼성|대림|e편한|센트럴|파크|마을')

def norm(v):
    s=str(v or '').strip()
    s=re.sub(r'\s+',' ',s).replace('번지','').replace('경기도','')
    s=re.sub(r'(?:이|e)\s*[-~]?\s*편한세상','e편한세상',s,flags=re.I)
    return re.sub(r'\s+','',s).lower()

def candidates(row):
    vals=[row.get('r',''), row.get('j',''), row.get('b','')]
    return [norm(v) for v in vals if norm(v)]

def school_matches(core, tb):
    eup=norm(tb.get('eup','')); tong=norm(tb.get('tongri','')); ban=norm(tb.get('ban',''))
    out=[]
    for s in core.get('schools',[]):
        if norm(s.get('eupKey') or s.get('eup')) != eup: continue
        if norm(s.get('tongriKey') or s.get('tongri')) != tong: continue
        sb=norm(s.get('ban',''))
        if sb==ban or sb=='': out.append(s.get('school',''))
    return sorted(set([x for x in out if x]))

def main(n_each=100, residential=True):
    core=json.loads((DATA/'core.json').read_text(encoding='utf-8'))
    roads=json.loads((DATA/'roads.json').read_text(encoding='utf-8')).get('roads',[])
    index=json.loads((DATA/'search_index.json').read_text(encoding='utf-8')).get('index',{})
    rows=[]
    for city in ['화성시','오산시']:
        pool=[r for r in roads if str(r.get('r','')).startswith(city)]
        if residential:
            pool=[r for r in pool if RESIDENTIAL_RE.search((r.get('b') or '')+' '+(r.get('r') or ''))]
        sample=random.sample(pool, min(n_each, len(pool)))
        for r in sample:
            ids=set()
            for c in candidates(r):
                for i in index.get(c,[]): ids.add(int(i))
            tbs=[core['tongban'][i] for i in ids if i < len(core['tongban'])]
            schools=[]
            for tb in tbs: schools.extend(school_matches(core,tb))
            status='정상' if schools else ('학교 미조회' if tbs else '통리반 미조회')
            rows.append({
                'city':city,'status':status,'road':r.get('r',''),'jibun':r.get('j',''),'building':r.get('b',''),
                'tongban':' / '.join(sorted(set([f"{x.get('eup','')} {x.get('tongri','')} {x.get('ban','')}" for x in tbs]))),
                'schools':' / '.join(sorted(set(schools)))
            })
    OUT.parent.mkdir(exist_ok=True)
    with OUT.open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f, fieldnames=['city','status','road','jibun','building','tongban','schools'])
        w.writeheader(); w.writerows(rows)
    from collections import Counter
    print(Counter(r['status'] for r in rows))
    print(f'output: {OUT}')
if __name__=='__main__': main()

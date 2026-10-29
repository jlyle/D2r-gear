# Regenerates the zone data at the top of terrorzones.js from the retail game tables.
# Usage: python3 tools/gen_terrorzones.py <dir with hd/global/excel/desecratedzones.json, global/excel/{levels,monstats}.txt, local/lng/strings/{levels,monsters}.json>
# Prints the zone list as JSON; titles/aliases for the app are kept by hand in terrorzones.js.
import csv, json, re, sys
root = sys.argv[1]
t = open(root + '/hd/global/excel/desecratedzones.json', encoding='utf-8-sig').read()
t = re.sub(r'("seed"\s*:\s*)(\d+)', r'\1"\2"', t)
cfg = json.loads(t)['desecrated_zones'][0]
L = {r['Id']: r for r in csv.DictReader(open(root + '/global/excel/levels.txt', encoding='latin-1'), delimiter='\t') if r['Id']}
M = {r['Id']: r for r in csv.DictReader(open(root + '/global/excel/monstats.txt', encoding='latin-1'), delimiter='\t') if r['Id']}
LS = {e['Key']: e['enUS'] for e in json.load(open(root + '/local/lng/strings/levels.json', encoding='utf-8-sig'))}
MS = {e['Key']: e['enUS'] for e in json.load(open(root + '/local/lng/strings/monsters.json', encoding='utf-8-sig'))}
EL = [('f', 'ResFi(H)'), ('c', 'ResCo(H)'), ('l', 'ResLi(H)'), ('p', 'ResPo(H)'), ('d', 'ResDm(H)'), ('m', 'ResMa(H)')]
out = []
for z in cfg['zones']:
    areas, mons = [], {}
    for lv in z['levels']:
        r = L[str(lv['level_id'])]
        areas.append(LS.get(r['LevelName'], r['LevelName']))
        for i in range(1, 26):
            mid = r.get(f'nmon{i}', '')
            if not mid or mid not in M: continue
            m = M[mid]
            if m['killable'] != '1' or m['npc'] == '1' or m['enabled'] != '1': continue
            name = MS.get(m['NameStr'], m['NameStr'])
            res = {}
            for k, col in EL:
                v = int(m[col] or 0)
                if v >= 100: res[k] = v
            prev = mons.get(name)
            # same display name from two monstats rows: keep the union of immunities (worst case)
            if prev is not None:
                for k, v in res.items(): prev[k] = max(prev.get(k, 0), v)
            else:
                mons[name] = res
    out.append({'id': z['id'], 'act': int(z['id'][3]), 'areas': areas,
                'mons': [[n, ''.join(f'{k}{v}' for k, v in sorted(r.items()))] for n, r in sorted(mons.items())]})
print(json.dumps({'start': cfg['start_time_utc'], 'seed': cfg['seed'], 'mins': cfg['zone_duration_minutes'], 'brk': cfg['break_duration_minutes'], 'zones': out}, ensure_ascii=False, indent=1))

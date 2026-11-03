#!/usr/bin/env python3
"""Reproducible source-cell audit, optional analysis dependencies (see requirements-isfahan-review.txt).

Pinned raster inputs only. Template labels come from explicit visual source reads, never from
uploaded later rows or terminal-plus-offset calculations. Ambiguous glyphs abstain; a separate
manual evidence file resolves them. No network access, canonical writes or ETA approval.
"""
from PIL import Image
from scipy.ndimage import label, find_objects
import numpy as np, json, csv, math
from pathlib import Path
import argparse, hashlib
ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description="Review-only pixel comparison; never enables ETAs or fetches/rehosts operator images.")
parser.add_argument("--source-dir", type=Path, required=True, help="Local directory containing unmodified weekday.jpg and friday.jpg")
parser.add_argument("--input", type=Path, required=True, help="Original uploaded stop_times.csv")
args = parser.parse_args()
BASE = args.source_dir
OUTPUT = ROOT / ".quality-report"
OUTPUT.mkdir(exist_ok=True)
read_json = lambda name: json.loads((ROOT / "sources/isfahan" / name).read_text())
intake = read_json("timetable-candidate-review-2026-10-31.json")
manual_review = read_json("timetable-cell-review.json")
corrections = read_json("timetable-reviewed-corrections.json")
for ref in intake["operatorReference"]["images"]:
    assert hashlib.sha256((BASE / (ref["name"] + ".jpg")).read_bytes()).hexdigest() == ref["sha256"], "Changed source image"
input_hash = hashlib.sha256(args.input.read_bytes()).hexdigest()
assert input_hash == next(i["sha256"] for i in intake["uploadedInputs"] if i["fileName"] == "stop_times.csv"), "Changed input CSV"
assert manual_review["reviewOnly"] is True and manual_review["productionEtaApproved"] is False
assert manual_review["sourceImageSha256"] == intake["operatorReference"]["images"][0]["sha256"]
# Manually read from the first source row; never labels derived from later CSV rows.
FIRST={'weekday':{'qods_to_defa':['06:00','06:03','06:05','06:07','06:09','06:11','06:13','06:15','06:17','06:19','06:21','06:23','06:25','06:27','06:29','06:31','06:33','06:35','06:37','06:39'], 'defa_to_qods':['06:39','06:36','06:34','06:32','06:30','06:28','06:26','06:24','06:22','06:20','06:18','06:16','06:14','06:12','06:10','06:08','06:06','06:04','06:02','06:00']},'friday':{'qods_to_defa':['09:00',None,None,'09:07','09:09','09:11','09:13','09:15','09:17','09:19','09:21','09:23','09:25','09:27','09:29','09:31',None,None,'09:37','09:39'],'defa_to_qods':['09:39',None,None,'09:32','09:30','09:28','09:26','09:24','09:22','09:20','09:18','09:16','09:14','09:12','09:10','09:08',None,None,'09:02','09:00']}}
COLS={'weekday':{'defa_to_qods':[109,156,201,247,292,338,383,429,474,520,565,611,656,702,747,793,838,884,929,975,1021],'qods_to_defa':[1061,1106,1152,1197,1243,1288,1334,1379,1425,1470,1516,1561,1607,1652,1698,1743,1789,1834,1880,1926,1971]},'friday':{'defa_to_qods':[177,254,330,406,481,557,632,708,783,859,934,1010,1085,1161,1236,1312,1387,1463,1539,1614,1690],'qods_to_defa':[1753,1828,1904,1980,2055,2130,2206,2281,2357,2432,2508,2583,2659,2734,2810,2885,2961,3036,3112,3188,3271]}}
def components(arr):
 labs,n=label(arr);parts=[]
 for box in find_objects(labs):
  y,x=box;part=arr[y,x]
  if part.sum()<2:continue
  parts.append([x.start,x.stop,y.start,y.stop,part.copy()])
 # Join only the vertically aligned colon dots; adjacent glyph bboxes may overlap.
 used=set();groups=[]
 for i,p in enumerate(parts):
  if i in used:continue
  match=None
  for j,q in enumerate(parts):
   if j<=i or j in used:continue
   if abs((p[0]+p[1])/2-(q[0]+q[1])/2)>.65:continue
   if p[1]-p[0]>max(3,arr.shape[0]*.15) or q[1]-q[0]>max(3,arr.shape[0]*.15):continue
   if not (p[3]<=q[2] or q[3]<=p[2]):continue
   match=j;break
  if match is None:groups.append(p)
  else:
   q=parts[match];used.add(match)
   x0=min(p[0],q[0]);x1=max(p[1],q[1]);y0=min(p[2],q[2]);y1=max(p[3],q[3]);groups.append([x0,x1,y0,y1,arr[y0:y1,x0:x1].copy()])
 groups.sort(key=lambda p:(p[0]+p[1])/2)
 return groups

def features(parts):
 maxh=max(p[3]-p[2] for p in parts);out=[]
 for p in parts:
  a=p[4];im=Image.fromarray((a*255).astype('uint8')).resize((24,32),Image.Resampling.NEAREST)
  out.append((np.asarray(im)>128,(p[1]-p[0])/(p[3]-p[2]),(p[3]-p[2])/maxh))
 return out

def dist(a,b):
 return np.logical_xor(a[0],b[0]).mean()+.18*abs(a[1]-b[1])+.18*abs(a[2]-b[2])

results=[]; allmodels={}
for name in ['weekday','friday']:
 rgb=np.asarray(Image.open(BASE/(name+'.jpg')).convert('RGB'));gray=np.asarray(Image.open(BASE/(name+'.jpg')).convert('L'));h,w=gray.shape
 black=rgb.max(2)<110;score=black[:,int(w*.05):int(w*.95)].mean(1)
 if name=='weekday':
  raw=np.where((score>.7)&(np.arange(h)>650)&(np.arange(h)<=3012))[0];bounds=[634]
 else:raw=np.where((score>.7)&(np.arange(h)>=1171)&(np.arange(h)<=4432))[0];bounds=[]
 grouped=[]
 for y in raw:
  if not grouped or y>grouped[-1][-1]+1:grouped.append([int(y)])
  else:grouped[-1].append(int(y))
 bounds += [round(sum(g)/len(g)) for g in grouped]
 assert len(bounds)==(92 if name=='weekday' else 54),(name,len(bounds))
 def cell(row,direction,ord):
  col=20-ord;xs=COLS[name][direction];box=(xs[col]+2,bounds[row-1]+2,xs[col+1]-2,bounds[row]-2)
  x0,y0,x1,y1=box;arr=gray[y0:y1,x0:x1]<140
  return components(arr),box,arr
 models={str(k):[] for k in range(10)}|{':':[]};merged={};seed_errors=[]
 seeds=[]
 for direction in ['qods_to_defa','defa_to_qods']:
  for ordinal,expected in enumerate(FIRST[name][direction],1):
   if expected is not None:seeds.append((1,direction,ordinal,expected))
 if name=='weekday':
  second={
   'qods_to_defa':['06:15','06:18','06:20','06:22','06:24','06:26','06:28','06:30','06:32','06:34','06:36','06:38','06:40','06:42','06:44','06:46','06:48','06:50','06:52','06:54'],
   'defa_to_qods':['06:54','06:51','06:49','06:47','06:45','06:43','06:41','06:39','06:37','06:35','06:33','06:31','06:29','06:27','06:25','06:23','06:21','06:19','06:17','06:15']}
  for d,times in second.items():seeds += [(2,d,i+1,t) for i,t in enumerate(times)]
  seeds += [(12,'defa_to_qods',12,'07:48'),(18,'defa_to_qods',2,'09:14')]
 seed_samples=[]
 for row,d,ordinal,expected in seeds:
  parts,b,arr=cell(row,d,ordinal);fs=features(parts);seed_samples.append((expected,fs))
  if len(parts)==5:
   for char,f in zip(expected,fs):models[char].append(f)
 assert all(models.values())
 single=lambda f,c:min(dist(f,t) for t in models[c])
 for expected,fs in seed_samples:
  if len(fs)!=4:continue
  proposals=[]
  for merge_at in range(4):
   tokens=list(expected[:merge_at])+[expected[merge_at:merge_at+2]]+list(expected[merge_at+2:])
   score=sum(single(f,c) for f,c in zip(fs,tokens) if len(c)==1)
   proposals.append((score,merge_at,tokens))
  score,merge_at,tokens=min(proposals)
  merged.setdefault(tokens[merge_at],[]).append(fs[merge_at])
 print(name,'manually labelled cells',len(seeds),'merged templates', {k:len(v) for k,v in merged.items()})
 def parse_parts(fs):
  singles=[{c:single(f,c) for c in models} for f in fs]
  ranked_singles=[sorted((score,c) for c,score in table.items() if c!=":") for table in singles]
  merged_scores=[{token:min(dist(f,t) for t in ts) for token,ts in merged.items()} for f in fs]
  hypotheses=[]
  if len(fs)==5:
   tokens=[];scores=[];margins=[]
   for i,f in enumerate(fs):
    if i==2:tokens.append(':');scores.append(singles[i][':']);continue
    ranked=ranked_singles[i];tokens.append(ranked[0][1]);scores.append(ranked[0][0]);margins.append(ranked[1][0]-ranked[0][0])
   hypotheses.append((sum(scores),''.join(tokens),max(scores),min(margins)))
  if len(fs)==4:
   for pos in range(4):
    for token,templates in merged.items():
     full=[];scores=[];margins=[];cursor=0
     for i,f in enumerate(fs):
      if i==pos:
       if len(token)!=2 or any((c==':')!=(cursor+j==2) for j,c in enumerate(token)):break
       full.append(token);scores.append(merged_scores[i][token]);cursor+=2
      else:
       if cursor==2:full.append(':');scores.append(singles[i][':']);cursor+=1;continue
       ranked=ranked_singles[i];full.append(ranked[0][1]);scores.append(ranked[0][0]);margins.append(ranked[1][0]-ranked[0][0]);cursor+=1
     else:hypotheses.append((sum(scores),''.join(full),max(scores),min(margins)))
  valid=[]
  for score,word,worst,margin in hypotheses:
   if len(word)==5 and word[2]==':' and word[:2].isdigit() and word[3:].isdigit() and 0<=int(word[:2])<=23 and 0<=int(word[3:])<60:valid.append((score,word,worst,margin))
  valid.sort()
  if not valid:return None
  best=valid[0];alternatives=[r for r in valid[1:] if r[1]!=best[1]]
  wordmargin=alternatives[0][0]-best[0] if alternatives else 1
  return best,wordmargin
 for row in range(1,len(bounds)):
  for direction in ['qods_to_defa','defa_to_qods']:
   if name=='weekday' and ((direction=='qods_to_defa' and row in [43,45]) or (direction=='defa_to_qods' and row in [5,7,9])):continue
   for ord in range(1,21):
    parts,box,arr=cell(row,direction,ord)
    if name=='friday' and ord in [2,3,17,18]:
     assert arr.mean()>.95
     results.append({'poster':name,'sourceDataRow':row,'direction':direction,'stationOrdinal':ord,'bbox':box,'status':'black_source_cell','decoded':None});continue
    rec={'poster':name,'sourceDataRow':row,'direction':direction,'stationOrdinal':ord,'bbox':box,'status':'unreadable','decoded':None,'componentCount':len(parts)}
    prediction=parse_parts(features(parts)) if parts else None
    if prediction:
     (score,word,worst,margin),wordmargin=prediction
     rec.update({'decoded':word,'maxGlyphDistance':round(float(worst),4),'minimumGlyphMargin':round(float(margin),4),'wordMargin':round(float(wordmargin),4)})
     if worst<=.28 and margin>=.025 and wordmargin>=.03:rec['status']='source_cell_decoded'
    results.append(rec)

print('all source cells',len(results),'readable',sum(r['status']=='source_cell_decoded' for r in results),'black',sum(r['status']=='black_source_cell' for r in results))
with args.input.open(encoding='utf-8-sig',newline='') as f:inputs=list(csv.DictReader(f))
lookup={(('weekday' if r['service_id']=='saturday_thursday' else 'friday'),int(r['source_row_index'])-(3 if r['service_id']=='friday' else 0),r['direction'],int(r['station_id'].split('_')[-1])):r for r in inputs}

key_for = lambda r: (r['poster'], r['sourceDataRow'], r['direction'], r['stationOrdinal'])
manual = {key_for(c): c for c in manual_review['cells']}
identities = {s['ordinalQodsToDefa']: s['stationId'] for s in intake['stationIdCrosswalk']}
seen = set()
counts = {'sourceCells': len(results), 'uploadedTimes': len(inputs), 'machineMatches': 0,
          'manualUploadedMatches': 0, 'addedFridayManualMatches': 0, 'blackCells': 0,
          'decoderDisagreementsResolvedByManualRead': 0, 'decoderAbstentionsResolvedByManualRead': 0,
          'remainingTimeDifferences': 0, 'remainingUnreadableTimes': 0}
added = {(t['direction'], c['stationId']): c for t in corrections['addedTrips'] for c in t['cells']}
for r in results:
    r['stationId'] = identities[r['stationOrdinal']]
    key = key_for(r)
    original = lookup.get(key)
    if r['status'] == 'black_source_cell':
        assert original is None, 'Invented time in black source cell'
        r.update(sourceCellValue=None, verification='black_visible_meaning_provisional')
        counts['blackCells'] += 1
        continue
    if original:
        seen.add(key)
        r.update(uploadedTime=original['departure_time'], uploadedTripId=original['trip_id'])
        if key in manual:
            c = manual.pop(key)
            assert c['bbox'] == list(r['bbox']) and c['stationId'] == r['stationId'] and c['verification'] == 'manual_source_cell'
            r.update(sourceCellValue=c['sourceCellValue'], verification='manual_source_cell')
            if r['status'] == 'source_cell_decoded' and r['decoded'] != original['departure_time']:
                counts['decoderDisagreementsResolvedByManualRead'] += 1
            elif r['status'] != 'source_cell_decoded':
                counts['decoderAbstentionsResolvedByManualRead'] += 1
            if r['sourceCellValue'] == original['departure_time']: counts['manualUploadedMatches'] += 1
        else:
            r.update(sourceCellValue=r['decoded'], verification='machine_direct_source_cell_agreement' if r['status'] == 'source_cell_decoded' else 'unreadable')
            if r['status'] == 'source_cell_decoded' and r['decoded'] == original['departure_time']: counts['machineMatches'] += 1
        if r['verification'] == 'unreadable': counts['remainingUnreadableTimes'] += 1
        elif r['sourceCellValue'] != original['departure_time']: counts['remainingTimeDifferences'] += 1
    else:
        assert r['poster'] == 'friday' and r['sourceDataRow'] == 53, 'Unaccounted printed source row'
        c = added[(r['direction'], r['stationId'])]
        assert r['status'] == 'source_cell_decoded' and r['decoded'] == c['sourceCellValue'] and list(r['bbox']) == c['imageBbox']
        r.update(sourceCellValue=c['sourceCellValue'], verification='manual_source_cell')
        counts['addedFridayManualMatches'] += 1
assert len(seen) == len(inputs) and not manual, 'Incomplete input/manual review coverage'
assert counts == {'sourceCells':5660,'uploadedTimes':5204,'machineMatches':5121,'manualUploadedMatches':83,
                  'addedFridayManualMatches':32,'blackCells':424,'decoderDisagreementsResolvedByManualRead':30,
                  'decoderAbstentionsResolvedByManualRead':53,'remainingTimeDifferences':0,'remainingUnreadableTimes':0}, counts
report = {'schemaVersion':1,'cityId':'isfahan','reviewOnly':True,'productionEtaApproved':False,
          'method':'Independent raster glyph templates from manually read source cells; uploaded clocks joined only after decoding; every disagreement/abstention visually read separately.',
          'counts':counts,'inputSha256':input_hash,'sourceImageHashes':[i['sha256'] for i in intake['operatorReference']['images']], 'cells':results}
encoded = (json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode()
(OUTPUT/'isfahan-source-cell-audit.json').write_bytes(encoded)
summary = {k:v for k,v in report.items() if k!='cells'}
summary.update(reportSha256=hashlib.sha256(encoded).hexdigest(),
               manualReviewSha256=hashlib.sha256((ROOT/'sources/isfahan/timetable-cell-review.json').read_bytes()).hexdigest(),
               scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               limitations=['Machine agreement is not a second manual review or operator confirmation.',
                            'One visual reviewer resolved 83 decoder exceptions and read 32 added Friday times.',
                            'All timings remain review-only; holiday and Friday boarding uncertainty is not resolved by pixel agreement.'])
(OUTPUT/'isfahan-source-cell-audit-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(counts))

#!/usr/bin/env python3
"""Read the day's driver list + pick sheet PDFs from inbox/ and write tools/day.json.
Usage: python3 tools/ingest.py inbox/*.pdf"""
import re,json,sys,subprocess,base64,os,glob,tempfile,datetime
from PIL import Image,ImageOps
MON={m:i+1 for i,m in enumerate('JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split())}
def text(p): return subprocess.run(['pdftotext','-layout',p,'-'],capture_output=True,text=True,check=True).stdout
out={"drivers":None,"pick":None,"errors":[]}
for p in sys.argv[1:]:
    t=text(p)
    if 'Prestage' in t[:300]:
        m=re.search(r'Prestage\s+\w+,\s+(\w+)\s+(\d+),\s+(\d{4})(?:\s+(WK\s*\d+))?',t)
        d=datetime.date(int(m.group(3)),MON[m.group(1)[:3].upper()],int(m.group(2)))
        rows=[]
        for l in t.split('\n')[2:]:
            r=re.match(r'\s{0,4}(\d)?\s+(\S.*?\S)\s{2,}(\d+)\s+(\w+)\s+(STG\.\S+)?\s+(CX \d+|[A-Z]{1,3} ?\d+|R\d)\s+(.+?)(?:\s{3,}|$)',l)
            if r: rows.append([r.group(1) or '',r.group(2),r.group(3),r.group(4),r.group(5) or '',re.sub(r'^([A-Z]+)\s*(\d+)$',r'\1 \2',r.group(6)) if not r.group(6).startswith('R') else r.group(6),r.group(7).strip()])
        lbl=d.strftime('%A, %B ')+str(d.day)+d.strftime(', %Y')+(' · '+m.group(4) if m.group(4) else '')
        out["drivers"]={"date":d.isoformat(),"label":lbl,"rows":rows}
    elif 'Total Packages' in t:
        R={};date=None
        for b in re.split(r'\n?\f?(?=STG\.)',t):
            if not b.strip().startswith('STG'):continue
            L=b.split('\n');stg=L[0].strip()
            m=re.search(r'^([A-Z]+\d+)\s+DBEL · (.*?)\s*$',L[1].strip())
            if not m: out["errors"].append('unreadable block '+stg);continue
            route=re.sub(r'^([A-Z]+)(\d+)$',r'\1 \2',m.group(1));kind=m.group(2)
            dm=re.search(r'(\w{3}) (\d+), (\d{4})',L[2]);date=date or datetime.date(int(dm.group(3)),MON[dm.group(1)],int(dm.group(2)))
            bags=[];of=[];tot=comm=None
            for l in L[3:]:
                x=re.match(r'\s*(\d+)\s+(?:([A-Z]-[\dA-Z.]+))?\s+([A-Z][a-z]+ \d+)\s+(\d+)',l)
                rest=l
                if x: bags.append([x.group(2) or '',x.group(3),int(x.group(4))]);rest=l[x.end():]
                y=re.match(r'\s+(\d+)\s+([A-Z]-[\dA-Z.]+)\s+(\d+)\s*$',rest)
                if y: of.append([y.group(2),int(y.group(3))])
                z=re.search(r'Total Packages\s+(\d+)',l); tot=int(z.group(1)) if z else tot
                z=re.search(r'Commercial Packages\s+(\d+)',l); comm=int(z.group(1)) if z else comm
            if tot is None or sum(v[2] for v in bags)+sum(v[1] for v in of)!=tot:
                out["errors"].append(f'{route}: bags+overflow != total ({tot})')
            R[route]={"b":bags,"o":of,"k":kind,"t":tot,"c":comm or 0,"stg":stg}
        # pick-list pictures, one page per route
        tmp=tempfile.mkdtemp();subprocess.run(['pdftoppm','-r','90','-jpeg','-gray',p,tmp+'/p'],check=True)
        imgs=sorted(glob.glob(tmp+'/p-*.jpg'));pages=t.split('\f');pics={}
        for i,pg in enumerate(pages):
            s=pg.strip().split('\n')
            m=re.match(r'([A-Z]+\d+)\s',s[1].strip()) if len(s)>1 else None
            if not m or i>=len(imgs):continue
            rt=re.sub(r'^([A-Z]+)(\d+)$',r'\1 \2',m.group(1));im=Image.open(imgs[i])
            bb=ImageOps.invert(im.convert('L')).point(lambda v:255 if v>40 else 0).getbbox()
            if bb: im=im.crop((max(bb[0]-15,0),max(bb[1]-15,0),bb[2]+15,bb[3]+15))
            f=os.path.join(tmp,'c%d.jpg'%i);im.save(f,quality=60);pics[rt]=base64.b64encode(open(f,'rb').read()).decode()
        out["pick"]={"date":date.isoformat(),"routes":R,"pics":pics}
    else: out["errors"].append('not recognized: '+os.path.basename(p))
D,P=out["drivers"],out["pick"]
if D and P:
    if D["date"]!=P["date"]: out["errors"].append(f'dates differ: driver list {D["date"]}, pick sheet {P["date"]}')
    dr={r[5] for r in D["rows"]}
    miss=[k for k in P["routes"] if k not in dr]; nop=[r[1]+' '+r[5] for r in D["rows"] if r[5] not in P["routes"] and not re.match(r'R\d$',r[5])]
    if miss: out["errors"].append('routes with no driver: '+', '.join(miss))
    if nop: out["errors"].append('drivers with no pick page: '+', '.join(nop))
json.dump(out,open(os.path.join(os.path.dirname(__file__),'day.json'),'w'))
print('drivers:',D and (D["date"],len(D["rows"])),'pick:',P and (P["date"],len(P["routes"])),'errors:',out["errors"])

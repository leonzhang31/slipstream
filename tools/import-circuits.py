"""Import MIT-licensed original centerlines, then generate playable GP drift editions."""
import json, math, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base='https://raw.githubusercontent.com/bacinger/f1-circuits/master/'
specs=[('monza','it-1922','Monza','#243126','#c65b52'),('spa','be-1925','Spa-Francorchamps','#21312b','#d0a85c'),('silverstone','gb-1948','Silverstone','#29312d','#b16f76'),('interlagos','br-1940','Interlagos','#263228','#d9c15b')]
tracks=[]
for id,file,name,ground,curb in specs:
 raw=subprocess.check_output(['curl','--fail','--silent','--show-error','--location',base+'circuits/'+file+'.geojson'])
 source=json.loads(raw)['features'][0]
 coords=source['geometry']['coordinates']
 if coords[0][:2]==coords[-1][:2]:coords=coords[:-1]
 lon0,lat0=coords[0][:2]
 xy=[[(p[0]-lon0)*111320*math.cos(math.radians(lat0)),-(p[1]-lat0)*111320] for p in coords]
 length=sum(math.dist(a,b) for a,b in zip(xy,xy[1:]+xy[:1]))
 metres=source['properties']['length'];factor=metres*6/length
 minx=min(p[0] for p in xy);miny=min(p[1] for p in xy)
 nodes=[[round((x-minx)*factor+400,2),round((y-miny)*factor+400,2)] for x,y in xy]
 tracks.append(dict(id=id,name=name,subtitle=f'Grand Prix · {metres/1000:.3f} km',kind='gp',theme='park',width=100,ground=ground,curb=curb,metres=metres,polyline=True,nodes=nodes,buildings=[],source=base+'circuits/'+file+'.geojson'))
 print(name,metres,'m',len(nodes),'source points')
(root/'dist/data/circuits.js').write_text('// Circuit centerlines: Tomislav Bacinger, MIT. See licenses/f1-circuits-LICENSE.txt.\nwindow.SLIPSTREAM_CIRCUITS='+json.dumps(tracks,separators=(',',':'))+';\n')
license=subprocess.check_output(['curl','--fail','--silent','--show-error','--location',base+'LICENSE.md']).decode()
(root/'dist/licenses/f1-circuits-LICENSE.txt').write_text(license)

subprocess.run([sys.executable, str(root / 'tools/make-drift-layouts.py')], check=True)

"""Local labelling tool.

Run: python eval/annotate.py [--cams 6215,6371] [--per-camera 8] [--share]
Then open http://localhost:8765

For each camera it takes the first N images (default 8, by capture time) and walks through
EVERY planogram area of each image, in planogram order. Labels go to eval/labels.json in the
same format as the hidden annotations.json, so this works directly:
    python eval/score.py outputs/predictions.json eval/labels.json
--share lets teammates on the same Wi-Fi use it; use --cams to split cameras between people.
Keyboard: 1=empty 2=half 3=full, Y=right product, N=wrong product, Enter=save and next, Backspace=back.
"""
import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from crops import IMAGES, ROOT, corners, load_planogram, warp_area  # noqa: E402

LABELS = ROOT / "eval" / "labels.json"
ap = argparse.ArgumentParser()
ap.add_argument("--cams", default="", help="comma separated camera ids (default: all)")
ap.add_argument("--per-camera", type=int, default=8)
ap.add_argument("--share", action="store_true")
ARGS = ap.parse_args()

CAMS = load_planogram()
WANTED = [c for c in ARGS.cams.split(",") if c] or list(CAMS)
FILES = {c: sorted(p.name for p in (IMAGES / c).glob("*.jpg")) for c in WANTED}
PAIRS = [(c, img, a["area_id"])
         for c in WANTED
         for img in FILES[c][:ARGS.per_camera]
         for a in CAMS[c]["products"]]
labels = json.loads(LABELS.read_text()) if LABELS.exists() else {}

PAGE = """<!doctype html><meta charset=utf-8><title>Annotate</title>
<style>body{font:16px system-ui;margin:20px;background:#111;color:#eee}img{max-width:48%;border:2px solid #444}
button{font-size:18px;padding:10px 18px;margin:4px;border-radius:8px;border:0;cursor:pointer}
.sel{outline:3px solid #4ade80}#prod{font-size:22px;margin:8px 0}
#legend{color:#aaa;margin:6px 0 10px;max-width:900px}
.pk{background:#7c3aed;border-radius:6px;padding:2px 8px;font-size:15px;margin-left:8px}</style>
<div id=prog></div><div id=prod></div>
<div id=legend>Empty = one or two units left (time to restock). Half = anything in between.
Full = completely full; if a single unit is missing, it is half. Packaged products: one unit is one package.</div>
<img id=full><img id=crop><div>
<b>Stock:</b> <button data-s=0>1 empty</button><button data-s=0.5>2 half</button><button data-s=1>3 full</button><br>
<b>Right product?</b> <button data-c=true>Y yes</button><button data-c=false>N no</button><br>
<button id=back>Back</button><button id=next style="background:#4ade80">Save + next (Enter)</button></div>
<script>
let i=0,s=null,c=null,items=[];
const q=(x)=>document.querySelector(x);
async function load(){items=await (await fetch('/items')).json();i=items.findIndex(x=>!x.done);if(i<0)i=0;show()}
function show(){const it=items[i];s=it.stock;c=it.compliant;
 q('#prog').textContent=`${i+1}/${items.length}  (${items.filter(x=>x.done).length} done)  camera ${it.cam}, image ${it.n}, area ${it.area}`;
 q('#prod').innerHTML='Planogram expects: <b>'+it.product+'</b>'+(it.packaged?'<span class=pk>packaged</span>':'');
 q('#full').src=`/full?cam=${it.cam}&img=${it.img}&area=${it.area}`;q('#crop').src=`/crop?cam=${it.cam}&img=${it.img}&area=${it.area}`;mark()}
function mark(){document.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('sel',s!==null&&+b.dataset.s===s));
 document.querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('sel',c!==null&&(b.dataset.c==='true')===c))}
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{s=+b.dataset.s;mark()});
document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{c=b.dataset.c==='true';mark()});
async function save(){if(s===null||c===null){alert('Pick stock and product answer');return false}
 const it=items[i];await fetch('/save',{method:'POST',body:JSON.stringify({cam:it.cam,img:it.img,area:it.area,stock:s,compliant:c})});
 it.done=true;it.stock=s;it.compliant=c;return true}
q('#next').onclick=async()=>{if(await save()){i=Math.min(i+1,items.length-1);show()}};
q('#back').onclick=()=>{i=Math.max(i-1,0);show()};
onkeydown=e=>{if(e.key==='1')s=0;if(e.key==='2')s=0.5;if(e.key==='3')s=1;if(e.key==='y')c=true;if(e.key==='n')c=false;
 if(e.key==='Enter')q('#next').click();if(e.key==='Backspace')q('#back').click();mark()};
load()</script>"""


def jpg(img):
    return cv2.imencode(".jpg", img)[1].tobytes()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/":
            return self.send(PAGE.encode(), "text/html; charset=utf-8")
        if u.path == "/items":
            out = []
            for cam, img, area in PAIRS:
                a = next(x for x in CAMS[cam]["products"] if x["area_id"] == area)
                lab = labels.get(cam, {}).get(img, {}).get(area)
                name = a["product_name"]
                out.append({"cam": cam, "img": img, "area": area, "product": name,
                            "packaged": not name.rstrip().endswith("KG"),
                            "n": FILES[cam].index(img) + 1,
                            "done": lab is not None, "stock": lab and lab["stock_value"],
                            "compliant": lab and lab["planogram_compliant"]})
            return self.send(json.dumps(out).encode(), "application/json")
        a = next(x for x in CAMS[q["cam"]]["products"] if x["area_id"] == q["area"])
        img = cv2.imread(str(IMAGES / q["cam"] / q["img"]))
        if u.path == "/crop":
            return self.send(jpg(warp_area(img, a, 512, 320)), "image/jpeg")
        if u.path == "/full":
            cv2.polylines(img, [corners(a).astype(int)], True, (0, 255, 0), 3)
            return self.send(jpg(img), "image/jpeg")

    def do_POST(self):
        d = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        v = d["stock"]
        labels.setdefault(d["cam"], {}).setdefault(d["img"], {})[d["area"]] = {
            "planogram_compliant": d["compliant"],
            "stock_level": {0: "empty", 0.5: "half", 1: "full"}[v], "stock_value": v}
        LABELS.write_text(json.dumps(labels, indent=1), encoding="utf-8")
        self.send(b"ok", "text/plain")


if __name__ == "__main__":
    if ARGS.share:
        import socket
        ip = socket.gethostbyname(socket.gethostname())
        print(f"{len(PAIRS)} areas. Send this to your teammate (same Wi-Fi): http://{ip}:8765")
    else:
        print(f"{len(PAIRS)} areas to label -> http://localhost:8765")
    HTTPServer(("0.0.0.0" if ARGS.share else "localhost", 8765), H).serve_forever()

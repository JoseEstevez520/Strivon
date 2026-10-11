import sys, copy
from pptx import Presentation
from pptx.util import Emu
from lxml import etree
PX = 9525
src, dst = sys.argv[1], sys.argv[2]
prs = Presentation(src)
ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}

# 1. never wrap: the boxes are measured in the browser and another font engine can break lines.
# Wider boxes (grown on the side the text is aligned to) leave the room that engine needs.
A = '{%s}' % ns['a']
for slide in prs.slides:
    for sp in slide._element.iter('{%s}sp' % ns['p']):
        body = sp.find('p:txBody', ns)
        if body is None: continue
        bp = body.find('a:bodyPr', ns)
        bp.set('wrap', 'none')
        for fit in list(bp): bp.remove(fit)
        xfrm = sp.find('p:spPr/a:xfrm', ns)
        off, ext = xfrm.find('a:off', ns), xfrm.find('a:ext', ns)
        x, w = int(off.get('x')), int(ext.get('cx'))
        extra = int(w * 0.35) + 40 * PX
        pPr = body.find('a:p/a:pPr', ns)
        algn = pPr.get('algn', 'l') if pPr is not None else 'l'
        shift = {'ctr': extra // 2, 'r': extra}.get(algn, 0)
        off.set('x', str(max(0, x - shift)))
        ext.set('cx', str(w + extra))

def near(shape, box, tol=6 * PX):
    return all(abs(a - b * PX) <= tol for a, b in zip((shape.left, shape.top, shape.width, shape.height), box))

TIMING = '''<p:timing xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="500"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="%d"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'''

def put_clip(slide, box, mp4, poster):
    # drop the still that stands in for the clip, then place the real clip in its spot
    for sh in list(slide.shapes):
        if sh.shape_type == 13 and near(sh, box, 40 * PX):
            sh._element.getparent().remove(sh._element)
    l, t, w, h = (Emu(int(v * PX)) for v in box)
    mv = slide.shapes.add_movie(mp4, l, t, w, h, poster_frame_image=poster, mime_type='video/mp4')
    return mv

clips = {3: put_clip(prs.slides[3], (930, 215, 874, 629), 'frames/store-clip.mp4', 'frames/store.png')}
w = 860 * 1920 / 1080
clips[5] = put_clip(prs.slides[5], ((1920 - w) / 2, 190, w, 860), 'frames/chat-clip.mp4', 'frames/chat.png')

P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
def effect(cid, spid, delay, kind):
    if kind == 'play':
        return (f'<p:par><p:cTn id="{cid}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="withEffect"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
                f'<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="{cid+1}" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>', 2)
    return (f'<p:par><p:cTn id="{cid}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="withEffect"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{cid+1}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{cid+2}" dur="700"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>', 3)

def animate(slide, wipe=False, play=None):
    """Fade the slide in, then bring its shapes in one after another, as the web deck does, with no clicks."""
    root = slide._element
    for tag in ('transition', 'timing'):
        old = root.find('p:' + tag, ns)
        if old is not None: root.remove(old)
    move = '<p:wipe/>' if wipe else '<p:fade/>'
    trans = etree.fromstring(f'<p:transition {P} spd="med">{move}</p:transition>')
    clr = root.find('p:clrMapOvr', ns)
    (clr.addnext(trans) if clr is not None else root.find('p:cSld', ns).addnext(trans))
    items, n = [], 0
    for sh in slide.shapes:
        if sh.shape_type == 13 and sh.width >= prs.slide_width * 0.95 and sh.height >= prs.slide_height * 0.95:
            continue  # the page background stays put
        kind = 'play' if (play and sh.shape_id == play.shape_id) else 'fade'
        items.append((sh.shape_id, kind))
    if not items: return
    body, cid = '', 6
    for k, (spid, kind) in enumerate(items):
        xml, used = effect(cid, spid, 150 + 380 * k, kind)
        body += xml; cid += used
    timing = f'''<p:timing {P}><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'''
    t = etree.fromstring(timing)
    ext = root.find('p:extLst', ns)
    (ext.addprevious(t) if ext is not None else root.append(t))

for i, slide in enumerate(prs.slides):
    animate(slide, wipe=i in (1, 7), play=clips.get(i))

from pptx.dml.color import RGBColor
for slide in prs.slides:  # the page colour of the web deck
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = RGBColor(0xF8, 0xF7, 0xF4)
prs.save(dst)
print('saved', dst)

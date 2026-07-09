#!/usr/bin/env python3
"""Generate a realistic sample EPUB (chapters, images, lists, quotes, code)
for testing the converter. Usage: python tests/make_sample_epub.py out.epub
"""

import io
import random
import sys
import zipfile

from PIL import Image, ImageDraw

WORDS = ("the quick brown fox jumps over a lazy dog while distant mountains "
         "gather violet shadows and the river keeps its slow deliberate "
         "counsel beneath willows that remember every season of rain "
         "meanwhile travellers exchange stories about cities made of salt "
         "and lighthouses that blink in a language nobody has bothered to "
         "translate although several scholars insist otherwise").split()

random.seed(42)


def sentence(n=None):
    n = n or random.randint(8, 22)
    ws = [random.choice(WORDS) for _ in range(n)]
    return " ".join(ws).capitalize() + "."


def paragraph(n_sent=None):
    n_sent = n_sent or random.randint(3, 8)
    return " ".join(sentence() for _ in range(n_sent))


def make_image(w, h, color, label):
    im = Image.new("RGB", (w, h), color)
    d = ImageDraw.Draw(im)
    d.rectangle([8, 8, w - 8, h - 8], outline="white", width=4)
    for i in range(0, w, 40):
        d.line([(i, 0), (w - i, h)], fill="white", width=1)
    d.text((w // 2 - 30, h // 2), label, fill="white")
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return buf.getvalue()


def chapter_html(num, title, with_figures=False, weird=False):
    parts = [f"<h1>Chapter {num}: {title}</h1>"]
    parts.append(f"<p>{paragraph(5)}</p>")
    if weird:
        parts.append(f"<blockquote><p>{paragraph(2)}</p></blockquote>")
        parts.append("<ul><li>First idea with <b>bold</b> emphasis</li>"
                     "<li>Second idea, <i>italic</i> and longer: "
                     f"{sentence(14)}</li><li>Third idea</li></ul>")
        parts.append(f"<p>{paragraph(4)}</p>")
        parts.append("<pre>def paginate(atoms):\n    # naive\n"
                     "    return list(chunks(atoms))</pre>")
        parts.append("<table><tr><th>Algorithm</th><th>Cost</th></tr>"
                     "<tr><td>greedy</td><td>O(n)</td></tr>"
                     "<tr><td>optimal</td><td>O(n·w)</td></tr></table>")
    for i in range(random.randint(6, 12)):
        parts.append(f"<p>{paragraph()}</p>")
        if with_figures and i in (2, 5, 8):
            parts.append(
                f'<figure><img src="images/fig{num}_{i}.jpg" alt="fig"/>'
                f"<figcaption>Figure {num}.{i}: {sentence(8)}</figcaption>"
                "</figure>")
    parts.append(f"<h2>Section {num}.1</h2>")
    for _ in range(random.randint(4, 9)):
        parts.append(f"<p>{paragraph()}</p>")
    parts.append("<hr/>")
    parts.append(f"<p>{paragraph(3)}</p>")
    body = "\n".join(parts)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title></head>
<body>{body}</body></html>"""


def build(path):
    chapters = [
        ("The Salt City", True, True),
        ("Willows and Rain", False, False),
        ("A Language of Lighthouses", True, False),
        ("Deliberate Counsel", False, True),
        ("Violet Shadows", True, False),
    ]
    zf = zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED)
    zf.writestr("mimetype", "application/epub+zip", zipfile.ZIP_STORED)
    zf.writestr("META-INF/container.xml", """<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
 <rootfiles><rootfile full-path="OEBPS/content.opf"
   media-type="application/oebps-package+xml"/></rootfiles></container>""")

    manifest, spine, navpoints, images = [], [], [], []
    for n, (title, figs, weird) in enumerate(chapters, 1):
        fn = f"ch{n}.xhtml"
        html = chapter_html(n, title, figs, weird)
        zf.writestr(f"OEBPS/{fn}", html)
        manifest.append(f'<item id="ch{n}" href="{fn}" '
                        'media-type="application/xhtml+xml"/>')
        spine.append(f'<itemref idref="ch{n}"/>')
        navpoints.append(
            f'<navPoint id="np{n}" playOrder="{n}"><navLabel>'
            f"<text>Chapter {n}: {title}</text></navLabel>"
            f'<content src="{fn}"/></navPoint>')
        if figs:
            for i in (2, 5, 8):
                name = f"images/fig{n}_{i}.jpg"
                w = random.choice([500, 800, 1000, 640])
                h = random.choice([300, 500, 700, 900])
                col = random.choice(["#3a5a80", "#6b4a2a", "#4a6b3a", "#5a3a6b"])
                zf.writestr(f"OEBPS/{name}", make_image(w, h, col, f"{n}.{i}"))
                manifest.append(f'<item id="img{n}{i}" href="{name}" '
                                'media-type="image/jpeg"/>')

    cover = make_image(600, 900, "#22344a", "COVER")
    zf.writestr("OEBPS/images/cover.jpg", cover)
    manifest.append('<item id="cover-img" href="images/cover.jpg" '
                    'media-type="image/jpeg"/>')

    zf.writestr("OEBPS/toc.ncx", f"""<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
 <head><meta name="dtb:uid" content="sample-42"/></head>
 <docTitle><text>The Deliberate Counsel</text></docTitle>
 <navMap>{''.join(navpoints)}</navMap></ncx>""")

    zf.writestr("OEBPS/content.opf", f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
 <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
           xmlns:opf="http://www.idpf.org/2007/opf">
  <dc:title>The Deliberate Counsel</dc:title>
  <dc:creator>Ada Sample</dc:creator>
  <dc:language>en</dc:language>
  <dc:identifier id="uid">sample-42</dc:identifier>
  <meta name="cover" content="cover-img"/>
 </metadata>
 <manifest>{''.join(manifest)}
  <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
 </manifest>
 <spine toc="ncx">{''.join(spine)}</spine>
</package>""")
    zf.close()
    print(f"wrote {path}")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "sample.epub")

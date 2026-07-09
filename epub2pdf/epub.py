"""EPUB 2/3 reader: container -> OPF -> spine documents, nav titles, images.

Uses only the standard library (zipfile + ElementTree); the XHTML content
itself is parsed later by content.py with BeautifulSoup.
"""

from __future__ import annotations

import io
import posixpath
import re
import zipfile
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse
from xml.etree import ElementTree as ET

from PIL import Image

from .model import Book, Chapter, ImageRef
from .content import parse_document

NS = {
    "cn": "urn:oasis:names:tc:opendocument:xmlns:container",
    "opf": "http://www.idpf.org/2007/opf",
    "dc": "http://purl.org/dc/elements/1.1/",
    "ncx": "http://www.daisy.org/z3986/2005/ncx/",
    "xhtml": "http://www.w3.org/1999/xhtml",
    "epub": "http://www.idpf.org/2007/ops",
}

RASTER_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


class EpubError(Exception):
    pass


def _norm(base_dir: str, href: str) -> str:
    """Resolve a (possibly URL-encoded, relative) href against a directory."""
    href = unquote(urlparse(href).path)
    return posixpath.normpath(posixpath.join(base_dir, href))


class _ImageStore:
    """Loads images from the zip once, normalizing to formats fpdf2 accepts."""

    def __init__(self, zf: zipfile.ZipFile):
        self.zf = zf
        self.cache: Dict[str, Optional[ImageRef]] = {}
        self._names = set(zf.namelist())

    def get(self, path: str) -> Optional[ImageRef]:
        if path in self.cache:
            return self.cache[path]
        ref = None
        if path in self._names:
            try:
                raw = self.zf.read(path)
                im = Image.open(io.BytesIO(raw))
                im.load()
                fmt = (im.format or "").upper()
                if fmt == "JPEG" and im.mode in ("RGB", "L"):
                    data = raw
                else:
                    # Normalize everything else (GIF, WebP, palette/alpha PNG,
                    # CMYK JPEG...) to a plain PNG fpdf2 can embed.
                    if im.mode in ("P", "CMYK", "LA"):
                        im = im.convert("RGBA" if "A" in im.mode else "RGB")
                    buf = io.BytesIO()
                    im.save(buf, "PNG")
                    data, fmt = buf.getvalue(), "PNG"
                name = re.sub(r"[^A-Za-z0-9._-]", "_", path)
                ref = ImageRef(name=name, data=data, fmt=fmt, px_w=im.width, px_h=im.height)
            except Exception:
                ref = None  # unreadable image: silently dropped, reported by caller
        self.cache[path] = ref
        return ref


def _find_opf(zf: zipfile.ZipFile) -> str:
    try:
        root = ET.fromstring(zf.read("META-INF/container.xml"))
    except KeyError:
        raise EpubError("not an EPUB: missing META-INF/container.xml")
    rf = root.find(".//cn:rootfile", NS)
    if rf is None or not rf.get("full-path"):
        raise EpubError("container.xml has no rootfile")
    return rf.get("full-path")


def _parse_nav_titles(zf: zipfile.ZipFile, nav_path: str) -> Dict[str, str]:
    """EPUB3 nav document: href (fragment stripped) -> title."""
    titles: Dict[str, str] = {}
    try:
        root = ET.fromstring(zf.read(nav_path))
    except Exception:
        return titles
    base = posixpath.dirname(nav_path)
    for nav in root.iter(f"{{{NS['xhtml']}}}nav"):
        if nav.get(f"{{{NS['epub']}}}type", "") != "toc":
            continue
        for a in nav.iter(f"{{{NS['xhtml']}}}a"):
            href = a.get("href")
            text = "".join(a.itertext()).strip()
            if href and text:
                titles.setdefault(_norm(base, href), text)
    return titles


def _parse_ncx_titles(zf: zipfile.ZipFile, ncx_path: str) -> Dict[str, str]:
    """EPUB2 NCX: href (fragment stripped) -> title."""
    titles: Dict[str, str] = {}
    try:
        root = ET.fromstring(zf.read(ncx_path))
    except Exception:
        return titles
    base = posixpath.dirname(ncx_path)
    for np in root.iter(f"{{{NS['ncx']}}}navPoint"):
        label = np.find("ncx:navLabel/ncx:text", NS)
        content = np.find("ncx:content", NS)
        if label is not None and content is not None and content.get("src"):
            text = (label.text or "").strip()
            if text:
                titles.setdefault(_norm(base, content.get("src")), text)
    return titles


def load_epub(path: str) -> Book:
    zf = zipfile.ZipFile(path)
    opf_path = _find_opf(zf)
    opf_dir = posixpath.dirname(opf_path)
    opf = ET.fromstring(zf.read(opf_path))

    def dc(tag: str) -> str:
        el = opf.find(f".//dc:{tag}", NS)
        return (el.text or "").strip() if el is not None and el.text else ""

    title = dc("title") or posixpath.splitext(posixpath.basename(path))[0]
    author = dc("creator")
    language = dc("language") or "en"

    # manifest: id -> (path, media-type, properties)
    manifest: Dict[str, Tuple[str, str, str]] = {}
    for item in opf.findall(".//opf:manifest/opf:item", NS):
        iid, href = item.get("id"), item.get("href")
        if iid and href:
            manifest[iid] = (
                _norm(opf_dir, href),
                item.get("media-type", ""),
                item.get("properties", ""),
            )

    spine_el = opf.find(".//opf:spine", NS)
    if spine_el is None:
        raise EpubError("OPF has no spine")
    spine: List[str] = []
    for ref in spine_el.findall("opf:itemref", NS):
        idref = ref.get("idref")
        if idref in manifest and ref.get("linear", "yes") != "no":
            spine.append(idref)

    # Chapter titles: prefer EPUB3 nav, fall back to NCX.
    titles: Dict[str, str] = {}
    for iid, (p, mt, props) in manifest.items():
        if "nav" in props.split():
            titles = _parse_nav_titles(zf, p)
            break
    if not titles:
        ncx_id = spine_el.get("toc")
        ncx_path = None
        if ncx_id and ncx_id in manifest:
            ncx_path = manifest[ncx_id][0]
        else:
            for iid, (p, mt, props) in manifest.items():
                if mt == "application/x-dtbncx+xml":
                    ncx_path = p
                    break
        if ncx_path:
            titles = _parse_ncx_titles(zf, ncx_path)

    # Cover image: EPUB3 properties, then EPUB2 <meta name="cover">.
    images = _ImageStore(zf)
    cover: Optional[ImageRef] = None
    for iid, (p, mt, props) in manifest.items():
        if "cover-image" in props.split() and mt in RASTER_TYPES:
            cover = images.get(p)
            break
    if cover is None:
        meta = opf.find(".//opf:metadata/opf:meta[@name='cover']", NS)
        if meta is not None and meta.get("content") in manifest:
            p, mt, _ = manifest[meta.get("content")]
            if mt in RASTER_TYPES:
                cover = images.get(p)

    chapters: List[Chapter] = []
    for idx, iid in enumerate(spine):
        doc_path, media_type, _props = manifest[iid]
        if "html" not in media_type and "xml" not in media_type:
            continue
        try:
            raw = zf.read(doc_path)
        except KeyError:
            continue
        base = posixpath.dirname(doc_path)
        blocks = parse_document(raw, lambda src: images.get(_norm(base, src)))
        ch_title = titles.get(doc_path, "")
        # Skip documents that contribute nothing (e.g. a bare cover wrapper
        # whose only image is the cover we already show full-page).
        if not blocks:
            continue
        if cover is not None and len(blocks) == 1 and blocks[0].kind == "image" \
                and blocks[0].image is not None and blocks[0].image.name == cover.name:
            continue
        chapters.append(Chapter(title=ch_title, blocks=blocks, src=doc_path))

    if not chapters:
        raise EpubError("EPUB contains no readable content documents")
    return Book(title=title, author=author, language=language, chapters=chapters, cover=cover)

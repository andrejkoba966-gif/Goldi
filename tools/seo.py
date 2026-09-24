#!/usr/bin/env python3
"""Stamp the SEO block (canonical, link previews, structured data) into every
page and rebuild sitemap.xml and robots.txt.

Safe to re-run: each page's block sits between <!-- seo:start --> and
<!-- seo:end --> and is replaced wholesale.

When the site moves to its own domain, change BASE below and run:
    python3 tools/seo.py
"""
import glob, html, json, os, re, subprocess, datetime
from urllib.parse import urljoin

# ---- the only line to change when the domain moves ----------------------------
BASE = 'https://andrejkoba966-gif.github.io/Goldi/'
# --------------------------------------------------------------------------------

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'GOLDI GROUP'
DEFAULT_IMAGE = 'images/og-default.jpg'
START, END = '<!-- seo:start -->', '<!-- seo:end -->'

SOCIAL = [
    'https://www.instagram.com/goldi_group/',
    'https://www.facebook.com/Goldigroup2017',
    'https://www.tiktok.com/@goldigroup8',
    'https://www.youtube.com/channel/UCwOdK8bQq9JCdSBMtJckBFg',
]
BRANCHES = [
    dict(name='GOLDI GROUP — Кременчук', street='вул. Бетонна, 23', city='Кременчук', zip='39631',
         tel='+380667440055', email='info@goldigroup.com.ua', lat=49.092543479311104, lon=33.40243731567296),
    dict(name='GOLDI GROUP — Київ', street='вул. Володимирська, 97', city='Київ', zip='01033',
         tel='+380965590505', email='sbut-kv@goldigroup.com.ua', lat=50.43371518856839, lon=30.5060315767681),
]


def page_url(rel):
    """index.html -> BASE, a/b/index.html -> BASE + 'a/b/'"""
    d = os.path.dirname(rel)
    return BASE + (d + '/' if d else '')


def image_size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def breadcrumbs(src, url):
    m = re.search(r'<div class="crumbs">(.*?)</div>', src, re.S)
    if not m:
        return None
    body = m.group(1)
    items = [(html.unescape(t.strip()), urljoin(url, h))
             for h, t in re.findall(r'<a href="([^"]+)">(.*?)</a>', body)]
    last = re.sub(r'<[^>]+>', '', body.rsplit('</span>', 1)[-1]).strip()
    if last:
        items.append((html.unescape(last), url))
    if len(items) < 2:
        return None
    return {
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n,
             'item': re.sub(r'index\.html$', '', u)}
            for i, (n, u) in enumerate(items)
        ],
    }


def organisation():
    org_id = BASE + '#org'
    graph = [{
        '@type': 'Organization', '@id': org_id, 'name': SITE, 'url': BASE,
        'logo': BASE + 'images/logo.png', 'foundingDate': '2017',
        'telephone': BRANCHES[0]['tel'], 'email': BRANCHES[0]['email'],
        'sameAs': SOCIAL,
    }]
    for b in BRANCHES:
        graph.append({
            '@type': 'LocalBusiness', 'name': b['name'], 'parentOrganization': {'@id': org_id},
            'url': BASE + 'kontakty/', 'image': BASE + DEFAULT_IMAGE,
            'telephone': b['tel'], 'email': b['email'],
            'address': {'@type': 'PostalAddress', 'streetAddress': b['street'],
                        'addressLocality': b['city'], 'postalCode': b['zip'], 'addressCountry': 'UA'},
            'geo': {'@type': 'GeoCoordinates', 'latitude': b['lat'], 'longitude': b['lon']},
        })
    return graph


def build_block(rel, src):
    url = page_url(rel)
    title = html.unescape(re.search(r'<title>(.*?)</title>', src, re.S).group(1).strip())
    dm = re.search(r'<meta name="description" content="([^"]*)"', src)
    desc = html.unescape(dm.group(1)) if dm else ''

    # a page's own photo makes the better preview; otherwise the brand card
    im = re.search(r'<div class="p-imgwrap">\s*<img src="([^"]+)"', src)
    img_rel = os.path.normpath(os.path.join(os.path.dirname(rel), im.group(1))) if im else DEFAULT_IMAGE
    img_url = BASE + img_rel.replace(os.sep, '/')
    size = image_size(os.path.join(ROOT, img_rel))

    e = lambda s: html.escape(s, quote=True)
    lines = [
        START,
        f'<link rel="canonical" href="{e(url)}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{SITE}">',
        '<meta property="og:locale" content="uk_UA">',
        f'<meta property="og:url" content="{e(url)}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:image" content="{e(img_url)}">',
    ]
    if size:
        lines += [f'<meta property="og:image:width" content="{size[0]}">',
                  f'<meta property="og:image:height" content="{size[1]}">']
    lines += [
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(title)}">',
        f'<meta name="twitter:description" content="{e(desc)}">',
        f'<meta name="twitter:image" content="{e(img_url)}">',
    ]

    graph = []
    if rel in ('index.html', 'kontakty/index.html'):
        graph += organisation()
    bc = breadcrumbs(src, url)
    if bc:
        graph.append(bc)
    if graph:
        data = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, indent=1)
        lines.append('<script type="application/ld+json">\n' + data.replace('</', '<\\/') + '\n</script>')
    lines.append(END)
    return '\n'.join(lines) + '\n'


def lastmod(path):
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path],
                             cwd=ROOT, capture_output=True, text=True).stdout.strip()
        return out or datetime.date.today().isoformat()
    except Exception:
        return datetime.date.today().isoformat()


def main():
    pages = sorted(p for p in glob.glob('**/*.html', root_dir=ROOT, recursive=True))
    for rel in pages:
        path = os.path.join(ROOT, rel)
        src = open(path, encoding='utf-8').read()
        src = re.sub(re.escape(START) + r'.*?' + re.escape(END) + r'\n?', '', src, flags=re.S)
        src = src.replace('</head>', build_block(rel, src) + '</head>', 1)
        open(path, 'w', encoding='utf-8').write(src)

    urls = '\n'.join(
        f'  <url><loc>{html.escape(page_url(rel))}</loc><lastmod>{lastmod(rel)}</lastmod></url>'
        for rel in pages)
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n')
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write(
        'User-agent: *\nAllow: /\n\nSitemap: ' + BASE + 'sitemap.xml\n')
    print(f'{len(pages)} pages stamped, sitemap.xml and robots.txt written for {BASE}')


if __name__ == '__main__':
    main()

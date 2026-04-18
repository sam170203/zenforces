#!/usr/bin/env python3
"""Generate Zenforces extension icons using only Python stdlib (no Pillow)."""
import struct, zlib, math, os

# ── PNG writer ────────────────────────────────────────────────────────────────

def write_png(pixels, w, h):
    """Encode list of (R,G,B,A) tuples as PNG bytes."""
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: None
        for x in range(w):
            raw.extend(pixels[y * w + x])
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        + chunk(b'IEND', b'')
    )


# ── Compositing & geometry ────────────────────────────────────────────────────

def blend(bg, fg):
    """Alpha-composite fg over bg (RGBA tuples, 0–255)."""
    fa, ba = fg[3] / 255.0, bg[3] / 255.0
    oa = fa + ba * (1.0 - fa)
    if oa == 0:
        return (0, 0, 0, 0)
    r = int((fg[0]*fa + bg[0]*ba*(1-fa)) / oa)
    g = int((fg[1]*fa + bg[1]*ba*(1-fa)) / oa)
    b = int((fg[2]*fa + bg[2]*ba*(1-fa)) / oa)
    return (min(255,r), min(255,g), min(255,b), min(255, int(oa*255)))

def in_rounded_rect(x, y, w, h, cr):
    if x < cr and y < cr:
        return (cr-x-1)**2 + (cr-y-1)**2 <= (cr-0.5)**2
    if x > w-cr-1 and y < cr:
        return (x-(w-cr))**2 + (cr-y-1)**2 <= (cr-0.5)**2
    if x < cr and y > h-cr-1:
        return (cr-x-1)**2 + (y-(h-cr))**2 <= (cr-0.5)**2
    if x > w-cr-1 and y > h-cr-1:
        return (x-(w-cr))**2 + (y-(h-cr))**2 <= (cr-0.5)**2
    return True

def point_in_poly(px, py, poly):
    inside, j = False, len(poly) - 1
    for i, (xi, yi) in enumerate(poly):
        xj, yj = poly[j]
        if (yi > py) != (yj > py) and px < (xj-xi)*(py-yi)/(yj-yi) + xi:
            inside = not inside
        j = i
    return inside

def coverage(x, y, poly, n=3):
    """Anti-aliased coverage: fraction of nxn sub-pixels inside polygon."""
    c = sum(1 for sy in range(n) for sx in range(n)
            if point_in_poly(x+(sx+.5)/n, y+(sy+.5)/n, poly))
    return c / (n * n)

def dist_to_poly(px, py, poly):
    """Minimum distance from point to polygon boundary."""
    d = float('inf')
    for i in range(len(poly)):
        ax, ay = poly[i]; bx, by = poly[(i+1) % len(poly)]
        dx, dy = bx-ax, by-ay
        t = max(0.0, min(1.0, ((px-ax)*dx+(py-ay)*dy) / (dx*dx+dy*dy+1e-12)))
        d = min(d, math.hypot(px-(ax+t*dx), py-(ay+t*dy)))
    return d


# ── Lightning bolt polygon ────────────────────────────────────────────────────

def bolt_polygon(size, pad=0.14):
    """Return lightning bolt polygon scaled to icon size."""
    p, s = pad * size, (1 - 2*pad) * size
    # Classic zigzag bolt, normalized 0–1 in both axes
    pts = [
        (0.62, 0.03),   # top
        (0.18, 0.54),   # mid-left
        (0.47, 0.54),   # mid-right kink
        (0.38, 0.97),   # bottom tip
        (0.82, 0.46),   # lower-right
        (0.53, 0.46),   # lower kink
    ]
    return [(p + x*s, p + y*s) for x, y in pts]


# ── Icon renderer ─────────────────────────────────────────────────────────────

def generate_icon(size):
    BG_TOP  = (10, 22, 40)      # top of gradient: dark navy
    BG_BOT  = ( 3,  7, 16)      # bottom: near-black
    BOLT    = (79, 195, 247)    # bolt fill: #4FC3F7
    HI      = (220, 244, 255)   # highlight tip
    GLOW    = (88, 166, 255)    # glow halo: #58A6FF

    cr      = max(2, round(size * 0.22))   # corner radius
    poly    = bolt_polygon(size)
    glow_r  = max(2.0, size / 8.5)
    pix     = [(0,0,0,0)] * (size * size)

    # Bounding box for bolt + glow margin
    xs = [p[0] for p in poly]; ys_p = [p[1] for p in poly]
    bx0 = max(0, int(min(xs) - glow_r) - 1)
    bx1 = min(size-1, int(max(xs) + glow_r) + 1)
    by0 = max(0, int(min(ys_p) - glow_r) - 1)
    by1 = min(size-1, int(max(ys_p) + glow_r) + 1)

    # ── Rounded-rect background with top-to-bottom gradient ──────────────
    for y in range(size):
        for x in range(size):
            if not in_rounded_rect(x, y, size, size, cr):
                continue
            t = y / max(1, size - 1)
            r = round(BG_TOP[0] + (BG_BOT[0]-BG_TOP[0]) * t)
            g = round(BG_TOP[1] + (BG_BOT[1]-BG_TOP[1]) * t)
            b = round(BG_TOP[2] + (BG_BOT[2]-BG_TOP[2]) * t)
            # Radial blue tint emanating from top-center
            d = math.hypot(x - size*0.5, y*0.55) / (size * 0.65)
            tint = max(0.0, 1 - d) ** 2
            b = min(255, round(b + 62 * tint))
            g = min(255, round(g + 20 * tint))
            pix[y*size+x] = (r, g, b, 255)

    # ── Soft border highlight (1px inner rim) ─────────────────────────────
    if size >= 48:
        rim_col = (30, 65, 130, 80)
        for y in range(size):
            for x in range(size):
                if not in_rounded_rect(x, y, size, size, cr):
                    continue
                # Check if this pixel is on the edge of the rounded rect
                edge = False
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        if not in_rounded_rect(x+dx, y+dy, size, size, cr):
                            edge = True; break
                    if edge: break
                if edge:
                    pix[y*size+x] = blend(pix[y*size+x], rim_col)

    # ── Lightning bolt: glow → fill → highlight ───────────────────────────
    for y in range(by0, by1 + 1):
        for x in range(bx0, bx1 + 1):
            if pix[y*size+x][3] == 0:
                continue

            cov = coverage(x, y, poly, n=(3 if size >= 32 else 1))

            if cov > 0:
                # Diagonal highlight: top-left corner is brightest
                ht = max(0.0, 1.0 - (x + y) / (size * 1.35))
                r = min(255, round(BOLT[0] + (HI[0]-BOLT[0]) * ht))
                g = min(255, round(BOLT[1] + (HI[1]-BOLT[1]) * ht * 0.65))
                b = min(255, round(BOLT[2] + (HI[2]-BOLT[2]) * ht * 0.25))
                pix[y*size+x] = blend(pix[y*size+x], (r, g, b, round(255 * cov)))

            elif size >= 32:
                # Soft glow halo outside the bolt
                d = dist_to_poly(x + 0.5, y + 0.5, poly)
                if d < glow_r:
                    t = 1.0 - d / glow_r
                    alpha = round(72 * t * t)
                    if alpha:
                        pix[y*size+x] = blend(pix[y*size+x],
                                               (GLOW[0], GLOW[1], GLOW[2], alpha))

    return pix


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    for size in [16, 32, 48, 128]:
        print(f'  Generating {size}x{size}...', end='', flush=True)
        pixels = generate_icon(size)
        path   = os.path.join(icons_dir, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(write_png(pixels, size, size))
        print(' ✓')

    print('Done — icons written to ./icons/')

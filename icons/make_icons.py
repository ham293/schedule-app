"""用 PIL 生成日程管家的 PNG 图标（192/512 + maskable）。"""
from PIL import Image, ImageDraw

BRAND_A = (91, 108, 255)   # #5b6cff
BRAND_B = (122, 103, 255)  # #7a67ff
WHITE = (255, 255, 255, 255)


def grad(size, a, b):
    """垂直渐变背景 RGBA。"""
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        c = (int(a[0] + (b[0] - a[0]) * t),
             int(a[1] + (b[1] - a[1]) * t),
             int(a[2] + (b[2] - a[2]) * t), 255)
        d.line([(0, y), (size, y)], fill=c)
    return img


def rounded(img, radius_frac):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_frac), fill=255)
    img.putalpha(mask)
    return img


def draw_clock(size, pad_frac=0.0):
    """绘制背景+时钟，pad_frac 为内容向中心缩进比例（maskable 用）。"""
    bg = grad(size, BRAND_A, BRAND_B)
    # 半径
    cx = cy = size / 2
    R = size * (1 - pad_frac) * (0.5 - 0.16)  # 时钟外圈半径（约占 34%）
    d = ImageDraw.Draw(bg)

    def L(x0, y0, x1, y1, w):
        d.line([(x0, y0), (x1, y1)], fill=WHITE, width=w)

    stroke = max(2, int(size * 0.055))
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=WHITE, width=stroke)
    # 时针（竖直向上）到中心，分针（向右下）
    L(cx, cy, cx, cy - R * 0.5, stroke)
    L(cx, cy, cx + R * 0.42, cy + R * 0.42, stroke)
    dot = max(3, int(size * 0.055))
    d.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=WHITE)
    return bg


def make(size, path, pad_frac=0.0, radius_frac=0.23):
    img = draw_clock(size, pad_frac)
    img = rounded(img, radius_frac)
    img.save(path, "PNG")
    print(path, "->", size, "x", size)


make(192, "icon-192.png")
make(512, "icon-512.png")
# maskable：全方形背景（不裁角），内容缩小到安全区
icon = draw_clock(512, pad_frac=0.12)
icon.save("icon-maskable-512.png", "PNG")
print("icon-maskable-512.png -> 512 x 512 (maskable)")

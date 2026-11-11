"""
Generate app icon, Android adaptive icon layers, splash image and favicon
from the site logo mark (public/images/logo-*.png).

Usage (from mobile/):  python scripts/generate-icons.py
Requires Pillow.
"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'public' / 'images' / 'logo-1759813853497-882930560.png'
OUT = ROOT / 'assets' / 'images'

BACKGROUND = (255, 255, 255, 255)  # white, as in the website header
SCALE = 8


def palette(img: Image.Image) -> list[tuple[int, int, int]]:
    """Most common opaque colours in the source (orange + beige)."""
    counts: dict[tuple[int, int, int], int] = {}
    for r, g, b, a in img.get_flattened_data():
        if a > 240:
            counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    return [c for c, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:2]]


def crisp_mark() -> Image.Image:
    src = Image.open(SOURCE).convert('RGBA')
    bbox = src.getbbox()
    src = src.crop(bbox)
    colors = palette(src)
    size = ((src.width + 4) * SCALE, (src.height + 4) * SCALE)
    result = Image.new('RGBA', size, (0, 0, 0, 0))

    # One mask per logo colour: upscale, blur away the source's pixel staircase, re-sharpen.
    for color in colors:
        mask = Image.new('L', (src.width + 4, src.height + 4), 0)
        mpx = mask.load()
        spx = src.load()
        for y in range(src.height):
            for x in range(src.width):
                r, g, b, a = spx[x, y]
                nearest = min(colors, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
                if nearest == color:
                    mpx[x + 2, y + 2] = a
        mask = mask.resize(size, Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(SCALE * 0.75))
        mask = mask.point(lambda v: max(0, min(255, (v - 128) * 4 + 128)))
        layer = Image.new('RGBA', size, (*color, 255))
        layer.putalpha(mask)
        result.alpha_composite(layer)

    return result.crop(result.getbbox())


def fit(mark: Image.Image, width: int) -> Image.Image:
    height = round(mark.height * width / mark.width)
    return mark.resize((width, height), Image.Resampling.LANCZOS)


def place(canvas: Image.Image, mark: Image.Image) -> Image.Image:
    x = (canvas.width - mark.width) // 2
    y = (canvas.height - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    return canvas


def silhouette(mark: Image.Image) -> Image.Image:
    white = Image.new('RGBA', mark.size, (255, 255, 255, 0))
    white.putalpha(mark.getchannel('A'))
    return white


def main() -> None:
    mark = crisp_mark()
    OUT.mkdir(parents=True, exist_ok=True)

    place(Image.new('RGBA', (1024, 1024), BACKGROUND), fit(mark, 640)).convert('RGB').save(OUT / 'icon.png')
    Image.new('RGBA', (1024, 1024), BACKGROUND).save(OUT / 'android-icon-background.png')
    place(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), fit(mark, 540)).save(OUT / 'android-icon-foreground.png')
    place(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), silhouette(fit(mark, 540))).save(
        OUT / 'android-icon-monochrome.png'
    )
    place(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), fit(mark, 900)).save(OUT / 'splash-icon.png')
    fit(mark, 600).save(OUT / 'logo-mark.png')
    place(Image.new('RGBA', (48, 48), BACKGROUND), fit(mark, 36)).save(OUT / 'favicon.png')
    print('Icons written to', OUT)


if __name__ == '__main__':
    main()

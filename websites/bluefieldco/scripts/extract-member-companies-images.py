"""Extract assets from member-companies infographic images."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = Path(
    r"C:\Users\alano\.cursor\projects\c-Work-Pierre-bluefielco-com-bluefieldco-com\assets"
)
OUT = ROOT / "public" / "images" / "member-companies"
OUT.mkdir(parents=True, exist_ok=True)


def find_asset(*needles: str) -> Path:
    for path in sorted(ASSETS.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True):
        name = path.name.lower()
        if all(n.lower() in name for n in needles):
            return path
    raise FileNotFoundError(f"No asset matching {needles!r} in {ASSETS}")


FOOTPRINT_SRC = find_asset("0889c0c5")
GLOBAL_MAP_SRC = find_asset("76b2871a")
GLOBAL_SRC = find_asset("73b2ab5e")


def crop(img: Image.Image, box: tuple[int, int, int, int], name: str) -> None:
    img.crop(box).save(OUT / name, optimize=True)
    print(f"  saved {name} ({box})")


def extract_footprint() -> None:
    print(f"Extracting from {FOOTPRINT_SRC.name}...")
    img = Image.open(FOOTPRINT_SRC)
    w, h = img.size

    crop(img, (0, 0, w, h), "our-footprint-full.png")
    crop(img, (395, 100, 630, 400), "footprint-central.png")


def extract_global() -> None:
    print(f"Copying globe map from {GLOBAL_MAP_SRC.name}...")
    Image.open(GLOBAL_MAP_SRC).save(OUT / "global-presence-map.png", optimize=True)
    print("  saved global-presence-map.png")

    print(f"Extracting logos from {GLOBAL_SRC.name}...")
    img = Image.open(GLOBAL_SRC)
    w, h = img.size

    crop(img, (0, 0, w, h), "global-presence-full.png")

    col_w = w // 4
    cols_top = 328

    for idx, slug in enumerate(["agriculture", "pest", "landscaping", "cleaning"]):
        x1 = idx * col_w
        x2 = (idx + 1) * col_w if idx < 3 else w
        crop(img, (x1, cols_top, x2, h), f"col-{slug}.png")

    ag = Image.open(OUT / "col-agriculture.png")
    aw, ah = ag.size
    logo_top = int(ah * 0.52)
    half_w = aw // 2
    half_h = (ah - logo_top) // 2
    for country, box in {
        "uae": (0, logo_top, half_w, logo_top + half_h),
        "jordan": (half_w, logo_top, aw, logo_top + half_h),
        "lebanon": (0, logo_top + half_h, half_w, ah),
        "iraq": (half_w, logo_top + half_h, aw, ah),
    }.items():
        ag.crop(box).save(OUT / f"logo-bluefield-agriculture-{country}.png", optimize=True)
        print(f"  saved logo-bluefield-agriculture-{country}.png")

    crop(img, (270, 450, 500, 525), "logo-public-health.png")
    crop(img, (525, 445, 755, 525), "logo-albizia.png")
    crop(img, (785, 445, 1010, 525), "logo-bf-core.png")


def main() -> None:
    extract_footprint()
    extract_global()
    print(f"Done — assets in {OUT}")


if __name__ == "__main__":
    main()

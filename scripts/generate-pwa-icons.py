from PIL import Image
from pathlib import Path

src = Path(r"d:\Program\LongHuaCRM\public\icon-master.png")
out_dir = Path(r"d:\Program\LongHuaCRM\public\icons")
out_dir.mkdir(parents=True, exist_ok=True)

img = Image.open(src).convert("RGBA")


def resize_cover(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)


def make_maskable(im: Image.Image, size: int, pad_ratio: float = 0.18) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (185, 28, 28, 255))
    inner = int(size * (1 - 2 * pad_ratio))
    icon = im.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(icon, (offset, offset), icon)
    return canvas


for size, name in [
    (192, "icon-192.png"),
    (512, "icon-512.png"),
    (180, "apple-touch-icon.png"),
]:
    resize_cover(img, size).save(out_dir / name, optimize=True)
    print("wrote", name)

for size, name in [
    (192, "icon-maskable-192.png"),
    (512, "icon-maskable-512.png"),
]:
    make_maskable(img, size).save(out_dir / name, optimize=True)
    print("wrote", name)

resize_cover(img, 32).save(out_dir / "favicon-32.png", optimize=True)
resize_cover(img, 48).save(out_dir / "favicon-48.png", optimize=True)
print("done")

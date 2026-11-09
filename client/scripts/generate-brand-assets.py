"""Generate every raster brand asset from the canonical NewsAgg PNG mark.

Run from the client/ directory with Pillow installed:
    python scripts/generate-brand-assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# PAPER is the app's light page background (--page-bg); INK is the mark's own navy (--brand-ink).
PAPER = (243, 246, 250, 255)
INK = (7, 65, 116, 255)
SLATE = (71, 85, 105, 255)
PUBLIC = Path(__file__).resolve().parent.parent / "public"
LOGO_PATH = PUBLIC / "logo-mark.png"
# Nunito is the app's wordmark face (variable weight, SIL OFL; licence in fonts/OFL.txt).
FONT = Path(__file__).resolve().parent / "fonts" / "Nunito-wght.ttf"


def nunito(size: int, weight: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT), size)
    font.set_variation_by_axes([weight])
    return font


def fitted_mark(source: Image.Image, size: int, fill: float) -> Image.Image:
    """Return a centered high-quality mark within a square transparent layer."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = source.copy()
    edge = round(size * fill)
    mark.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    layer.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return layer


def icon(source: Image.Image, size: int, fill: float, radius: float = 0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), PAPER)
    canvas.alpha_composite(fitted_mark(source, size, fill))
    if radius:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size - 1, size - 1), radius=round(size * radius), fill=255
        )
        canvas.putalpha(mask)
    return canvas


def save(image: Image.Image, filename: str) -> None:
    path = PUBLIC / filename
    image.save(path, optimize=True)
    print("wrote", path.relative_to(PUBLIC.parent))


logo = Image.open(LOGO_PATH).convert("RGBA")

# Browser and installable-app assets all inherit the same canonical mark.
save(icon(logo, 64, 0.88, 0.22), "favicon.png")
# Legacy /favicon.ico for browsers, feed readers and crawlers that ask for it by name.
icon(logo, 48, 0.88, 0.22).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote", (PUBLIC / "favicon.ico").relative_to(PUBLIC.parent))
save(icon(logo, 180, 0.82), "apple-touch-icon.png")
save(icon(logo, 192, 0.82, 0.22), "icon-192.png")
save(icon(logo, 512, 0.82, 0.22), "icon-512.png")
save(icon(logo, 512, 0.64), "icon-maskable.png")
# Structured-data publisher logo: the 1254px master is 780 KB; 512px is plenty (Google asks for 112+).
save(fitted_mark(logo, 512, 1.0), "logo-mark-512.png")

# Social-share card uses the same mark and existing editorial palette.
og = Image.new("RGBA", (1200, 630), PAPER)
og.alpha_composite(fitted_mark(logo, 230, 0.92), (485, 82))
draw = ImageDraw.Draw(og)
draw.text((600, 373), "NewsAgg", font=nunito(84, 700), fill=INK, anchor="mm")
draw.text(
    (600, 452),
    "Automated Multilingual News Aggregation",
    font=nunito(25, 600),
    fill=SLATE,
    anchor="mm",
)
draw.text((600, 490), "with NLP Sentiment Analysis and Topic Insights Dashboard", font=nunito(25, 600), fill=SLATE, anchor="mm")
save(og.convert("RGB"), "og-image.png")

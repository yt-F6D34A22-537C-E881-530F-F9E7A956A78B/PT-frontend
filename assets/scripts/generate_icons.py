"""
favicon.ico / apple-touch-icon.png / apple-touch-icon-v3.png を生成するスクリプト。

デザイン方針:
  - frontend/css/style.css の配色（クリーム地 #ece5d6 × 濃紺 #1d2340）に合わせる。
  - タブ1（OHLCVマージ）のデザイン参考にした yubune.co のトップページに描かれている
    「水面の波紋」モチーフを、アプリのシンボルマークとして簡略化して採用。
  - 小サイズ（16x16等）でも視認できるよう、装飾を最小限にした同心円のみで構成。

実行方法:
  python3 scripts/generate_icons.py
  → frontend/ 配下に favicon.ico, apple-touch-icon.png, apple-touch-icon-v3.png を出力する。
"""
from pathlib import Path

from PIL import Image, ImageDraw

COLOR_BG = (29, 35, 64, 255)      # --color-fg (濃紺) を背景に採用
COLOR_MARK = (236, 229, 214, 255)  # --color-bg (クリーム) を波紋の線色に採用

MASTER_SIZE = 1024
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "frontend"


def draw_master_icon() -> Image.Image:
    """1024x1024の元画像を描画する。"""
    image = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # 角丸正方形の背景（濃紺）
    corner_radius = int(MASTER_SIZE * 0.22)
    draw.rounded_rectangle(
        [(0, 0), (MASTER_SIZE, MASTER_SIZE)],
        radius=corner_radius,
        fill=COLOR_BG,
    )

    # 同心円の波紋モチーフ（中心からリングを3本、線幅を外側ほど細く）
    center = MASTER_SIZE // 2
    ring_specs = [
        (0.16, 34),
        (0.28, 24),
        (0.40, 16),
    ]
    for radius_ratio, stroke_width in ring_specs:
        r = int(MASTER_SIZE * radius_ratio)
        draw.ellipse(
            [(center - r, center - r), (center + r, center + r)],
            outline=COLOR_MARK,
            width=stroke_width,
        )

    return image


def save_png(image: Image.Image, size: int, path: Path) -> None:
    resized = image.resize((size, size), Image.LANCZOS)
    resized.save(path, format="PNG")


def save_ico(image: Image.Image, path: Path) -> None:
    sizes = [(16, 16), (32, 32), (48, 48)]
    image.save(path, format="ICO", sizes=sizes)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    master = draw_master_icon()

    save_ico(master, OUTPUT_DIR / "favicon.ico")
    save_png(master, 180, OUTPUT_DIR / "apple-touch-icon.png")
    save_png(master, 180, OUTPUT_DIR / "apple-touch-icon-v3.png")

    print("生成完了:")
    print(f"  {OUTPUT_DIR / 'favicon.ico'}")
    print(f"  {OUTPUT_DIR / 'apple-touch-icon.png'}")
    print(f"  {OUTPUT_DIR / 'apple-touch-icon-v3.png'}")


if __name__ == "__main__":
    main()

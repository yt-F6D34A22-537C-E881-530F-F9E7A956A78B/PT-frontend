/**
 * タブ2: 画像OCR（文字列抽出）機能。
 * 画像ファイルからテキストを抽出し、テキストエリアに表示する。
 *
 * 参考にした移植元ロジック:
 *   - MainWindow.xaml.cs（StockTools, WPF）の OCR処理（Tesseractエンジン使用）。
 *     ただしWPF版は株価チャート特化の前処理（色相フィルタ・膨張）を伴う専用ロジックのため、
 *     本タブでは汎用画像向けに「グレースケール化＋Otsu法による二値化」のみを移植する。
 *
 * 方針:
 *   ブラウザ標準APIには画像OCR機能が存在しないため、
 *   OCRエンジン（Tesseract.js, MIT License, https://github.com/naptha/tesseract.js）を
 *   CDN経由で利用する。仕様書のバックエンド未使用方針を踏襲し、
 *   画像はサーバーへ送信せずブラウザ内のみで処理する。
 *   ライブラリ本体は初期表示時ではなく、本タブが実際に使われた時点
 *   （抽出ボタン押下時）に遅延読込みし、他タブの表示性能へ影響しないようにしている。
 *
 * 画像入力は「ファイル選択」と「クリップボード貼り付け（Ctrl+V）」の2系統に対応し、
 * どちらから来た画像も currentImageFile という単一の状態にまとめて扱う。
 */
(() => {
  const TESSERACT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const MIN_WIDTH_FOR_UPSCALE = 1000; // これより小さい画像はOCR精度が落ちやすいため拡大する

  const form = document.getElementById("ocr-form");
  const imageInput = document.getElementById("ocr-image-input");
  const pasteZone = document.getElementById("ocr-paste-zone");
  const langSelect = document.getElementById("ocr-lang-select");
  const previewImage = document.getElementById("ocr-preview-image");
  const statusMessage = document.getElementById("ocr-status-message");
  const resultTextarea = document.getElementById("ocr-result-textarea");
  const copyButton = document.getElementById("ocr-copy-button");

  let tesseractLoadPromise = null;
  let currentImageFile = null; // ファイル選択・クリップボード貼り付けの両方をここに集約する

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (file) setCurrentImage(file);
  });

  // クリップボードからの画像貼り付け（貼り付け欄にフォーカスした状態でCtrl+V）
  pasteZone.addEventListener("paste", (event) => {
    const items = event.clipboardData ? Array.from(event.clipboardData.items) : [];
    const imageItem = items.find((item) => item.type.startsWith("image/"));

    if (!imageItem) {
      statusMessage.textContent = "クリップボードに画像が見つかりませんでした。";
      return;
    }

    event.preventDefault();

    const blob = imageItem.getAsFile();
    const file = new File([blob], "clipboard-image.png", { type: blob.type });

    // ファイル選択欄との状態のずれを防ぐため、選択済みファイルはクリアする
    imageInput.value = "";
    setCurrentImage(file);
    statusMessage.textContent = "クリップボードの画像を読み込みました。";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentImageFile) {
      statusMessage.textContent = "対象の画像ファイルを選択、またはクリップボードから貼り付けてください。";
      return;
    }

    try {
      statusMessage.textContent = "OCRエンジンを準備中...";
      await ensureTesseractLoaded();

      statusMessage.textContent = "文字列を抽出中...";
      const text = await extractTextFromImage(currentImageFile, langSelect.value);

      resultTextarea.value = text;
      statusMessage.textContent = "抽出が完了しました。";
    } catch (error) {
      console.error(error);
      statusMessage.textContent = "エラーが発生しました。";
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!resultTextarea.value) return;

    try {
      await navigator.clipboard.writeText(resultTextarea.value);
      statusMessage.textContent = "クリップボードにコピーしました。";
    } catch (error) {
      console.error(error);
      statusMessage.textContent = "コピーに失敗しました。";
    }
  });

  /** 選択中の画像を更新し、プレビュー表示する */
  function setCurrentImage(file) {
    currentImageFile = file;

    const objectUrl = URL.createObjectURL(file);
    previewImage.src = objectUrl;
    previewImage.hidden = false;
    previewImage.onload = () => URL.revokeObjectURL(objectUrl);
  }

  /** Tesseract.jsを必要になった時点でCDNから読み込む（初期表示の性能影響を避けるため） */
  function ensureTesseractLoaded() {
    if (window.Tesseract) return Promise.resolve();
    if (tesseractLoadPromise) return tesseractLoadPromise;

    tesseractLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TESSERACT_SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Tesseract.jsの読み込みに失敗しました。"));
      document.head.appendChild(script);
    });

    return tesseractLoadPromise;
  }

  /** 画像ファイル1件からテキストを抽出する（ワーカーは処理ごとに生成・破棄） */
  async function extractTextFromImage(file, lang) {
    const canvas = await prepareCanvasForOcr(file);
    const worker = await Tesseract.createWorker(lang);
    try {
      const { data } = await worker.recognize(canvas);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }

  /**
   * OCR精度向上のための前処理。
   *   1. 小さい画像はCanvasで拡大する
   *   2. グレースケール化＋Otsu法による二値化を行う
   * （WPF版PreprocessImageの輝度係数(0.3/0.59/0.11)を踏襲しつつ、
   *   固定しきい値ではなく画像ごとに最適なしきい値をOtsu法で自動算出する）
   */
  async function prepareCanvasForOcr(file) {
    const bitmap = await createImageBitmap(file);
    const scale = bitmap.width < MIN_WIDTH_FOR_UPSCALE ? 2 : 1;

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    binarizeWithOtsuThreshold(ctx, canvas.width, canvas.height);

    return canvas;
  }

  /** グレースケール化した上で、Otsu法のしきい値により白黒2値化する */
  function binarizeWithOtsuThreshold(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const pixelCount = width * height;

    const gray = new Uint8ClampedArray(pixelCount);
    const histogram = new Array(256).fill(0);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const luminance = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      gray[p] = luminance;
      histogram[Math.round(luminance)] += 1;
    }

    const threshold = calculateOtsuThreshold(histogram, pixelCount);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const value = gray[p] >= threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /** Otsuの判別分析法により、二値化に用いる最適なしきい値（0〜255）を求める */
  function calculateOtsuThreshold(histogram, totalPixels) {
    let sumAll = 0;
    for (let t = 0; t < 256; t += 1) sumAll += t * histogram[t];

    let sumBackground = 0;
    let weightBackground = 0;
    let maxVariance = 0;
    let threshold = 128; // ヒストグラムが偏っている等で算出できない場合のフォールバック値

    for (let t = 0; t < 256; t += 1) {
      weightBackground += histogram[t];
      if (weightBackground === 0) continue;

      const weightForeground = totalPixels - weightBackground;
      if (weightForeground === 0) break;

      sumBackground += t * histogram[t];

      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sumAll - sumBackground) / weightForeground;
      const betweenVariance =
        weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

      if (betweenVariance > maxVariance) {
        maxVariance = betweenVariance;
        threshold = t;
      }
    }

    return threshold;
  }
})();

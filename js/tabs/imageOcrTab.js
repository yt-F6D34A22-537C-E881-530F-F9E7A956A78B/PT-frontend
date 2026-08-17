/**
 * タブ2: 画像OCR（文字列抽出）機能。
 * 画像ファイルからテキストを抽出し、テキストエリアに表示する。
 *
 * 参考にした移植元ロジック:
 *   - MainWindow.xaml.cs（StockTools, WPF）の OCR処理（Tesseractエンジン使用）。
 *     ただしWPF版は株価チャート特化の前処理（二値化・膨張・色相フィルタ）を伴う
 *     専用ロジックのため、本タブでは前処理を行わない汎用画像OCRとして移植する。
 *
 * 方針:
 *   ブラウザ標準APIには画像OCR機能が存在しないため、
 *   OCRエンジン（Tesseract.js, MIT License, https://github.com/naptha/tesseract.js）を
 *   CDN経由で利用する。仕様書のバックエンド未使用方針を踏襲し、
 *   画像はサーバーへ送信せずブラウザ内のみで処理する。
 *   ライブラリ本体は初期表示時ではなく、本タブが実際に使われた時点
 *   （抽出ボタン押下時）に遅延読込みし、他タブの表示性能へ影響しないようにしている。
 */
(() => {
  const TESSERACT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const OCR_LANGUAGES = "jpn+eng"; // 移植元(WPF版)の設定に合わせた既定値

  const form = document.getElementById("ocr-form");
  const imageInput = document.getElementById("ocr-image-input");
  const statusMessage = document.getElementById("ocr-status-message");
  const resultTextarea = document.getElementById("ocr-result-textarea");
  const copyButton = document.getElementById("ocr-copy-button");

  let tesseractLoadPromise = null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = imageInput.files[0];
    if (!file) {
      statusMessage.textContent = "対象の画像ファイルを選択してください。";
      return;
    }

    try {
      statusMessage.textContent = "OCRエンジンを準備中...";
      await ensureTesseractLoaded();

      statusMessage.textContent = "文字列を抽出中...";
      const text = await extractTextFromImage(file);

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
  async function extractTextFromImage(file) {
    const worker = await Tesseract.createWorker(OCR_LANGUAGES);
    try {
      const { data } = await worker.recognize(file);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }
})();

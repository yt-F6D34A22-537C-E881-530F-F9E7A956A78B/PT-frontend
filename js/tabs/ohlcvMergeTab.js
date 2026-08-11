/**
 * タブ1: OHLCVマージ機能。
 * デスクトップアプリ(OhlcvMergerWpf)の フォルダ選択→マージ→保存 の流れをWeb化。
 *
 * 移植元ロジック:
 *   - OhlcvLoader.LoadFromFolder : ファイル名の数字部分を日付として抽出し、
 *                                   対象銘柄コードのみ o/h/l/c/v を抽出する。
 *   - OhlcvMerger.SaveMerged     : 銘柄コード -> 日付 -> OHLCV の構造に集約する。
 *
 * 方針:
 *   本機能はファイルのフィルタ・集計のみで完結する軽量処理のため、
 *   バックエンドAPIを介さずブラウザのJavaScriptのみで処理する（サーバー不要）。
 *   大量ファイル（想定20〜150件・1件あたり約8MB程度）を一度に読み込むため、
 *   メモリ負荷を抑える目的でファイルは並列読込みではなく順次読込みとしている。
 */
(() => {
  const form = document.getElementById("ohlcv-merge-form");
  const filesInput = document.getElementById("ohlcv-files-input");
  const existingMergedInput = document.getElementById("ohlcv-existing-merged-input");
  const codesInput = document.getElementById("ohlcv-codes-input");
  const statusMessage = document.getElementById("ohlcv-status-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const targetFiles = Array.from(filesInput.files).filter((file) => file.name.endsWith(".json"));

    if (targetFiles.length === 0) {
      statusMessage.textContent = "対象のJSONファイルを選択してください。";
      return;
    }

    const targetCodes = new Set(
      codesInput.value.split(",").map((code) => code.trim()).filter((code) => code.length > 0)
    );

    try {
      // 既存のマージ済みJSONが指定されていれば、それをベースに追記する
      // （大量ファイルを複数回に分けて処理する運用向け）
      let merged = {};
      if (existingMergedInput.files.length > 0) {
        const baseText = await readFileAsText(existingMergedInput.files[0]);
        merged = JSON.parse(baseText);
      }

      for (let i = 0; i < targetFiles.length; i += 1) {
        const file = targetFiles[i];
        statusMessage.textContent = `処理中... (${i + 1}/${targetFiles.length})`;

        const date = extractDate(file.name);
        const text = await readFileAsText(file);

        let dayData;
        try {
          dayData = JSON.parse(text);
        } catch {
          // 不正なJSONファイルはスキップ（複数ファイル処理では1件の不正データで
          // 全体を失敗させない方が運用上安全と判断）
          continue;
        }

        mergeDayDataInto(merged, dayData, date, targetCodes);
      }

      const sorted = sortMergedByCodeAndDate(merged);
      downloadAsJsonFile(sorted, "merged_ohlcv.json");
      statusMessage.textContent = "JSONファイルを作成しました。";
    } catch (error) {
      console.error(error);
      statusMessage.textContent = "エラーが発生しました。";
    }
  });

  /** 1日分のOHLCVデータを、対象銘柄コードのみ集約先オブジェクトへ書き込む */
  function mergeDayDataInto(merged, dayData, date, targetCodes) {
    Object.entries(dayData).forEach(([code, ohlcv]) => {
      if (!targetCodes.has(code)) return;

      if (!merged[code]) {
        merged[code] = {};
      }

      merged[code][date] = {
        o: ohlcv?.o ?? null,
        h: ohlcv?.h ?? null,
        l: ohlcv?.l ?? null,
        c: ohlcv?.c ?? null,
        v: ohlcv?.v ?? null,
      };
    });
  }

  /** 銘柄コード -> 日付 の順でキーをソートした新しいオブジェクトを返す */
  function sortMergedByCodeAndDate(merged) {
    const sorted = {};

    Object.keys(merged).sort().forEach((code) => {
      const sortedDates = {};
      Object.keys(merged[code]).sort().forEach((date) => {
        sortedDates[date] = merged[code][date];
      });
      sorted[code] = sortedDates;
    });

    return sorted;
  }

  /** ファイル名から数字のみを抽出して日付とする（C#版 ExtractDate と同等） */
  function extractDate(filename) {
    return (filename.match(/\d/g) || []).join("");
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function downloadAsJsonFile(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
})();

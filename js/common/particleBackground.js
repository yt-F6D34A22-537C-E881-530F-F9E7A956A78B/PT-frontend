/**
 * ページ全体の背景アニメーション（パーティクルネットワーク）。
 * 使用ライブラリ: ParticleNetwork（third-party, MIT License）
 *   https://github.com/JulianLaval/canvas-particle-network
 *   本体は frontend/js/vendor/particleNetwork.min.js に自前ホスティングしている
 *   （GitHub Pages配信時に外部CDNへ依存させないため）。
 *
 * 背景画像は使用せず、style.css の配色に合わせた単色（--color-bg相当）を指定し、
 * パーティクル・線の色は --color-fg相当に合わせている。
 * #particle-canvas は position: fixed でビューポート全体を覆い、
 * z-index を負の値にすることで既存UI（header/nav/main）の背面に配置している
 * （html/body自体には手を加えていない）。
 */
(() => {
  const canvasContainer = document.getElementById("particle-canvas");

  new ParticleNetwork(canvasContainer, {
    particleColor: "#1d2340",
    background: "#ece5d6",
    interactive: true,
    speed: "medium",
    density: "high",
  });
})();

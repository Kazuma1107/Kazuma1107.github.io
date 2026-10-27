# こもれび猫日和 — 保護猫カフェの提案デモ

公開URL: https://kazuma1107.github.io/cat-cafe/

架空の保護猫カフェを題材とする自主制作ポートフォリオ。実店舗・保護活動・譲渡の実績を示すものではありません。フォームはブラウザ内で確認表示するだけで、送信・保存・予約・決済は行いません。

## ページと実装
- index.html: トップ、コンセプト、猫紹介、ご利用案内への導線
- about.html: 店舗コンセプト
- cats.html: 3匹の紹介、性格フィルター、モーダル、猫を指定した相談リンク
- visit.html: 料金計算、利用ルール、サンプル案内図、FAQ
- contact.html: 必須・メール入力チェック、内容確認、入力画面へ戻る
- style.css: 390px/600px/800px/1100px対応、reduced-motion、focus表示
- app.js: 外部ライブラリなし。入力内容の描画にはtextContentを使用。

再生成: リポジトリルートで node tools/build-cat-demo.mjs
編集元: tools/cat-cafe.template.html

## 写真素材
OpenAI組み込みimage_genによるAI生成。生成PNGをWebP品質86で再エンコードし、内容は変更していません。画像を実在の店舗・猫として扱わないでください。
保存先: cat-cafe/assets/hero.webp, mugi.webp, sumi.webp, hana.webp

生成プロンプト:
1. hero: Use case: photorealistic-natural. Asset: hero photograph for a Japanese rescue-cat cafe demonstration website, wide landscape 1536x1024. A relaxed ginger-and-white adult cat on a light oak bench by a large sunlit window in a tasteful small Japanese cat cafe. Soft green trees outside, a cream linen cushion, wooden shelves in background, calm lived-in space. Editorial lifestyle photograph, real whiskers, natural proportions, elegant soft afternoon sunlight, subtle film tones, no oversaturated colors. The cat on right half of image, interior extending left. No people, no lettering, no logo, no watermark.
2. Portrait common: Use case: photorealistic-natural. Square editorial photograph for fictional Japanese rescue cat cafe website. Subject: [subject]. Warm cream minimalist Japanese cafe interior, soft window light, natural cat anatomy, detailed fur, calm authentic lifestyle photograph, cat fills most of frame, no humans, no text, no logo.
   - mugi: ginger-and-white adult cat with golden eyes, lying relaxed on an oak bench
   - sumi: black adult cat with amber eyes, sitting quietly on a cream linen cushion
   - hana: calico adult cat with green eyes, gently playing with a fabric ball on an oak floor

## 検証
デスクトップと390px iframeで視覚確認。猫絞り込み、モーダル、相談対象引き継ぎ、フォーム確認と戻る、90分×6人=11,400円、FAQ開閉、モバイルメニューをブラウザで確認。

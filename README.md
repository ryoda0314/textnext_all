# TextNext（他大版）

大学のメールアドレスで認証した学生同士が、教科書を**同じ大学の中だけで**受け渡しするフリマです。
東京科学大学向けの TextNext（`AntiTextNext`）を参考に、複数の大学で使えるよう作り直しました。

- 登録したメールのドメインで所属大学を判定し、大学ごとにマーケットが分かれます（他大学の出品・プロフィールは見えません）
- `*.ac.jp` のメールは `xxx.ac.jp` 単位で自動的にグループ化（例: `g.ecc.u-tokyo.ac.jp` と `u-tokyo.ac.jp` は同じ「東京大学」）
- `keio.jp` / `waseda.jp` など `.ac.jp` 以外は管理画面で大学に紐づけ
- 東京科学大学（`isct.ac.jp` / `titech.ac.jp` / `tmd.ac.jp`）は既存サービス（textnext.jp）へ案内
- Supabase は東工大版とは**別プロジェクト**。消すときはプロジェクトごと削除するだけで、東工大版には一切影響しません

## 技術スタック

Next.js 16（App Router / Turbopack / `proxy.ts`）・React 19・Tailwind CSS 4・TanStack Query・Supabase（Postgres / Auth / Storage / Realtime / pg_cron / pg_net）・Web Push（PWA）

## ローカルで動かす

必要なもの: Node.js 20.9 以上、Docker Desktop

```bash
npm install
npm run db:start        # ローカル Supabase（ポート 563xx。他プロジェクトの 543xx/553xx とは衝突しません）
cp .env.example .env.local   # 値は `npx supabase status` の出力（下記参照）
npm run db:seed         # テスト大学とテストアカウントを作成（下記）
npm run dev             # http://localhost:3000
```

- 確認コードのメールは Mailpit（http://127.0.0.1:56324）に届きます
- 新規登録を試すときは `xxx@test-univ.ac.jp`（テスト大学に入る）や `xxx@st.sample-u.ac.jp` のような架空の `.ac.jp` アドレスが使えます（ローカルではメールは外部に送られません）
- `.env.local` の Supabase の値: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` と `SUPABASE_SECRET_KEY` は `npx supabase status` に表示されるもの
- Web Push 用の鍵は `npx web-push generate-vapid-keys` で作成

| コマンド | 内容 |
| --- | --- |
| `npm run db:seed` | テストデータを作成（ローカル専用。作り直すときは先に `db:reset`） |
| `npm run db:test` | DB のテスト（大学間の分離・RLS・取引の状態遷移など 61 項目）。ロールバックされるのでデータは残りません |
| `npm run db:reset` | マイグレーションとシードを入れ直す（ローカルのデータはすべて消えます） |
| `npm run db:types` | `lib/database.types.ts` を DB から再生成 |
| `npm run db:stop` | ローカル Supabase を停止 |
| `npm run typecheck` / `npm run lint` / `npm run build` | 型チェック / ESLint / 本番ビルド |

### テストデータ

`npm run db:seed` で、架空の「テスト大学」に出品・取引・評価・通知がひととおり入った状態を作ります。パスワードはすべて `test1234` です。

| アカウント | 立場 | 見られる画面 |
| --- | --- | --- |
| `taro@test-univ.ac.jp`（たろう・工学部3年） | 出品の多い先輩 | 届いたばかりの取引リクエスト、出品一覧、評価 |
| `hanako@test-univ.ac.jp`（はなこ・理学部1年） | 購入中心の1年生 | 出品者からの日程の再提案、入荷通知、いいね |
| `kenta@test-univ.ac.jp`（けんた・経済学部2年） | 出品も購入も | 「普通」の評価、キャンセルされた取引 |
| `sakura@test-univ.ac.jp`（さくら・文学部M1） | 出品者 | 受け渡し後、自分の評価がまだの取引 |
| `yuto@test-univ.ac.jp`（ゆうと・工学部1年） | 購入者 | 明日受け渡し予定の取引 |
| `jiro@sample-univ.ac.jp`（じろう） | 別の「サンプル大学」の学生 | テスト大学の出品が見えないことの確認 |
| `admin@example.com` | 運営 | `/admin`（未対応の通報・お問い合わせ・大学リクエストが1件ずつ） |

- 取引は「リクエスト中・日程の再提案・受け渡し予定・評価待ち・完了・キャンセル」の各状態があり、日時は数週間分の利用に見えるよう過去にずらしてあります
- 出品写真は `scripts/seed/photos.mjs` が表紙を描いて生成します。アカウントや本を増やすときは `scripts/seed/data.mjs` を編集してください
- ローカルの Supabase 以外には実行できないようにしてあります

## 本番環境の作り方

### 1. Supabase（新規プロジェクト）

1. Supabase で**新しいプロジェクト**を作成（リージョンは Tokyo 推奨）
2. マイグレーションを適用
   ```bash
   npx supabase login
   npx supabase link --project-ref <プロジェクトID>
   npx supabase db push
   ```
3. ダッシュボードの Authentication で設定
   - **Sign In / Providers → Email**: Confirm email を ON、Email OTP Length を `6`、Email OTP Expiration を `1800`、最小パスワード長 `8`
   - **URL Configuration**: Site URL を本番 URL（例 `https://example.com`）
   - **Emails → Templates**: 「Confirm signup」と「Reset password」の件名・本文を `supabase/templates/confirmation.html` / `recovery.html` の内容に（件名は `supabase/config.toml` 参照）。リンクではなく 6 桁コード（`{{ .Token }}`）で認証する方式です
   - **Emails → SMTP Settings**: 独自の SMTP を設定（Supabase 標準のメール送信は1時間あたりの上限が非常に少ないため）
   - **Hooks → Before User Created**: Postgres 関数 `public.hook_before_user_created` を指定（未対応ドメインに分かりやすいエラーを返します。未設定でも DB のトリガーが同じ判定で登録を拒否します）
4. SQL Editor で運営設定を登録
   ```sql
   -- 管理者にするメールアドレス（大学メール以外でも可）
   insert into public.admin_email_allowlist (email) values ('you@example.com');

   -- 通知（Web Push / メール）の配信先。secret は Vercel の PUSH_DISPATCH_SECRET と同じ値
   insert into private.settings (key, value) values
     ('dispatch_url', 'https://example.com/api/push/dispatch'),
     ('dispatch_secret', '<ランダムな長い文字列>')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```

### 2. Vercel

リポジトリをインポートし、環境変数を設定します（一覧は `.env.example`）。

| 変数 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase の URL と publishable key（旧 anon key でも可） |
| `SUPABASE_SECRET_KEY` | secret key（旧 service_role key でも可）。サーバー専用 |
| `NEXT_PUBLIC_APP_URL` | 本番 URL（QR コードや共有リンクに使用） |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push |
| `PUSH_DISPATCH_SECRET` | 上の `dispatch_secret` と同じ値 |
| `CRON_SECRET` | `vercel.json` の日次ジョブ（古いチャット画像の削除）用 |
| `SMTP_URL` / `MAIL_FROM` | 任意。重要な通知をメールでも送る場合 |
| `GOOGLE_BOOKS_API_KEY` | 任意。ISBN 検索の予備 |
| `CALIL_APP_KEY` | 任意。大学ごとに「カーリル システムID」を設定すると、商品ページに大学図書館の蔵書状況を表示 |

### 3. 公開前の確認

- `lib/legal.ts` の利用規約・プライバシーポリシーは旧版をもとにした**案**です。運営者名・裁判管轄などを確定してください
- 管理画面「大学」で大学一覧（`supabase/migrations/20261003000011_university_directory.sql` の初期データ）を確認し、必要ならキャンパスと受け渡し場所を追加してください

### 消すとき

Supabase のプロジェクト削除（Project Settings → General → Delete project）で、データベース・登録ユーザー・画像がすべて消えます。あとは Vercel のプロジェクトを削除するだけです。東工大版の Supabase / Vercel には一切触れていません。

## 運用

- **新しい大学**: `.ac.jp` なら登録時に自動でグループができ、管理画面に「名前の確認待ち」として出ます。会員が提案した正式名称をワンクリックで承認できます
- **`.ac.jp` 以外のドメイン**: 登録画面から届く「大学リクエスト」を確認し、管理画面で大学とドメインを追加
- **重複したグループ**（同じ大学が別ドメインで2つできた等）: 大学の詳細画面から統合
- **通報・お問い合わせ・利用制限**: 管理画面から対応。BAN したメールアドレスは再登録もできません

## 仕組み（旧版からの主な変更点）

| | 旧版 | 他大版 |
| --- | --- | --- |
| 大学メールの判定 | Next.js の API のみ（Supabase の signUp を直接呼ぶと回避可能） | DB のトリガーと Auth Hook で強制 |
| データの分離 | 単一大学前提（`USING (true)` の RLS あり） | 全テーブルを大学単位の RLS で分離 |
| 取引の状態変更 | 一部クライアントから `transactions` を直接 update | すべて DB の RPC 経由（誰が何をできるかを関数内で検証） |
| 購入リクエスト | 10分間の購入権ロック＋カウントダウン | ロックなしで即送信。取引中の本は「いいね」すると再出品時に通知 |
| 日程調整 | 自由記述の候補＋本文の文字列判定 | 大学ごとの時間帯・受け渡し場所から選ぶ構造化データ。提案→確定を何度でも |
| 受け渡し確認 | QR（トークンは取引行に保存） | QR＋6桁コード。コードは買い手から読めない非公開テーブルに保存、5回失敗で無効 |
| 評価 | 5段階、即時表示 | 良かった/普通/残念の3段階。双方がそろうか7日後に公開（報復評価の防止） |
| 放置された取引 | 手動対応 | 7日やり取りがない相談・予定日を過ぎた取引を自動終了、当日リマインド |
| 通知 | 画面側から通知APIを呼ぶ | DB に通知が入ると pg_net で配信 API が呼ばれる（取りこぼしなし） |
| 画像 | Cloudflare R2 | Supabase Storage（プロジェクト削除で一緒に消える）。端末側で WebP に変換し位置情報などを除去 |
| ISBN キャッシュ | anon キーで書き込み可能 | サーバーのみ書き込み可能 |

ディレクトリ:

```txt
app/(auth)/      登録・ログイン・パスワード再設定・初回プロフィール
app/(member)/    会員向け画面（ホーム・検索・商品・出品・取引・お知らせ・マイページ・設定）
app/(public)/    紹介ページ・規約・お問い合わせ
app/admin/       管理画面
app/api/         ISBN検索・図書館・Push配信・退会・定期削除
components/      UI 部品（components/ui）と機能別コンポーネント（trade/, sell/）
lib/             Supabase クライアント、定数、エラー文言、画像処理、取引の状態判定
supabase/        マイグレーション・テスト・メールテンプレート・ローカル設定
proxy.ts         セッション更新と未ログイン時のリダイレクト（Next.js 16 で middleware から改名）
```

旧版にあって今回入れていないもの: Capacitor のネイティブアプリ（PWA で代替）、Stripe 決済（旧版の規約どおり対面で直接支払い）、App Store 審査用デモ、早期登録特典、アクセス解析、英語表示、東京科学大学のシラバス連携（授業名・学部での検索で代替）。
#   t e x t n e x t _ a l l  
 
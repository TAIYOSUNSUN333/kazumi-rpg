# BGM管理画面の公開

既存のNetlifyサイトをGitHubの `TAIYOSUNSUN333/kazumi-rpg` に接続し、本番ブランチを `main` に設定します。既存のサイトで設定済みの場合はそのまま使います。

Netlifyの環境変数を Functions の実行環境に設定します。リポジトリ、クライアント用コード、会話には値を書き込まないでください。

| 環境変数 | 内容 |
| --- | --- |
| `BGM_ADMIN_KEY` | `openssl rand -hex 32` で生成した64桁の管理キー。管理者本人のパスワードマネージャーに保管します。 |
| `BGM_GITHUB_TOKEN` | 対象リポジトリだけにアクセス可能で、Contents の読み取りと書き込みを許可した GitHub fine-grained トークン。 |
| `BGM_PUBLIC_URL` | QRコードを独自ドメインに固定する場合の本番サイトURL。任意。 |

変数を設定後に再デプロイすると、本番サイトの `/bgm-admin/` から利用できます。画面の「管理画面のURL・QRコード」で直接URLとQRコードを表示します。QRコードに管理キーは含まれません。MP3は1曲につき4 MiBまで。アップロード、差し替え、削除でGitHubの `main` にコミットします。公開の確認は配信中のMP3をGitHubのファイルと照合します。GitHub Pagesからはサーバー処理を利用できません。

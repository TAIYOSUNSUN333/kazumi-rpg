# BGM管理画面のGitHubログイン

管理画面はGitHubアカウント `TAIYOSUNSUN333` のログインを受け付けます。

1. [GitHubのOAuth App登録](https://github.com/settings/applications/new)を開きます。アプリ名は任意です。Homepage URLに `https://kazumi-rpg.netlify.app/bgm-admin/`、Authorization callback URLに `https://kazumi-rpg.netlify.app/.netlify/functions/bgm-admin?auth=callback` を指定します。
2. 登録後、Client IDを確認し、Client secretを生成します。
3. Netlifyの **Project configuration → Environment variables** で、Client IDを `BGM_OAUTH_CLIENT_ID`、Client secretを `BGM_OAUTH_CLIENT_SECRET` に登録します。対象は **Production**、スコープは **Functions** に設定します。音源の保存に使用する `BGM_GITHUB_TOKEN` は登録済みの値を使用できます。新規の場合は対象リポジトリのContents読み取り・書き込み権限を付けます。
4. 本番を再デプロイし、BGM管理画面の「GitHubでログイン」を使います。旧変数 `BGM_ADMIN_KEY` は削除できます。

Client secretとGitHubトークンの値はNetlifyの設定にだけ入力してください。GitHubから受け取るログイン用トークンは本人確認に使います。音源は1曲4 MiB以下のMP3です。QRコードにはURLのみが入ります。

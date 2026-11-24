# Philia — SillyTavern Extension

将原 Philia 酒馆助手脚本转换为 SillyTavern UI 扩展。当前版本保留原脚本主体逻辑、界面和本地数据键。

## 安装

1. 先在酒馆助手脚本管理中停用原来的 Philia 脚本，避免两份入口重复运行。
2. 解压本压缩包，得到包含 `manifest.json` 和 `index.js` 的 `Philia-Extension` 文件夹。
3. 将整个文件夹放入当前用户的 `data/<用户名>/extensions/` 目录中；也可以放入酒馆安装目录的 `public/scripts/extensions/third-party/` 供所有用户使用。
4. 刷新酒馆页面，在「扩展」面板中确认并启用 Philia。
5. 打开魔法棒菜单，点击 Philia。

## 数据兼容

扩展继续使用原脚本的 localStorage 数据键（包括 `bgmgr_theme_map`、`bgmgr_cfg`、`bgmgr_theme_meta` 等），不会主动清空原有设置。

## 注意

- 本转换基于原始 `酒馆助手脚本-Philia (3).json` 的 `content` 代码，保留原有功能实现；尚未在你的具体酒馆版本和 Android WebView 环境中实机验证。
- 首次启用后请检查背景列表、主题列表、应用/绑定、上传删除和预览功能。
- 如需回退，停用扩展并重新启用原酒馆助手脚本即可；不要同时启用两者。


## 从 GitHub 安装

将本仓库地址复制到 SillyTavern 的「扩展」安装入口中。仓库根目录必须直接包含 `manifest.json`、`index.js` 和 `README.md`。

## 发布新版本

更新代码后，修改 `manifest.json` 中的 `version`，再提交并推送到 GitHub。若酒馆端没有自动更新，可在扩展管理中手动更新或重新安装。

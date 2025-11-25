# 部署说明（示例）

方案 A（推荐，适合非技术用户）：
- 静态页面部署到 Netlify / Vercel / GitHub Pages（自动 HTTPS）。
- 后端 Node.js 部署到 Render / Railway / Heroku（支持 WebSocket）。

方案 B（单台服务器 + 反向代理）：
- 把后端和静态页放到同一台 VPS（Docker）上，用 Caddy/Nginx 做 TLS + 反向代理，使用 Let's Encrypt 自动签发证书。

根据你选的方案，下面会有详细步骤。
``` ````

接下来是逐步部署步骤（以 Netlify + Render 为示例），包含常见命令和配置。

1) 准备代码并推到 GitHub
- 在本地创建项目目录，把上面 server.js、package.json、client.html 放进去（client.html 可以放到 /public 或单独 repo）。
- 初始化 git，push 到 GitHub：
  - git init
  - git add .
  - git commit -m "init"
  - git branch -M main
  - git remote add origin git@github.com:你的账号/仓库名.git
  - git push -u origin main

2) 部署后端到 Render（示例）
- 注册并登录 Render（https://render.com），连接 GitHub 授权。
- 新建 "Web Service"：
  - 选择你的后端仓库
  - 构建命令：npm install
  - 启动命令：npm start
  - 环境：Node
  - 端口：Render 会提供 PORT 环境变量，server.js 已使用 process.env.PORT，所以无需改动
- 点击部署。部署成功后你会得到一个 https://<your-service>.onrender.com URL。
- Render 自带 HTTPS（Let's Encrypt），并支持 WebSocket。你不需要在代码里处理 TLS。

如果你用 Railway / Heroku /Fly：
- Railway：直接 connect repo，按提示部署。Railway 支持 WebSocket。
- Heroku：git push heroku main（Heroku 支持 WebSocket，但免费/旧策略可能有变化）。
- Fly.io：推荐使用 Docker 或 flyctl，适合更自定义的部署。

3) 部署静态 HTML 到 Netlify（或 GitHub Pages / Vercel）
- Netlify（最简单）：
  - 登录 Netlify，选择 “New site from Git”
  - 选择包含 client.html 的仓库/分支
  - Build command: （留空或不需要），Publish directory: （如果把 client.html 放在根目录则填 /）
  - 部署后 Netlify 会给你 https://your-site.netlify.app（HTTPS 自动启用）
- 或者把 client.html push 到 GitHub Pages（仓库 Settings -> Pages），也会得到 HTTPS。

4) 连接与测试
- 在 client.html 中把 WS_URL 改为 wss://你的后端域名/ws （如果后端提供了 /ws 路径）。
- 打开部署好的静态页面（https://your-site.netlify.app），点击连接，应该能连接并收发消息。
- 若连接失败，打开浏览器 DevTools 看控制台/Network -> WS 握手错误信息（常见是 Mixed Content、403/401、CORS/Origin 被拒绝）。

可选：把前端与后端放在同域（更少跨域问题）
- 方案 1：把静态文件也放到同一 Render 服务（Render 可以同时做静态站点，或后端服务同时响应静态文件）。
- 方案 2（更专业）：在 VPS 上运行 Docker，然后用 Caddy/Nginx 做反向代理并开启 HTTPS，这样前端访问 https://yourdomain/，WebSocket 连接到 wss://yourdomain/ws。

示例 Caddyfile（自动 TLS）：
```name=Caddyfile
yourdomain.com {
  reverse_proxy /ws* localhost:8080
  file_server {
    root /var/www/html
  }
}
```
- 把静态文件放到 /var/www/html，后端在 8080 上监听。Caddy 会自动从 Let's Encrypt 获取证书，并把 /ws 路径代理到后端（保持 wss）。

常见问题与解决办法（快速列表）
- Mixed Content：页面是 HTTPS，WebSocket URL 必须是 wss://。
- Self-signed 证书：浏览器会阻止，需要用户信任证书 —— 所以尽量用 Let's Encrypt 或 PaaS 自动证书。
- Origin 校验：如果服务器校验 Origin header，确保将你的静态站点域名加入允许列表。
- 防火墙/端口：PaaS 一般处理端口转发；自建 VPS 要确保 80/443/你后端端口开放，且有反向代理。
- 路径与代理：如果你在后端把 WebSocket 挂在 /ws，client 必须连接到 /ws；反向代理也要正确转发 WebSocket。

我可以帮你做的具体事情（选一个或多个）：
- 为你生成一个完整 GitHub 仓库结构（包含 server.js、package.json、Dockerfile、client.html、README）并给出一键部署到 Render + Netlify 的具体操作说明。
- 或者只给出「使用 Caddy 在 VPS 上部署并绑定域名」的详细步骤（包括域名解析、Caddy 安装命令、Docker Compose 示例）。
- 或者帮你把现有 Unity 脚本适配为连接线上服务的示例（修改地址、加上可配置域名/端口）。

你想先用哪种方式部署？（A: 推荐的 Netlify + Render，B: 全部放同一 VPS + Caddy，C: 我帮你生成完整 GitHub 仓库文件并给出一键部署步骤）
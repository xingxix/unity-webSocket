// 最小广播型 WebSocket 转发服务（用于本地测试）
// 使用方法：在该目录运行 `npm init -y` `npm install ws` 然后 `node server.js`
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
// const jwt = require('jsonwebtoken'); // 可选：若不需要鉴权，移除相关代码

// 配置（可通过环境变量覆盖）
const WS_PATH = process.env.WS_PATH || '/ws';
const PING_INTERVAL_MS = process.env.PING_INTERVAL_MS ? parseInt(process.env.PING_INTERVAL_MS,10) : 20000; // 心跳间隔
const PONG_TIMEOUT_MS = process.env.PONG_TIMEOUT_MS ? parseInt(process.env.PONG_TIMEOUT_MS,10) : 30000;   // 未 pong 则断开
const MAX_CONNECTIONS = process.env.MAX_CONNECTIONS ? parseInt(process.env.MAX_CONNECTIONS,10) : 1000;
const MAX_PAYLOAD = process.env.MAX_PAYLOAD ? parseInt(process.env.MAX_PAYLOAD,10) : 64 * 1024 * 1024; // ws maxPayload
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const unityMap = new Map();      // clientId -> Unity ws
const controllerMap = new Map(); // clientId -> Controller ws

// 简单的 token 验证函数（示例）
// 你可以改成查询 redis/session store，或验证 JWT 等
// function verifyTokenFromReq(req) {
//   // 示例：token 可放在 query ?token=... 或 header: Authorization: Bearer ...
//   const parsed = url.parse(req.url, true);
//   const token = parsed.query && parsed.query.token ? parsed.query.token : (req.headers['authorization'] || '').split(' ')[1];
//   if (!token) return { ok: false, code: 401, message: 'no token' };
//   try {
//     //那如果真要用token的话这里要改
//     const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret-example');
//     return { ok: true, payload };
//   } catch (e) {
//     return { ok: false, code: 403, message: 'invalid token' };
//   }
// }

//竟然是http
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server running\n');
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocket.Server({ server, path: '/ws' });
wss.on('connection', (ws) => {
    // clientInfo 是我们传入的自定义数据（如验证 payload / ip）
    // 随机的id啊
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  ws._id = id;
  ws._isAlive = true;           // 心跳标记
  ws._createdAt = Date.now();
  // ws._meta = clientInfo || {};
  // console.log(`[connect] id=${id} ip=${ws._meta.ip} auth=${!!ws._meta.authPayload} total=${wss.clients.size}`);
  console.log(`[connect] id=${id} total=${wss.clients.size}`);
    ws.on('pong', () => {
    // 客户端响应服务器 ping，标记为活跃
    ws._isAlive = true;
  });
  ws.on('message', (message) => {
    const msg = message.toString();
    console.log('recv:', msg);
    //心跳一下
        try {
        const obj = JSON.parse(msg);
        if(obj.type === 'ping'){
          console.log('何意味，为什么不打印这句话nnd！');
          console.log('pong received');
            ws._isAlive = true;      // 标记存活
            return;                  // 不广播心跳包
        }
        //这俩if是绑定用的
        if (obj.type === 'register') {
    unityMap.set(obj.unityClientId, ws);
    ws._clientId = obj.unityClientId;
    console.log("Unity 注册:", obj.unityClientId);

    // 如果网页已经绑定了，则通知网页 Unity 上线
    if (controllerMap.has(obj.unityClientId)) {
        controllerMap.get(obj.unityClientId).send(JSON.stringify({ type: "unityOnline" }));
    }
    return;
    }
    if (obj.type === 'bind') {
    controllerMap.set(obj.unityClientId, ws);
    ws._clientId = obj.unityClientId;
    console.log("Controller 绑定:", obj.unityClientId);

    // 如果 Unity 已在线 → 通知网页可以开始控制
    if (unityMap.has(obj.unityClientId)) {
        ws.send(JSON.stringify({ type:"ok", msg:"Unity found" }));
    }
    else {
        ws.send(JSON.stringify({ type:"waiting", msg:"Waiting for Unity..." }));
    }
    return;
    }
    } catch(e){}
    // 简单广播：把收到的消息转发给所有已连接客户端（包括发送者）
    //不广播了，只能发给对应clientId的另一端
    const id = ws._clientId;

    // 如果当前 ws 是 Unity 发来的 → 转发给 Controller
    if (unityMap.get(id) === ws) {
        const target = controllerMap.get(id);
        if (target && target.readyState === WebSocket.OPEN) {
            target.send(msg);
        }
        return;
    }

    // 如果当前 ws 是 Controller 发来的 → 转发给 Unity
    if (controllerMap.get(id) === ws) {
        const target = unityMap.get(id);
        if (target && target.readyState === WebSocket.OPEN) {
            target.send(msg);
        }
        return;
    }
  });

// 心跳定时：周期性给客户端发送 ping，并清理超时的 client
const pingInterval = setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    if (ws._isAlive === false) {
      console.log(`[terminate] id=${ws._id}`);
      try { ws.terminate(); } catch (_) {}
      continue;
    }

    // 标记为将要检查（若下次还是 false 则断开）
    ws._isAlive = false;
    try{
      ws.ping();
    }catch(e){

    }
  }
}, PING_INTERVAL_MS);

let shuttingDown = false;
function gracefulShutdown(timeoutMs = 30000) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Graceful shutdown start');

  // 1) 停止接受新连接
  server.close((err) => {
    if (err) console.error('server.close err', err);
    else console.log('Server stopped accepting new connections');
  });

  // 2) 关闭 heartbeat
  clearInterval(pingInterval);

  // 3) 通知所有 websocket 客户端关闭
  for (const ws of wss.clients) {
    try {
      ws.close(1001, 'Server shutting down'); // 1001 指客户端离开
    } catch (e) {
      try { ws.terminate(); } catch (_) {}
    }
  }

  // 4) 强制在 timeout 后清理残留连接
  setTimeout(() => {
    for (const ws of wss.clients) {
      try { ws.terminate(); } catch (_) {}
    }
    // 关闭 wss（触发 'close'）
    try { wss.close(); } catch (_) {}
    console.log('Graceful shutdown completed (forced)');
    process.exit(0);
  }, timeoutMs).unref();
}

  ws.on('close', () => console.log('client disconnected'));
  ws.on('error', (e) => console.error('ws error', e));
});

server.listen(PORT, '0.0.0.0', () => {
  const addr = server.address();
  console.log(`Listening on ${addr.address}:${addr.port}`);
  console.log(`WebSocket path: ${WS_PATH}`);
  console.log(`Ping interval: ${PING_INTERVAL_MS}ms; Pong timeout ~${PONG_TIMEOUT_MS}ms`);
});
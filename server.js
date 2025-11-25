// 最小广播型 WebSocket 转发服务（用于本地测试）
// 使用方法：在该目录运行 `npm init -y` `npm install ws` 然后 `node server.js`
const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({host: '127.0.0.1', port: PORT }, () => {
  console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('client connected');

  ws.on('message', (message) => {
    const msg = message.toString();
    console.log('recv:', msg);
    // 简单广播：把收到的消息转发给所有已连接客户端（包括发送者）
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  ws.on('close', () => console.log('client disconnected'));
  ws.on('error', (e) => console.error('ws error', e));
});
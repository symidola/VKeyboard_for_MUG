# VKeyboard_for_MUG

一个“平板当键盘、PC 当接收端”的局域网虚拟键盘原型。

- 服务端：Node.js（WebSocket，低延迟转发）
- 前端：React + TypeScript（平板/手机浏览器作为键盘界面，也可作为接收器调试界面）
- Windows 注入器：Node.js + AutoHotkey v2（系统级按键注入）

> 说明：浏览器内置“接收器”仅用于调试展示；要把按键真正打到 Windows 任意应用里，请运行本仓库的 Windows 注入器（见下方）。

## 快速开始（开发模式）

1) 安装依赖（根目录执行）

```bash
npm install
```

2) 启动开发（会同时起 server:8080 + client:5173）

```bash
npm run dev
```

3)（可选）开启 Windows 系统级注入（需要 AutoHotkey v2）

- 安装 AutoHotkey v2
- 运行注入器（在同一台 Windows PC 上执行）：

```bash
npm -w injector run dev -- --server ws://127.0.0.1:8080/ws
```

如果你要注入到“以管理员运行”的目标应用，injector 也需要用管理员权限启动。

4) 局域网访问

- 在 Windows PC 上启动后，用平板打开：`http://<PC的局域网IP>:5173/`
- WebSocket 默认连到：`ws://<PC的局域网IP>:8080/ws`

## 低延迟建议

- 优先使用同一交换机/路由器下的有线网络（平板可用 USB/网口转接器）
- 避免跨路由、访客网络、复杂 Mesh
- 关闭省电导致的 Wi‑Fi 休眠（如不得不用 Wi‑Fi）

## 功能

- 自定义键盘布局（JSON）
- 可调整按键大小（宽度/高度单位）
- 主题切换（亮/暗）
- 键盘事件通过 WebSocket 广播给接收器（用于调试、未来可对接系统注入）

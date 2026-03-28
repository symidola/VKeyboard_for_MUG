# Windows Injector

该模块用于 **Windows 系统级按键注入**。

实现方式：
- Node.js 作为 WebSocket 接收器连接到 `server`
- 通过 AutoHotkey v2 进行系统级按键注入（低延迟、易部署）

## 依赖

- Windows
- 安装 AutoHotkey v2（推荐）
  - 默认会尝试自动在常见目录找到 `AutoHotkey64.exe`
  - 或运行时用 `--ahk <path>` 指定

## 运行

```bash
npm -w injector run dev -- --server ws://127.0.0.1:8080/ws
```

如果 server 在同一台 PC 上：默认就是 `ws://127.0.0.1:8080/ws`。

## 权限说明

- 只能注入到与当前进程权限同级的窗口。
- 若目标应用以管理员运行，injector 也需要以管理员启动。

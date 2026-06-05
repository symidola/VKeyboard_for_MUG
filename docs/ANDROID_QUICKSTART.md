# Android APK Quickstart (Windows)

本指南用于在无 Mac 的情况下，快速把当前前端打成 Android APK 并在手机实机测试。

## 1. 前置环境

- 安装 Android Studio（包含 Android SDK）
- 安装 JDK 17（Android Studio 自带即可）
- 确保 adb 可用（Android Studio 安装后一般可用）

## 2. 安装依赖

在仓库根目录执行：

npm install

## 3. 一次性初始化 Android 壳

在仓库根目录执行：

npm -w client run android:add

如果已存在 client/android 目录，可跳过此步。

## 4. 同步 Web 资源并打开 Android 工程

在仓库根目录执行：

npm -w client run android:prepare
npm -w client run android:open

Android Studio 打开后等待 Gradle 同步完成。

## 5. 连接局域网服务端（关键）

当前客户端支持 4 种 WS 地址来源，优先级从高到低：

1. URL 参数 ws
2. localStorage vk_ws_url
3. 环境变量 VITE_WS_URL
4. 默认推导 ws://<当前主机>:8080/ws

推荐做法（最简单）：

- 首次启动 APK 后，给 URL 带参数：
  ?ws=ws://你的电脑局域网IP:8080/ws

示例：

?ws=ws://192.168.31.20:8080/ws

程序会自动把该地址写入 vk_ws_url，下次可不带参数。

## 6. 打包 Debug APK

在 Android Studio 中：

- Build -> Build Bundle(s) / APK(s) -> Build APK(s)

或用 Gradle 命令：

cd client/android
./gradlew assembleDebug

产物通常在：

client/android/app/build/outputs/apk/debug/app-debug.apk

## 7. 常见问题

- 连接不上 WS：
  - 确认手机和电脑同一局域网
  - 确认电脑防火墙放行 8080
  - 确认 server 正在监听 0.0.0.0:8080

- android:add 失败：
  - 先执行 npm install
  - 确认 Android Studio 与 SDK 已安装

- 触控仍异常：
  - 这可能仍是 WebView 层限制
  - 下一阶段建议迁移到原生触控采集（Kotlin/Compose）

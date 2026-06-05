import Foundation
import UIKit

@MainActor
final class KeyboardSocketClient: ObservableObject {
  @Published var statusText: String = "disconnected"
  @Published var peerCount: Int = 0
  @Published var sentEdgeCount: Int = 0
  @Published var lastError: String = ""

  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.default
    config.waitsForConnectivity = true
    return URLSession(configuration: config)
  }()

  private var socketTask: URLSessionWebSocketTask?
  private var heartbeatTimer: Timer?
  private var reconnectWorkItem: DispatchWorkItem?

  private var seqByKey: [String: Int] = [:]
  private var pressedKeys: Set<String> = []
  private var keyMeta: [String: (label: String, code: String?)] = [:]

  private var isManuallyClosed: Bool = false
  private var serverURLString: String = ""

  func connect(serverURL: String) {
    serverURLString = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let url = URL(string: serverURLString) else {
      statusText = "invalid-url"
      lastError = "Invalid websocket URL"
      return
    }

    disconnect(resetManualFlag: false)
    isManuallyClosed = false
    statusText = "connecting"
    lastError = ""

    let task = session.webSocketTask(with: url)
    socketTask = task
    task.resume()

    receiveLoop(task: task)
    sendHello()
    startHeartbeat()
  }

  func disconnect(resetManualFlag: Bool = true) {
    if resetManualFlag {
      isManuallyClosed = true
    }

    heartbeatTimer?.invalidate()
    heartbeatTimer = nil

    reconnectWorkItem?.cancel()
    reconnectWorkItem = nil

    socketTask?.cancel(with: .goingAway, reason: nil)
    socketTask = nil

    statusText = "disconnected"
  }

  func sendDown(_ key: NativeKey) {
    keyMeta[key.id] = (key.label, key.code)
    let old = pressedKeys.contains(key.id)
    if !old {
      pressedKeys.insert(key.id)
    }
    bumpSeq(for: key.id)
    sendEdge(action: "down", key: key)
    sendState(source: "edge")
  }

  func sendUp(_ key: NativeKey) {
    keyMeta[key.id] = (key.label, key.code)
    let old = pressedKeys.contains(key.id)
    if old {
      pressedKeys.remove(key.id)
    }
    bumpSeq(for: key.id)
    sendEdge(action: "up", key: key)
    sendState(source: "edge")
  }

  private func bumpSeq(for keyId: String) {
    seqByKey[keyId] = (seqByKey[keyId] ?? 0) + 1
  }

  private func sendHello() {
    let name = UIDevice.current.name
    let hello = HelloMessage(deviceName: "ios-native-\(name)")
    send(hello)
  }

  private func sendEdge(action: String, key: NativeKey) {
    let msg = KeyEventMessage(action: action, keyId: key.id, label: key.label, code: key.code)
    send(msg)
    sentEdgeCount += 1
  }

  private func sendState(source: String) {
    var ids = Set<String>()
    ids.formUnion(pressedKeys)
    ids.formUnion(keyMeta.keys)
    ids.formUnion(seqByKey.keys)

    let items = ids.map { keyId -> KeyStateItem in
      let meta = keyMeta[keyId] ?? (label: keyId, code: nil)
      return KeyStateItem(
        keyId: keyId,
        label: meta.label,
        code: meta.code,
        pressed: pressedKeys.contains(keyId),
        seq: seqByKey[keyId] ?? 0
      )
    }
    .sorted { $0.keyId < $1.keyId }

    let msg = KeyStateMessage(keys: items, source: source)
    send(msg)
  }

  private func startHeartbeat() {
    heartbeatTimer?.invalidate()
    heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 0.06, repeats: true) { [weak self] _ in
      guard let self else { return }
      Task { @MainActor in
        self.sendState(source: "heartbeat")
      }
    }
  }

  private func receiveLoop(task: URLSessionWebSocketTask) {
    task.receive { [weak self] result in
      guard let self else { return }
      Task { @MainActor in
        switch result {
        case .failure(let error):
          self.statusText = "disconnected"
          self.lastError = error.localizedDescription
          self.scheduleReconnectIfNeeded()

        case .success(let message):
          self.statusText = "connected"
          self.handleIncoming(message)
          self.receiveLoop(task: task)
        }
      }
    }
  }

  private func handleIncoming(_ message: URLSessionWebSocketTask.Message) {
    let text: String
    switch message {
    case .string(let s):
      text = s
    case .data(let d):
      text = String(data: d, encoding: .utf8) ?? ""
    @unknown default:
      text = ""
    }

    guard !text.isEmpty,
          let data = text.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let type = obj["type"] as? String else {
      return
    }

    if type == "state", let clients = obj["clients"] as? [[String: Any]] {
      peerCount = clients.count
    }
  }

  private func scheduleReconnectIfNeeded() {
    guard !isManuallyClosed, !serverURLString.isEmpty else { return }
    reconnectWorkItem?.cancel()

    let item = DispatchWorkItem { [weak self] in
      Task { @MainActor in
        guard let self, !self.isManuallyClosed else { return }
        self.connect(serverURL: self.serverURLString)
      }
    }
    reconnectWorkItem = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: item)
  }

  private func send<T: Encodable>(_ payload: T) {
    guard let socketTask else { return }
    guard let data = try? JSONEncoder().encode(payload),
          let text = String(data: data, encoding: .utf8) else {
      return
    }

    socketTask.send(.string(text)) { [weak self] error in
      guard let self, let error else { return }
      Task { @MainActor in
        self.lastError = error.localizedDescription
        self.statusText = "send-error"
      }
    }
  }
}

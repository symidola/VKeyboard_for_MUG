import Foundation

struct HelloMessage: Codable {
  let type: String
  let role: String
  let deviceName: String?

  init(deviceName: String?) {
    self.type = "hello"
    self.role = "keyboard"
    self.deviceName = deviceName
  }
}

struct KeyEventMessage: Codable {
  let type: String
  let action: String
  let keyId: String
  let label: String
  let code: String?
  let ts: Int64

  init(action: String, keyId: String, label: String, code: String?) {
    self.type = "key"
    self.action = action
    self.keyId = keyId
    self.label = label
    self.code = code
    self.ts = Int64(Date().timeIntervalSince1970 * 1000)
  }
}

struct KeyStateItem: Codable {
  let keyId: String
  let label: String
  let code: String?
  let pressed: Bool
  let seq: Int
}

struct KeyStateMessage: Codable {
  let type: String
  let ts: Int64
  let keys: [KeyStateItem]
  let source: String

  init(keys: [KeyStateItem], source: String) {
    self.type = "key_state"
    self.ts = Int64(Date().timeIntervalSince1970 * 1000)
    self.keys = keys
    self.source = source
  }
}

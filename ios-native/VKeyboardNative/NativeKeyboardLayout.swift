import CoreGraphics

struct NativeKey: Identifiable {
  let id: String
  let label: String
  let code: String?
  let x: CGFloat
  let y: CGFloat
  let width: CGFloat
  let height: CGFloat
}

enum NativeLayouts {
  static let djmax8b: [NativeKey] = [
    NativeKey(id: "k_shift_l", label: "Shift", code: "ShiftLeft", x: -1.35, y: 0, width: 1.35, height: 3),
    NativeKey(id: "k_shift_r", label: "Shift", code: "ShiftRight", x: 6.65, y: 0, width: 1.35, height: 3),

    NativeKey(id: "k_a", label: "A", code: "KeyA", x: 0, y: 0, width: 1, height: 2),
    NativeKey(id: "k_s", label: "S", code: "KeyS", x: 1, y: 0, width: 1, height: 2),
    NativeKey(id: "k_d", label: "D", code: "KeyD", x: 2, y: 0, width: 1, height: 2),
    NativeKey(id: "k_l", label: "L", code: "KeyL", x: 3.6, y: 0, width: 1, height: 2),
    NativeKey(id: "k_semi", label: ";", code: "Semicolon", x: 4.6, y: 0, width: 1, height: 2),
    NativeKey(id: "k_quote", label: "'", code: "Quote", x: 5.6, y: 0, width: 1, height: 2),

    NativeKey(id: "k_alt_l", label: "L-Alt", code: "AltLeft", x: 0, y: 2, width: 3, height: 1),
    NativeKey(id: "k_alt_r", label: "R-Alt", code: "AltRight", x: 3.6, y: 2, width: 3, height: 1),
  ]
}

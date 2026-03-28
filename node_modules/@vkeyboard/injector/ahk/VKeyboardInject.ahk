#Requires AutoHotkey v2.0

; Reads lines from stdin:
;   down\t<key>
;   up\t<key>
;   tap\t<key>
;
; <key> examples:
;   a
;   1
;   {Enter}
;   {Backspace}
;   {Shift}
;

stdin := FileOpen("*", "r")
if !IsObject(stdin) {
  ExitApp(1)
}

; Reduce input latency for Send
SendMode("Input")
SetKeyDelay(-1, -1)
SetMouseDelay(-1)
SetWinDelay(-1)
SetControlDelay(-1)

SendKey(action, key) {
  ; key token formats:
  ;   vk41
  ;   vk0D
  ;   {Enter}
  ;   a

  if (RegExMatch(key, "^vk[0-9A-Fa-f]{2}$")) {
    tok := "{" key "}"
    if (action = "tap") {
      Send(tok)
      return
    }
    if (action = "down") {
      Send("{" key " down}")
      return
    }
    if (action = "up") {
      Send("{" key " up}")
      return
    }
    return
  }

  if (action = "tap") {
    Send(key)
    return
  }

  ; If key is like {Shift} and action is down/up, translate to {Shift down}/{Shift up}
  if (RegExMatch(key, "^\{([A-Za-z0-9]+)\}$", &m)) {
    name := m[1]
    if (action = "down") {
      Send("{" name " down}")
      return
    }
    if (action = "up") {
      Send("{" name " up}")
      return
    }
  }

  ; For literal characters, emulate down/up via SendInput variants (best-effort)
  if (action = "down") {
    ; AHK doesn't support raw down for arbitrary chars reliably; send nothing.
    return
  }
  if (action = "up") {
    return
  }
}

Loop {
  try {
    line := stdin.ReadLine()
  } catch {
    break
  }

  if (line = "")
    continue

  line := Trim(line, "`r`n ")
  parts := StrSplit(line, "`t")
  if (parts.Length < 2)
    continue

  action := parts[1]
  key := parts[2]

  if (action != "down" && action != "up" && action != "tap")
    continue

  SendKey(action, key)
}

ExitApp(0)

export type ClientRole = 'keyboard' | 'receiver';
export interface KeyboardKey {
    id: string;
    label: string;
    code?: string;
    width: number;
    height: number;
    /** Extra empty space before this key, in key-units (not pixels). */
    gapBefore?: number;
    /** Absolute x position in key-units (optional; enables absolute layout). */
    x?: number;
    /** Absolute y position in key-units (optional; enables absolute layout). */
    y?: number;
}
export interface KeyboardRow {
    id: string;
    keys: KeyboardKey[];
}
export interface KeyboardLayout {
    id: string;
    name: string;
    /** Base key size in pixels (1x1 key). */
    unitPx?: number;
    /** Gap between keys in pixels. */
    gapPx?: number;
    rows: KeyboardRow[];
}
export type HelloMessage = {
    type: 'hello';
    role: ClientRole;
    deviceName?: string;
};
export type KeyEventMessage = {
    type: 'key';
    action: 'down' | 'up' | 'tap';
    keyId: string;
    label: string;
    code?: string;
    ts: number;
};
export type KeyStateItem = {
    keyId: string;
    label: string;
    code?: string;
    pressed: boolean;
    seq: number;
};
export type KeyStateMessage = {
    type: 'key_state';
    ts: number;
    keys: KeyStateItem[];
    source?: 'edge' | 'heartbeat';
};
export type ClientToServerMessage = HelloMessage | KeyEventMessage | KeyStateMessage;
export type ServerToClientMessage = {
    type: 'state';
    clients: Array<{
        id: string;
        role: ClientRole;
        deviceName?: string;
    }>;
} | KeyEventMessage | KeyStateMessage;
//# sourceMappingURL=protocol.d.ts.map
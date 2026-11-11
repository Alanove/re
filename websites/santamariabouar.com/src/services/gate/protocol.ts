const CRC_POLY = 140;
const UDP_HEAD = 0xfe;
const UDP_TAIL = 0xef;
const TCP_HEAD = 0xfc;
const TCP_TAIL = 0xcf;
const TCP_SERVER_MAC = Buffer.from('010101010101', 'hex');
const CMD_DEVICE_REGISTER = 1;
export const CMD_DEVICE_REGISTER_RST = 2;
const CMD_REMOTE_CONTROL = 5;
export const CMD_REMOTE_CONTROL_RST = 6;
const UDP_PACK_REQUEST = 1;

export const CONTROL_COMMANDS = {
  open: 513,
  close: 512,
  stop: 514
} as const;

export type ControlAction = keyof typeof CONTROL_COMMANDS;

export interface ParsedTcpPacket {
  command: number;
  checksumOk: boolean;
}

export function checksum(data: Buffer, length: number): number {
  let value = 0;
  for (let i = 0; i < length; i++) {
    value ^= data[i];
    for (let b = 0; b < 8; b++) {
      value = value & 1 ? (value >> 1) ^ CRC_POLY : value >> 1;
    }
  }
  return value & 0xff;
}

export function macToBytes(mac: string): Buffer {
  let raw = String(mac || '').replace(/[:\-]/g, '').trim();
  if (!raw) return Buffer.alloc(6);
  if (raw.length % 2) raw = '0' + raw;
  const parsed = Buffer.from(raw, 'hex');
  if (parsed.length >= 6) return parsed.subarray(0, 6);
  return Buffer.concat([Buffer.alloc(6 - parsed.length), parsed]);
}

export function srcMacFromToken(deviceToken: string): Buffer {
  let token = String(deviceToken || '').replace(/[:\-]/g, '');
  if (token.length < 14) token = token.padEnd(14, '0');
  return Buffer.from(token.slice(2, 14), 'hex');
}

export function buildUdpControl(
  srcMac: Buffer,
  destMac: Buffer,
  deviceType: number,
  deviceProject: number,
  command: number,
  extra?: Buffer,
  sequence?: number
): Buffer {
  const extraBuf = extra && extra.length ? extra : Buffer.alloc(0);
  const seq = sequence == null ? 1 : sequence;
  const encodedType = ((deviceType & 0xff) << 8) | (deviceProject & 0xff);
  const dataLen = extraBuf.length;
  const packet = Buffer.alloc(31 + dataLen);
  packet[0] = UDP_HEAD;
  packet[1] = UDP_PACK_REQUEST;
  packet[2] = (encodedType >> 8) & 0xff;
  packet[3] = encodedType & 0xff;
  srcMac.copy(packet, 4, 0, 6);
  destMac.copy(packet, 10, 0, 6);
  packet[24] = (command >> 8) & 0xff;
  packet[25] = command & 0xff;
  packet[26] = (dataLen >> 8) & 0xff;
  packet[27] = dataLen & 0xff;
  if (dataLen) {
    extraBuf.copy(packet, 28);
    packet[dataLen + 28] = seq & 0xff;
    packet[dataLen + 29] = checksum(packet, dataLen + 29);
    packet[dataLen + 30] = UDP_TAIL;
  } else {
    packet[28] = seq & 0xff;
    packet[29] = checksum(packet, 29);
    packet[30] = UDP_TAIL;
  }
  return packet;
}

export function buildTcpPacket(srcMac: Buffer, destMac: Buffer, command: number, payload?: Buffer): Buffer {
  const payloadBuf = payload && payload.length ? payload : Buffer.alloc(0);
  const dataLen = payloadBuf.length;
  const packet = Buffer.alloc(26 + dataLen);
  packet[0] = TCP_HEAD;
  srcMac.copy(packet, 1, 0, 6);
  destMac.copy(packet, 7, 0, 6);
  packet[21] = command & 0xff;
  packet[22] = (dataLen >> 8) & 0xff;
  packet[23] = dataLen & 0xff;
  if (dataLen) {
    payloadBuf.copy(packet, 24);
    packet[dataLen + 24] = checksum(packet, dataLen + 24);
    packet[dataLen + 25] = TCP_TAIL;
  } else {
    packet[24] = checksum(packet, 24);
    packet[25] = TCP_TAIL;
  }
  return packet;
}

export function buildRegister(srcMac: Buffer): Buffer {
  return buildTcpPacket(srcMac, TCP_SERVER_MAC, CMD_DEVICE_REGISTER);
}

export function buildRemoteControl(
  srcMac: Buffer,
  deviceMac: string,
  deviceType: number,
  deviceProject: number,
  action: ControlAction,
  extra?: Buffer
): Buffer {
  const command = CONTROL_COMMANDS[action];
  const dest = macToBytes(deviceMac);
  const udp = buildUdpControl(srcMac, dest, deviceType, deviceProject, command, extra, 1);
  return buildTcpPacket(srcMac, dest, CMD_REMOTE_CONTROL, udp);
}

export function parseTcpPackets(buf: Buffer): { packets: ParsedTcpPacket[]; rest: Buffer } {
  const packets: ParsedTcpPacket[] = [];
  let offset = 0;
  while (true) {
    const start = buf.indexOf(TCP_HEAD, offset);
    if (start < 0) return { packets, rest: buf.subarray(offset) };
    if (start + 26 > buf.length) return { packets, rest: buf.subarray(start) };
    const dataLen = ((buf[start + 22] & 0xff) << 8) | (buf[start + 23] & 0xff);
    const total = 26 + dataLen;
    if (start + total > buf.length) return { packets, rest: buf.subarray(start) };
    const frame = buf.subarray(start, start + total);
    if (frame[frame.length - 1] !== TCP_TAIL) {
      offset = start + 1;
      continue;
    }
    packets.push({
      command: frame[21] & 0xff,
      checksumOk: frame[dataLen + 24] === checksum(frame, dataLen + 24)
    });
    offset = start + total;
  }
}

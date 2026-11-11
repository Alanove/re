import net from 'net';
import { GATE_OPERATOR, GateOperator } from '../../config/gateOperator';
import {
  CMD_DEVICE_REGISTER_RST,
  CMD_REMOTE_CONTROL_RST,
  ParsedTcpPacket,
  srcMacFromToken,
  buildRegister,
  buildRemoteControl,
  parseTcpPackets
} from './protocol';

const TCP_PORT = 8950;
const COOLDOWN_MS = 8000;

export class GateBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GateBusyError';
  }
}

export interface OpenGateResult {
  sent: boolean;
  registered: boolean;
  ack: boolean;
  releaseAck: boolean | null;
  host: string;
  port: number;
  action: string;
  operator: string;
  device: string;
  device_mac: string;
}

interface ReaderState {
  buf: Buffer;
  packets: ParsedTcpPacket[];
  closed: boolean;
}

let openInProgress = false;
let lastSuccessAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectHost(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(timeoutMs);
    socket.once('error', reject);
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`timeout connecting to ${host}:${port}`));
    });
  });
}

function waitForCommand(state: ReaderState, command: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = () => {
      if (state.packets.some((p) => p.command === command)) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline || state.closed) {
        resolve(false);
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

function attachReader(socket: net.Socket, state: ReaderState): void {
  socket.on('data', (chunk: Buffer) => {
    state.buf = Buffer.concat([state.buf, chunk]);
    const parsed = parseTcpPackets(state.buf);
    state.packets.push(...parsed.packets);
    state.buf = Buffer.from(parsed.rest);
  });
  socket.on('close', () => {
    state.closed = true;
  });
  socket.on('error', () => {
    state.closed = true;
  });
}

async function sendControl(
  socket: net.Socket,
  state: ReaderState,
  packet: Buffer,
  timeoutMs: number
): Promise<boolean> {
  const before = state.packets.length;
  socket.write(packet);
  const deadline = Date.now() + timeoutMs;
  let sends = 1;
  while (Date.now() < deadline) {
    if (state.packets.slice(before).some((p) => p.command === CMD_REMOTE_CONTROL_RST)) {
      return true;
    }
    if (sends < 3) {
      socket.write(packet);
      sends += 1;
    }
    await sleep(400);
  }
  return state.packets.slice(before).some((p) => p.command === CMD_REMOTE_CONTROL_RST);
}

export async function openGate(operator: GateOperator = GATE_OPERATOR): Promise<OpenGateResult> {
  const device = (operator.devices || [])[0];
  if (!operator.device_token || !device) {
    throw new Error('operator.json has no saved gate');
  }
  const srcMac = srcMacFromToken(operator.device_token);
  const type = Number(device.type || 0);
  const project = Number(device.project || 0);
  const mode = Number(device.mode || 1);
  const extra = type === 7 ? Buffer.from([mode & 0xff, 1]) : Buffer.alloc(0);
  const hosts = [operator.domain, operator.ip].filter(Boolean);
  let lastError = 'could not register';

  for (const host of hosts) {
    let socket: net.Socket | undefined;
    try {
      socket = await connectHost(host, TCP_PORT, 8000);
      socket.setTimeout(8000);
      const state: ReaderState = { buf: Buffer.alloc(0), packets: [], closed: false };
      attachReader(socket, state);
      socket.write(buildRegister(srcMac));
      const registered = await waitForCommand(state, CMD_DEVICE_REGISTER_RST, 5000);
      if (!registered) {
        lastError = `no register ACK from ${host}`;
        socket.destroy();
        continue;
      }
      const openPacket = buildRemoteControl(srcMac, device.mac, type, project, 'open', extra);
      const ack = await sendControl(socket, state, openPacket, 8000);
      let releaseAck: boolean | null = null;
      if (type === 7 && mode === 1) {
        await sleep(350);
        const closePacket = buildRemoteControl(srcMac, device.mac, type, project, 'close', extra);
        releaseAck = await sendControl(socket, state, closePacket, 5000);
      }
      socket.end();
      return {
        sent: true,
        registered: true,
        ack,
        releaseAck,
        host,
        port: TCP_PORT,
        action: 'open',
        operator: operator.account,
        device: device.name,
        device_mac: device.mac
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (socket) socket.destroy();
    }
  }
  throw new Error(lastError);
}

export async function openGateWithLock(operator: GateOperator = GATE_OPERATOR): Promise<OpenGateResult> {
  if (openInProgress) {
    throw new GateBusyError('The gate is already being opened. Please wait a moment.');
  }
  if (lastSuccessAt && Date.now() - lastSuccessAt < COOLDOWN_MS) {
    throw new GateBusyError('Please wait a few seconds before opening the gate again.');
  }
  openInProgress = true;
  try {
    const result = await openGate(operator);
    lastSuccessAt = Date.now();
    return result;
  } finally {
    openInProgress = false;
  }
}

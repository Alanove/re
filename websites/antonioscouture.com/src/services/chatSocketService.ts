import { Server as HttpServer, ServerResponse } from 'http';
import { Server as HttpsServer } from 'https';
import { Server, Socket } from 'socket.io';
import { RequestHandler } from 'express';
import { ChatService, CHAT_MAX_BODY, ChatMessageRow, isValidPublicChatKey } from './chatService';
import emailService from './emailService';
import { isTurnstileEnabled, verifyTurnstileToken } from '../utils/turnstile';
const STAFF_ROLES = new Set(['Super Admin', 'Admin']);

function assertOriginAllowed(socket: Socket): boolean {
  const origin = socket.handshake.headers.origin;
  if (!origin) return true;
  try {
    const host = socket.handshake.headers.host;
    if (!host) return false;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Re-run express-session on the Socket.IO request so `socket.request.session` is populated. */
function wrapSessionMiddleware(middleware: RequestHandler) {
  return (socket: Socket, next: (err?: Error) => void) => {
    const req = socket.request as any;
    const res = new ServerResponse(req);
    middleware(req, res as any, (err?: unknown) => {
      if (err) {
        next(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      next();
    });
  };
}

function toPayload(publicKey: string, msg: ChatMessageRow) {
  return {
    publicKey,
    id: msg.id,
    sender: msg.sender,
    body: msg.body,
    createdAt: msg.created_at,
    staffUserId: msg.staff_user_id,
  };
}

/**
 * Attaches Socket.IO to the HTTP(S) server. Reuses Express session via `io.engine.use(sessionMiddleware)`.
 */
export function attachChatSocket(
  server: HttpServer | HttpsServer,
  sessionMiddleware: RequestHandler
): Server {
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
  });

  const chatService = ChatService.getInstance();

  io.engine.use(sessionMiddleware as any);
  io.use(wrapSessionMiddleware(sessionMiddleware));

  io.use((socket, next) => {
    if (!assertOriginAllowed(socket)) {
      return next(new Error('forbidden'));
    }
    const session = (socket.request as any).session;
    if (!session) {
      return next(new Error('no session'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const auth = socket.handshake.auth || {};
    const role = auth.role as string;

    if (role === 'staff') {
      const user = (socket.request as any).session?.user;
      if (!user || !STAFF_ROLES.has(user.role)) {
        socket.emit('chat:error', { code: 'staff_forbidden' });
        socket.disconnect(true);
        return;
      }
      (socket.data as any).kind = 'staff';
      (socket.data as any).staffUserId = user.id;
      socket.join('staff');
      socket.emit('chat:staff-ready', { ok: true });

      socket.on(
        'staff:message',
        async (payload: { publicKey?: string; body?: string }) => {
          const publicKey = typeof payload?.publicKey === 'string' ? payload.publicKey : '';
          const bodyRaw = typeof payload?.body === 'string' ? payload.body : '';
          if (!isValidPublicChatKey(publicKey)) {
            socket.emit('chat:error', { code: 'invalid_public_key' });
            return;
          }
          const body = bodyRaw.trim();
          if (!body || body.length > CHAT_MAX_BODY) {
            socket.emit('chat:error', { code: 'invalid_body' });
            return;
          }
          try {
            const conv = await chatService.findByPublicKey(publicKey);
            if (!conv) {
              socket.emit('chat:error', { code: 'not_found' });
              return;
            }
            const staffId = (socket.data as any).staffUserId as number;
            const msg = await chatService.addStaffMessage(conv.id, staffId, body);
            const out = toPayload(publicKey, msg);
            io.to(`conv:${publicKey}`).emit('chat:message', out);
            io.to('staff').emit('chat:message', out);
            io.to('staff').emit('chat:list-changed', { publicKey });
          } catch (e) {
            console.error('[chat] staff:message', e);
            socket.emit('chat:error', { code: 'server_error' });
          }
        }
      );
      return;
    }

    const publicKey = auth.publicKey as string;
    if (!isValidPublicChatKey(publicKey)) {
      socket.disconnect(true);
      return;
    }
    (socket.data as any).kind = 'visitor';
    (socket.data as any).publicKey = publicKey;
    (socket.data as any).contact = {};

    socket.join(`conv:${publicKey}`);

    socket.on('chat:start', (payload: { firstName?: string; email?: string; phone?: string }) => {
      const c = (socket.data as any).contact || {};
      (socket.data as any).contact = { ...c, ...payload };
      void chatService.mergeContact(publicKey, (socket.data as any).contact);
    });

    socket.on(
      'chat:message',
      async (payload: { body?: string; turnstileToken?: string }) => {
      const text = typeof payload?.body === 'string' ? payload.body.trim() : '';
      if (!text || text.length > CHAT_MAX_BODY) {
        socket.emit('chat:error', { code: 'invalid_body' });
        return;
      }
      try {
        const contact = (socket.data as any).contact || {};
        let conv = await chatService.findByPublicKey(publicKey);
        const messageCountBefore = conv ? await chatService.countMessages(conv.id) : 0;

        if (messageCountBefore === 0 && (await isTurnstileEnabled())) {
          const turnstileToken =
            typeof payload?.turnstileToken === 'string' ? payload.turnstileToken.trim() : '';
          if (!turnstileToken) {
            socket.emit('chat:error', { code: 'turnstile_required' });
            return;
          }
          const forwarded = socket.handshake.headers['x-forwarded-for'];
          const remoteip =
            (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
            socket.handshake.address;
          const turnstileOk = await verifyTurnstileToken(turnstileToken, remoteip);
          if (!turnstileOk) {
            socket.emit('chat:error', { code: 'turnstile_failed' });
            return;
          }
        }
        if (!conv) {
          await chatService.createConversation(publicKey, contact);
          conv = await chatService.findByPublicKey(publicKey);
        } else {
          await chatService.mergeContact(publicKey, contact);
        }
        if (!conv) {
          socket.emit('chat:error', { code: 'server_error' });
          return;
        }
        const msg = await chatService.addVisitorMessage(conv.id, text);
        const out = toPayload(publicKey, msg);
        io.to(`conv:${publicKey}`).emit('chat:message', out);
        io.to('staff').emit('chat:message', out);
        io.to('staff').emit('chat:list-changed', { publicKey });

        if (messageCountBefore === 0) {
          const refreshed = await chatService.findByPublicKey(publicKey);
          void emailService
            .sendNewChatMessageNotification({
              publicKey,
              messageBody: text,
              visitorFirstName: refreshed?.visitor_first_name ?? contact.firstName,
              visitorEmail: refreshed?.visitor_email ?? contact.email,
              visitorPhone: refreshed?.visitor_phone ?? contact.phone,
            })
            .catch((err) => console.error('[chat] first-message notification email', err));
        }
      } catch (e) {
        console.error('[chat] chat:message', e);
        const errMsg = e instanceof Error ? e.message : String(e);
        socket.emit('chat:error', { code: 'server_error', message: errMsg });
      }
    }
    );

    void (async () => {
      try {
        const conv = await chatService.findByPublicKey(publicKey);
        if (!conv) {
          socket.emit('chat:history', { publicKey, messages: [] });
          return;
        }
        const messages = await chatService.getMessages(conv.id);
        socket.emit('chat:history', {
          publicKey,
          messages: messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            body: m.body,
            createdAt: m.created_at,
            staffUserId: m.staff_user_id,
          })),
        });
      } catch (e) {
        console.error('[chat] history', e);
        socket.emit('chat:error', { code: 'server_error' });
      }
    })();
  });

  return io;
}

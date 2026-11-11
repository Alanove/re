import { Request, Response } from 'express';

import { SiteSettingsService } from '../services/siteSettingsService';

import { ChatService, isValidPublicChatKey } from '../../src/services/chatService';



const siteSettingsService = SiteSettingsService.getInstance();

const chatService = ChatService.getInstance();



function getStaffUserId(req: Request): number | null {

  const user = (req.session as any)?.user;

  const id = user?.id;

  return typeof id === 'number' ? id : null;

}



function mapConversation(c: {

  public_key: string;

  visitor_first_name: string | null;

  visitor_email: string | null;

  visitor_phone: string | null;

  last_message_at: Date | null;

  unread_count?: number;

}) {

  return {

    public_key: c.public_key,

    visitor_first_name: c.visitor_first_name,

    visitor_email: c.visitor_email,

    visitor_phone: c.visitor_phone,

    last_message_at: c.last_message_at,

    unread_count: Number(c.unread_count ?? 0),

  };

}



export class ChatController {

  public static async index(req: Request, res: Response): Promise<void> {

    try {

      const siteTitle = await siteSettingsService.getSiteTitle();

      const staffUserId = getStaffUserId(req);

      const conversations = staffUserId

        ? await chatService.listConversationsForStaff(staffUserId, 300)

        : await chatService.listConversations(300);



      res.render('chat/index', {

        title: 'Live Chat',

        pageTitle: 'Live Chat',

        pageSubtitle: 'Visitor conversations',

        showPageHeader: false,

        siteTitle,

        conversations,

        chatPage: true,

        bodyClass: 'admin-page-live-chat',

        csrfToken: (res.locals as any).csrfToken,

      });

    } catch (error) {

      console.error('Chat index error:', error);

      res.status(500).send('Internal Server Error');

    }

  }



  public static async conversationsJson(req: Request, res: Response): Promise<void> {

    try {

      const staffUserId = getStaffUserId(req);

      if (!staffUserId) {

        res.status(401).json({ success: false, message: 'Unauthorized' });

        return;

      }

      const conversations = await chatService.listConversationsForStaff(staffUserId, 300);

      const totalUnread = await chatService.getTotalUnreadCount(staffUserId);

      res.json({

        success: true,

        totalUnread,

        conversations: conversations.map(mapConversation),

      });

    } catch (error) {

      console.error('Chat conversationsJson error:', error);

      res.status(500).json({ success: false, message: 'Server error' });

    }

  }



  public static async unreadTotalJson(req: Request, res: Response): Promise<void> {

    try {

      const staffUserId = getStaffUserId(req);

      if (!staffUserId) {

        res.status(401).json({ success: false, message: 'Unauthorized' });

        return;

      }

      const total = await chatService.getTotalUnreadCount(staffUserId);

      res.json({ success: true, total });

    } catch (error) {

      console.error('Chat unreadTotalJson error:', error);

      res.status(500).json({ success: false, message: 'Server error' });

    }

  }



  public static async messagesJson(req: Request, res: Response): Promise<void> {

    try {

      const staffUserId = getStaffUserId(req);

      const pk = typeof req.query.publicKey === 'string' ? req.query.publicKey : '';

      if (!isValidPublicChatKey(pk)) {

        res.status(400).json({ success: false, message: 'Invalid public key' });

        return;

      }

      const conv = await chatService.findByPublicKey(pk);

      if (!conv) {

        res.json({ success: true, publicKey: pk, messages: [], totalUnread: 0 });

        return;

      }

      const messages = await chatService.getMessages(conv.id);

      if (staffUserId) {

        await chatService.markConversationRead(staffUserId, conv.id);

      }

      const totalUnread = staffUserId

        ? await chatService.getTotalUnreadCount(staffUserId)

        : 0;

      res.json({

        success: true,

        publicKey: pk,

        totalUnread,

        messages: messages.map((m) => ({

          id: m.id,

          sender: m.sender,

          body: m.body,

          createdAt: m.created_at,

          staffUserId: m.staff_user_id,

        })),

      });

    } catch (error) {

      console.error('Chat messagesJson error:', error);

      res.status(500).json({ success: false, message: 'Server error' });

    }

  }

}



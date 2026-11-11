import { Request, Response } from 'express';
import contactInfoService, { ContactInfo } from '../../src/services/contactInfoService';

export class ContactInfoController {
  /**
   * Get all contact info
   */
  public static getAll(req: Request, res: Response): void {
    try {
      const contactInfo = contactInfoService.getAllContactInfo();
      res.json({ success: true, data: contactInfo });
    } catch (error) {
      console.error('Error getting contact info:', error);
      res.status(500).json({ success: false, error: 'Failed to get contact info' });
    }
  }

  /**
   * Add new contact info
   */
  public static add(req: Request, res: Response): void {
    try {
      const newContact: ContactInfo = {
        id: Date.now().toString(),
        country: req.body.country || '',
        city: req.body.city || '',
        address: req.body.address || '',
        phone: req.body.phone || '',
        coordinates: req.body.coordinates || ''
      };

      const success = contactInfoService.addContactInfo(newContact);
      if (success) {
        res.json({ success: true, message: 'Contact info added successfully', data: newContact });
      } else {
        res.status(500).json({ success: false, error: 'Failed to add contact info' });
      }
    } catch (error) {
      console.error('Error adding contact info:', error);
      res.status(500).json({ success: false, error: 'Failed to add contact info' });
    }
  }

  /**
   * Update contact info
   */
  public static update(req: Request, res: Response): void {
    try {
      const id = req.params.id;
      const allContactInfo = contactInfoService.getAllContactInfo();
      const index = allContactInfo.findIndex(info => info.id === id);

      if (index === -1) {
        res.status(404).json({ success: false, error: 'Contact info not found' });
        return;
      }

      const updatedContact: ContactInfo = {
        ...allContactInfo[index],
        country: req.body.country || allContactInfo[index].country,
        city: req.body.city || allContactInfo[index].city,
        address: req.body.address || allContactInfo[index].address,
        phone: req.body.phone || allContactInfo[index].phone,
        whatsappNumber: req.body.whatsappNumber !== undefined ? req.body.whatsappNumber : allContactInfo[index].whatsappNumber,
        email: req.body.email !== undefined ? req.body.email : allContactInfo[index].email,
        coordinates: req.body.coordinates || allContactInfo[index].coordinates
      };

      allContactInfo[index] = updatedContact;
      const success = contactInfoService.updateContactInfo(allContactInfo);

      if (success) {
        res.json({ success: true, message: 'Contact info updated successfully', data: updatedContact });
      } else {
        res.status(500).json({ success: false, error: 'Failed to update contact info' });
      }
    } catch (error) {
      console.error('Error updating contact info:', error);
      res.status(500).json({ success: false, error: 'Failed to update contact info' });
    }
  }

  /**
   * Delete contact info
   */
  public static delete(req: Request, res: Response): void {
    try {
      const id = req.params.id;
      const success = contactInfoService.deleteContactInfo(id);

      if (success) {
        res.json({ success: true, message: 'Contact info deleted successfully' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to delete contact info' });
      }
    } catch (error) {
      console.error('Error deleting contact info:', error);
      res.status(500).json({ success: false, error: 'Failed to delete contact info' });
    }
  }
}







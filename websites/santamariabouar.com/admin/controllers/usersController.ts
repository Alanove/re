import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { apartmentsService } from '../services/apartmentsService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { regenerateSession } from '../../src/utils/sessionHelpers';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class UsersController {
  /**
   * Render users management page
   */
  public static async users(req: Request, res: Response): Promise<void> {
    try {
      const users = await usersService.getAllUsers();
      const linkedByUser = await apartmentsService.getLinkedApartmentsByUserIds(users.map((u) => u.id));
      const usersWithApartments = users.map((user) => ({
        ...user,
        linkedApartments: linkedByUser.get(user.id) || []
      }));

      const siteTitle = await siteSettingsService.getSiteTitle();
      
      res.render('users/users', {
        title: 'Users Management',
        pageTitle: 'Users Management',
        pageSubtitle: 'Manage admin users and permissions',
        users: usersWithApartments,
        siteTitle: siteTitle,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering users:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create user page
   */
  public static async createUser(req: Request, res: Response): Promise<void> {
    try {
      res.render('users/user-form', {
        title: 'Create User',
        pageTitle: 'Create User',
        pageSubtitle: 'Add a new admin user',
        isCreateMode: true,
        user: {},
        error: undefined,
        success: undefined
      });
    } catch (error) {
      console.error('Error rendering create user page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create user form submission
   */
  public static async createUserPost(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone, password, confirmPassword, status, role, notes, walletEnabled } = req.body;
      
      // Prepare form data for potential re-render
      const formData = {
        name,
        email,
        phone,
        status,
        role,
        notes,
        walletEnabled: walletEnabled === 'on' || walletEnabled === '1' || walletEnabled === true
      };
      
      // Validation - name is always required
      if (!name) {
        return res.render('users/user-form', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          isCreateMode: true,
          user: formData,
          error: 'Name is required.'
        });
      }

      // If email is provided, validate it
      if (email && !email.includes('@')) {
        return res.render('users/user-form', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          isCreateMode: true,
          user: formData,
          error: 'Please provide a valid email address.'
        });
      }

      // If password is provided, validate it and confirmation
      if (password) {
        if (password !== confirmPassword) {
          return res.render('users/user-form', {
            title: 'Create User',
            pageTitle: 'Create User',
            pageSubtitle: 'Add a new admin user',
            isCreateMode: true,
            user: formData,
            error: 'Passwords do not match.'
          });
        }
        
        if (password.length < 8) {
          return res.render('users/user-form', {
            title: 'Create User',
            pageTitle: 'Create User',
            pageSubtitle: 'Add a new admin user',
            isCreateMode: true,
            user: formData,
            error: 'Password must be at least 8 characters long.'
          });
        }
      }
      
      try {
        if (email) {
          await usersService.assertEmailAvailable(email);
        }
        if (phone) {
          await usersService.assertPhoneAvailable(phone);
        }
      } catch (dupError) {
        return res.render('users/user-form', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          isCreateMode: true,
          user: formData,
          error: dupError instanceof Error ? dupError.message : 'Duplicate email or phone.'
        });
      }
      
      // Create new user
      const newUser = await usersService.createUser({
        name: name.trim(),
        ...(email && { email: email.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(password && { password: password }),
        status: status || 'Active',
        role: role || 'Member',
        walletEnabled: walletEnabled === 'on' || walletEnabled === '1' || walletEnabled === true,
        notes: notes || ''
      });
      
      if (newUser) {
        res.redirect('/admin/users?success=User created successfully');
      } else {
        res.render('users/user-form', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          isCreateMode: true,
          user: formData,
          error: 'Failed to create user. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      const formData = req.body;
      const message =
        error instanceof Error && /already exists/i.test(error.message)
          ? error.message
          : 'An error occurred while creating the user.';
      
      res.render('users/user-form', {
        title: 'Create User',
        pageTitle: 'Create User',
        pageSubtitle: 'Add a new admin user',
        isCreateMode: true,
        user: formData,
        error: message
      });
    }
  }

  /**
   * Render edit user page
   */
  public static async editUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const user = await usersService.getUserById(userId);
      if (!user) {
        return res.redirect('/admin/users?error=User not found');
      }
      res.render('users/user-form', {
        title: 'Edit User',
        pageTitle: 'Edit User',
        pageSubtitle: 'Update user information and permissions',
        isCreateMode: false,
        user: user,
        error: undefined,
        success: undefined
      });
    } catch (error) {
      console.error('Error rendering edit user page:', error);
      res.redirect('/admin/users?error=An error occurred');
    }
  }

  /**
   * Handle edit user form submission
   */
  public static async editUserPost(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const { name, email, phone, password, confirmPassword, status, role, notes, walletEnabled } = req.body;
      
      // Check if user exists
      const existingUser = await usersService.getUserById(userId);
      if (!existingUser) {
        return res.redirect('/admin/users?error=User not found');
      }
      
      // Validation - only name is required
      if (!name) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: existingUser,
          error: 'Name is required.'
        });
      }

      // Validate email format if provided
      if (email && !email.includes('@')) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: existingUser,
          error: 'Please provide a valid email address.'
        });
      }
      
      // Check password confirmation if password is provided
      if (password && password !== confirmPassword) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: existingUser,
          error: 'Passwords do not match.'
        });
      }
      
      if (password && password.length < 8) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: existingUser,
          error: 'Password must be at least 8 characters long.'
        });
      }
      
      try {
        if (email) {
          await usersService.assertEmailAvailable(email, userId);
        }
        if (phone) {
          await usersService.assertPhoneAvailable(phone, userId);
        }
      } catch (dupError) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: { ...existingUser, name, email, phone, status, role, notes, walletEnabled },
          error: dupError instanceof Error ? dupError.message : 'Duplicate email or phone.'
        });
      }
      
      // Prepare update data
      const updateData: any = {
        name,
        status: status || 'Active',
        role: role || 'Member',
        walletEnabled: walletEnabled === 'on' || walletEnabled === '1' || walletEnabled === true,
        notes: notes || ''
      };

      // Only update email if provided
      if (email) {
        updateData.email = email;
      }
      
      // Only update phone if provided
      if (phone) {
        updateData.phone = phone;
      }
      
      // Update user
      const updatedUser = await usersService.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: existingUser,
          error: 'Failed to update user. Please try again.'
        });
      }
      
      // Update password if provided
      if (password) {
        const passwordUpdated = await usersService.updateUserPassword(userId, password);
        if (!passwordUpdated) {
          return res.render('users/user-form', {
            title: 'Edit User',
            pageTitle: 'Edit User',
            pageSubtitle: 'Update user information and permissions',
            isCreateMode: false,
            user: existingUser,
            error: 'Failed to update password. Please try again.'
          });
        }
      }
      
      res.redirect('/admin/users?success=User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      const userId = parseInt(req.params.id);
      const existingUser = await usersService.getUserById(userId);
      const message =
        error instanceof Error && /already exists/i.test(error.message)
          ? error.message
          : 'An error occurred while updating the user.';
      
      res.render('users/user-form', {
        title: 'Edit User',
        pageTitle: 'Edit User',
        pageSubtitle: 'Update user information and permissions',
        isCreateMode: false,
        user: existingUser || {},
        error: message
      });
    }
  }

  /**
   * Delete user
   */
  public static async deleteUser(req: Request, res: Response): Promise<any> {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const existingUser = await usersService.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Prevent deleting the current user
      const currentUser = (req.session as any).user;
      if (currentUser && currentUser.id === userId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account'
        });
      }
      
      // Delete user
      const deleted = await usersService.deleteUser(userId);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'User deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete user'
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the user'
      });
    }
  }

  /**
   * Super Admin: open the member portal as the selected user (feature testing).
   */
  public static async impersonateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(String(req.params.id), 10);
      if (Number.isNaN(userId)) {
        res.redirect('/admin/users?error=' + encodeURIComponent('Invalid user.'));
        return;
      }

      if (req.session?.impersonator) {
        res.redirect(
          '/admin/users?error=' +
            encodeURIComponent('Already previewing a member. Exit the preview first.')
        );
        return;
      }

      const adminUser = req.session?.user;
      if (!adminUser?.id) {
        res.redirect('/admin/login');
        return;
      }

      const target = await usersService.getUserById(userId);
      if (!target) {
        res.redirect('/admin/users?error=' + encodeURIComponent('User not found.'));
        return;
      }
      if (target.status !== 'Active') {
        res.redirect(
          '/admin/users?error=' + encodeURIComponent('Cannot login as an inactive user.')
        );
        return;
      }

      const impersonator = {
        id: adminUser.id,
        name: adminUser.name,
        role: adminUser.role,
        ...(adminUser.email ? { email: adminUser.email } : {}),
        ...(adminUser.phone ? { phone: adminUser.phone } : {})
      };

      await regenerateSession(req);

      req.session.impersonator = impersonator;
      req.session.member = {
        id: target.id,
        name: target.name,
        role: target.role,
        ...(target.email ? { email: target.email } : {}),
        ...(target.phone ? { phone: target.phone } : {})
      };
      // Intentionally leave req.session.user unset while previewing

      res.redirect('/account');
    } catch (error) {
      console.error('Error impersonating user:', error);
      res.redirect(
        '/admin/users?error=' + encodeURIComponent('Failed to open member portal as that user.')
      );
    }
  }
} 
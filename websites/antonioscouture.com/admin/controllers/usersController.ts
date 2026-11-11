import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class UsersController {
  /**
   * Render users management page
   */
  public static async users(req: Request, res: Response): Promise<void> {
    try {
      // Get users from the users service
      const users = await usersService.getAllUsers();
      
      // Get site settings
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      res.render('users/users', {
        title: 'Users Management',
        pageTitle: 'Users Management',
        pageSubtitle: 'Manage admin users and permissions',
        users: users,
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
      const { name, email, phone, password, confirmPassword, status, role, notes } = req.body;
      
      // Prepare form data for potential re-render
      const formData = { name, email, phone, status, role, notes };
      
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
        
        if (password.length < 6) {
          return res.render('users/user-form', {
            title: 'Create User',
            pageTitle: 'Create User',
            pageSubtitle: 'Add a new admin user',
            isCreateMode: true,
            user: formData,
            error: 'Password must be at least 6 characters long.'
          });
        }
      }
      
      // Check if email already exists (only if email is provided)
      if (email) {
        const existingUser = await usersService.getUserByEmail(email);
        if (existingUser) {
          return res.render('users/user-form', {
            title: 'Create User',
            pageTitle: 'Create User',
            pageSubtitle: 'Add a new admin user',
            isCreateMode: true,
            user: formData,
            error: 'A user with this email already exists.'
          });
        }
      }
      
      // Create new user
      const newUser = await usersService.createUser({
        name: name.trim(),
        ...(email && { email: email.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(password && { password: password }),
        status: status || 'Active',
        role: role || 'Member',
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
      
      res.render('users/user-form', {
        title: 'Create User',
        pageTitle: 'Create User',
        pageSubtitle: 'Add a new admin user',
        isCreateMode: true,
        user: formData,
        error: 'An error occurred while creating the user.'
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
      const { name, email, phone, password, confirmPassword, status, role, notes } = req.body;
      
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
      
      if (password && password.length < 6) {
        return res.render('users/user-form', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          isCreateMode: false,
          user: existingUser,
          error: 'Password must be at least 6 characters long.'
        });
      }
      
      // Check if email is being changed and if it already exists (only if email is provided)
      if (email && email !== existingUser.email) {
        const emailExists = await usersService.getUserByEmail(email);
        if (emailExists && emailExists.id !== userId) {
          return res.render('users/user-form', {
            title: 'Edit User',
            pageTitle: 'Edit User',
            pageSubtitle: 'Update user information and permissions',
            isCreateMode: false,
            user: existingUser,
            error: 'A user with this email already exists.'
          });
        }
      }
      
      // Prepare update data
      const updateData: any = {
        name,
        status: status || 'Active',
        role: role || 'Member',
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
      
      res.render('users/user-form', {
        title: 'Edit User',
        pageTitle: 'Edit User',
        pageSubtitle: 'Update user information and permissions',
        isCreateMode: false,
        user: existingUser || {},
        error: 'An error occurred while updating the user.'
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
} 
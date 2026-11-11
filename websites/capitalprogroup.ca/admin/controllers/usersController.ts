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
      // Set active menu item
      menuService.setActiveMenuItem('/admin/users');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get users from the users service
      const users = usersService.getAllUsers();
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
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
      menuService.setActiveMenuItem('/admin/users');
      const adminMenu = menuService.getMenuItems();
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
      const { name, email, password, confirmPassword, status, notes } = req.body;
      
      // Prepare form data for potential re-render
      const formData = { name, email, status, notes };
      
      // Validation
      if (!name || !email || !password) {
        return res.render('users/create-user', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          error: 'Name, email, and password are required fields.',
          formData: formData
        });
      }
      
      // Check password confirmation
      if (password !== confirmPassword) {
        return res.render('users/create-user', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          error: 'Passwords do not match.',
          formData: formData
        });
      }
      
      if (password.length < 6) {
        return res.render('users/create-user', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          error: 'Password must be at least 6 characters long.',
          formData: formData
        });
      }
      
      // Check if email already exists
      const existingUser = usersService.getUserByEmail(email);
      if (existingUser) {
        return res.render('users/create-user', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          error: 'A user with this email already exists.',
          formData: formData
        });
      }
      
      // Create new user
      const newUser = usersService.createUser({
        name: name.trim(),
        email: email.trim(),
        password: password,
        status: status || 'Active',
        notes: notes || ''
      });
      
      if (newUser) {
        res.redirect('/admin/users?success=User created successfully');
      } else {
        res.render('users/create-user', {
          title: 'Create User',
          pageTitle: 'Create User',
          pageSubtitle: 'Add a new admin user',
          error: 'Failed to create user. Please try again.',
          formData: formData
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      const formData = req.body;
      
      res.render('users/create-user', {
        title: 'Create User',
        pageTitle: 'Create User',
        pageSubtitle: 'Add a new admin user',
        error: 'An error occurred while creating the user.',
        formData: formData
      });
    }
  }

  /**
   * Render edit user page
   */
  public static async editUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const user = usersService.getUserById(userId);
      if (!user) {
        return res.redirect('/admin/users?error=User not found');
      }
      menuService.setActiveMenuItem('/admin/users');
      const adminMenu = menuService.getMenuItems();
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
      const { name, email, password, confirmPassword, status, notes } = req.body;
      
      // Check if user exists
      const existingUser = usersService.getUserById(userId);
      if (!existingUser) {
        return res.redirect('/admin/users?error=User not found');
      }
      
      // Validation
      if (!name || !email) {
        return res.render('users/edit-user', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          user: existingUser,
          error: 'Name and email are required fields.'
        });
      }
      
      // Check password confirmation if password is provided
      if (password && password !== confirmPassword) {
        return res.render('users/edit-user', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          user: existingUser,
          error: 'Passwords do not match.'
        });
      }
      
      if (password && password.length < 6) {
        return res.render('users/edit-user', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          user: existingUser,
          error: 'Password must be at least 6 characters long.'
        });
      }
      
      // Check if email is being changed and if it already exists
      if (email !== existingUser.email) {
        const emailExists = usersService.getUserByEmail(email);
        if (emailExists && emailExists.id !== userId) {
          return res.render('users/edit-user', {
            title: 'Edit User',
            pageTitle: 'Edit User',
            pageSubtitle: 'Update user information and permissions',
            user: existingUser,
            error: 'A user with this email already exists.'
          });
        }
      }
      
      // Prepare update data
      const updateData: any = {
        name,
        email,
        status: status || 'Active',
        notes: notes || ''
      };
      
      // Update user
      const updatedUser = usersService.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.render('users/edit-user', {
          title: 'Edit User',
          pageTitle: 'Edit User',
          pageSubtitle: 'Update user information and permissions',
          user: existingUser,
          error: 'Failed to update user. Please try again.'
        });
      }
      
      // Update password if provided
      if (password) {
        const passwordUpdated = usersService.updateUserPassword(userId, password);
        if (!passwordUpdated) {
          return res.render('users/edit-user', {
            title: 'Edit User',
            pageTitle: 'Edit User',
            pageSubtitle: 'Update user information and permissions',
            user: existingUser,
            error: 'Failed to update password. Please try again.'
          });
        }
      }
      
      res.redirect('/admin/users?success=User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      const userId = parseInt(req.params.id);
      const existingUser = usersService.getUserById(userId);
      
      res.render('users/edit-user', {
        title: 'Edit User',
        pageTitle: 'Edit User',
        pageSubtitle: 'Update user information and permissions',
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
      const existingUser = usersService.getUserById(userId);
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
      const deleted = usersService.deleteUser(userId);
      
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
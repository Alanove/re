import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { usersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class ProfileController {
  /**
   * Render admin profile page
   */
  public static async profile(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item
      menuService.setActiveMenuItem('/admin/profile');
      
      // Get menu data
      const adminMenu = menuService.getMenuItems();
      
      // Get current user from session
      const currentUser = (req.session as any).user;
      if (!currentUser) {
        return res.redirect('/admin/login');
      }
      
      // Get full user data from service
      const user = usersService.getUserById(currentUser.id);
      if (!user) {
        return res.redirect('/admin/login?error=User not found');
      }
      
      // Get site settings
      const siteTitle = siteSettingsService.getSiteTitle();
      
      res.render('users/edit-profile', {
        title: 'Edit Profile',
        pageTitle: 'Edit Profile',
        pageSubtitle: 'Update your account information',
        siteTitle: siteTitle,
        profileUser: user,
        pageCSS: `
          .form-group .help-block {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
          }
          .form-group.has-error .form-control {
            border-color: #dc3545;
          }
          .form-group.has-success .form-control {
            border-color: #28a745;
          }
        `
      });
    } catch (error) {
      console.error('Error rendering profile:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit profile form submission
   */
  public static async editProfilePost(req: Request, res: Response): Promise<void> {
    try {
      // Get current user from session
      const currentUser = (req.session as any).user;
      if (!currentUser) {
        return res.redirect('/admin/login');
      }
      
      const { name, password, confirmPassword, notes } = req.body;
      
      // Get full user data
      const user = usersService.getUserById(currentUser.id);
      if (!user) {
        return res.redirect('/admin/login?error=User not found');
      }
      
      // Validation
      if (!name || name.trim() === '') {
        return res.render('users/edit-profile', {
          title: 'Edit Profile',
          pageTitle: 'Edit Profile',
          pageSubtitle: 'Update your account information',
          profileUser: user,
          error: 'Name is required.',
          pageCSS: `
            .form-group .help-block {
              color: #dc3545;
              font-size: 12px;
              margin-top: 5px;
            }
            .form-group.has-error .form-control {
              border-color: #dc3545;
            }
            .form-group.has-success .form-control {
              border-color: #28a745;
            }
          `
        });
      }
      
      // Check password confirmation if password is provided
      if (password && password !== confirmPassword) {
        return res.render('users/edit-profile', {
          title: 'Edit Profile',
          pageTitle: 'Edit Profile',
          pageSubtitle: 'Update your account information',
          profileUser: user,
          error: 'Passwords do not match.',
          pageCSS: `
            .form-group .help-block {
              color: #dc3545;
              font-size: 12px;
              margin-top: 5px;
            }
            .form-group.has-error .form-control {
              border-color: #dc3545;
            }
            .form-group.has-success .form-control {
              border-color: #28a745;
            }
          `
        });
      }
      
      if (password && password.length < 6) {
        return res.render('users/edit-profile', {
          title: 'Edit Profile',
          pageTitle: 'Edit Profile',
          pageSubtitle: 'Update your account information',
          profileUser: user,
          error: 'Password must be at least 6 characters long.',
          pageCSS: `
            .form-group .help-block {
              color: #dc3545;
              font-size: 12px;
              margin-top: 5px;
            }
            .form-group.has-error .form-control {
              border-color: #dc3545;
            }
            .form-group.has-success .form-control {
              border-color: #28a745;
            }
          `
        });
      }
      
      // Prepare update data (excluding password)
      const updateData: any = {
        name: name.trim(),
        notes: notes || ''
      };
      
      // Update user basic info
      const updatedUser = usersService.updateUser(user.id, updateData);
      
      if (!updatedUser) {
        return res.render('users/edit-profile', {
          title: 'Edit Profile',
          pageTitle: 'Edit Profile',
          pageSubtitle: 'Update your account information',
          profileUser: user,
          error: 'Failed to update profile. Please try again.',
          pageCSS: `
            .form-group .help-block {
              color: #dc3545;
              font-size: 12px;
              margin-top: 5px;
            }
            .form-group.has-error .form-control {
              border-color: #dc3545;
            }
            .form-group.has-success .form-control {
              border-color: #28a745;
            }
          `
        });
      }
      
      // Update password if provided
      if (password) {
        const passwordUpdated = usersService.updateUserPassword(user.id, password);
        if (!passwordUpdated) {
          return res.render('users/edit-profile', {
            title: 'Edit Profile',
            pageTitle: 'Edit Profile',
            pageSubtitle: 'Update your account information',
            profileUser: user,
            error: 'Failed to update password. Please try again.',
            pageCSS: `
              .form-group .help-block {
                color: #dc3545;
                font-size: 12px;
                margin-top: 5px;
              }
              .form-group.has-error .form-control {
                border-color: #dc3545;
              }
              .form-group.has-success .form-control {
                border-color: #28a745;
              }
            `
          });
        }
      }
      
      // Get the final updated user data
      const finalUpdatedUser = usersService.getUserById(user.id);
      
      if (finalUpdatedUser) {
        // Update session with new user data
        (req.session as any).user = {
          id: finalUpdatedUser.id,
          name: finalUpdatedUser.name,
          email: finalUpdatedUser.email
        };
        
        res.render('users/edit-profile', {
          title: 'Edit Profile',
          pageTitle: 'Edit Profile',
          pageSubtitle: 'Update your account information',
          profileUser: finalUpdatedUser,
          success: 'Profile updated successfully.',
          pageCSS: `
            .form-group .help-block {
              color: #dc3545;
              font-size: 12px;
              margin-top: 5px;
            }
            .form-group.has-error .form-control {
              border-color: #dc3545;
            }
            .form-group.has-success .form-control {
              border-color: #28a745;
            }
          `
        });
      } else {
        res.render('users/edit-profile', {
          title: 'Edit Profile',
          pageTitle: 'Edit Profile',
          pageSubtitle: 'Update your account information',
          profileUser: user,
          error: 'Failed to update profile.',
          pageCSS: `
            .form-group .help-block {
              color: #dc3545;
              font-size: 12px;
              margin-top: 5px;
            }
            .form-group.has-error .form-control {
              border-color: #dc3545;
            }
            .form-group.has-success .form-control {
              border-color: #28a745;
            }
          `
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      res.render('users/edit-profile', {
        title: 'Edit Profile',
        pageTitle: 'Edit Profile',
        pageSubtitle: 'Update your account information',
        profileUser: (req.session as any).user,
        error: 'An error occurred while updating your profile.',
        pageCSS: `
          .form-group .help-block {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
          }
          .form-group.has-error .form-control {
            border-color: #dc3545;
          }
          .form-group.has-success .form-control {
            border-color: #28a745;
          }
        `
      });
    }
  }
} 
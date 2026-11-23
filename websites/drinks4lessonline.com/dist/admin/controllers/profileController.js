"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const usersService_1 = require("../services/usersService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
class ProfileController {
    static async profile(req, res) {
        try {
            const currentUser = req.session.user;
            if (!currentUser) {
                return res.redirect('/admin/login');
            }
            const user = await usersService_1.usersService.getUserById(currentUser.id);
            if (!user) {
                return res.redirect('/admin/login?error=User not found');
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
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
        }
        catch (error) {
            console.error('Error rendering profile:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async editProfilePost(req, res) {
        try {
            const currentUser = req.session.user;
            if (!currentUser) {
                return res.redirect('/admin/login');
            }
            const { name, password, confirmPassword, notes } = req.body;
            const user = await usersService_1.usersService.getUserById(currentUser.id);
            if (!user) {
                return res.redirect('/admin/login?error=User not found');
            }
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
            const updateData = {
                name: name.trim(),
                notes: notes || ''
            };
            const updatedUser = await usersService_1.usersService.updateUser(user.id, updateData);
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
            if (password) {
                const passwordUpdated = await usersService_1.usersService.updateUserPassword(user.id, password);
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
            const finalUpdatedUser = await usersService_1.usersService.getUserById(user.id);
            if (finalUpdatedUser) {
                req.session.user = {
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
            }
            else {
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
        }
        catch (error) {
            console.error('Error updating profile:', error);
            res.render('users/edit-profile', {
                title: 'Edit Profile',
                pageTitle: 'Edit Profile',
                pageSubtitle: 'Update your account information',
                profileUser: req.session.user,
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
exports.ProfileController = ProfileController;
//# sourceMappingURL=profileController.js.map
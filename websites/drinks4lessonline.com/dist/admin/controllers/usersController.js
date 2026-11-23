"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const usersService_1 = require("../services/usersService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
class UsersController {
    static async users(req, res) {
        try {
            const users = await usersService_1.usersService.getAllUsers();
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
        }
        catch (error) {
            console.error('Error rendering users:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createUser(req, res) {
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
        }
        catch (error) {
            console.error('Error rendering create user page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createUserPost(req, res) {
        try {
            const { name, email, phone, password, confirmPassword, status, role, notes } = req.body;
            const formData = { name, email, phone, status, role, notes };
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
            if (email) {
                const existingUser = await usersService_1.usersService.getUserByEmail(email);
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
            const newUser = await usersService_1.usersService.createUser({
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
            }
            else {
                res.render('users/user-form', {
                    title: 'Create User',
                    pageTitle: 'Create User',
                    pageSubtitle: 'Add a new admin user',
                    isCreateMode: true,
                    user: formData,
                    error: 'Failed to create user. Please try again.'
                });
            }
        }
        catch (error) {
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
    static async editUser(req, res) {
        try {
            const userId = parseInt(req.params.id);
            const user = await usersService_1.usersService.getUserById(userId);
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
        }
        catch (error) {
            console.error('Error rendering edit user page:', error);
            res.redirect('/admin/users?error=An error occurred');
        }
    }
    static async editUserPost(req, res) {
        try {
            const userId = parseInt(req.params.id);
            const { name, email, phone, password, confirmPassword, status, role, notes } = req.body;
            const existingUser = await usersService_1.usersService.getUserById(userId);
            if (!existingUser) {
                return res.redirect('/admin/users?error=User not found');
            }
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
            if (email && email !== existingUser.email) {
                const emailExists = await usersService_1.usersService.getUserByEmail(email);
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
            const updateData = {
                name,
                status: status || 'Active',
                role: role || 'Member',
                notes: notes || ''
            };
            if (email) {
                updateData.email = email;
            }
            if (phone) {
                updateData.phone = phone;
            }
            const updatedUser = await usersService_1.usersService.updateUser(userId, updateData);
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
            if (password) {
                const passwordUpdated = await usersService_1.usersService.updateUserPassword(userId, password);
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
        }
        catch (error) {
            console.error('Error updating user:', error);
            const userId = parseInt(req.params.id);
            const existingUser = await usersService_1.usersService.getUserById(userId);
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
    static async deleteUser(req, res) {
        try {
            const userId = parseInt(req.params.id);
            const existingUser = await usersService_1.usersService.getUserById(userId);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            const currentUser = req.session.user;
            if (currentUser && currentUser.id === userId) {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot delete your own account'
                });
            }
            const deleted = await usersService_1.usersService.deleteUser(userId);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'User deleted successfully'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete user'
                });
            }
        }
        catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while deleting the user'
            });
        }
    }
}
exports.UsersController = UsersController;
//# sourceMappingURL=usersController.js.map
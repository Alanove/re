const express = require('express');
const path = require('path');
const { UsersService } = require('../services/usersService');
const { SiteSettingsService } = require('../services/siteSettingsService');

// Initialize services
const usersService = new UsersService();
const siteSettingsService = SiteSettingsService.getInstance();

// Show login page
function showLogin(req, res) {
    const siteTitle = siteSettingsService.getSiteTitle() || 'CMS';
    res.render('auth/login', {
        title: `Admin Login - ${siteTitle}`,
        siteTitle: siteTitle,
        error: req.query.error || null,
        success: req.query.success || null
    });
}


// Handle login
async function handleLogin(req, res) {
    const { email, password } = req.body;
    const siteTitle = await siteSettingsService.getSiteTitle() || 'CMS';
    
    // Simple validation
    if (!email || !password) {
        return res.render('auth/login', {
            title: `Admin Login - ${siteTitle}`,
            siteTitle: siteTitle,
            error: 'Please enter both email and password'
        });
    }
    
    // Authenticate using UsersService
    const user = await usersService.authenticateUser(email, password);
    console.log('DEBUG handleLogin - Authenticated user:', user);
    
    if (user) {
        // Set session
        req.session.adminLoggedIn = true;
        req.session.adminUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            loginTime: new Date()
        };
        
        // Redirect to admin dashboard
        res.redirect('/admin/dashboard');
    } else {
        // Invalid credentials
        res.render('auth/login', {
            title: `Admin Login - ${siteTitle}`,
            siteTitle: siteTitle,
            error: 'Invalid email or password'
        });
    }
}

// Handle logout
function handleLogout(req, res) {
    // Clear session
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/admin/login?success=Logged out successfully');
    });
}

// Middleware to check if admin is logged in
function requireAuth(req, res, next) {
    if (req.session && req.session.adminLoggedIn) {
        next();
    } else {
        res.redirect('/admin/login?error=Please log in to access admin panel');
    }
}

// Show admin dashboard
function showDashboard(req, res) {
    const siteTitle = siteSettingsService.getSiteTitle() || 'CMS';
    res.render('dashboard/dashboard', {
        title: `Admin Dashboard - ${siteTitle}`,
        siteTitle: siteTitle,
        user: req.session.adminUser
    });
}

module.exports = {
    showLogin,
    handleLogin,
    handleLogout,
    requireAuth,
    showDashboard
}; 
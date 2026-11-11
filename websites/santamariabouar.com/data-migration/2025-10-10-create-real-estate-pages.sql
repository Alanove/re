-- Migration: Create pages for real estate website redesign
-- Date: 2025-10-10
-- Description: Creates pages for Home, Apartments for Rent, Apartments for Sale, Projects, and About Compound

-- First, clear existing pages if they exist (optional - remove if you want to keep old data)
DELETE FROM pages WHERE slug IN ('home', 'apartments-for-rent', 'apartments-for-sale', 'projects-info', 'about-compound');

-- Create Home page
INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, order_index, created_at, updated_at)
VALUES (
    'Home',
    'home',
    '<div class="welcome-section">
        <h1>Welcome to Santa Maria Bouar</h1>
        <p>Your premier residential compound in Bouar, offering modern apartments and exceptional living experiences.</p>
    </div>',
    'Santa Maria Bouar - Premier residential compound offering modern apartments for rent and sale in Bouar',
    'santa maria bouar, residential compound, apartments, bouar, real estate',
    'published',
    'home',
    1,
    NOW(),
    NOW()
);

-- Create Apartments for Rent page
INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, order_index, created_at, updated_at)
VALUES (
    'Apartments for Rent',
    'apartments-for-rent',
    '<div class="page-header">
        <h1>Apartments for Rent</h1>
        <p>Discover our selection of modern, fully-equipped apartments available for rent at Santa Maria Bouar.</p>
    </div>
    <div class="apartments-grid">
        <p>Browse our available rental units. Contact us for availability and viewing schedules.</p>
    </div>',
    'Find apartments for rent at Santa Maria Bouar - Modern, comfortable living spaces in a secure compound',
    'apartments for rent, bouar apartments, rental units, santa maria bouar',
    'published',
    'apartments-rent',
    2,
    NOW(),
    NOW()
);

-- Create Apartments for Sale page
INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, order_index, created_at, updated_at)
VALUES (
    'Apartments for Sale',
    'apartments-for-sale',
    '<div class="page-header">
        <h1>Apartments for Sale</h1>
        <p>Own your dream home at Santa Maria Bouar. Explore our apartments available for purchase.</p>
    </div>
    <div class="apartments-grid">
        <p>Invest in quality living. Browse our apartments for sale and secure your future home.</p>
    </div>',
    'Buy apartments at Santa Maria Bouar - Quality residential units for sale in a premium compound',
    'apartments for sale, buy apartment bouar, real estate, santa maria bouar',
    'published',
    'apartments-sale',
    3,
    NOW(),
    NOW()
);

-- Create Projects page (info about compound projects)
INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, order_index, created_at, updated_at)
VALUES (
    'Our Projects',
    'projects-info',
    '<div class="page-header">
        <h1>Our Projects</h1>
        <p>Discover the various development projects at Santa Maria Bouar compound.</p>
    </div>
    <div class="projects-overview">
        <h2>Current Developments</h2>
        <p>Santa Maria Bouar is continuously evolving with new developments and improvements to enhance your living experience.</p>
        
        <h3>Completed Projects</h3>
        <ul>
            <li>Phase 1 Residential Buildings</li>
            <li>Community Center</li>
            <li>Recreational Facilities</li>
        </ul>
        
        <h3>Ongoing Projects</h3>
        <ul>
            <li>Phase 2 Expansion</li>
            <li>Enhanced Security Systems</li>
            <li>Landscaping & Gardens</li>
        </ul>
    </div>',
    'Explore development projects at Santa Maria Bouar - Current and completed compound developments',
    'compound projects, santa maria development, bouar construction, residential projects',
    'published',
    'projects-page',
    4,
    NOW(),
    NOW()
);

-- Create About Compound page
INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, order_index, created_at, updated_at)
VALUES (
    'About Santa Maria Bouar',
    'about-compound',
    '<div class="page-header">
        <h1>About Santa Maria Bouar</h1>
        <p>Learn more about our premium residential compound</p>
    </div>
    
    <div class="about-content">
        <section class="about-section">
            <h2>Our Vision</h2>
            <p>Santa Maria Bouar is a premier residential compound designed to provide modern, comfortable, and secure living spaces for families and professionals in Bouar.</p>
        </section>
        
        <section class="about-section">
            <h2>Location</h2>
            <p>Strategically located in Bouar, our compound offers easy access to essential services, schools, shopping centers, and business districts while maintaining a peaceful residential atmosphere.</p>
        </section>
        
        <section class="about-section">
            <h2>Amenities</h2>
            <ul>
                <li>24/7 Security with controlled access</li>
                <li>Backup power supply</li>
                <li>Water supply system</li>
                <li>Parking facilities</li>
                <li>Green spaces and landscaped gardens</li>
                <li>Community center</li>
                <li>Recreational facilities</li>
            </ul>
        </section>
        
        <section class="about-section">
            <h2>Our Commitment</h2>
            <p>We are committed to maintaining high standards of living, ensuring resident satisfaction, and continuously improving our facilities and services.</p>
        </section>
    </div>',
    'About Santa Maria Bouar - Premier residential compound in Bouar offering modern living with excellent amenities',
    'santa maria bouar, about compound, residential community, bouar housing, apartment complex',
    'published',
    'about-page',
    5,
    NOW(),
    NOW()
);

-- Update menu items to reflect new structure
DELETE FROM menu WHERE url IN ('/', '/apartments-for-rent', '/apartments-for-sale', '/projects-info', '/about-compound');

-- Insert new menu items
INSERT INTO menu (title, url, parent_id, order_index, target, is_visible, created_at, updated_at)
VALUES 
    ('Home', '/', NULL, 1, '_self', TRUE, NOW(), NOW()),
    ('For Rent', '/apartments-for-rent', NULL, 2, '_self', TRUE, NOW(), NOW()),
    ('For Sale', '/apartments-for-sale', NULL, 3, '_self', TRUE, NOW(), NOW()),
    ('Projects', '/projects-info', NULL, 4, '_self', TRUE, NOW(), NOW()),
    ('About', '/about-compound', NULL, 5, '_self', TRUE, NOW(), NOW()),
    ('Contact', '/contact', NULL, 6, '_self', TRUE, NOW(), NOW());


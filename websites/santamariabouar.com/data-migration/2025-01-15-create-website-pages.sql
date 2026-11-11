-- Migration: Create Website Pages
-- Description: Add all main website pages for Santa Maria Bouar
-- Date: 2025-01-15

-- Insert main website pages (ignore duplicates)
INSERT IGNORE INTO pages (title, slug, content, meta_description, meta_keywords, status, template, order_index) VALUES
(
    'About Santa Maria Bouar',
    'about',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">About Santa Maria Bouar</h1>
                <p class="lead">Welcome to Santa Maria Bouar, a premier gated community that offers the perfect blend of luxury, comfort, and family-friendly living.</p>
                
                <div class="row mt-5">
                    <div class="col-md-6">
                        <h3>Our Community</h3>
                        <p>Santa Maria Bouar is a carefully planned gated community designed for families who value security, convenience, and quality of life. Our compound features modern amenities and beautiful landscaping that creates a serene environment for all residents.</p>
                    </div>
                    <div class="col-md-6">
                        <h3>Why Choose Us</h3>
                        <ul class="list-unstyled">
                            <li><i class="fas fa-shield-alt text-primary me-2"></i> 24/7 Security</li>
                            <li><i class="fas fa-users text-primary me-2"></i> Family-friendly environment</li>
                            <li><i class="fas fa-broom text-primary me-2"></i> Professional cleaning services</li>
                            <li><i class="fas fa-concierge-bell text-primary me-2"></i> Concierge services</li>
                            <li><i class="fas fa-swimming-pool text-primary me-2"></i> Swimming pool</li>
                            <li><i class="fas fa-child text-primary me-2"></i> Safe spaces for children</li>
                        </ul>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>Community Features</h3>
                    <p>Our compound is designed with families in mind, featuring spacious gardens where children can play safely, beautiful common areas for socializing, and modern facilities that make daily life convenient and enjoyable. The community is home to lovely neighbors, mostly families, creating a warm and welcoming atmosphere.</p>
                </div>
            </div>
        </div>
    </div>',
    'Learn about Santa Maria Bouar, a premier gated community with security, swimming pool, cleaning services, and family-friendly amenities.',
    'Santa Maria Bouar, gated community, security, swimming pool, family, concierge, cleaning',
    'published',
    'page',
    1
),
(
    'Facilities',
    'facilities',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Our Facilities</h1>
                <p class="lead">Discover the world-class facilities that make Santa Maria Bouar the perfect place to call home.</p>
                
                <div class="row mt-5">
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-swimming-pool fa-3x text-primary mb-3"></i>
                                <h4 class="card-title">Swimming Pool</h4>
                                <p class="card-text">Enjoy our beautiful swimming pool, perfect for relaxation and exercise. The pool area is well-maintained and provides a refreshing escape for residents.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-seedling fa-3x text-primary mb-3"></i>
                                <h4 class="card-title">Beautiful Gardens</h4>
                                <p class="card-text">Stroll through our meticulously maintained gardens featuring lush greenery, colorful flowers, and peaceful walking paths.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-broom fa-3x text-primary mb-3"></i>
                                <h4 class="card-title">Professional Cleaning</h4>
                                <p class="card-text">Our professional cleaning services ensure that common areas are always spotless and well-maintained for your comfort.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-concierge-bell fa-3x text-primary mb-3"></i>
                                <h4 class="card-title">Concierge Services</h4>
                                <p class="card-text">Our dedicated concierge team is available to assist with various services, making your daily life more convenient and comfortable.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-car fa-3x text-primary mb-3"></i>
                                <h4 class="card-title">Underground Parking</h4>
                                <p class="card-text">Secure underground parking spaces are available for all residents, providing protection for your vehicles and easy access to your apartment.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-shield-alt fa-3x text-primary mb-3"></i>
                                <h4 class="card-title">24/7 Security</h4>
                                <p class="card-text">Round-the-clock security ensures the safety and peace of mind for all residents and their families.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>',
    'Explore the facilities at Santa Maria Bouar including swimming pool, gardens, cleaning services, concierge, and underground parking.',
    'facilities, swimming pool, gardens, cleaning, concierge, parking, security',
    'published',
    'page',
    2
),
(
    'Apartment Types',
    'apartment-types',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Apartment Types</h1>
                <p class="lead">Choose from our carefully designed apartment types, each offering unique features and layouts to suit different lifestyles.</p>
                
                <div class="row mt-5">
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-body">
                                <h4 class="card-title text-primary">Roof Duplex</h4>
                                <p class="card-text">Experience luxury living in our exclusive roof duplex apartments. These premium units offer:</p>
                                <ul class="list-unstyled">
                                    <li><i class="fas fa-check text-success me-2"></i> Spacious two-level layout</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Private rooftop access</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Panoramic views</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Premium finishes</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Private outdoor space</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-body">
                                <h4 class="card-title text-primary">Simplex</h4>
                                <p class="card-text">Perfect for modern living, our simplex apartments feature:</p>
                                <ul class="list-unstyled">
                                    <li><i class="fas fa-check text-success me-2"></i> Open-plan design</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Modern kitchen</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Spacious living areas</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Quality fixtures</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Natural lighting</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-body">
                                <h4 class="card-title text-primary">Simplex with Garden</h4>
                                <p class="card-text">Enjoy the best of both worlds with our garden simplex apartments:</p>
                                <ul class="list-unstyled">
                                    <li><i class="fas fa-check text-success me-2"></i> Private garden access</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Ground floor convenience</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Outdoor living space</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Perfect for families</li>
                                    <li><i class="fas fa-check text-success me-2"></i> Direct garden access</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>All Apartments Include</h3>
                    <div class="row">
                        <div class="col-md-6">
                            <ul class="list-unstyled">
                                <li><i class="fas fa-wifi text-primary me-2"></i> High-speed internet ready</li>
                                <li><i class="fas fa-thermometer-half text-primary me-2"></i> Central air conditioning</li>
                                <li><i class="fas fa-tv text-primary me-2"></i> Cable TV connections</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <ul class="list-unstyled">
                                <li><i class="fas fa-lock text-primary me-2"></i> Secure entry systems</li>
                                <li><i class="fas fa-parking text-primary me-2"></i> Parking space included</li>
                                <li><i class="fas fa-tools text-primary me-2"></i> Modern appliances</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>',
    'Discover our apartment types at Santa Maria Bouar: Roof Duplex, Simplex, and Simplex with Garden options.',
    'apartment types, roof duplex, simplex, garden apartment, Santa Maria Bouar',
    'published',
    'page',
    3
),
(
    'For Rent',
    'for-rent',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Apartments for Rent</h1>
                <div class="alert alert-info">
                    <h4><i class="fas fa-info-circle me-2"></i>Coming Soon</h4>
                    <p class="mb-0">Our rental listings are currently being developed. Please check back soon for available apartments for rent at Santa Maria Bouar.</p>
                </div>
                
                <div class="mt-5">
                    <h3>Why Rent at Santa Maria Bouar?</h3>
                    <div class="row">
                        <div class="col-md-6">
                            <ul class="list-unstyled">
                                <li><i class="fas fa-shield-alt text-primary me-2"></i> Secure gated community</li>
                                <li><i class="fas fa-swimming-pool text-primary me-2"></i> Access to all facilities</li>
                                <li><i class="fas fa-broom text-primary me-2"></i> Professional cleaning services</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <ul class="list-unstyled">
                                <li><i class="fas fa-concierge-bell text-primary me-2"></i> Concierge services</li>
                                <li><i class="fas fa-parking text-primary me-2"></i> Underground parking</li>
                                <li><i class="fas fa-users text-primary me-2"></i> Family-friendly environment</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>Contact Us</h3>
                    <p>For rental inquiries, please contact our management team. We''ll be happy to provide more information about upcoming rental opportunities.</p>
                </div>
            </div>
        </div>
    </div>',
    'Apartments for rent at Santa Maria Bouar - coming soon. Secure gated community with premium facilities.',
    'apartments for rent, rental, Santa Maria Bouar, coming soon',
    'published',
    'page',
    4
),
(
    'For Sale',
    'for-sale',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Apartments for Sale</h1>
                <p class="lead">Discover available apartments for sale at Santa Maria Bouar, where luxury meets comfort in our gated community.</p>
                
                <div class="alert alert-success">
                    <h4><i class="fas fa-home me-2"></i>Available Properties</h4>
                    <p class="mb-0">We have a selection of premium apartments available for purchase. Contact us to schedule a viewing and learn more about our current offerings.</p>
                </div>
                
                <div class="row mt-5">
                    <div class="col-md-6">
                        <h3>Why Buy at Santa Maria Bouar?</h3>
                        <ul class="list-unstyled">
                            <li><i class="fas fa-chart-line text-primary me-2"></i> Excellent investment opportunity</li>
                            <li><i class="fas fa-shield-alt text-primary me-2"></i> Secure gated community</li>
                            <li><i class="fas fa-swimming-pool text-primary me-2"></i> Premium facilities</li>
                            <li><i class="fas fa-users text-primary me-2"></i> Family-friendly environment</li>
                            <li><i class="fas fa-map-marker-alt text-primary me-2"></i> Prime location</li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h3>Property Features</h3>
                        <ul class="list-unstyled">
                            <li><i class="fas fa-home text-primary me-2"></i> Modern apartment designs</li>
                            <li><i class="fas fa-parking text-primary me-2"></i> Underground parking</li>
                            <li><i class="fas fa-concierge-bell text-primary me-2"></i> Concierge services</li>
                            <li><i class="fas fa-broom text-primary me-2"></i> Professional maintenance</li>
                            <li><i class="fas fa-seedling text-primary me-2"></i> Beautiful gardens</li>
                        </ul>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>Contact Our Sales Team</h3>
                    <p>Interested in purchasing an apartment? Our sales team is ready to assist you with:</p>
                    <ul>
                        <li>Property viewings</li>
                        <li>Financing options</li>
                        <li>Legal documentation</li>
                        <li>Community information</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>',
    'Apartments for sale at Santa Maria Bouar. Premium properties in a secure gated community with excellent facilities.',
    'apartments for sale, property, real estate, Santa Maria Bouar, investment',
    'published',
    'page',
    5
),
(
    'Projects',
    'projects',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Our Projects</h1>
                <p class="lead">Explore our portfolio of completed and ongoing projects that showcase our commitment to quality and innovation.</p>
                
                <div class="alert alert-info">
                    <h4><i class="fas fa-info-circle me-2"></i>Project Portfolio</h4>
                    <p class="mb-0">Our projects section is currently being updated with detailed information about our completed developments and ongoing initiatives.</p>
                </div>
                
                <div class="mt-5">
                    <h3>Our Development Philosophy</h3>
                    <p>At Santa Maria Bouar, we believe in creating communities that enhance the quality of life for our residents. Our projects are designed with:</p>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h4>Quality Focus</h4>
                            <ul class="list-unstyled">
                                <li><i class="fas fa-check text-success me-2"></i> Premium materials</li>
                                <li><i class="fas fa-check text-success me-2"></i> Modern design</li>
                                <li><i class="fas fa-check text-success me-2"></i> Sustainable practices</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h4>Community Integration</h4>
                            <ul class="list-unstyled">
                                <li><i class="fas fa-check text-success me-2"></i> Family-friendly design</li>
                                <li><i class="fas fa-check text-success me-2"></i> Social spaces</li>
                                <li><i class="fas fa-check text-success me-2"></i> Green areas</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>Contact Us</h3>
                    <p>For more information about our projects and development plans, please contact our team.</p>
                </div>
            </div>
        </div>
    </div>',
    'Explore our projects at Santa Maria Bouar. Quality developments with modern design and community focus.',
    'projects, developments, Santa Maria Bouar, construction, real estate',
    'published',
    'page',
    6
),
(
    'Management',
    'management',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Our Management Team</h1>
                <p class="lead">Meet the dedicated professionals who ensure Santa Maria Bouar operates smoothly and maintains the highest standards of service.</p>
                
                <div class="row mt-5">
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-user-tie fa-3x text-primary"></i>
                                </div>
                                <h4 class="card-title">Eddy Asakey</h4>
                                <p class="card-text">Management Team Member</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-user-tie fa-3x text-primary"></i>
                                </div>
                                <h4 class="card-title">Mireille Saloum</h4>
                                <p class="card-text">Management Team Member</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-user-tie fa-3x text-primary"></i>
                                </div>
                                <h4 class="card-title">Alain Haddad</h4>
                                <p class="card-text">Management Team Member</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-user-tie fa-3x text-primary"></i>
                                </div>
                                <h4 class="card-title">Nadim Khalil</h4>
                                <p class="card-text">Management Team Member</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-user-tie fa-3x text-primary"></i>
                                </div>
                                <h4 class="card-title">Lilian Chidiac</h4>
                                <p class="card-text">Management Team Member</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-user-tie fa-3x text-primary"></i>
                                </div>
                                <h4 class="card-title">Paul Kadra</h4>
                                <p class="card-text">Management Team Member</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>Our Commitment</h3>
                    <p>Our management team is committed to providing excellent service and maintaining the highest standards for all residents. We work tirelessly to ensure that Santa Maria Bouar remains a premier community where families can thrive.</p>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h4>Our Services</h4>
                            <ul class="list-unstyled">
                                <li><i class="fas fa-cogs text-primary me-2"></i> Property maintenance</li>
                                <li><i class="fas fa-users text-primary me-2"></i> Resident support</li>
                                <li><i class="fas fa-shield-alt text-primary me-2"></i> Security management</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h4>Our Values</h4>
                            <ul class="list-unstyled">
                                <li><i class="fas fa-heart text-primary me-2"></i> Community focus</li>
                                <li><i class="fas fa-handshake text-primary me-2"></i> Professional service</li>
                                <li><i class="fas fa-star text-primary me-2"></i> Excellence standards</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>',
    'Meet the management team at Santa Maria Bouar. Professional team dedicated to community excellence and resident satisfaction.',
    'management team, Santa Maria Bouar, Eddy Asakey, Mireille Saloum, Alain Haddad, Nadim Khalil, Lilian Chidiac, Paul Kadra',
    'published',
    'page',
    7
),
(
    'Contact Us',
    'contact',
    '<div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto">
                <h1 class="mb-4">Contact Us</h1>
                <p class="lead">Get in touch with us for more information about Santa Maria Bouar, available apartments, or any inquiries you may have.</p>
                
                <div class="row mt-5">
                    <div class="col-md-6">
                        <h3>Get in Touch</h3>
                        <div class="contact-info">
                            <div class="mb-3">
                                <i class="fas fa-map-marker-alt text-primary me-2"></i>
                                <strong>Address:</strong><br>
                                Santa Maria Bouar<br>
                                Bouar, Central African Republic
                            </div>
                            <div class="mb-3">
                                <i class="fas fa-phone text-primary me-2"></i>
                                <strong>Phone:</strong><br>
                                Contact our management office for phone numbers
                            </div>
                            <div class="mb-3">
                                <i class="fas fa-envelope text-primary me-2"></i>
                                <strong>Email:</strong><br>
                                info@santamariabouar.com
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h3>Office Hours</h3>
                        <div class="office-hours">
                            <p><strong>Monday - Friday:</strong> 8:00 AM - 5:00 PM</p>
                            <p><strong>Saturday:</strong> 9:00 AM - 1:00 PM</p>
                            <p><strong>Sunday:</strong> Closed</p>
                        </div>
                    </div>
                </div>
                
                <div class="mt-5">
                    <h3>Visit Our Community</h3>
                    <p>We welcome visitors to Santa Maria Bouar. Please contact us to schedule a tour of our facilities and available apartments. Our team will be happy to show you around and answer any questions you may have.</p>
                </div>
                
                <div class="mt-5">
                    <h3>Inquiries</h3>
                    <p>For general inquiries, apartment availability, or community information, please reach out to our management team. We''re here to help and provide you with all the information you need about living at Santa Maria Bouar.</p>
                </div>
            </div>
        </div>
    </div>',
    'Contact Santa Maria Bouar for information about apartments, community facilities, and living in our gated community.',
    'contact, Santa Maria Bouar, apartments, information, visit, tour',
    'published',
    'page',
    8
);

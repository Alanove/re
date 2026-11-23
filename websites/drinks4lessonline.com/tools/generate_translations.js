const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../data/locales');
const languages = ['en', 'fr', 'ar', 'ru'];

// List of verified missing keys from audit
const missingKeys = [
    "ecommerce.addToCart",
    "ecommerce.addToWishlist",
    "ecommerce.additionalInformation",
    "ecommerce.allCategories",
    "ecommerce.applyFilter",
    "ecommerce.cart.applyCoupon",
    "ecommerce.cart.continueShopping",
    "ecommerce.cart.couponCode",
    "ecommerce.cart.discount",
    "ecommerce.cart.editCart",
    "ecommerce.cart.empty",
    "ecommerce.cart.proceedToCheckout",
    "ecommerce.cart.products",
    "ecommerce.cart.removeItemConfirm",
    "ecommerce.cart.shipping",
    "ecommerce.cart.summary",
    "ecommerce.categories",
    "ecommerce.checkout.addressLine1",
    "ecommerce.checkout.addressLine2",
    "ecommerce.checkout.billingAddress",
    "ecommerce.checkout.city",
    "ecommerce.checkout.country",
    "ecommerce.checkout.email",
    "ecommerce.checkout.firstName",
    "ecommerce.checkout.lastName",
    "ecommerce.checkout.mobileNo",
    "ecommerce.checkout.orderTotal",
    "ecommerce.checkout.payment",
    "ecommerce.checkout.shipToDifferent",
    "ecommerce.checkout.shippingMethods",
    "ecommerce.checkout.state",
    "ecommerce.checkout.zipCode",
    "ecommerce.common.home",
    "ecommerce.common.shop",
    "ecommerce.customer.account",
    "ecommerce.customer.defaultAddress",
    "ecommerce.customer.loginWithFacebook",
    "ecommerce.customer.loginWithGoogle",
    "ecommerce.customer.loginWithMicrosoft",
    "ecommerce.customer.manageAddresses",
    "ecommerce.customer.noAddresses",
    "ecommerce.customer.noOrders",
    "ecommerce.customer.noWishlist",
    "ecommerce.customer.orLoginWith",
    "ecommerce.customer.orderHistory",
    "ecommerce.customer.recentOrders",
    "ecommerce.customer.savedAddresses",
    "ecommerce.customer.viewAllOrders",
    "ecommerce.dimensions",
    "ecommerce.featured",
    "ecommerce.featuredProducts",
    "ecommerce.filterByPrice",
    "ecommerce.inStock",
    "ecommerce.latest",
    "ecommerce.leaveReview",
    "ecommerce.left",
    "ecommerce.lowStock",
    "ecommerce.maxPrice",
    "ecommerce.minPrice",
    "ecommerce.nameAZ",
    "ecommerce.noCategoriesFound",
    "ecommerce.noDescription",
    "ecommerce.noProductsFound",
    "ecommerce.noReviewsYet",
    "ecommerce.of",
    "ecommerce.outOfStock",
    "ecommerce.pleaseSelectRating",
    "ecommerce.pleaseSelectVariant",
    "ecommerce.priceHighToLow",
    "ecommerce.priceLowToHigh",
    "ecommerce.productCatalog",
    "ecommerce.productDescription",
    "ecommerce.productsLabel",
    "ecommerce.relatedProducts",
    "ecommerce.reviewFor",
    "ecommerce.reviewPrivacy",
    "ecommerce.reviewSubmitted",
    "ecommerce.reviews",
    "ecommerce.searchProducts",
    "ecommerce.shareOn",
    "ecommerce.shopByCategory",
    "ecommerce.showing",
    "ecommerce.sortBy",
    "ecommerce.submitReview",
    "ecommerce.tryDifferentFilters",
    "ecommerce.verifiedPurchase",
    "ecommerce.viewDetails",
    "ecommerce.weight",
    "ecommerce.yourEmail",
    "ecommerce.yourName",
    "ecommerce.yourRating",
    "ecommerce.yourReview"
];

function humanize(str) {
    // Get the last part of the key
    const parts = str.split('.');
    let last = parts[parts.length - 1];
    
    // Split camelCase
    let result = last.replace(/([A-Z])/g, " $1");
    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);
    
    return result.trim();
}

function setValue(obj, path, value) {
    const p = path.split('.');
    for (let i = 0; i < p.length - 1; i++) {
        const key = p[i];
        if (!obj[key] || typeof obj[key] !== 'object') {
            obj[key] = {};
        }
        obj = obj[key];
    }
    const finalKey = p[p.length - 1];
    // Only set if not exists, or overwrite?
    // User said "generate it if not available". 
    // But audit showed they are missing.
    // We should check existence just in case.
    if (!obj[finalKey]) {
        obj[finalKey] = value;
        console.log(`Added: ${path} = "${value}"`);
    }
}

function main() {
    languages.forEach(lang => {
        const file = path.join(localesDir, `${lang}.json`);
        let content = {};
        if (fs.existsSync(file)) {
            content = JSON.parse(fs.readFileSync(file, 'utf8'));
        }

        console.log(`Processing ${lang}...`);
        missingKeys.forEach(key => {
            const text = humanize(key);
            // ideally we would translate 'text' here based on 'lang'
            // but for now we use English as placeholder
            setValue(content, key, text);
        });

        fs.writeFileSync(file, JSON.stringify(content, null, 2));
    });
    console.log("Done.");
}

main();

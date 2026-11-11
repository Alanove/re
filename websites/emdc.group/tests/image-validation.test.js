const { ImageUtils } = require('../dist/src/utils/imageUtils');

// Test image validation
console.log('Testing image validation...');

// Test with existing image
const existingImage = '/pages/our-soft-skills/our-soft-skills-default.jpg';
const existingResult = ImageUtils.validateImagePath(existingImage);
console.log(`Existing image test: ${existingImage} -> ${existingResult}`);

// Test with non-existing image
const nonExistingImage = '/pages/non-existing/image.jpg';
const nonExistingResult = ImageUtils.validateImagePath(nonExistingImage);
console.log(`Non-existing image test: ${nonExistingImage} -> ${nonExistingResult}`);

// Test getBestImage
const possibleImages = [
  '/pages/our-soft-skills/our-soft-skills-default.jpg',
  '/pages/non-existing/image.jpg',
  '/images/logo.jpg'
];
const bestImage = ImageUtils.getBestImage(possibleImages);
console.log(`Best image from ${possibleImages.join(', ')} -> ${bestImage}`);

// Test image info
const imageInfo = ImageUtils.getImageInfo(existingImage);
console.log('Image info:', imageInfo);

# Bug Fix: Slider Move Functionality

## Issue
Error when trying to move slides up or down in the admin panel:
```
http://localhost:3002/admin/slider?error=Failed%20to%20move%20slide
```

## Root Causes

### 1. Missing Service Methods
The `SliderController` was calling `sliderService.moveSlideUp()` and `sliderService.moveSlideDown()` methods that didn't exist in the `SliderService` class.

**Error in Controller:**
```typescript
const success = await sliderService.moveSlideUp(id);  // Method not found!
```

### 2. Duplicate Order Indices
Both slides in the database had `order_index = 0`, which would cause issues with the move logic even after implementing the methods.

## Solutions Applied

### 1. Implemented Missing Methods in SliderService

**Added `moveSlideUp(id: string)`:**
- Gets the current slide and all slides ordered by order_index
- Finds the slide above the current one
- Swaps their order_index values
- Returns false if already at top

**Added `moveSlideDown(id: string)`:**
- Gets the current slide and all slides ordered by order_index
- Finds the slide below the current one
- Swaps their order_index values
- Returns false if already at bottom

**Added `toggleSlideActive(id: string)`:**
- Toggles the is_active status of a slide
- This method was also called by the controller but was missing

### 2. Fixed Order Indices in Database

Updated the database to have sequential order indices:
- Slide 1: order_index = 0
- Slide 2: order_index = 1

## Implementation Details

### SliderService Methods

```typescript
public async moveSlideUp(id: string): Promise<boolean> {
  try {
    // Get current slide
    const currentSlide = await this.getSlideById(id);
    if (!currentSlide) return false;

    // Get all slides ordered by order_index
    const allSlides = await this.getAllSlides();
    
    // Find current slide index
    const currentIndex = allSlides.findIndex(s => s.id === id);
    if (currentIndex <= 0) return false; // Already at top

    // Get the slide above
    const slideAbove = allSlides[currentIndex - 1];

    // Swap order_index values
    await db.query(`UPDATE slider SET order_index = ? WHERE id = ?`, 
      [slideAbove.order, currentSlide.id]);
    await db.query(`UPDATE slider SET order_index = ? WHERE id = ?`, 
      [currentSlide.order, slideAbove.id]);

    return true;
  } catch (error) {
    console.error('Error moving slide up:', error);
    return false;
  }
}
```

Similar logic for `moveSlideDown()` but swapping with the slide below.

```typescript
public async toggleSlideActive(id: string): Promise<boolean> {
  try {
    const slide = await this.getSlideById(id);
    if (!slide) return false;

    await db.query(`
      UPDATE slider SET is_active = ? WHERE id = ?
    `, [slide.active ? 0 : 1, id]);

    return true;
  } catch (error) {
    console.error('Error toggling slide active:', error);
    return false;
  }
}
```

## Testing

To verify the fix:

1. **Go to Admin → Slider**
   ```
   http://localhost:3002/admin/slider
   ```

2. **Test Move Up/Down**:
   - Click the up arrow (↑) on the second slide
   - It should move to the first position
   - Click the down arrow (↓) to move it back
   - Should see success messages

3. **Test Toggle Active**:
   - Click the toggle button (🔘)
   - Slide should become inactive (gray badge)
   - Click again to reactivate

## Expected Behavior

- ✅ Move up works (swaps with slide above)
- ✅ Move down works (swaps with slide below)
- ✅ Can't move first slide up (returns "Cannot move slide up")
- ✅ Can't move last slide down (returns "Cannot move slide down")
- ✅ Toggle active changes slide visibility on homepage
- ✅ Success messages display after each action

## Files Modified

1. **admin/services/sliderService.ts**
   - Added `moveSlideUp(id: string): Promise<boolean>`
   - Added `moveSlideDown(id: string): Promise<boolean>`
   - Added `toggleSlideActive(id: string): Promise<boolean>`

2. **Database (slider table)**
   - Fixed order_index values to be sequential (0, 1, 2, ...)

## Status

✅ **FIXED** - Slide movement and toggle functionality now works correctly.

## Date
October 10, 2025


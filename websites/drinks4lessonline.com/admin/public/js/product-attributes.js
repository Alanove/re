/**
 * Product Attributes Selection and Variant Generation
 * Handles dynamic attribute addition, value selection, inline image uploads, and incremental variant generation
 */

(function () {
    'use strict';

    // State management
    const state = {
        productId: null,
        availableAttributes: [], // All attributes from server
        addedAttributes: new Set(), // IDs of attributes added to the UI
        selectedValues: new Map(), // Map<attributeId, Set<valueId>>
        existingVariants: new Set() // Set of existing variant signatures (e.g., "Color:Red|Size:M")
    };

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function () {
        state.productId = getProductIdFromUrl();
        if (!state.productId) return;

        // Expose updateVariantField globally
        window.updateVariantField = updateVariantField;

        initializeState();
        initializeEventListeners();
    });

    /**
     * Initialize state by fetching data
     */
    async function initializeState() {
        try {
            // 0. Fetch existing variants from injected data (for Persistence inference)
            const variantsDataEl = document.getElementById('product-variants-data');
            const allVariants = variantsDataEl ? JSON.parse(variantsDataEl.dataset.variants || '[]') : [];

            // Analyze used attribute values
            const usedAttributeValues = new Set(); // Set of "AttributeName:Value"
            allVariants.forEach(v => {
                if (v.attributes) {
                    Object.entries(v.attributes).forEach(([key, val]) => {
                        usedAttributeValues.add(`${key}:${val}`);
                    });
                }
            });
            const hasVariants = allVariants.length > 0;

            // 1. Fetch available attributes
            const typesDataEl = document.getElementById('available-attributes-data');
            if (typesDataEl) {
                state.availableAttributes = JSON.parse(typesDataEl.dataset.types);
            }

            // 2. Fetch existing product attributes (persistence)
            // This endpoint returns ALL values for the attribute type.
            // We must filter selection based on actual variant usage.
            const savedAttrsResponse = await fetch(`/admin/products/${state.productId}/attributes`);
            const savedAttrsData = await savedAttrsResponse.json();

            if (savedAttrsData.success) {
                savedAttrsData.attributes.forEach(attr => {
                    addAttributeToUI(attr.id, attr); // Add to UI

                    // Pre-select values
                    if (attr.values) {
                        attr.values.forEach(val => {
                            // Logic: 
                            // 1. Check persistent selected_values first
                            // 2. Fallback to existing variants usage (legacy)
                            // 3. Fallback to pre-selected flag (new)
                            
                            let shouldSelect = false;
                            
                            // Check persisted persistence - safely handle potential nulls/undefined
                            if (attr.selected_values && Array.isArray(attr.selected_values) && attr.selected_values.length > 0) {
                                shouldSelect = attr.selected_values.includes(val.id);
                            } else if (attr.selected_values && Array.isArray(attr.selected_values) && attr.selected_values.length === 0 && !hasVariants) {
                                // Explicitly empty and no variants = nothing selected (user unselected all)
                                shouldSelect = false;
                            } else {
                                // Fallback for legacy data (null selected_values)
                                const isUsed = usedAttributeValues.has(`${attr.name}:${val.value}`);
                                shouldSelect = hasVariants ? isUsed : (val.is_preselected || false);
                            }

                            if (shouldSelect) {
                                toggleValueSelection(attr.id, val.id, true, true); // true = skipSave
                                // Toggle checkbox
                                const checkbox = document.querySelector(`.attribute-value-checkbox[value="${val.id}"]`);
                                if (checkbox) checkbox.checked = true;
                            }
                        });
                    }
                });
            }

            // 3. Mark existing variants to prevent duplicates
            allVariants.forEach(v => {
                if (v.attributes) {
                    const sig = Object.entries(v.attributes)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([k, val]) => `${k}:${val}`)
                        .join('|');
                    state.existingVariants.add(sig);
                }
            });

        } catch (error) {
            console.error('Error initializing product attributes:', error);
        }
    }

    /**
     * Update a variant field directly from grid (Price/Stock)
     */
    async function updateVariantField(variantId, field, value) {
        if (!variantId) return;

        const input = document.activeElement;
        const originalBorder = input ? input.style.borderColor : '';
        if (input) input.style.borderColor = '#ffc107'; // Yellow for saving

        try {
            const formData = new FormData();
            formData.append(field, value);
            // Add CSRF
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            formData.append('_csrf', csrfToken);

            const response = await fetch(`/admin/products/${state.productId}/variants/${variantId}`, {
                method: 'PUT',
                headers: {
                    'X-CSRF-Token': csrfToken,
                    'CSRF-Token': csrfToken
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showToast('Variant updated', 'success');
                if (input) input.style.borderColor = '#198754'; // Green
                setTimeout(() => { if (input) input.style.borderColor = originalBorder; }, 1000);
                const editBtn = document.querySelector(`.edit-variant-btn[data-variant-id="${variantId}"]`);
                if (editBtn && field === 'sku') {
                    editBtn.setAttribute('data-variant-sku', value);
                }
            } else {
                showToast(data.error || 'Update failed', 'error');
                if (input) input.style.borderColor = '#dc3545'; // Red
            }
        } catch (e) {
            console.error('Error updating variant:', e);
            showToast('Network error', 'error');
        }
    }

    /**
     * Initialize event listeners
     */
    function initializeEventListeners() {
        // Add Attribute Button
        const addAttrBtn = document.getElementById('addAttributeBtn');
        if (addAttrBtn) {
            addAttrBtn.addEventListener('click', showAddAttributeModal);
        }

        // Attribute Helper - Add selected attribute
        const confirmAddAttrBtn = document.getElementById('confirmAddAttributeBtn');
        if (confirmAddAttrBtn) {
            confirmAddAttrBtn.addEventListener('click', handleAddAttribute);
        }

        // Generate Variants Button
        const generateBtn = document.getElementById('generateVariantsFromAttributesBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', generateVariantsFromAttributes);
        }

        // Delegate events for dynamic elements
        document.getElementById('productAttributesContainer').addEventListener('click', function (e) {
            // Remove Attribute
            if (e.target.closest('.remove-attribute-btn')) {
                const attrId = parseInt(e.target.closest('.remove-attribute-btn').dataset.attributeId);
                removeAttribute(attrId);
            }

            // Upload Image Button
            if (e.target.closest('.upload-attribute-value-image-btn')) {
                const btn = e.target.closest('.upload-attribute-value-image-btn');
                const valueId = btn.dataset.valueId;
                const fileInput = document.querySelector(`.attribute-value-image-input[data-value-id="${valueId}"]`);
                if (fileInput) fileInput.click();
            }

            // Delete Image Button
            if (e.target.closest('.delete-attribute-value-image-btn')) {
                const btn = e.target.closest('.delete-attribute-value-image-btn');
                const valueId = btn.dataset.valueId;
                deleteAttributeValueImage(valueId, btn);
            }
        });

        // Delegate change events
        document.getElementById('productAttributesContainer').addEventListener('change', function (e) {
            // Value Checkbox
            if (e.target.classList.contains('attribute-value-checkbox')) {
                const attrId = parseInt(e.target.dataset.attributeId);
                const valueId = parseInt(e.target.value);
                toggleValueSelection(attrId, valueId, e.target.checked);
            }

            // Image File Input
            if (e.target.classList.contains('attribute-value-image-input')) {
                const valueId = e.target.dataset.valueId;
                const file = e.target.files[0];
                if (file) {
                    uploadAttributeValueImage(valueId, file, e.target);
                }
            }
        });

        // Grid Editing (Price/Stock) delegation
        const variantsTable = document.getElementById('variantsTableBody');
        if (variantsTable) {
            variantsTable.addEventListener('change', function (e) {
                if (e.target.classList.contains('grid-edit-input')) {
                    const variantId = e.target.dataset.variantId;
                    const field = e.target.dataset.field;
                    const value = e.target.value;
                    updateVariantField(variantId, field, value);
                }
            });
        }
    }

    /**
     * Add attribute to the UI
     */
    function addAttributeToUI(attributeId, loadedData = null) {
        if (state.addedAttributes.has(attributeId)) return;

        // Find attribute data (either from loaded data or available list)
        let attribute = loadedData;
        if (!attribute) {
            attribute = state.availableAttributes.find(a => a.id === attributeId);
        }

        if (!attribute) return;

        state.addedAttributes.add(attributeId);
        if (!state.selectedValues.has(attributeId)) {
            state.selectedValues.set(attributeId, new Set());
        }

        // Render Attribute Card
        const container = document.getElementById('productAttributesContainer');
        const cardHtml = `
      <div class="card mb-3 attribute-card" data-attribute-id="${attribute.id}">
        <div class="card-header d-flex justify-content-between align-items-center bg-light">
          <h6 class="mb-0 fw-bold">${attribute.name}</h6>
          <button type="button" class="btn btn-sm btn-outline-danger remove-attribute-btn" data-attribute-id="${attribute.id}">
            <i class="fa fa-times"></i> Remove
          </button>
        </div>
        <div class="card-body p-0">
          <table class="table table-hover mb-0">
            <tbody>
              ${attribute.values.map(val => renderValueRow(attribute, val)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

        container.insertAdjacentHTML('beforeend', cardHtml);

        // Save association to server if it's a new addition (not loaded from server)
        if (!loadedData) {
            saveProductAttributeAssociation(attributeId);
        }

        updateVariantPreview();
    }

    /**
     * Render a single value row
     */
    function renderValueRow(attribute, value) {
        const isChecked = state.selectedValues.has(attribute.id) && state.selectedValues.get(attribute.id).has(value.id);
        const hasImage = attribute.has_image || attribute.hasImage; // Handle different casing
        const imageUrl = value.image_url;

        return `
      <tr class="${isChecked ? 'table-active' : ''}">
        <td style="width: 40px;" class="align-middle text-center">
          <div class="form-check">
            <input class="form-check-input attribute-value-checkbox" type="checkbox" 
              value="${value.id}" 
              id="val_${value.id}"
              data-attribute-id="${attribute.id}"
              data-value="${value.value}"
              ${isChecked ? 'checked' : ''}>
          </div>
        </td>
        <td class="align-middle">
          <label class="form-check-label d-block cursor-pointer" for="val_${value.id}">
            <span class="fw-medium">${value.value}</span>
            ${value.color_code ? `<span class="d-inline-block ms-2 border rounded" style="width: 20px; height: 20px; background-color: ${value.color_code}; vertical-align: middle;"></span>` : ''}
          </label>
        </td>
        <td class="align-middle text-end" style="width: 200px;">
          ${hasImage ? `
            <div class="image-upload-container" data-value-id="${value.id}">
              ${imageUrl ? `
                <div class="position-relative d-inline-block">
                  <img src="${imageUrl}" class="img-thumbnail" style="width: 50px; height: 50px; object-fit: cover;">
                  <button type="button" class="btn btn-xs btn-danger position-absolute top-0 end-0 p-0 d-flex justify-content-center align-items-center delete-attribute-value-image-btn" 
                    style="width: 18px; height: 18px; line-height: 1;" 
                    data-value-id="${value.id}" title="Delete Image">
                    &times;
                  </button>
                </div>
              ` : `
                <input type="file" class="d-none attribute-value-image-input" data-value-id="${value.id}" accept="image/*">
                <button type="button" class="btn btn-sm btn-outline-secondary upload-attribute-value-image-btn" data-value-id="${value.id}">
                  <i class="fa fa-image"></i> Add Image
                </button>
              `}
            </div>
          ` : ''}
        </td>
      </tr>
    `;
    }

    /**
     * Handle adding an attribute (from selection modal/dropdown)
     */
    function handleAddAttribute() {
        const select = document.getElementById('attributeSelect');
        const selectedId = parseInt(select.value);

        if (selectedId) {
            addAttributeToUI(selectedId);
            // Close modal if used
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addAttributeModal'));
            if (modalInstance) modalInstance.hide();
        }
    }

    /**
     * Remove attribute
     */
    async function removeAttribute(attributeId) {
        if (!confirm('Are you sure you want to remove this attribute? This will allow you to re-add it later.')) return;

        // Remove from UI
        const card = document.querySelector(`.attribute-card[data-attribute-id="${attributeId}"]`);
        if (card) card.remove();

        // Update state
        state.addedAttributes.delete(attributeId);
        state.selectedValues.delete(attributeId);

        // Remove association from server
        try {
            await fetch(`/admin/products/${state.productId}/attributes/${attributeId}`, {
                method: 'DELETE',
                headers: { 'X-CSRF-Token': getCsrfToken() }
            });
        } catch (e) {
            console.error('Error deleting attribute association', e);
        }

        updateVariantPreview();
    }

    /**
     * Toggle value selection
     */
    function toggleValueSelection(attributeId, valueId, isSelected, skipSave = false) {
        if (!state.selectedValues.has(attributeId)) {
            state.selectedValues.set(attributeId, new Set());
        }

        if (isSelected) {
            state.selectedValues.get(attributeId).add(valueId);
        } else {
            state.selectedValues.get(attributeId).delete(valueId);
        }

        // Highlight row
        const checkbox = document.querySelector(`.attribute-value-checkbox[value="${valueId}"]`);
        if (checkbox) {
            const row = checkbox.closest('tr');
            if (isSelected) row.classList.add('table-active');
            else row.classList.remove('table-active');
        }

        // Save persistent selection
        if (!skipSave) {
            saveAttributeSelection(attributeId);
        }

        updateVariantPreview();
    }

    /**
     * Save attribute selection to server
     */
    const saveQueue = new Map(); // Debounce map

    async function saveAttributeSelection(attributeId) {
        // Debounce saves per attribute
        if (saveQueue.has(attributeId)) {
            clearTimeout(saveQueue.get(attributeId));
        }

        saveQueue.set(attributeId, setTimeout(async () => {
             try {
                const selectedIds = Array.from(state.selectedValues.get(attributeId) || []);
                
                await fetch(`/admin/products/${state.productId}/attributes/${attributeId}/selection`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': getCsrfToken()
                    },
                    body: JSON.stringify({
                        selected_values: selectedIds,
                        _csrf: getCsrfToken()
                    })
                });
            } catch (e) {
                console.error('Error saving attribute selection', e);
            }
            saveQueue.delete(attributeId);
        }, 500));
    }

    /**
     * Upload Image
     */
    async function uploadAttributeValueImage(valueId, file, inputElement) {
        const container = inputElement.closest('.image-upload-container');
        const formData = new FormData();
        formData.append('image', file);
        formData.append('_csrf', getCsrfToken());

        // Show loading
        container.innerHTML = '<span class="spinner-border spinner-border-sm text-primary"></span> Uploading...';

        try {
            const q = state.productId ? `?productId=${encodeURIComponent(state.productId)}` : '';
            const response = await fetch(`/admin/attributes/values/${valueId}/image${q}`, {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': getCsrfToken()
                },
                body: formData // FormData already has _csrf appended in line 341
            });
            const data = await response.json();

            if (data.success) {
                // Render image
                container.innerHTML = `
          <div class="position-relative d-inline-block">
            <img src="${data.image_url}" class="img-thumbnail" style="width: 50px; height: 50px; object-fit: cover;">
            <button type="button" class="btn btn-xs btn-danger position-absolute top-0 end-0 p-0 d-flex justify-content-center align-items-center delete-attribute-value-image-btn" 
              style="width: 18px; height: 18px; line-height: 1;" 
              data-value-id="${valueId}" title="Delete Image">
              &times;
            </button>
          </div>
        `;
            } else {
                container.innerHTML = `Error: ${data.error}`;
                // Reset after delay
                setTimeout(() => {
                    // Re-render empty state... slightly complex without full re-render, so let's just cheat:
                    location.reload(); // Simplest fallback for error recovery in this quick script
                }, 2000);
            }
        } catch (e) {
            console.error(e);
            container.textContent = 'Upload failed';
        }
    }

    /**
   * Delete Image
   */
    async function deleteAttributeValueImage(valueId, btn) {
        if (!confirm("Delete this image?")) return;

        const container = btn.closest('.image-upload-container');
        try {
            const q = state.productId ? `?productId=${encodeURIComponent(state.productId)}` : '';
            const response = await fetch(`/admin/attributes/values/${valueId}/image${q}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify({ _csrf: getCsrfToken() })
            });
            const data = await response.json();

            if (data.success) {
                container.innerHTML = `
                <input type="file" class="d-none attribute-value-image-input" data-value-id="${valueId}" accept="image/*">
                <button type="button" class="btn btn-sm btn-outline-secondary upload-attribute-value-image-btn" data-value-id="${valueId}">
                  <i class="fa fa-image"></i> Add Image
                </button>
           `;
            }
        } catch (e) {
            console.log(e);
            alert("Failed to delete");
        }
    }

    /**
     * Save Product <-> Attribute Association
     */
    async function saveProductAttributeAssociation(attributeId) {
        try {
            await fetch(`/admin/products/${state.productId}/attributes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify({
                    variant_type_id: attributeId,
                    _csrf: getCsrfToken()
                })
            });
        } catch (e) {
            console.error('Error saving association', e);
        }
    }

    /**
     * Generate Variants
     */
    async function generateVariantsFromAttributes() {
        // 1. Get all selected values
        const selectedData = [];
        state.selectedValues.forEach((selectedSet, attrId) => {
            if (selectedSet.size > 0) {
                const attr = state.availableAttributes.find(a => a.id === attrId) ||
                    Array.from(document.querySelectorAll('.attribute-card')).map(c => ({
                        id: parseInt(c.dataset.attributeId),
                        name: c.querySelector('h6').textContent.trim()
                    })).find(a => a.id === attrId);

                if (attr) {
                    const values = [];
                    // Need to get value names. 
                    // We can grab them from the DOM to avoid complex lookups if state.availableAttributes is partial
                    selectedSet.forEach(valId => {
                        const label = document.querySelector(`label[for="val_${valId}"] span.fw-medium`);
                        if (label) values.push({ id: valId, value: label.textContent.trim() });
                    });
                    selectedData.push({ name: attr.name, values: values });
                }
            }
        });

        if (selectedData.length === 0) {
            alert("Please select values from at least one attribute.");
            return;
        }

        // 2. Cartesian Product
        const combinations = cartesianProduct(selectedData.map(d => d.values));

        // 3. Filter Duplicates (Simple name check or attribute check)
        // Get existing variants names
        const existingVariantNames = Array.from(document.querySelectorAll('#variantsTableBody tr[data-variant-name]'))
            .map(row => row.dataset.variantName);

        const newVariants = [];
        combinations.forEach(combo => {
            // Create name: "Value1 - Value2"
            const name = combo.map(c => c.value).join(' - ');
            const attributesInfo = {};
            combo.forEach((c, idx) => {
                attributesInfo[selectedData[idx].name] = c.value;
            });

            // Check if exists
            if (!existingVariantNames.includes(name)) {
                newVariants.push({
                    name: name,
                    attributes: attributesInfo,
                    valueIds: combo.map((c, idx) => ({ id: c.id, attribute: selectedData[idx].name }))
                });
            }
        });

        if (newVariants.length === 0) {
            alert("All selected combinations already exist.");
            return;
        }

        if (!confirm(`Generate ${newVariants.length} new variants?`)) return;

        // 4. Submit
        try {
            const response = await fetch(`/admin/products/${state.productId}/variants/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken(),
                    'CSRF-Token': getCsrfToken() // Try both standard headers
                },
                body: JSON.stringify({
                    variants: newVariants,
                    _csrf: getCsrfToken() // Add to body as fallback
                })
            });
            const res = await response.json();
            if (res.success) {
                window.location.reload();
            } else {
                alert(res.error || "Failed");
            }
        } catch (e) {
            console.error(e);
            alert("Error generating variants");
        }
    }

    // Utility: Cartesian Product
    function cartesianProduct(arrays) {
        return arrays.reduce((acc, curr) => {
            return acc.flatMap(x => curr.map(y => [...x, y]));
        }, [[]]);
    }

    function getProductIdFromUrl() {
        const match = window.location.pathname.match(/\/products\/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    function updateVariantPreview() {
        // Calculate potential new combinations
        // This requires running the cartesian logic basically every time...
        // For now, let's keep it simple: just show text "Ready to generate"
        const previewText = document.getElementById('variantPreviewText');
        if (previewText) {
            // Count selected
            let total = 1;
            let active = 0;
            state.selectedValues.forEach(s => {
                if (s.size > 0) { total *= s.size; active++; }
            });
            if (active === 0) total = 0;
            previewText.textContent = `Current selection yields ${total} potential combinations.`;
            document.getElementById('variantPreview').style.display = total > 0 ? 'block' : 'none';
        }
    }

})();

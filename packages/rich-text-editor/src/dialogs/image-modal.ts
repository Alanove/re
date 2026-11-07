// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/image-modal.ts
 */
import { RichTextEditorCore } from '../core';
import { RTE_Z_MODAL } from '../z-index';

Object.assign(
  RichTextEditorCore.prototype,
  {

        showImageModal() {
            // Save cursor position BEFORE opening modal
            const selection = window.getSelection();
            let savedRange = null;
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
                console.log('Saved cursor position before modal');
            }
    
            // Create custom modal with two-panel layout
            const modal = this.createImageModal(savedRange);
        },

        showImageEditModal(imageElement) {
            // Create custom modal with two-panel layout in edit mode
            const modal = this.createImageModal(null, true, imageElement);
        },

        getBootstrapImageClassOptions() {
            return [
                { value: '', label: 'Original (no styling)' },
                { value: 'rte-img-fluid', label: 'Fit to width (shrinks on small screens)' },
                { value: 'rte-img-framed', label: 'Framed (thin border with padding)' },
                { value: 'rte-img-rounded', label: 'Rounded corners' },
                {
                    value: 'rte-img-circle',
                    label: 'Circle (use a square image)',
                    hint: 'Works best with a square image; other shapes become an oval.',
                },
                { value: 'rte-img-fluid rte-img-rounded', label: 'Fit to width with rounded corners' },
                { value: 'rte-img-center', label: 'Centered' },
                { value: 'rte-img-fluid rte-img-center', label: 'Fit to width and centered' },
            ];
        }
    
        /**
         * Split existing className into a matching preset select value and optional extra classes.
         */,

        resolveImageClassForModal(existingClass) {
            const existing = (existingClass || '').trim();
            if (!existing) return { select: '', extra: '' };
            const presets = this.getBootstrapImageClassOptions().filter((o) => o.value);
            presets.sort(
                (a, b) => b.value.split(/\s+/).filter(Boolean).length - a.value.split(/\s+/).filter(Boolean).length
            );
            const tokens = existing.split(/\s+/).filter(Boolean);
            for (const opt of presets) {
                const pt = opt.value.split(/\s+/).filter(Boolean);
                if (pt.length && pt.every((p) => tokens.includes(p))) {
                    const remaining = tokens.filter((t) => !pt.includes(t));
                    return { select: opt.value, extra: remaining.join(' ') };
                }
            }
            return { select: '', extra: existing };
        },

        composeImageModalClassName(modal) {
            const sel = modal.querySelector('#imageClass');
            const extra = modal.querySelector('#imageClassExtra');
            const parts = [];
            if (sel && sel.value.trim()) parts.push(sel.value.trim());
            if (extra && extra.value.trim()) parts.push(extra.value.trim());
            return parts.join(' ').trim();
        },

        createImageModal(savedRange, editMode = false, existingImage = null) {
            // Remove existing modal if any
            const existingModal = document.querySelector('.rte-modal');
            if (existingModal) {
                existingModal.remove();
            }
    
            const modal = document.createElement('div');
            modal.className = 'rte-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: ${RTE_Z_MODAL};
            `;
    
            const modalContent = document.createElement('div');
            modalContent.className = 'rte-modal-dialog';
            modalContent.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 8px;
                min-width: 800px;
                max-width: 1200px;
                width: 90%;
                max-height: 90vh;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-sizing: border-box;
            `;

            const modalBody = document.createElement('div');
            modalBody.className = 'rte-modal-body';
            modalBody.style.cssText = `
                display: flex;
                gap: 24px;
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
            `;
    
            // Left Panel - Form and Upload
            const leftPanel = document.createElement('div');
            leftPanel.style.cssText = `
                flex: 1;
                min-width: 300px;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                min-height: 0;
            `;
    
            // Title
            const modalTitle = document.createElement('h3');
            modalTitle.textContent = editMode ? 'Edit Image' : 'Insert Image';
            modalTitle.style.cssText = `
                margin: 0 0 20px 0;
                color: #333;
                font-size: 18px;
            `;
            leftPanel.appendChild(modalTitle);
    
            // Form Fields (URL + Alt)
            const formFields = [
                { label: 'Image URL:', type: 'text', id: 'imageUrl', placeholder: 'https://example.com/image.jpg' },
                { label: 'Alt Text:', type: 'text', id: 'imageAlt', placeholder: 'Image description' },
            ];
    
            formFields.forEach((field) => {
                const fieldContainer = document.createElement('div');
                fieldContainer.style.cssText = 'margin-bottom: 16px;';
    
                const label = document.createElement('label');
                label.textContent = field.label;
                label.style.cssText = `
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #555;
                `;
                fieldContainer.appendChild(label);
    
                const input = document.createElement('input');
                input.type = field.type;
                input.id = field.id;
                input.placeholder = field.placeholder;
                input.style.cssText = `
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                `;
                fieldContainer.appendChild(input);
    
                leftPanel.appendChild(fieldContainer);
            });
    
            // Image style preset (dropdown)
            const classRow = document.createElement('div');
            classRow.style.cssText = 'margin-bottom: 16px;';
            const classLabel = document.createElement('label');
            classLabel.textContent = 'Image style';
            classLabel.setAttribute('for', 'imageClass');
            classLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            classRow.appendChild(classLabel);
            const classSelect = document.createElement('select');
            classSelect.id = 'imageClass';
            classSelect.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
                background: white;
            `;
            const classOptions = this.getBootstrapImageClassOptions();
            classOptions.forEach((opt) => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                classSelect.appendChild(o);
            });
            classRow.appendChild(classSelect);
            const classHint = document.createElement('div');
            classHint.className = 'rte-field-hint';
            classHint.id = 'imageClassHint';
            classHint.hidden = true;
            classRow.appendChild(classHint);
            const updateClassHint = () => {
                const opt = classOptions.find((o) => o.value === classSelect.value);
                classHint.textContent = (opt && opt.hint) || '';
                classHint.hidden = !classHint.textContent;
            };
            classSelect.addEventListener('change', updateClassHint);
            leftPanel.appendChild(classRow);
    
            const classExtraRow = document.createElement('details');
            classExtraRow.className = 'rte-advanced';
            classExtraRow.id = 'imageClassAdvanced';
            classExtraRow.style.cssText = 'margin-bottom: 16px;';
            const classExtraSummary = document.createElement('summary');
            classExtraSummary.textContent = 'Advanced';
            classExtraRow.appendChild(classExtraSummary);
            const classExtraLabel = document.createElement('label');
            classExtraLabel.textContent = 'Extra CSS classes';
            classExtraLabel.setAttribute('for', 'imageClassExtra');
            classExtraRow.appendChild(classExtraLabel);
            const classExtraInput = document.createElement('input');
            classExtraInput.type = 'text';
            classExtraInput.id = 'imageClassExtra';
            classExtraInput.placeholder = 'e.g. my-custom-class shadow';
            classExtraInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            `;
            classExtraRow.appendChild(classExtraInput);
    
            // Align dropdown field
            const alignContainer = document.createElement('div');
            alignContainer.style.cssText = 'margin-bottom: 16px;';
    
            const alignLabel = document.createElement('label');
            alignLabel.textContent = 'Align:';
            alignLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            alignContainer.appendChild(alignLabel);
    
            const alignSelect = document.createElement('select');
            alignSelect.id = 'imageAlign';
            alignSelect.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
                background: white;
            `;
    
            const alignOptions = [
                { value: '', text: 'Default' },
                { value: 'left', text: 'Left' },
                { value: 'center', text: 'Center' },
                { value: 'right', text: 'Right' }
            ];
    
            alignOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                alignSelect.appendChild(optionElement);
            });
    
            alignContainer.appendChild(alignSelect);
            leftPanel.appendChild(alignContainer);
    
            // Width and Height on same row
            const dimensionsContainer = document.createElement('div');
            dimensionsContainer.style.cssText = `
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
            `;
    
            const widthContainer = document.createElement('div');
            widthContainer.style.cssText = 'flex: 1;';
            const widthLabel = document.createElement('label');
            widthLabel.textContent = 'Width:';
            widthLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            const widthInput = document.createElement('input');
            widthInput.type = 'number';
            widthInput.id = 'imageWidth';
            widthInput.placeholder = 'Auto';
            widthInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            `;
            widthContainer.appendChild(widthLabel);
            widthContainer.appendChild(widthInput);
    
            const heightContainer = document.createElement('div');
            heightContainer.style.cssText = 'flex: 1;';
            const heightLabel = document.createElement('label');
            heightLabel.textContent = 'Height:';
            heightLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            const heightInput = document.createElement('input');
            heightInput.type = 'number';
            heightInput.id = 'imageHeight';
            heightInput.placeholder = 'Auto';
            heightInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            `;
            heightContainer.appendChild(heightLabel);
            heightContainer.appendChild(heightInput);
    
            dimensionsContainer.appendChild(widthContainer);
            dimensionsContainer.appendChild(heightContainer);
            leftPanel.appendChild(dimensionsContainer);
            leftPanel.appendChild(classExtraRow);
    
            // Prefill form if editing - will be done after modal is added to DOM
            if (editMode && existingImage) {
                modal.dataset.editMode = 'true';
                modal.dataset.existingImageSrc = existingImage.src || '';
                modal.dataset.existingImageAlt = existingImage.alt || '';
                modal.dataset.existingImageClass = existingImage.className || '';
                modal.dataset.existingImageWidth = existingImage.width || '';
                modal.dataset.existingImageHeight = existingImage.height || '';
    
                // Extract align from style
                let align = '';
                if (existingImage.style && existingImage.style.textAlign) {
                    align = existingImage.style.textAlign;
                } else if (existingImage.style && existingImage.style.float) {
                    align = existingImage.style.float;
                }
                modal.dataset.existingImageAlign = align || '';
            }
    
            // Upload Section
            const uploadSection = document.createElement('div');
            uploadSection.className = 'upload-section';
            uploadSection.style.cssText = `
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #dee2e6;
            `;
    
            const uploadText = document.createElement('p');
            uploadText.textContent = 'Or upload an image:';
            uploadText.className = 'upload-text';
            uploadText.style.cssText = `
                margin: 0 0 8px 0;
                font-size: 14px;
                font-weight: 600;
                color: #333;
            `;
    
            const uploadButton = document.createElement('button');
            uploadButton.textContent = 'Choose File';
            uploadButton.type = 'button';
            uploadButton.className = 'upload-button';
            uploadButton.style.cssText = `
                padding: 8px 16px;
                border: 1px solid var(--rte-accent);
                background: var(--rte-accent);
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
    
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
    
            uploadButton.addEventListener('click', () => {
                console.log('Upload button clicked');
                fileInput.click();
            });
    
            fileInput.addEventListener('change', () => {
                const file = fileInput.files[0];
                console.log('File selected:', file);
                if (file) {
                    console.log('File details:', {
                        name: file.name,
                        size: file.size,
                        type: file.type
                    });
                    console.log('Starting upload process...');
                    this.uploadImage(file, modal, savedRange, editMode, existingImage);
                } else {
                    console.log('No file selected');
                }
            });
    
            uploadSection.appendChild(uploadText);
            uploadSection.appendChild(uploadButton);
            uploadSection.appendChild(fileInput);

            const uploadStatus = document.createElement('div');
            uploadStatus.className = 'upload-status';
            uploadStatus.style.cssText = `
                margin-top: 8px;
                font-size: 13px;
                display: none;
            `;
            uploadSection.appendChild(uploadStatus);

            leftPanel.appendChild(uploadSection);
    
            // Footer buttons (full modal width — stays inside white dialog)
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'rte-modal-footer';
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                flex-shrink: 0;
                padding-top: 16px;
                margin-top: 8px;
                border-top: 1px solid #dee2e6;
            `;
    
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'modal-cancel';
            cancelBtn.style.cssText = `
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
            cancelBtn.addEventListener('click', () => this.closeModal(modal));
    
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = editMode ? 'Update' : 'Insert';
            confirmBtn.className = 'modal-confirm';
            confirmBtn.style.cssText = `
                padding: 8px 16px;
                border: 1px solid var(--rte-accent);
                background: var(--rte-accent);
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
    
            confirmBtn.addEventListener('click', () => {
                const url = modal.querySelector('#imageUrl').value.trim();
                const alt = modal.querySelector('#imageAlt').value.trim();
                const className = this.composeImageModalClassName(modal);
                const width = modal.querySelector('#imageWidth').value.trim();
                const height = modal.querySelector('#imageHeight').value.trim();
                const align = modal.querySelector('#imageAlign').value.trim();
    
                if (url) {
                    if (editMode && existingImage) {
                        this.updateImageInEditor(existingImage, url, alt, className, width, height, align);
                    } else {
                        this.insertImageFromModal(url, alt, className, width, height, align, savedRange);
                    }
                }
                this.closeModal(modal);
            });
    
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
    
            // Right Panel - Image List
            const rightPanel = document.createElement('div');
            rightPanel.style.cssText = `
                flex: 1;
                min-width: 400px;
                display: flex;
                flex-direction: column;
                border-left: 1px solid #dee2e6;
                padding-left: 24px;
                min-height: 0;
                overflow: hidden;
            `;
    
            // Image list header
            const imageListHeader = document.createElement('div');
            imageListHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            `;
    
            const imageListTitle = document.createElement('h4');
            imageListTitle.textContent = 'Select from existing images:';
            imageListTitle.style.cssText = `
                margin: 0;
                color: #333;
                font-size: 16px;
            `;
    
            const toggleButtons = document.createElement('div');
            toggleButtons.style.cssText = `
                display: flex;
                gap: 8px;
            `;
    
            const pageImagesBtn = document.createElement('button');
            pageImagesBtn.textContent = 'Page Images';
            pageImagesBtn.type = 'button';
            pageImagesBtn.className = 'toggle-btn rte-image-source-toggle active';
            pageImagesBtn.style.cssText = `
                padding: 6px 12px;
                border: 1px solid var(--rte-accent);
                background: var(--rte-accent);
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
    
            const publicImagesBtn = document.createElement('button');
            publicImagesBtn.textContent = 'Public Images';
            publicImagesBtn.type = 'button';
            publicImagesBtn.className = 'toggle-btn rte-image-source-toggle';
            publicImagesBtn.style.cssText = `
                padding: 6px 12px;
                border: 1px solid #ddd;
                background: white;
                color: #333;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
    
            pageImagesBtn.addEventListener('click', () => {
                this.switchImageSourceInModal('page', imagesContainer, pageImagesBtn, publicImagesBtn);
            });
    
            publicImagesBtn.addEventListener('click', () => {
                this.switchImageSourceInModal('public', imagesContainer, pageImagesBtn, publicImagesBtn);
            });
    
            toggleButtons.appendChild(pageImagesBtn);
            toggleButtons.appendChild(publicImagesBtn);
            imageListHeader.appendChild(imageListTitle);
            imageListHeader.appendChild(toggleButtons);
            rightPanel.appendChild(imageListHeader);
    
            // Images container
            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'rte-image-modal-grid';
            imagesContainer.style.cssText = `
                flex: 1;
                overflow-y: auto;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 12px;
                padding: 8px 0;
                align-content: start;
            `;
    
            rightPanel.appendChild(imagesContainer);
    
            // Load initial images
            this.loadImagesInModal(imagesContainer, 'page');
    
            modalBody.appendChild(leftPanel);
            modalBody.appendChild(rightPanel);
            modalContent.appendChild(modalBody);
            modalContent.appendChild(buttonContainer);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
    
            // Prefill form if editing (after modal is added to DOM)
            if (modal.dataset.editMode === 'true') {
                const urlInput = modal.querySelector('#imageUrl');
                const altInput = modal.querySelector('#imageAlt');
                const classSelectEl = modal.querySelector('#imageClass');
                const classExtraInput = modal.querySelector('#imageClassExtra');
                const widthInput = modal.querySelector('#imageWidth');
                const heightInput = modal.querySelector('#imageHeight');
                const alignSelect = modal.querySelector('#imageAlign');
    
                if (urlInput) urlInput.value = modal.dataset.existingImageSrc || '';
                if (altInput) altInput.value = modal.dataset.existingImageAlt || '';
                const resolved = this.resolveImageClassForModal(modal.dataset.existingImageClass || '');
                if (classSelectEl) {
                    classSelectEl.value = resolved.select;
                    classSelectEl.dispatchEvent(new Event('change'));
                }
                if (classExtraInput) classExtraInput.value = resolved.extra;
                const classAdvanced = modal.querySelector('#imageClassAdvanced');
                if (classAdvanced && resolved.extra) classAdvanced.open = true;
                if (widthInput) widthInput.value = modal.dataset.existingImageWidth || '';
                if (heightInput) heightInput.value = modal.dataset.existingImageHeight || '';
                if (alignSelect) alignSelect.value = modal.dataset.existingImageAlign || '';
            }
    
            // Add escape key handler
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal(modal);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
    
            return modal;
        },

        switchImageSourceInModal(source, imagesContainer, pageImagesBtn, publicImagesBtn) {
            if (source === 'page') {
                pageImagesBtn.className = 'toggle-btn rte-image-source-toggle active';
                pageImagesBtn.style.cssText = `
                    padding: 6px 12px;
                    border: 1px solid var(--rte-accent);
                    background: var(--rte-accent);
                    color: white;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                `;
                publicImagesBtn.className = 'toggle-btn rte-image-source-toggle';
                publicImagesBtn.style.cssText = `
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    color: #333;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                `;
            } else {
                publicImagesBtn.className = 'toggle-btn rte-image-source-toggle active';
                publicImagesBtn.style.cssText = `
                    padding: 6px 12px;
                    border: 1px solid var(--rte-accent);
                    background: var(--rte-accent);
                    color: white;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                `;
                pageImagesBtn.className = 'toggle-btn rte-image-source-toggle';
                pageImagesBtn.style.cssText = `
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    color: #333;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                `;
            }
    
            this.loadImagesInModal(imagesContainer, source);
        },

        loadImagesInModal(imagesContainer, source) {
            this.showLoadingInModal(imagesContainer);
            this.fileManagerList(source === 'public' ? 'public' : 'page')
                .then((files) => {
                    this.displayImagesInModal(imagesContainer, files || [], source || 'page');
                })
                .catch((error) => {
                    console.error('Error loading images in modal:', error);
                    this.showErrorInModal(imagesContainer, 'Failed to load images');
                });
        },

        displayImagesInModal(imagesContainer, images, source) {
            imagesContainer.innerHTML = '';
    
            if (images.length === 0) {
                const noImages = document.createElement('div');
                noImages.textContent = `No ${source} images found`;
                noImages.style.cssText = `
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                    padding: 20px;
                    grid-column: 1 / -1;
                `;
                imagesContainer.appendChild(noImages);
                return;
            }
    
            images.forEach(image => {
                const imageCard = this.createImageCardInModal(image, source);
                imagesContainer.appendChild(imageCard);
            });
        },

        createImageCardInModal(image, source) {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.style.cssText = `
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                flex-direction: column;
            `;
    
            const img = document.createElement('img');
            img.src = image.url;
            img.alt = image.name || 'Image';
            img.style.cssText = `
                width: 100%;
                height: 80px;
                object-fit: cover;
                border-radius: 3px;
                margin-bottom: 8px;
            `;
    
            const imageName = document.createElement('div');
            imageName.textContent = image.name || 'Unnamed Image';
            imageName.style.cssText = `
                font-size: 11px;
                color: #333;
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
    
            const imageSize = document.createElement('div');
            imageSize.textContent = this.formatFileSize(image.size || 0);
            imageSize.style.cssText = `
                font-size: 9px;
                color: #666;
            `;
    
            // Add hover effect (only if not selected)
            card.addEventListener('mouseenter', () => {
                if (card.style.borderWidth !== '2px') {
                    card.style.borderColor = 'var(--rte-accent)';
                    card.style.boxShadow = '0 2px 8px color-mix(in srgb, var(--rte-accent) 20%, transparent)';
                }
            });
    
            card.addEventListener('mouseleave', () => {
                if (card.style.borderWidth !== '2px') {
                    card.style.borderColor = '#dee2e6';
                    card.style.boxShadow = 'none';
                }
            });
    
            // Add click to populate URL field and show selection
            card.addEventListener('click', () => {
                const modal = document.querySelector('.rte-modal');
                if (modal) {
                    // Remove selection from all cards
                    const allCards = modal.querySelectorAll('.image-card');
                    allCards.forEach(c => {
                        c.style.border = '1px solid #dee2e6';
                        c.style.boxShadow = 'none';
                    });
    
                    // Add selection to clicked card
                    card.style.border = '2px solid var(--rte-accent)';
                    card.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--rte-accent) 30%, transparent)';
    
                    const urlInput = modal.querySelector('#imageUrl');
                    if (urlInput) {
                        urlInput.value = image.url;
                    }
                }
            });
    
            card.appendChild(img);
            card.appendChild(imageName);
            card.appendChild(imageSize);
    
            return card;
        },
  } as any
);

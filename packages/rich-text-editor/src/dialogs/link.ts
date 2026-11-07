// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/link.ts
 */
import { RichTextEditorCore } from '../core';
import { sanitizeUrl } from '../url-sanitize';
import { RTE_Z_MODAL } from '../z-index';

Object.assign(
  RichTextEditorCore.prototype,
  {

        showLinkModal() {
            // Save cursor position and selected text BEFORE opening modal
            const selection = window.getSelection();
            let savedRange = null;
            let selectedText = '';
            let existingLinkUrl = '';
            let existingLinkText = '';
            let existingOpenInNewTab = true;
    
            if (this.currentMode === 'rich' && selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
                selectedText = selection.toString().trim();
    
                // Check if selection is inside or is a link element
                const range = selection.getRangeAt(0);
                let linkElement = null;
    
                // Check if the common ancestor is a link
                const commonAncestor = range.commonAncestorContainer;
                if (commonAncestor.nodeType === Node.ELEMENT_NODE && commonAncestor.tagName === 'A') {
                    linkElement = commonAncestor;
                } else if (commonAncestor.nodeType === Node.TEXT_NODE) {
                    // Check parent elements
                    let parent = commonAncestor.parentElement;
                    while (parent && parent !== this.richTextEditor) {
                        if (parent.tagName === 'A') {
                            linkElement = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
    
                // If we found a link, extract its href, text, and target
                if (linkElement) {
                    existingLinkUrl = linkElement.href || linkElement.getAttribute('href') || '';
                    existingLinkText = linkElement.textContent || linkElement.innerText || '';
                    existingOpenInNewTab = (linkElement.getAttribute('target') || '').toLowerCase() === '_blank';
                    console.log('Found existing link:', existingLinkUrl, existingLinkText);
                }
    
                console.log('Saved cursor position before link modal, selected text:', selectedText);
            }
    
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
            modalContent.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 8px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;
    
            // Title
            const modalTitle = document.createElement('h3');
            modalTitle.textContent = 'Insert Link';
            modalTitle.style.cssText = `
                margin: 0 0 20px 0;
                color: #333;
                font-size: 18px;
            `;
            modalContent.appendChild(modalTitle);
    
            // Error message container
            const errorDiv = document.createElement('div');
            errorDiv.id = 'linkError';
            errorDiv.style.cssText = `
                display: none;
                padding: 12px;
                margin-bottom: 16px;
                background: #fee;
                border: 1px solid #fcc;
                border-radius: 4px;
                color: #c33;
                font-size: 14px;
            `;
            modalContent.appendChild(errorDiv);
    
            // Tabs for URL and File Upload
            const tabsContainer = document.createElement('div');
            tabsContainer.style.cssText = `
                display: flex;
                border-bottom: 2px solid #dee2e6;
                margin-bottom: 20px;
            `;
    
            const urlTab = document.createElement('button');
            urlTab.textContent = 'Enter URL';
            urlTab.type = 'button';
            urlTab.className = 'link-tab active';
            urlTab.style.cssText = `
                flex: 1;
                padding: 10px;
                border: none;
                background: transparent;
                border-bottom: 2px solid var(--rte-accent);
                color: var(--rte-accent);
                font-weight: 500;
                cursor: pointer;
                font-size: 14px;
            `;
    
            const fileTab = document.createElement('button');
            fileTab.textContent = 'Upload File';
            fileTab.type = 'button';
            fileTab.className = 'link-tab';
            fileTab.style.cssText = `
                flex: 1;
                padding: 10px;
                border: none;
                background: transparent;
                border-bottom: 2px solid transparent;
                color: #6c757d;
                font-weight: 500;
                cursor: pointer;
                font-size: 14px;
            `;
    
            tabsContainer.appendChild(urlTab);
            tabsContainer.appendChild(fileTab);
            modalContent.appendChild(tabsContainer);
    
            // URL Input Section
            const urlSection = document.createElement('div');
            urlSection.id = 'urlSection';
            urlSection.style.cssText = 'display: block;';
    
            const urlLabel = document.createElement('label');
            urlLabel.textContent = 'URL:';
            urlLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            urlSection.appendChild(urlLabel);
    
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.id = 'linkUrl';
            urlInput.placeholder = 'https://example.com';
            urlInput.value = existingLinkUrl; // Pre-fill with existing link URL if available
            urlInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
                margin-bottom: 16px;
            `;
            urlSection.appendChild(urlInput);
    
            modalContent.appendChild(urlSection);
    
            // File Upload Section
            const fileSection = document.createElement('div');
            fileSection.id = 'fileSection';
            fileSection.style.cssText = 'display: none;';
    
            const fileLabel = document.createElement('label');
            fileLabel.textContent = 'File:';
            fileLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            fileSection.appendChild(fileLabel);
    
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'linkFile';
            fileInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
                margin-bottom: 16px;
            `;
            fileSection.appendChild(fileInput);
    
            const fileInfo = document.createElement('div');
            fileInfo.id = 'fileInfo';
            fileInfo.style.cssText = `
                padding: 8px;
                background: #f8f9fa;
                border-radius: 4px;
                font-size: 13px;
                color: #6c757d;
                margin-bottom: 16px;
                display: none;
            `;
            fileSection.appendChild(fileInfo);
    
            const uploadStatus = document.createElement('div');
            uploadStatus.id = 'uploadStatus';
            uploadStatus.style.cssText = `
                padding: 8px;
                border-radius: 4px;
                font-size: 13px;
                margin-bottom: 16px;
                display: none;
            `;
            fileSection.appendChild(uploadStatus);
    
            modalContent.appendChild(fileSection);
    
            // Link Text Input (common for both)
            const textLabel = document.createElement('label');
            textLabel.textContent = 'Text:';
            textLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            modalContent.appendChild(textLabel);
    
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.id = 'linkText';
            textInput.placeholder = 'Link text (optional)';
            textInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
                margin-bottom: 20px;
            `;
            // Pre-fill text: use existing link text if available, otherwise use selected text
            if (existingLinkText) {
                textInput.value = existingLinkText;
            } else if (selectedText) {
                textInput.value = selectedText;
            }
            modalContent.appendChild(textInput);

            const openInNewTabLabel = document.createElement('label');
            openInNewTabLabel.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 0 0 20px 0;
                font-size: 14px;
                color: #555;
                cursor: pointer;
                user-select: none;
            `;
            const openInNewTabCheck = document.createElement('input');
            openInNewTabCheck.type = 'checkbox';
            openInNewTabCheck.id = 'linkOpenInNewTab';
            openInNewTabCheck.checked = existingOpenInNewTab;
            const openInNewTabText = document.createElement('span');
            openInNewTabText.textContent = 'Open in new tab';
            openInNewTabLabel.appendChild(openInNewTabCheck);
            openInNewTabLabel.appendChild(openInNewTabText);
            modalContent.appendChild(openInNewTabLabel);
    
            // Buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: flex-end;
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
            confirmBtn.textContent = 'Insert';
            confirmBtn.className = 'modal-confirm';
            confirmBtn.style.cssText = `
                padding: 8px 16px;
                border: none;
                background: var(--rte-accent);
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
    
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
            modalContent.appendChild(buttonContainer);
    
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
    
            // Store saved range for use in insert handler
            modal.savedRange = savedRange;
            modal.selectedText = selectedText;
            modal.uploadedFilePath = null;
            modal.existingLinkUrl = existingLinkUrl;
            modal.existingLinkElement = null; // Will be set if we need to update an existing link
    
            // Tab switching
            urlTab.addEventListener('click', () => {
                urlTab.classList.add('active');
                urlTab.style.borderBottomColor = 'var(--rte-accent)';
                urlTab.style.color = 'var(--rte-accent)';
                fileTab.classList.remove('active');
                fileTab.style.borderBottomColor = 'transparent';
                fileTab.style.color = '#6c757d';
                urlSection.style.display = 'block';
                fileSection.style.display = 'none';
                urlInput.focus();
            });
    
            fileTab.addEventListener('click', () => {
                fileTab.classList.add('active');
                fileTab.style.borderBottomColor = 'var(--rte-accent)';
                fileTab.style.color = 'var(--rte-accent)';
                urlTab.classList.remove('active');
                urlTab.style.borderBottomColor = 'transparent';
                urlTab.style.color = '#6c757d';
                urlSection.style.display = 'none';
                fileSection.style.display = 'block';
            });
    
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
    
                uploadStatus.style.display = 'block';
                uploadStatus.textContent = 'Uploading...';
                uploadStatus.style.background = '#fff3cd';
                uploadStatus.style.color = '#856404';
                uploadStatus.style.border = '1px solid #ffeaa7';
                errorDiv.style.display = 'none';
    
                try {
                    const mapped = await this.fileManagerUpload(file, 'document');
                    modal.uploadedFilePath = mapped.url;
                    fileInfo.textContent = 'File: ' + (mapped.name || file.name);
                    fileInfo.style.display = 'block';
                    uploadStatus.textContent = 'Upload successful!';
                    uploadStatus.style.background = '#d4edda';
                    uploadStatus.style.color = '#155724';
                    uploadStatus.style.border = '1px solid #c3e6cb';
                } catch (error) {
                    console.error('Error uploading file:', error);
                    errorDiv.textContent = error.message || 'Error uploading file. Please try again.';
                    errorDiv.style.display = 'block';
                    uploadStatus.style.display = 'none';
                }
            });
    
            // Insert link handler
            confirmBtn.addEventListener('click', () => {
                let url = '';
                const isUrlTab = urlSection.style.display !== 'none';
    
                if (isUrlTab) {
                    url = urlInput.value.trim();
                    if (!url) {
                        errorDiv.textContent = 'Please enter a URL';
                        errorDiv.style.display = 'block';
                        urlInput.focus();
                        return;
                    }
                } else {
                    if (!modal.uploadedFilePath) {
                        errorDiv.textContent = 'Please upload a file first';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    url = modal.uploadedFilePath;
                }

                const safeUrl = sanitizeUrl(url, 'href');
                if (!safeUrl) {
                    errorDiv.textContent = 'Invalid URL. javascript: and data: links are not allowed.';
                    errorDiv.style.display = 'block';
                    if (isUrlTab) {
                        urlInput.focus();
                    }
                    return;
                }
                url = safeUrl;
    
                const text = textInput.value.trim();
    
                // Hide previous errors
                errorDiv.style.display = 'none';
    
                // Ensure we're in rich text mode
                if (this.currentMode !== 'rich') {
                    this.setMode('rich');
                }
    
                // Restore selection if we have a saved range
                let range = null;
                const selection = window.getSelection();
    
                if (savedRange) {
                    try {
                        selection.removeAllRanges();
                        // Clone the saved range to avoid issues
                        const clonedRange = savedRange.cloneRange();
                        selection.addRange(clonedRange);
                        range = clonedRange;
                    } catch (e) {
                        console.warn('Could not restore selection:', e);
                        // If we can't restore, try to get current selection
                        if (selection.rangeCount === 0) {
                            // Place cursor at end of editor
                            range = document.createRange();
                            range.selectNodeContents(this.richTextEditor);
                            range.collapse(false);
                            selection.addRange(range);
                        } else {
                            range = selection.getRangeAt(0);
                        }
                    }
                } else {
                    // No saved range, try to get current selection
                    if (selection.rangeCount === 0) {
                        // Place cursor at end of editor
                        range = document.createRange();
                        range.selectNodeContents(this.richTextEditor);
                        range.collapse(false);
                        selection.addRange(range);
                    } else {
                        range = selection.getRangeAt(0);
                    }
                }
    
                if (!range) {
                    errorDiv.textContent = 'Please select text or position cursor where you want to insert the link';
                    errorDiv.style.display = 'block';
                    return;
                }
    
                // Check if we're updating an existing link
                const commonAncestor = range.commonAncestorContainer;
                let existingLinkElement = null;
    
                if (commonAncestor.nodeType === Node.ELEMENT_NODE && commonAncestor.tagName === 'A') {
                    existingLinkElement = commonAncestor;
                } else if (commonAncestor.nodeType === Node.TEXT_NODE) {
                    let parent = commonAncestor.parentElement;
                    while (parent && parent !== this.richTextEditor) {
                        if (parent.tagName === 'A') {
                            existingLinkElement = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
    
                const openInNewTab = !!openInNewTabCheck.checked;
                const applyTarget = (anchor) => {
                    if (openInNewTab) {
                        anchor.setAttribute('target', '_blank');
                        anchor.setAttribute('rel', 'noopener noreferrer');
                    } else {
                        anchor.removeAttribute('target');
                        anchor.removeAttribute('rel');
                    }
                };

                // If we found an existing link, update it
                if (existingLinkElement) {
                    existingLinkElement.href = url;
                    if (text) {
                        existingLinkElement.textContent = text;
                    }
                    applyTarget(existingLinkElement);
    
                    // Move cursor after the link
                    selection.removeAllRanges();
                    const newRange = document.createRange();
                    newRange.setStartAfter(existingLinkElement);
                    newRange.collapse(true);
                    selection.addRange(newRange);
                } else {
                    // Create a new link
                    const currentSelectedText = range.toString().trim();
    
                    // Determine what text to use for the link
                    let linkText = text || currentSelectedText || url;
    
                    // Create the link element
                    const linkElement = document.createElement('a');
                    linkElement.href = url;
                    applyTarget(linkElement);
    
                    // If there's selected text in the editor, wrap it in the link
                    if (currentSelectedText && !text) {
                        // User wants to use the selected text as link text
                        // Extract the selected content and wrap it
                        const contents = range.extractContents();
    
                        // Check if contents is just text or contains elements
                        if (contents.childNodes.length === 0 ||
                            (contents.childNodes.length === 1 && contents.childNodes[0].nodeType === Node.TEXT_NODE)) {
                            // Simple text selection - set as textContent
                            linkElement.textContent = currentSelectedText;
                        } else {
                            // Complex selection with formatting - preserve it
                            linkElement.appendChild(contents);
                        }
    
                        // Insert the link
                        range.insertNode(linkElement);
                    } else {
                        // No selected text or custom text provided
                        // Delete any selected content first
                        if (currentSelectedText) {
                            range.deleteContents();
                        }
    
                        // Set the link text
                        linkElement.textContent = linkText;
    
                        // Insert the link
                        range.insertNode(linkElement);
                    }
    
                    // Move cursor after the link
                    range.setStartAfter(linkElement);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
    
                // Update word count
                this.updateWordCount();
    
                this.closeModal(modal);
            });
    
            urlInput.focus();
        }
  } as any
);

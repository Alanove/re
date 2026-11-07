// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/video.ts
 */
import { RichTextEditorCore } from '../core';
import { sanitizeEditorHtml } from '../sanitize-editor-html';
import { buildVideoEmbed } from '../video-providers';
import { RTE_Z_MODAL } from '../z-index';

Object.assign(
  RichTextEditorCore.prototype,
  {

        buildClientVideoEmbed(url) {
            return buildVideoEmbed(url);
        },

        showVideoModal() {
            // Save cursor position BEFORE opening modal
            const selection = window.getSelection();
            let savedRange = null;
            if (this.currentMode === 'rich' && selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            } else if (this.currentMode === 'source' && this.sourceEditor) {
                // For source mode, we'll use the selectionStart/selectionEnd
                savedRange = {
                    start: this.sourceEditor.selectionStart,
                    end: this.sourceEditor.selectionEnd
                };
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
                min-width: 500px;
                max-width: 600px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;
    
            // Get translations from window.translations or use defaults
            const t = window.translations || {};
            const getText = (key, defaultValue) => t[key] || defaultValue;
    
            // Title
            const modalTitle = document.createElement('h3');
            modalTitle.textContent = getText('embedVideo', 'Embed Video');
            modalTitle.style.cssText = `
                margin: 0 0 20px 0;
                color: #333;
                font-size: 18px;
            `;
            modalContent.appendChild(modalTitle);
    
            // URL Input
            const urlContainer = document.createElement('div');
            urlContainer.style.cssText = 'margin-bottom: 16px;';
    
            const urlLabel = document.createElement('label');
            urlLabel.textContent = getText('videoUrl', 'Video URL:') + ':';
            urlLabel.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            urlContainer.appendChild(urlLabel);
    
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.id = 'videoUrl';
            urlInput.placeholder = getText('videoUrlPlaceholder', 'https://www.youtube.com/watch?v=... or https://vimeo.com/...');
            urlInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            `;
            urlContainer.appendChild(urlInput);
            modalContent.appendChild(urlContainer);
    
            // Loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'videoLoading';
            loadingDiv.style.cssText = `
                display: none;
                text-align: center;
                padding: 20px;
                color: #666;
            `;
            loadingDiv.innerHTML = '<i class="fa fa-spinner fa-spin"></i> ' + getText('loadingVideoInfo', 'Loading video information...');
            modalContent.appendChild(loadingDiv);
    
            // Error message
            const errorDiv = document.createElement('div');
            errorDiv.id = 'videoError';
            errorDiv.style.cssText = `
                display: none;
                padding: 12px;
                margin-bottom: 16px;
                background: #fee;
                border: 1px solid #fcc;
                border-radius: 4px;
                color: #c33;
            `;
            modalContent.appendChild(errorDiv);
    
            // Video Preview
            const previewContainer = document.createElement('div');
            previewContainer.id = 'videoPreview';
            previewContainer.style.cssText = `
                display: none;
                margin-bottom: 16px;
                padding: 16px;
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 4px;
            `;
    
            const previewTitle = document.createElement('div');
            previewTitle.id = 'videoPreviewTitle';
            previewTitle.style.cssText = `
                font-weight: 600;
                margin-bottom: 12px;
                color: #333;
            `;
            previewContainer.appendChild(previewTitle);
    
            const previewThumbnail = document.createElement('div');
            previewThumbnail.id = 'videoPreviewThumbnail';
            previewThumbnail.style.cssText = `
                text-align: center;
                margin-bottom: 12px;
            `;
            previewContainer.appendChild(previewThumbnail);
    
            const previewEmbed = document.createElement('div');
            previewEmbed.id = 'videoPreviewEmbed';
            previewEmbed.style.cssText = `
                display: none;
            `;
            previewContainer.appendChild(previewEmbed);
    
            modalContent.appendChild(previewContainer);
    
            // Buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            `;
    
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = getText('cancel', 'Cancel');
            cancelBtn.className = 'modal-cancel';
            cancelBtn.style.cssText = `
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
            cancelBtn.addEventListener('click', () => {
                this.closeModal(modal);
            });
            buttonContainer.appendChild(cancelBtn);
    
            const fetchBtn = document.createElement('button');
            fetchBtn.textContent = getText('fetchVideo', 'Fetch Video');
            fetchBtn.className = 'modal-fetch';
            fetchBtn.style.cssText = `
                padding: 8px 16px;
                border: none;
                background: var(--rte-accent);
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
            buttonContainer.appendChild(fetchBtn);
    
            const insertBtn = document.createElement('button');
            insertBtn.textContent = getText('insertVideo', 'Insert Video');
            insertBtn.className = 'modal-confirm';
            insertBtn.style.cssText = `
                padding: 8px 16px;
                border: none;
                background: #28a745;
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                display: none;
            `;
            buttonContainer.appendChild(insertBtn);
    
            modalContent.appendChild(buttonContainer);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
    
            // Focus on URL input
            urlInput.focus();
    
            // Store saved range for use in insert handler
            modal.savedRange = savedRange;
    
            // Fetch video data
            let videoData = null;
    
            const fetchVideoData = async () => {
                const url = urlInput.value.trim();
                if (!url) {
                    errorDiv.textContent = getText('videoError', 'Please enter a video URL');
                    errorDiv.style.display = 'block';
                    return;
                }
    
                errorDiv.style.display = 'none';
                previewContainer.style.display = 'none';
                loadingDiv.style.display = 'block';
                fetchBtn.disabled = true;
                fetchBtn.textContent = getText('fetchingVideo', 'Fetching...');
    
                try {
                    const data = this.buildClientVideoEmbed(url) || {
                        success: false,
                        message: 'Unsupported video URL. Use a YouTube or Vimeo link.'
                    };
    
                    if (data.success) {
                        videoData = data;
    
                        // Show preview
                        previewTitle.textContent = data.title || 'Video';
    
                        if (data.thumbnail) {
                            const img = document.createElement('img');
                            img.src = data.thumbnail;
                            img.style.cssText = 'max-width: 100%; height: auto; border-radius: 4px;';
                            previewThumbnail.innerHTML = '';
                            previewThumbnail.appendChild(img);
                        }
    
                        if (data.embed) {
                            previewEmbed.innerHTML = data.embed;
                            previewEmbed.style.display = 'block';
                        }
    
                        previewContainer.style.display = 'block';
                        insertBtn.style.display = 'block';
                    } else {
                        errorDiv.textContent = data.message || getText('videoFetchError', 'Failed to fetch video information');
                        errorDiv.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Error fetching video:', error);
                    errorDiv.textContent = getText('videoInfoError', 'Error fetching video information. Please try again.');
                    errorDiv.style.display = 'block';
                } finally {
                    loadingDiv.style.display = 'none';
                    fetchBtn.disabled = false;
                    fetchBtn.textContent = getText('fetchVideo', 'Fetch Video');
                }
            };
    
            fetchBtn.addEventListener('click', fetchVideoData);
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    fetchVideoData();
                }
            });
    
            insertBtn.addEventListener('click', () => {
                if (videoData && videoData.embed) {
                    // Get saved range from modal
                    const savedRange = modal.savedRange;
    
                    // Insert embed code into editor based on current mode
                    if (this.currentMode === 'source') {
                        // Insert into source editor
                        let cursorPos = this.sourceEditor.selectionStart;
                        if (savedRange && typeof savedRange === 'object' && savedRange.start !== undefined) {
                            cursorPos = savedRange.start;
                        }
    
                        const textBefore = this.sourceEditor.value.substring(0, cursorPos);
                        const textAfter = this.sourceEditor.value.substring(cursorPos);
                        this.sourceEditor.value = textBefore + videoData.embed + '\n' + textAfter;
    
                        // Update cursor position
                        const newPos = cursorPos + videoData.embed.length + 1;
                        this.sourceEditor.setSelectionRange(newPos, newPos);
                        this.sourceEditor.focus();
    
                        // Trigger input event to update content
                        this.sourceEditor.dispatchEvent(new Event('input'));
                    } else {
                        // Insert into rich text editor
                        // First, ensure editor has focus
                        this.richTextEditor.focus();
    
                        // Helper function to check if a range is still valid
                        const isRangeValid = (range) => {
                            if (!range) return false;
                            try {
                                // Try to access range properties to see if it's still valid
                                const container = range.commonAncestorContainer;
                                // Check if the container is still in the document
                                return document.contains(container) || this.richTextEditor.contains(container);
                            } catch (e) {
                                return false;
                            }
                        };
    
                        // Restore saved range if available and valid
                        let range = null;
                        if (savedRange && savedRange instanceof Range) {
                            try {
                                if (isRangeValid(savedRange)) {
                                    const selection = window.getSelection();
                                    selection.removeAllRanges();
                                    selection.addRange(savedRange);
                                    range = savedRange;
                                }
                            } catch (e) {
                                console.warn('Could not restore saved range:', e);
                            }
                        }
    
                        // If no valid range, try to get current selection
                        if (!range) {
                            try {
                                const selection = window.getSelection();
                                if (selection.rangeCount > 0) {
                                    const currentRange = selection.getRangeAt(0);
                                    // Check if current selection is within the editor
                                    const container = currentRange.commonAncestorContainer;
                                    if (this.richTextEditor.contains(container) || container === this.richTextEditor) {
                                        range = currentRange;
                                    }
                                }
                            } catch (e) {
                                console.warn('Could not get current selection:', e);
                            }
                        }
    
                        // If still no valid range, create a new range at the end of the editor
                        if (!range) {
                            try {
                                range = document.createRange();
                                // Try to find the last text node or element in the editor
                                const walker = document.createTreeWalker(
                                    this.richTextEditor,
                                    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                                    null
                                );
    
                                let lastNode = null;
                                let node = walker.nextNode();
                                while (node) {
                                    lastNode = node;
                                    node = walker.nextNode();
                                }
    
                                if (lastNode) {
                                    if (lastNode.nodeType === Node.TEXT_NODE) {
                                        range.setStartAfter(lastNode);
                                    } else {
                                        range.selectNodeContents(lastNode);
                                        range.collapse(false);
                                    }
                                } else {
                                    // Fallback: select all contents and collapse to end
                                    range.selectNodeContents(this.richTextEditor);
                                    range.collapse(false);
                                }
                            } catch (e) {
                                console.warn('Could not create range at end:', e);
                                // Last resort: create range at end of editor
                                range = document.createRange();
                                range.selectNodeContents(this.richTextEditor);
                                range.collapse(false);
                            }
                        }
    
                        // Delete any selected content
                        try {
                            range.deleteContents();
                        } catch (e) {
                            console.warn('Could not delete contents:', e);
                        }
    
                        // Create a temporary container to parse the HTML
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = videoData.embed;
    
                        // Insert all nodes from the embed code
                        const nodes = Array.from(tempDiv.childNodes);
                        let lastNode = null;
                        try {
                            nodes.forEach(node => {
                                const clonedNode = node.cloneNode(true);
                                range.insertNode(clonedNode);
                                lastNode = clonedNode;
                                // Update range to after the inserted node for next insertion
                                range.setStartAfter(clonedNode);
                                range.collapse(true);
                            });
                        } catch (e) {
                            console.error('Error inserting video nodes:', e);
                            // If insertion fails, try inserting as HTML at the end
                            const textarea = document.querySelector(`textarea[name="content"]`);
                            if (textarea) {
                                const currentContent = this.getHTML();
                                const combined = sanitizeEditorHtml(currentContent + '\n' + videoData.embed);
                                textarea.value = combined;
                                this.richTextEditor.innerHTML = combined;
                                this.sourceEditor.value = combined;
                            }
                        }
    
                        // Move cursor after inserted content
                        if (lastNode) {
                            try {
                                const newRange = document.createRange();
                                newRange.setStartAfter(lastNode);
                                newRange.collapse(true);
                                const selection = window.getSelection();
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                            } catch (e) {
                                console.warn('Could not set cursor after video:', e);
                            }
                        }
    
                        this.richTextEditor.focus();
    
                        // Trigger input event to update content
                        this.richTextEditor.dispatchEvent(new Event('input'));
                    }
    
                    // Update word count
                    this.updateWordCount();
    
                    const host = this.container;
                    if (host) {
                        host.dispatchEvent(new CustomEvent('rte:video-inserted', {
                            bubbles: true,
                            detail: {
                                title: videoData.title || '',
                                thumbnail: videoData.thumbnail || '',
                                description: videoData.description || '',
                            },
                        }));
                    }

                    this.closeModal(modal);
                }
            });
    
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        }
    
        /**
         * Build HTML string for a simple table with the given dimensions
         * @param {number} rows - Number of rows
         * @param {number} cols - Number of columns
         * @param {boolean} headerRow - Whether first row is a header row
         * @returns {string} - HTML string for the table
         */
  } as any
);

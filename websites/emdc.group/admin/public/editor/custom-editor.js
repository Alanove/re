/**
 * Custom Content Editor
 * A dual-mode editor that supports both rich text and raw HTML editing
 * without any sanitization restrictions
 */

class CustomEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = this.getDefaultOptions(options);
        this.currentMode = 'rich'; // 'rich' or 'source'
        this.richTextEditor = null;
        this.sourceEditor = null;
        this.toolbar = null;
        this.wordCountElement = null;
        this.content = '';
        this.activeStates = {}; // Track active states for buttons
        this.currentPageKey = null; // Current page key for image management
        this.imagePanel = null; // Image management panel
        this.init();
    }

    getDefaultOptions(customOptions) {
        const defaultOptions = {
            height: '600px',
            placeholder: 'Enter your content here...',
            enableRichText: true,
            enableSourceMode: true,
            showImagePanel: false, // Show image panel on the right
            toolbar: [
                'bold', 'italic', 'underline', 'strike',
                '|',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                '|',
                'left', 'center', 'right', 'justify',
                '|',
                'bullet', 'number',
                '|',
                'link', 'image', 'video',
                '|',
                'undo', 'redo',
                '|',
                'source'
            ]
        };
        return { ...defaultOptions, ...customOptions };
    }

    init() {
        if (!this.container) {
            console.error(`Container with ID '${this.containerId}' not found`);
            return;
        }

        try {
            // Get current page key
            this.currentPageKey = this.getPageKey();

            // Create editor layout
            this.createEditorLayout();

            // Create toolbar
            this.createToolbar();

            // Create rich text editor
            this.createRichTextEditor();

            // Create source editor
            this.createSourceEditor();

            // Add word count
            this.addWordCount();

            // Create image panel if enabled
            if (this.options.showImagePanel) {
                this.createImagePanel();
                this.loadCurrentPageImages();
            }

            // Initialize with existing content
            this.initializeContent();

            // Set initial mode
            this.setMode('rich');

            // Initialize active state tracking
            this.initializeActiveStateTracking();

            console.log('Custom editor initialized successfully');
        } catch (error) {
            console.error('Error initializing custom editor:', error);
        }
    }

    createEditorLayout() {
        // Add the custom-editor-container class to the main container
        this.container.className = 'custom-editor-container';
        this.container.style.cssText = `
            display: flex;
            gap: 20px;
            height: 100%;
        `;

        // Create main container for editor and image panel
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'custom-editor-main';
        this.editorContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            flex: 1;
            height: 100%;
        `;

        // Move existing content to editor container
        while (this.container.firstChild) {
            this.editorContainer.appendChild(this.container.firstChild);
        }

        // Add editor container back to main container
        this.container.appendChild(this.editorContainer);
    }

    createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'custom-editor-toolbar';
        this.toolbar.style.cssText = `
            border: 1px solid #ccc;
            border-bottom: none;
            background: #f8f9fa;
            padding: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        `;

        // Add toolbar buttons
        this.options.toolbar.forEach(item => {
            if (item === '|') {
                const separator = document.createElement('div');
                separator.style.cssText = 'width: 1px; height: 20px; background: #ccc; margin: 0 4px;';
                this.toolbar.appendChild(separator);
            } else {
                this.createToolbarButton(item);
            }
        });

        this.editorContainer.appendChild(this.toolbar);
    }

    createToolbarButton(action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `custom-editor-btn custom-editor-btn-${action}`;
        button.setAttribute('data-action', action);

        // Set button content and title
        const buttonConfig = this.getButtonConfig(action);
        button.innerHTML = buttonConfig.icon;
        button.title = buttonConfig.title;

        button.style.cssText = `
            padding: 6px 10px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 3px;
            font-size: 14px;
            min-width: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;

        // Add hover effect
        button.addEventListener('mouseenter', () => {
            if (!this.activeStates[action]) {
                button.style.backgroundColor = '#e9ecef';
            }
        });
        button.addEventListener('mouseleave', () => {
            if (!this.activeStates[action]) {
                button.style.backgroundColor = 'white';
            }
        });

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleToolbarAction(action);
        });

        this.toolbar.appendChild(button);
    }

    getButtonConfig(action) {
        const configs = {
            bold: { icon: '<strong>B</strong>', title: 'Bold' },
            italic: { icon: '<em>I</em>', title: 'Italic' },
            underline: { icon: '<u>U</u>', title: 'Underline' },
            strike: { icon: '<s>S</s>', title: 'Strikethrough' },
            h1: { icon: 'H1', title: 'Heading 1' },
            h2: { icon: 'H2', title: 'Heading 2' },
            h3: { icon: 'H3', title: 'Heading 3' },
            h4: { icon: 'H4', title: 'Heading 4' },
            h5: { icon: 'H5', title: 'Heading 5' },
            h6: { icon: 'H6', title: 'Heading 6' },
            left: { icon: '', title: 'Align Left' },
            center: { icon: '', title: 'Align Center' },
            right: { icon: '', title: 'Align Right' },
            justify: { icon: '', title: 'Justify' },
            bullet: { icon: '', title: 'Bullet List' },
            number: { icon: '', title: 'Numbered List' },
            link: { icon: '🔗', title: 'Insert Link' },
            image: { icon: '🖼️', title: 'Insert Image' },
            video: { icon: '▶️', title: 'Embed Video' },
            undo: { icon: '↶', title: 'Undo' },
            redo: { icon: '↷', title: 'Redo' },
            source: { icon: '&lt;/&gt;', title: 'HTML Source Mode' }
        };
        return configs[action] || { icon: action, title: action };
    }

    /**
     * Strip all inline styles from HTML content while preserving tags
     * @param {string} html - HTML string to clean
     * @returns {string} - HTML with all style attributes removed
     */
    stripStylesFromHTML(html) {
        if (!html) return '';
        
        // First, remove all Word-specific markup (meta tags, XML, style blocks, etc.)
        // Remove everything between <!-- and --> (comments)
        html = html.replace(/<!--[\s\S]*?-->/g, '');
        
        // Remove meta tags
        html = html.replace(/<meta[^>]*>/gi, '');
        
        // Remove link tags (Word stylesheets)
        html = html.replace(/<link[^>]*>/gi, '');
        
        // Remove style tags and their content
        html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Remove XML namespaces and Word-specific tags
        html = html.replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '');
        html = html.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '');
        html = html.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
        html = html.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, '');
        html = html.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');
        html = html.replace(/<o:p[^>]*\/>/gi, '');
        
        // Create a temporary container to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Allowed tags: only basic formatting and structure
        const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ol', 'ul', 'li'];
        
        // Helper function to check if element has inline formatting styles
        const getInlineFormatting = (element) => {
            const style = element.getAttribute('style') || '';
            const formatting = {
                bold: false,
                italic: false,
                underline: false
            };
            
            if (style) {
                // Check for bold
                if (style.match(/font-weight:\s*(bold|700|800|900)/i) || 
                    style.match(/font-weight:\s*[6-9]\d{2}/)) {
                    formatting.bold = true;
                }
                // Check for italic
                if (style.match(/font-style:\s*italic/i)) {
                    formatting.italic = true;
                }
                // Check for underline
                if (style.match(/text-decoration:\s*underline/i)) {
                    formatting.underline = true;
                }
            }
            
            return formatting;
        };
        
        // Function to recursively clean elements and preserve only allowed formatting
        const cleanElement = (node) => {
            // Text nodes: keep as-is
            if (node.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(node.textContent);
            }
            
            // Element nodes
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName ? node.tagName.toLowerCase() : '';
                
                // Check for inline formatting styles on non-allowed tags
                const inlineFormatting = getInlineFormatting(node);
                
                // Process children first
                const fragment = document.createDocumentFragment();
                Array.from(node.childNodes).forEach(child => {
                    const cleaned = cleanElement(child);
                    if (cleaned) {
                        if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                            while (cleaned.firstChild) {
                                fragment.appendChild(cleaned.firstChild);
                            }
                        } else {
                            fragment.appendChild(cleaned);
                        }
                    }
                });
                
                // If tag is not allowed, wrap content with formatting tags if needed
                if (!allowedTags.includes(tagName)) {
                    let result = fragment;
                    
                    // Apply formatting based on inline styles
                    if (inlineFormatting.underline) {
                        const u = document.createElement('u');
                        if (result.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                            while (result.firstChild) {
                                u.appendChild(result.firstChild);
                            }
                        } else {
                            u.appendChild(result);
                        }
                        result = u;
                    }
                    if (inlineFormatting.italic) {
                        const em = document.createElement('em');
                        if (result.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                            while (result.firstChild) {
                                em.appendChild(result.firstChild);
                            }
                        } else {
                            em.appendChild(result);
                        }
                        result = em;
                    }
                    if (inlineFormatting.bold) {
                        const strong = document.createElement('strong');
                        if (result.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                            while (result.firstChild) {
                                strong.appendChild(result.firstChild);
                            }
                        } else {
                            strong.appendChild(result);
                        }
                        result = strong;
                    }
                    
                    return result;
                }
                
                // For allowed tags, create clean version without attributes
                const cleanTag = document.createElement(tagName);
                
                // Process children
                if (fragment.childNodes.length > 0) {
                    while (fragment.firstChild) {
                        cleanTag.appendChild(fragment.firstChild);
                    }
                }
                
                return cleanTag;
            }
            
            return null;
        };
        
        // Clean all top-level nodes
        const fragment = document.createDocumentFragment();
        Array.from(tempDiv.childNodes).forEach(child => {
            const cleaned = cleanElement(child);
            if (cleaned) {
                if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                    while (cleaned.firstChild) {
                        fragment.appendChild(cleaned.firstChild);
                    }
                } else {
                    fragment.appendChild(cleaned);
                }
            }
        });
        
        // Convert fragment to HTML string
        const cleanDiv = document.createElement('div');
        cleanDiv.appendChild(fragment);
        
        let result = cleanDiv.innerHTML;
        
        // Final cleanup: remove empty tags and normalize
        result = result.replace(/<p>\s*<\/p>/gi, '');
        result = result.replace(/<strong>\s*<\/strong>/gi, '');
        result = result.replace(/<b>\s*<\/b>/gi, '');
        result = result.replace(/<em>\s*<\/em>/gi, '');
        result = result.replace(/<i>\s*<\/i>/gi, '');
        result = result.replace(/<u>\s*<\/u>/gi, '');
        
        // Normalize multiple spaces (but preserve single spaces)
        result = result.replace(/[ \t]+/g, ' ');
        result = result.replace(/\n\s*\n/g, '\n');
        
        return result;
    }

    createRichTextEditor() {
        this.richTextEditor = document.createElement('div');
        this.richTextEditor.className = 'custom-editor-rich';
        this.richTextEditor.contentEditable = true;
        this.richTextEditor.style.cssText = `
            border: 1px solid #ccc;
            padding: 12px;
            min-height: ${this.options.height};
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            outline: none;
            overflow-y: auto;
            background: white;
        `;
        this.richTextEditor.setAttribute('data-placeholder', this.options.placeholder);

        // Add placeholder functionality
        this.richTextEditor.addEventListener('focus', () => {
            // Check if current content is just the placeholder
            const isPlaceholder = this.richTextEditor.innerHTML.includes('color: #999') && 
                                 this.richTextEditor.innerHTML.includes('font-style: italic') &&
                                 this.richTextEditor.textContent.trim() === '';
            
            if (isPlaceholder) {
                this.richTextEditor.innerHTML = '';
            }
        });

        this.richTextEditor.addEventListener('blur', () => {
            // Check if editor has actual content (text or elements like iframes, images, etc.)
            const hasContent = this.richTextEditor.textContent.trim() !== '' || 
                              this.richTextEditor.querySelector('iframe, img, video, embed, object') !== null ||
                              (this.richTextEditor.innerHTML.trim() !== '' && 
                               !this.richTextEditor.innerHTML.includes('color: #999') && // Not placeholder
                               !this.richTextEditor.innerHTML.includes('font-style: italic')); // Not placeholder
            
            if (!hasContent) {
                this.richTextEditor.innerHTML = `<div style="color: #999; font-style: italic;">${this.options.placeholder}</div>`;
            }
        });

        // Add content change listener
        this.richTextEditor.addEventListener('input', () => {
            this.updateWordCount();
            this.content = this.richTextEditor.innerHTML;
            this.updateActiveStates();
        });

        // Add selection change listener for active state tracking
        this.richTextEditor.addEventListener('keyup', () => {
            this.updateActiveStates();
        });

        this.richTextEditor.addEventListener('mouseup', () => {
            this.updateActiveStates();
        });

        // Add double-click listener for image editing
        this.richTextEditor.addEventListener('dblclick', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                e.stopPropagation();
                this.showImageEditModal(e.target);
            }
        });

        // Add paste event handler to strip inline styles
        this.richTextEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            
            // Get clipboard data
            const clipboardData = e.clipboardData || window.clipboardData;
            let pastedData = clipboardData.getData('text/html');
            
            // If no HTML data, try plain text
            if (!pastedData) {
                pastedData = clipboardData.getData('text/plain');
                // Convert plain text to HTML (preserve line breaks)
                if (pastedData) {
                    pastedData = pastedData.replace(/\n/g, '<br>');
                }
            }
            
            // If still no data, return
            if (!pastedData) {
                return;
            }
            
            // Strip all inline styles from the pasted HTML
            const cleanedHTML = this.stripStylesFromHTML(pastedData);
            
            // Get current selection
            const selection = window.getSelection();
            if (!selection.rangeCount) {
                // If no selection, create a range at the end
                const range = document.createRange();
                range.selectNodeContents(this.richTextEditor);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Use execCommand to insert HTML, which properly updates the undo stack
            // This allows Ctrl+Z to work correctly
            const success = document.execCommand('insertHTML', false, cleanedHTML);
            
            if (!success) {
                // Fallback to manual insertion if execCommand fails
                const range = selection.getRangeAt(0);
                range.deleteContents();
                
                // Create a temporary container to insert the cleaned HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanedHTML;
                
                // Insert all nodes from the cleaned HTML
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                
                // Insert the fragment
                if (fragment.childNodes.length > 0) {
                    range.insertNode(fragment);
                    
                    // Move cursor to end of inserted content
                    const lastNode = fragment.lastChild;
                    if (lastNode) {
                        range.setStartAfter(lastNode);
                        range.collapse(true);
                    }
                } else {
                    // If fragment is empty, insert a text node
                    const textNode = document.createTextNode('');
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.collapse(true);
                }
                
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Trigger input event to update word count and content
            this.richTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
        });

        this.editorContainer.appendChild(this.richTextEditor);
    }

    createSourceEditor() {
        this.sourceEditor = document.createElement('textarea');
        this.sourceEditor.className = 'custom-editor-source';
        this.sourceEditor.style.cssText = `
            border: 1px solid #ccc;
            padding: 12px;
            min-height: ${this.options.height};
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            outline: none;
            resize: vertical;
            background: #f8f9fa;
            color: #333;
            display: none;
            width: 100%;
            box-sizing: border-box;
        `;
        this.sourceEditor.placeholder = 'Enter HTML content here...';

        // Add content change listener
        this.sourceEditor.addEventListener('input', () => {
            this.updateWordCount();
            this.content = this.sourceEditor.value;
        });

        this.editorContainer.appendChild(this.sourceEditor);
    }

    addWordCount() {
        this.wordCountElement = document.createElement('div');
        this.wordCountElement.className = 'custom-editor-word-count';
        this.wordCountElement.style.cssText = `
            padding: 8px 12px;
            background: #f8f9fa;
            border: 1px solid #ccc;
            border-top: none;
            font-size: 12px;
            color: #666;
            text-align: right;
        `;
        this.wordCountElement.textContent = '0 words, 0 characters';

        this.editorContainer.appendChild(this.wordCountElement);
    }

    updateWordCount() {
        const text = this.getText();
        const wordCount = text ? text.split(/\s+/).length : 0;
        const charCount = text.length;
        this.wordCountElement.textContent = `${wordCount} words, ${charCount} characters`;
    }

    getText() {
        if (this.currentMode === 'source') {
            return this.sourceEditor.value;
        } else {
            return this.richTextEditor.textContent || this.richTextEditor.innerText;
        }
    }

    setMode(mode) {
        this.currentMode = mode;

        if (mode === 'rich') {
            this.richTextEditor.style.display = 'block';
            this.sourceEditor.style.display = 'none';

            // Update source button
            const sourceBtn = this.toolbar.querySelector('[data-action="source"]');
            if (sourceBtn) {
                sourceBtn.innerHTML = '&lt;/&gt;';
                sourceBtn.title = 'HTML Source Mode';
            }
        } else {
            this.richTextEditor.style.display = 'none';
            this.sourceEditor.style.display = 'block';

            // Update source button
            const sourceBtn = this.toolbar.querySelector('[data-action="source"]');
            if (sourceBtn) {
                sourceBtn.innerHTML = 'Rich';
                sourceBtn.title = 'Rich Text Mode';
            }
        }
    }

    initializeActiveStateTracking() {
        // Initialize active states object
        this.options.toolbar.forEach(item => {
            if (item !== '|') {
                this.activeStates[item] = false;
            }
        });
    }

    updateActiveStates() {
        if (this.currentMode !== 'rich') return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const parentElement = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;

        // Check formatting states
        this.activeStates.bold = document.queryCommandState('bold');
        this.activeStates.italic = document.queryCommandState('italic');
        this.activeStates.underline = document.queryCommandState('underline');
        this.activeStates.strike = document.queryCommandState('strikeThrough');

        // Check alignment
        this.activeStates.left = document.queryCommandValue('justifyLeft') === 'left';
        this.activeStates.center = document.queryCommandValue('justifyCenter') === 'center';
        this.activeStates.right = document.queryCommandValue('justifyRight') === 'right';
        this.activeStates.justify = document.queryCommandValue('justifyFull') === 'justify';

        // Check list states
        this.activeStates.bullet = this.isInList(parentElement, 'ul');
        this.activeStates.number = this.isInList(parentElement, 'ol');

        // Check heading states
        const headingTag = this.getHeadingTag(parentElement);
        this.activeStates.h1 = headingTag === 'h1';
        this.activeStates.h2 = headingTag === 'h2';
        this.activeStates.h3 = headingTag === 'h3';
        this.activeStates.h4 = headingTag === 'h4';
        this.activeStates.h5 = headingTag === 'h5';
        this.activeStates.h6 = headingTag === 'h6';

        // Update button appearances
        this.updateButtonAppearances();
    }

    createImagePanel() {
        this.imagePanel = document.createElement('div');
        this.imagePanel.className = 'custom-editor-image-panel';
        this.imagePanel.style.cssText = `
            width: 300px;
            border: 1px solid #ccc;
            background: #f8f9fa;
            padding: 15px;
            overflow-y: auto;
            height: 100%;
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
        `;
        
        const title = document.createElement('h4');
        title.textContent = 'Image Management';
        title.style.cssText = `
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #333;
        `;
        header.appendChild(title);

        // Create source toggle buttons
        const sourceToggle = document.createElement('div');
        sourceToggle.style.cssText = `
            display: flex;
            gap: 5px;
        `;

        const pageImagesBtn = document.createElement('button');
        pageImagesBtn.textContent = 'Page Images';
        pageImagesBtn.className = 'image-source-btn active';
        pageImagesBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #007bff;
            background: #007bff;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
        `;

        const publicImagesBtn = document.createElement('button');
        publicImagesBtn.textContent = 'Public Images';
        publicImagesBtn.className = 'image-source-btn';
        publicImagesBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #6c757d;
            background: #6c757d;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
        `;

        // Add click handlers
        pageImagesBtn.addEventListener('click', () => {
            this.switchImageSource('page');
        });

        publicImagesBtn.addEventListener('click', () => {
            this.switchImageSource('public');
        });

        sourceToggle.appendChild(pageImagesBtn);
        sourceToggle.appendChild(publicImagesBtn);
        header.appendChild(sourceToggle);

        // Create images container
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'images-container';
        imagesContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 10px;
            max-height: 400px;
            overflow-y: auto;
        `;

        this.imagePanel.appendChild(header);
        this.imagePanel.appendChild(imagesContainer);

        // Add to main container
        this.container.appendChild(this.imagePanel);
    }

    switchImageSource(source) {
        const pageImagesBtn = this.imagePanel.querySelector('.image-source-btn:nth-child(1)');
        const publicImagesBtn = this.imagePanel.querySelector('.image-source-btn:nth-child(2)');

        if (source === 'page') {
            pageImagesBtn.classList.add('active');
            pageImagesBtn.style.background = '#007bff';
            pageImagesBtn.style.borderColor = '#007bff';
            publicImagesBtn.classList.remove('active');
            publicImagesBtn.style.background = '#6c757d';
            publicImagesBtn.style.borderColor = '#6c757d';
            this.loadCurrentPageImages();
        } else {
            publicImagesBtn.classList.add('active');
            publicImagesBtn.style.background = '#007bff';
            publicImagesBtn.style.borderColor = '#007bff';
            pageImagesBtn.classList.remove('active');
            pageImagesBtn.style.background = '#6c757d';
            pageImagesBtn.style.borderColor = '#6c757d';
            this.loadPublicImages();
        }
    }

    loadCurrentPageImages() {
        const imagesContainer = this.imagePanel.querySelector('.images-container');
        this.showLoading(imagesContainer);

        const url = this.currentPageKey 
            ? `/admin/api/page-images?pageKey=${encodeURIComponent(this.currentPageKey)}`
            : '/admin/api/page-images?pageKey=generic';

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.displayImages(data.images, 'page');
                } else {
                    this.showError(imagesContainer, data.message || 'Failed to load page images');
                }
            })
            .catch(error => {
                console.error('Error loading page images:', error);
                this.showError(imagesContainer, 'Failed to load page images');
            });
    }

    loadPublicImages() {
        const imagesContainer = this.imagePanel.querySelector('.images-container');
        this.showLoading(imagesContainer);

        fetch('/admin/api/public-images')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.displayImages(data.images, 'public');
                } else {
                    this.showError(imagesContainer, data.message || 'Failed to load public images');
                }
            })
            .catch(error => {
                console.error('Error loading public images:', error);
                this.showError(imagesContainer, 'Failed to load public images');
            });
    }

    displayImages(images, source) {
        const imagesContainer = this.imagePanel.querySelector('.images-container');
        imagesContainer.innerHTML = '';

        if (!images || images.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = 'No images found';
            emptyMessage.style.cssText = `
                grid-column: 1 / -1;
                text-align: center;
                color: #6c757d;
                padding: 20px;
                font-style: italic;
            `;
            imagesContainer.appendChild(emptyMessage);
            return;
        }

        images.forEach(image => {
            const imageCard = this.createImageCard(image, source);
            imagesContainer.appendChild(imageCard);
        });
    }

    createImageCard(image, source) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.style.cssText = `
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;

        const img = document.createElement('img');
        img.src = image.url;
        img.alt = image.name;
        img.style.cssText = `
            width: 100%;
            height: 80px;
            object-fit: cover;
            border-radius: 4px;
            margin-bottom: 5px;
        `;

        const name = document.createElement('div');
        name.textContent = image.name;
        name.style.cssText = `
            font-size: 11px;
            color: #333;
            text-align: center;
            word-break: break-word;
            line-height: 1.2;
            margin-bottom: 3px;
        `;

        const size = document.createElement('div');
        size.textContent = this.formatFileSize(image.size);
        size.style.cssText = `
            font-size: 10px;
            color: #6c757d;
            text-align: center;
        `;

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(size);

        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });

        // Add click handler
        card.addEventListener('click', () => {
            this.insertImageFromPanel(image.url);
        });

        return card;
    }

    insertImageFromPanel(imageUrl) {
        if (this.currentMode === 'source') {
            // Insert into source editor
            const imgTag = `<img src="${imageUrl}" alt="" style="max-width: 100%; height: auto;">`;
            const cursorPos = this.sourceEditor.selectionStart;
            const textBefore = this.sourceEditor.value.substring(0, cursorPos);
            const textAfter = this.sourceEditor.value.substring(cursorPos);
            this.sourceEditor.value = textBefore + imgTag + textAfter;
            
            // Update cursor position
            const newPos = cursorPos + imgTag.length;
            this.sourceEditor.setSelectionRange(newPos, newPos);
            this.sourceEditor.focus();
        } else {
            // Insert into rich text editor
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = '';
            img.style.cssText = 'max-width: 100%; height: auto;';
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                range.collapse(false);
            } else {
                this.richTextEditor.appendChild(img);
            }
            
            this.richTextEditor.focus();
        }

        this.updateWordCount();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(container) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #6c757d; padding: 20px;">
                Loading images...
            </div>
        `;
    }

    showError(container, message) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #dc3545; padding: 20px;">
                ${message}
            </div>
        `;
    }

    isInList(element, listType) {
        if (!element) return false;
        if (element.tagName && element.tagName.toLowerCase() === listType) return true;
        return this.isInList(element.parentElement, listType);
    }

    getHeadingTag(element) {
        if (!element) return null;
        if (element.tagName && /^h[1-6]$/i.test(element.tagName)) {
            return element.tagName.toLowerCase();
        }
        return this.getHeadingTag(element.parentElement);
    }

    updateButtonAppearances() {
        Object.keys(this.activeStates).forEach(action => {
            const button = this.toolbar.querySelector(`[data-action="${action}"]`);
            if (button) {
                if (this.activeStates[action]) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    handleToolbarAction(action) {
        if (action === 'source') {
            this.toggleSourceMode();
            return;
        }

        if (this.currentMode === 'source') {
            // In source mode, only allow switching to rich mode
            return;
        }

        switch (action) {
            case 'bold':
                document.execCommand('bold', false, null);
                break;
            case 'italic':
                document.execCommand('italic', false, null);
                break;
            case 'underline':
                document.execCommand('underline', false, null);
                break;
            case 'strike':
                document.execCommand('strikeThrough', false, null);
                break;
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                document.execCommand('formatBlock', false, action);
                break;
            case 'left':
                document.execCommand('justifyLeft', false, null);
                break;
            case 'center':
                document.execCommand('justifyCenter', false, null);
                break;
            case 'right':
                document.execCommand('justifyRight', false, null);
                break;
            case 'justify':
                document.execCommand('justifyFull', false, null);
                break;
            case 'bullet':
                document.execCommand('insertUnorderedList', false, null);
                break;
            case 'number':
                document.execCommand('insertOrderedList', false, null);
                break;
            case 'link':
                this.showLinkModal();
                break;
            case 'image':
                this.showImageModal();
                break;
            case 'video':
                this.showVideoModal();
                break;
            case 'undo':
                document.execCommand('undo', false, null);
                break;
            case 'redo':
                document.execCommand('redo', false, null);
                break;
        }

        // Update active states after command execution
        setTimeout(() => {
            this.updateActiveStates();
        }, 10);
    }

    toggleSourceMode() {
        if (this.currentMode === 'rich') {
            // Switch to source mode
            this.sourceEditor.value = this.richTextEditor.innerHTML;
            this.setMode('source');
        } else {
            // Switch to rich mode
            this.richTextEditor.innerHTML = this.sourceEditor.value;
            this.setMode('rich');
        }
        this.updateWordCount();
    }

    showLinkModal() {
        // Save cursor position and selected text BEFORE opening modal
        const selection = window.getSelection();
        let savedRange = null;
        let selectedText = '';
        let existingLinkUrl = '';
        let existingLinkText = '';
        
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
            
            // If we found a link, extract its href and text
            if (linkElement) {
                existingLinkUrl = linkElement.href || linkElement.getAttribute('href') || '';
                existingLinkText = linkElement.textContent || linkElement.innerText || '';
                console.log('Found existing link:', existingLinkUrl, existingLinkText);
            }
            
            console.log('Saved cursor position before link modal, selected text:', selectedText);
        }

        // Get page key from the form if available
        const pageKey = this.getPageKey();

        // Remove existing modal if any
        const existingModal = document.querySelector('.custom-editor-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'custom-editor-modal';
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
            z-index: 10000;
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
            border-bottom: 2px solid #007bff;
            color: #007bff;
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
            background: #007bff;
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
        modal.pageKey = pageKey;
        modal.uploadedFilePath = null;
        modal.existingLinkUrl = existingLinkUrl;
        modal.existingLinkElement = null; // Will be set if we need to update an existing link

        // Tab switching
        urlTab.addEventListener('click', () => {
            urlTab.classList.add('active');
            urlTab.style.borderBottomColor = '#007bff';
            urlTab.style.color = '#007bff';
            fileTab.classList.remove('active');
            fileTab.style.borderBottomColor = 'transparent';
            fileTab.style.color = '#6c757d';
            urlSection.style.display = 'block';
            fileSection.style.display = 'none';
            urlInput.focus();
        });

        fileTab.addEventListener('click', () => {
            fileTab.classList.add('active');
            fileTab.style.borderBottomColor = '#007bff';
            fileTab.style.color = '#007bff';
            urlTab.classList.remove('active');
            urlTab.style.borderBottomColor = 'transparent';
            urlTab.style.color = '#6c757d';
            urlSection.style.display = 'none';
            fileSection.style.display = 'block';
        });

        // File upload handler
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!pageKey) {
                errorDiv.textContent = 'Page key not found. Please save the page first.';
                errorDiv.style.display = 'block';
                return;
            }

            uploadStatus.style.display = 'block';
            uploadStatus.textContent = 'Uploading...';
            uploadStatus.style.background = '#fff3cd';
            uploadStatus.style.color = '#856404';
            uploadStatus.style.border = '1px solid #ffeaa7';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('key', pageKey);

            try {
                const response = await fetch(`/admin/pages/${pageKey}/upload-file`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    // Try to parse error response
                    let errorMessage = 'Failed to upload file';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorData.message || errorMessage;
                    } catch (e) {
                        errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    }
                    console.error('Upload failed:', response.status, errorMessage);
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                    uploadStatus.style.display = 'none';
                    return;
                }

                const data = await response.json();

                if (data.success) {
                    modal.uploadedFilePath = data.filePath;
                    fileInfo.textContent = `File: ${data.originalName}`;
                    fileInfo.style.display = 'block';
                    uploadStatus.textContent = 'Upload successful!';
                    uploadStatus.style.background = '#d4edda';
                    uploadStatus.style.color = '#155724';
                    uploadStatus.style.border = '1px solid #c3e6cb';
                } else {
                    errorDiv.textContent = data.error || 'Failed to upload file';
                    errorDiv.style.display = 'block';
                    uploadStatus.style.display = 'none';
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                errorDiv.textContent = `Error uploading file: ${error.message || 'Please try again.'}`;
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

            // If we found an existing link, update it
            if (existingLinkElement) {
                existingLinkElement.href = url;
                if (text) {
                    existingLinkElement.textContent = text;
                }
                
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
                linkElement.target = '_blank';

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

    getPageKey() {
        // Try to get page key from the form
        const form = document.getElementById('editPageForm');
        if (form) {
            return form.dataset.pageKey || '';
        }
        // Fallback: try to get from key input field
        const keyInput = document.getElementById('key');
        if (keyInput) {
            return keyInput.value || '';
        }
        return '';
    }

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
    }

    showImageEditModal(imageElement) {
        // Create custom modal with two-panel layout in edit mode
        const modal = this.createImageModal(null, true, imageElement);
    }

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
        const existingModal = document.querySelector('.custom-editor-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'custom-editor-modal';
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
            z-index: 10000;
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
        urlInput.placeholder = getText('videoUrlPlaceholder', 'https://www.youtube.com/watch?v=... or https://vimeo.com/... or https://rutube.ru/video/...');
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
            background: #007bff;
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
                // Get CSRF token from meta tag or global helper
                const csrfToken = typeof getCsrfToken !== 'undefined' ? getCsrfToken() : 
                    (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
                
                const headers = {
                    'Content-Type': 'application/json'
                };
                
                // Add CSRF token to headers if available
                if (csrfToken) {
                    headers['X-CSRF-Token'] = csrfToken;
                }
                
                const response = await fetch('/admin/api/video/embed', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ url })
                });

                const data = await response.json();

                if (data.success) {
                    videoData = data;
                    
                    // CRITICAL: Update CSRF token from response
                    // csurf regenerates tokens on POST requests, so we MUST update the token
                    if (data.csrfToken) {
                        // Update meta tag
                        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                        if (csrfMeta) {
                            csrfMeta.setAttribute('content', data.csrfToken);
                        }
                        
                        // Update all CSRF token inputs in forms
                        const csrfInputs = document.querySelectorAll('input[name="_csrf"]');
                        csrfInputs.forEach(input => {
                            input.setAttribute('value', data.csrfToken);
                        });
                        
                        console.log('CSRF token updated after video embed API call');
                    }
                    
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
                            textarea.value = currentContent + '\n' + videoData.embed;
                            this.richTextEditor.innerHTML = textarea.value;
                            this.sourceEditor.value = textarea.value;
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
                
                // Set video title as page title if available and field is empty
                if (videoData.title) {
                    // Validate that title is not a URL or HTML/embed code
                    const isUrl = (str) => {
                        if (!str || typeof str !== 'string') return false;
                        const trimmed = str.trim();
                        // Check if it looks like a URL
                        return /^(https?:\/\/|www\.|[a-z0-9-]+\.(com|ru|org|net|io|be))/i.test(trimmed) || 
                               (trimmed.includes('://') || trimmed.includes('www.'));
                    };
                    
                    const isHtml = (str) => {
                        if (!str || typeof str !== 'string') return false;
                        // Check for common HTML tags and embed patterns
                        const htmlPattern = /<[^>]+>|&[a-z]+;|&#[0-9]+;/i;
                        // Check for embed-specific patterns
                        const embedPattern = /<div|<iframe|<embed|<object|class="video-wrapper"|style="position: relative/i;
                        return htmlPattern.test(str) || embedPattern.test(str);
                    };
                    
                    const cleanTitle = videoData.title.trim();
                    // Only set title if it's not a URL and not HTML/embed code
                    if (!isUrl(cleanTitle) && !isHtml(cleanTitle)) {
                        const pageTitleInput = document.getElementById('title');
                        if (pageTitleInput && !pageTitleInput.value.trim()) {
                            // Only set if page title is empty
                            pageTitleInput.value = cleanTitle;
                            // Trigger input event to auto-generate key and URL if in create mode
                            pageTitleInput.dispatchEvent(new Event('input'));
                        }
                    }
                }
                
                // Set thumbnail as page image if available and field is empty
                if (videoData.thumbnail) {
                    const pageImageInput = document.getElementById('pageImage');
                    if (pageImageInput && !pageImageInput.value.trim()) {
                        // Only set if page image is empty
                        pageImageInput.value = videoData.thumbnail;
                        
                        // Update the preview image display
                        const currentImageContainer = document.getElementById('currentImageContainer');
                        if (currentImageContainer) {
                            const noImageUploaded = getText('noImageUploaded', 'No image uploaded');
                            const currentImageAlt = getText('pageImage', 'Current page image');
                            
                            currentImageContainer.innerHTML = `
                                <div class="text-center">
                                    <img id="currentImage" src="${videoData.thumbnail}" alt="${currentImageAlt}"
                                        class="img-fluid rounded"
                                        style="max-width: 100%; max-height: 200px; cursor: pointer;"
                                        onclick="openImageInNewTab('${videoData.thumbnail}')" />
                                </div>
                            `;
                        }
                    }
                }
                
                // Set video description as page description if available and field is empty
                if (videoData.description && videoData.description.trim()) {
                    const descriptionInput = document.getElementById('description');
                    if (descriptionInput && !descriptionInput.value.trim()) {
                        // Only set if page description is empty
                        descriptionInput.value = videoData.description.trim();
                        // Trigger input event to update any related fields
                        descriptionInput.dispatchEvent(new Event('input'));
                    }
                    
                    // Also set SEO meta description if available and empty
                    const seoDescriptionInput = document.getElementById('seoPageDescription');
                    if (seoDescriptionInput && !seoDescriptionInput.value.trim()) {
                        // Only set if SEO description is empty
                        seoDescriptionInput.value = videoData.description.trim();
                        // Trigger input event to update any related fields
                        seoDescriptionInput.dispatchEvent(new Event('input'));
                    }
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

    createImageModal(savedRange, editMode = false, existingImage = null) {
        // Remove existing modal if any
        const existingModal = document.querySelector('.custom-editor-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'custom-editor-modal';
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
            z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 8px;
            min-width: 800px;
            max-width: 1200px;
            width: 90%;
            max-height: 80vh;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            gap: 24px;
        `;

        // Left Panel - Form and Upload
        const leftPanel = document.createElement('div');
        leftPanel.style.cssText = `
            flex: 1;
            min-width: 300px;
            display: flex;
            flex-direction: column;
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

        // Form Fields
        const formFields = [
            { label: 'Image URL:', type: 'text', id: 'imageUrl', placeholder: 'https://example.com/image.jpg' },
            { label: 'Alt Text:', type: 'text', id: 'imageAlt', placeholder: 'Image description' },
            { label: 'CSS Class Name:', type: 'text', id: 'imageClass', placeholder: 'custom-image-class' }
        ];

        formFields.forEach(field => {
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
            border: 1px solid #007bff;
            background: #007bff;
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
        leftPanel.appendChild(uploadSection);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: auto;
            padding-top: 20px;
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
            border: 1px solid #007bff;
            background: #007bff;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;

        confirmBtn.addEventListener('click', () => {
            const url = modal.querySelector('#imageUrl').value.trim();
            const alt = modal.querySelector('#imageAlt').value.trim();
            const className = modal.querySelector('#imageClass').value.trim();
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
        leftPanel.appendChild(buttonContainer);

        // Right Panel - Image List
        const rightPanel = document.createElement('div');
        rightPanel.style.cssText = `
            flex: 1;
            min-width: 400px;
            display: flex;
            flex-direction: column;
            border-left: 1px solid #dee2e6;
            padding-left: 24px;
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
        pageImagesBtn.className = 'toggle-btn active';
        pageImagesBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #007bff;
            background: #007bff;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;

        const publicImagesBtn = document.createElement('button');
        publicImagesBtn.textContent = 'Public Images';
        publicImagesBtn.className = 'toggle-btn';
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

        modalContent.appendChild(leftPanel);
        modalContent.appendChild(rightPanel);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Prefill form if editing (after modal is added to DOM)
        if (modal.dataset.editMode === 'true') {
            const urlInput = modal.querySelector('#imageUrl');
            const altInput = modal.querySelector('#imageAlt');
            const classInput = modal.querySelector('#imageClass');
            const widthInput = modal.querySelector('#imageWidth');
            const heightInput = modal.querySelector('#imageHeight');
            const alignSelect = modal.querySelector('#imageAlign');

            if (urlInput) urlInput.value = modal.dataset.existingImageSrc || '';
            if (altInput) altInput.value = modal.dataset.existingImageAlt || '';
            if (classInput) classInput.value = modal.dataset.existingImageClass || '';
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
    }

    switchImageSourceInModal(source, imagesContainer, pageImagesBtn, publicImagesBtn) {
        if (source === 'page') {
            pageImagesBtn.className = 'toggle-btn active';
            pageImagesBtn.style.cssText = `
                padding: 6px 12px;
                border: 1px solid #007bff;
                background: #007bff;
                color: white;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
            `;
            publicImagesBtn.className = 'toggle-btn';
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
            publicImagesBtn.className = 'toggle-btn active';
            publicImagesBtn.style.cssText = `
                padding: 6px 12px;
                border: 1px solid #007bff;
                background: #007bff;
                color: white;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
            `;
            pageImagesBtn.className = 'toggle-btn';
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
    }

    loadImagesInModal(imagesContainer, source) {
        this.showLoadingInModal(imagesContainer);
        
        if (source === 'page') {
            // Fetch images for current page
            fetch(`/admin/api/page-images?pageKey=${this.currentPageKey || 'generic'}`)
                .then(response => response.json())
                .then(data => {
                    this.displayImagesInModal(imagesContainer, data.images || [], source);
                })
                .catch(error => {
                    console.error('Error loading page images:', error);
                    this.showErrorInModal(imagesContainer, 'Failed to load page images');
                });
        } else {
            // Fetch public images
            fetch('/admin/api/public-images')
                .then(response => response.json())
                .then(data => {
                    this.displayImagesInModal(imagesContainer, data.images || [], source);
                })
                .catch(error => {
                    console.error('Error loading public images:', error);
                    this.showErrorInModal(imagesContainer, 'Failed to load public images');
                });
        }
    }

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
    }

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
                card.style.borderColor = '#007bff';
                card.style.boxShadow = '0 2px 8px rgba(0,123,255,0.2)';
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
            const modal = document.querySelector('.custom-editor-modal');
            if (modal) {
                // Remove selection from all cards
                const allCards = modal.querySelectorAll('.image-card');
                allCards.forEach(c => {
                    c.style.border = '1px solid #dee2e6';
                    c.style.boxShadow = 'none';
                });
                
                // Add selection to clicked card
                card.style.border = '2px solid #007bff';
                card.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.3)';
                
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
    }

    insertImageFromModalCard(imageUrl) {
        // Focus the editor
        this.richTextEditor.focus();

        // Create image tag
        const imgTag = `<img src="${imageUrl}" alt="" style="max-width: 100%; height: auto;">`;

        // Insert at cursor position or at the end
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (this.richTextEditor.contains(range.commonAncestorContainer)) {
                document.execCommand('insertHTML', false, imgTag);
            } else {
                // Insert at the end
                this.richTextEditor.innerHTML += imgTag;
            }
        } else {
            // Insert at the end
            this.richTextEditor.innerHTML += imgTag;
        }

        // Update content
        this.content = this.richTextEditor.innerHTML;
        this.updateWordCount();
    }

    insertImageFromModal(url, alt, className, width, height, align, savedRange) {
        // Use the same optimized insertion method
        try {
            let imgTag = `<img src="${url}"`;
            if (alt) imgTag += ` alt="${alt}"`;
            if (className) imgTag += ` class="${className}"`;
            if (width) imgTag += ` width="${width}"`;
            if (height) imgTag += ` height="${height}"`;
            
            // Add align styling
            let style = '';
            if (align) {
                if (align === 'left') {
                    style = 'float: left; margin-right: 10px;';
                } else if (align === 'right') {
                    style = 'float: right; margin-left: 10px;';
                } else if (align === 'center') {
                    style = 'display: block; margin: 0 auto;';
                }
            }
            if (style) imgTag += ` style="${style}"`;
            
            imgTag += '>';

            // Focus the editor and use saved range
            this.richTextEditor.focus();
            
            let rangeToUse = savedRange;
            if (!rangeToUse) {
                const newRange = document.createRange();
                newRange.selectNodeContents(this.richTextEditor);
                newRange.collapse(false);
                rangeToUse = newRange;
            }
            
            if (!this.richTextEditor.contains(rangeToUse.commonAncestorContainer)) {
                const newRange = document.createRange();
                newRange.selectNodeContents(this.richTextEditor);
                newRange.collapse(false);
                rangeToUse = newRange;
            }
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(rangeToUse);

            const success = document.execCommand('insertHTML', false, imgTag);
            if (!success) {
                // Fallback: create and insert image element
                const imgElement = document.createElement('img');
                imgElement.src = url;
                if (alt) imgElement.alt = alt;
                if (className) imgElement.className = className;
                if (width) imgElement.width = width;
                if (height) imgElement.height = height;
                
                // Add align styling
                if (align) {
                    if (align === 'left') {
                        imgElement.style.float = 'left';
                        imgElement.style.marginRight = '10px';
                    } else if (align === 'right') {
                        imgElement.style.float = 'right';
                        imgElement.style.marginLeft = '10px';
                    } else if (align === 'center') {
                        imgElement.style.display = 'block';
                        imgElement.style.margin = '0 auto';
                    }
                }
                
                rangeToUse.deleteContents();
                rangeToUse.insertNode(imgElement);
                rangeToUse.setStartAfter(imgElement);
                rangeToUse.insertNode(document.createTextNode('\u00A0'));
                
                // Update selection
                selection.removeAllRanges();
                selection.addRange(rangeToUse);
                
                console.log('Image inserted using manual method');
            } else {
                console.log('Image inserted successfully with execCommand');
            }
        } catch (error) {
            console.error('Error inserting image:', error);
            // Fallback: append to the end
            const imgElement = document.createElement('img');
            imgElement.src = url;
            if (alt) imgElement.alt = alt;
            if (className) imgElement.className = className;
            if (width) imgElement.width = width;
            if (height) imgElement.height = height;
            
            // Add align styling
            if (align) {
                if (align === 'left') {
                    imgElement.style.float = 'left';
                    imgElement.style.marginRight = '10px';
                } else if (align === 'right') {
                    imgElement.style.float = 'right';
                    imgElement.style.marginLeft = '10px';
                } else if (align === 'center') {
                    imgElement.style.display = 'block';
                    imgElement.style.margin = '0 auto';
                }
            }
            
            this.richTextEditor.appendChild(imgElement);
            this.richTextEditor.appendChild(document.createTextNode('\u00A0'));
        }
    }

    updateImageInEditor(existingImage, url, alt, className, width, height, align) {
        // Focus the editor
        this.richTextEditor.focus();

        // Update the existing image element
        if (existingImage && existingImage.parentNode) {
            existingImage.src = url;
            if (alt) existingImage.alt = alt;
            if (className) existingImage.className = className;
            if (width) existingImage.width = width;
            if (height) existingImage.height = height;
            
            // Update align styling
            if (align) {
                if (align === 'left') {
                    existingImage.style.float = 'left';
                    existingImage.style.marginRight = '10px';
                    existingImage.style.marginLeft = '';
                    existingImage.style.display = '';
                    existingImage.style.margin = '';
                } else if (align === 'right') {
                    existingImage.style.float = 'right';
                    existingImage.style.marginLeft = '10px';
                    existingImage.style.marginRight = '';
                    existingImage.style.display = '';
                    existingImage.style.margin = '';
                } else if (align === 'center') {
                    existingImage.style.display = 'block';
                    existingImage.style.margin = '0 auto';
                    existingImage.style.float = '';
                } else {
                    // Default - clear all align styles
                    existingImage.style.float = '';
                    existingImage.style.margin = '';
                    existingImage.style.display = '';
                }
            }
        }

        // Update content
        this.content = this.richTextEditor.innerHTML;
        this.updateWordCount();
    }

    showLoadingInModal(imagesContainer) {
        imagesContainer.innerHTML = '';
        const loadingIndicator = document.createElement('div');
        loadingIndicator.textContent = 'Loading images...';
        loadingIndicator.style.cssText = `
            text-align: center;
            color: #666;
            font-size: 14px;
            padding: 20px;
            grid-column: 1 / -1;
        `;
        imagesContainer.appendChild(loadingIndicator);
    }

    showErrorInModal(imagesContainer, message) {
        imagesContainer.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            text-align: center;
            color: #dc3545;
            font-size: 14px;
            padding: 20px;
            grid-column: 1 / -1;
        `;
        imagesContainer.appendChild(errorDiv);
    }

         uploadImage(file, modal, savedRange, editMode = false, existingImage = null) {
         // Get page key from the form or URL
         const pageKey = this.getPageKey();
         console.log('Uploading image for page key:', pageKey);
         console.log('File to upload:', file);
         console.log('Using saved range:', savedRange ? 'yes' : 'no');

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('image', file);
        if (pageKey) {
            formData.append('pageKey', pageKey);
        } else {
            // When no page key, indicate generic upload
            formData.append('pageKey', 'generic');
        }

        console.log('FormData created:', formData);

        // Show loading state in modal
        const uploadButton = modal.querySelector('.upload-button');
        const originalText = uploadButton.textContent;
        uploadButton.textContent = 'Uploading...';
        uploadButton.disabled = true;

        console.log('Starting upload to /admin/api/upload-image');

        // Get CSRF token from meta tag or global helper
        const csrfToken = typeof getCsrfToken !== 'undefined' ? getCsrfToken() : 
            (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
        
        const headers = {};
        
        // Add CSRF token to headers if available
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        // Upload to server
        fetch('/admin/api/upload-image', {
            method: 'POST',
            headers: headers,
            body: formData
        })
        .then(response => {
            console.log('Response received:', response);
            return response.json();
        })
        .then(data => {
            console.log('Upload response data:', data);
            if (data.success) {
                // Get values from modal
                const alt = modal.querySelector('#imageAlt').value.trim();
                const className = modal.querySelector('#imageClass').value.trim();
                const width = modal.querySelector('#imageWidth').value.trim();
                const height = modal.querySelector('#imageHeight').value.trim();
                const align = modal.querySelector('#imageAlign').value.trim();

                // Fix URL format - replace backslashes with forward slashes
                let imageUrl = data.url;
                if (imageUrl) {
                    imageUrl = imageUrl.replace(/\\/g, '/');
                    // Ensure URL starts with proper path
                    if (!imageUrl.startsWith('/')) {
                        imageUrl = '/' + imageUrl;
                    }
                    // Remove any double slashes at the beginning (except for http://)
                    imageUrl = imageUrl.replace(/^\/\//, '/');
                }

                console.log('Fixed image URL:', imageUrl);

                // Populate the URL field instead of inserting directly
                const urlInput = modal.querySelector('#imageUrl');
                if (urlInput) {
                    urlInput.value = imageUrl;
                }

                // Refresh the images in the modal
                const imagesContainer = modal.querySelector('[style*="grid-template-columns"]');
                if (imagesContainer) {
                    // Find the active source and refresh
                    const activeBtn = modal.querySelector('.toggle-btn.active');
                    const source = activeBtn && activeBtn.textContent.includes('Page') ? 'page' : 'public';
                    this.loadImagesInModal(imagesContainer, source);
                }

                // Reset upload button
                uploadButton.textContent = originalText;
                uploadButton.disabled = false;
            } else {
                // Show error
                console.error('Upload failed:', data.message);
                this.showError('Failed to upload image: ' + data.message);
                
                // Reset button
                uploadButton.textContent = originalText;
                uploadButton.disabled = false;
            }
        })
        .catch(error => {
            // Show error
            console.error('Upload error:', error);
            this.showError('Failed to upload image: ' + error.message);
            
            // Reset button
            uploadButton.textContent = originalText;
            uploadButton.disabled = false;
        });
    }

    getPageKey() {
        // Try to get page key from various sources
        const urlParams = new URLSearchParams(window.location.search);
        let pageKey = urlParams.get('key');
        console.log('Page key from URL params:', pageKey);
        
        if (!pageKey) {
            // Try to get from form data
            const form = document.querySelector('form');
            if (form) {
                console.log('Form found, checking for key input...');
                const keyInput = form.querySelector('input[name="key"]');
                if (keyInput) {
                    pageKey = keyInput.value;
                    console.log('Page key from form input:', pageKey);
                } else {
                    console.log('No key input found in form');
                    // List all form inputs for debugging
                    const allInputs = form.querySelectorAll('input');
                    console.log('All form inputs:', Array.from(allInputs).map(input => ({
                        name: input.name,
                        value: input.value,
                        type: input.type
                    })));
                }
            } else {
                console.log('No form found');
            }
        }
        
        if (!pageKey) {
            // Try to get from URL path
            const pathParts = window.location.pathname.split('/');
            console.log('URL path parts:', pathParts);
            const editIndex = pathParts.indexOf('edit');
            if (editIndex !== -1 && editIndex > 0) {
                // For edit pages, the page key is before "edit"
                pageKey = pathParts[editIndex - 1];
                console.log('Page key from URL path (edit):', pageKey);
            }
        }
        
        if (!pageKey) {
            // Try to get from create page URL
            const pathParts = window.location.pathname.split('/');
            const createIndex = pathParts.indexOf('create');
            if (createIndex !== -1) {
                // For create page, we can use a temporary key or generate one
                pageKey = 'temp-page-' + Date.now();
                console.log('Generated temp page key for create page:', pageKey);
            }
        }
        
        // If still no page key found, return null to indicate generic upload
        if (!pageKey) {
            console.log('No page key found, will use generic upload location');
            return null;
        }
        
        console.log('Final detected page key:', pageKey);
        return pageKey;
    }

    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 300px;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    createModal(title, fields) {
        // Remove existing modal if any
        const existingModal = document.querySelector('.custom-editor-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'custom-editor-modal';
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
            z-index: 10000;
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
        modalTitle.textContent = title;
        modalTitle.style.cssText = `
            margin: 0 0 20px 0;
            color: #333;
            font-size: 18px;
        `;
        modalContent.appendChild(modalTitle);

        // Fields
        fields.forEach(field => {
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

            modalContent.appendChild(fieldContainer);
        });

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
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
            border: 1px solid #007bff;
            background: #007bff;
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

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        return modal;
    }

    closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }

    initializeContent() {
        // Check if there's existing content in the textarea
        const textarea = document.querySelector(`textarea[name="content"]`);
        if (textarea && textarea.value) {
            this.content = textarea.value;
            this.richTextEditor.innerHTML = textarea.value;
            this.sourceEditor.value = textarea.value;
            this.updateWordCount();
        }
    }

    getHTML() {
        if (this.currentMode === 'source') {
            return this.sourceEditor.value;
        } else {
            return this.richTextEditor.innerHTML;
        }
    }

    setHTML(html) {
        this.content = html;
        this.richTextEditor.innerHTML = html;
        this.sourceEditor.value = html;
        this.updateWordCount();
    }

    getContent() {
        return this.getHTML();
    }

    setContent(content) {
        this.setHTML(content);
    }

    focus() {
        if (this.currentMode === 'rich') {
            this.richTextEditor.focus();
        } else {
            this.sourceEditor.focus();
        }
    }

    destroy() {
        if (this.toolbar && this.toolbar.parentNode) {
            this.toolbar.parentNode.removeChild(this.toolbar);
        }
        if (this.wordCountElement && this.wordCountElement.parentNode) {
            this.wordCountElement.parentNode.removeChild(this.wordCountElement);
        }
        if (this.imagePanel && this.imagePanel.parentNode) {
            this.imagePanel.parentNode.removeChild(this.imagePanel);
        }
    }
}

// Global function to initialize custom editor
function initCustomEditor(containerId, options = {}) {
    return new CustomEditor(containerId, options);
}

// Auto-initialize custom editor when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Look for textareas with rich-text class and replace with custom editor
    const richTextAreas = document.querySelectorAll('textarea.rich-text');
    
    richTextAreas.forEach(function(textarea, index) {
        // Check if custom editor is already initialized for this textarea
        const existingEditor = textarea.parentNode.querySelector('.custom-editor-container');
        if (existingEditor) {
            return; // Already initialized
        }

        // Create container for custom editor
        const editorContainer = document.createElement('div');
        editorContainer.id = 'custom-editor-' + index;
        editorContainer.className = 'custom-editor-container';

        // Replace textarea with custom editor container
        textarea.parentNode.insertBefore(editorContainer, textarea);
        textarea.style.display = 'none';

        // Initialize custom editor
        const customEditor = initCustomEditor('custom-editor-' + index, {
            height: '400px',
            placeholder: ''
        });

        // Update form submission to include custom editor content
        const form = textarea.closest('form');
        if (form) {
            form.addEventListener('submit', function(e) {
                textarea.value = customEditor.getHTML();
            });
        }
    });
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomEditor;
}

/**
 * Quill Editor Configuration and Initialization
 * Custom rich text editor for page content
 */

// Note: Quill has built-in HTML sanitization for security
// We'll use a dual-mode approach: Quill for rich text, pure HTML textarea for unrestricted HTML

class QuillEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.quill = null;
        this.options = this.getDefaultOptions(options);
        this.wordCountElement = null;
        this.init();
    }

    getDefaultOptions(customOptions) {
        const defaultOptions = {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'font': [] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'direction': 'rtl' }],
                    [{ 'align': [] }],
                    ['blockquote', 'code-block'],
                    ['link', 'image', 'video'],
                    ['clean', 'paste-word']
                ],
                clipboard: {
                    matchVisual: false,
                    // Allow all HTML elements and attributes
                    matchers: []
                },
                history: {
                    delay: 2000,
                    maxStack: 500,
                    userOnly: true
                },
            },
            placeholder: 'Enter your page content here...',
            readOnly: false,
            // Disable HTML sanitization
            formats: [
                'header', 'font', 'size',
                'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
                'script',
                'list', 'bullet',
                'indent',
                'link', 'image', 'video',
                'color', 'background',
                'align', 'direction',
                'clean'
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
            // Create Quill instance
            this.quill = new Quill(this.container, this.options);
            
            // Override clipboard to allow all HTML elements
            this.quill.clipboard.addMatcher('*', (node, delta) => {
                // Return the delta as-is, allowing all HTML elements and attributes
                return delta;
            });
            

            

            
            // Add word count functionality
            this.addWordCount();
            
            // Add custom event listeners
            this.addEventListeners();
            
            // Add custom view source button to toolbar
            this.addViewSourceButton();
            
            // Initialize with existing content if any
            this.initializeContent();
            
            console.log('Quill editor initialized successfully');
        } catch (error) {
            console.error('Error initializing Quill editor:', error);
        }
    }

    addWordCount() {
        // Create word count element
        this.wordCountElement = document.createElement('div');
        this.wordCountElement.className = 'ql-word-count';
        this.wordCountElement.textContent = '0 words';
        
        // Insert after the editor
        this.container.parentNode.insertBefore(this.wordCountElement, this.container.nextSibling);
        
        // Update word count on text change
        this.quill.on('text-change', () => {
            this.updateWordCount();
        });
    }

    updateWordCount() {
        const text = this.quill.getText().trim();
        const wordCount = text ? text.split(/\s+/).length : 0;
        const charCount = text.length;
        
        this.wordCountElement.textContent = `${wordCount} words, ${charCount} characters`;
    }

    addEventListeners() {
        // Handle image upload
        this.quill.getModule('toolbar').addHandler('image', () => {
            this.selectLocalImage();
        });

        // Handle link insertion
        this.quill.getModule('toolbar').addHandler('link', () => {
            this.selectLink();
        });

        // Handle paste from Word
        this.quill.getModule('toolbar').addHandler('paste-word', () => {
            this.pasteFromWord();
        });

        // Auto-save functionality (optional)
        let saveTimeout;
        this.quill.on('text-change', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.autoSave();
            }, 3000); // Auto-save after 3 seconds of inactivity
        });
    }

    addViewSourceButton() {
        // Create custom view source button
        const toolbar = this.quill.getModule('toolbar');
        const toolbarElement = toolbar.container;
        
        // Create button element
        const viewSourceBtn = document.createElement('button');
        viewSourceBtn.type = 'button';
        viewSourceBtn.className = 'ql-view-source';
        viewSourceBtn.setAttribute('data-value', 'view-source');
        viewSourceBtn.innerHTML = 'HTML';
        viewSourceBtn.title = 'View Source (Unrestricted HTML)';
        
        // Add click event
        viewSourceBtn.addEventListener('click', () => {
            this.toggleSourceView();
        });
        
        // Add to toolbar
        const formatsContainer = toolbarElement.querySelector('.ql-formats');
        if (formatsContainer) {
            formatsContainer.appendChild(viewSourceBtn);
        } else {
            // If no formats container, add to the end of toolbar
            toolbarElement.appendChild(viewSourceBtn);
        }
    }



    toggleSourceView() {
        const editorContainer = this.container.parentNode;
        const sourceTextarea = document.getElementById('sourceTextarea');
        const viewSourceBtn = document.querySelector('.ql-view-source');
        
        if (sourceTextarea) {
            // Switch back to rich text view
            const htmlContent = this.rawHtmlContent || sourceTextarea.value;
            sourceTextarea.remove();
            this.container.style.display = 'block';
            this.wordCountElement.style.display = 'block';
            
            // Set the HTML content directly to preserve all elements
            this.setRawHTML(htmlContent);
            
            // Update toolbar button state
            if (viewSourceBtn) {
                viewSourceBtn.classList.remove('ql-active');
                viewSourceBtn.innerHTML = 'HTML';
                viewSourceBtn.title = 'View Source';
            }
        } else {
            // Switch to source view
            const html = this.rawHtmlContent || this.getHTML();
            
            // Create source textarea
            const textarea = document.createElement('textarea');
            textarea.id = 'sourceTextarea';
            textarea.className = 'form-control';
            textarea.style.height = '600px';
            textarea.style.fontFamily = 'monospace';
            textarea.style.fontSize = '12px';
            textarea.style.backgroundColor = '#f8f9fa';
            textarea.style.border = '1px solid #dee2e6';
            textarea.style.borderRadius = '4px';
            textarea.style.padding = '12px';
            textarea.value = html;
            
            // Insert textarea before the editor
            editorContainer.insertBefore(textarea, this.container);
            
            // Hide rich text editor
            this.container.style.display = 'none';
            this.wordCountElement.style.display = 'none';
            
            // Update toolbar button state
            if (viewSourceBtn) {
                viewSourceBtn.classList.add('ql-active');
                viewSourceBtn.innerHTML = 'Rich';
                viewSourceBtn.title = 'View Rich Text Editor';
            }
            
            // Add event listener to sync changes back to Quill
            textarea.addEventListener('input', () => {
                // Store the raw HTML content for later use
                this.rawHtmlContent = textarea.value;
            });
            
            // Handle paste events to allow direct HTML pasting
            textarea.addEventListener('paste', (e) => {
                // Allow the default paste behavior (no sanitization)
                // The input event will handle syncing back to Quill
            });
            
            // Focus the textarea
            textarea.focus();
            
            // Show helpful message
            console.log('HTML Source Mode: You can now paste any HTML content without restrictions.');
        }
    }

    selectLocalImage() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                this.uploadImage(file);
            }
        };
    }

    uploadImage(file) {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('image', file);
        
        // Get page key from the form or URL
        const pageKey = this.getPageKey();
        console.log('Uploading image for page key:', pageKey);
        if (pageKey) {
            formData.append('pageKey', pageKey);
        } else {
            console.error('No page key found, cannot upload image');
            this.showError('Cannot upload image: Page key not found');
            return;
        }

        // Show loading indicator
        const range = this.quill.getSelection();
        const loadingPlaceholder = 'Uploading image...';
        this.quill.insertText(range.index, loadingPlaceholder);

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
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove loading placeholder and insert image
                this.quill.deleteText(range.index, loadingPlaceholder.length);
                this.quill.insertEmbed(range.index, 'image', data.url);
                this.quill.setSelection(range.index + 1);
            } else {
                // Remove loading placeholder and show error
                this.quill.deleteText(range.index, loadingPlaceholder.length);
                this.showError('Failed to upload image: ' + data.message);
            }
        })
        .catch(error => {
            // Remove loading placeholder and show error
            this.quill.deleteText(range.index, loadingPlaceholder.length);
            this.showError('Failed to upload image: ' + error.message);
        });
    }

    getPageKey() {
        // Try to get page key from form data
        const form = document.querySelector('form');
        if (form) {
            const keyInput = form.querySelector('input[name="key"]');
            if (keyInput && keyInput.value) {
                console.log('Found page key from form input:', keyInput.value);
                return keyInput.value;
            }
        }
        
        // Try to get from URL
        const urlParts = window.location.pathname.split('/');
        const editIndex = urlParts.indexOf('edit');
        if (editIndex > 0 && urlParts[editIndex - 1]) {
            console.log('Found page key from URL:', urlParts[editIndex - 1]);
            return urlParts[editIndex - 1];
        }
        
        // Try to get from data attribute on form
        if (form && form.dataset.pageKey) {
            console.log('Found page key from form data attribute:', form.dataset.pageKey);
            return form.dataset.pageKey;
        }
        
        // Try to get from any element with data-page-key attribute
        const pageKeyElement = document.querySelector('[data-page-key]');
        if (pageKeyElement && pageKeyElement.dataset.pageKey) {
            console.log('Found page key from data attribute:', pageKeyElement.dataset.pageKey);
            return pageKeyElement.dataset.pageKey;
        }
        
        console.error('Could not find page key from any source');
        return null;
    }

    selectLink() {
        const url = prompt('Enter URL:');
        if (url) {
            const range = this.quill.getSelection();
            if (range) {
                this.quill.format('link', url);
            }
        }
    }

    pasteFromWord() {
        // Create a temporary textarea to get clean text from clipboard
        const textarea = document.createElement('textarea');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        
        // Focus the textarea and paste
        textarea.focus();
        document.execCommand('paste');
        
        // Get the text content (this strips most formatting)
        const text = textarea.value;
        
        // Remove the temporary textarea
        document.body.removeChild(textarea);
        
        if (text) {
            // Insert the clean text at the current cursor position
            const range = this.quill.getSelection();
            if (range) {
                this.quill.insertText(range.index, text, 'user');
                this.quill.setSelection(range.index + text.length, 0, 'user');
            } else {
                // If no selection, append to the end
                this.quill.insertText(this.quill.getLength(), text, 'user');
            }
        }
    }

    autoSave() {
        // This is a placeholder for auto-save functionality
        // You can implement this to save content to a temporary storage
        const content = this.getHTML();
        localStorage.setItem('quill_auto_save_' + this.containerId, content);
    }

    initializeContent() {
        // Check if there's existing content in the textarea
        const textarea = document.querySelector(`textarea[name="content"]`);
        if (textarea && textarea.value) {
            // Store the raw HTML content
            this.rawHtmlContent = textarea.value;
            // Use setRawHTML to bypass any sanitization
            this.setRawHTML(textarea.value);
        }
    }

    getHTML() {
        // Return the raw HTML content if available, otherwise return Quill's content
        return this.rawHtmlContent || this.quill.root.innerHTML;
    }

    getText() {
        return this.quill.getText();
    }

    setHTML(html) {
        // Set HTML content directly without Quill's sanitization
        this.quill.root.innerHTML = html;
        this.updateWordCount();
    }
    
    setRawHTML(html) {
        // Store the raw HTML for form submission
        this.rawHtmlContent = html;
        
        // Instead of trying to set HTML in Quill (which sanitizes it),
        // we'll show a preview message in the Rich Text mode
        const previewHtml = `
            <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 10px 0;">
                <h4 style="color: #495057; margin-top: 0;">HTML Content Preview</h4>
                <p style="color: #6c757d; margin-bottom: 10px;">
                    This content contains custom HTML that cannot be displayed in Rich Text mode.
                    The HTML content is preserved and will be saved correctly.
                </p>
                <div style="background: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
                    ${html.substring(0, 200)}${html.length > 200 ? '...' : ''}
                </div>
                <p style="color: #6c757d; font-size: 12px; margin-top: 10px;">
                    <strong>Content length:</strong> ${html.length} characters
                </p>
            </div>
        `;
        
        // Set the preview in Quill
        this.quill.root.innerHTML = previewHtml;
        
        // Update word count
        this.updateWordCount();
    }

    setText(text) {
        this.quill.setText(text);
        this.updateWordCount();
    }

    enable() {
        this.quill.enable();
    }

    disable() {
        this.quill.disable();
    }

    focus() {
        this.quill.focus();
    }

    showError(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.innerHTML = `
            <i class="fa fa-exclamation-triangle"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert before the editor
        this.container.parentNode.insertBefore(errorDiv, this.container);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    destroy() {
        if (this.quill) {
            this.quill = null;
        }
        if (this.wordCountElement && this.wordCountElement.parentNode) {
            this.wordCountElement.parentNode.removeChild(this.wordCountElement);
        }
    }
}

// Global function to initialize Quill editor
function initQuillEditor(containerId, options = {}) {
    return new QuillEditor(containerId, options);
}

// Auto-initialize Quill editor when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if Quill is loaded
    if (typeof Quill === 'undefined') {
        console.error('Quill library not loaded. Please include quill.min.js before this file.');
        return;
    }

    // Look for content textarea and replace with Quill
    const contentTextarea = document.querySelector('textarea[name="content"]');
    if (contentTextarea) {
        // Check if Quill is already initialized
        const existingQuill = document.querySelector('#quill-editor');
        if (existingQuill && existingQuill.classList.contains('ql-container')) {
            // Quill is already initialized, just set up form submission
            const form = contentTextarea.closest('form');
            if (form) {
                form.addEventListener('submit', function(e) {
                    // Check if we're in source view
                    const sourceTextarea = document.getElementById('sourceTextarea');
                    if (sourceTextarea && sourceTextarea.style.display !== 'none') {
                        // Use the source textarea content (raw HTML)
                        contentTextarea.value = sourceTextarea.value;
                    } else {
                        // Get the Quill instance
                        const quillInstance = existingQuill.__quill;
                        if (quillInstance) {
                            // Use stored raw HTML if available
                            const rawHtml = quillInstance.rawHtmlContent;
                            contentTextarea.value = rawHtml || quillInstance.root.innerHTML;
                        }
                    }
                });
            }
            return;
        }
        
        // Create container for Quill
        const quillContainer = document.createElement('div');
        quillContainer.id = 'quill-editor';
        quillContainer.style.height = '600px';
        
        // Replace textarea with Quill container
        contentTextarea.parentNode.insertBefore(quillContainer, contentTextarea);
        contentTextarea.style.display = 'none';
        
        // Initialize Quill editor
        const quillEditor = initQuillEditor('quill-editor', {
            placeholder: 'Enter your page content here... You can use the toolbar above to format your text, add links, images, and more.'
        });
        
        // Update form submission to include Quill content
        const form = contentTextarea.closest('form');
        if (form) {
            form.addEventListener('submit', function(e) {
                // Check if we're in source view
                const sourceTextarea = document.getElementById('sourceTextarea');
                if (sourceTextarea && sourceTextarea.style.display !== 'none') {
                    // Use the source textarea content (raw HTML)
                    contentTextarea.value = sourceTextarea.value;
                } else {
                    // Use the stored raw HTML content if available, otherwise use Quill content
                    contentTextarea.value = quillEditor.rawHtmlContent || quillEditor.getHTML();
                }
            });
        }
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuillEditor;
} 
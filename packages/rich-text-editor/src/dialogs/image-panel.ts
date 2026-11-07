// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/image-panel.ts
 */
import { RichTextEditorCore } from '../core';
import { RTE_Z_NOTIFICATION } from '../z-index';

Object.assign(
  RichTextEditorCore.prototype,
  {

        createImagePanel() {
            this.imagePanel = document.createElement('div');
            this.imagePanel.className = 'rte-image-panel';
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
                border: 1px solid var(--rte-accent);
                background: var(--rte-accent);
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
        },

        switchImageSource(source) {
            const pageImagesBtn = this.imagePanel.querySelector('.image-source-btn:nth-child(1)');
            const publicImagesBtn = this.imagePanel.querySelector('.image-source-btn:nth-child(2)');
    
            if (source === 'page') {
                pageImagesBtn.classList.add('active');
                pageImagesBtn.style.background = 'var(--rte-accent)';
                pageImagesBtn.style.borderColor = 'var(--rte-accent)';
                publicImagesBtn.classList.remove('active');
                publicImagesBtn.style.background = '#6c757d';
                publicImagesBtn.style.borderColor = '#6c757d';
                this.loadCurrentPageImages();
            } else {
                publicImagesBtn.classList.add('active');
                publicImagesBtn.style.background = 'var(--rte-accent)';
                publicImagesBtn.style.borderColor = 'var(--rte-accent)';
                pageImagesBtn.classList.remove('active');
                pageImagesBtn.style.background = '#6c757d';
                pageImagesBtn.style.borderColor = '#6c757d';
                this.loadPublicImages();
            }
        },

        loadCurrentPageImages() {
            const imagesContainer = this.imagePanel && this.imagePanel.querySelector('.images-container');
            if (!imagesContainer) return;
            this.showLoading(imagesContainer);
            this.fileManagerList('page')
                .then((files) => this.displayImages(files, 'page'))
                .catch((error) => {
                    console.error('Error loading images:', error);
                    this.showPanelError(imagesContainer, 'Failed to load images');
                });
        },

        loadPublicImages() {
            const imagesContainer = this.imagePanel && this.imagePanel.querySelector('.images-container');
            if (!imagesContainer) return;
            this.showLoading(imagesContainer);
            this.fileManagerList('public')
                .then((files) => this.displayImages(files, 'public'))
                .catch((error) => {
                    console.error('Error loading public images:', error);
                    this.showPanelError(imagesContainer, 'Failed to load images');
                });
        },

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
        },

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
        },
        showLoading(container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #6c757d; padding: 20px;">
                    Loading images...
                </div>
            `;
        },

        showPanelError(container, message) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #dc3545; padding: 20px;">
                    ${message}
                </div>
            `;
        },

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
                z-index: ${RTE_Z_NOTIFICATION};
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
        },
  } as any
);

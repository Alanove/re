// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/image-insert.ts
 */
import { RichTextEditorCore } from '../core';
import { buildImgHtml, sanitizeUrl } from '../url-sanitize';

Object.assign(
  RichTextEditorCore.prototype,
  {

        _imageAlignStyle(align) {
            if (align === 'left') {
                return 'float: left; margin-right: 10px;';
            }
            if (align === 'right') {
                return 'float: right; margin-left: 10px;';
            }
            if (align === 'center') {
                return 'display: block; margin: 0 auto;';
            }
            return '';
        },

        _applyImageAlign(imgElement, align) {
            if (!imgElement) return;
            if (align === 'left') {
                imgElement.style.float = 'left';
                imgElement.style.marginRight = '10px';
                imgElement.style.marginLeft = '';
                imgElement.style.display = '';
                imgElement.style.margin = '';
            } else if (align === 'right') {
                imgElement.style.float = 'right';
                imgElement.style.marginLeft = '10px';
                imgElement.style.marginRight = '';
                imgElement.style.display = '';
                imgElement.style.margin = '';
            } else if (align === 'center') {
                imgElement.style.display = 'block';
                imgElement.style.margin = '0 auto';
                imgElement.style.float = '';
            } else if (align) {
                imgElement.style.float = '';
                imgElement.style.margin = '';
                imgElement.style.display = '';
            }
        },

        insertImageFromPanel(imageUrl) {
            const safeSrc = sanitizeUrl(imageUrl, 'src');
            if (!safeSrc) {
                return;
            }
            if (this.currentMode === 'source') {
                const imgTag = buildImgHtml({
                    src: safeSrc,
                    style: 'max-width: 100%; height: auto;',
                });
                if (!imgTag) return;
                const cursorPos = this.sourceEditor.selectionStart;
                const textBefore = this.sourceEditor.value.substring(0, cursorPos);
                const textAfter = this.sourceEditor.value.substring(cursorPos);
                this.sourceEditor.value = textBefore + imgTag + textAfter;
                const newPos = cursorPos + imgTag.length;
                this.sourceEditor.setSelectionRange(newPos, newPos);
                this.sourceEditor.focus();
            } else {
                const img = document.createElement('img');
                img.src = safeSrc;
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
        },

        insertImageFromModalCard(imageUrl) {
            this.richTextEditor.focus();
            const imgTag = buildImgHtml({
                src: imageUrl,
                style: 'max-width: 100%; height: auto;',
            });
            if (!imgTag) {
                return;
            }
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (this.richTextEditor.contains(range.commonAncestorContainer)) {
                    document.execCommand('insertHTML', false, imgTag);
                } else {
                    this.richTextEditor.insertAdjacentHTML('beforeend', imgTag);
                }
            } else {
                this.richTextEditor.insertAdjacentHTML('beforeend', imgTag);
            }
            this.content = this.richTextEditor.innerHTML;
            this.updateWordCount();
        },

        insertImageFromModal(url, alt, className, width, height, align, savedRange) {
            try {
                const style = this._imageAlignStyle(align);
                const imgTag = buildImgHtml({
                    src: url,
                    alt,
                    className,
                    width,
                    height,
                    style: style || undefined,
                });
                if (!imgTag) {
                    return;
                }
                const safeSrc = sanitizeUrl(url, 'src');

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
                    const imgElement = document.createElement('img');
                    imgElement.src = safeSrc;
                    if (alt) imgElement.alt = alt;
                    if (className) imgElement.className = className;
                    if (width) imgElement.width = width;
                    if (height) imgElement.height = height;
                    this._applyImageAlign(imgElement, align);

                    rangeToUse.deleteContents();
                    rangeToUse.insertNode(imgElement);
                    rangeToUse.setStartAfter(imgElement);
                    rangeToUse.insertNode(document.createTextNode('\u00A0'));
                    selection.removeAllRanges();
                    selection.addRange(rangeToUse);
                }
            } catch (error) {
                console.error('Error inserting image:', error);
                const safeSrc = sanitizeUrl(url, 'src');
                if (!safeSrc) return;
                const imgElement = document.createElement('img');
                imgElement.src = safeSrc;
                if (alt) imgElement.alt = alt;
                if (className) imgElement.className = className;
                if (width) imgElement.width = width;
                if (height) imgElement.height = height;
                this._applyImageAlign(imgElement, align);
                this.richTextEditor.appendChild(imgElement);
                this.richTextEditor.appendChild(document.createTextNode('\u00A0'));
            }
        },

        updateImageInEditor(existingImage, url, alt, className, width, height, align) {
            this.richTextEditor.focus();
            const safeSrc = sanitizeUrl(url, 'src');
            if (!safeSrc) {
                return;
            }
            if (existingImage && existingImage.parentNode) {
                existingImage.src = safeSrc;
                if (alt) existingImage.alt = alt;
                existingImage.className = className || '';
                if (width) existingImage.width = width;
                if (height) existingImage.height = height;
    
                this._applyImageAlign(existingImage, align || 'default');
            }
            this.content = this.richTextEditor.innerHTML;
            this.updateWordCount();
        },

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
        },

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
        },

        uploadImage(file, modal, savedRange, editMode = false, existingImage = null) {
            const uploadButton = modal.querySelector('.upload-button');
            const uploadStatus = modal.querySelector('.upload-status');
            const originalText = uploadButton ? uploadButton.textContent : 'Upload';
            if (uploadButton) {
                uploadButton.textContent = 'Uploading...';
                uploadButton.disabled = true;
            }
            if (uploadStatus) {
                uploadStatus.style.display = 'block';
                uploadStatus.style.color = '#856404';
                uploadStatus.textContent = 'Uploading...';
            }

            this.fileManagerUpload(file)
                .then((mapped) => {
                    let imageUrl = (mapped && mapped.url) || '';
                    if (imageUrl) {
                        imageUrl = imageUrl.replace(/\\/g, '/');
                        if (!imageUrl.startsWith('/') && !/^https?:/i.test(imageUrl)) {
                            imageUrl = '/' + imageUrl;
                        }
                    }
                    const urlInput = modal.querySelector('#imageUrl');
                    if (urlInput) {
                        urlInput.value = imageUrl;
                    }
                    const imagesContainer = modal.querySelector('.rte-image-modal-grid');
                    const toggles = modal.querySelectorAll('.rte-image-source-toggle');
                    if (imagesContainer && toggles.length === 2) {
                        this.switchImageSourceInModal('page', imagesContainer, toggles[0], toggles[1]);
                    } else if (imagesContainer) {
                        this.loadImagesInModal(imagesContainer, 'page');
                    }
                    if (uploadStatus) {
                        uploadStatus.style.color = '#155724';
                        uploadStatus.textContent = imageUrl
                            ? 'Upload successful. URL filled — click Insert Image to place it.'
                            : 'Upload successful.';
                    }
                    if (uploadButton) {
                        uploadButton.textContent = originalText;
                        uploadButton.disabled = false;
                    }
                })
                .catch((error) => {
                    console.error('Upload failed:', error);
                    const message = 'Failed to upload image: ' + (error.message || error);
                    if (uploadStatus) {
                        uploadStatus.style.display = 'block';
                        uploadStatus.style.color = '#dc3545';
                        uploadStatus.textContent = message;
                    }
                    this.showError(message);
                    if (uploadButton) {
                        uploadButton.textContent = originalText;
                        uploadButton.disabled = false;
                    }
                });
        }
  } as any
);

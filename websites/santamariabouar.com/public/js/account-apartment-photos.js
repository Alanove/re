(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initPhotoManagement() {
    var widget = document.getElementById('photoUploadWidget');
    if (!widget) return;

    var input = document.getElementById('photos');
    var progressWrap = document.getElementById('photoUploadProgress');
    var progressBar = document.getElementById('photoUploadProgressBar');
    var progressText = document.getElementById('photoUploadProgressText');
    var progressPct = document.getElementById('photoUploadProgressPct');
    var statusEl = document.getElementById('photoUploadStatus');
    var grid = document.querySelector('.account-photo-grid');
    var modalEl = document.getElementById('removePhotoModal');
    var confirmBtn = document.getElementById('confirmRemovePhotoBtn');
    var removeSpinner = document.getElementById('removePhotoSpinner');
    var removeLabel = confirmBtn
      ? confirmBtn.querySelector('.account-remove-photo-label')
      : null;
    var setDefaultModalEl = document.getElementById('setDefaultPhotoModal');
    var confirmSetDefaultBtn = document.getElementById('confirmSetDefaultPhotoBtn');
    var setDefaultSpinner = document.getElementById('setDefaultPhotoSpinner');
    var setDefaultLabel = confirmSetDefaultBtn
      ? confirmSetDefaultBtn.querySelector('.account-set-default-label')
      : null;

    var apartmentId = widget.dataset.apartmentId;
    var uploadUrl = widget.dataset.uploadUrl;
    var deleteUrl = widget.dataset.deleteUrl;
    var setDefaultUrl = widget.dataset.setDefaultUrl;
    var maxBytes = parseInt(widget.dataset.maxBytes, 10);
    var maxMb = widget.dataset.maxMb;
    var uploading = false;
    var pendingDeleteFilename = null;
    var pendingDeleteFigure = null;
    var pendingDefaultFilename = null;
    var pendingDefaultFigure = null;
    var removing = false;
    var settingDefault = false;
    var removeModal =
      modalEl && window.bootstrap ? new bootstrap.Modal(modalEl) : null;
    var setDefaultModal =
      setDefaultModalEl && window.bootstrap ? new bootstrap.Modal(setDefaultModalEl) : null;

    function setStatus(message, type) {
      statusEl.textContent = message;
      statusEl.className = 'account-upload-status account-upload-status--' + (type || 'info');
      statusEl.hidden = !message;
    }

    function setProgress(percent, label) {
      var pct = Math.max(0, Math.min(100, Math.round(percent)));
      var track = progressBar.parentElement;
      progressWrap.hidden = false;
      progressBar.style.width = pct + '%';
      if (track) {
        track.setAttribute('aria-valuenow', String(pct));
      }
      progressPct.textContent = pct + '%';
      progressText.textContent = label || (pct >= 100 ? 'Processing…' : 'Uploading…');
    }

    function hideProgress() {
      progressWrap.hidden = true;
      progressBar.style.width = '0%';
      progressPct.textContent = '0%';
    }

    function buildPhotoFigure(filename, pending) {
      var figure = document.createElement('figure');
      figure.dataset.filename = filename;
      if (pending) {
        figure.className = 'is-pending';
      }
      figure.innerHTML =
        '<img src="/images/apartments/' +
        apartmentId +
        '/' +
        encodeURIComponent(filename) +
        '?t=' +
        Date.now() +
        '" alt="" />' +
        (pending ? '<figcaption>Pending approval</figcaption>' : '') +
        (pending
          ? ''
          : '<button type="button" class="account-photo-set-default" data-filename="' +
            escapeHtml(filename) +
            '" aria-label="Set as default photo" title="Set as default"><i class="bi bi-star"></i></button>') +
        '<button type="button" class="account-photo-remove" data-filename="' +
        escapeHtml(filename) +
        '" aria-label="Remove photo"><i class="bi bi-x-lg"></i></button>';
      return figure;
    }

    function ensureSetDefaultButton(figure, filename) {
      if (!figure || figure.classList.contains('is-pending') || figure.classList.contains('is-default')) {
        return;
      }
      if (figure.querySelector('.account-photo-set-default')) {
        return;
      }
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'account-photo-set-default';
      button.dataset.filename = filename;
      button.setAttribute('aria-label', 'Set as default photo');
      button.title = 'Set as default';
      button.innerHTML = '<i class="bi bi-star"></i>';
      var removeBtn = figure.querySelector('.account-photo-remove');
      if (removeBtn) {
        figure.insertBefore(button, removeBtn);
      } else {
        figure.appendChild(button);
      }
    }

    function markFigureAsDefault(figure) {
      if (!figure) return;
      figure.classList.add('is-default');
      var setDefaultBtn = figure.querySelector('.account-photo-set-default');
      if (setDefaultBtn) {
        setDefaultBtn.remove();
      }
      var caption = figure.querySelector('figcaption');
      if (caption) {
        caption.textContent = 'Default';
      } else {
        caption = document.createElement('figcaption');
        caption.textContent = 'Default';
        figure.appendChild(caption);
      }
      var img = figure.querySelector('img');
      if (img) {
        img.alt = 'Default photo';
      }
    }

    function clearFigureDefault(figure) {
      if (!figure) return;
      figure.classList.remove('is-default');
      var caption = figure.querySelector('figcaption');
      if (caption) {
        caption.remove();
      }
      var img = figure.querySelector('img');
      if (img) {
        img.alt = '';
      }
      ensureSetDefaultButton(figure, figure.dataset.filename || '');
    }

    function appendPendingPhotos(filenames) {
      if (!grid || !filenames.length) return;
      filenames.forEach(function (filename) {
        grid.appendChild(buildPhotoFigure(filename, true));
      });
    }

    function validateFiles(fileList) {
      var invalid = [];
      for (var i = 0; i < fileList.length; i++) {
        var file = fileList[i];
        if (!file.type.startsWith('image/')) {
          invalid.push('"' + file.name + '" is not an image.');
        } else if (file.size > maxBytes) {
          invalid.push('"' + file.name + '" exceeds ' + maxMb + ' MB.');
        }
      }
      return invalid;
    }

    function uploadFiles(fileList) {
      if (uploading || !fileList.length) return;

      var errors = validateFiles(fileList);
      if (errors.length) {
        setStatus(errors.join(' '), 'error');
        input.value = '';
        return;
      }

      uploading = true;
      input.disabled = true;
      setStatus('', 'info');
      setProgress(0, 'Uploading…');

      var formData = new FormData();
      for (var i = 0; i < fileList.length; i++) {
        formData.append('photos', fileList[i]);
      }

      var xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      xhr.upload.addEventListener('progress', function (event) {
        if (!event.lengthComputable) return;
        var percent = (event.loaded / event.total) * 100;
        setProgress(percent, percent >= 100 ? 'Processing…' : 'Uploading…');
      });

      xhr.addEventListener('load', function () {
        uploading = false;
        input.disabled = false;
        input.value = '';
        hideProgress();

        var data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          setStatus('Upload failed. Please try again.', 'error');
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          appendPendingPhotos(data.filenames || []);
          setStatus(data.message || 'Photos uploaded.', 'success');
          return;
        }

        setStatus(data.message || 'Upload failed. Please try again.', 'error');
      });

      xhr.addEventListener('error', function () {
        uploading = false;
        input.disabled = false;
        input.value = '';
        hideProgress();
        setStatus('Network error. Please check your connection and try again.', 'error');
      });

      xhr.send(formData);
    }

    function setRemovingState(isRemoving) {
      removing = isRemoving;
      if (confirmBtn) {
        confirmBtn.disabled = isRemoving;
      }
      if (removeSpinner) {
        removeSpinner.classList.toggle('d-none', !isRemoving);
      }
      if (removeLabel) {
        removeLabel.textContent = isRemoving ? 'Removing…' : 'Remove';
      }
    }

    function openRemoveModal(filename, figure) {
      pendingDeleteFilename = filename;
      pendingDeleteFigure = figure;
      if (removeModal) {
        removeModal.show();
        return;
      }
      if (window.confirm('Are you sure you want to remove this photo? This cannot be undone.')) {
        deletePhoto();
      }
    }

    function resetRemoveModal() {
      pendingDeleteFilename = null;
      pendingDeleteFigure = null;
      setRemovingState(false);
    }

    function parseJsonResponse(response) {
      return response.text().then(function (text) {
        if (!text) {
          return { ok: response.ok, data: {} };
        }
        try {
          return { ok: response.ok, data: JSON.parse(text) };
        } catch (e) {
          return {
            ok: false,
            data: {
              success: false,
              message: response.ok
                ? 'Unexpected server response.'
                : 'Could not remove photo. Please try again.'
            }
          };
        }
      });
    }

    function deletePhoto() {
      if (!pendingDeleteFilename || removing || !deleteUrl) return;

      setRemovingState(true);
      var filename = pendingDeleteFilename;
      var figure = pendingDeleteFigure;

      fetch(deleteUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ filename: filename })
      })
        .then(parseJsonResponse)
        .then(function (result) {
          if (result.ok && result.data.success) {
            if (figure && figure.parentNode) {
              figure.parentNode.removeChild(figure);
            }
            setStatus(result.data.message || 'Photo removed.', 'success');
            if (removeModal) {
              removeModal.hide();
            }
            resetRemoveModal();
            return;
          }
          setRemovingState(false);
          setStatus(result.data.message || 'Could not remove photo.', 'error');
        })
        .catch(function () {
          setRemovingState(false);
          setStatus('Network error. Please try again.', 'error');
        });
    }

    function setSettingDefaultState(isSetting) {
      settingDefault = isSetting;
      if (confirmSetDefaultBtn) {
        confirmSetDefaultBtn.disabled = isSetting;
      }
      if (setDefaultSpinner) {
        setDefaultSpinner.classList.toggle('d-none', !isSetting);
      }
      if (setDefaultLabel) {
        setDefaultLabel.textContent = isSetting ? 'Saving…' : 'Set as default';
      }
    }

    function openSetDefaultModal(filename, figure) {
      pendingDefaultFilename = filename;
      pendingDefaultFigure = figure;
      if (setDefaultModal) {
        setDefaultModal.show();
        return;
      }
      if (window.confirm('Use this photo as the default image for your apartment listing?')) {
        setDefaultPhoto();
      }
    }

    function resetSetDefaultModal() {
      pendingDefaultFilename = null;
      pendingDefaultFigure = null;
      setSettingDefaultState(false);
    }

    function setDefaultPhoto() {
      if (!pendingDefaultFilename || settingDefault || !setDefaultUrl) return;

      setSettingDefaultState(true);
      var filename = pendingDefaultFilename;
      var figure = pendingDefaultFigure;

      fetch(setDefaultUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ filename: filename })
      })
        .then(parseJsonResponse)
        .then(function (result) {
          if (result.ok && result.data.success) {
            if (grid) {
              grid.querySelectorAll('figure.is-default').forEach(function (currentDefault) {
                if (currentDefault !== figure) {
                  clearFigureDefault(currentDefault);
                }
              });
            }
            if (figure) {
              markFigureAsDefault(figure);
              if (grid && figure.parentNode === grid && grid.firstElementChild !== figure) {
                grid.insertBefore(figure, grid.firstElementChild);
              }
            }
            setStatus(result.data.message || 'Default photo updated.', 'success');
            if (setDefaultModal) {
              setDefaultModal.hide();
            }
            resetSetDefaultModal();
            return;
          }
          setSettingDefaultState(false);
          setStatus(result.data.message || 'Could not set default photo.', 'error');
        })
        .catch(function () {
          setSettingDefaultState(false);
          setStatus('Network error. Please try again.', 'error');
        });
    }

    if (input) {
      input.addEventListener('change', function () {
        if (!input.files || !input.files.length) return;
        uploadFiles(Array.prototype.slice.call(input.files));
      });
    }

    if (grid) {
      grid.addEventListener('click', function (event) {
        var setDefaultButton = event.target.closest('.account-photo-set-default');
        if (setDefaultButton) {
          var defaultFigure = setDefaultButton.closest('figure');
          var defaultFilename = setDefaultButton.getAttribute('data-filename');
          if (defaultFilename) {
            openSetDefaultModal(defaultFilename, defaultFigure);
          }
          return;
        }

        var button = event.target.closest('.account-photo-remove');
        if (!button) return;
        var figure = button.closest('figure');
        var filename = button.getAttribute('data-filename');
        if (!filename) return;
        openRemoveModal(filename, figure);
      });
    }

    if (confirmSetDefaultBtn) {
      confirmSetDefaultBtn.addEventListener('click', setDefaultPhoto);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', deletePhoto);
    }

    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', function () {
        if (!removing) {
          resetRemoveModal();
        }
      });
    }

    if (setDefaultModalEl) {
      setDefaultModalEl.addEventListener('hidden.bs.modal', function () {
        if (!settingDefault) {
          resetSetDefaultModal();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhotoManagement);
  } else {
    initPhotoManagement();
  }
})();

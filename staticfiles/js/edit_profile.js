let cropper = null;
let currentCropType = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const profileInput = document.getElementById('profileUpload');
    const coverInput = document.getElementById('coverUpload');
    const profileCropImage = document.getElementById('profileCropImage');
    const coverCropImage = document.getElementById('coverCropImage');
    const coverImage = document.getElementById('coverImage');
    const profileImage = document.querySelector('.pd_image');

    // Debug: Check if elements exist
    console.log('Profile input:', profileInput);
    console.log('Cover input:', coverInput);
    console.log('Profile crop image:', profileCropImage);
    console.log('Cover crop image:', coverCropImage);

    // Open cropper in modal
    function openCropper(type, file) {
        currentCropType = type;
        const reader = new FileReader();
        
        reader.onload = function (e) {
            const image = type === 'profile' ? profileCropImage : coverCropImage;
            
            if (!image) {
                console.error(`${type} crop image element not found`);
                return;
            }
            
            image.src = e.target.result;

            // Destroy existing cropper
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }

            // Initialize cropper after image loads
            image.onload = function() {
                try {
                    cropper = new Cropper(image, {
                        aspectRatio: type === 'profile' ? 1 : 16 / 9,
                        viewMode: 1,
                        autoCropArea: 1,
                        responsive: true,
                        restore: false,
                        guides: true,
                        center: true,
                        highlight: false,
                        cropBoxMovable: true,
                        cropBoxResizable: true,
                        toggleDragModeOnDblclick: false,
                    });

                    // Show modal
                    const modalId = type === 'profile' ? 'profileCropModal' : 'coverCropModal';
                    const modalElement = document.getElementById(modalId);
                    
                    if (modalElement) {
                        const modal = new bootstrap.Modal(modalElement);
                        modal.show();
                    } else {
                        console.error(`Modal ${modalId} not found`);
                    }
                } catch (error) {
                    console.error('Error initializing cropper:', error);
                }
            };
        };
        
        reader.onerror = function(error) {
            console.error('FileReader error:', error);
        };
        
        reader.readAsDataURL(file);
    }

    // Crop and update image
    function cropImage(type) {
        if (!cropper) {
            console.error('Cropper not initialized');
            return;
        }

        try {
            const canvas = cropper.getCroppedCanvas({
                width: type === 'profile' ? 300 : 1200,
                height: type === 'profile' ? 300 : 675,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            if (!canvas) {
                console.error('Failed to create canvas');
                return;
            }

            // Update the display image immediately
            const croppedDataURL = canvas.toDataURL('image/jpeg', 0.9);
            
            if (type === 'profile' && profileImage) {
                profileImage.src = croppedDataURL;
            } else if (type === 'cover' && coverImage) {
                coverImage.src = croppedDataURL;
            }

            // Convert to blob and prepare for upload
            canvas.toBlob(function(blob) {
                if (!blob) {
                    console.error('Failed to create blob');
                    return;
                }

                // Create a new file from the blob
                const croppedFile = new File([blob], `cropped_${type}.jpg`, { 
                    type: "image/jpeg",
                    lastModified: Date.now()
                });

                // Create DataTransfer to update input files
                const dt = new DataTransfer();
                dt.items.add(croppedFile);
                
                if (type === 'profile' && profileInput) {
                    profileInput.files = dt.files;
                    console.log('Profile file updated:', profileInput.files[0]);
                } else if (type === 'cover' && coverInput) {
                    coverInput.files = dt.files;
                    console.log('Cover file updated:', coverInput.files[0]);
                }

                // Upload the image
                uploadImage(type, croppedFile);
                
            }, 'image/jpeg', 0.9);

            // Clean up and close modal
            cropper.destroy();
            cropper = null;
            
            const modalId = type === 'profile' ? 'profileCropModal' : 'coverCropModal';
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.hide();
                }
            }
        } catch (error) {
            console.error('Error cropping image:', error);
            showNotification('Error cropping image. Please try again.', 'error');
        }
    }

    // Upload image function
    function uploadImage(type, file) {
        const formData = new FormData();
        
        // Add the image file with the correct field name
        if (type === 'profile') {
            formData.append('profile_picture', file);
        } else if (type === 'cover') {
            formData.append('cover_picture', file);
        }

        // Get CSRF token - Try multiple methods
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                        document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ||
                        getCookie('csrftoken');
        
        if (csrfToken) {
            formData.append('csrfmiddlewaretoken', csrfToken);
        }

        // Get profile ID
        const profileId = document.querySelector('.profile_container')?.dataset.profileId || 
                        document.querySelector('[name="profile_id"]')?.value ||
                        getProfileIdFromUrl();
        
        if (!profileId) {
            console.error('Profile ID not found');
            showNotification('Profile ID not found. Please refresh the page.', 'error');
            return;
        }

        // Fix: Use relative URL and remove hardcoded localhost
        const uploadUrl = `http://127.0.0.1:8001/profile/profile/${profileId}/`;
        
        console.log(`Uploading ${type} image to:`, uploadUrl);
        console.log('CSRF Token:', csrfToken);

        // Show loading indicator
        showNotification(`Uploading ${type} image...`, 'info');

        // Prepare headers - Don't set Content-Type for FormData
        const headers = {
            'X-Requested-With': 'XMLHttpRequest',
        };

        // Add CSRF token to headers as well
        if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
        }

        // Try session-based authentication first
        fetch(uploadUrl, {
            method: 'PUT',
            body: formData,
            headers: headers,
            credentials: 'include' // Include cookies for session-based auth
        })
        .then(response => {
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Response body:', text);
                    throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log(`${type} image uploaded successfully:`, data);
            showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} image updated successfully!`, 'success');
            
            // Update the image source with the new URL if provided
            if (data.image_url) {
                if (type === 'profile' && profileImage) {
                    profileImage.src = data.image_url;
                } else if (type === 'cover' && coverImage) {
                    coverImage.src = data.image_url;
                }
            }
            
            // Refresh the page after successful upload to show updated image
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        })
        .catch(error => {
            console.error(`Error uploading ${type} image:`, error);
            
            // More specific error handling
            if (error.message.includes('401')) {
                showNotification('Authentication failed. Please log in again.', 'error');
                // Redirect to login page after a delay
                setTimeout(() => {
                    window.location.href = '/login/';
                }, 2000);
            } else if (error.message.includes('403')) {
                showNotification('You do not have permission to update this profile.', 'error');
            } else if (error.message.includes('405')) {
                // If PUT method not allowed, try PATCH
                retryWithPatch(type, file, uploadUrl, headers);
            } else {
                showNotification(`Failed to update ${type} image. Please try again.`, 'error');
            }
        });
    }

    // Retry upload with PATCH method if PUT fails
    function retryWithPatch(type, file, uploadUrl, headers) {
        console.log('Retrying with PATCH method...');
        
        const formData = new FormData();
        
        if (type === 'profile') {
            formData.append('profile_picture', file);
        } else if (type === 'cover') {
            formData.append('cover_picture', file);
        }

        const csrfToken = getCookie('csrftoken');
        if (csrfToken) {
            formData.append('csrfmiddlewaretoken', csrfToken);
            headers['X-CSRFToken'] = csrfToken;
        }

        fetch(uploadUrl, {
            method: 'PUT', // Use PATCH method
            body: formData,
            headers: headers,
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log(`${type} image uploaded successfully with PATCH:`, data);
            showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} image updated successfully!`, 'success');
            
            if (data.image_url) {
                if (type === 'profile' && profileImage) {
                    profileImage.src = data.image_url;
                } else if (type === 'cover' && coverImage) {
                    coverImage.src = data.image_url;
                }
            }
            
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        })
        .catch(error => {
            console.error(`Error uploading ${type} image with PATCH:`, error);
            showNotification(`Failed to update ${type} image. Please try again.`, 'error');
        });
    }

    // Helper function to get profile ID from URL
    function getProfileIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/profile\/profile\/(\d+)\//);
        return match ? match[1] : null;
    }

    // Helper function to get CSRF cookie
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Bind image input change events
    if (profileInput) {
        profileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                console.log('Profile file selected:', file);
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select a valid image file.');
                    e.target.value = ''; // Clear the input
                    return;
                }
                
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB.');
                    e.target.value = ''; // Clear the input
                    return;
                }
                
                openCropper('profile', file);
            }
        });
    } else {
        console.warn('Profile input not found');
    }

    if (coverInput) {
        coverInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                console.log('Cover file selected:', file);
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select a valid image file.');
                    e.target.value = ''; // Clear the input
                    return;
                }
                
                // Validate file size (max 10MB for cover)
                if (file.size > 10 * 1024 * 1024) {
                    alert('File size must be less than 10MB.');
                    e.target.value = ''; // Clear the input
                    return;
                }
                
                openCropper('cover', file);
            }
        });
    } else {
        console.warn('Cover input not found');
    }

    // Make cropImage function globally accessible
    window.cropImage = cropImage;
    
    // Also bind to the crop buttons directly
    document.addEventListener('click', function(e) {
        if (e.target.matches('[onclick*="cropImage"]')) {
            e.preventDefault();
            const type = e.target.getAttribute('onclick').includes('profile') ? 'profile' : 'cover';
            cropImage(type);
        }
    });

    // Handle info form submit
    const infoForm = document.getElementById('infoForm');
    if (infoForm) {
        infoForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const formData = new FormData(infoForm);

            // Get profile ID from the form or URL
            const profileId = document.querySelector('.profile_container')?.dataset.profileId ||
                            getProfileIdFromUrl();

            if (!profileId) {
                showNotification('Profile ID not found. Please refresh the page.', 'error');
                return;
            }

            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                            getCookie('csrftoken');
            
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken);
            }

            let headers = {
                'X-Requested-With': 'XMLHttpRequest',
            };

            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            fetch(`http://127.0.0.1:8001/profile/profile/${profileId}/`, {
                method: 'PUT',
                body: formData,
                headers: headers,
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                showNotification('Profile info updated successfully!', 'success');
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editInfoModal'));
                if (modal) modal.hide();
                
                // Update the display with new data
                if (data.username) {
                    const usernameElements = document.querySelectorAll('h3:first-child, p:first-child');
                    usernameElements.forEach(el => {
                        if (el.textContent.includes(data.username)) {
                            el.textContent = data.username;
                        }
                    });
                }
                
                // Optionally reload page after a delay
                setTimeout(() => location.reload(), 2000);
            })
            .catch(error => {
                console.error('Error updating profile:', error);
                
                if (error.message.includes('401')) {
                    showNotification('Authentication failed. Please log in again.', 'error');
                } else if (error.message.includes('403')) {
                    showNotification('You do not have permission to update this profile.', 'error');
                } else {
                    showNotification('Failed to update profile info. Please try again.', 'error');
                }
            });
        });
    }

    // Utility function to show notifications
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed custom-notification`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Intro field management functions
    window.addIntroField = function(button) {
        const input = button.previousElementSibling;
        const text = input.value.trim();
        
        if (!text) {
            alert('Please enter some text first');
            return;
        }

        const list = button.closest('.profile_intro').querySelector('.introFieldsList');
        const newItem = document.createElement('li');
        newItem.className = 'd-flex align-items-center mb-2';
        newItem.innerHTML = `
            <img src="images/profile-job.png" alt="Custom" class="me-2" />
            <span contenteditable="true" class="flex-grow-1">${text}</span>
            <button class="btn btn-sm ms-2" onclick="removeIntroField(this)" title="Delete">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        
        list.appendChild(newItem);
        input.value = '';
    };

    window.removeIntroField = function(button) {
        if (confirm('Are you sure you want to remove this field?')) {
            button.closest('li').remove();
        }
    };

    window.addNewIntroSection = function() {
        const container = document.getElementById('introContainer');
        const newSection = document.createElement('div');
        newSection.className = 'profile_intro border rounded p-3 mb-3';
        newSection.innerHTML = `
            <h3 contenteditable="true" class="mb-3">
                <i class="fas fa-user-edit edit-icon me-2"></i>New Section
            </h3>
            <ul class="introFieldsList list-unstyled"></ul>
            <div class="d-flex mt-3">
                <input type="text" class="form-control me-2 newFieldInput" placeholder="Add custom intro line..." />
                <button class="btn btn-outline-primary-art" onclick="addIntroField(this)" title="Add Field">
                    <i class="fas fa-plus-circle"></i>
                </button>
            </div>
        `;
        
        container.appendChild(newSection);
    };

    // Name editing functions
    window.enableEdit = function() {
        const display = document.getElementById("displayName");
        const input = document.getElementById("editNameInput");
        const nameText = document.getElementById("nameText");

        if (display && input && nameText) {
            input.value = nameText.textContent.trim();
            display.classList.add("d-none");
            input.classList.remove("d-none");
            input.focus();
        }
    };

    window.saveName = function() {
        const display = document.getElementById("displayName");
        const input = document.getElementById("editNameInput");
        const nameText = document.getElementById("nameText");

        if (display && input && nameText) {
            if (input.value.trim()) {
                nameText.textContent = input.value.trim();
            }

            display.classList.remove("d-none");
            input.classList.add("d-none");
        }
    };

    console.log('Profile script initialized successfully');
});

const introContainer = document.getElementById('introContainer');
const profileId = introContainer.dataset.profileId;
const accessToken = introContainer.dataset.accessToken;
const imageSrc = introContainer.dataset.imgSrc;

function updateIntroSectionTitle(el) {
  const sectionDiv = el.closest('.profile_intro');
  const sectionId = sectionDiv.dataset.sectionId;
  const displayOrder = sectionDiv.dataset.displayOrder;
  const newTitle = el.textContent.trim();

  fetch(`http://127.0.0.1:8001/profile/profile-fields-section/${sectionId}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      title: newTitle,
      display_order: parseInt(displayOrder, 10),
      description: ""
    })
  })
  .then(r => r.json())
  .then(d => {
    if (!d.status) alert('Failed to update section title');
  });
}

function addIntroField(btn) {
  const input = btn.previousElementSibling;
  const text = input.value.trim();
  if (!text) return alert('Please type a field first');

  const li = document.createElement('li');
  li.className = 'd-flex align-items-center mb-2';
  li.setAttribute('data-field-id', '');
  li.innerHTML = `
    <img src="${imageSrc}" alt="Custom" class="me-2" />
    <span contenteditable="true">${text}</span>
    <button class="btn btn-sm ms-2" onclick="removeIntroField(this)">
      <i class="fas fa-trash-alt"></i>
    </button>`;
  btn.closest('.profile_intro').querySelector('.introFieldsList').appendChild(li);
  input.value = '';
}

function removeIntroField(btn) {
  if (confirm('Delete this field?')) {
    const li = btn.closest('li');
    li.remove();
  }
}

function addNewIntroSection() {
  const title = prompt('New section title');
  if (!title) return;

  const payload = {
    section: {
      title: title,
      display_order: Date.now() % 10000,
      description: ""
    },
    fields: []
  };

  fetch(`http://127.0.0.1:8001/profile/profile-fields/${profileId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status) location.reload();
    else alert('Failed to add section');
  });
}

function saveFields(sectionDiv) {
  const sectionId = sectionDiv.dataset.sectionId;
  const displayOrder = sectionDiv.dataset.displayOrder;
  const sectionTitle = sectionDiv.querySelector('h3').textContent.trim();

  const fields = Array.from(sectionDiv.querySelectorAll('li')).map((li, i) => ({
    id: li.dataset.fieldId || null,
    field_type: 'text',
    field_name: li.querySelector('span').textContent.trim(),
    text_value: li.querySelector('span').textContent.trim(),
    display_order: i + 1
  }));

  const payload = {
    section: {
      title: sectionTitle,
      display_order: parseInt(displayOrder, 10),
      description: ""
    },
    fields
  };

  fetch(`http://127.0.0.1:8001/profile/profile-fields/${profileId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (!data.status) {
      console.error('Save fields error', data);
      alert('Error saving fields');
    } else {
      alert('Section saved successfully');
    }
  });
}

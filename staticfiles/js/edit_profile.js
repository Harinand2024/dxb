let cropper = null;
let currentCropType = null;
// let accessToken = profile_container.dataset.accessToken;
let accessToken = null; // Global access token placeholder

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const profileInput = document.getElementById('profileUpload');
    const coverInput = document.getElementById('coverUpload');
    const profileCropImage = document.getElementById('profileCropImage');
    const coverCropImage = document.getElementById('coverCropImage');
    const coverImage = document.getElementById('coverImage');
    const profileImage = document.querySelector('.pd_image');


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

        // Append file to form data
        if (type === 'profile') {
            formData.append('profile_picture', file);
        } else if (type === 'cover') {
            formData.append('cover_picture', file);
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

        // Get access token
        const accessToken = document.querySelector('.profile_container')?.dataset.accessToken;

        if (!accessToken) {
            console.error('Access token not found');
            showNotification('Access token missing. Please log in again.', 'error');
            return;
        }

        const uploadUrl = `http://127.0.0.1:8001/profile/profile/${profileId}/`;

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Requested-With': 'XMLHttpRequest'
        };

        showNotification(`Uploading ${type} image...`, 'info');

        fetch(uploadUrl, {
            method: 'PUT',
            body: formData,
            headers: headers
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Response body:', text);
                    throw new Error(`HTTP ${response.status}: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} image updated successfully!`, 'success');

            // Update the image preview
            if (data.image_url) {
                if (type === 'profile' && profileImage) {
                    profileImage.src = data.image_url;
                } else if (type === 'cover' && coverImage) {
                    coverImage.src = data.image_url;
                }
            }

            // Optional reload
            setTimeout(() => window.location.reload(), 1500);
        })
        .catch(error => {
            console.error(`Error uploading ${type} image:`, error);
            if (error.message.includes('401')) {
                showNotification('Authentication failed. Please log in again.', 'error');
                setTimeout(() => location.href = '/login/', 2000);
            } else if (error.message.includes('403')) {
                showNotification('You do not have permission to update this profile.', 'error');
            } else if (error.message.includes('405')) {
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

    // if (infoForm) {
    //     infoForm.addEventListener('submit', function (e) {
    //         e.preventDefault();
    //         const formData = new FormData(infoForm);

    //         const profileId = document.querySelector('.profile_container')?.dataset.profileId ||
    //                         getProfileIdFromUrl();

    //         if (!profileId) {
    //             showNotification('Profile ID not found. Please refresh the page.', 'error');
    //             return;
    //         }

    //         const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
    //                         getCookie('csrftoken');

    //         if (csrfToken) {
    //             formData.append('csrfmiddlewaretoken', csrfToken);
    //         }

    //         const headers = {
    //             'X-Requested-With': 'XMLHttpRequest',
    //             'Authorization': `Bearer ${accessToken}`
    //         };

    //         if (csrfToken) {
    //             headers['X-CSRFToken'] = csrfToken;
    //         }

    //         fetch(`http://127.0.0.1:8001/profile/profile/${profileId}/`, {
    //             method: 'PUT',
    //             body: formData,
    //             headers: {'Authorization': `Bearer ${accessToken}`,
    //             credentials: 'include'}
    //         })
    //         .then(response => {
    //             if (!response.ok) {
    //                 return response.text().then(text => {
    //                     throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    //                 });
    //             }
    //             return response.json();
    //         })
    //         .then(data => {
    //             showNotification('Profile info updated successfully!', 'success');

    //             const modal = bootstrap.Modal.getInstance(document.getElementById('editInfoModal'));
    //             if (modal) modal.hide();

    //             if (data.username) {
    //                 const usernameElements = document.querySelectorAll('h3:first-child, p:first-child');
    //                 usernameElements.forEach(el => {
    //                     if (el.textContent.includes(data.username)) {
    //                         el.textContent = data.username;
    //                     }
    //                 });
    //             }

    //             setTimeout(() => location.reload(), 2000);
    //         })
    //         .catch(error => {
    //             console.error('Error updating profile:', error);

    //             if (error.message.includes('401')) {
    //                 showNotification('Authentication failed. Please log in again.', 'error');
    //             } else if (error.message.includes('403')) {
    //                 showNotification('You do not have permission to update this profile.', 'error');
    //             } else {
    //                 showNotification('Failed to update profile info. Please try again.', 'error');
    //             }
    //         });
    //     });
    // }

    if (infoForm) {
    const infoForm = document.getElementById('infoForm');
    const profileContainer = document.querySelector('.profile_container');

    if (profileContainer) {
        accessToken = profileContainer.dataset.accessToken || '';
    }

    if (infoForm) {
        infoForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const formData = new FormData(infoForm);

            const profileId = profileContainer?.dataset.profileId || getProfileIdFromUrl();

            if (!profileId) {
                showNotification('Profile ID not found. Please refresh the page.', 'error');
                return;
            }

            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken);
            }

            const headers = {
                'X-Requested-With': 'XMLHttpRequest'
            };

            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            fetch(`http://127.0.0.1:8001/profile/profile/${profileId}/`, {
                method: 'PUT',
                body: formData,
                headers: headers,
                credentials: 'include' // Must be outside headers
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

                    const modal = bootstrap.Modal.getInstance(document.getElementById('editInfoModal'));
                    if (modal) modal.hide();

                    // Update username on UI immediately
                    if (data.username) {
                        document.querySelectorAll('[data-username-display]').forEach(el => {
                            el.textContent = data.username;
                        });
                    }

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

    window.addNewIntroSection = function() {
        const container = document.getElementById('introContainer');
        const newSection = document.createElement('div');
        newSection.className = 'profile_intro border rounded p-3 mb-3';

        // Generate a temporary display order
        const displayOrder = Date.now() % 10000;
        newSection.dataset.displayOrder = displayOrder;

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
            <div class="mt-3 text-end">
            <button class="btn btn-outline-primary-art btn-md w-100" onclick="saveFields(this.closest('.profile_intro'))">
                Save
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
const bccessToken = introContainer.dataset.accessToken;

// Updated JavaScript for Profile Intro Management


function updateIntroSectionTitle(el) {
  const sectionDiv = el.closest('.profile_intro');
  const sectionId = sectionDiv.dataset.sectionId;
  const displayOrder = parseInt(sectionDiv.dataset.displayOrder, 10) || Date.now() % 10000;
  const newTitle = el.textContent.trim();

  fetch(`http://127.0.0.1:8001/profile/profile-fields-section/${sectionId}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      title: newTitle,
      display_order: displayOrder,
      description: ""
    })
  }).then(r => r.json()).then(d => {
    if (!d.status) alert('Failed to update section title');
  });
}

function addIntroField(btn) {
  const input = btn.previousElementSibling;
  const text = input.value.trim();
  if (!text) return alert('Please enter a field value');

  const sectionDiv = btn.closest('.profile_intro');
  const sectionId = sectionDiv.dataset.sectionId;
  const sectionTitle = sectionDiv.querySelector('h3').textContent.trim();
  const displayOrder = parseInt(sectionDiv.dataset.displayOrder, 10) || Date.now() % 10000;
  const fieldList = sectionDiv.querySelectorAll('li');

  // Check for duplicate field
  const duplicate = Array.from(fieldList).some(li => 
    li.querySelector('span').textContent.trim().toLowerCase() === text.toLowerCase()
  );
  if (duplicate) return alert('This field already exists in the section');

  const payload = {
    section: {
      title: sectionTitle,
      display_order: displayOrder,
      description: ""
    },
    fields: [
      {
        field_type: 'text',
        field_name: text,
        text_value: text,
        display_order: fieldList.length + 1
      }
    ]
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
      console.error(data);
      alert('Error adding field');
    } else {
      location.reload();
    }
  });
}

function removeIntroField(btn) {
  if (!confirm('Delete this field?')) return;

  const li = btn.closest('li');
  const fieldId = li.dataset.fieldId;
  const introContainer = document.getElementById('introContainer');
  const profileId = introContainer.dataset.profileId;
  const accessToken = introContainer.dataset.accessToken;

  if (!fieldId) {
    // New unsaved field — just remove from UI
    li.remove();
    return;
  }

  // Send DELETE request
  fetch(`http://127.0.0.1:8001/profile/profile-fields/${profileId}/`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ ids: [parseInt(fieldId)] })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status) {
      li.remove(); // Only remove from DOM if successfully deleted
    } else {
      alert('Delete failed: ' + (data.message?.non_field_errors?.[0] || 'Unknown error'));
      console.error(data);
    }
  })
  .catch(err => {
    console.error('Delete error:', err);
    alert('Server error during delete');
  });
}
function removeSectionField(btn) {
  if (!confirm('Delete this section?')) return;

  const sectionDiv = btn.closest('.profile_intro');
  const sectionId = sectionDiv.dataset.sectionId;

  const introContainer = document.getElementById('introContainer');
  const accessToken = introContainer.dataset.accessToken;

  if (!sectionId) {
    // Section not yet saved — remove from UI only
    sectionDiv.remove();
    return;
  }

  // DELETE section by ID (no body required)
  fetch(`http://127.0.0.1:8001/profile/profile-fields-section/${sectionId}/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.status) {
      sectionDiv.remove();
    } else {
      alert('Failed to delete section: ' + (data.message?.non_field_errors?.[0] || 'Unknown error'));
    }
  })
  .catch(err => {
    console.error('Delete section error:', err);
    alert('Server error deleting section');
  });
}


function saveFields(sectionDiv) {
  const sectionId = sectionDiv.dataset.sectionId;
  let displayOrder = parseInt(sectionDiv.dataset.displayOrder, 10);
  if (isNaN(displayOrder)) {
    displayOrder = Date.now() % 10000;
  }

  const sectionTitle = sectionDiv.querySelector('h3').textContent.trim();
  const fieldList = Array.from(sectionDiv.querySelectorAll('li'));

  const fields = fieldList.map((li, i) => {
    const fieldName = li.querySelector('span').textContent.trim();
    const fieldId = li.dataset.fieldId;
    const field = {
      field_type: 'text',
      field_name: fieldName,
      text_value: fieldName,
      display_order: i + 1
    };
    if (fieldId) field.id = fieldId;
    return field;
  });

  const payload = {
    section: {
      title: sectionTitle,
      display_order: displayOrder,
      description: ""
    },
    // fields
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
      location.reload();
    }
  });
}

function addNewIntroSection() {
  const title = prompt('Enter new section title');
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

function handleDeleteClick(el, event) {
  event.preventDefault();

  const postId = el.dataset.postId;
  // const introContainer = document.getElementById('introContainer');
const accessToken = document.getElementById('introContainer')?.dataset.accessToken;
    console.log("Token used:", accessToken);

  if (!postId || !accessToken) {
    console.error("Missing postId or accessToken", { postId, accessToken });
    alert("Unable to delete: Missing data.");
    return;
  }

  if (!confirm('Are you sure you want to delete this post?')) return;

  fetch(`http://127.0.0.1:8001/media/post/${postId}/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  .then(response => {
    if (response.status === 204) {
      const postElement = el.closest('.post_container');
      if (postElement) postElement.remove();
    } else {
      return response.json().then(data => {
        alert(data.message || 'Failed to delete post.');
      });
    }
  })
  .catch(error => {
    console.error('Error deleting post:', error);
    alert('Error deleting post');
  });
}


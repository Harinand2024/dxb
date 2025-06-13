let cropper = null;
let currentCropType = null;

// Elements
const profileInput = document.getElementById('profileUpload');
const coverInput = document.getElementById('coverUpload');
const profileCropImage = document.getElementById('profileCropImage');
const coverCropImage = document.getElementById('coverCropImage');

// Open cropper in modal
function openCropper(type, file) {
    currentCropType = type;
    const reader = new FileReader();
    reader.onload = function (e) {
        const image = type === 'profile' ? profileCropImage : coverCropImage;
        image.src = e.target.result;

        if (cropper) cropper.destroy();

        cropper = new Cropper(image, {
            aspectRatio: type === 'profile' ? 1 : 16 / 9,
            viewMode: 1,
            autoCropArea: 1,
        });

        const modalId = type === 'profile' ? 'profileCropModal' : 'coverCropModal';
        new bootstrap.Modal(document.getElementById(modalId)).show();
    };
    reader.readAsDataURL(file);
}

// Crop and inject file into input
function cropImage(type) {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        width: type === 'profile' ? 300 : 1200,
        height: type === 'profile' ? 300 : 675
    });

    // Set preview
    const previewId = type === 'profile' ? 'profilePicturePreview' : 'coverPicturePreview';
    document.getElementById(previewId).src = canvas.toDataURL('image/jpeg');

    // Create blob and set input
    canvas.toBlob(blob => {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
        if (type === 'profile') profileInput.files = dt.files;
        else coverInput.files = dt.files;
    });

    cropper.destroy();
    cropper = null;
    const modalEl = bootstrap.Modal.getInstance(document.getElementById(type + 'CropModal'));
    modalEl.hide();
}

// Bind image input
profileInput?.addEventListener('change', function (e) {
    if (e.target.files[0]) openCropper('profile', e.target.files[0]);
});
coverInput?.addEventListener('change', function (e) {
    if (e.target.files[0]) openCropper('cover', e.target.files[0]);
});

// Handle form submit
document.addEventListener('DOMContentLoaded', function () {
    const infoForm = document.getElementById('infoForm');

    infoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const formData = new FormData(infoForm);

        fetch(`http://127.0.0.1:8001/profile/profile/{{ profile.id }}/`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer {{ request.session.access }}`
            },
            body: formData
        })
        .then(res => res.json())
        .then(() => {
            alert('Profile info updated!');
            location.reload();
        })
        .catch(err => {
            console.error(err);
            alert('Failed to update info');
        });
    });
});
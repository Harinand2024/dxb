
let cropper = null;
let currentCropType = null;

// Elements
const profileInput = document.getElementById('profilePictureInput');
const coverInput = document.getElementById('coverPictureInput');
const profileCropImage = document.getElementById('profileCropImage');
const coverCropImage = document.getElementById('coverCropImage');

// Open Cropper Modal
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

        document.getElementById(`${type}CropModal`).style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// Close Cropper Modal
function closeCropper(type) {
    document.getElementById(`${type}CropModal`).style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

// Crop & Set Image
function cropImage(type) {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        width: type === 'profile' ? 200 : 1200,
        height: type === 'profile' ? 200 : 675
    });

    const croppedDataUrl = canvas.toDataURL('image/jpeg');

    // Update preview
    if (type === 'profile') {
        document.getElementById('profilePicturePreview').src = croppedDataUrl;
    } else {
        document.getElementById('coverPicturePreview').src = croppedDataUrl;
    }

    // Create a fake file to submit via FormData
    canvas.toBlob(function(blob) {
        const fileInput = type === 'profile' ? profileInput : coverInput;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
        fileInput.files = dataTransfer.files;
    });

    closeCropper(type);
}

// Bind change events
profileInput?.addEventListener('change', function (e) {
    if (e.target.files[0]) {
        openCropper('profile', e.target.files[0]);
    }
});
coverInput?.addEventListener('change', function (e) {
    if (e.target.files[0]) {
        openCropper('cover', e.target.files[0]);
    }
});


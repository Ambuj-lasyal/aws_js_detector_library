document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("file");
    const uploadBtn = document.getElementById("upload-btn");
    const messageContainer = document.getElementById("upload-message");

    uploadBtn.addEventListener("click", function (e) {
        e.preventDefault();

        const file = fileInput.files[0];
        if (!file) {
            messageContainer.innerHTML = '<span style="color:white;">Veuillez sélectionner un fichier.</span>';
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        fetch("CV.php", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                messageContainer.innerHTML = `<span style="color:white;">${data.error}</span>`;
            } else {
                messageContainer.innerHTML = `<span style="color:white;">${data.success}</span>`;
            }
        })
        .catch(error => {
            messageContainer.innerHTML = '<span style="color:white;">Erreur lors du téléversement.</span>';
            console.error(error);
        });
    });
});


from flask import Flask, render_template, request, send_file, redirect, flash
import os
from io import BytesIO

app = Flask(__name__)
app.secret_key = "your_secret_key"  # dùng để flash thông báo

def xor_encrypt_decrypt(content, key):
    result = bytearray()
    for i in range(len(content)):
        result.append(content[i] ^ ord(key[i % len(key)]))
    return bytes(result)

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        uploaded_file = request.files.get('file')
        keycode = request.form.get('keycode')
        mode = request.form.get('mode')

        if not uploaded_file or not keycode:
            flash('Vui lòng chọn file và nhập keycode.', 'error')
            return redirect('/')

        file_content = uploaded_file.read()

        if mode == 'encrypt':
            content_with_key = (keycode + '\n').encode() + file_content
            processed = xor_encrypt_decrypt(content_with_key, keycode)
            filename = 'encrypted_file.txt'

        elif mode == 'decrypt':
            decrypted = xor_encrypt_decrypt(file_content, keycode)
            parts = decrypted.split(b'\n', 1)

            if len(parts) < 2 or parts[0].decode(errors='ignore') != keycode:
                flash('Keycode không đúng. Vui lòng kiểm tra lại.', 'error')
                return redirect('/')

            processed = parts[1]
            filename = 'decrypted_file.txt'

        return send_file(BytesIO(processed), as_attachment=True, download_name=filename)

    return render_template('index.html')

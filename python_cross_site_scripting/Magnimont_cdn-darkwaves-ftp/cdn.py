import os
from flask import Flask, request, jsonify, send_file, render_template_string, Response
from pymongo import MongoClient
from dotenv import load_dotenv
import uuid
from flask_compress import Compress
from flask_cors import CORS  # Import Flask-CORS
from image_detect import check_image
from video_detect import check_video
from werkzeug.datastructures import FileStorage
import re

# Flask application
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
Compress(app)
load_dotenv()

# MongoDB configuration
mongo_url = os.environ.get('MONGODB_URL')
if not mongo_url:
    raise ValueError("MongoDB URL is not set in the environment variables.")

mongo_client = MongoClient(mongo_url)
db = mongo_client['cdn']
collection = db['files']

# Directory to store uploaded files
UPLOAD_DIRECTORY = 'uploads'
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

def error_handler(message, code):
    return jsonify({'error': message}), code


def save_and_check_file(file, file_path, is_image=True):
    file.save(file_path)
    if is_image:
        image_status = check_image(file_path)
        print("image_status", image_status)
        if not image_status:
            return error_handler("File check error", 404)
        elif image_status["isNudeContent"]:
            os.remove(file_path)
            return error_handler("File contains nude content", 404)
        return image_status
    else:
        video_status = check_video(file_path)
        if not video_status:
            return error_handler("File check error", 404)
        elif video_status["isNudeContent"]:
            os.remove(file_path)
            return error_handler("File contains nude content", 404)
        return video_status


# Handle file uploads
@app.route('/upload', methods=['POST'])
def upload_file():
    files = request.files
    if not files:
        return error_handler("No files were uploaded", 404)

    uploaded_file = files.get('file')
    if not uploaded_file:
        return error_handler("No file was uploaded", 404)

    file_id = str(uuid.uuid4())
    filename = file_id + uploaded_file.filename
    if not filename:
        return error_handler("File Name Not Provided", 404)

    file_extension = os.path.splitext(filename)[1].lower()
    is_image = file_extension in ['.jpg', '.jpeg', '.png', '.gif']
    file_path = os.path.join(UPLOAD_DIRECTORY, filename)

    # Check if it's an image or video
    if is_image:
        content_status = save_and_check_file(uploaded_file, file_path, is_image)
        if isinstance(content_status, tuple):  # Error handler returned
            return content_status
    else:
        # Directly save the file if it's a video
        uploaded_file.save(file_path)
        content_status = {"isAdultContent": False}  # Set a default value or handle as needed

    # Store file metadata in MongoDB if it passes the checks
    file_metadata = {
        '_id': file_id,
        'filename': filename,
        'path': file_path,
        'content_type': 'image' if is_image else 'video',
        'adult_content': content_status.get("isAdultContent", False)
    }
    collection.insert_one(file_metadata)
    return jsonify(file_metadata)


# Get file path by ID
@app.route('/files/<file_id>', methods=['GET'])
def get_file_path(file_id):
    file_metadata = collection.find_one({'_id': file_id})
    if file_metadata:
        return jsonify({'path': f'/get/{file_id}'})
    else:
        return error_handler("file not found", 404)

# Get file by ID
@app.route('/get/<file_id>', methods=['GET'])
def get_file(file_id):
    file_metadata = collection.find_one({'_id': file_id})
    if not file_metadata:
        return error_handler("File not found", 404)

    file_path = file_metadata['path']
    content_type = file_metadata['content_type']

    if content_type == 'video':
        return serve_video_with_player(file_id, file_path)
    else:
        return send_file(file_path, as_attachment=False)

def serve_video_with_player(file_id, file_path):
    # Serve the video file along with the HTML video player
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Advanced Video Player</title>
    </head>
    <body>
        <div>
            <video id="videoPlayer" controls>
                <source id="videoSource" src="/stream/{file_id}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        <div>
            <!-- Skip Controls -->
            <button onclick="skip(-10)">Rewind 10s</button>
            <button onclick="skip(10)">Skip 10s</button>

            <!-- Playback Speed Controls -->
            <label for="speedControl">Playback Speed:</label>
            <select id="speedControl" onchange="setPlaybackSpeed()">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x (Normal)</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>
        </div>

      <script>
            const videoPlayer = document.getElementById('videoPlayer');
            const videoSource = document.getElementById('videoSource');
            const speedControl = document.getElementById('speedControl');

            // Skip function to jump forward or backward in the video
            function skip(seconds) {{videoPlayer.currentTime += seconds;}}

            // Set playback speed based on the selected option
            function setPlaybackSpeed() {{videoPlayer.playbackRate = speedControl.value;}}
        </script>
    </body>
    </html>
    """
    return render_template_string(html_content)

@app.route('/stream/<file_id>', methods=['GET'])
def stream_video(file_id):
    file_metadata = collection.find_one({'_id': file_id})
    if not file_metadata:
        return error_handler("File not found", 404)

    file_path = file_metadata['path']
    return send_video_file(file_path)

def send_video_file(file_path):
    try:
        if not os.path.exists(file_path):
            return error_handler(f"File not found: {file_path}", 404)

        range_header = request.headers.get('Range', None)
        if not range_header:
            return send_file(file_path, mimetype='video/mp4')

        byte1, byte2 = 0, None
        match = re.search(r'(\d+)-(\d*)', range_header)
        if match:
            groups = match.groups()
            if groups[0]:
                byte1 = int(groups[0])
            if groups[1]:
                byte2 = int(groups[1])

        file_size = os.path.getsize(file_path)
        length = file_size - byte1
        if byte2 is not None:
            length = byte2 - byte1 + 1

        with open(file_path, 'rb') as f:
            f.seek(byte1)
            data = f.read(length)

        rv = Response(data,
                      206,
                      mimetype='video/mp4',
                      content_type='video/mp4',
                      direct_passthrough=True)
        rv.headers.add('Content-Range', f'bytes {byte1}-{byte1 + length - 1}/{file_size}')
        rv.headers.add('Accept-Ranges', 'bytes')
        return rv

    except FileNotFoundError:
        return error_handler(f"File not found: {file_path}", 404)
    except PermissionError:
        return error_handler(f"Permission denied: {file_path}", 403)
    except Exception as e:
        return error_handler(f"Error serving video: {str(e)}", 500)

# Replace file by ID
@app.route('/replace/<file_id>', methods=['PUT'])
def replace_file(file_id):
    uploaded_file = request.files.get('file')
    if not uploaded_file:
        return jsonify({'error': 'No file uploaded'}), 400

    file_metadata = collection.find_one({'_id': file_id})
    if not file_metadata:
        return jsonify({'error': 'File not found'}), 404

    filename = uploaded_file.filename
    file_path = os.path.join(UPLOAD_DIRECTORY, filename)
    is_image = file_metadata['content_type'] == 'image'
    content_status = save_and_check_file(uploaded_file, file_path, is_image)
    if isinstance(content_status, tuple):  # Error handler returned
        return content_status

    # Update file metadata in MongoDB
    collection.update_one(
        {'_id': file_id},
        {'$set': {
            'filename': filename,
            'path': file_path,
            'adult_content': content_status["isAdultContent"]
        }}
    )

    return jsonify({'success': True})

# Delete file by ID
@app.route('/delete/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    file_metadata = collection.find_one({'_id': file_id})
    if not file_metadata:
        return jsonify({'error': 'File not found'}), 404

    file_path = file_metadata['path']
    os.remove(file_path)

    # Remove file metadata from MongoDB
    collection.delete_one({'_id': file_id})

    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3002)

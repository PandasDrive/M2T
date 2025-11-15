import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import morse_processor  # This is our custom logic file

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
GENERATED_FOLDER = 'generated_audio'
ALLOWED_EXTENSIONS = {'wav'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['GENERATED_FOLDER'] = GENERATED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload size

# --- Ensure directories exist ---
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GENERATED_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- ---
# == Main Application Routes ==
# --- ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/translate-to-morse', methods=['POST'])
def translate_to_morse():
    """
    Handles text-to-morse translation.
    Takes JSON {'text': '...'} and returns JSON {'filepath': '...', 'error': '...'}
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided.'}), 400
    
    text_to_translate = data['text']
    
    try:
        # Generate a unique filename for the audio file
        output_filename = f"morse_{hash(text_to_translate)}.wav"
        output_path = os.path.join(app.config['GENERATED_FOLDER'], output_filename)
        
        # Call the processor to generate the audio
        morse_processor.generate_morse_audio(text_to_translate, output_path)
        
        # Return the path so the client can fetch it
        # We return a *relative* path that the /generated/ route can serve
        return jsonify({'filepath': f'/generated/{output_filename}'})
        
    except Exception as e:
        print(f"Error during text-to-morse conversion: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/translate-from-audio', methods=['POST'])
def translate_from_audio():
    """
    Handles audio-to-text translation.
    Takes a .wav file upload and returns JSON with translation data.
    """
    if 'audioFile' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400
    
    file = request.files['audioFile']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Get tuning parameters from the form, with defaults
            wpm_override = request.form.get('wpm', default=None, type=int)
            threshold_factor = request.form.get('threshold', default=1.0, type=float)
            frequency_override = request.form.get('frequency', default=None, type=int)

            # Call the processor to analyze the audio with the new parameters
            analysis_data = morse_processor.process_audio_file(
                filepath, 
                wpm_override=wpm_override, 
                threshold_factor=threshold_factor,
                frequency_override=frequency_override
            )
            
            return jsonify(analysis_data)
            
        except Exception as e:
            print(f"Error during audio-to-text conversion: {e}")
            return jsonify({'error': str(e)}), 500
            
    else:
        return jsonify({'error': 'Invalid file type. Only .wav is allowed.'}), 400

# --- ---
# == File Serving Routes ==
# --- ---

@app.route('/uploads/<filename>')
def serve_uploaded_file(filename):
    """Serves files from the UPLOAD_FOLDER."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/generated/<filename>')
def serve_generated_file(filename):
    """Serves files from the GENERATED_FOLDER."""
    return send_from_directory(app.config['GENERATED_FOLDER'], filename)

# --- ---
# == Main execution ==
# --- ---

if __name__ == '__main__':
    # Runs on localhost, port 5000.
    # debug=True auto-reloads when you save changes.
    app.run(debug=True, host='127.0.0.1', port=5000)

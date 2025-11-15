import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from werkzeug.utils import secure_filename
from datetime import datetime
import morse_processor  # This is our custom logic file
import audio_preprocessor  # Audio preprocessing module
import export_utils  # Export utilities
from models import db, AudioFile, DecodeResult, Session

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
GENERATED_FOLDER = 'generated_audio'
TEMP_FOLDER = 'temp'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['GENERATED_FOLDER'] = GENERATED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload size
app.config['TEMP_FOLDER'] = TEMP_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///m2t_analysis.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# --- Ensure directories exist ---
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GENERATED_FOLDER, exist_ok=True)
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Create database tables
with app.app_context():
    db.create_all()

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
    Supports multiple audio formats (WAV, MP3, FLAC, OGG, M4A, AAC).
    Applies preprocessing if requested.
    """
    if 'audioFile' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400
    
    file = request.files['audioFile']
    
    if not file or not file.filename or file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400
    
    # Check if file extension is allowed
    filename_raw = file.filename
    if not filename_raw or '.' not in filename_raw:
        return jsonify({'error': 'Invalid filename or file extension.'}), 400
    
    file_ext = filename_raw.rsplit('.', 1)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Invalid file type. Allowed formats: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
    
    # Type assertion: after checks above, filename_raw is guaranteed to be a string
    filename = secure_filename(str(filename_raw))
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Convert to WAV if necessary
    converted_filepath = filepath
    temp_wav_path = None
    
    try:
        if file_ext != 'wav':
            # Convert to WAV format
            base_name = os.path.splitext(filename)[0]
            temp_wav_path = os.path.join(app.config.get('TEMP_FOLDER', TEMP_FOLDER), f"{base_name}_temp.wav")
            converted_filepath = audio_preprocessor.convert_audio_to_wav(filepath, temp_wav_path)
        
        # Get tuning parameters from the form
        wpm_override = request.form.get('wpm', default=None, type=int)
        threshold_factor = request.form.get('threshold', default=1.0, type=float)
        frequency_override = request.form.get('frequency', default=None, type=int)
        
        # Get preprocessing options
        preprocessing_config = {}
        if request.form.get('preprocess', 'false').lower() == 'true':
            preprocessing_config = {
                'remove_dc': request.form.get('remove_dc', 'true').lower() == 'true',
                'apply_bandpass': request.form.get('apply_bandpass', 'false').lower() == 'true',
                'bandpass_low': float(request.form.get('bandpass_low', 300)),
                'bandpass_high': float(request.form.get('bandpass_high', 1500)),
                'apply_notch': request.form.get('apply_notch', 'false').lower() == 'true',
                'notch_freq': float(request.form.get('notch_freq', 60.0)),
                'apply_highpass': request.form.get('apply_highpass', 'false').lower() == 'true',
                'highpass_cutoff': float(request.form.get('highpass_cutoff', 50)),
                'apply_lowpass': request.form.get('apply_lowpass', 'false').lower() == 'true',
                'lowpass_cutoff': float(request.form.get('lowpass_cutoff', 2000)),
                'normalize': request.form.get('normalize', 'peak') or None,
                'noise_reduction': request.form.get('noise_reduction', 'false').lower() == 'true',
                'noise_reduction_db': float(request.form.get('noise_reduction_db', 6.0)),
            }
        
        # Apply preprocessing if configured
        if preprocessing_config and any(preprocessing_config.values()):
            # Load audio, preprocess, save temporary preprocessed file
            import librosa
            import numpy as np
            import soundfile as sf
            
            audio, sr = librosa.load(converted_filepath, sr=None)
            processed_audio = audio_preprocessor.preprocess_audio(audio, sr, preprocessing_config)
            
            # Save preprocessed audio temporarily
            preprocessed_path = os.path.join(
                app.config.get('TEMP_FOLDER', TEMP_FOLDER), 
                f"{os.path.splitext(os.path.basename(converted_filepath))[0]}_preprocessed.wav"
            )
            sf.write(preprocessed_path, processed_audio, sr)
            converted_filepath = preprocessed_path

        # Call the processor to analyze the audio
        analysis_data = morse_processor.process_audio_file(
            converted_filepath, 
            wpm_override=wpm_override, 
            threshold_factor=threshold_factor,
            frequency_override=frequency_override,
            preprocess_config=None  # Already preprocessed if needed
        )
        
        # Clean up temporary files
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass
        
        return jsonify(analysis_data)
        
    except Exception as e:
        print(f"Error during audio-to-text conversion: {e}")
        import traceback
        traceback.print_exc()
        
        # Clean up on error
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass
        
        return jsonify({'error': str(e)}), 500

# --- ---
# == File Serving Routes ==
# --- ---

@app.route('/uploads/<filename>')
def serve_uploaded_file(filename):
    """Serves files from the UPLOAD_FOLDER."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- ---
# == Batch Processing Routes ==
# --- ---

@app.route('/batch-upload', methods=['POST'])
def batch_upload():
    """Handle batch file upload"""
    if 'files[]' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files[]')
    uploaded_files = []
    
    for file in files:
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # Check if file already exists, append number if needed
            base_name, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(filepath):
                filename = f"{base_name}_{counter}{ext}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                counter += 1
            
            file.save(filepath)
            uploaded_files.append({
                'filename': filename,
                'filepath': filepath,
                'original_filename': file.filename
            })
    
    return jsonify({
        'success': True,
        'files': uploaded_files,
        'count': len(uploaded_files)
    })

@app.route('/batch-process', methods=['POST'])
def batch_process():
    """Process multiple files in batch"""
    try:
        data = request.get_json()
        file_ids = data.get('file_ids', [])
        config = data.get('config', {})
        
        from batch_processor import process_file_batch
        
        results = []
        for file_info in file_ids:
            filepath = file_info.get('filepath')
            original_filename = file_info.get('original_filename')
            
            if not os.path.exists(filepath):
                results.append({
                    'success': False,
                    'filename': original_filename,
                    'error': 'File not found'
                })
                continue
            
            result = process_file_batch(
                filepath,
                original_filename,
                app.config['UPLOAD_FOLDER'],
                app.config['TEMP_FOLDER'],
                config
            )
            results.append(result)
        
        # Summary statistics
        successful = sum(1 for r in results if r['success'])
        failed = len(results) - successful
        avg_quality = sum(r.get('data', {}).get('quality_score', 0) for r in results if r['success'])
        if successful > 0:
            avg_quality /= successful
        
        return jsonify({
            'success': True,
            'results': results,
            'summary': {
                'total': len(results),
                'successful': successful,
                'failed': failed,
                'average_quality': avg_quality
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/batch-status', methods=['GET'])
def batch_status():
    """Get batch processing status"""
    try:
        processed_count = AudioFile.query.filter_by(processed=True).count()
        total_count = AudioFile.query.count()
        
        recent_results = DecodeResult.query.order_by(DecodeResult.timestamp.desc()).limit(10).all()
        
        return jsonify({
            'processed': processed_count,
            'total': total_count,
            'recent_results': [r.to_dict() for r in recent_results]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generated/<filename>')
def serve_generated_file(filename):
    """Serves files from the GENERATED_FOLDER."""
    return send_from_directory(app.config['GENERATED_FOLDER'], filename)

# --- ---
# == Export Routes ==
# --- ---

@app.route('/export-decoded', methods=['POST'])
def export_decoded():
    """
    Export decoded Morse code text in various formats.
    Accepts JSON with 'text', 'events', 'metadata', and 'format' (txt, csv, json, formatted).
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided.'}), 400
    
    decoded_text = data.get('text', '')
    events = data.get('events', [])
    metadata = data.get('metadata', {})
    format_type = data.get('format', 'txt').lower()
    
    if not decoded_text:
        return jsonify({'error': 'No text to export.'}), 400
    
    try:
        if format_type == 'txt':
            content = export_utils.export_to_txt(decoded_text, metadata)
            mimetype = 'text/plain'
            filename = f'm2t_decode_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
        elif format_type == 'csv':
            content = export_utils.export_to_csv(decoded_text, events, metadata)
            mimetype = 'text/csv'
            filename = f'm2t_decode_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        elif format_type == 'json':
            content = export_utils.export_to_json(decoded_text, events, metadata)
            mimetype = 'application/json'
            filename = f'm2t_decode_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        elif format_type == 'formatted':
            content = export_utils.export_to_formatted_text(decoded_text, events, metadata)
            mimetype = 'text/plain'
            filename = f'm2t_decode_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
        else:
            return jsonify({'error': f'Invalid format: {format_type}. Supported: txt, csv, json, formatted'}), 400
        
        response = Response(content, mimetype=mimetype)
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        return response
        
    except Exception as e:
        print(f"Error during export: {e}")
        return jsonify({'error': str(e)}), 500

# --- ---
# == Main execution ==
# --- ---

if __name__ == '__main__':
    # Runs on localhost, port 5000.
    # debug=True auto-reloads when you save changes.
    app.run(debug=True, host='127.0.0.1', port=5000)

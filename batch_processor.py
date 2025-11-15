"""
Batch processing utilities for M2T
"""
import os
import json
import librosa
import soundfile as sf
from datetime import datetime
from models import db, AudioFile, DecodeResult
import morse_processor
import audio_preprocessor

def get_audio_metadata(filepath):
    """Extract metadata from audio file"""
    try:
        info = sf.info(filepath)
        duration = info.duration
        sr = info.samplerate
        channels = info.channels
        file_size = os.path.getsize(filepath)
        format = os.path.splitext(filepath)[1][1:].lower()
        return {
            'duration': duration,
            'sample_rate': sr,
            'channels': channels,
            'file_size': file_size,
            'format': format
        }
    except Exception as e:
        print(f"Error getting metadata: {e}")
        return None

def process_file_batch(filepath, original_filename, upload_folder, temp_folder, config=None):
    """
    Process a single file in batch mode
    
    Args:
        filepath: Path to the audio file
        original_filename: Original filename
        upload_folder: Upload folder path
        temp_folder: Temporary folder path
        config: Processing configuration dict
        
    Returns:
        dict: Processing result with success status and data/error
    """
    result = {
        'success': False,
        'filename': original_filename,
        'error': None,
        'data': None
    }
    
    try:
        # Get file metadata
        metadata = get_audio_metadata(filepath)
        if not metadata:
            result['error'] = 'Could not read file metadata'
            return result
        
        # Create AudioFile record
        audio_file = AudioFile(
            filename=os.path.basename(filepath),
            original_filename=original_filename,
            filepath=filepath,
            file_size=metadata['file_size'],
            duration=metadata['duration'],
            sample_rate=metadata['sample_rate'],
            channels=metadata['channels'],
            format=metadata['format'],
            processed=False
        )
        db.session.add(audio_file)
        db.session.flush()  # Get the ID
        
        # Convert to WAV if necessary
        converted_filepath = filepath
        temp_wav_path = None
        file_ext = metadata['format']
        
        if file_ext != 'wav':
            base_name = os.path.splitext(os.path.basename(filepath))[0]
            temp_wav_path = os.path.join(temp_folder, f"{base_name}_temp.wav")
            converted_filepath = audio_preprocessor.convert_audio_to_wav(filepath, temp_wav_path)
        
        # Apply preprocessing if configured
        preprocessing_config = config.get('preprocessing', {}) if config else {}
        if preprocessing_config and any(preprocessing_config.values()):
            audio, sr = librosa.load(converted_filepath, sr=None)
            processed_audio = audio_preprocessor.preprocess_audio(audio, sr, preprocessing_config)
            
            preprocessed_path = os.path.join(
                temp_folder,
                f"{os.path.splitext(os.path.basename(converted_filepath))[0]}_preprocessed.wav"
            )
            sf.write(preprocessed_path, processed_audio, sr)
            converted_filepath = preprocessed_path
        
        # Get processing parameters
        wpm_override = config.get('wpm') if config else None
        threshold_factor = config.get('threshold', 1.0) if config else 1.0
        frequency_override = config.get('frequency') if config else None
        
        # Process the audio
        analysis_data = morse_processor.process_audio_file(
            converted_filepath,
            wpm_override=wpm_override,
            threshold_factor=threshold_factor,
            frequency_override=frequency_override,
            preprocess_config=None
        )
        
        # Create DecodeResult record
        events = analysis_data.get('events', [])
        full_text = analysis_data.get('full_text', '')
        
        # Calculate quality metrics
        quality_score = calculate_quality_score(analysis_data)
        timing_consistency = calculate_timing_consistency(events)
        
        decode_result = DecodeResult(
            file_id=audio_file.id,
            wpm=analysis_data.get('wpm'),
            frequency=analysis_data.get('frequency'),
            threshold_factor=analysis_data.get('threshold_factor', 1.0),
            decoded_text=full_text,
            full_text=full_text,
            event_count=len(events),
            quality_score=quality_score,
            snr=analysis_data.get('snr'),
            avg_snr=analysis_data.get('avg_snr'),
            confidence=analysis_data.get('confidence', 0),
            timing_consistency=timing_consistency,
            preprocess_config=json.dumps(preprocessing_config) if preprocessing_config else None
        )
        
        # Calculate average dot/dash durations
        if events:
            dots = [e.get('duration', 0) for e in events if e.get('type') == 'dot']
            dashes = [e.get('duration', 0) for e in events if e.get('type') == 'dash']
            if dots:
                decode_result.avg_dot_duration = sum(dots) / len(dots)
            if dashes:
                decode_result.avg_dash_duration = sum(dashes) / len(dashes)
        
        db.session.add(decode_result)
        audio_file.processed = True
        
        db.session.commit()
        
        result['success'] = True
        result['data'] = {
            'file_id': audio_file.id,
            'result_id': decode_result.id,
            'analysis': analysis_data,
            'quality_score': quality_score
        }
        
        # Clean up temp files
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass
        
    except Exception as e:
        db.session.rollback()
        result['error'] = str(e)
        import traceback
        traceback.print_exc()
    
    return result

def calculate_quality_score(analysis_data):
    """Calculate overall quality score (0-100)"""
    score = 50  # Base score
    
    # SNR contribution (0-30 points)
    snr = analysis_data.get('avg_snr', 0)
    if snr > 0:
        score += min(30, snr / 2)  # Max 30 points for SNR
    
    # Event count contribution (0-20 points)
    events = analysis_data.get('events', [])
    if len(events) > 0:
        score += min(20, len(events) / 5)  # Max 20 points
    
    return min(100, max(0, score))

def calculate_timing_consistency(events):
    """Calculate timing consistency (0-100)"""
    if not events or len(events) < 2:
        return 0
    
    durations = [e.get('duration', 0) for e in events if e.get('duration', 0) > 0]
    if len(durations) < 2:
        return 0
    
    mean_duration = sum(durations) / len(durations)
    variance = sum((d - mean_duration) ** 2 for d in durations) / len(durations)
    std_dev = variance ** 0.5
    
    if mean_duration == 0:
        return 0
    
    cv = std_dev / mean_duration  # Coefficient of variation
    consistency = max(0, 100 - (cv * 100))  # Lower CV = higher consistency
    
    return min(100, consistency)


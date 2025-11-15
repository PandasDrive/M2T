"""
Audio Preprocessing Module
Provides noise reduction, filtering, and enhancement capabilities for Morse code audio.
"""
import numpy as np
import librosa
from scipy import signal
from pydub import AudioSegment


def remove_dc_offset(audio_array):
    """
    Remove DC offset from audio signal.
    
    Args:
        audio_array: NumPy array of audio samples
        
    Returns:
        Audio array with DC offset removed
    """
    return audio_array - np.mean(audio_array)


def apply_bandpass_filter(audio_array, sample_rate, low_freq=300, high_freq=1500, order=4):
    """
    Apply a bandpass filter to isolate Morse code frequency range.
    
    Args:
        audio_array: NumPy array of audio samples
        sample_rate: Sample rate of the audio
        low_freq: Lower cutoff frequency (Hz)
        high_freq: Upper cutoff frequency (Hz)
        order: Filter order (higher = sharper cutoff)
        
    Returns:
        Filtered audio array
    """
    nyquist = sample_rate / 2
    low_normalized = low_freq / nyquist
    high_normalized = high_freq / nyquist
    
    # Ensure frequencies are within valid range
    low_normalized = max(0.01, min(0.99, low_normalized))
    high_normalized = max(0.01, min(0.99, high_normalized))
    
    sos = signal.butter(order, [low_freq, high_freq], btype='band', fs=sample_rate, output='sos')
    filtered = signal.sosfilt(sos, audio_array)
    return filtered


def apply_notch_filter(audio_array, sample_rate, notch_freq=60.0, quality_factor=30.0):
    """
    Apply a notch filter to remove specific interference frequencies (e.g., 50/60Hz hum).
    
    Args:
        audio_array: NumPy array of audio samples
        sample_rate: Sample rate of the audio
        notch_freq: Frequency to notch out (Hz)
        quality_factor: Quality factor (higher = narrower notch)
        
    Returns:
        Filtered audio array
    """
    nyquist = sample_rate / 2
    if notch_freq >= nyquist:
        return audio_array  # Can't filter above Nyquist frequency
    
    b, a = signal.iirnotch(notch_freq, quality_factor, sample_rate)
    filtered = signal.filtfilt(b, a, audio_array)
    return filtered


def apply_highpass_filter(audio_array, sample_rate, cutoff_freq=50, order=4):
    """
    Apply a high-pass filter to remove low-frequency noise.
    
    Args:
        audio_array: NumPy array of audio samples
        sample_rate: Sample rate of the audio
        cutoff_freq: Cutoff frequency (Hz)
        order: Filter order
        
    Returns:
        Filtered audio array
    """
    sos = signal.butter(order, cutoff_freq, btype='high', fs=sample_rate, output='sos')
    filtered = signal.sosfilt(sos, audio_array)
    return filtered


def apply_lowpass_filter(audio_array, sample_rate, cutoff_freq=2000, order=4):
    """
    Apply a low-pass filter to remove high-frequency noise.
    
    Args:
        audio_array: NumPy array of audio samples
        sample_rate: Sample rate of the audio
        cutoff_freq: Cutoff frequency (Hz)
        order: Filter order
        
    Returns:
        Filtered audio array
    """
    sos = signal.butter(order, cutoff_freq, btype='low', fs=sample_rate, output='sos')
    filtered = signal.sosfilt(sos, audio_array)
    return filtered


def normalize_audio(audio_array, method='peak', target_db=0.0):
    """
    Normalize audio signal.
    
    Args:
        audio_array: NumPy array of audio samples
        method: 'peak' for peak normalization, 'rms' for RMS normalization
        target_db: Target level in dB (for RMS only)
        
    Returns:
        Normalized audio array
    """
    if method == 'peak':
        # Peak normalization to [-1, 1]
        max_val = np.max(np.abs(audio_array))
        if max_val > 0:
            return audio_array / max_val
        return audio_array
    elif method == 'rms':
        # RMS normalization
        rms = np.sqrt(np.mean(audio_array**2))
        if rms > 0:
            target_linear = 10 ** (target_db / 20)
            current_linear = rms
            return audio_array * (target_linear / current_linear)
        return audio_array
    return audio_array


def apply_spectral_subtraction(audio_array, sample_rate, noise_reduction_db=6.0):
    """
    Apply spectral subtraction for noise reduction.
    Simple implementation that estimates noise from quiet segments.
    
    Args:
        audio_array: NumPy array of audio samples
        sample_rate: Sample rate of the audio
        noise_reduction_db: Amount of noise reduction in dB
        
    Returns:
        Noise-reduced audio array
    """
    # Simple spectral subtraction: estimate noise from low-energy segments
    frame_length = int(0.025 * sample_rate)  # 25ms frames
    hop_length = int(0.010 * sample_rate)   # 10ms hop
    
    # Compute short-time Fourier transform
    stft = librosa.stft(audio_array, n_fft=frame_length * 2, hop_length=hop_length)
    magnitude = np.abs(stft)
    phase = np.angle(stft)
    
    # Estimate noise floor from quiet frames (lowest 10% energy frames)
    frame_energies = np.mean(magnitude**2, axis=0)
    noise_frames = np.argsort(frame_energies)[:max(1, int(len(frame_energies) * 0.1))]
    noise_spectrum = np.mean(magnitude[:, noise_frames], axis=1, keepdims=True)
    
    # Subtract noise spectrum with over-subtraction factor
    alpha = 2.0  # Over-subtraction factor
    beta = 0.01  # Spectral floor factor
    
    noise_reduction_linear = 10 ** (noise_reduction_db / 20)
    enhanced_magnitude = magnitude - alpha * noise_spectrum
    
    # Apply spectral floor to avoid musical noise
    enhanced_magnitude = np.maximum(enhanced_magnitude, beta * magnitude)
    
    # Reconstruct signal
    enhanced_stft = enhanced_magnitude * np.exp(1j * phase)
    enhanced_audio = librosa.istft(enhanced_stft, hop_length=hop_length)
    
    # Trim to original length
    if len(enhanced_audio) > len(audio_array):
        enhanced_audio = enhanced_audio[:len(audio_array)]
    elif len(enhanced_audio) < len(audio_array):
        enhanced_audio = np.pad(enhanced_audio, (0, len(audio_array) - len(enhanced_audio)))
    
    return enhanced_audio


def preprocess_audio(audio_array, sample_rate, config=None):
    """
    Apply all preprocessing steps based on configuration.
    
    Args:
        audio_array: NumPy array of audio samples
        sample_rate: Sample rate of the audio
        config: Dictionary with preprocessing options:
            - remove_dc: bool (default: True)
            - apply_bandpass: bool (default: False)
            - bandpass_low: float (default: 300)
            - bandpass_high: float (default: 1500)
            - apply_notch: bool (default: False)
            - notch_freq: float (default: 60.0)
            - apply_highpass: bool (default: False)
            - highpass_cutoff: float (default: 50)
            - apply_lowpass: bool (default: False)
            - lowpass_cutoff: float (default: 2000)
            - normalize: str (default: 'peak') - 'peak', 'rms', or None
            - noise_reduction: bool (default: False)
            - noise_reduction_db: float (default: 6.0)
            
    Returns:
        Preprocessed audio array
    """
    if config is None:
        config = {}
    
    processed = audio_array.copy()
    
    # Remove DC offset (almost always beneficial)
    if config.get('remove_dc', True):
        processed = remove_dc_offset(processed)
    
    # High-pass filter (remove low-frequency noise)
    if config.get('apply_highpass', False):
        processed = apply_highpass_filter(
            processed, sample_rate, 
            cutoff_freq=config.get('highpass_cutoff', 50)
        )
    
    # Notch filter (remove specific interference)
    if config.get('apply_notch', False):
        processed = apply_notch_filter(
            processed, sample_rate,
            notch_freq=config.get('notch_freq', 60.0),
            quality_factor=config.get('notch_quality', 30.0)
        )
    
    # Bandpass filter (isolate Morse frequency range)
    if config.get('apply_bandpass', False):
        processed = apply_bandpass_filter(
            processed, sample_rate,
            low_freq=config.get('bandpass_low', 300),
            high_freq=config.get('bandpass_high', 1500)
        )
    
    # Low-pass filter (remove high-frequency noise)
    if config.get('apply_lowpass', False):
        processed = apply_lowpass_filter(
            processed, sample_rate,
            cutoff_freq=config.get('lowpass_cutoff', 2000)
        )
    
    # Noise reduction (spectral subtraction)
    if config.get('noise_reduction', False):
        processed = apply_spectral_subtraction(
            processed, sample_rate,
            noise_reduction_db=config.get('noise_reduction_db', 6.0)
        )
    
    # Normalize
    normalize_method = config.get('normalize', 'peak')
    if normalize_method:
        processed = normalize_audio(processed, method=normalize_method)
    
    return processed


def convert_audio_to_wav(input_path, output_path=None, target_sample_rate=44100):
    """
    Convert any audio format to WAV using pydub.
    
    Args:
        input_path: Path to input audio file (any format supported by pydub)
        output_path: Optional output path. If None, creates temp file
        target_sample_rate: Target sample rate for output (default: 44100)
        
    Returns:
        Path to converted WAV file
    """
    import tempfile
    
    try:
        # Load audio file (pydub supports many formats)
        audio = AudioSegment.from_file(input_path)
        
        # Set sample rate if needed
        if audio.frame_rate != target_sample_rate:
            audio = audio.set_frame_rate(target_sample_rate)
        
        # Convert to mono if stereo
        if audio.channels > 1:
            audio = audio.set_channels(1)
        
        # Generate output path if not provided
        if output_path is None:
            import os
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            output_dir = os.path.dirname(input_path)
            output_path = os.path.join(output_dir, f"{base_name}_converted.wav")
        
        # Export as WAV
        audio.export(output_path, format="wav")
        
        return output_path
        
    except Exception as e:
        raise Exception(f"Failed to convert audio format: {str(e)}")


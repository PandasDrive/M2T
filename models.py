"""
Database models for M2T Signal Analysis
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class AudioFile(db.Model):
    """Audio file metadata"""
    __tablename__ = 'audio_files'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    duration = db.Column(db.Float)  # seconds
    sample_rate = db.Column(db.Integer)
    channels = db.Column(db.Integer)
    format = db.Column(db.String(10))
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    processed = db.Column(db.Boolean, default=False)
    
    # Relationship to decode results
    results = db.relationship('DecodeResult', backref='audio_file', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'duration': self.duration,
            'sample_rate': self.sample_rate,
            'channels': self.channels,
            'format': self.format,
            'upload_date': self.upload_date.isoformat() if self.upload_date else None,
            'processed': self.processed
        }

class DecodeResult(db.Model):
    """Decode results for audio files"""
    __tablename__ = 'decode_results'
    
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('audio_files.id'), nullable=False)
    
    # Decode parameters
    wpm = db.Column(db.Float)
    frequency = db.Column(db.Float)
    threshold_factor = db.Column(db.Float)
    
    # Results
    decoded_text = db.Column(db.Text)
    full_text = db.Column(db.Text)
    event_count = db.Column(db.Integer)
    
    # Quality metrics
    quality_score = db.Column(db.Float)  # 0-100
    snr = db.Column(db.Float)  # Signal-to-Noise Ratio in dB
    avg_snr = db.Column(db.Float)
    confidence = db.Column(db.Float)  # 0-100
    
    # Timing analysis
    avg_dot_duration = db.Column(db.Float)  # seconds
    avg_dash_duration = db.Column(db.Float)
    timing_consistency = db.Column(db.Float)  # 0-100
    
    # Processing metadata
    processing_time = db.Column(db.Float)  # seconds
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Preprocessing config (JSON string)
    preprocess_config = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_id': self.file_id,
            'wpm': self.wpm,
            'frequency': self.frequency,
            'threshold_factor': self.threshold_factor,
            'decoded_text': self.decoded_text,
            'full_text': self.full_text,
            'event_count': self.event_count,
            'quality_score': self.quality_score,
            'snr': self.snr,
            'avg_snr': self.avg_snr,
            'confidence': self.confidence,
            'avg_dot_duration': self.avg_dot_duration,
            'avg_dash_duration': self.avg_dash_duration,
            'timing_consistency': self.timing_consistency,
            'processing_time': self.processing_time,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'preprocess_config': self.preprocess_config
        }

class Session(db.Model):
    """Analysis session state"""
    __tablename__ = 'sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255))
    description = db.Column(db.Text)
    
    # Session state (JSON)
    state = db.Column(db.Text)  # Store UI state, settings, etc.
    
    # Metadata
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'state': self.state,
            'created_date': self.created_date.isoformat() if self.created_date else None,
            'last_modified': self.last_modified.isoformat() if self.last_modified else None
        }


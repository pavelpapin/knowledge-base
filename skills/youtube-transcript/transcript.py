#!/usr/bin/env python3
"""
YouTube Transcript Fetcher
Uses youtube-transcript-api for reliable transcript extraction
"""

import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
import re

def extract_video_id(url: str) -> str | None:
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_transcript(video_id: str, languages: list[str] = None) -> dict:
    """Fetch transcript for a YouTube video"""
    if languages is None:
        languages = ['ru', 'en']

    api = YouTubeTranscriptApi()

    try:
        # Try to get transcript in preferred languages
        transcript = api.fetch(video_id, languages=languages)

        # Format as plain text
        text = ' '.join([snippet.text for snippet in transcript.snippets])

        # Clean up text
        text = re.sub(r'\s+', ' ', text).strip()

        return {
            'video_id': video_id,
            'transcript': text,
            'language': transcript.language,
            'is_generated': transcript.is_generated,
            'duration': transcript.snippets[-1].start if transcript.snippets else 0
        }
    except Exception as e:
        # Try listing available transcripts
        try:
            available = api.list(video_id)
            langs = [t.language_code for t in available]
            return {
                'error': str(e),
                'available_languages': langs
            }
        except Exception as e2:
            return {'error': str(e2)}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'URL or video ID required'}))
        sys.exit(1)

    url = sys.argv[1]
    languages = sys.argv[2].split(',') if len(sys.argv) > 2 else ['ru', 'en']

    video_id = extract_video_id(url)
    if not video_id:
        print(json.dumps({'error': 'Invalid YouTube URL or video ID'}))
        sys.exit(1)

    result = get_transcript(video_id, languages)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()

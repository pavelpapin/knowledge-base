#!/usr/bin/env python3
"""
YouTube Transcript Fetcher
Primary: Supadata API (works from cloud IPs)
Fallback: youtube-transcript-api (blocked on cloud IPs)
"""

import sys
import json
import re
import os
from pathlib import Path

# Load Supadata API key
SECRETS_PATH = Path('/root/.claude/secrets/supadata.json')

def load_supadata_key() -> str | None:
    """Load Supadata API key from secrets"""
    if SECRETS_PATH.exists():
        try:
            with open(SECRETS_PATH) as f:
                data = json.load(f)
                return data.get('api_key')
        except:
            pass
    return None

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

def get_transcript_supadata(url: str, language: str = 'en') -> dict:
    """Fetch transcript via Supadata API (recommended for cloud)"""
    import urllib.request
    import urllib.parse

    api_key = load_supadata_key()
    if not api_key:
        return {'error': 'Supadata API key not configured'}

    video_id = extract_video_id(url)
    if not video_id:
        return {'error': 'Invalid YouTube URL'}

    # Build API URL
    params = urllib.parse.urlencode({
        'url': url,
        'text': 'true',
        'lang': language
    })
    api_url = f'https://api.supadata.ai/v1/youtube/transcript?{params}'

    try:
        req = urllib.request.Request(api_url)
        req.add_header('x-api-key', api_key)

        with urllib.request.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))

            return {
                'video_id': video_id,
                'transcript': data.get('content', ''),
                'language': data.get('lang', language),
                'available_languages': data.get('availableLangs', []),
                'source': 'supadata'
            }
    except urllib.error.HTTPError as e:
        return {'error': f'Supadata API error: {e.code} - {e.reason}'}
    except Exception as e:
        return {'error': f'Supadata request failed: {str(e)}'}

def get_transcript_ytapi(video_id: str, languages: list[str]) -> dict:
    """Fetch transcript via youtube-transcript-api (fallback)"""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id, languages=languages)

        text = ' '.join([snippet.text for snippet in transcript.snippets])
        text = re.sub(r'\s+', ' ', text).strip()

        return {
            'video_id': video_id,
            'transcript': text,
            'language': transcript.language,
            'is_generated': transcript.is_generated,
            'source': 'youtube-transcript-api'
        }
    except Exception as e:
        return {'error': str(e), 'source': 'youtube-transcript-api'}

def get_transcript(url: str, languages: list[str] = None) -> dict:
    """
    Get YouTube transcript.
    Tries Supadata first (works from cloud), falls back to youtube-transcript-api.
    """
    if languages is None:
        languages = ['en', 'ru']

    video_id = extract_video_id(url)
    if not video_id:
        return {'error': 'Invalid YouTube URL or video ID'}

    # Try Supadata first (works from cloud IPs)
    if load_supadata_key():
        result = get_transcript_supadata(url, languages[0])
        if 'error' not in result:
            return result
        # Log error but continue to fallback
        supadata_error = result.get('error', 'Unknown error')
    else:
        supadata_error = 'No API key'

    # Fallback to youtube-transcript-api
    result = get_transcript_ytapi(video_id, languages)

    # If both failed, include both errors
    if 'error' in result:
        result['supadata_error'] = supadata_error

    return result

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'URL or video ID required'}))
        sys.exit(1)

    url = sys.argv[1]
    languages = sys.argv[2].split(',') if len(sys.argv) > 2 else ['en', 'ru']

    result = get_transcript(url, languages)
    print(json.dumps(result, ensure_ascii=False))

    # Exit with error code if failed
    if 'error' in result and 'transcript' not in result:
        sys.exit(1)

if __name__ == '__main__':
    main()

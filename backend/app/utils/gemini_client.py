"""
Gemini API client wrapper.
Handles API calls, retries, rate limiting, and error handling.
"""
import os
import time
import json
import re
import google.generativeai as genai
from typing import Optional

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY", "")
if API_KEY:
    genai.configure(api_key=API_KEY)

# Rate limiting state
_last_call_time = 0
_MIN_CALL_INTERVAL = 1.0  # seconds between calls (stay under 10 RPM)


class GeminiClient:
    """Wrapper around Gemini 2.5 Flash API."""

    def __init__(self, model_name: str = "gemini-flash-lite-latest"):
        self.model = genai.GenerativeModel(model_name)

    async def generate(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.2,
        max_retries: int = 2,
        json_mode: bool = False,
    ) -> str:
        """
        Generate a response from Gemini.

        Args:
            prompt: The user prompt/question.
            system_instruction: System prompt for the model.
            temperature: Creativity (0.0-1.0). Lower = more deterministic.
            max_retries: Number of retries on failure.
            json_mode: If True, request JSON output.

        Returns:
            The model's text response.
        """
        global _last_call_time

        # Rate limiting: wait if too soon since last call
        elapsed = time.time() - _last_call_time
        if elapsed < _MIN_CALL_INTERVAL:
            time.sleep(_MIN_CALL_INTERVAL - elapsed)

        # Build the model with system instruction
        model = genai.GenerativeModel(
            model_name=self.model.model_name,
            system_instruction=system_instruction if system_instruction else None,
        )

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": 4096,
        }

        if json_mode:
            generation_config["response_mime_type"] = "application/json"

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                _last_call_time = time.time()
                response = model.generate_content(
                    prompt,
                    generation_config=generation_config,
                )

                if response.text:
                    return response.text.strip()
                else:
                    return ""

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                # Rate limit error — wait and retry
                if "429" in error_str or "resource_exhausted" in error_str:
                    wait_time = (attempt + 1) * 5  # 5s, 10s, 15s
                    print(f"[WARN] Rate limited. Waiting {wait_time}s before retry {attempt + 1}...")
                    time.sleep(wait_time)
                    continue

                # Other errors — retry with backoff
                if attempt < max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue

        raise Exception(f"Gemini API failed after {max_retries + 1} attempts: {last_error}")

    async def generate_json(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.1,
    ) -> dict:
        """Generate a JSON response and parse it."""
        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=temperature,
            json_mode=True,
        )

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError(f"Could not parse JSON from response: {response[:200]}")


# Singleton instance
gemini = GeminiClient()

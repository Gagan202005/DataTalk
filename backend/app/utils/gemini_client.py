"""
Gemini API client wrapper.
Handles API calls, retries, rate limiting, and error handling.
Uses asyncio.sleep to avoid blocking the event loop.
"""
import os
import asyncio
import json
import re
from dotenv import load_dotenv
import google.generativeai as genai
from typing import Optional

load_dotenv()  # Force load .env in case it was created after server start

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY", "")
if API_KEY:
    genai.configure(api_key=API_KEY)

# Rate limiting state (per-process)
_last_call_time = 0.0
_call_lock = asyncio.Lock()
_MIN_CALL_INTERVAL = 0.5  # seconds between calls

# Default model — use a valid, available model
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


class GeminiClient:
    """Wrapper around Gemini Flash API. All I/O is non-blocking."""

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name

    def _build_model(self, system_instruction: str):
        """Build a GenerativeModel with optional system instruction."""
        return genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction if system_instruction else None,
        )

    async def generate(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.2,
        max_retries: int = 3,
        json_mode: bool = False,
    ) -> str:
        """
        Generate a response from Gemini (non-blocking).

        Args:
            prompt: The user prompt/question.
            system_instruction: System prompt for the model.
            temperature: Creativity (0.0-1.0). Lower = more deterministic.
            max_retries: Number of retries on failure.
            json_mode: If True, request JSON output via response_mime_type.

        Returns:
            The model's text response as a string.
        """
        global _last_call_time

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": 8192,
        }
        if json_mode:
            generation_config["response_mime_type"] = "application/json"

        model = self._build_model(system_instruction)
        last_error = None

        for attempt in range(max_retries + 1):
            # Rate limiting — compute sleep duration under the lock, then sleep outside it
            sleep_for = 0.0
            async with _call_lock:
                loop = asyncio.get_running_loop()
                now = loop.time()
                elapsed = now - _last_call_time
                if elapsed < _MIN_CALL_INTERVAL:
                    sleep_for = _MIN_CALL_INTERVAL - elapsed
                _last_call_time = loop.time() + sleep_for
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)

            try:
                # Run the blocking SDK call in a thread pool
                response = await asyncio.get_running_loop().run_in_executor(
                    None,
                    lambda: model.generate_content(
                        prompt,
                        generation_config=generation_config,
                    ),
                )

                if response.text:
                    return response.text.strip()
                # Empty response — treat as empty string
                return ""

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                if "429" in error_str or "resource_exhausted" in error_str:
                    wait_time = (attempt + 1) * 8  # 8s, 16s, 24s
                    print(f"[WARN] Rate limited. Waiting {wait_time}s (attempt {attempt + 1})...")
                    await asyncio.sleep(wait_time)
                    continue

                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s exponential
                    continue

        raise Exception(
            f"Gemini API failed after {max_retries + 1} attempts: {last_error}"
        )

    async def generate_json(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.1,
    ) -> dict:
        """Generate a JSON response and parse it robustly."""
        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=temperature,
            json_mode=True,
        )

        if not response:
            raise ValueError("Empty response from Gemini when JSON was expected.")

        # 1st attempt: direct parse
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # 2nd attempt: extract the outermost JSON object (handles extra text)
        json_match = re.search(r"\{.*\}", response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        raise ValueError(
            f"Could not parse JSON from Gemini response: {response[:300]}"
        )


# Singleton instance used across the whole application
gemini = GeminiClient()

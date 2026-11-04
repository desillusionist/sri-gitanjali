# Translation service research

External lookup performed on 25 August 2026 while evaluating a client-only translation path for secondary verse translations.

| Finding | Source |
| --- | --- |
| LibreTranslate accepts a `POST /translate` request with `q`, `source`, `target`, optional `format`, and a documented `api_key` field. | [LibreTranslate API Usage](https://docs.libretranslate.com/guides/api_usage/) |
| LibreTranslate lists direct English models for Bengali, Chinese, Hindi, Italian, Portuguese, Russian, Spanish, Thai, and Ukrainian. | [LibreTranslate Supported Languages](https://docs.libretranslate.com/guides/supported_languages/) |

The PWA therefore uses a server-side translation procedure and database cache rather than placing a third-party translation credential in the browser. This keeps credentials out of the client and caches translations by English-source hash.

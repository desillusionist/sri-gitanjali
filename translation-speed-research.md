# Translation speed research notes

## Reviewed sources

1. Chrome Translator API — https://developer.chrome.com/docs/ai/translator-api
   - The on-device API works in Chrome on desktop, not mobile.
   - Language packs download on demand.
   - The API processes translations sequentially; large requests block later requests.
   - The selected target languages are listed as supported: bn, es, hi, it, pt, ru, th, uk, and zh.
2. MDN Translator API — https://developer.mozilla.org/en-US/docs/Web/API/Translator
   - The API has limited browser availability and remains experimental.
3. Google Cloud Translation glossaries — https://docs.cloud.google.com/translate/docs/advanced/glossary
   - Advanced Translation supports a glossary to consistently translate domain-specific names and terms.
   - A production integration requires Cloud Translation setup, authentication, and a glossary resource.
4. Google Cloud language support — https://docs.cloud.google.com/translate/docs/languages
   - The documentation lists Bengali, Hindi, Russian, and Ukrainian for romanization/transliteration support; the feature is marked Preview.

## Current implementation finding

The current LLM service groups English verse explanations into up-to-2,800-character batches and processes those batches sequentially. This preserves a shared structured response but delays the first visible translation until the full song batch resolves.

## Microsoft Translator fallback findings

5. Azure Translator service limits — https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits
   - The documented F0 tier permits 2 million characters per hour and has no concurrent-request limit.
   - Standard-model responses for text below 100 characters are typically returned in 150–300 ms, but the documented maximum latency is 15 seconds.
   - Requests can contain up to 1,000 text elements and 50,000 characters in total.
6. Azure Translator language support — https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
   - Cloud text translation supports Bengali, Chinese, Hindi, Italian, Portuguese, Russian, Spanish, Thai, and Ukrainian.
   - The service defaults `pt` to Brazilian Portuguese (`pt-br`).

## Implementation implication

Microsoft Translator is technically suitable as a server-only time-boxed fallback for one verse at a time. It requires an Azure Translator resource and secret key, and it does not preserve the existing LLM prompt's controlled IAST-to-target-script terminology without a separate terminology layer or post-processing step.

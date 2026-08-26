# Alternatives for the Russian static translation package

Research date: 2026-08-26.

## Confirmed local route

Ollama documents local model execution on macOS, Windows, and Linux, including command-line model runs. This makes it suitable for an offline, one-time preparation workflow: the songbook remains on the user's computer and only the final `ru.json` needs to be added to the PWA.

The official Ollama model catalogue currently lists specialised translation models including TranslateGemma, HY-MT2, and translation-tuned Qwen variants. HY-MT2 is described there as multilingual, supports translation among 33 languages, and follows translation instructions; therefore it is the strongest first local experiment for an English-to-Russian package with an explicit IAST-to-Cyrillic prompt. The 1.8B version is appropriate for a feasibility check on modest hardware; a 7B version is preferable when the user's Mac can run it comfortably.

## Product decision

For this project, local generation is preferable to embedding a translator into the reader. A resumable script can continue to write the same `ru.partial.json` / `ru.json` schema, and the deployed PWA still lazy-loads only the finished JSON package when Russian is selected.

## Sources

1. [Ollama Quickstart](https://docs.ollama.com/quickstart)
2. [Ollama translation-model catalogue](https://ollama.com/search?q=translation)

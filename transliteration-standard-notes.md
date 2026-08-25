# Transliteration standard notes

The secondary-translation prompt treats the existing romanized Sanskrit and Bengali terms as **IAST / ISO 15919-style phonemic source forms**. For target languages that use a non-Latin script, it directs the model to write those terms in that target script, rather than retaining expanded Latin letters. For Latin-script target languages, it retains the canonical IAST spelling and diacritics.

| Finding | Implementation decision |
| --- | --- |
| ISO 15919 supplies transliteration tables from Indic scripts into Latin characters, including Devanagari and Bengali. | IAST/ISO 15919 values are the stable phonemic reference for interpreting source terms before rendering them in the selected target script. |
| Thai is not within the script set covered by ISO 15919. | Thai output is directed to a phonetic target-script rendering derived from the same IAST values, not claimed to be an ISO 15919 result. |

Source: [ISO — Transliteration of Indic scripts into Latin characters](https://www.iso.org/standard/87130.html).

const endpoint = `${process.env.OPENAI_API_BASE.replace(/\/$/, "")}/chat/completions`;

console.time("translation-probe");
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  signal: AbortSignal.timeout(180_000),
  body: JSON.stringify({
    model: "claude-haiku-4-5",
    messages: [
      { role: "system", content: "Translate English devotional prose into natural Russian. Write Sanskrit and Bengali terms in Russian Cyrillic by phonetic transliteration from IAST; do not leave IAST Latin letters." },
      { role: "user", content: "Translate into Russian: Śrī Kṛṣṇa Chaitanya Mahāprabhu teaches that the holy name should be worshipped with a humble heart." },
    ],
    max_tokens: 300,
  }),
});

console.timeEnd("translation-probe");
console.log(response.status, (await response.text()).slice(0, 600));

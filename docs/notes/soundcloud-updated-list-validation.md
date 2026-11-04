# Corrected SoundCloud source-list validation

The corrected user-provided list contains 126 SoundCloud links. Each link returned HTTP 200 from SoundCloud’s public oEmbed endpoint when checked in parallel on 25 August 2026.

The updated smart-matching run used both the user-provided label and the SoundCloud slug against catalogue titles and opening lines. It produced 79 automatic high-confidence candidates, 7 review candidates, 21 ambiguous candidates, and 19 unmatched candidates. Only high-confidence candidates and manually confirmed title/opening-line assignments were included in the deployed map.

The resulting overlay maps 122 corrected links to 112 catalogue songs. On `/song/jaya-radha-madhava-127`, the recording selector showed two versions and switching to **Recording 2** updated the selected source before playback. The multi-version Hare Krishna Mahāmantra assignment retains nine links from the corrected list.

After selecting **Recording 2** on 25 August 2026, the embedded player resolved to the SoundCloud track “Jaya Radha Madhava”, confirming that the compact selector and oEmbed request use the currently selected corrected link.

On the catalogue home page, enabling **With recordings** returned **112** matching songs, matching the corrected overlay’s 112 song assignments.

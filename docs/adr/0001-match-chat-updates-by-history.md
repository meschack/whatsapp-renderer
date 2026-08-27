# Match chat updates by shared history

Chat updates are matched by a consecutive message History anchor, not by filenames, display names, or participant lists. Names can change and collide, while group membership evolves; merging on either would risk silently combining unrelated conversations. An exact match of the stored tail is accepted, and a changed latest message is reconciled only when the five preceding messages match consecutively and its sender and timestamp still identify the same position. Ambiguous or absent anchors produce a separate Chat instead of a speculative merge.

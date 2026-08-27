# WhatsApp Chat Archive

This context turns exported WhatsApp snapshots into a durable, locally browsable conversation archive.

## Language

**Chat**:
A durable local conversation that may be enriched by several exports over time.
_Avoid_: Archive, ZIP, import

**Chat export**:
A point-in-time snapshot produced by WhatsApp containing a transcript and optional media.
_Avoid_: Chat, backup

**Chat update**:
A chat export whose shared history proves that it extends an existing Chat.
_Avoid_: Duplicate, replacement

**History anchor**:
A consecutive sequence of messages shared by a Chat and a Chat export that proves their continuity.
_Avoid_: Name match, filename match

**Reconciliation**:
The correction of the latest stored message when a History anchor proves that WhatsApp edited that message in a later Chat export.
_Avoid_: Replacement, duplicate removal

**Chat name hint**:
A display-name candidate extracted from an export filename or transcript filename; it helps naming but never proves Chat identity.
_Avoid_: Chat ID, conversation key

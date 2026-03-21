import { Message, MediaMap } from "@/models/types";

// Matches lines like: [12/02/2024, 21:33:10] Sender: message
// or [4/13/2025, 5:29:01 PM] Sender: message
// Leading invisible Unicode chars (U+200E LTR mark, U+200F RTL mark, U+FEFF BOM, etc.) are stripped
const MESSAGE_START_REGEX =
  /^[\u200e\u200f\u200b\u200c\u200d\ufeff\u202a-\u202e\u2066-\u2069]*\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(.+?)\]\s(.+)/;

const SENDER_MESSAGE_REGEX = /^([^:]+?):\s([\s\S]*)$/;

const MEDIA_OMITTED = "<Media omitted>";

const MEDIA_EXTENSIONS: Record<string, Message["mediaType"]> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  mp4: "video",
  mkv: "video",
  avi: "video",
  mov: "video",
  "3gp": "video",
  opus: "audio",
  mp3: "audio",
  m4a: "audio",
  ogg: "audio",
  aac: "audio",
  pdf: "document",
  doc: "document",
  docx: "document",
  xls: "document",
  xlsx: "document",
  ppt: "document",
  pptx: "document",
  txt: "document",
  zip: "document",
  vcf: "document",
};

function parseTimestamp(dateStr: string, timeStr: string): Date {
  // dateStr: "12/02/2024" or "4/13/2025"
  // timeStr: "21:33:10" or "5:29:01 PM"
  const dateParts = dateStr.split("/");
  let month: number, day: number, year: number;

  // Try to determine format - WhatsApp uses MM/DD/YYYY or DD/MM/YYYY
  // We'll try MM/DD/YYYY first (common in many locales)
  const p0 = parseInt(dateParts[0], 10);
  const p1 = parseInt(dateParts[1], 10);
  let p2 = parseInt(dateParts[2], 10);

  // If year is 2 digits, expand it
  if (p2 < 100) {
    p2 += 2000;
  }

  // Heuristic: if first part > 12, it must be day (DD/MM/YYYY)
  if (p0 > 12) {
    day = p0;
    month = p1;
    year = p2;
  } else if (p1 > 12) {
    // Second part > 12, it must be day (MM/DD/YYYY)
    month = p0;
    day = p1;
    year = p2;
  } else {
    // Ambiguous - default to MM/DD/YYYY
    month = p0;
    day = p1;
    year = p2;
  }

  // Parse time
  let timePart = timeStr.trim();
  let hours: number, minutes: number, seconds: number = 0;

  const isPM = /PM$/i.test(timePart);
  const isAM = /AM$/i.test(timePart);
  timePart = timePart.replace(/\s*(AM|PM)$/i, "");

  const timeParts = timePart.split(":");
  hours = parseInt(timeParts[0], 10);
  minutes = parseInt(timeParts[1], 10);
  if (timeParts[2]) {
    seconds = parseInt(timeParts[2], 10);
  }

  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function detectMediaInText(
  text: string,
  mediaMap: MediaMap
): { mediaType: Message["mediaType"]; mediaUri: string | null; cleanText: string | null } {
  // Strip invisible Unicode chars from the text for matching
  const stripped = text.replace(/[\u200e\u200f\u200b\u200c\u200d\ufeff\u202a-\u202e\u2066-\u2069]/g, "");

  if (stripped.trim() === MEDIA_OMITTED) {
    return { mediaType: "image", mediaUri: null, cleanText: null };
  }

  // Handle <attached: filename> pattern (WhatsApp export format)
  const attachedAngleMatch = stripped.match(/<attached:\s*(.+?)>/);
  if (attachedAngleMatch) {
    const filename = attachedAngleMatch[1].trim();
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const mediaType = MEDIA_EXTENSIONS[ext] ?? "document";
    const uri = mediaMap.get(filename) ?? null;
    return { mediaType, mediaUri: uri, cleanText: null };
  }

  const trimmed = stripped.trim();

  // Try exact match first (message is just a filename)
  if (mediaMap.has(trimmed)) {
    const ext = trimmed.split(".").pop()?.toLowerCase() ?? "";
    const mediaType = MEDIA_EXTENSIONS[ext] ?? "document";
    return { mediaType, mediaUri: mediaMap.get(trimmed)!, cleanText: null };
  }

  // Check if message contains "(file attached)" pattern
  const attachedMatch = trimmed.match(/^(.+?)\s*\(file attached\)$/i);
  if (attachedMatch) {
    const filename = attachedMatch[1].trim();
    if (mediaMap.has(filename)) {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const mediaType = MEDIA_EXTENSIONS[ext] ?? "document";
      return { mediaType, mediaUri: mediaMap.get(filename)!, cleanText: null };
    }
    // Even without a match in mediaMap, detect by extension
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (MEDIA_EXTENSIONS[ext]) {
      return { mediaType: MEDIA_EXTENSIONS[ext]!, mediaUri: null, cleanText: null };
    }
  }

  // Check if any known media filename appears in the text
  for (const [filename, uri] of mediaMap.entries()) {
    if (trimmed.includes(filename)) {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const mediaType = MEDIA_EXTENSIONS[ext] ?? "document";
      const cleanText = trimmed.replace(filename, "").trim() || null;
      return { mediaType, mediaUri: uri, cleanText };
    }
  }

  return { mediaType: null, mediaUri: null, cleanText: text };
}

// System message patterns
const SYSTEM_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /changed the subject/i,
  /changed this group/i,
  /created group/i,
  /added you/i,
  /joined using this group/i,
  /left$/i,
  /removed /i,
  /changed the group description/i,
  /changed their phone number/i,
  /security code changed/i,
  /disappeared message timer/i,
  /turned on disappearing messages/i,
  /turned off disappearing messages/i,
  /pinned a message/i,
  /you were added/i,
  /waiting for this message/i,
  /your security code with .+ changed/i,
];

function isSystemMessage(sender: string | null, text: string): boolean {
  if (!sender) return true;
  return SYSTEM_PATTERNS.some((pattern) => pattern.test(text));
}

export function parseChat(
  content: string,
  mediaMap: MediaMap,
  myName?: string
): { messages: Message[]; participants: string[] } {
  const lines = content.split("\n");
  const rawMessages: {
    date: string;
    time: string;
    sender: string | null;
    text: string;
  }[] = [];

  let current: (typeof rawMessages)[0] | null = null;

  for (const line of lines) {
    const startMatch = line.match(MESSAGE_START_REGEX);

    if (startMatch) {
      // Save previous message
      if (current) {
        rawMessages.push(current);
      }

      const date = startMatch[1];
      const time = startMatch[2];
      const rest = startMatch[3];

      const senderMatch = rest.match(SENDER_MESSAGE_REGEX);

      if (senderMatch) {
        current = {
          date,
          time,
          sender: senderMatch[1].trim(),
          text: senderMatch[2],
        };
      } else {
        // System message (no sender)
        current = {
          date,
          time,
          sender: null,
          text: rest,
        };
      }
    } else if (current) {
      // Continuation of previous message
      current.text += "\n" + line;
    }
  }

  // Don't forget the last message
  if (current) {
    rawMessages.push(current);
  }

  // Find participants
  const participantSet = new Set<string>();
  for (const msg of rawMessages) {
    if (msg.sender) {
      participantSet.add(msg.sender);
    }
  }
  const participants = Array.from(participantSet);

  // Determine "my" name - the user who exported the chat
  // If myName isn't provided, use heuristic: "You" messages or the most frequent sender
  let detectedMyName = myName ?? null;

  if (!detectedMyName && participants.length === 2) {
    // In 1-on-1 chats, we can't easily tell. We'll mark the first participant as "other"
    // Actually in WhatsApp exports, "You" is sometimes used, or we take the second participant
    // We'll let the user pick, but default to the sender with most messages
    const counts = new Map<string, number>();
    for (const msg of rawMessages) {
      if (msg.sender) {
        counts.set(msg.sender, (counts.get(msg.sender) ?? 0) + 1);
      }
    }
    // Most frequent sender is likely "me"
    let maxCount = 0;
    for (const [name, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        detectedMyName = name;
      }
    }
  }

  // Convert to Message objects
  const messages: Message[] = rawMessages.map((raw, index) => {
    const timestamp = parseTimestamp(raw.date, raw.time);
    const { mediaType, mediaUri, cleanText } = detectMediaInText(
      raw.text,
      mediaMap
    );
    const system = isSystemMessage(raw.sender, raw.text);

    return {
      id: `msg-${index}`,
      sender: raw.sender,
      text: cleanText,
      mediaType,
      mediaUri,
      timestamp,
      isMine: raw.sender === detectedMyName,
      isSystem: system && !raw.sender,
    };
  });

  return { messages, participants };
}

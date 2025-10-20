import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Removes HTML comments from markdown text
 * This prevents comments like <!-- TICKET_METADATA ... --> from being displayed
 */
export function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

export interface TicketMetadata {
  creatorUserId?: string;
  creatorEmail?: string;
  creatorName?: string;
  ownerRole?: string;
  createdAt?: string;
}

/**
 * Extracts TICKET_METADATA from HTML comments in markdown text
 * Returns both the parsed metadata and the text with the comment removed
 */
export function extractTicketMetadata(text: string): {
  metadata: TicketMetadata | null;
  cleanedText: string;
} {
  const metadataRegex = /<!--\s*TICKET_METADATA\s+({[\s\S]*?})\s*-->/;
  const match = text.match(metadataRegex);

  if (!match) {
    return {
      metadata: null,
      cleanedText: stripHtmlComments(text),
    };
  }

  try {
    const metadata = JSON.parse(match[1]) as TicketMetadata;
    const cleanedText = text.replace(metadataRegex, '').trim();

    return {
      metadata,
      cleanedText: stripHtmlComments(cleanedText),
    };
  } catch (error) {
    console.error('Failed to parse TICKET_METADATA:', error);
    return {
      metadata: null,
      cleanedText: stripHtmlComments(text),
    };
  }
}

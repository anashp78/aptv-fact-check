import { YoutubeTranscript } from "youtube-transcript";
import { logger } from "../lib/logger";

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export const transcriptService = {
  async fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
    logger.info({ videoId }, "Fetching YouTube transcript");

    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: "en",
      });

      const segments: TranscriptSegment[] = raw.map((item) => ({
        text: item.text,
        start: item.offset / 1000,
        duration: item.duration / 1000,
      }));

      logger.info(
        { videoId, segmentCount: segments.length },
        "Transcript fetched"
      );

      return segments;
    } catch (err) {
      logger.warn(
        { videoId, error: String(err) },
        "Failed to fetch transcript"
      );
      return [];
    }
  },

  formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  },

  segmentsToFullText(segments: TranscriptSegment[]): string {
    return segments.map((s) => s.text).join(" ");
  },
};

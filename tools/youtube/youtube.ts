/**
 * Uploads videos to the wol-sok-org YouTube channel, once each.
 *
 * YouTube has no service accounts: the API acts as the channel owner, through
 * an OAuth refresh token minted once with `youtube-auth.ts`. It reads
 * YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET and
 * YOUTUBE_OAUTH_REFRESH_TOKEN from the environment.
 *
 * A video carries the SHA-256 of its file as a tag (`sha256:<first 32 hex>`),
 * so a run finds what is on the channel already and uploads only new files:
 * every upload spends one of the project's 100 daily `videos.insert` calls.
 *
 * An API project that has not passed YouTube's compliance audit can upload
 * private videos only, whatever the requested privacy, and YouTube Studio
 * cannot lift that lock.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3/videos';
export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];
export const CLIENT_ID_ENV = 'YOUTUBE_OAUTH_CLIENT_ID';
export const CLIENT_SECRET_ENV = 'YOUTUBE_OAUTH_CLIENT_SECRET';
export const REFRESH_TOKEN_ENV = 'YOUTUBE_OAUTH_REFRESH_TOKEN';

/** What a video shows on YouTube. */
export interface VideoMeta {
  title: string;
  description: string;
  tags: string[];
  /** `en`, `de`: the language of the title, description and audio. */
  language: string;
  /** 20 is Gaming. */
  categoryId: string;
  privacy: 'private' | 'unlisted' | 'public';
}

/** A video on the channel. */
export interface ChannelVideo {
  id: string;
  /** `private` for every upload of a project YouTube has not audited. */
  privacy: string;
}

/** Upload states of a video that will never play. */
const BROKEN = new Set(['failed', 'rejected', 'deleted']);

/** True when the environment holds a refresh token to upload with. */
export function youtubeConfigured(): boolean {
  return [CLIENT_ID_ENV, CLIENT_SECRET_ENV, REFRESH_TOKEN_ENV].every(
    (name) => !!process.env[name]
  );
}

async function accessToken(): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env[CLIENT_ID_ENV] ?? '',
      client_secret: process.env[CLIENT_SECRET_ENV] ?? '',
      refresh_token: process.env[REFRESH_TOKEN_ENV] ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `YouTube token refresh failed: ${response.status} ${await response.text()}`
    );
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

/** The tag that names a file's content. */
export function hashTag(file: string): string {
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  return `sha256:${hash.slice(0, 32)}`;
}

export class YoutubeChannel {
  private constructor(private readonly token: string) {}

  public static async connect(): Promise<YoutubeChannel> {
    return new YoutubeChannel(await accessToken());
  }

  private async call<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!response.ok) {
      throw new Error(
        `YouTube ${init.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`
      );
    }
    return (await response.json()) as T;
  }

  /**
   * Every video on the channel that plays or will, by its tags; failed and
   * rejected uploads are left out, so their files go up again. The uploads
   * playlist lists a new video only after a few minutes: a run right after
   * another may upload its new files a second time.
   */
  public async videosByTag(): Promise<Map<string, ChannelVideo>> {
    const { items: channels = [] } = await this.call<{
      items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
    }>(`${API}/channels?part=contentDetails&mine=true`);
    const uploads = channels[0]?.contentDetails.relatedPlaylists.uploads;
    const byTag = new Map<string, ChannelVideo>();
    if (uploads == null) {
      return byTag;
    }
    let pageToken = '';
    do {
      const page = await this.call<{
        items?: { contentDetails: { videoId: string } }[];
        nextPageToken?: string;
      }>(
        `${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&pageToken=${pageToken}`
      );
      const ids = (page.items ?? []).map((item) => item.contentDetails.videoId);
      if (ids.length > 0) {
        const { items: videos = [] } = await this.call<{
          items?: {
            id: string;
            snippet: { tags?: string[] };
            status: { privacyStatus: string; uploadStatus: string };
          }[];
        }>(`${API}/videos?part=snippet,status&id=${ids.join(',')}`);
        for (const video of videos) {
          if (BROKEN.has(video.status.uploadStatus)) {
            continue;
          }
          for (const tag of video.snippet.tags ?? []) {
            byTag.set(tag, {
              id: video.id,
              privacy: video.status.privacyStatus,
            });
          }
        }
      }
      pageToken = page.nextPageToken ?? '';
    } while (pageToken);
    return byTag;
  }

  /** Uploads a file in one resumable session. */
  public async upload(
    file: string,
    meta: VideoMeta,
    tag: string
  ): Promise<ChannelVideo> {
    const session = await fetch(
      `${UPLOAD_API}?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(statSync(file).size),
        },
        body: JSON.stringify({
          snippet: {
            title: meta.title,
            description: meta.description,
            tags: [...meta.tags, tag],
            categoryId: meta.categoryId,
            defaultLanguage: meta.language,
            defaultAudioLanguage: meta.language,
          },
          status: {
            privacyStatus: meta.privacy,
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );
    const location = session.headers.get('location');
    if (!session.ok || location == null) {
      throw new Error(
        `YouTube upload session failed: ${session.status} ${await session.text()}`
      );
    }
    const video = await this.call<{
      id: string;
      status: { privacyStatus: string };
    }>(location, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: readFileSync(file),
    });
    console.log(
      `Uploaded ${file} as https://youtu.be/${video.id} (${video.status.privacyStatus}).`
    );
    return { id: video.id, privacy: video.status.privacyStatus };
  }
}

/**
 * Makes sure each file is on the channel and returns its video, by file: a
 * file whose hash tag is on a video already is not uploaded again. A video
 * locked to private before the audit stays so; delete it in YouTube Studio
 * for the next run to upload the file again.
 */
export async function publishVideos(
  videos: { file: string; meta: VideoMeta }[]
): Promise<Map<string, ChannelVideo>> {
  const channel = await YoutubeChannel.connect();
  const onChannel = await channel.videosByTag();
  const published = new Map<string, ChannelVideo>();
  for (const { file, meta } of videos) {
    const tag = hashTag(file);
    published.set(
      file,
      onChannel.get(tag) ?? (await channel.upload(file, meta, tag))
    );
  }
  return published;
}

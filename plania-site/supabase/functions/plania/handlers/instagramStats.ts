import { createClientFromRequest } from '../_shared/base44.ts';

// Admin-only: reads the connected Instagram account (profile, the recent posts and how people
// engage with them), saves one follower snapshot per day so growth can be charted, and returns it.
// Account insights (reach, profile views) need a scope this app does not have, so engagement is
// measured from the posts themselves instead.

const IG = 'https://graph.instagram.com/v21.0';
const PROFILE_FIELDS = 'username,name,profile_picture_url,followers_count,follows_count,media_count';
const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url';
const RECENT_POSTS = 24;

async function getJson(url) {
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Instagram ${response.status}`);
  }
  return json;
}

function engagementOf(media, followers) {
  const posts = media.length;
  const likes = media.reduce((sum, post) => sum + (Number(post.like_count) || 0), 0);
  const comments = media.reduce((sum, post) => sum + (Number(post.comments_count) || 0), 0);
  const perPost = posts ? (likes + comments) / posts : 0;
  return {
    posts,
    likes,
    comments,
    avg_likes: posts ? Math.round(likes / posts) : 0,
    avg_comments: posts ? Math.round((comments / posts) * 10) / 10 : 0,
    rate: followers ? Math.round((perPost / followers) * 1000) / 10 : 0,
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let token = '';
    try {
      const connection = await base44.asServiceRole.connectors.getConnection('instagram');
      token = connection?.accessToken || '';
    } catch {
      token = '';
    }
    if (!token) {
      return Response.json({ error: 'אינסטגרם עוד לא מחובר' }, { status: 400 });
    }

    let profile;
    try {
      profile = await getJson(`${IG}/me?fields=id,${PROFILE_FIELDS}&access_token=${token}`);
    } catch (error) {
      return Response.json({ error: `החיבור לאינסטגרם לא החזיר נתונים: ${error.message}` }, { status: 502 });
    }

    const followers = Number(profile.followers_count) || 0;
    const mediaJson = await getJson(
      `${IG}/${profile.id}/media?fields=${MEDIA_FIELDS}&limit=${RECENT_POSTS}&access_token=${token}`
    ).catch(() => ({ data: [] }));
    const media = mediaJson.data || [];
    const engagement = engagementOf(media, followers);

    // One snapshot per day, so followers can be followed over time
    try {
      const today = new Date().toISOString().slice(0, 10);
      const snapshot = {
        date: today,
        platform: 'instagram',
        followers,
        follows: Number(profile.follows_count || 0),
        media_count: Number(profile.media_count || 0),
      };
      const existing = await base44.asServiceRole.entities.SocialSnapshot.filter({ date: today, platform: 'instagram' });
      if (existing && existing[0]) {
        await base44.asServiceRole.entities.SocialSnapshot.update(existing[0].id, snapshot);
      } else {
        await base44.asServiceRole.entities.SocialSnapshot.create(snapshot);
      }
    } catch (error) {
      console.error('snapshot failed', error?.message);
    }

    const rows = await base44.asServiceRole.entities.SocialSnapshot.list('-date', 90).catch(() => []);
    const history = (rows || [])
      .filter((row) => row.platform === 'instagram')
      .map((row) => ({ date: row.date, followers: row.followers }))
      .reverse();

    return Response.json({
      success: true,
      profile,
      engagement,
      media,
      history,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
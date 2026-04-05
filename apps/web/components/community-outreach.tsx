'use client';

interface CommunityPost {
  redditTitle?: string;
  redditUrl?: string;
  redditPosted?: boolean;
  devforumTitle?: string;
  devforumUrl?: string;
  devforumPosted?: boolean;
  qualityScore?: number;
  postedAt?: string;
}

interface CommunityOutreachProps {
  lastPost: CommunityPost | null;
  postHistory: string[];
}

function getNextWednesday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilWed = day <= 3 ? 3 - day : 10 - day;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + (daysUntilWed === 0 && now.getUTCHours() >= 14 ? 7 : daysUntilWed));
  next.setUTCHours(14, 0, 0, 0);
  return next.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function CommunityOutreach({ lastPost, postHistory }: CommunityOutreachProps) {
  const totalPosts = postHistory.length;
  const hasReddit = !!lastPost?.redditPosted;
  const hasDevForum = !!lastPost?.devforumPosted;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Total Posts</div>
          <div className="mt-1 text-2xl font-bold">{totalPosts}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Communities</div>
          <div className="mt-1 text-2xl font-bold text-purple-400">
            {[hasReddit && 'Reddit', hasDevForum && 'DevForum'].filter(Boolean).join(', ') || 'None yet'}
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Next Scheduled</div>
          <div className="mt-1 text-lg font-bold text-brand-400">{getNextWednesday()}</div>
          <div className="text-xs text-gray-500">2pm UTC</div>
        </div>
      </div>

      {/* Latest post */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Latest Community Post</h3>

        {!lastPost ? (
          <div className="flex h-32 items-center justify-center text-gray-500">
            No community posts yet. The agent runs every Wednesday at 2pm UTC.
          </div>
        ) : (
          <div className="space-y-4">
            {lastPost.postedAt && (
              <div className="text-xs text-gray-500">
                Posted {new Date(lastPost.postedAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {lastPost.qualityScore && (
                  <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                    Quality: {lastPost.qualityScore}/10
                  </span>
                )}
              </div>
            )}

            {/* Reddit post */}
            {lastPost.redditTitle && (
              <div className="rounded-lg border border-gray-700 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-orange-600/20 px-2 py-0.5 text-xs font-bold text-orange-400">
                    Reddit
                  </span>
                  <span className="text-xs text-gray-500">r/robloxgamedev</span>
                  {lastPost.redditPosted ? (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">Posted</span>
                  ) : (
                    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-400">Draft</span>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-white">{lastPost.redditTitle}</p>
                {lastPost.redditUrl && (
                  <a
                    href={lastPost.redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-brand-400 hover:underline"
                  >
                    View on Reddit
                  </a>
                )}
              </div>
            )}

            {/* DevForum post */}
            {lastPost.devforumTitle && (
              <div className="rounded-lg border border-gray-700 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-600/20 px-2 py-0.5 text-xs font-bold text-blue-400">
                    DevForum
                  </span>
                  <span className="text-xs text-gray-500">devforum.roblox.com</span>
                  {lastPost.devforumPosted ? (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">Posted</span>
                  ) : (
                    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-400">Draft</span>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-white">{lastPost.devforumTitle}</p>
                {lastPost.devforumUrl && (
                  <a
                    href={lastPost.devforumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-brand-400 hover:underline"
                  >
                    View on DevForum
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post history */}
      {postHistory.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 font-semibold text-white">Post History</h3>
          <div className="space-y-2">
            {postHistory.slice().reverse().map((title, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="text-gray-600">{postHistory.length - i}.</span>
                {title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

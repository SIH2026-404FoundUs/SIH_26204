import { useEffect } from 'react'
import { Users, MapPin, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'

// Community Forum -- places other travellers have suggested via Suggest a
// Place, shown as one full-width card per post -- big enough to actually
// read the place and its photo, not a cramped grid tile. Every approved
// submission, no state restriction -- state is free text on submission
// (not a fixed list), so the forum doesn't gate on it either. Only ever
// approved submissions (GET /community/submissions/approved, public, same
// moderation workflow as everywhere else in this app) and always anonymous
// -- the backend never sends a userId for this endpoint, only aggregate
// like/dislike counts and the viewer's own reaction, so there's nothing
// here to accidentally deanonymize even with voting added.
export default function CommunityForum() {
  const { forumPosts, isLoadingForum, forumError, fetchForumPosts, reactToPost } = useTrustStore()

  useEffect(() => {
    fetchForumPosts()
  }, [fetchForumPosts])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Users}
        title="Community forum"
        description="Places other travellers have suggested, straight from Suggest a Place -- posted anonymously, reviewed by an authority before it shows up here."
      />

      {forumError && <Alert tone="error">{forumError}</Alert>}

      {isLoadingForum ? (
        <LoadingState label="Loading the forum…" />
      ) : forumPosts.length === 0 ? (
        <EmptyState icon={Users} title="Nothing here yet" description="No approved suggestions yet -- be the first from Suggest a Place." />
      ) : (
        <div className="space-y-5">
          {forumPosts.map((post) => (
            <Card key={post._id} padding="p-0" className="overflow-hidden">
              {post.photos?.length > 0 && (
                <img src={post.photos[0]} alt="" className="h-72 w-full object-cover" />
              )}
              <div className="p-6">
                <p className="font-display text-xl text-ink">{post.name}</p>
                <p className="mt-2 text-base text-ink/70">{post.description}</p>
                {post.state && (
                  <div className="mt-3">
                    <Badge tone="neutral" icon={MapPin}>{post.state}</Badge>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-2 border-t border-paper-dim pt-4">
                  <button
                    type="button"
                    onClick={() => reactToPost(post._id, 'like')}
                    aria-pressed={post.myReaction === 'like'}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      post.myReaction === 'like'
                        ? 'border-relief bg-relief/10 text-relief'
                        : 'border-paper-dim text-ink/70 hover:border-ink/30'
                    }`}
                  >
                    <ThumbsUp size={15} aria-hidden="true" />
                    {post.likeCount || 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => reactToPost(post._id, 'dislike')}
                    aria-pressed={post.myReaction === 'dislike'}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      post.myReaction === 'dislike'
                        ? 'border-pressure bg-pressure/10 text-pressure'
                        : 'border-paper-dim text-ink/70 hover:border-ink/30'
                    }`}
                  >
                    <ThumbsDown size={15} aria-hidden="true" />
                    {post.dislikeCount || 0}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

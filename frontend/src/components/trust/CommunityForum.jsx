import { useEffect, useState } from 'react'
import { Users, MapPin, UserRound } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'

const STATE_TABS = ['All', 'Himachal Pradesh', 'Telangana']

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  const units = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]]
  for (const [label, secs] of units) {
    const value = Math.floor(seconds / secs)
    if (value >= 1) return `${value}${label} ago`
  }
  return 'just now'
}

// Community Forum -- what other travellers have suggested via Suggest a
// Place, as a feed (spec: "twitter kind of posts"). Only ever approved
// submissions (GET /community/submissions/approved, public, same
// moderation workflow as everywhere else in this app) and always
// anonymous -- the backend never even sends a userId for this endpoint,
// so there's nothing here to accidentally deanonymize.
export default function CommunityForum() {
  const { forumPosts, isLoadingForum, forumError, fetchForumPosts } = useTrustStore()
  const [activeState, setActiveState] = useState('All')

  useEffect(() => {
    fetchForumPosts({ state: activeState === 'All' ? undefined : activeState })
  }, [activeState, fetchForumPosts])

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        icon={Users}
        title="Community forum"
        description="Places other travellers have suggested, straight from Suggest a Place -- posted anonymously, reviewed by an authority before it shows up here."
      />

      <div className="mb-6 flex gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
        {STATE_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setActiveState(s)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeState === s ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {forumError && <Alert tone="error">{forumError}</Alert>}

      {isLoadingForum ? (
        <LoadingState label="Loading the forum…" />
      ) : forumPosts.length === 0 ? (
        <EmptyState icon={Users} title="Nothing here yet" description="No approved suggestions for this state yet -- be the first from Suggest a Place." />
      ) : (
        <div className="space-y-3">
          {forumPosts.map((post) => (
            <Card key={post._id} padding="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                  <UserRound size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-ink">A traveller</span>
                    <span className="text-xs text-ash">&middot; {timeAgo(post.approvedAt || post.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-display text-base text-ink">{post.name}</p>
                  <p className="mt-1 text-sm text-ink/80">{post.description}</p>

                  {post.photos?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {post.photos.map((url) => (
                        <img key={url} src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}

                  {post.state && (
                    <div className="mt-2">
                      <Badge tone="neutral" icon={MapPin}>{post.state}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

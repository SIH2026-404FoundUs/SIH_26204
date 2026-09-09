import { useEffect, useState } from 'react'
import { Users, MapPin } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'

const STATE_TABS = ['All', 'Himachal Pradesh', 'Telangana']

// Community Forum -- places other travellers have suggested via Suggest a
// Place, shown as a simple card grid (spec: "just be able to see suggested
// place as cards"), view-only -- no posting/commenting/liking here. Only
// ever approved submissions (GET /community/submissions/approved, public,
// same moderation workflow as everywhere else in this app) and always
// anonymous -- the backend never even sends a userId for this endpoint, so
// there's nothing here to accidentally deanonymize.
export default function CommunityForum() {
  const { forumPosts, isLoadingForum, forumError, fetchForumPosts } = useTrustStore()
  const [activeState, setActiveState] = useState('All')

  useEffect(() => {
    fetchForumPosts({ state: activeState === 'All' ? undefined : activeState })
  }, [activeState, fetchForumPosts])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        icon={Users}
        title="Community forum"
        description="Places other travellers have suggested, straight from Suggest a Place -- posted anonymously, reviewed by an authority before it shows up here."
      />

      <div className="mb-6 flex w-full max-w-sm gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forumPosts.map((post) => (
            <Card key={post._id} padding="p-0" className="overflow-hidden">
              {post.photos?.length > 0 && (
                <img src={post.photos[0]} alt="" className="h-40 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="font-display text-base text-ink">{post.name}</p>
                <p className="mt-1.5 line-clamp-3 text-sm text-ink/70">{post.description}</p>
                {post.state && (
                  <div className="mt-3">
                    <Badge tone="neutral" icon={MapPin}>{post.state}</Badge>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

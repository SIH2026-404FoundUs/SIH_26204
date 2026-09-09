import { useEffect, useState } from 'react'
import { Users, MapPin, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'
import { inputClass } from '../ui/FormField'

// All 28 Indian states (union territories excluded on purpose -- the ask
// was specifically "28 states"), so the filter dropdown lets a traveller
// browse by any state regardless of what's actually been suggested there
// yet -- unlike the submit-side state field (free text, no fixed list),
// this dropdown's whole job is letting someone pick a state that might
// currently have zero posts.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
]

// Community Forum -- places other travellers have suggested via Suggest a
// Place, shown two cards per row. Every approved submission is fetched
// unfiltered, then filtered client-side by the selected state (an exact,
// case-insensitive match against whatever free text was submitted -- the
// dropdown itself always lists all 28 states, not just the ones with
// posts). Only ever approved submissions (GET /community/submissions/
// approved, public, same moderation workflow as everywhere else in this
// app) and always anonymous -- the backend never sends a userId for this
// endpoint, only aggregate like/dislike counts and the viewer's own
// reaction, so there's nothing here to accidentally deanonymize even with
// voting added.
export default function CommunityForum() {
  const { forumPosts, isLoadingForum, forumError, fetchForumPosts, reactToPost } = useTrustStore()
  const [selectedState, setSelectedState] = useState('')

  useEffect(() => {
    fetchForumPosts()
  }, [fetchForumPosts])

  const visiblePosts = selectedState
    ? forumPosts.filter((p) => p.state?.trim().toLowerCase() === selectedState.toLowerCase())
    : forumPosts

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={Users}
        title="Community forum"
        description="Places other travellers have suggested, straight from Suggest a Place -- posted anonymously, reviewed by an authority before it shows up here."
      />

      <div className="mb-5 max-w-xs">
        <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className={inputClass}>
          <option value="">All states</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {forumError && <Alert tone="error">{forumError}</Alert>}

      {isLoadingForum ? (
        <LoadingState label="Loading the forum…" />
      ) : visiblePosts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nothing here yet"
          description={selectedState ? `No approved suggestions for ${selectedState} yet.` : 'No approved suggestions yet -- be the first from Suggest a Place.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visiblePosts.map((post) => (
            <Card key={post._id} padding="p-0" className="overflow-hidden">
              {post.photos?.length > 0 && (
                <img src={post.photos[0]} alt="" className="h-36 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="font-display text-lg text-ink">{post.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink/70">{post.description}</p>
                {post.state && (
                  <div className="mt-2">
                    <Badge tone="neutral" icon={MapPin}>{post.state}</Badge>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t border-paper-dim pt-3">
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

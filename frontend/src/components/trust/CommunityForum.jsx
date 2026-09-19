import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, MapPin, MapPinned, ThumbsUp, ThumbsDown, MessageCircle, Share2, Eye, Check, Send } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { timeAgo } from '../../lib/time'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
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

// A single comment row -- anonymized the same way the post itself is (no
// userId ever sent down, just `isMine` computed server-side against the
// viewer).
function CommentRow({ comment }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[10px] font-bold text-ink/60">
        {comment.isMine ? 'Me' : 'T'}
      </span>
      <div className="min-w-0 flex-1 rounded-2xl bg-paper-dim/60 px-3 py-1.5">
        <p className="text-xs text-ink">{comment.text}</p>
      </div>
      <span className="mt-1 shrink-0 text-[10px] text-ash">{timeAgo(comment.createdAt)}</span>
    </div>
  )
}

// One forum post, styled like a social feed card: author row, body, photo,
// then a like/dislike/comment/share action bar -- same data as before
// (approved Suggest-a-Place submissions), just presented the way a social
// feed presents a post instead of a plain content card.
function ForumPost({ post, onReact, onComment, isCommenting }) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [shared, setShared] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/forum`
    const shareData = { title: post.name, text: `${post.name} -- suggested on Sahyatri`, url }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      // user dismissed the native share sheet -- not an error worth surfacing
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault()
    if (!draft.trim()) return
    const ok = await onComment(post._id, draft.trim())
    if (ok) setDraft('')
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
          <MapPinned size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">A traveller suggested</p>
          <p className="text-xs text-ash">{timeAgo(post.createdAt)}{post.state ? ` · ${post.state}` : ''}</p>
        </div>
        {post.state && (
          <Badge tone="neutral" icon={MapPin} className="hidden sm:inline-flex">{post.state}</Badge>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="font-display text-lg text-ink">{post.name}</p>
        <p className="mt-1 text-sm text-ink/70">{post.description}</p>
      </div>

      {post.photos?.length > 0 && (
        <img src={post.photos[0]} alt="" className="max-h-96 w-full object-cover" />
      )}

      <div className="flex items-center gap-1.5 px-4 pt-3 text-xs text-ash">
        <Eye size={13} aria-hidden="true" />
        {post.viewCount || 0} {post.viewCount === 1 ? 'view' : 'views'}
        {(post.likeCount > 0 || post.dislikeCount > 0) && (
          <span>· {post.likeCount || 0} {post.likeCount === 1 ? 'like' : 'likes'}</span>
        )}
        {post.commentCount > 0 && <span>· {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 border-t border-paper-dim px-2 py-1.5">
        <button
          type="button"
          onClick={() => onReact(post._id, 'like')}
          aria-pressed={post.myReaction === 'like'}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            post.myReaction === 'like' ? 'text-relief' : 'text-ink/60 hover:bg-ink/5'
          }`}
        >
          <ThumbsUp size={16} aria-hidden="true" /> Like
        </button>
        <button
          type="button"
          onClick={() => onReact(post._id, 'dislike')}
          aria-pressed={post.myReaction === 'dislike'}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            post.myReaction === 'dislike' ? 'text-pressure' : 'text-ink/60 hover:bg-ink/5'
          }`}
        >
          <ThumbsDown size={16} aria-hidden="true" /> Dislike
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-pressed={commentsOpen}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            commentsOpen ? 'text-ink' : 'text-ink/60 hover:bg-ink/5'
          }`}
        >
          <MessageCircle size={16} aria-hidden="true" /> Comment
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-ink/60 transition hover:bg-ink/5"
        >
          {shared ? <Check size={16} aria-hidden="true" className="text-relief" /> : <Share2 size={16} aria-hidden="true" />}
          {shared ? 'Copied' : 'Share'}
        </button>
      </div>

      {commentsOpen && (
        <div className="space-y-2.5 border-t border-paper-dim bg-paper-dim/20 p-4">
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment…"
              maxLength={500}
              className={`${inputClass} py-2 text-xs`}
            />
            <Button type="submit" size="sm" variant="primary" loading={isCommenting} disabled={!draft.trim()}>
              <Send size={13} aria-hidden="true" />
            </Button>
          </form>
          {post.comments?.length > 0 ? (
            <div className="space-y-2">
              {post.comments.map((c) => <CommentRow key={c._id} comment={c} />)}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-ash">No comments yet -- be the first to say something.</p>
          )}
        </div>
      )}
    </Card>
  )
}

// Community Forum -- places other travellers have suggested via Suggest a
// Place, shown as a social-style feed: one post per row, like/dislike,
// views and comments, share. Every approved submission is fetched
// unfiltered, then filtered client-side by the selected state (an exact,
// case-insensitive match against whatever free text was submitted -- the
// dropdown itself always lists all 28 states, not just the ones with
// posts). Only ever approved submissions (GET /community/submissions/
// approved, public, same moderation workflow as everywhere else in this
// app) and always anonymous -- the backend never sends a userId for this
// endpoint, only aggregate like/dislike/view counts, comments (each
// anonymized to just text + isMine), and the viewer's own reaction, so
// there's nothing here to accidentally deanonymize even with voting and
// commenting added.
export default function CommunityForum() {
  const { forumPosts, isLoadingForum, forumError, fetchForumPosts, reactToPost, commentOnPost, isCommenting } = useTrustStore()
  const [selectedState, setSelectedState] = useState('')

  useEffect(() => {
    fetchForumPosts()
  }, [fetchForumPosts])

  const visiblePosts = selectedState
    ? forumPosts.filter((p) => p.state?.trim().toLowerCase() === selectedState.toLowerCase())
    : forumPosts

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={Users}
        title="Community forum"
        description="Places other travellers have suggested, straight from Suggest a Place -- posted anonymously, reviewed by an authority before it shows up here."
      />

      <Link
        to="/community"
        className="mb-5 flex items-center gap-4 rounded-2xl border border-paper-dim bg-ink px-5 py-4 text-paper transition hover:bg-ink-soft"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper/15">
          <MapPinned size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base">Know somewhere worth visiting?</span>
          <span className="block text-xs text-paper/70">Suggest a place and it could show up right here for every traveller.</span>
        </span>
        <span className="shrink-0 rounded-lg bg-paper px-3.5 py-2 text-xs font-semibold text-ink">Suggest a place</span>
      </Link>

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
        <div className="space-y-4">
          {visiblePosts.map((post) => (
            <ForumPost key={post._id} post={post} onReact={reactToPost} onComment={commentOnPost} isCommenting={isCommenting} />
          ))}
        </div>
      )}
    </div>
  )
}

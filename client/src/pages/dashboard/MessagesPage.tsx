import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { messageApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, SafeImage, Skeleton, Spinner, UserAvatar } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import { formatDate, formatIDR, formatTime, timeAgo } from '@/utils/format';
import type { Message } from '@/types';

function ConversationList({ activeId }: { activeId?: string }) {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messageApi.list().then((r) => r.items),
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (isError) return <p className="p-4 text-sm text-red-700">{errorMessage(error)}</p>;
  if (!data?.length) {
    return (
      <div className="p-6 text-center text-sm text-muted">
        <MessageCircle className="mx-auto mb-2 size-6" /> No conversations yet. Message an owner from any item page.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {data.map((c) => (
        <li key={c.id}>
          <Link to={`/dashboard/messages/${c.id}`} className={cn('flex gap-3 p-4 transition-colors hover:bg-stone-50', activeId === c.id && 'bg-brand-50/60 hover:bg-brand-50')}>
            <UserAvatar name={c.otherUser?.name ?? '?'} src={c.otherUser?.profileImage} className="size-11" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn('truncate text-sm', c.unreadCount ? 'font-extrabold' : 'font-semibold')}>{c.otherUser?.name ?? 'Deleted user'}</p>
                {c.lastMessage && <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessage.createdAt)}</span>}
              </div>
              {c.listing && <p className="truncate text-xs text-brand-700">{c.listing.title}</p>}
              <div className="flex items-center gap-2">
                <p className={cn('truncate text-sm', c.unreadCount ? 'font-semibold text-ink' : 'text-muted')}>
                  {c.lastMessage?.senderId === user?.id && 'You: '}
                  {c.lastMessage?.content}
                </p>
                {c.unreadCount > 0 && <span className="ml-auto shrink-0 rounded-full bg-brand-700 px-1.5 text-[11px] font-bold text-white">{c.unreadCount}</span>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function groupByDay(messages: Message[]) {
  const groups: { day: string; items: Message[] }[] = [];
  for (const m of messages) {
    const day = formatDate(m.createdAt, 'EEEE, d MMM yyyy');
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}

function Thread({ id }: { id: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => messageApi.get(id).then((r) => r.conversation),
    refetchInterval: 5_000,
  });

  const count = data?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    // Opening the thread marks messages as read on the server; refresh badges.
    qc.invalidateQueries({ queryKey: ['counts'] });
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [count, qc]);

  const send = useMutation({
    mutationFn: (text: string) => messageApi.send(id, text),
    onSuccess: () => {
      setContent('');
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Spinner className="h-full" />;
  if (isError || !data) return <div className="p-6"><ErrorState message={errorMessage(error)} /></div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <Link to="/dashboard/messages" className="rounded-lg p-1.5 hover:bg-stone-100 lg:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-5" />
        </Link>
        <UserAvatar name={data.otherUser?.name ?? '?'} src={data.otherUser?.profileImage} />
        <div className="min-w-0 flex-1">
          {data.otherUser ? (
            <Link to={`/users/${data.otherUser.id}`} className="font-bold hover:underline">
              {data.otherUser.name}
            </Link>
          ) : (
            <p className="font-bold">Deleted user</p>
          )}
          <p className="text-xs text-muted">{data.otherUser?.city}</p>
        </div>
        {data.listing && (
          <Link to={`/items/${data.listing.id}`} className="hidden items-center gap-2 rounded-xl border border-line p-1.5 pr-3 hover:bg-stone-50 sm:flex">
            <SafeImage src={data.listing.image} alt="" className="size-9 rounded-lg" />
            <span className="max-w-40 text-xs">
              <span className="block truncate font-semibold">{data.listing.title}</span>
              <span className="text-muted">{formatIDR(data.listing.dailyPrice)}/day</span>
            </span>
          </Link>
        )}
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto bg-stone-50/60 p-4" aria-live="polite">
        {groupByDay(data.messages).map((g) => (
          <div key={g.day} className="space-y-2">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{g.day}</p>
            {g.items.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-white')}>
                    <span className="sr-only">{mine ? 'You' : data.otherUser?.name}: </span>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-brand-100' : 'text-muted')}>
                      {formatTime(m.createdAt)}
                      {mine && (m.readAt ? ' · Read' : ' · Sent')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (content.trim()) send.mutate(content.trim());
        }}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (content.trim()) send.mutate(content.trim());
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
        />
        <Button type="submit" size="icon" className="h-11 w-11" disabled={!content.trim()} loading={send.isPending} aria-label="Send message">
          {!send.isPending && <Send />}
        </Button>
      </form>
    </div>
  );
}

export function MessagesPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Messages</h1>
      <Card className="grid h-[calc(100dvh-14rem)] min-h-[480px] overflow-hidden lg:grid-cols-[320px_1fr]">
        <div className={cn('overflow-y-auto border-line lg:border-r', id && 'hidden lg:block')}>
          <ConversationList activeId={id} />
        </div>
        <div className={cn('min-h-0', !id && 'hidden lg:block')}>
          {id ? (
            <Thread key={id} id={id} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState icon={MessageCircle} title="Select a conversation" description="Choose a conversation to read and reply." className="border-0" />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

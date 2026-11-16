import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { messageApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { Button } from './ui/button';
import { Textarea } from './ui/form-controls';
import { Dialog, DialogContent } from './ui/dialog';

export function ContactDialog({
  open,
  onOpenChange,
  recipient,
  listing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipient: { id: string; name: string };
  listing?: { id: string; title: string };
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [content, setContent] = useState(listing ? `Hi ${recipient.name.split(' ')[0]}, is "${listing.title}" available? ` : '');
  const send = useMutation({
    mutationFn: () => messageApi.start({ recipientId: recipient.id, listingId: listing?.id, content: content.trim() }),
    onSuccess: ({ conversationId }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Message sent');
      onOpenChange(false);
      navigate(`/dashboard/messages/${conversationId}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Message ${recipient.name}`} description="Ask about the item, pickup times or delivery. Keep payments on Rentora.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) send.mutate();
          }}
          className="space-y-4"
        >
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} rows={5} aria-label="Message" autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={send.isPending} disabled={!content.trim()}>
              Send message
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDb } from '../helpers.js';

beforeEach(resetDb);

describe('messaging', () => {
  it('sends and receives messages with unread indicators', async () => {
    const alice = await createUser({ name: 'Alice' });
    const bob = await createUser({ name: 'Bob' });

    const start = await alice.agent.post('/api/conversations').send({ recipientId: bob.user.id, content: 'Hi Bob, is the tent available?' });
    expect(start.status).toBe(201);
    const convId = start.body.conversationId;

    // Starting again reuses the same thread
    const again = await alice.agent.post('/api/conversations').send({ recipientId: bob.user.id, content: 'Hello again' });
    expect(again.body.conversationId).toBe(convId);

    expect((await bob.agent.get('/api/me/counts')).body.messages).toBe(2);
    const list = (await bob.agent.get('/api/conversations')).body.items;
    expect(list).toHaveLength(1);
    expect(list[0].unreadCount).toBe(2);
    expect(list[0].otherUser.name).toBe('Alice');

    const conv = (await bob.agent.get(`/api/conversations/${convId}`)).body.conversation;
    expect(conv.messages.map((m: { content: string }) => m.content)).toEqual(['Hi Bob, is the tent available?', 'Hello again']);
    expect((await bob.agent.get('/api/me/counts')).body.messages).toBe(0);

    const reply = await bob.agent.post(`/api/conversations/${convId}/messages`).send({ content: 'Yes it is!' });
    expect(reply.status).toBe(201);
    expect(reply.body.message.senderId).toBe(bob.user.id);
    expect((await alice.agent.get('/api/me/counts')).body.messages).toBe(1);
  });

  it('blocks access to conversations the user is not part of', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const eve = await createUser();
    const convId = (await alice.agent.post('/api/conversations').send({ recipientId: bob.user.id, content: 'Private' })).body.conversationId;

    expect((await eve.agent.get(`/api/conversations/${convId}`)).status).toBe(404);
    expect((await eve.agent.post(`/api/conversations/${convId}/messages`).send({ content: 'Sneaky' })).status).toBe(404);
    expect((await eve.agent.get('/api/conversations')).body.items).toHaveLength(0);
  });

  it('validates messages and recipients', async () => {
    const alice = await createUser();
    expect((await alice.agent.post('/api/conversations').send({ recipientId: alice.user.id, content: 'me' })).status).toBe(400);
    expect((await alice.agent.post('/api/conversations').send({ recipientId: 'nobody123', content: 'hi' })).status).toBe(404);
    const bob = await createUser();
    expect((await alice.agent.post('/api/conversations').send({ recipientId: bob.user.id, content: '   ' })).status).toBe(400);
  });

  it('notifications can be listed and marked read only by their owner', async () => {
    const alice = await createUser();
    const bob = await createUser();
    await alice.agent.post('/api/conversations').send({ recipientId: bob.user.id, content: 'Ping' });
    const list = (await bob.agent.get('/api/notifications')).body;
    expect(list.unread).toBe(1);
    const id = list.items[0].id;
    expect((await alice.agent.post(`/api/notifications/${id}/read`)).status).toBe(404);
    expect((await bob.agent.post(`/api/notifications/${id}/read`)).status).toBe(200);
    expect((await bob.agent.get('/api/me/counts')).body.notifications).toBe(0);
  });
});

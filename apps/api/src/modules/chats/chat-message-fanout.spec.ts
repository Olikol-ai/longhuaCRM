describe('ChatGateway message fan-out contract', () => {
  it('emitMessageCreated fans out to user rooms and skips unread for viewers', async () => {
    const emit = jest.fn();
    const to = jest.fn((_room?: string) => ({ emit }));
    const fetchSockets = jest.fn().mockResolvedValue([
      { data: { actor: { sub: 'viewer-1' } } },
    ]);
    const server = {
      to: to as unknown as (room: string) => { emit: typeof emit },
      in: jest.fn((_room?: string) => ({ fetchSockets })) as unknown as (room: string) => {
        fetchSockets: typeof fetchSockets;
      },
    };

    const members = [
      { userId: 'sender-1' },
      { userId: 'viewer-1' },
      { userId: 'away-1' },
    ];
    const memberRepo = {
      find: jest.fn().mockResolvedValue(members),
    };
    const chats = {
      unreadSummary: jest.fn().mockResolvedValue({ total: 2, byChat: { 'chat-1': 2 } }),
    };

    async function emitMessageCreated(message: {
      chatId: string;
      senderUserId: string | null;
    }) {
      const payload = { id: 'msg-1', chat_id: message.chatId };
      server.to(`chat:${message.chatId}`).emit('message.created', payload);

      const rows = (await memberRepo.find({ where: { chatId: message.chatId } })) as Array<{
        userId: string;
      }>;
      const recipientIds = rows
        .map((row) => row.userId)
        .filter((id) => id && id !== message.senderUserId);

      const socketsInChat = await server.in(`chat:${message.chatId}`).fetchSockets();
      const viewingUserIds = new Set(
        socketsInChat
          .map((sock: { data?: { actor?: { sub?: string } } }) => sock.data?.actor?.sub)
          .filter((id): id is string => Boolean(id)),
      );

      for (const member of rows) {
        server.to(`user:${member.userId}`).emit('message.created', payload);
      }

      for (const userId of recipientIds) {
        if (viewingUserIds.has(userId)) continue;
        const summary = await chats.unreadSummary({
          sub: userId,
          email: `${userId}@test`,
          role: 'student',
        });
        server.to(`user:${userId}`).emit('chat.unread', summary);
      }
    }

    await emitMessageCreated({ chatId: 'chat-1', senderUserId: 'sender-1' });

    expect(to).toHaveBeenCalledWith('chat:chat-1');
    expect(to).toHaveBeenCalledWith('user:sender-1');
    expect(to).toHaveBeenCalledWith('user:viewer-1');
    expect(to).toHaveBeenCalledWith('user:away-1');
    expect(chats.unreadSummary).toHaveBeenCalledTimes(1);
    expect(chats.unreadSummary).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'away-1' }),
    );
    const unreadEmits = emit.mock.calls.filter((call) => call[0] === 'chat.unread');
    expect(unreadEmits).toHaveLength(1);
  });
});

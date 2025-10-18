const FriendsPage = {
  _root: null,
  _friends: [],
  _searchResults: [],
  _searchQuery: "",
  _activeFriendId: null,
  _conversation: [],
  _conversationLoading: false,
  _sending: false,
  _requestsIncoming: [],
  _requestsOutgoing: [],
  _blocked: [],
  _blockedBy: new Set(),
  _emojiOptions: ["😀", "😂", "😍", "😢", "😡", "👍", "🎉", "🤔", "🙏", "🌟"],
  render() {
    return `<div class="card friends-card" id="friends-root"><div class="muted">加载中...</div></div>`;
  },
  async bind() {
    this._root = document.getElementById("friends-root");
    this._friends = [];
    this._searchResults = [];
    this._searchQuery = "";
    this._activeFriendId = null;
    this._conversation = [];
    this._requestsIncoming = [];
    this._requestsOutgoing = [];
    this._blocked = [];
    this._blockedBy = new Set();
    await this.reload(false);
  },
  presence() {
    if (this._activeFriendId) {
      const friend = this._friends.find(item => item.user_id === this._activeFriendId);
      return {
        activity: "friends:chat",
        details: {
          with: friend?.username,
          id: friend?.user_id || this._activeFriendId,
        },
      };
    }
    return { activity: "friends:list" };
  },
  async reload(keepActive = true) {
    if (!this._root) return;
    try {
      const data = await API.friendsList();
      const list = Array.isArray(data?.friends) ? data.friends : [];
      this._friends = list.map(item => ({
        user_id: Number(item.user_id || item.id || 0),
        username: item.username || "神秘玩家",
        friend_since: Number(item.friend_since || 0),
        last_message: item.last_message || null,
      }));
      this._requestsIncoming = Array.isArray(data?.requests?.incoming) ? data.requests.incoming : [];
      this._requestsOutgoing = Array.isArray(data?.requests?.outgoing) ? data.requests.outgoing : [];
      this._blocked = Array.isArray(data?.blocked) ? data.blocked : [];
      const blockedBy = Array.isArray(data?.blocked_by) ? data.blocked_by : [];
      this._blockedBy = new Set(blockedBy.map(id => Number(id)));
      if (!keepActive || !this._friends.some(f => f.user_id === this._activeFriendId)) {
        this._activeFriendId = this._friends.length ? this._friends[0].user_id : null;
        this._conversation = [];
      }
      if (this._activeFriendId) {
        await this.loadConversation(this._activeFriendId, false);
      } else {
        this.renderState();
      }
    } catch (e) {
      this._root.innerHTML = `<div class="error">加载好友失败：${escapeHtml(e.message || e)}</div>`;
    } finally {
      window.PresenceTracker?.updateDetails?.(this.presence());
    }
  },
  formatTime(ts) {
    if (!ts) return "刚刚";
    try {
      const date = new Date(Number(ts) * 1000);
      if (Number.isNaN(date.getTime())) return "刚刚";
      return date.toLocaleString("zh-CN", { hour12: false });
    } catch (e) {
      void e;
      return "刚刚";
    }
  },
  renderState() {
    if (!this._root) return;
    const activeId = this._activeFriendId;
    const meId = API._me?.user_id != null ? Number(API._me.user_id) : null;
    const blockedBySet = this._blockedBy instanceof Set ? this._blockedBy : new Set();
    const friendsList = this._friends.length
      ? this._friends.map(friend => {
          const isActive = friend.user_id === activeId;
          const lastMsg = friend.last_message ? String(friend.last_message.content || "") : "";
          const preview = lastMsg
            ? escapeHtml(lastMsg.length > 24 ? `${lastMsg.slice(0, 24)}…` : lastMsg)
            : '<span class="muted">暂无消息</span>';
          const since = friend.friend_since ? this.formatTime(friend.friend_since) : "";
          return `
            <button class="friends-list__item${isActive ? ' active' : ''}" data-friend-id="${friend.user_id}">
              <div class="friends-list__name">${escapeHtml(friend.username)}</div>
              <div class="friends-list__meta">
                <span class="friends-list__preview">${preview}</span>
                ${since ? `<span class="friends-list__time">${escapeHtml(since)}</span>` : ''}
              </div>
            </button>`;
        }).join("")
      : '<div class="friends-list__empty">还没有好友，尝试搜索并添加吧。</div>';

    const renderSearchAction = (result) => {
      const status = (result?.status || 'available').toString();
      if (status === 'available') {
        return `<button class="btn btn-mini" data-add-id="${result.user_id}">添加</button>`;
      }
      const statusMap = {
        friend: '已是好友',
        pending_outgoing: '等待对方通过',
        pending_incoming: '对方向你发出申请',
        blocked: '已被你拉黑',
        blocked_by: '对方已拉黑你',
      };
      const text = statusMap[status] || '不可添加';
      return `<span class="friends-search__status">${escapeHtml(text)}</span>`;
    };

    const searchResults = this._searchResults.length
      ? this._searchResults.map(result => `
          <div class="friends-search__result">
            <div class="friends-search__info">
              <div class="name">${escapeHtml(result.username)}</div>
              <div class="meta">ID ${escapeHtml(String(result.user_id))}</div>
            </div>
            ${renderSearchAction(result)}
          </div>
        `).join("")
      : (this._searchQuery
          ? '<div class="friends-search__empty">未找到相关玩家。</div>'
          : '<div class="friends-search__hint">输入玩家ID或用户名搜索。</div>');

    const incomingRequests = this._requestsIncoming.length
      ? this._requestsIncoming.map(req => {
          const username = escapeHtml(req?.user?.username || '神秘玩家');
          const id = Number(req?.user?.user_id || req?.user_id || 0);
          const time = req?.created_at ? this.formatTime(req.created_at) : '';
          return `
            <div class="friends-request" data-user-id="${id}">
              <div class="friends-request__info">
                <div class="name">${username}</div>
                <div class="meta">ID ${escapeHtml(String(id))}${time ? ` · ${escapeHtml(time)}` : ''}</div>
              </div>
              <div class="friends-request__actions">
                <button class="btn btn-mini primary" data-request-accept="${req.request_id}" data-user-id="${id}">同意</button>
                <button class="btn btn-mini" data-request-reject="${req.request_id}">拒绝</button>
              </div>
            </div>`;
        }).join("")
      : '<div class="friends-section__empty">暂无待处理请求。</div>';

    const outgoingRequests = this._requestsOutgoing.length
      ? this._requestsOutgoing.map(req => {
          const username = escapeHtml(req?.user?.username || '神秘玩家');
          const id = Number(req?.user?.user_id || req?.user_id || 0);
          const time = req?.created_at ? this.formatTime(req.created_at) : '';
          return `
            <div class="friends-request" data-user-id="${id}">
              <div class="friends-request__info">
                <div class="name">${username}</div>
                <div class="meta">等待对方通过 · ID ${escapeHtml(String(id))}${time ? ` · ${escapeHtml(time)}` : ''}</div>
              </div>
              <div class="friends-request__actions">
                <button class="btn btn-mini" data-request-cancel="${req.request_id}">撤回</button>
              </div>
            </div>`;
        }).join("")
      : '<div class="friends-section__empty">暂无待审核的申请。</div>';

    const blockedList = this._blocked.length
      ? this._blocked.map(entry => {
          const id = Number(entry.user_id || entry.target_id || 0);
          const time = entry?.blocked_at ? this.formatTime(entry.blocked_at) : '';
          return `
            <div class="friends-blocked__item">
              <div class="friends-blocked__info">
                <div class="name">${escapeHtml(entry.username || '神秘玩家')}</div>
                <div class="meta">ID ${escapeHtml(String(id))}${time ? ` · ${escapeHtml(time)}` : ''}</div>
              </div>
              <button class="btn btn-mini" data-unblock-id="${id}">取消拉黑</button>
            </div>`;
        }).join("")
      : '<div class="friends-section__empty">未拉黑任何玩家。</div>';

    const conversation = this._conversationLoading
      ? '<div class="friends-chat__loading">正在载入对话...</div>'
      : this.renderConversation(meId);
    const activeFriend = this._friends.find(item => item.user_id === activeId) || null;
    const headerActions = activeFriend
      ? `<div class="friends-chat__toolbar">
          <button class="btn btn-mini" data-remove-friend="${activeFriend.user_id}">删除好友</button>
          <button class="btn btn-mini danger" data-block-friend="${activeFriend.user_id}">拉黑</button>
        </div>`
      : '';
    const headerNotice = activeFriend && blockedBySet.has(activeFriend.user_id)
      ? '<div class="friends-chat__notice">对方已将你拉黑，无法发送消息。</div>'
      : '';
    const header = activeFriend
      ? `
        <div class="friends-chat__header">
          <div>
            <div class="title">${escapeHtml(activeFriend.username)}</div>
            <div class="subtitle">ID ${escapeHtml(String(activeFriend.user_id))}</div>
          </div>
          ${headerActions}
        </div>
        ${headerNotice}`
      : '<div class="friends-chat__placeholder">请选择一位好友开始聊天。</div>';
    const chatDisabled = activeFriend ? blockedBySet.has(activeFriend.user_id) : false;
    const emojiButtons = this._emojiOptions.map(emoji => `
      <button type="button" class="friends-emoji" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>
    `).join('');
    const chatInput = activeFriend
      ? (chatDisabled
          ? '<div class="friends-chat__disabled">对方已拉黑你，无法继续发送消息。</div>'
          : `
            <form class="friends-chat__form" id="friend-message-form">
              <textarea id="friend-message-input" rows="2" placeholder="输入消息..." maxlength="1000"></textarea>
              <div class="friends-chat__emoji" id="friend-emoji-bar">${emojiButtons}</div>
              <div class="friends-chat__actions">
                <button type="submit" class="btn primary">发送</button>
              </div>
            </form>
          `)
      : '';
    this._root.innerHTML = `
      <div class="friends-container">
        <aside class="friends-sidebar">
          <form class="friends-search" id="friend-search-form">
            <input id="friend-search-input" type="text" placeholder="搜索ID或用户名" value="${escapeHtml(this._searchQuery)}" />
            <button type="submit" class="btn">搜索</button>
          </form>
          <div class="friends-search__results" id="friend-search-results">${searchResults}</div>
          <div class="friends-section" id="friends-requests-in">
            <div class="friends-section__title">待处理申请</div>
            <div class="friends-section__body">${incomingRequests}</div>
          </div>
          <div class="friends-section" id="friends-requests-out">
            <div class="friends-section__title">我的申请</div>
            <div class="friends-section__body">${outgoingRequests}</div>
          </div>
          <div class="friends-section" id="friends-blocked">
            <div class="friends-section__title">已拉黑</div>
            <div class="friends-section__body">${blockedList}</div>
          </div>
          <div class="friends-list" id="friends-list">${friendsList}</div>
        </aside>
        <section class="friends-chat">
          ${header}
          <div class="friends-chat__messages" id="friend-messages">${conversation}</div>
          ${chatInput}
        </section>
      </div>
    `;
    this.bindEvents();
    this.scrollMessages();
    window.PresenceTracker?.updateDetails?.(this.presence());
  },
  renderConversation(meId) {
    if (!Array.isArray(this._conversation) || !this._conversation.length) {
      return '<div class="friends-chat__empty">暂无聊天记录，发送第一条消息吧。</div>';
    }
    return this._conversation.map(msg => {
      const outgoing = meId != null && Number(msg.sender_id) === meId;
      const cls = outgoing ? 'outgoing' : 'incoming';
      const time = this.formatTime(msg.timestamp);
      return `
        <div class="friend-message ${cls}">
          <div class="friend-message__bubble">${escapeHtml(msg.content || '')}</div>
          <div class="friend-message__meta">${escapeHtml(time)}</div>
        </div>
      `;
    }).join('');
  },
  bindEvents() {
    if (!this._root) return;
    const searchForm = this._root.querySelector('#friend-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const input = this._root.querySelector('#friend-search-input');
        const query = input ? input.value.trim() : '';
        this._searchQuery = query;
        if (!query) {
          this._searchResults = [];
          this.renderState();
          return;
        }
        try {
          const data = await API.friendsSearch(query);
          this._searchResults = Array.isArray(data?.results) ? data.results : [];
          this.renderState();
        } catch (e) {
          alert(e.message || e);
        }
      });
    }
    const addButtons = this._root.querySelectorAll('[data-add-id]');
    addButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.addId);
        if (!Number.isFinite(id) || id <= 0) return;
        try {
          btn.disabled = true;
          await API.friendsAdd({ target_id: id });
          this._searchResults = [];
          await this.reload(true);
        } catch (e) {
          alert(e.message || e);
        } finally {
          btn.disabled = false;
        }
      });
    });
    const friendItems = this._root.querySelectorAll('[data-friend-id]');
    friendItems.forEach(item => {
      item.addEventListener('click', async () => {
        const id = Number(item.dataset.friendId);
        if (!Number.isFinite(id) || id <= 0) return;
        if (this._activeFriendId === id && !this._conversationLoading) return;
        await this.loadConversation(id);
      });
    });
    const acceptButtons = this._root.querySelectorAll('[data-request-accept]');
    acceptButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const reqId = Number(btn.dataset.requestAccept);
        const userId = Number(btn.dataset.userId || 0);
        if (!Number.isFinite(reqId) || reqId <= 0) return;
        try {
          btn.disabled = true;
          await API.friendsRespond(reqId, 'accept');
          if (Number.isFinite(userId) && userId > 0) {
            this._activeFriendId = userId;
          }
          await this.reload(true);
        } catch (e) {
          alert(e.message || e);
        } finally {
          btn.disabled = false;
        }
      });
    });
    const rejectButtons = this._root.querySelectorAll('[data-request-reject]');
    rejectButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const reqId = Number(btn.dataset.requestReject);
        if (!Number.isFinite(reqId) || reqId <= 0) return;
        try {
          btn.disabled = true;
          await API.friendsRespond(reqId, 'reject');
          await this.reload(true);
        } catch (e) {
          alert(e.message || e);
        } finally {
          btn.disabled = false;
        }
      });
    });
    const cancelButtons = this._root.querySelectorAll('[data-request-cancel]');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const reqId = Number(btn.dataset.requestCancel);
        if (!Number.isFinite(reqId) || reqId <= 0) return;
        try {
          btn.disabled = true;
          await API.friendsCancelRequest(reqId);
          await this.reload(true);
        } catch (e) {
          alert(e.message || e);
        } finally {
          btn.disabled = false;
        }
      });
    });
    const unblockButtons = this._root.querySelectorAll('[data-unblock-id]');
    unblockButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.unblockId);
        if (!Number.isFinite(id) || id <= 0) return;
        try {
          btn.disabled = true;
          await API.friendsUnblock(id);
          await this.reload(true);
        } catch (e) {
          alert(e.message || e);
        } finally {
          btn.disabled = false;
        }
      });
    });
    const removeBtn = this._root.querySelector('[data-remove-friend]');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        const id = Number(removeBtn.dataset.removeFriend);
        if (!Number.isFinite(id) || id <= 0) return;
        if (!confirm('确定要删除该好友吗？')) return;
        try {
          removeBtn.disabled = true;
          await API.friendsRemove(id);
          if (this._activeFriendId === id) {
            this._activeFriendId = null;
          }
          await this.reload(false);
        } catch (e) {
          alert(e.message || e);
        } finally {
          removeBtn.disabled = false;
        }
      });
    }
    const blockBtn = this._root.querySelector('[data-block-friend]');
    if (blockBtn) {
      blockBtn.addEventListener('click', async () => {
        const id = Number(blockBtn.dataset.blockFriend);
        if (!Number.isFinite(id) || id <= 0) return;
        if (!confirm('拉黑后将解除好友关系，确认继续吗？')) return;
        try {
          blockBtn.disabled = true;
          await API.friendsBlock(id);
          if (this._activeFriendId === id) {
            this._activeFriendId = null;
          }
          await this.reload(false);
        } catch (e) {
          alert(e.message || e);
        } finally {
          blockBtn.disabled = false;
        }
      });
    }
    const messageForm = this._root.querySelector('#friend-message-form');
    if (messageForm) {
      messageForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (this._sending) return;
        const textarea = this._root.querySelector('#friend-message-input');
        const content = textarea ? textarea.value.trim() : '';
        if (!content) {
          alert('请输入消息内容');
          return;
        }
        if (!this._activeFriendId) return;
        try {
          this._sending = true;
          const resp = await API.friendsSendMessage(this._activeFriendId, content);
          if (textarea) textarea.value = '';
          const message = resp?.message || null;
          if (message) {
            if (!Array.isArray(this._conversation)) this._conversation = [];
            this._conversation.push(message);
            const friend = this._friends.find(item => item.user_id === this._activeFriendId);
            if (friend) {
              friend.last_message = message;
            }
          }
          this.renderState();
        } catch (e) {
          alert(e.message || e);
        } finally {
          this._sending = false;
        }
      });
    }
    const emojiButtons = this._root.querySelectorAll('[data-emoji]');
    if (emojiButtons.length) {
      emojiButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const emoji = btn.dataset.emoji || '';
          const textarea = this._root?.querySelector('#friend-message-input');
          if (!textarea) return;
          textarea.value = `${textarea.value || ''}${emoji}`;
          textarea.focus();
        });
      });
    }
  },
  scrollMessages() {
    const wrap = this._root?.querySelector('.friends-chat__messages');
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  },
  async loadConversation(friendId, showSpinner = true) {
    if (!friendId) return;
    this._activeFriendId = friendId;
    if (showSpinner) {
      this._conversationLoading = true;
      this.renderState();
    }
    try {
      const data = await API.friendsConversation(friendId);
      this._conversation = Array.isArray(data?.messages) ? data.messages : [];
    } catch (e) {
      alert(e.message || e);
    } finally {
      this._conversationLoading = false;
      this.renderState();
    }
  },
};

window.FriendsPage = FriendsPage;

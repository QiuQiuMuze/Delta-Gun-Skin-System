const FriendsPage = {
  _root: null,
  _friends: [],
  _searchResults: [],
  _searchQuery: "",
  _activeFriendId: null,
  _conversation: [],
  _conversationLoading: false,
  _sending: false,
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
    const searchResults = this._searchResults.length
      ? this._searchResults.map(result => `
          <div class="friends-search__result">
            <div class="friends-search__info">
              <div class="name">${escapeHtml(result.username)}</div>
              <div class="meta">ID ${escapeHtml(String(result.user_id))}</div>
            </div>
            <button class="btn btn-mini" data-add-id="${result.user_id}">添加</button>
          </div>
        `).join("")
      : (this._searchQuery
          ? '<div class="friends-search__empty">未找到相关玩家。</div>'
          : '<div class="friends-search__hint">输入玩家ID或用户名搜索。</div>');
    const conversation = this._conversationLoading
      ? '<div class="friends-chat__loading">正在载入对话...</div>'
      : this.renderConversation(meId);
    const activeFriend = this._friends.find(item => item.user_id === activeId) || null;
    const header = activeFriend
      ? `<div class="friends-chat__header"><div class="title">${escapeHtml(activeFriend.username)}</div><div class="subtitle">ID ${escapeHtml(String(activeFriend.user_id))}</div></div>`
      : '<div class="friends-chat__placeholder">请选择一位好友开始聊天。</div>';
    const chatInput = activeFriend
      ? `
        <form class="friends-chat__form" id="friend-message-form">
          <textarea id="friend-message-input" rows="2" placeholder="输入消息..." maxlength="1000"></textarea>
          <div class="friends-chat__actions">
            <button type="submit" class="btn primary">发送</button>
          </div>
        </form>
      `
      : '';
    this._root.innerHTML = `
      <div class="friends-container">
        <aside class="friends-sidebar">
          <form class="friends-search" id="friend-search-form">
            <input id="friend-search-input" type="text" placeholder="搜索ID或用户名" value="${escapeHtml(this._searchQuery)}" />
            <button type="submit" class="btn">搜索</button>
          </form>
          <div class="friends-search__results" id="friend-search-results">${searchResults}</div>
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

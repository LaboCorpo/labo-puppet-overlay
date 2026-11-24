/*
 * OBS Studio remote (obs-websocket v5, built into OBS 28+: Tools → WebSocket Server Settings).
 * Used by BabaDeck buttons and the stream health panel: scenes, sources, mute, stream / record, stats.
 * Reconnects every 10 s while enabled; never throws into the caller's event loop.
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');

const SUBS = 1 | 4 | 8 | 64 | 128; // General, Scenes, Inputs, Outputs, SceneItems
const sha = (s) => crypto.createHash('sha256').update(s).digest('base64');
function authString(password, salt, challenge) { return sha(sha(password + salt) + challenge); }

class Obs extends EventEmitter {
  constructor(o) {
    super();
    this.o = o; // { getSettings() -> {enabled, host, port}, getPassword(), log, WebSocket? }
    this.ws = null;
    this.pending = new Map();
    this.seq = 0;
    this.timer = 0;
    this.state = { status: 'off', detail: '', scenes: [], current: '', inputs: [], muted: {}, streaming: false, recording: false, replay: false, items: {}, stats: null };
  }
  snapshot() { return this.state; }
  set(p) { Object.assign(this.state, p); this.emit('change', this.state); }

  restart() { this.stop(); const s = this.o.getSettings(); if (s.enabled) this.connect(); else this.set({ status: 'off', detail: '' }); }
  stop() { clearTimeout(this.timer); clearInterval(this.statsTimer); const w = this.ws; this.ws = null; if (w) try { w.close(); } catch (e) { /* closed */ } for (const p of this.pending.values()) p.reject(new Error('OBS disconnected')); this.pending.clear(); }

  connect() {
    const s = this.o.getSettings();
    if (!s.enabled || this.ws) return;
    const WS = this.o.WebSocket || globalThis.WebSocket;
    const host = /^[\w.-]{1,100}$/.test(s.host || '') ? s.host : '127.0.0.1';
    let ws;
    try { ws = new WS(`ws://${host}:${s.port || 4455}`); } catch (e) { this.retry(e.message); return; }
    this.ws = ws;
    this.set({ status: 'connecting', detail: '' });
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(String(ev.data)); } catch (e) { return; } this.onMessage(m).catch((e) => this.o.log && this.o.log.warn('[obs] ' + e.message)); };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearInterval(this.statsTimer);
      for (const p of this.pending.values()) p.reject(new Error('OBS disconnected'));
      this.pending.clear();
      const auth = ev && ev.code === 4009;
      this.retry(auth ? 'Wrong OBS WebSocket password' : 'OBS is not reachable (is it open, with the WebSocket server on?)', auth);
    };
    ws.onerror = () => {};
  }
  retry(detail, auth) {
    this.set({ status: auth ? 'auth' : 'error', detail });
    clearTimeout(this.timer);
    if (auth) return; // wait for a new password
    this.timer = setTimeout(() => this.connect(), 10000);
  }

  async onMessage(m) {
    const d = m.d || {};
    if (m.op === 0) { // Hello
      const id = { rpcVersion: 1, eventSubscriptions: SUBS };
      if (d.authentication) id.authentication = authString(this.o.getPassword() || '', d.authentication.salt, d.authentication.challenge);
      this.send(1, id);
    } else if (m.op === 2) { // Identified
      this.set({ status: 'connected', detail: '' });
      await this.refresh();
      clearInterval(this.statsTimer);
      this.statsTimer = setInterval(() => this.pollStats(), 5000);
    } else if (m.op === 7) { // RequestResponse
      const p = this.pending.get(d.requestId);
      if (!p) return;
      this.pending.delete(d.requestId);
      if (d.requestStatus && d.requestStatus.result) p.resolve(d.responseData || {});
      else p.reject(new Error((d.requestStatus && d.requestStatus.comment) || 'OBS refused the request'));
    } else if (m.op === 5) this.onEvent(d.eventType, d.eventData || {});
  }
  onEvent(type, e) {
    switch (type) {
      case 'CurrentProgramSceneChanged': this.set({ current: e.sceneName }); break;
      case 'SceneListChanged': case 'InputCreated': case 'InputRemoved': case 'InputNameChanged': case 'SceneNameChanged': this.refresh().catch(() => {}); break;
      case 'InputMuteStateChanged': this.set({ muted: Object.assign({}, this.state.muted, { [e.inputName]: !!e.inputMuted }) }); break;
      case 'StreamStateChanged': this.set({ streaming: !!e.outputActive }); break;
      case 'RecordStateChanged': this.set({ recording: !!e.outputActive }); break;
      case 'ReplayBufferStateChanged': this.set({ replay: !!e.outputActive }); break;
      case 'SceneItemEnableStateChanged': this.set({ items: Object.assign({}, this.state.items, { [e.sceneName + '\u0000' + e.sceneItemId]: !!e.sceneItemEnabled }) }); break;
      default:
    }
  }
  send(op, d) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ op, d })); }
  request(requestType, requestData) {
    if (!this.ws || this.state.status !== 'connected') return Promise.reject(new Error('OBS is not connected'));
    const requestId = 'r' + ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.send(6, { requestType, requestId, requestData: requestData || {} });
      setTimeout(() => { if (this.pending.delete(requestId)) reject(new Error('OBS did not answer')); }, 8000);
    });
  }

  async refresh() {
    const sc = await this.request('GetSceneList');
    const scenes = (sc.scenes || []).map((x) => x.sceneName).reverse(); // OBS lists bottom-up
    const inputs = ((await this.request('GetInputList')).inputs || []).map((x) => x.inputName);
    const muted = {};
    for (const name of inputs.slice(0, 60)) { try { muted[name] = !!(await this.request('GetInputMute', { inputName: name })).inputMuted; } catch (e) { /* not an audio input */ } }
    let streaming = false, recording = false;
    try { streaming = !!(await this.request('GetStreamStatus')).outputActive; } catch (e) { /* ignore */ }
    try { recording = !!(await this.request('GetRecordStatus')).outputActive; } catch (e) { /* ignore */ }
    this.set({ scenes, current: sc.currentProgramSceneName || '', inputs: Object.keys(muted), muted, streaming, recording });
  }
  async sources(sceneName) {
    const r = await this.request('GetSceneItemList', { sceneName });
    return (r.sceneItems || []).map((x) => ({ id: x.sceneItemId, name: x.sourceName, enabled: !!x.sceneItemEnabled }));
  }
  async pollStats() {
    try {
      const st = await this.request('GetStats');
      let out = {};
      try { out = await this.request('GetStreamStatus'); } catch (e) { /* not streaming */ }
      this.set({ stats: { fps: Math.round(st.activeFps || 0), cpu: Math.round(st.cpuUsage || 0), renderSkipped: st.renderSkippedFrames || 0, renderTotal: st.renderTotalFrames || 0,
        outputSkipped: out.outputSkippedFrames || 0, outputTotal: out.outputTotalFrames || 0, congestion: Math.round((out.outputCongestion || 0) * 100), bytes: out.outputBytes || 0, duration: out.outputTimecode || '', at: Date.now() } });
    } catch (e) { /* not connected */ }
  }

  // ---------- Actions for BabaDeck ----------
  async run(a) {
    switch (a.type) {
      case 'obs.scene': return this.request('SetCurrentProgramScene', { sceneName: a.scene });
      case 'obs.mute': return this.request('ToggleInputMute', { inputName: a.input });
      case 'obs.stream': return this.request(a.mode === 'start' ? 'StartStream' : a.mode === 'stop' ? 'StopStream' : 'ToggleStream');
      case 'obs.record': return this.request(a.mode === 'start' ? 'StartRecord' : a.mode === 'stop' ? 'StopRecord' : 'ToggleRecord');
      case 'obs.replay': return this.request('SaveReplayBuffer');
      case 'obs.source': {
        const items = await this.sources(a.scene);
        const it = items.find((x) => x.name === a.source);
        if (!it) throw new Error('Source not found in this scene');
        const enabled = a.mode === 'show' ? true : a.mode === 'hide' ? false : !it.enabled;
        return this.request('SetSceneItemEnabled', { sceneName: a.scene, sceneItemId: it.id, sceneItemEnabled: enabled });
      }
      default: throw new Error('Unknown OBS action');
    }
  }
}

module.exports = { Obs, authString };

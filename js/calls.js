/**
 * calls.js
 * Audio and video calls, straight between your two phones (WebRTC).
 *
 * Firebase is only used to set the call up ("signalling"):
 *   spaces/{space}/calls/{id}                { id, from, to, kind, state, offer, answer, ts, startedAt, endedAt }
 *   spaces/{space}/calls/{id}/candidates/{x} { from, c }   network routes found by each phone
 * The sound and video themselves go directly between the phones and
 * never pass through Firebase or Cloudflare.
 *
 * The other phone rings through a notification (even when closed) and
 * an incoming-call screen whenever the app is open. The caller logs the
 * call in the chat when it ends ("Video call · 4:12", "Missed call").
 */

const Calls = (() => {
  const RING_MS = 45 * 1000;
  const ICE = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
  const CONNECT_MS = 30 * 1000; // give up if the phones can't reach each other

  // Direct routes first; the relay (if set up) for networks that block them.
  async function iceConfig() {
    const relay = await Cloud.iceServers();
    return relay.length ? [...ICE, ...relay] : ICE;
  }

  let active = null; // the one call in progress
  let incomingOff = null;
  let ignore = new Set(); // calls already handled on this phone

  const me = () => Auth.currentUser();
  const other = () => Auth.otherUser();
  const calls = () => Cloud.space().collection("calls");
  const supported = () => Boolean(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  function friendlyMediaError(err, kind) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError")
      return kind === "video" ? "Camera or microphone access is off. Allow it in your settings to call." : "Microphone access is off. Allow it in your settings to call.";
    if (name === "NotFoundError") return kind === "video" ? "No camera or microphone found." : "No microphone found.";
    if (name === "NotReadableError") return "Your camera or microphone is busy in another app.";
    return "Couldn't start the call.";
  }

  function getMedia(kind, facing = "user") {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: kind === "video" ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  }

  // ---------------------------------------------------------------
  // Gentle ring sounds (synthesized, no files)
  // ---------------------------------------------------------------
  let audioCtx = null;
  function sound() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx.state === "running" ? audioCtx : null;
  }
  function chime(notes, vol) {
    const ctx = sound();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    notes.forEach(([freq, at, len]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + len + 0.05);
    });
  }
  const RING = [[659, 0, 0.5], [784, 0.18, 0.55], [988, 0.36, 0.8]];
  const BACK = [[440, 0, 0.9], [480, 0, 0.9]];
  function startTone(kind) {
    stopTone();
    const play = () => (kind === "ring" ? chime(RING, 0.18) : chime(BACK, 0.05));
    play();
    toneTimer = setInterval(play, kind === "ring" ? 2200 : 3000);
    if (kind === "ring" && navigator.vibrate) vibTimer = setInterval(() => navigator.vibrate([300, 200, 300]), 2200);
  }
  let toneTimer = null;
  let vibTimer = null;
  function stopTone() {
    clearInterval(toneTimer);
    clearInterval(vibTimer);
    toneTimer = vibTimer = null;
    if (navigator.vibrate) navigator.vibrate(0);
  }

  // ---------------------------------------------------------------
  // Screen
  // ---------------------------------------------------------------
  function screenHtml(call, peer, mode) {
    const isVideo = call.kind === "video";
    const label = isVideo ? "Video call" : "Voice call";
    const backdrop = Avatars.photoOf(peer.id);
    return `
      <div class="call-screen call-screen--${mode} ${isVideo ? "call-screen--video" : "call-screen--audio"}" role="dialog" aria-modal="true" aria-label="${label} with ${UI.escape(peer.displayName)}">
        <div class="call-screen__backdrop" ${backdrop ? `style="background-image:url('${UI.escape(backdrop)}')"` : ""}></div>
        <video class="call-screen__remote" autoplay playsinline></video>
        <video class="call-screen__local" autoplay playsinline muted></video>
        <div class="call-screen__top">
          <div class="call-screen__who">
            <span class="call-screen__face">${Avatars.html(peer, "avatar--hero")}<span class="call-screen__waves" aria-hidden="true"><i></i><i></i><i></i></span></span>
            <h2 class="call-screen__name">${UI.escape(peer.displayName)}</h2>
            <p class="call-screen__status" aria-live="polite">${mode === "incoming" ? `${label}…` : "Calling…"}</p>
          </div>
        </div>
        <button type="button" class="call-screen__unmute" hidden>Tap to hear ${UI.escape(peer.displayName)}</button>
        <div class="call-screen__controls">
          ${
            mode === "incoming"
              ? `
            <button type="button" class="call-btn call-btn--decline" data-act="decline" aria-label="Decline">${UI.icon("phone")}<span>Decline</span></button>
            <button type="button" class="call-btn call-btn--accept" data-act="accept" aria-label="Accept">${UI.icon(isVideo ? "video" : "phone")}<span>Accept</span></button>`
              : `
            <button type="button" class="call-btn" data-act="mute" aria-pressed="false" aria-label="Mute">${UI.icon("mic")}<span>Mute</span></button>
            ${isVideo ? `<button type="button" class="call-btn" data-act="camera" aria-pressed="false" aria-label="Turn camera off">${UI.icon("video")}<span>Camera</span></button>` : ""}
            ${isVideo ? `<button type="button" class="call-btn" data-act="flip" aria-label="Switch camera">${UI.icon("flip")}<span>Flip</span></button>` : ""}
            <button type="button" class="call-btn call-btn--end" data-act="end" aria-label="End call">${UI.icon("phone")}<span>End</span></button>`
          }
        </div>
      </div>`;
  }

  function mount(call, peer, mode) {
    unmount();
    const host = document.createElement("div");
    host.innerHTML = screenHtml(call, peer, mode);
    const el = host.firstElementChild;
    document.body.appendChild(el);
    document.body.classList.add("in-call");
    el.addEventListener("click", onControl);
    return el;
  }
  function unmount() {
    document.querySelectorAll(".call-screen").forEach((el) => {
      el.classList.add("call-screen--leaving");
      setTimeout(() => el.remove(), 380);
    });
    document.body.classList.remove("in-call");
  }
  function setStatus(text) {
    const s = document.querySelector(".call-screen:not(.call-screen--leaving) .call-screen__status");
    if (s) s.textContent = text;
  }

  // ---------------------------------------------------------------
  // Shared connection plumbing
  // ---------------------------------------------------------------
  function connect(call, stream, role, iceServers = ICE) {
    const pc = new RTCPeerConnection({ iceServers });
    // The caller offers its tracks right away; the answering phone attaches
    // its own once it has read the offer (see sendOwnTracks), which is the
    // order Safari needs to actually send its camera.
    if (role === "caller") stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const remote = new MediaStream();
    pc.ontrack = (e) => {
      const add = (t) => {
        if (!remote.getTracks().includes(t)) remote.addTrack(t);
      };
      e.streams[0] ? e.streams[0].getTracks().forEach(add) : add(e.track);
      add(e.track);
      // Video often starts "muted" until the first frames arrive (more so
      // through the relay); redraw then so it never stays black.
      e.track.addEventListener("unmute", () => {
        const v = document.querySelector(".call-screen__remote");
        if (!v || !v.videoWidth || v.paused) attachRemote(remote, true);
      });
      attachRemote(remote, true);
    };
    const ref = calls().doc(call.id);
    pc.onicecandidate = (e) => {
      if (e.candidate) ref.collection("candidates").add({ from: me().id, c: e.candidate.toJSON() }).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (!active || active.pc !== pc) return;
      const st = pc.connectionState;
      if (st === "connected") onConnected();
      else if (st === "disconnected") setStatus("Reconnecting…");
      else if (st === "failed") {
        if (!active.restarted && pc.restartIce) {
          active.restarted = true;
          pc.restartIce();
        } else {
          logRoutes(pc);
          finish(active.connectedAt ? "dropped" : "failed");
        }
      }
    };
    const offCands = ref.collection("candidates").onSnapshot((snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        if (d.from === me().id || !d.c) return;
        const add = () => pc.addIceCandidate(d.c).catch(() => {});
        pc.remoteDescription ? add() : (active && active.pending.push(add));
      });
    });
    active = { call, pc, stream, remote, role, ref, offs: [offCands], pending: [], facing: "user", connectedAt: 0, timer: null, ringTimer: null, restarted: false };
    attachLocal(stream);
    return active;
  }

  /** Once both sides have agreed, the phones get 30 seconds to find each other. */
  function watchConnect(a) {
    clearTimeout(a.connectTimer);
    a.connectTimer = setTimeout(() => {
      if (active === a && !a.connectedAt) {
        logRoutes(a.pc);
        finish("failed");
      }
    }, CONNECT_MS);
  }

  /** For troubleshooting: which kinds of route each phone found. */
  async function logRoutes(pc) {
    try {
      const stats = await pc.getStats();
      const local = new Set();
      const remote = new Set();
      stats.forEach((r) => {
        if (r.type === "local-candidate") local.add(r.candidateType);
        if (r.type === "remote-candidate") remote.add(r.candidateType);
      });
      console.info("Call routes: this phone", [...local], "other phone", [...remote]);
    } catch {}
  }

  function flushPending() {
    if (!active) return;
    active.pending.splice(0).forEach((fn) => fn());
  }

  function attachLocal(stream) {
    const v = document.querySelector(".call-screen:not(.call-screen--leaving) .call-screen__local");
    if (v && stream.getVideoTracks().length) {
      v.srcObject = stream;
      v.classList.add("call-screen__local--ready");
      v.classList.toggle("call-screen__local--mirror", active ? active.facing === "user" : true);
    }
  }
  /** Answering side: put our camera and mic into the slots the offer made. */
  function sendOwnTracks(pc, stream) {
    const used = new Set();
    stream.getTracks().forEach((track) => {
      const t = pc.getTransceivers().find((x) => !used.has(x) && !x.stopped && x.receiver && x.receiver.track && x.receiver.track.kind === track.kind && !x.sender.track);
      if (t) {
        used.add(t);
        t.direction = "sendrecv";
        t.sender.replaceTrack(track);
        if (t.sender.setStreams) t.sender.setStreams(stream);
      } else {
        pc.addTrack(track, stream);
      }
    });
  }

  function attachRemote(stream, force = false) {
    const v = document.querySelector(".call-screen:not(.call-screen--leaving) .call-screen__remote");
    if (!v) return;
    if (v.srcObject === stream && !force) return;
    if (v.srcObject === stream) v.srcObject = null; // make the player look again
    v.srcObject = stream;
    v.play().catch(() => {
      // Some phones need one more tap before sound can play.
      const b = document.querySelector(".call-screen__unmute");
      if (b) b.hidden = false;
    });
  }

  function onConnected() {
    if (!active || active.connectedAt) {
      setStatus(active && active.connectedAt ? fmt(Date.now() - active.connectedAt) : "");
      return;
    }
    stopTone();
    active.connectedAt = Date.now();
    const screen = document.querySelector(".call-screen:not(.call-screen--leaving)");
    if (screen) screen.classList.add("call-screen--live");
    setStatus("0:00");
    active.timer = setInterval(() => setStatus(fmt(Date.now() - active.connectedAt)), 1000);
  }

  // ---------------------------------------------------------------
  // Starting a call
  // ---------------------------------------------------------------
  async function start(kind) {
    if (!Cloud.isActive()) return Toast.show("Calls need both of you signed in to your shared space.");
    if (!supported()) return Toast.show("This browser can't make calls.");
    if (active) return;
    const peer = other();
    const placeholder = { id: "pending", kind };
    mount(placeholder, peer, "outgoing");
    sound(); // unlock audio while we still have the tap
    const ice = iceConfig();
    let stream;
    try {
      stream = await getMedia(kind);
    } catch (err) {
      unmount();
      return Toast.show(friendlyMediaError(err, kind));
    }
    const ref = calls().doc();
    const call = { id: ref.id, from: me().id, to: peer.id, kind, state: "ringing", ts: Date.now() };
    const a = connect(call, stream, "caller", await ice);
    try {
      const offer = await a.pc.createOffer();
      await a.pc.setLocalDescription(offer);
      await ref.set({ ...call, offer: { type: offer.type, sdp: offer.sdp } });
    } catch (err) {
      console.error(err);
      cleanup();
      unmount();
      return Toast.show("Couldn't start the call. Check your connection.");
    }
    ignore.add(call.id);
    startTone("back");
    Cloud.notify("call");
    setStatus("Ringing…");
    a.offs.push(
      ref.onSnapshot((doc) => {
        const d = doc.data();
        if (!d || !active || active.call.id !== call.id) return;
        if (d.answer && !a.pc.currentRemoteDescription) {
          a.pc.setRemoteDescription(d.answer).then(flushPending).catch(() => finish("failed"));
          setStatus("Connecting…");
          stopTone();
          watchConnect(a);
        }
        if (d.state === "declined") finish("declined", { remote: true });
        if (d.state === "ended" && d.endedBy !== me().id) finish(d.endedReason === "failed" && !a.connectedAt ? "failed" : "ended", { remote: true });
      })
    );
    a.ringTimer = setTimeout(() => {
      if (active && active.call.id === call.id && !active.connectedAt && !a.pc.currentRemoteDescription) finish("missed");
    }, RING_MS);
  }

  // ---------------------------------------------------------------
  // Receiving a call
  // ---------------------------------------------------------------
  function watchIncoming() {
    if (incomingOff || !Cloud.isActive()) return;
    incomingOff = calls()
      .where("to", "==", me().id)
      .where("state", "==", "ringing")
      .onSnapshot(
        (snap) => {
          snap.docChanges().forEach((ch) => {
            const d = ch.doc.data();
            if (ch.type === "removed") {
              // It stopped ringing (they hung up, or another of your devices answered).
              if (active && active.call.id === d.id && active.role === "callee" && !active.accepted) {
                stopTone();
                cleanup();
                unmount();
              }
              return;
            }
            if (ch.type !== "added" || ignore.has(d.id)) return;
            if (Date.now() - (d.ts || 0) > RING_MS) return;
            ignore.add(d.id);
            if (active) return; // already on a call
            ring(d);
          });
        },
        (err) => console.info("Call listener", err)
      );
  }

  function ring(call) {
    const peer = CONFIG.users[call.from];
    if (!peer) return;
    mount(call, peer, "incoming");
    active = { call, role: "callee", accepted: false, offs: [], pending: [] };
    startTone("ring");
    active.ringTimer = setTimeout(() => {
      if (active && active.call.id === call.id && !active.accepted) {
        stopTone();
        cleanup();
        unmount();
      }
    }, Math.max(5000, RING_MS - (Date.now() - call.ts)));
  }

  async function accept() {
    if (!active || active.role !== "callee" || active.accepted) return;
    const call = active.call;
    const ref = calls().doc(call.id);
    // Mark it answered first: once the state leaves "ringing" the incoming
    // listener sees it disappear, and must not mistake that for a hang up.
    active.accepted = true;
    clearTimeout(active.ringTimer);
    stopTone();
    setStatus("Connecting…");
    sound();
    const ice = iceConfig();
    let stream;
    try {
      stream = await getMedia(call.kind);
    } catch (err) {
      Toast.show(friendlyMediaError(err, call.kind));
      return decline();
    }
    // Make sure nobody else (another of your devices) answered first.
    try {
      await Cloud.db().runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists || doc.data().state !== "ringing") throw new Error("gone");
        tx.update(ref, { state: "accepted", startedAt: Date.now() });
      });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      cleanup();
      unmount();
      return Toast.show("That call has ended.");
    }
    // Swap the incoming screen for the in-call one.
    mount(call, CONFIG.users[call.from], "outgoing");
    setStatus("Connecting…");
    const a = connect(call, stream, "callee", await ice);
    a.accepted = true;
    watchConnect(a);
    try {
      await a.pc.setRemoteDescription(call.offer);
      sendOwnTracks(a.pc, stream);
      flushPending();
      const answer = await a.pc.createAnswer();
      await a.pc.setLocalDescription(answer);
      await ref.update({ answer: { type: answer.type, sdp: answer.sdp } });
    } catch (err) {
      console.error(err);
      return finish("failed");
    }
    a.offs.push(
      ref.onSnapshot((doc) => {
        const d = doc.data();
        if (d && d.state === "ended" && d.endedBy !== me().id) finish(d.endedReason === "failed" && !a.connectedAt ? "failed" : "ended", { remote: true });
      })
    );
  }

  async function decline() {
    if (!active || active.role !== "callee") return;
    const id = active.call.id;
    stopTone();
    cleanup();
    unmount();
    calls().doc(id).update({ state: "declined", endedAt: Date.now() }).catch(() => {});
  }

  // ---------------------------------------------------------------
  // Ending
  // ---------------------------------------------------------------
  function cleanup() {
    if (!active) return;
    clearInterval(active.timer);
    clearTimeout(active.ringTimer);
    clearTimeout(active.connectTimer);
    (active.offs || []).forEach((off) => off && off());
    if (active.stream) active.stream.getTracks().forEach((t) => t.stop());
    if (active.pc) {
      try {
        active.pc.close();
      } catch {}
    }
    active = null;
  }

  /** reason: ended | missed | declined | dropped | failed | cancelled */
  function finish(reason, { remote = false } = {}) {
    if (!active) return;
    const a = active;
    const duration = a.connectedAt ? Date.now() - a.connectedAt : 0;
    stopTone();
    if (!remote && a.ref) {
      const state = reason === "missed" ? "missed" : reason === "cancelled" ? "cancelled" : "ended";
      a.ref.update({ state, endedAt: Date.now(), endedBy: me().id, endedReason: reason }).catch(() => {});
    }
    // The caller writes one line into the chat for the record.
    if (a.role === "caller") {
      const callState = duration ? "ended" : reason === "declined" ? "declined" : reason === "failed" ? "failed" : "missed";
      const messages = Storage.getMessages() || [];
      Storage.setMessages([
        ...messages,
        { id: UI.uid("m"), from: me().id, kind: "call", callKind: a.call.kind, callState, duration: Math.round(duration / 1000), text: "", ts: Date.now(), status: "sent" },
      ]);
    }
    cleanup();
    const peer = other();
    setStatus(
      reason === "declined" ? `${peer.displayName} can't talk right now` : reason === "missed" ? "No answer" : reason === "dropped" ? "Call dropped" : reason === "failed" ? "Couldn't connect. Try again in a moment" : duration ? fmt(duration) : "Call ended"
    );
    const screen = document.querySelector(".call-screen:not(.call-screen--leaving)");
    if (screen) screen.classList.add("call-screen--ending");
    setTimeout(unmount, reason === "ended" && duration ? 900 : reason === "failed" ? 2800 : 1500);
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  async function onControl(e) {
    const unmute = e.target.closest(".call-screen__unmute");
    if (unmute) {
      const v = document.querySelector(".call-screen__remote");
      if (v) v.play().catch(() => {});
      unmute.hidden = true;
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "accept") return accept();
    if (act === "decline") return decline();
    if (!active) return unmount();
    if (act === "end") return finish(active.connectedAt ? "ended" : "cancelled");
    if (act === "mute") {
      const track = active.stream.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      btn.setAttribute("aria-pressed", String(!track.enabled));
      btn.classList.toggle("call-btn--on", !track.enabled);
      btn.querySelector("span").textContent = track.enabled ? "Mute" : "Muted";
    }
    if (act === "camera") {
      const track = active.stream.getVideoTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      btn.setAttribute("aria-pressed", String(!track.enabled));
      btn.classList.toggle("call-btn--on", !track.enabled);
      document.querySelector(".call-screen__local").classList.toggle("call-screen__local--off", !track.enabled);
    }
    if (act === "flip") {
      const facing = active.facing === "user" ? "environment" : "user";
      try {
        const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } });
        const track = fresh.getVideoTracks()[0];
        const sender = active.pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) await sender.replaceTrack(track);
        const old = active.stream.getVideoTracks()[0];
        if (old) {
          active.stream.removeTrack(old);
          old.stop();
        }
        active.stream.addTrack(track);
        active.facing = facing;
        attachLocal(active.stream);
      } catch {
        Toast.show("Couldn't switch cameras on this device.");
      }
    }
  }

  // If the app closes mid-call, hang up properly.
  window.addEventListener("pagehide", () => {
    if (active && active.role !== "callee") finish(active.connectedAt ? "ended" : "cancelled");
    else if (active && active.accepted) finish("ended");
  });

  function startWatching() {
    watchIncoming();
  }
  function stopWatching() {
    if (incomingOff) incomingOff();
    incomingOff = null;
    if (active) finish("cancelled");
  }

  return { start, startWatching, stopWatching, supported, fmt, isBusy: () => Boolean(active) };
})();

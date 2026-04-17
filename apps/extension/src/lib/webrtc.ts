import { getVoiceSocket } from "./socket.js";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface PeerState {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  videoEl: HTMLVideoElement | null;
}

const peers = new Map<string, PeerState>();
let localStream: MediaStream | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentChannelId: string | null = null;

/** Call this with the sidebar's shadow root so media elements go inside it */
export function setShadowRoot(root: ShadowRoot): void {
  shadowRoot = root;
}

/** Get or acquire local audio/video stream */
async function getLocalStream(video = false): Promise<MediaStream> {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video,
  });
  return localStream;
}

function createPeerConnection(remoteUserId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      getVoiceSocket().emit("ice_candidate", {
        to: remoteUserId,
        candidate: e.candidate.toJSON(),
      });
    }
  };

  pc.ontrack = (e) => {
    const peer = peers.get(remoteUserId);
    if (!peer) return;

    const track = e.track;
    if (track.kind === "audio") {
      peer.audioEl.srcObject = e.streams[0] ?? null;
      peer.audioEl.autoplay = true;
      (shadowRoot ?? document.body).appendChild(peer.audioEl);
    } else if (track.kind === "video") {
      if (!peer.videoEl) {
        const vid = document.createElement("video");
        vid.autoplay = true;
        vid.playsInline = true;
        vid.dataset["userId"] = remoteUserId;
        (shadowRoot ?? document.body).appendChild(vid);
        peers.set(remoteUserId, { ...peer, videoEl: vid });
      }
      const vidPeer = peers.get(remoteUserId);
      if (vidPeer?.videoEl) {
        vidPeer.videoEl.srcObject = e.streams[0] ?? null;
      }
    }
  };

  pc.onconnectionstatechange = () => {
    if (
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected"
    ) {
      removePeer(remoteUserId);
    }
  };

  return pc;
}

function getOrCreatePeer(remoteUserId: string): PeerState {
  const existing = peers.get(remoteUserId);
  if (existing) return existing;

  const pc = createPeerConnection(remoteUserId);
  const audioEl = document.createElement("audio");
  audioEl.dataset["userId"] = remoteUserId;

  const state: PeerState = { pc, audioEl, videoEl: null };
  peers.set(remoteUserId, state);
  return state;
}

/** Called when joining a channel — initiate offers to all existing peers */
export async function initiateCallsToExistingPeers(
  peerIds: string[],
  channelId: string,
  withVideo = false
): Promise<void> {
  currentChannelId = channelId;
  const stream = await getLocalStream(withVideo);

  for (const peerId of peerIds) {
    const { pc } = getOrCreatePeer(peerId);
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    getVoiceSocket().emit("offer", { to: peerId, sdp: offer });
  }
}

/** Called when a new peer joins — they create the offer, we handle here */
export async function handleOffer(
  fromUserId: string,
  sdp: RTCSessionDescriptionInit,
  withVideo = false
): Promise<void> {
  const stream = await getLocalStream(withVideo);
  const { pc } = getOrCreatePeer(fromUserId);

  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  getVoiceSocket().emit("answer", { to: fromUserId, sdp: answer });
}

export async function handleAnswer(
  fromUserId: string,
  sdp: RTCSessionDescriptionInit
): Promise<void> {
  const peer = peers.get(fromUserId);
  if (!peer) return;
  await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
}

export async function handleIceCandidate(
  fromUserId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  const peer = peers.get(fromUserId);
  if (!peer) return;
  await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function removePeer(userId: string): void {
  const peer = peers.get(userId);
  if (!peer) return;

  peer.pc.close();
  peer.audioEl.srcObject = null;
  peer.audioEl.remove();
  peer.videoEl?.remove();
  peers.delete(userId);
}

export function leaveVoiceChannel(): void {
  for (const userId of peers.keys()) {
    removePeer(userId);
  }

  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  currentChannelId = null;
}

export function setMuted(muted: boolean): void {
  localStream?.getAudioTracks().forEach((t) => {
    t.enabled = !muted;
  });
}

export function setVideoEnabled(enabled: boolean): void {
  localStream?.getVideoTracks().forEach((t) => {
    t.enabled = enabled;
  });
}

export function getPeers(): string[] {
  return [...peers.keys()];
}

export function getCurrentChannelId(): string | null {
  return currentChannelId;
}

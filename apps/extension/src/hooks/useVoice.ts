import { useEffect, useState, useCallback } from "react";
import { getVoiceSocket } from "../lib/socket.js";
import {
  initiateCallsToExistingPeers,
  handleOffer,
  handleAnswer,
  handleIceCandidate,
  removePeer,
  leaveVoiceChannel,
  setMuted,
  setVideoEnabled,
  getPeers,
} from "../lib/webrtc.js";

interface VoiceState {
  isInChannel: boolean;
  channelId: string | null;
  peers: string[];
  isMuted: boolean;
  isVideoOn: boolean;
  joinChannel: (channelId: string, withVideo?: boolean) => void;
  leave: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

export function useVoice(): VoiceState {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);

  useEffect(() => {
    let socket: ReturnType<typeof getVoiceSocket>;
    try {
      socket = getVoiceSocket();
    } catch {
      return;
    }

    socket.on("voice_peers", async (peerIds) => {
      if (channelId) {
        await initiateCallsToExistingPeers(peerIds, channelId, isVideoOn);
        setPeers(getPeers());
      }
    });

    socket.on("peer_joined", async (_payload) => {
      // New peer joined — they will send us an offer via the 'offer' event
      setPeers(getPeers());
    });

    socket.on("peer_left", (userId) => {
      removePeer(userId);
      setPeers(getPeers());
    });

    socket.on("offer", async ({ from, sdp }) => {
      await handleOffer(from, sdp, isVideoOn);
      setPeers(getPeers());
    });

    socket.on("answer", async ({ from, sdp }) => {
      await handleAnswer(from, sdp);
    });

    socket.on("ice_candidate", async ({ from, candidate }) => {
      await handleIceCandidate(from, candidate);
    });

    return () => {
      socket.off("voice_peers");
      socket.off("peer_joined");
      socket.off("peer_left");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice_candidate");
    };
  }, [channelId, isVideoOn]);

  const joinChannel = useCallback((id: string, withVideo = false) => {
    let socket: ReturnType<typeof getVoiceSocket>;
    try {
      socket = getVoiceSocket();
    } catch {
      return;
    }
    setChannelId(id);
    setIsVideoOn(withVideo);
    socket.emit("join_voice_channel", id);
  }, []);

  const leave = useCallback(() => {
    if (!channelId) return;
    let socket: ReturnType<typeof getVoiceSocket>;
    try {
      socket = getVoiceSocket();
    } catch {
      return;
    }
    socket.emit("leave_voice_channel", channelId);
    leaveVoiceChannel();
    setChannelId(null);
    setPeers([]);
  }, [channelId]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      setMuted(!prev);
      return !prev;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoOn((prev) => {
      setVideoEnabled(!prev);
      return !prev;
    });
  }, []);

  return {
    isInChannel: channelId !== null,
    channelId,
    peers,
    isMuted,
    isVideoOn,
    joinChannel,
    leave,
    toggleMute,
    toggleVideo,
  };
}

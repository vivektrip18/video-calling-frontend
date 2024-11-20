import { useEffect, useRef, useState } from "react";
import { Avatar, Button } from "@nextui-org/react";
import { CameraIcon } from "../components/CameraIcon";
import { MicrophoneIcon } from "../components/MicrophoneIcon";
import { Snippet } from "@nextui-org/snippet";

export const MeetingRoom = ({ username, socket }) => {
    const userVideoRef = useRef();
    const remoteVideoRef = useRef();
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [localStream, setLocalStream] = useState(null);
    const [peerConnection, setPeerConnection] = useState(null);
    const [remoteMediaStream, setRemoteMediaStream] = useState(null);

    const configuration = {
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    };

    const cleanupPeerConnection = (pc) => {
        if (pc) {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.close();
        }
    };

    useEffect(() => {
        const initializeMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                if (userVideoRef.current) {
                    userVideoRef.current.srcObject = stream;
                }
                setLocalStream(stream);
            } catch (error) {
                console.error("Error accessing media devices.", error);
            }
        };

        initializeMedia();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
            setLocalStream(null);
        };
    }, []);

    useEffect(() => {
        const pc = new RTCPeerConnection(configuration);

        if (peerConnection) {
            cleanupPeerConnection(peerConnection);
        }

        setPeerConnection(pc);

        socket.on("send-offer", async ({ meetingCode }) => {
            console.log("Preparing to send offer...");

            if (pc.signalingState === "closed") {
                console.error("RTCPeerConnection is closed. Skipping offer creation.");
                return;
            }

            localStream.getTracks().forEach((track) => {
                if (pc.signalingState !== "closed") {
                    pc.addTrack(track, localStream);
                }
            });

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("add-ice-candidate", {
                        candidate: event.candidate,
                        type: "sender",
                        meetingCode,
                    });
                }
            };

            pc.onnegotiationneeded = async () => {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit("offer", { sdp: offer, meetingCode });
                } catch (error) {
                    console.error("Error during offer creation:", error);
                }
            };
            pc.onconnectionstatechange = () => {
                console.log("ICE connection state:", pc.connectionState);
            };
            
        });

        socket.on("offer", async ({ sdp: remoteSdp, meetingCode }) => {
            console.log("Received an offer from another user.");

            try {
                await pc.setRemoteDescription(remoteSdp);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                const remoteStream = new MediaStream();
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setRemoteMediaStream(remoteStream);

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit("add-ice-candidate", {
                            candidate: event.candidate,
                            type: "receiver",
                            meetingCode,
                        });
                    }
                };

                socket.emit("answer", { meetingCode, sdp: answer });

                pc.ontrack = (event) => {
                    if (remoteStream) {
                        event.streams[0].getTracks().forEach((track) => {
                            remoteStream.addTrack(track);
                        });
                    }
                };
            } catch (error) {
                console.error("Error handling offer:", error);
            }
        });

        socket.on("answer", async ({ sdp: remoteSdp }) => {
            console.log("Received answer.");
            if (pc.signalingState === "have-local-offer") {
                try {
                    await pc.setRemoteDescription(remoteSdp);
                } catch (error) {
                    console.error("Error setting remote description:", error);
                }
            }
        });
        pc.iceGatheringTimeout = 30000;

        socket.on("add-ice-candidate", async ({ candidate, type }) => {
            try {
                if (candidate) {
                    await pc.addIceCandidate(candidate);
                    console.log("ICE candidate added successfully.");
                }
            } catch (error) {
                console.error("Failed to add ICE candidate:", error);
            }
        });

        return () => {
            cleanupPeerConnection(pc);
            socket.off("send-offer");
            socket.off("offer");
            socket.off("answer");
            socket.off("add-ice-candidate");
        };
    }, [localStream]);

    const toggleVideo = () => {
        setIsVideoOn((prev) => {
            const newState = !prev;
            localStream?.getVideoTracks().forEach((track) => {
                track.enabled = newState;
            });
            return newState;
        });
    };

    const toggleAudio = () => {
        setIsAudioOn((prev) => {
            const newState = !prev;
            localStream?.getAudioTracks().forEach((track) => {
                track.enabled = newState;
            });
            return newState;
        });
    };

    const MeetingCode = window.location.pathname.replace("/meeting/", "");

    return (
        <div className="h-screen flex pt-4 pb-4">
            <div className="bg-gray-800 mr-2 rounded-md p-6 ml-4 w-[70%]">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full rounded-lg"
                />
            </div>
            <div className="grid grid-rows-2 gap-2 mr-2 w-[30%]">
                <div className="bg-gray-800 rounded-md flex justify-center items-center">
                    {isVideoOn ? (
                        <video
                            ref={userVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full rounded-lg"
                        />
                    ) : (
                        <Avatar
                            name={username[0] ? username[0] : "?"}
                            size="lg"
                            className="mr-auto ml-auto text-2xl"
                        />
                    )}
                </div>
                <div>
                    <Button
                        onClick={toggleVideo}
                        color={isVideoOn ? "secondary" : "warning"}
                        size="sm"
                        className="mr-2"
                    >
                        <CameraIcon />
                    </Button>
                    <Button
                        onClick={toggleAudio}
                        color={isAudioOn ? "secondary" : "warning"}
                        size="sm"
                    >
                        <MicrophoneIcon />
                    </Button>
                    <br />
                    <Snippet symbol="" className="mt-2">
                        {MeetingCode}
                    </Snippet>
                </div>
            </div>
        </div>
    );
};

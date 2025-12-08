// //------------------------------------------------------
// // Janus 기본 설정
// //------------------------------------------------------
// var server = "https://janus.jsflux.co.kr/janus";

// var janus = null;
// var sfutest = null; // publisher handle
// var opaqueId = "react-videoroom-" + Janus.randomString(12);

// var myroom = null;
// var myusername = null;
// var myid = null;
// var mystream = null;
// var mypvtid = null;

// var feeds = [];
// var bitrateTimer = [];

// //------------------------------------------------------
// // 원격 참여자용 subscriber 생성
// //------------------------------------------------------
// function newRemoteFeed(id, display, audio, video) {
//     var remoteFeed = null;

//     janus.attach({
//         plugin: "janus.plugin.videoroom",
//         opaqueId: opaqueId,

//         success: function (pluginHandle) {
//             remoteFeed = pluginHandle;
//             remoteFeed.simulcastStarted = false;
//             console.log("[Janus][subscriber] handle attached, feed id=", id);

//             var subscribe = {
//                 request: "join",
//                 room: myroom,
//                 ptype: "subscriber",
//                 feed: id,
//                 private_id: mypvtid,
//             };

//             remoteFeed.send({ message: subscribe });
//         },

//         error: function (error) {
//             console.error("Subscriber attach error:", error);
//         },

//         // ------------------------------
//         // subscriber onmessage
//         // ------------------------------
//         onmessage: function (msg, jsep) {
//             var event = msg["videoroom"];

//             if (event === "attached") {
//                 for (var i = 1; i <= 6; i++) {
//                     if (!feeds[i]) {
//                         feeds[i] = remoteFeed;
//                         remoteFeed.rfindex = i;
//                         break;
//                     }
//                 }
//             }

//             if (jsep) {
//                 remoteFeed.createAnswer({
//                     jsep: jsep,
//                     media: { audioSend: false, videoSend: false },

//                     success: function (jsep) {
//                         var body = { request: "start", room: myroom };
//                         remoteFeed.send({ message: body, jsep: jsep });
//                     },
//                     error: function (error) {
//                         console.error("SDP error:", error);
//                     },
//                 });
//             }
//         },

//         // subscriber 는 localstream 없음
//         onlocalstream: function () {},

//         // ------------------------------
//         // subscriber onremotestream → remote video 표시
//         // ------------------------------
//         onremotestream: function (stream) {
//             var index = remoteFeed.rfindex;
//             var container = document.getElementById("videoremote" + index);
//             if (!container) {
//                 console.error("#videoremote" + index + " element not found");
//                 return;
//             }

//             container.innerHTML = "";

//             var video = document.createElement("video");
//             video.id = "remotevideo" + index;
//             video.autoplay = true;
//             video.playsInline = true;
//             video.style.width = "100%";
//             video.style.height = "100%";

//             container.appendChild(video);

//             Janus.attachMediaStream(video, stream);
//         },

//         // ------------------------------
//         // subscriber oncleanup
//         // ------------------------------
//         oncleanup: function () {
//             var index = remoteFeed.rfindex;

//             // jQuery 제거
//             var video = document.getElementById("remotevideo" + index);
//             if (video) {
//                 video.remove();
//             }

//             feeds[index] = null;

//             if (bitrateTimer[index]) clearInterval(bitrateTimer[index]);
//             bitrateTimer[index] = null;
//         },
//     });
// }

// //------------------------------------------------------
// // 내 웹캠 방송 publish
// //------------------------------------------------------
// function publishOwnFeed(useAudio) {
//     console.log("[Janus][publishOwnFeed] 시작, useAudio =", useAudio);

//     if (!sfutest) {
//         console.error(
//             "[Janus][publishOwnFeed] sfutest 가 없습니다. publisher handle attach 여부 확인"
//         );
//         return;
//     }

//     sfutest.createOffer({
//         media: {
//             audioRecv: false,
//             videoRecv: false,
//             audioSend: useAudio,
//             videoSend: true,
//         },

//         success: function (jsep) {
//             console.log(
//                 "[Janus][publishOwnFeed] createOffer 성공, jsep type=",
//                 jsep && jsep.type
//             );
//             var publish = {
//                 request: "configure",
//                 audio: useAudio,
//                 video: true,
//             };
//             console.log("[Janus][publishOwnFeed] configure 전송", publish);
//             sfutest.send({ message: publish, jsep: jsep });
//         },

//         error: function (error) {
//             console.error("[Janus][publishOwnFeed] createOffer error:", error);
//             if (useAudio) publishOwnFeed(false);
//         },
//     });
// }

// //------------------------------------------------------
// // React 진입점: React → startJanusFromReact(config)
// //------------------------------------------------------
// window.startJanusFromReact = function ({ roomNumber, displayName, userId }) {
//     //console.log("React → Janus start:", roomNumber, displayName, userId);
//     console.log("[React→Janus] startJanusFromReact 호출", {
//         roomNumber,
//         displayName,
//         userId,
//     });
//     myroom = Number(roomNumber);
//     myusername = userId ? `ID_${userId}` : displayName || "User";

//     // --------------------------
//     // Janus init
//     // --------------------------
//     Janus.init({
//         debug: "all",
//         callback: function () {
//             console.log(
//                 "[Janus] init callback, WebRTC supported?",
//                 Janus.isWebrtcSupported()
//             );

//             if (!Janus.isWebrtcSupported()) {
//                 console.error("[Janus] WebRTC not supported");
//                 alert("WebRTC not supported");
//                 return;
//             }

//             // --------------------------
//             // Janus session start
//             // --------------------------
//             janus = new Janus({
//                 server: server,

//                 success: function () {
//                     console.log("[Janus] 세션 생성 성공");
//                     // --------------------------
//                     // publisher attach
//                     // --------------------------
//                     janus.attach({
//                         plugin: "janus.plugin.videoroom",
//                         opaqueId: opaqueId,

//                         success: function (pluginHandle) {
//                             sfutest = pluginHandle;
//                             console.log(
//                                 "[Janus][publisher] handle attached, id=",
//                                 sfutest.getId && sfutest.getId()
//                             );
//                             // --- create room ---
//                             const createRoom = {
//                                 request: "create",
//                                 room: myroom,
//                                 permanent: false,
//                                 publishers: 6,
//                             };

//                             sfutest.send({
//                                 message: createRoom,

//                                 success: function () {
//                                     console.log(
//                                         "[Janus][publisher] create room 성공, join 요청"
//                                     );
//                                     // --- join room ---
//                                     const join = {
//                                         request: "join",
//                                         room: myroom,
//                                         ptype: "publisher",
//                                         display: myusername,
//                                     };

//                                     sfutest.send({ message: join });
//                                 },
//                             });
//                         },

//                         error: function (err) {
//                             console.error("publisher attach error:", err);
//                         },

//                         // -----------------------------------
//                         // publisher onmessage
//                         // -----------------------------------
//                         onmessage: function (msg, jsep) {
//                             var event = msg["videoroom"];

//                             // 방 참여 성공
//                             if (event === "joined") {
//                                 myid = msg["id"];
//                                 mypvtid = msg["private_id"];
//                                 console.log(
//                                     "[Janus][publisher] joined, myid=",
//                                     myid,
//                                     "mypvtid=",
//                                     mypvtid
//                                 );
//                                 publishOwnFeed(true);
//                             }

//                             // 새 참여자 목록
//                             if (event === "event" && msg["publishers"]) {
//                                 console.log(
//                                     "[Janus][publisher] 새 publisher 목록",
//                                     msg["publishers"]
//                                 );
//                                 msg["publishers"].forEach((pub) => {
//                                     newRemoteFeed(
//                                         pub.id,
//                                         pub.display,
//                                         pub.audio_codec,
//                                         pub.video_codec
//                                     );
//                                 });
//                             }

//                             // SDP
//                             if (jsep) {
//                                 console.log(
//                                     "[Janus][publisher] handleRemoteJsep",
//                                     jsep
//                                 );
//                                 sfutest.handleRemoteJsep({ jsep });
//                             }
//                         },

//                         // -----------------------------------
//                         // publisher onlocalstream → 내 캠
//                         // -----------------------------------
//                         onlocalstream: function (stream) {
//                             console.log(
//                                 "[Janus][publisher][onlocalstream] 호출, stream=",
//                                 stream
//                             );
//                             mystream = stream;

//                             var container =
//                                 document.getElementById("videolocal");
//                             if (!container) {
//                                 console.error("#videolocal element not found");
//                                 return;
//                             }

//                             // 기존 내용 제거 (React가 넣어둔 '나' 라벨도 포함)
//                             container.innerHTML = "";

//                             // 비디오 태그 생성
//                             var video = document.createElement("video");
//                             video.id = "myvideo";
//                             video.autoplay = true;
//                             video.playsInline = true;
//                             video.muted = true;
//                             video.style.width = "100%";
//                             video.style.height = "100%";

//                             container.appendChild(video);

//                             // 스트림 붙이기
//                             Janus.attachMediaStream(video, stream);
//                         },

//                         onremotestream: function () {},

//                         oncleanup: function () {
//                             var video = document.getElementById("myvideo");
//                             if (video) {
//                                 video.remove();
//                             }
//                         },
//                     });
//                 },

//                 error: function (error) {
//                     console.error("[Janus] session error:", error);
//                 },

//                 destroyed: function () {
//                     console.log("[Janus] destroyed");
//                 },
//             });
//         },
//     });

//     // React에서 unmount 시 cleanup용 destroy() 제공
//     return {
//         destroy: function () {
//             console.log("[React→Janus] destroy 호출");
//             if (janus) janus.destroy();
//         },
//     };
// };

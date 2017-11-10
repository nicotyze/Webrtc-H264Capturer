var request = null;
var hangingGet = null;
var localName;
var server;
var my_id = -1;
var other_peers = {};
var started = false;
var signed_In = false;
var pc;
var activeCall = false;
var connectedPeerId;
var zoomed = false;

var ice_candidates = [];


var messageCounter = 0;
var otherPeers = {};

var mediaConstraints = {
    mandatory: {
        'OfferToReceiveAudio': false,
        'OfferToReceiveVideo': true,
        'OfferToSendAudio': false,
        'OfferToSendVideo': false
    },
    'offerToReceiveAudio': false,
    'offerToReceiveVideo': true ,
    'offerToSendAudio': false,
    'offerToSendVideo': false 
};

var sdpConstraints = {
    optional: [{
            DtlsSrtpKeyAgreement: true
        }, {
            RtpDataChannels: true
        }, {
            offerToSendVideo: false
        }]
};


function isVariableValid(val) {
    if( typeof val == 'undefined' ) {
        return false;
    } else if (val == null)  {
        return false;
    }
    return true;
}

function destroylPeerConnection()
{
    if(isVariableValid(pc)) {
        pc.close();
        pc = null;
    }
}

function handleErrorDS(error) {
    console.log('navigator.getUserMedia error: ', error);
}

function changeVideoStreamStyles(remoteExist){
    if ((remoteExist)) {
        document.getElementById("iddivlocal").style["-webkit-animation"] = "connectAnimation 0.5s";
        document.getElementById("iddivlocal").style["-webkit-animation-fill-mode"] = "forwards";
        document.getElementById("iddivlocal").style["-webkit-animation-timing-function"] = "linear";
        zoomed = true;
    } else if ((zoomed) && (!remoteExist)) {
        document.getElementById("iddivlocal").style["-webkit-animation"] = "disconnectAnimation 0.5s";
        document.getElementById("iddivlocal").style["-webkit-animation-fill-mode"] = "forwards";
        document.getElementById("iddivlocal").style["-webkit-animation-timing-function"] = "linear";
        zoomed = false;
    }
}

function handleServerNotification(rawdata) {
    console.log("Server notification: %o", rawdata);
    var data = rawdata;
    console.log("data: %o", data);
    var parsed = data.split(',');
    var peer_id = parseInt(document.getElementById("peer_id").value);
    if (parseInt(parsed[1]) == peer_id && parseInt(parsed[2]) == 0) {
        onRemoteHangup();
    }

    var peerId = parseInt(parsed[1]);
    console.log("handleServerNotification peerId = %o", peerId);
    if (parseInt(parsed[2]) != 0) {
        updatePeers(true, peerId, parsed[0]);
    } else {
        if (other_peers[peerId] != "undefined") {
            updatePeers(false, peerId, "");
        }
    }

    console.log("number of peers: %o", Object.keys(other_peers).length);
    console.log("otherPeers %o = %o", parseInt(parsed[1]), parsed[0]);
}

function handlePeerMessage(peer_id, data) {
    console.log("handlePeerMessage peer %o: %o", peer_id, data);
    processSignalingMessage(data, peer_id);
}
    function dummy() {
    }

    function sendToPeer(peer_id, data) {
      try {
          console.log(peer_id," Send ", data);
          if (my_id == -1) {
              alert("Not connected");
              return;
          }
          if (peer_id == my_id) {
              alert("Can't send a message to oneself :)");
              return;
          }
          var r = new XMLHttpRequest();
          r.onreadystatechange = dummy
          r.open("POST", server + "/message?peer_id=" + my_id + "&to=" + peer_id, true);
          r.setRequestHeader("Content-Type", "text/plain");
          r.send(data);
      } catch (e) {
          console.log("end to peer error:", e.description);
      }
    }

    

function GetIntHeader(r, name) {
    var val = r.getResponseHeader(name);
    return val != null && val.length ? parseInt(val) : -1;
}

function hangingGetCallback() {
    if (hangingGet.readyState != 4)
        return;
    if (hangingGet.status != 200) {
        console.log("server error: %o, %o", hangingGet.status, hangingGet.statusText);
        if (hangingGet) {
            hangingGet.abort();
            hangingGet = null;
        }
        disconnect();
    } else {
        var lenContent= GetIntHeader(hangingGet, "Content-Length");
        if(lenContent > 0) {
            var peer_id = GetIntHeader(hangingGet, "Pragma");
            var resp = hangingGet.responseText;
            if (hangingGet) {
                hangingGet.abort();
                hangingGet = null;
            }

            if(peer_id == -1) {
                //ignore
            } else if (peer_id == my_id) {
                handleServerNotification(resp);
            }  else {
                connectedPeerId = peer_id;
                handlePeerMessage(peer_id, resp);
            }
        }
    }

    if (my_id != -1)
        window.setTimeout(startHangingGet, 500);
}

function startHangingGet() {
    if (my_id == -1)
        return;

    try {
        hangingGet = new XMLHttpRequest();
        hangingGet.onreadystatechange = hangingGetCallback;
        hangingGet.ontimeout = onHangingGetTimeout;
        hangingGet.open("GET", server + "/wait?peer_id=" + my_id, true);
        hangingGet.send();
    } catch (e) {
        console.error("error: %o", e);
    }
}

function onHangingGetTimeout() {
    console.log("hanging get timeout. issuing again.");
    hangingGet.abort();
    hangingGet = null;
    if (my_id != -1)
        window.setTimeout(startHangingGet, 500);
}

function signInCallback() {
    console.log("signInCallback");
    try {
        if (request.readyState == 4) {
            if (request.status == 200) {
                var peers = request.responseText.split("\n");
                var peer = peers[0];
                if (peer.length > 2) {
                  peer = peer.substr(1, peer.length - 2);
                  my_id = parseInt(peer.split(',')[1]);
	              document.getElementById("myID").innerHTML = "My ID: " + my_id;
                  console.log("My id: %o", my_id);
                  console.log("peers: %o", peers);
                }
                for (var i = 1; i < peers.length; ++i) {
                	peer = peers[i];
                    if (peer.length > 2) {
                    peer = peer.substr(1, peer.length - 2);
                        console.log("Peer %o: %o", i, peer);
                        var parsed = peer.split(',');
                        updatePeers(true, parseInt(parsed[1]), parsed[0]);
                    }
                }
                document.getElementById("server").disabled = true;
                document.getElementById("local").disabled = true;

                window.onbeforeunload = function () {
                  signOutSynchronously();
                };
                setButton(false);
                startHangingGet();
                request = null;
                signed_In = true;
                showSignInStatus();
                initializePeerConnection();
            }
        }
    } catch (e) {
        console.error("error: %o", e);
    }
}

function signIn() {
  console.log("signIn");
  try {
    request = new XMLHttpRequest();
    request.onreadystatechange = signInCallback;
    request.open("GET", server + "/sign_in?" + localName, true);
    request.send();
  } catch (e) {
    console.error("error: %o", e);
  }
}

function connect() {
    console.log("connect");
    var str = document.getElementById("local").value;
    if (str) {
        localName = str;
        server = document.getElementById("server").value.toLowerCase();
        if (localName.length == 0) {
            alert("I need a name please.");
            document.getElementById("local").focus();
        } else {
            signIn();
        }
    } else {
        alert("Please enter you name");
        document.getElementById("local").focus();
    }
}

function clearOtherPeers() {
    var peerKeys = Object.keys(other_peers);
    for (i = 0; i < peerKeys.length; i++) {
        updatePeers(false, peerKeys[i], "");
    }
}

function signOut(sync) {
    if (my_id != -1) {
        request = new XMLHttpRequest();
        request.open("GET", server + "/sign_out?peer_id=" + my_id, !sync);
        request.send();
        request = null;
        my_id = -1;
    }
    stop();
}

function signOutSynchronously() {
  signOut(true);
}

function disconnect() {
    if (request) {
        request.abort();
        request = null;
    }

    if (hangingGet) {
        hangingGet.abort();
        hangingGet = null;
    }

    signOut();
    document.getElementById("server").disabled = false;
    document.getElementById("local").disabled = false;
    document.getElementById("callee").value = ""
    document.getElementById("peer_id").value = "";
    setButton(true);
    activeCall = false;
    signed_In = false;
    clearOtherPeers();
    showSignInStatus();
    changeVideoStreamStyles(false);
}

function createPeerConnection() {
    console.log("createPeerConnection");
	var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

    try {
        pc = new window.RTCPeerConnection(pc_config, sdpConstraints);
        pc.onicecandidate = onIceCandidate;
        console.log("Created RTCPeerConnnection with config \"" + JSON.stringify(pc_config) + "\".");
    } catch (e) {
        console.error("Failed to create PeerConnection, exception: %o", e.message);
        alert("Cannot create PeerConnection object; Is the 'PeerConnection' flag enabled in about:flags?");
        return;
    }

    pc.onconnecting = onSessionConnecting;
    pc.onopen = onSessionOpened;
    pc.onaddstream = onRemoteStreamAdded;
    pc.onremovestream = onRemoteStreamRemoved;
}

function findCalleePeer() {
    var peerKeys = Object.keys(other_peers);
    var calleeName = document.getElementById("callee").value
    for (var i in peerKeys) {
        console.log("other_peer[%o] = %o", peerKeys[i], other_peers[peerKeys[i]]);
        if (other_peers[peerKeys[i]] == calleeName) {
            return peerKeys[i];
        }
    }
    return 0;
}

function call() {
    var peer_id = findCalleePeer();
    console.log("peer_id: %o", peer_id);
    if (peer_id == 0) {
        alert("Invalid peer name");
    } else {
        setButton(true);
        connectedPeerId = peer_id;
        doCall();
    }
}

function hangup() {
    setButton(false);
    connectedPeerId = document.getElementById("peer_id").value;
    sendMessage({type: 'bye'});
    document.getElementById("callee").value = "";
    document.getElementById("peer_id").value = ""
    activeCall = false;
    stop();
}

function initializePeerConnection()  {
    //Ask for local streams to be prepared, display self view
    if (!started  && signed_In) {
        console.log("Creating PeerConnection.");
        createPeerConnection();
        console.log("Adding local stream.");
        //pc.addStream(window.stream);
        console.log("started = true");
        started = true;
    }
};

function setFocus() {
    document.getElementById("local").focus();
}

function gotStream(stream) {
    window.stream = stream;
    var url = URL.createObjectURL(window.stream);

    var localVideo = document.getElementById("selfView");
    localVideo.style.opacity = 1;
    localVideo.src = url;
    localVideo.srcObject = stream;

    console.log("lOCAL stream added.");
    document.getElementById("selfView").style.display="block";
    document.getElementById("local").focus();
    setTimeout(setFocus(), 1000);
    return navigator.mediaDevices.enumerateDevices();
}

// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId)
    .then(function() {
      console.log('Success, audio output device attached: %o', sinkId);
    })
    .catch(function(error) {
      var errorMessage = error;
      if (error.name === 'SecurityError') {
        errorMessage = 'You need to use HTTPS for selecting audio output ' +
            'device: ' + error;
      }
      console.error(errorMessage);
      // Jump back to first output device in the list as it's the default.
      var audioOutputSelect = document.querySelector('select#audioOutput');
      audioOutputSelect.selectedIndex = 0;
    });
  } else {
    alert('Browser does not support output device selection.');
    console.warn('Browser does not support output device selection.');
  }
}



function onIceCandidate(event) {
    console.log("onIceCandidate(event).");
    if (event.candidate) {
        sendMessage({
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid,
                        candidate: event.candidate.candidate});
    } else {
        console.log("End of candidates.");
    }
}


function onSessionConnecting(message) {
    console.log("Session connecting.");
}
function onSessionOpened(message) {
    console.log("Session opened.");
}

function onRemoteStreamAdded(event) {
    document.getElementById("remote").style.display="block";
    var url = URL.createObjectURL(event.stream);
    var remoteVideo = document.getElementById("remote");
    remoteVideo.src = url;
    remoteStream = event.stream;
    remoteVideo.play();
}

function onRemoteStreamRemoved(event) {
    document.getElementById("idRemoteVolume").disabled = true;
    console.log("Remote stream removed.");
}

function setLocalAndSendMessage(sessionDescription) {
    console.log("pc.setLocalDescription() in setLocalAndSendMessage.");
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}

function sendMessage(message) {
    var msgString = JSON.stringify(message);
    console.log("[sendMessage] sendMessage: %o", msgString);
    var peer_id = connectedPeerId;
    console.log('peer_id: %o', peer_id);
    console.log('C->S: %o', msgString);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', server + "/message?peer_id=" + my_id + "&to=" + peer_id, true);
    xhr.setRequestHeader("Content-Type", "text/plain");
    xhr.send(msgString);
    xhr = null;
}


function setButton(calling) {
    var targetChild;
    var lastChild;
    var peerChildCount;
    var firstChild;
    var id;
    var peerCallList = document.getElementsByName("peer");
    if (calling) {
        for (elem in peerCallList) {
            firstChild = peerCallList[elem];
            if (firstChild.id === ("peer"+connectedPeerId)) {
                peerChildCount = firstChild.childElementCount;
                for (var i = 0; i < peerChildCount; i++) {
                    lastChild = firstChild.childNodes[i];
                    if (lastChild.id === "buttons") {
                        for (var j = 0; j < lastChild.childElementCount; j++) {
                            targetChild = lastChild.childNodes[j];
                            if (targetChild.getAttribute("name") === "call") {
                                targetChild.disabled = true;
                                targetChild.childNodes[0].src = "img/phone-answer-gray-th.png";
                            } else {
                                targetChild.disabled = false;
                                targetChild.childNodes[0].src = "img/phone-hang-up-red-th.png";
                            }
                        }
                    }
                }
            } else {
                peerChildCount = firstChild.childElementCount;
                for (var i = 0; i < peerChildCount; i++) {
                    lastChild = firstChild.childNodes[i];
                    if (lastChild.id === "buttons") {
                        for (var j = 0; j < lastChild.childElementCount; j++) {
                            targetChild = lastChild.childNodes[j];
                            if (targetChild.getAttribute("name") === "call") {
                                targetChild.disabled = true;
                                targetChild.childNodes[0].src = "img/phone-answer-gray-th.png";
                            }
                        }
                    }
                }
            }
        }
    } else {
        for (elem in peerCallList) {
            firstChild = peerCallList[elem];
            peerChildCount = firstChild.childElementCount;
            for (var i = 0; i < peerChildCount; i++) {
                lastChild = firstChild.childNodes[i];
                if (lastChild.id === "buttons") {
                    for (var j = 0; j < lastChild.childElementCount; j++) {
                        targetChild = lastChild.childNodes[j];
                        if (targetChild.getAttribute("name") === "call") {
                            targetChild.disabled = false;
                            targetChild.childNodes[0].src = "img/phone-answer-green-th.png";
                        } else {
                            targetChild.disabled = true;
                            targetChild.childNodes[0].src = "img/phone-hang-up-gray-th.png";
                        }
                    }
                }
            }
        }
    }
}

var CallAnswerErrorCallBack = function(e) {
    console.log("Something wrong happened when answer or offer %o", e);
};

var mergeConstraints = function(cons1, cons2) {
    var merged = cons1;
    for (var name in cons2.mandatory) merged.mandatory[name] = cons2.mandatory[name];
    merged.optional.concat(cons2.optional);
    return merged;
};

function doCall() {
    console.log("Sending offer to peer.");
      sendMessage({type: 'pleaseCallMe'});

    if (/*!started  && signed_In*/0) {
        console.log("Creating PeerConnection.");
        createPeerConnection();
        console.log("Adding local stream.");
        //pc.addStream(window.stream);
        console.log("started = true");
        started = true;
    }

    //setButton(true);
    //console.log("pc.createOffer in doCall().Sending offer to peer, with constraints: \n  \"" + JSON.stringify(mediaConstraints) + "\".");
    //pc.createOffer(setLocalAndSendMessage, CallAnswerErrorCallBack, mediaConstraints);
    //activeCall = true;
}

function doAnswer() {
    console.log("Sending answer to peer.");
    setButton(true);

    pc.createAnswer(setLocalAndSendMessage, CallAnswerErrorCallBack, mediaConstraints);

    activeCall = true;
}

function createRTCSessionDescription(msg) {
    console.log("createRTCSessionDescription ");
    var SessionDescription = new RTCSessionDescription(msg);
    return SessionDescription;
}

function processSignalingMessage(message, peer_id) {

  	var msglist = JSON.parse(message);

        var msg = JSON.parse(message);
        var msgString = JSON.stringify(msg);
        
        console.log("processSignalingMessage json message: %o", msgString);
        var type= 'candidate';
        try{
	        if(  msg.search("type") == -1){
	        	type = 'candidate';
		    } else {
		        type = msg.type;
		    }
        } catch (e) {
	        	type = 'candidate';
        }
	        if (message.search("candidate") != -1) {
	          type = "candidate";
	        }
	        if (message.search("answer") != -1) {
	          type = "answer";
	        }
	        if (message.search("offer") != -1) {
	          type = "offer";
	        }
	    console.log("processSignalingMessage message type: %o", type);
	    if (type === 'offer') {
	        document.getElementById("callee").value = other_peers[peer_id];
	        document.getElementById("peer_id").value = peer_id;
	
	        console.log('pc.setRemoteDescription() in offer');
	        pc.setRemoteDescription(createRTCSessionDescription(msg));
	
	        console.log("processSignalingMessage msg.type = %o", type);
	
	        doAnswer();
	    } else if (type === 'answer' && started) {
	        console.log("processSignalingMessage msg.type = %o", type);
	        pc.setRemoteDescription(createRTCSessionDescription(msg));
	    } else if (type === 'candidate' && started) {
	
	        console.log("processSignalingMessage msg.type = %o  msg: %o", type, msg);
	        var candidate =  new RTCIceCandidate({
	                                               sdpMLineIndex: msg.sdpMLineIndex,
	                                               candidate: msg.candidate
	                                             });
	        console.log('pc.addIceCandidate() in candidate');
	        try {
	        	pc.addIceCandidate(candidate);
		    } catch (e) {
		        console.error("error %o", e);
		    }
	    }
}

function onRemoteHangup() {
    console.log("onRemoteHangup");
    console.log('Session terminated.');
    setButton(false);
    stop();
}

function stop() {
    console.log("stop");
    started = false;
    destroylPeerConnection();
    document.getElementById("callee").value = "";
    document.getElementById("peer_id").value = ""
    activeCall = false;
    initializePeerConnection();
    changeVideoStreamStyles(false);
}

function updatePeers(add, peerId, name) {
    console.log("updatePeers");
    console.log("updatePeers %o, peer %o, name %o", add, peerId, name);
    var peerView = document.getElementById("peersLog");
    if (add) {
        var peerKeys = Object.keys(other_peers);
        if (peerKeys.length == 0) {
            peerView.innerHTML = "";
        }
        other_peers[peerId] = name;
        createPeerToCall(name, peerId, peerView);
    } else {
        delete other_peers[peerId];
        deletePeerRow(peerId);
        var peerKeys = Object.keys(other_peers);
        if (peerKeys.length == 0) {
            peerView.innerHTML = "No available peers.";
        }
    }
}

function showSignInStatus() {
    var avPeers = document.getElementById("availablePeers");
    var peerData = document.getElementById("idpeersData");
    console.log("showPeers signed_In = %o", signed_In);
    if (signed_In) {
        avPeers.innerHTML = "Available peers";
        peerData.style["visibility"] = "visible";
        document.getElementById("connect").disabled = true;
        document.getElementById("disconnect").disabled = false;
    } else {
        avPeers.innerHTML = "";
        peerData.style["visibility"] = "hidden";
        document.getElementById("connect").disabled = false;
        document.getElementById("disconnect").disabled = true;
    }
}

function callThisPeer(peer_id) {
    document.getElementById("callee").value = other_peers[peer_id];
    document.getElementById("peer_id").value = peer_id;
    connectedPeerId = peer_id;
    call();
}

function createPeerToCall(name, peerId, elem) {
    console.log("createPeerToCall name = %o", name);
    var table = document.getElementById("peersLog");
    var rowCount = table.rows.length;

    var row = table.insertRow(rowCount);
    row.setAttribute("name", "peer");
    row.setAttribute("id", "peer" + peerId);
    var newcell0 = row.insertCell(0);
    newcell0.style["witdh"] = "60px";
    newcell0.setAttribute("id", "buttons");
    newcell0.setAttribute("class", "peerInfo");
    if (!activeCall) {
        newcell0.innerHTML = '<button name="call" class="imgbutton" id="' + peerId + '" onclick="callThisPeer(this.id)">' +
                '<img id="imgCall" src="img/phone-answer-green-th.png"/></button>' +
                '<button name="hangup" class="imgbutton" id="hangup" onClick="hangup()" disabled=true>' +
                '<img id="imgHangUp" src="img/phone-hang-up-gray-th.png"/></button></td>';
    } else {
        newcell0.innerHTML = '<button name="call" class="imgbutton" id="' + peerId + '" onclick="callThisPeer(this.id)" disabled=true>' +
                '<img id="imgCall" src="img/phone-answer-gray-th.png"/></button>' +
                '<button name="hangup" class="imgbutton" id="hangup" onClick="hangup()" disabled=true>' +
                '<img id="imgHangUp" src="img/phone-hang-up-gray-th.png"/></button></td>';
    }
    var newcell1 = row.insertCell(1);
    newcell1.setAttribute("id", "info");
    newcell1.setAttribute("class", "peerName");
    newcell1.innerHTML = '<b>' + name + '</b>';
}

function deletePeerRow(peerId) {
    var peerElem = document.getElementById("peer" + peerId);
    var table = document.getElementById("peersLog");

    var index = peerElem.rowIndex;
    table.deleteRow(index);
}

function randomString() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_rand = '';
    for (var i = 0; i < 4; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        string_rand += chars.substring(rnum, rnum + 1);
    }
    return string_rand;
}

function onLoad() {
    console.log("onLoad");

    //if (window.stream) {
    //    window.stream.getTracks().forEach(function(track) {
     //       track.stop();
    //    });
   // }

    showSignInStatus();

    document.getElementById("local").value = "PC" + randomString();

    //Ask for local streams to be prepared, display self view
    document.getElementById("peersLog").innerHTML = "No available peers.";
    document.getElementById("peersLog").style["left"] = "0px";
    document.getElementById('local').onkeypress=function(e){
        if(e.keyCode == 13){
            document.getElementById('connect').click();
        }
    }

    //navigator.mediaDevices.getUserMedia({video: true}).then(gotStream);
}



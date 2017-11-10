Webrtc-H264Capturer
-------------------

Workarounds to use external H.264 video encoders in WebRTC Native C++ source code.   
A fake YUV capturer is used to write the H.264 elementary stream. Then, H.264 encoding (OpenH264) is bypassed and the elementary stream is directly packetized.

A web client is also provided in order to perform video streaming between WebRTC Native C++ and a web browser.

Useful references:   
https://github.com/mpromonet/webrtc-streamer   
https://github.com/zhanghuicuc/WebRTC-VideoEngine-Demo


Environment
-----------
Tested with Ubuntu 14.04.3, Kernel 3.16.0-59-generic.   
Prerequisites: git, curl, python, "build-essential"...

Build
----- 
Get WebRTC (https://webrtc.org/native-code/development/):   
	
	mkdir webrtc-checkout
	cd webrtc-checkout
	fetch --nohooks webrtc
	gclient sync --with_branch_heads
	export WEBRTC_DIR=`pwd`
	

Checkout the revision before patching:   
	
	cd $WEBRTC_DIR/src
	git checkout branch-heads/62
	python setup_links.py --force
	gclient sync

If needed (see terminal outputs):
	
	python setup_links.py --force
	gclient sync



Apply the patch and generate ninja files:   
	
	cd $WEBRTC_DIR/src
	patch -p1 < ../../webrtc_patch.diff
	gn gen out/Default --args='rtc_use_h264=true is_component_ffmpeg=true rtc_include_tests=false  rtc_libvpx_build_vp9=false  rtc_build_opus=false rtc_include_opus=false rtc_build_openmax_dl=false rtc_use_openmax_dl=false rtc_use_gtk=false'

Third Party Libraries:

 - FFmpeg
	
		cd $WEBRTC_DIR/src/third_party/ffmpeg
		mkdir build
		./configure --enable-shared --disable-programs --disable-doc --prefix=$WEBRTC_DIR/src/third_party/ffmpeg/build --sysroot=$WEBRTC_DIR/src/build/linux/debian_jessie_amd64-sysroot --cc=$WEBRTC_DIR/src/third_party/llvm-build/Release+Asserts/bin/clang --ld=$WEBRTC_DIR/src/third_party/llvm-build/Release+Asserts/bin/clang
		make && make install
		cp $WEBRTC_DIR/src/third_party/ffmpeg/build/lib/*   $WEBRTC_DIR/src/out/Default

 - Add shared libraries linking in Ninja files
	
		cd $WEBRTC_DIR/src
		grep -rl "solibs" ./out --include="peerconnection_client.ninja" | xargs sed -i '/solibs/s|./libffmpeg.so|./libavcodec.so ./libavformat.so ./libavutil.so ./libswscale.so|g'

H.264 capturer support:
	
	cp H264_capturer/* $WEBRTC_DIR/src/webrtc/examples/peerconnection/client   

*H.264 external encoding support is enabled by including h264videocapturer.h  in conductor.cc (see webrtc_patch.diff).*



	cd $WEBRTC_DIR/src
	find out/ -name "peerconnection_client.ninja" | xargs sed -i 's|include_dirs =|include_dirs = -I../../third_party/ffmpeg/build/include |g'

Build peerconnection_server/client:
	
	ninja -C out/Default peerconnection_server
	ninja -C out/Default peerconnection_client

Usage
----- 
Launch the server:   
	
	$WEBRTC_DIR/src/out/Default/peerconnection_server

Launch the client with the external H.264 stream URL, e.g.:   
	
	$WEBRTC_DIR/src/out/Default/peerconnection_client  --video_url "rtsp://192.168.123.53/Channel1"

*The original GUI (gtk) of peerconnection_client has been removed in order to ease the integration in embeded system (e.g. Raspberry Pi ). Therefore the SDP offer made in conductor.cc in sendonly.*

Connect with a second client, e.g.:   
	
	firefox Web_client/index.html
*To allow the peerconnection to be initiated from the web client, firefox must be configured (about:config) with (integer) media.navigator.video.preferred_codec = 126*


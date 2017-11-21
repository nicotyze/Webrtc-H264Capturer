Toolchain installation
----------------------
Environment setup:
	
	sudo apt update && sudo apt install -y debootstrap qemu-user-static git python-dev

In a working directory:
	
	git clone https://github.com/raspberrypi/tools.git  rpi_tools
	export PATH=`pwd`/rpi_tools/arm-bcm2708/gcc-linaro-arm-linux-gnueabihf-raspbian-x64/bin:$PATH
	export CCPREFIX=`pwd`/rpi_tools/arm-bcm2708/gcc-linaro-arm-linux-gnueabihf-raspbian-x64/bin/arm-linux-gnueabihf-
	debootstrap --arch armhf --foreign --include=g++,libasound2-dev,libpulse-dev,libudev-dev,libexpat1-dev,libnss3-dev,libgtk2.0-dev wheezy rootfs
	cp /usr/bin/qemu-arm-static rootfs/usr/bin/
	sudo chroot rootfs /debootstrap/debootstrap --second-stage
	find rootfs/usr/lib/arm-linux-gnueabihf -lname '/*' -printf '%p %l\n' | while read link target; do sudo ln -snfv "../../..${target}" "${link}"; done
	find rootfs/usr/lib/arm-linux-gnueabihf/pkgconfig -printf "%f\n" | while read target; do sudo ln -snfv "../../lib/arm-linux-gnueabihf/pkgconfig/${target}" rootfs/usr/share/pkgconfig/${target}; done

WebRTC cross compilation
------------------------

WebRTC fetch, checkout and patching steps described in README.md are supposed to be done before cross comiling.

- Generate ninja files:
	
		cd $WEBRTC_DIR/src
		gn gen out/Pi --args='rtc_use_h264=true is_component_ffmpeg=true rtc_include_tests=false  rtc_libvpx_build_vp9=false  rtc_build_opus=false rtc_include_opus=false rtc_build_openmax_dl=false rtc_use_openmax_dl=false rtc_use_gtk=false target_os="linux" target_cpu="arm"'

- Cross compile FFmpeg
	
		cd $WEBRTC_DIR/src/third_party/ffmpeg
		make clean && make distclean
		mkdir build_arm
		./configure --enable-cross-compile --cross-prefix=${CCPREFIX} --arch=armel --target-os=linux --enable-gpl  --extra-ldflags="-ldl" --prefix=$WEBRTC_DIR/src/third_party/ffmpeg/build_arm --enable-shared --disable-static
		make -j 4
		make install
		cp $WEBRTC_DIR/src/third_party/ffmpeg/build_arm/lib/*   $WEBRTC_DIR/src/out/Pi/

- Cross compile peerconnection example:
	
		find $WEBRTC_DIR/src/out/Pi -name "peerconnection_client.ninja" | xargs sed -i 's|include_dirs =|include_dirs = -I../../third_party/ffmpeg/build_arm/include |g'
		grep -rl "solibs" ./out/Pi --include="peerconnection_client.ninja" | xargs sed -i '/solibs/s|./libffmpeg.so|./libavcodec.so ./libavformat.so ./libavutil.so ./libswscale.so|g'
		ninja -C out/Pi peerconnection_server
		ninja -C out/Pi peerconnection_client


 